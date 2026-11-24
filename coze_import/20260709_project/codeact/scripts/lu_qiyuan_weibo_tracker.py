#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""卢麒元微博追踪脚本

通过搜索引擎搜索卢麒元老师的新浪微博最新内容，
去重后整理成 Markdown 文档。每天运行两次，每次只输出新发现的内容。

搜索策略:
- 使用 codeact_search_web 搜索 "卢麒元 微博"、"卢麒元 m.weibo.cn"、"卢麒元 新浪微博"
- 使用 publish_time 参数过滤最近 N 小时
- 只保留 URL 中包含 m.weibo.cn/detail/ 或 m.weibo.cn/status/ 的结果

去重策略:
- SQLite 表 seen_posts，post_id（URL 中的数字 ID）为主键
- 冷启动首次运行：建库并输出找到的最近内容作为基线
- 后续运行：只展示新增内容

输出:
- Markdown 文件：卢麒元微博_YYYY-MM-DD_HHMM.md
- 每条微博包含发布时间、正文内容、原文链接，按时间倒序排列
- 文档末尾附来源链接列表

参数:
- result_mode: auto / notify / no_reply（默认 auto）
  - auto: 有新内容→notify，无新内容→no_reply
- lookback_hours: 回看时间窗口小时数（默认 12）
- baseline_lookback_hours: 冷启动回看小时数（默认 72）

状态库:
- 表 seen_posts：post_id TEXT PK, url, title, content, publish_time, first_seen
- 表 meta：key TEXT PK, value TEXT
- 去重口径：微博详情页 URL 的 post_id 部分（m.weibo.cn/detail/{post_id} 或 m.weibo.cn/status/{post_id}）
"""

import asyncio
import os
import re
import sqlite3
import sys
import traceback
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests
from codeact_sdk import CodeActSDK

# ===== SDK 工具版本 =====
TOOL_SCHEMA_VERSIONS = {
    "codeact_search_web": "v1_5ac1b0eba8c26f2a",
    "codeact_fetch_web": "v1_2c8d0580b3f93a58",
}

# ===== 常量 =====
TZ = timezone(timedelta(hours=8))

# 追踪目录与状态库路径
TRACK_DIR = "/app/data/所有对话/主对话/热点资讯追踪/卢麒元微博追踪"
DB_PATH = os.path.join(TRACK_DIR, "lu_qiyuan_seen.db")

# 搜索关键词
SEARCH_QUERIES = [
    "卢麒元 微博",
    "卢麒元 m.weibo.cn",
    "卢麒元 新浪微博",
]

# URL 过滤正则：匹配 m.weibo.cn/detail/{id} 或 m.weibo.cn/status/{id}
WEIBO_URL_RE = re.compile(r"m\.weibo\.cn/(?:detail|status)/(\d+)")

# HTTP 请求通用 headers（用于微博 API）
HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://m.weibo.cn/",
}
HTTP_TIMEOUT = 10


# ===== 工具函数 =====

def extract_post_id(url: str) -> Optional[str]:
    """从 m.weibo.cn URL 中提取 post_id。"""
    match = WEIBO_URL_RE.search(url or "")
    return match.group(1) if match else None


def now_cn() -> datetime:
    return datetime.now(TZ)


def build_publish_time_window(lookback_hours: int) -> dict:
    """构造 codeact_search_web 的发布时间过滤窗口（RFC3339 带时区）。"""
    end = now_cn()
    start = end - timedelta(hours=lookback_hours)
    return {
        "start": start.isoformat(timespec="seconds"),
        "end": end.isoformat(timespec="seconds"),
    }


def parse_date_str(date_str: str) -> Optional[datetime]:
    """解析多种时间格式，返回 timezone-aware datetime。"""
    raw = (date_str or "").strip()
    if not raw:
        return None
    # ISO 格式（含时区）
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt.replace(tzinfo=TZ) if dt.tzinfo is None else dt.astimezone(TZ)
    except Exception:
        pass
    # 去掉时区后缀，尝试常见格式
    normalized = re.sub(r"([+-]\d{2}:?\d{2})$", "", raw.replace("T", " ")).strip()
    for fmt in [
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d",
        "%Y年%m月%d日 %H:%M", "%Y年%m月%d日",
        "%Y/%m/%d %H:%M:%S", "%Y/%m/%d", "%Y.%m.%d",
    ]:
        try:
            dt = datetime.strptime(normalized, fmt)
            return dt.replace(tzinfo=TZ)
        except Exception:
            continue
    # 微博 API 时间格式: "Mon Jan 01 10:00:00 +0800 2024"
    try:
        dt = datetime.strptime(raw, "%a %b %d %H:%M:%S %z %Y")
        return dt.astimezone(TZ)
    except Exception:
        pass
    return None


def clean_html(text: str) -> str:
    """去除 HTML 标签，保留纯文本。"""
    if not text:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def format_time_str(dt: Optional[datetime]) -> str:
    if dt is None:
        return "未知时间"
    return dt.strftime("%Y-%m-%d %H:%M")


# ===== 状态库 =====

def init_state_db() -> sqlite3.Connection:
    """初始化 SQLite 状态库。

    表结构:
    - seen_posts: 微博去重表，post_id 为 PK
    - meta: 元信息表，记录基线状态等
    """
    os.makedirs(TRACK_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS seen_posts (
            post_id TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            title TEXT,
            content TEXT,
            publish_time TEXT,
            first_seen TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    conn.commit()
    return conn


def get_meta(conn: sqlite3.Connection, key: str, default: str = "") -> str:
    row = conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
    return row[0] if row else default


def set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )
    conn.commit()


def is_baseline_completed(conn: sqlite3.Connection) -> bool:
    return get_meta(conn, "baseline_completed", "0") == "1"


def get_seen_post_ids(conn: sqlite3.Connection) -> set:
    rows = conn.execute("SELECT post_id FROM seen_posts").fetchall()
    return {r[0] for r in rows}


def save_seen_posts(conn: sqlite3.Connection, items: list[dict]) -> None:
    """将新微博写入状态库（仅成功提交后调用）。"""
    ts = now_cn().isoformat(timespec="seconds")
    conn.executemany(
        """
        INSERT OR IGNORE INTO seen_posts
            (post_id, url, title, content, publish_time, first_seen)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            (
                item["post_id"],
                item["url"],
                item.get("title", "")[:200],
                item.get("content", "")[:2000],
                item.get("publish_time", ""),
                ts,
            )
            for item in items
        ],
    )
    conn.commit()


# ===== 搜索 =====

async def search_weibo(sdk: CodeActSDK, query: str, publish_window: dict) -> list[dict]:
    """执行单次搜索，返回筛选后的微博结果列表。

    只保留 URL 中包含 m.weibo.cn/detail/ 或 m.weibo.cn/status/ 的结果。
    """
    try:
        result = await sdk.call_tool(
            "codeact_search_web",
            {
                "query": query,
                "publish_time": publish_window,
                "response_length": "long",
            },
            schema_version=TOOL_SCHEMA_VERSIONS["codeact_search_web"],
        )
        if not result or result.get("is_success") is False:
            print(f"[搜索] query='{query}' 返回失败: {result.get('error', '') if result else '空结果'}")
            return []
        items = result.get("results") or []
        weibo_items = []
        for item in items:
            url = item.get("url", "")
            post_id = extract_post_id(url)
            if not post_id:
                continue
            weibo_items.append({
                "post_id": post_id,
                "url": url,
                "title": (item.get("title") or "").strip(),
                "content": (item.get("snippet") or "").strip(),
                "publish_time": item.get("publish_time") or "",
            })
        print(f"[搜索] query='{query}' → {len(items)} 条结果，筛选后 {len(weibo_items)} 条微博")
        return weibo_items
    except Exception as e:
        print(f"[搜索] query='{query}' 异常: {e}")
        return []


# ===== 微博 API 获取完整内容 =====

def fetch_weibo_api(post_id: str) -> Optional[dict]:
    """通过微博移动端 API 获取完整微博内容。

    API: https://m.weibo.cn/statuses/show?id={post_id}
    返回 JSON，包含 text（HTML 格式）、created_at 等字段。
    失败时返回 None，调用方回退到搜索摘要。
    """
    try:
        resp = requests.get(
            f"https://m.weibo.cn/statuses/show?id={post_id}",
            headers=HTTP_HEADERS,
            timeout=HTTP_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("ok") != 1:
            return None
        post_data = data.get("data", {})
        if not post_data:
            return None
        text = clean_html(post_data.get("text", ""))
        created_at = post_data.get("created_at", "")
        dt = parse_date_str(created_at)
        time_str = dt.isoformat(timespec="seconds") if dt else created_at
        return {
            "content": text,
            "publish_time": time_str,
        }
    except Exception as e:
        print(f"[API] post_id={post_id} 获取失败: {e}")
        return None


async def enrich_posts_with_api(posts: list[dict]) -> None:
    """并发调用微博 API 丰富帖子内容（原地修改）。

    对每个帖子尝试获取完整正文和精确时间，API 失败则保留搜索摘要。
    """
    if not posts:
        return
    loop = asyncio.get_event_loop()
    api_results = await asyncio.gather(
        *[loop.run_in_executor(None, fetch_weibo_api, p["post_id"]) for p in posts],
        return_exceptions=True,
    )
    enriched = 0
    for post, api_result in zip(posts, api_results):
        if isinstance(api_result, dict):
            if api_result.get("content") and len(api_result["content"]) > len(post.get("content", "")):
                post["content"] = api_result["content"]
                enriched += 1
            if api_result.get("publish_time"):
                post["publish_time"] = api_result["publish_time"]
    print(f"[API] 成功丰富 {enriched}/{len(posts)} 条微博内容")


# ===== Markdown 生成 =====

def generate_markdown(posts: list[dict], scan_time: str, is_baseline: bool = False) -> str:
    """生成 Markdown 报告，按时间倒序排列。"""
    lines = []

    if is_baseline:
        lines.append("# 卢麒元微博追踪 — 基线初始化")
    else:
        lines.append("# 卢麒元微博追踪 — 新增内容")

    lines.append("")
    lines.append(f"> 扫描时间: {scan_time}")
    lines.append(f"> 微博数量: {len(posts)} 条")
    lines.append("")
    if is_baseline:
        lines.append("> 本次为首次运行（冷启动基线），已记录以上内容作为基线。后续运行将只推送新增内容。")
        lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 微博内容")
    lines.append("")

    # 按发布时间倒序排列
    def sort_key(item):
        dt = parse_date_str(item.get("publish_time"))
        return dt or datetime.min.replace(tzinfo=TZ)

    sorted_posts = sorted(posts, key=sort_key, reverse=True)

    for i, post in enumerate(sorted_posts, 1):
        dt = parse_date_str(post.get("publish_time"))
        time_str = format_time_str(dt)
        lines.append(f"### {i}. {time_str}")
        lines.append("")
        content = post.get("content", "").strip()
        if content:
            lines.append(content)
        else:
            lines.append("（正文内容获取失败）")
        lines.append("")
        lines.append(f"原文链接: {post['url']}")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## 来源链接")
    lines.append("")
    for i, post in enumerate(sorted_posts, 1):
        lines.append(f"{i}. {post['url']}")

    return "\n".join(lines)


# ===== 主流程 =====

async def main():
    result_mode_raw = sys.argv[1] if len(sys.argv) > 1 else "auto"
    lookback_hours = int(sys.argv[2]) if len(sys.argv) > 2 else 12
    baseline_lookback_hours = int(sys.argv[3]) if len(sys.argv) > 3 else 72

    sdk = CodeActSDK()
    conn = None

    try:
        mode = (result_mode_raw or "auto").strip().lower()
        if mode not in {"auto", "notify", "no_reply"}:
            raise ValueError("result_mode 只能是 auto / notify / no_reply")

        now = now_cn()
        scan_time = now.strftime("%Y-%m-%d %H:%M")
        print(f"[参数] result_mode={mode}, lookback_hours={lookback_hours}, baseline_lookback_hours={baseline_lookback_hours}")
        print(f"[时间] {scan_time}")

        # 确保目录存在
        os.makedirs(TRACK_DIR, exist_ok=True)

        # 初始化状态库
        conn = init_state_db()
        baseline_mode = not is_baseline_completed(conn)
        print(f"[状态] baseline_mode={baseline_mode}")

        # 确定搜索时间窗口
        effective_lookback = baseline_lookback_hours if baseline_mode else lookback_hours
        publish_window = build_publish_time_window(effective_lookback)
        print(f"[窗口] {publish_window['start']} ~ {publish_window['end']} (回看 {effective_lookback} 小时)")

        # ===== 并发搜索 =====
        print("\n===== 开始搜索 =====")
        sem = asyncio.Semaphore(3)

        async def search_with_sem(query: str) -> list[dict]:
            async with sem:
                return await search_weibo(sdk, query, publish_window)

        search_results = await asyncio.gather(
            *(search_with_sem(q) for q in SEARCH_QUERIES),
            return_exceptions=True,
        )

        # 合并去重（by post_id），保留更长内容
        all_items: dict[str, dict] = {}
        for result in search_results:
            if isinstance(result, Exception):
                print(f"[搜索异常] {result}")
                continue
            for item in result:
                pid = item["post_id"]
                if pid not in all_items:
                    all_items[pid] = item
                else:
                    # 合并：优先保留更长内容和更完整的时间
                    if len(item.get("content", "")) > len(all_items[pid].get("content", "")):
                        all_items[pid]["content"] = item["content"]
                    if not all_items[pid].get("publish_time") and item.get("publish_time"):
                        all_items[pid]["publish_time"] = item["publish_time"]
                    if not all_items[pid].get("title") and item.get("title"):
                        all_items[pid]["title"] = item["title"]

        all_posts = list(all_items.values())
        print(f"[汇总] 去重后共 {len(all_posts)} 条微博")

        # ===== 冷启动基线 =====
        if baseline_mode:
            if not all_posts:
                print("[结果] 冷启动但未找到任何微博内容")
                set_meta(conn, "baseline_completed", "1")
                set_meta(conn, "baseline_completed_at", now.isoformat(timespec="seconds"))
                actual_mode = "no_reply" if mode == "auto" else mode
                await sdk.submit_result(
                    result_mode=actual_mode,
                    status="success",
                    message="NO_REPLY" if actual_mode == "no_reply" else "冷启动完成，但未搜索到卢麒元微博内容。",
                    data={"baseline_mode": True, "total_found": 0, "new_items": 0, "state_db": DB_PATH},
                )
                return

            # 尝试通过 API 获取完整内容
            print("\n===== 获取微博完整内容（基线）=====")
            await enrich_posts_with_api(all_posts)

            # 保存到状态库
            save_seen_posts(conn, all_posts)
            set_meta(conn, "baseline_completed", "1")
            set_meta(conn, "baseline_completed_at", now.isoformat(timespec="seconds"))
            print(f"[状态] 基线完成，已记录 {len(all_posts)} 条微博")

            # 生成 Markdown 报告
            md_content = generate_markdown(all_posts, scan_time, is_baseline=True)
            filename = f"卢麒元微博_{now.strftime('%Y-%m-%d_%H%M')}.md"
            md_path = os.path.join(TRACK_DIR, filename)
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(md_content)
            print(f"[输出] 基线报告已保存: {md_path}")

            abs_path = os.path.abspath(md_path)
            message = (
                f"[主人](at://owner) 📋 卢麒元微博追踪 — 基线初始化完成\n"
                f"首次运行已记录 {len(all_posts)} 条微博作为基线。\n"
                f"后续运行将只推送新增内容。\n\n"
                f"基线报告：[卢麒元微博_{now.strftime('%Y-%m-%d_%H%M')}](computer://{abs_path})"
            )

            actual_mode = "notify" if mode == "auto" else mode
            await sdk.submit_result(
                result_mode=actual_mode,
                status="success",
                message=message,
                data={
                    "baseline_mode": True,
                    "total_found": len(all_posts),
                    "new_items": len(all_posts),
                    "state_db": DB_PATH,
                    "report_path": md_path,
                },
            )
            return

        # ===== 正常增量模式 =====
        seen_ids = get_seen_post_ids(conn)
        new_posts = [p for p in all_posts if p["post_id"] not in seen_ids]
        print(f"[去重] 新增 {len(new_posts)} 条（已见 {len(all_posts) - len(new_posts)} 条）")

        if not new_posts:
            print("[结果] 无新增内容")
            actual_mode = "no_reply" if mode == "auto" else mode
            await sdk.submit_result(
                result_mode=actual_mode,
                status="success",
                message="NO_REPLY" if actual_mode == "no_reply" else f"本次扫描 {len(all_posts)} 条，无新增微博内容。",
                data={
                    "baseline_mode": False,
                    "total_found": len(all_posts),
                    "new_items": 0,
                    "state_db": DB_PATH,
                },
            )
            return

        # 尝试通过 API 获取完整内容
        print("\n===== 获取微博完整内容 =====")
        await enrich_posts_with_api(new_posts)

        # 生成 Markdown 报告
        md_content = generate_markdown(new_posts, scan_time, is_baseline=False)
        filename = f"卢麒元微博_{now.strftime('%Y-%m-%d_%H%M')}.md"
        md_path = os.path.join(TRACK_DIR, filename)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)
        print(f"[输出] 报告已保存: {md_path}")

        # 保存到状态库
        save_seen_posts(conn, new_posts)

        abs_path = os.path.abspath(md_path)
        message_lines = [
            f"[主人](at://owner) 📡 卢麒元微博追踪 | {scan_time}",
            f"发现 {len(new_posts)} 条新微博内容：",
            "",
        ]
        # 简要预览（最多 3 条）
        for i, post in enumerate(new_posts[:3], 1):
            dt = parse_date_str(post.get("publish_time"))
            time_str = format_time_str(dt)
            content_preview = (post.get("content") or "")[:80].replace("\n", " ")
            if len(post.get("content", "")) > 80:
                content_preview += "..."
            message_lines.append(f"{i}. [{time_str}] {content_preview}")
        message_lines.append("")
        message_lines.append(f"完整报告：[卢麒元微博_{now.strftime('%Y-%m-%d_%H%M')}](computer://{abs_path})")

        message = "\n".join(message_lines)

        actual_mode = "notify" if mode == "auto" else mode
        await sdk.submit_result(
            result_mode=actual_mode,
            status="success",
            message=message,
            data={
                "baseline_mode": False,
                "total_found": len(all_posts),
                "new_items": len(new_posts),
                "state_db": DB_PATH,
                "report_path": md_path,
            },
        )

    except Exception as e:
        print(f"[错误] {e}\n{traceback.format_exc()}")
        await sdk.submit_result(
            result_mode="notify",
            status="error",
            message=f"卢麒元微博追踪执行失败：{e}",
            data={"error_type": type(e).__name__, "state_db": DB_PATH},
        )
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    asyncio.run(main())
