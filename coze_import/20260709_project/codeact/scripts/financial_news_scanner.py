#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""财经快讯监控扫描脚本

每小时从多个财经信息源抓取最新快讯，筛选与用户关注标的相关的信息并推送通知。

数据源（按优先级）:
1. 华尔街见闻 API (requests) — 文章流，JSON 格式
2. 东方财富 7x24 快讯 API (requests) — JSONP 格式
3. 新浪财经 7x24 快讯 API (requests) — JSON 格式
4. 财联社 (codeact_search_web) — 搜索补充

功能:
- 从多个信息源并发抓取最新财经快讯
- 关键词匹配筛选与用户关注标的/行业/宏观事件相关的信息
- SQLite 状态库去重，避免重复推送
- 冷启动基线：首次运行只建基线不推送
- result_mode=auto：有新内容→display_only（@主人），无新内容→no_reply

参数:
- result_mode: auto / display_only / notify / no_reply（默认 auto）
- lookback_minutes: 回看时间窗口分钟数（默认 120）
- workday_only: 是否仅工作日运行（默认 1=是）
"""

import asyncio
import hashlib
import json
import os
import re
import sqlite3
import sys
import time
import traceback
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import requests
from codeact_sdk import CodeActSDK

# ===== SDK 工具版本 =====
TOOL_SCHEMA_VERSIONS = {
    "codeact_search_web": "v1_5ac1b0eba8c26f2a",
    "codeact_fetch_web": "v1_2c8d0580b3f93a58",
}

# ===== 常量 =====
TZ = timezone(timedelta(hours=8))
OUTPUT_DIR = "./codeact/output"
STATE_DB = os.path.join(OUTPUT_DIR, "financial_scan_state.db")

# HTTP 请求通用 headers
HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}
HTTP_TIMEOUT = 12

# ===== 关注标的与关键词 =====

# 标的名称和代码
WATCH_STOCKS = [
    ("半导体设备ETF国泰", "159516"),
    ("中远海能", "600026"),
    ("航天动力", "600343"),
    ("九安医疗", "002432"),
    ("永鼎股份", "600105"),
    ("海思科", "002653"),
    ("机器人ETF华夏", "562500"),
    ("机器人ETF景顺", "159559"),
]

# 行业关键词
INDUSTRY_KEYWORDS = [
    "油运", "VLCC", "原油运输", "运价",
    "半导体设备", "半导体", "芯片设备", "国产替代", "光刻",
    "商业航天", "航天发射", "火箭", "卫星互联网",
    "医疗器械", "医疗设备", "体外诊断",
    "光通信", "超导", "光模块", "光纤",
    "创新药", "生物医药", "临床试验", "药品审评",
    "人形机器人", "机器人", "具身智能",
]

# 宏观财经事件关键词
MACRO_KEYWORDS = [
    "美联储", "降息", "加息", "联邦基金利率", "鲍威尔",
    "央行", "货币政策", "LPR", "MLF", "降准", "逆回购",
    "GDP", "CPI", "PPI", "PMI", "非农", "失业率",
    "地缘", "战争", "冲突", "制裁", "关税",
    "国务院", "证监会", "金融监管", "财政部", "发改委",
    "A股", "沪深", "北向资金", "融资融券",
]

# 所有关键词合并（去重）
ALL_KEYWORDS = list(dict.fromkeys(
    [kw for _, code in WATCH_STOCKS for kw in (_, code)]
    + INDUSTRY_KEYWORDS
    + MACRO_KEYWORDS
))

# 财联社搜索补充查询
CLS_SEARCH_QUERIES = [
    "财联社 电报 半导体 油运 航天",
    "财联社 快讯 机器人 创新药 超导",
]


# ===== 状态库 =====

def init_state_db() -> sqlite3.Connection:
    """初始化 SQLite 状态库。

    表结构:
    - seen_news: 快讯去重表，news_hash 为 PK
    - meta: 元信息表，记录基线状态等
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    conn = sqlite3.connect(STATE_DB)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS seen_news (
            news_hash TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            source TEXT NOT NULL,
            content_preview TEXT,
            matched_keywords TEXT,
            first_seen TEXT NOT NULL,
            last_seen TEXT NOT NULL
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


def news_hash(title: str, content: str) -> str:
    """基于标题+内容前100字生成去重指纹。"""
    base = re.sub(r"\s+", "", (title or "") + (content or "")[:100])
    return hashlib.sha1(base.encode("utf-8")).hexdigest()[:16]


def get_seen_hashes(conn: sqlite3.Connection) -> set:
    rows = conn.execute("SELECT news_hash FROM seen_news").fetchall()
    return {r[0] for r in rows}


def save_seen_news(
    conn: sqlite3.Connection,
    items: list[dict],
) -> None:
    """将新快讯写入状态库（仅成功提交后调用）。"""
    ts = datetime.now(TZ).isoformat(timespec="seconds")
    conn.executemany(
        """
        INSERT OR IGNORE INTO seen_news
            (news_hash, title, source, content_preview, matched_keywords, first_seen, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                item["hash"],
                item["title"][:200],
                item["source"],
                item.get("content", "")[:300],
                ",".join(item.get("matched_keywords", [])),
                ts,
                ts,
            )
            for item in items
        ],
    )
    conn.commit()


# ===== 时间工具 =====

def now_cn() -> datetime:
    return datetime.now(TZ)


def parse_timestamp(value: Any) -> Optional[datetime]:
    """兼容多种时间格式：unix 时间戳（int/float/str）、ISO 字符串、中文日期。"""
    if value is None:
        return None
    # unix 时间戳
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=TZ)
        except (ValueError, OSError):
            return None
    raw = str(value).strip()
    if not raw:
        return None
    # 尝试纯数字（unix 时间戳）
    if re.match(r"^\d{10}$", raw):
        try:
            return datetime.fromtimestamp(int(raw), tz=TZ)
        except (ValueError, OSError):
            pass
    if re.match(r"^\d{13}$", raw):
        try:
            return datetime.fromtimestamp(int(raw) / 1000, tz=TZ)
        except (ValueError, OSError):
            pass
    # ISO 格式
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt.replace(tzinfo=TZ) if dt.tzinfo is None else dt.astimezone(TZ)
    except Exception:
        pass
    # 中文日期时间
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d",
                "%Y年%m月%d日 %H:%M", "%Y年%m月%d日", "%Y/%m/%d %H:%M:%S", "%Y/%m/%d"]:
        try:
            dt = datetime.strptime(raw[:len(datetime.now().strftime(fmt))], fmt)
            return dt.replace(tzinfo=TZ) if dt.tzinfo is None else dt
        except Exception:
            continue
    # 尝试从字符串中提取日期
    match = re.search(r"(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})", raw)
    if match:
        try:
            return datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)), tzinfo=TZ)
        except ValueError:
            pass
    return None


def is_within_window(dt: Optional[datetime], cutoff: datetime) -> bool:
    """判断时间是否在回看窗口内。无时间的条目保守保留。"""
    if dt is None:
        return True
    # 确保 timezone-aware
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=TZ)
    return dt >= cutoff


# ===== 数据源：华尔街见闻 =====

def fetch_wallstreetcn() -> list[dict]:
    """华尔街见闻文章流 API。"""
    print("[华尔街见闻] 正在获取...")
    try:
        resp = requests.get(
            "https://api-one-wscn.awtmt.com/apiv1/content/information-flow",
            params={"channel": "global-channel", "accept": "article", "limit": "30"},
            headers=HTTP_HEADERS,
            timeout=HTTP_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        items = data.get("data", {}).get("items", [])
        results = []
        for item in items:
            res = item.get("resource", {})
            if not res:
                continue
            title = (res.get("title") or "").strip()
            if not title:
                continue
            content = (res.get("content_short") or "").strip()
            display_time = res.get("display_time")
            uri = res.get("uri") or ""
            results.append({
                "title": title,
                "content": content,
                "source": "华尔街见闻",
                "timestamp": display_time,
                "url": uri,
            })
        print(f"[华尔街见闻] 获取 {len(results)} 条")
        return results
    except Exception as e:
        print(f"[华尔街见闻] 获取失败: {e}")
        return []


# ===== 数据源：东方财富 7x24 =====

def fetch_eastmoney() -> list[dict]:
    """东方财富 7x24 快讯 API (JSONP)。"""
    print("[东方财富] 正在获取...")
    results = []
    # 102=7x24全球直播, 101=红字焦点
    for col_type in ["102", "101"]:
        try:
            resp = requests.get(
                f"https://newsapi.eastmoney.com/kuaixun/v1/getlist_{col_type}_ajaxResult_50_1_.html",
                headers={**HTTP_HEADERS, "Referer": "https://kuaixun.eastmoney.com/"},
                timeout=HTTP_TIMEOUT,
            )
            text = resp.text
            match = re.search(r"var ajaxResult=(\{.*\})", text, re.DOTALL)
            if not match:
                continue
            data = json.loads(match.group(1))
            lives = data.get("LivesList", [])
            for item in lives:
                title = (item.get("title") or "").strip()
                digest = (item.get("digest") or "").strip()
                # digest 通常以【标题】开头，去掉重复标题
                content = re.sub(r"^【[^】]*】", "", digest).strip() if digest else ""
                showtime = item.get("showtime") or ""
                url = item.get("url_w") or item.get("url_m") or ""
                if title:
                    results.append({
                        "title": title,
                        "content": content or digest,
                        "source": "东方财富",
                        "timestamp": showtime,
                        "url": url,
                    })
        except Exception as e:
            print(f"[东方财富] col={col_type} 获取失败: {e}")
    print(f"[东方财富] 获取 {len(results)} 条")
    return results


# ===== 数据源：新浪财经 7x24 =====

def fetch_sina() -> list[dict]:
    """新浪财经 7x24 快讯 API。"""
    print("[新浪财经] 正在获取...")
    try:
        resp = requests.get(
            "https://zhibo.sina.com.cn/api/zhibo/feed",
            params={
                "page": 1,
                "page_size": 40,
                "zhibo_id": 152,
                "tag_id": 0,
                "dire": "next",
                "type": "0",
                "dpc": 1,
            },
            headers={**HTTP_HEADERS, "Referer": "https://finance.sina.com.cn/"},
            timeout=HTTP_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        feed_list = data.get("result", {}).get("data", {}).get("feed", {}).get("list", [])
        results = []
        for item in feed_list:
            rich_text = (item.get("rich_text") or "").strip()
            if not rich_text:
                continue
            # 去除 HTML 标签
            clean = re.sub(r"<[^>]+>", "", rich_text).strip()
            # 提取【】中的标题
            title_match = re.match(r"【([^】]+)】(.*)", clean)
            if title_match:
                title = title_match.group(1).strip()
                content = title_match.group(2).strip()
            else:
                title = clean[:60]
                content = clean
            create_time = item.get("create_time") or ""
            item_id = item.get("id") or ""
            url = f"https://finance.sina.com.cn/7x24/{create_time[:10].replace('-', '')}/{item_id}.shtml" if create_time and item_id else ""
            results.append({
                "title": title,
                "content": content,
                "source": "新浪财经",
                "timestamp": create_time,
                "url": url,
            })
        print(f"[新浪财经] 获取 {len(results)} 条")
        return results
    except Exception as e:
        print(f"[新浪财经] 获取失败: {e}")
        return []


# ===== 数据源：财联社（搜索补充） =====

async def fetch_cls_search(sdk: CodeActSDK, cutoff: datetime) -> list[dict]:
    """财联社搜索补充：用 codeact_search_web 搜索最新财经快讯。

    搜索结果作为补充线索，标题和摘要直接参与关键词匹配。
    """
    print("[财联社搜索] 正在搜索...")
    start_str = cutoff.strftime("%Y-%m-%dT00:00:00+08:00")
    end_str = now_cn().strftime("%Y-%m-%dT23:59:59+08:00")
    results = []
    sem = asyncio.Semaphore(3)

    async def search_one(query: str) -> list[dict]:
        async with sem:
            try:
                search = await sdk.call_tool(
                    "codeact_search_web",
                    {
                        "query": query,
                        "publish_time": {"start": start_str, "end": end_str},
                        "response_length": "medium",
                    },
                    schema_version=TOOL_SCHEMA_VERSIONS["codeact_search_web"],
                )
                if not search or search.get("is_success") is False:
                    return []
                items = search.get("results") or []
                out = []
                for item in items:
                    title = (item.get("title") or "").strip()
                    snippet = (item.get("snippet") or "").strip()
                    if not title:
                        continue
                    # 只保留来自财联社的结果
                    url = item.get("url") or ""
                    if "cls.cn" in url or "财联社" in (item.get("title") or "") or "财联社" in snippet:
                        source_name = "财联社(搜索)"
                    else:
                        source_name = "搜索补充"
                    out.append({
                        "title": title,
                        "content": snippet,
                        "source": source_name,
                        "timestamp": item.get("publish_time") or "",
                        "url": url,
                    })
                return out
            except Exception as e:
                print(f"[财联社搜索] query='{query}' 失败: {e}")
                return []

    groups = await asyncio.gather(*(search_one(q) for q in CLS_SEARCH_QUERIES))
    seen_urls = set()
    for group in groups:
        for item in group:
            url = item.get("url", "")
            if url and url in seen_urls:
                continue
            seen_urls.add(url)
            results.append(item)
    print(f"[财联社搜索] 获取 {len(results)} 条")
    return results


# ===== 关键词匹配 =====

def match_keywords(title: str, content: str) -> list[str]:
    """检查标题+内容是否命中关注关键词，返回命中的关键词列表。"""
    text = f"{title} {content}"
    matched = []
    for kw in ALL_KEYWORDS:
        if kw in text:
            matched.append(kw)
    return matched


def categorize_match(matched: list[str]) -> str:
    """将命中的关键词分类。"""
    stock_kws = {kw for name, code in WATCH_STOCKS for kw in (name, code)}
    industry_kws = set(INDUSTRY_KEYWORDS)
    macro_kws = set(MACRO_KEYWORDS)

    if any(kw in stock_kws for kw in matched):
        return "标的"
    if any(kw in industry_kws for kw in matched):
        return "行业"
    if any(kw in macro_kws for kw in matched):
        return "宏观"
    return "其他"


# ===== 消息格式化 =====

def format_push_message(
    new_items: list[dict],
    scan_time: str,
    baseline: bool,
) -> str:
    """格式化推送消息：先结论后细节，按分类分组。"""
    if not new_items:
        return ""

    if baseline:
        header = f"[主人](at://owner) 📊 财经快讯监控初始化完成"
        body = (
            f"\n本次为首次运行（冷启动基线），已记录 {len(new_items)} 条历史快讯。\n"
            f"后续运行将只推送新增内容。\n\n"
            f"监控标的：半导体设备ETF(159516)、中远海能(600026)、航天动力(600343)、"
            f"九安医疗(002432)、永鼎股份(600105)、海思科(002653)、"
            f"机器人ETF华夏(562500)、机器人ETF景顺(159559)\n"
            f"监控关键词：油运/VLCC、半导体设备、商业航天、医疗器械、光通信/超导、创新药、人形机器人、宏观政策"
        )
        return header + body

    header = f"[主人](at://owner) 📡 财经快讯监控 | {scan_time}"
    lines = [header, f"发现 {len(new_items)} 条新关注快讯："]

    # 按分类分组
    categories = {"标的": [], "行业": [], "宏观": []}
    for item in new_items:
        cat = item.get("category", "其他")
        categories.setdefault(cat, []).append(item)

    for cat_name in ["标的", "行业", "宏观"]:
        cat_items = categories.get(cat_name, [])
        if not cat_items:
            continue
        lines.append(f"\n【{cat_name}相关】")
        for item in cat_items[:8]:
            time_str = item.get("time_str", "")
            source = item.get("source", "")
            title = item["title"]
            content = item.get("content", "")
            kws = "、".join(item.get("matched_keywords", [])[:5])
            # 截断过长内容
            display = f"{title}"
            if content and content != title:
                display += f" — {content[:120]}"
            if time_str:
                display = f"[{time_str}] {display}"
            lines.append(f"  • {display}")
            lines.append(f"    来源: {source} | 关键词: {kws}")
            if item.get("url"):
                lines.append(f"    链接: {item['url']}")

    lines.append(f"\n共扫描 {new_items[0].get('total_scanned', '?')} 条快讯，命中 {len(new_items)} 条新增。")
    return "\n".join(lines)


def format_time_str(dt: Optional[datetime]) -> str:
    if dt is None:
        return ""
    return dt.strftime("%H:%M")


# ===== 主流程 =====

async def main() -> None:
    result_mode_raw = sys.argv[1] if len(sys.argv) > 1 else "auto"
    lookback_minutes = int(sys.argv[2]) if len(sys.argv) > 2 else 120
    workday_only = int(sys.argv[3]) if len(sys.argv) > 3 else 1

    sdk = CodeActSDK()
    conn = init_state_db()

    try:
        mode = (result_mode_raw or "auto").strip().lower()
        if mode not in {"auto", "display_only", "notify", "no_reply"}:
            raise ValueError("result_mode 只能是 auto / display_only / notify / no_reply")

        now = now_cn()
        scan_time = now.strftime("%Y-%m-%d %H:%M")
        print(f"[参数] result_mode={mode}, lookback={lookback_minutes}min, workday_only={workday_only}")
        print(f"[时间] {scan_time} (星期{now.weekday()+1})")

        # 工作日检查
        if workday_only and now.weekday() >= 5:
            print("[跳过] 非工作日，静默结束")
            await sdk.submit_result(
                result_mode="no_reply",
                status="success",
                message="NO_REPLY",
            )
            return

        # 冷启动判断
        baseline_mode = not is_baseline_completed(conn)
        print(f"[状态] baseline_mode={baseline_mode}")

        # 回看时间窗口
        cutoff = now - timedelta(minutes=lookback_minutes)
        print(f"[窗口] 回看 {lookback_minutes} 分钟，截止前数据将被过滤")

        # ===== 并发获取所有数据源 =====
        print("\n===== 开始获取数据 =====")

        # HTTP API 源用线程池并发
        loop = asyncio.get_event_loop()
        http_tasks = [
            loop.run_in_executor(None, fetch_wallstreetcn),
            loop.run_in_executor(None, fetch_eastmoney),
            loop.run_in_executor(None, fetch_sina),
        ]
        # SDK 搜索源用 asyncio 并发
        sdk_task = fetch_cls_search(sdk, cutoff)

        http_results, cls_results = await asyncio.gather(
            asyncio.gather(*http_tasks),
            sdk_task,
            return_exceptions=True,
        )

        # 合并所有结果
        all_items = []
        if isinstance(http_results, list):
            for result in http_results:
                if isinstance(result, list):
                    all_items.extend(result)
                elif isinstance(result, Exception):
                    print(f"[HTTP源] 异常: {result}")
        if isinstance(cls_results, list):
            all_items.extend(cls_results)
        elif isinstance(cls_results, Exception):
            print(f"[搜索源] 异常: {cls_results}")

        total_scanned = len(all_items)
        print(f"\n===== 共获取 {total_scanned} 条快讯 =====")

        if not all_items:
            print("[结果] 所有数据源均无数据")
            if mode == "auto":
                actual_mode = "no_reply"
            else:
                actual_mode = mode
            await sdk.submit_result(
                result_mode=actual_mode,
                status="success",
                message="NO_REPLY" if actual_mode == "no_reply" else "本次扫描未获取到任何快讯数据",
                data={"total_scanned": 0, "baseline_mode": baseline_mode},
            )
            return

        # ===== 时间过滤 =====
        filtered = []
        for item in all_items:
            dt = parse_timestamp(item.get("timestamp"))
            if is_within_window(dt, cutoff):
                item["dt"] = dt
                item["time_str"] = format_time_str(dt)
                filtered.append(item)

        print(f"[过滤] 时间窗口内 {len(filtered)} 条")

        # ===== 关键词匹配 =====
        matched = []
        for item in filtered:
            kws = match_keywords(item["title"], item.get("content", ""))
            if kws:
                item["matched_keywords"] = kws
                item["category"] = categorize_match(kws)
                item["hash"] = news_hash(item["title"], item.get("content", ""))
                matched.append(item)

        print(f"[匹配] 命中关键词 {len(matched)} 条")

        # ===== 去重 =====
        seen_hashes = get_seen_hashes(conn)
        new_items = [item for item in matched if item["hash"] not in seen_hashes]
        print(f"[去重] 新增 {len(new_items)} 条（已见 {len(matched) - len(new_items)} 条）")

        # ===== 冷启动处理 =====
        if baseline_mode:
            # 冷启动：记录所有命中条目，不推送明细
            all_to_save = matched  # 包括已见的
            save_seen_news(conn, all_to_save)
            set_meta(conn, "baseline_completed", "1")
            set_meta(conn, "baseline_completed_at", now.isoformat(timespec="seconds"))

            baseline_msg = format_push_message(all_to_save, scan_time, baseline=True)
            if mode == "auto":
                actual_mode = "display_only"
            else:
                actual_mode = mode

            await sdk.submit_result(
                result_mode=actual_mode,
                status="success",
                message=baseline_msg,
                data={
                    "total_scanned": total_scanned,
                    "matched": len(matched),
                    "new_items": len(new_items),
                    "baseline_mode": True,
                    "state_db": STATE_DB,
                },
            )
            return

        # ===== 正常增量推送 =====
        for item in new_items:
            item["total_scanned"] = total_scanned

        if new_items:
            message = format_push_message(new_items, scan_time, baseline=False)
            # 写入状态库
            save_seen_news(conn, new_items)

            if mode == "auto":
                actual_mode = "display_only"
            else:
                actual_mode = mode

            await sdk.submit_result(
                result_mode=actual_mode,
                status="success",
                message=message,
                data={
                    "total_scanned": total_scanned,
                    "matched": len(matched),
                    "new_items": len(new_items),
                    "baseline_mode": False,
                    "state_db": STATE_DB,
                    "sources": {
                        "华尔街见闻": sum(1 for i in new_items if i["source"] == "华尔街见闻"),
                        "东方财富": sum(1 for i in new_items if i["source"] == "东方财富"),
                        "新浪财经": sum(1 for i in new_items if i["source"] == "新浪财经"),
                        "财联社(搜索)": sum(1 for i in new_items if "财联社" in i["source"]),
                        "搜索补充": sum(1 for i in new_items if i["source"] == "搜索补充"),
                    },
                },
            )
        else:
            # 无新增
            if mode == "auto":
                actual_mode = "no_reply"
            else:
                actual_mode = mode

            await sdk.submit_result(
                result_mode=actual_mode,
                status="success",
                message="NO_REPLY" if actual_mode == "no_reply" else f"本次扫描 {total_scanned} 条快讯，命中 {len(matched)} 条，无新增内容。",
                data={
                    "total_scanned": total_scanned,
                    "matched": len(matched),
                    "new_items": 0,
                    "baseline_mode": False,
                    "state_db": STATE_DB,
                },
            )

    except Exception as e:
        print(f"[错误] {e}\n{traceback.format_exc()}")
        await sdk.submit_result(
            result_mode="notify",
            status="error",
            message=f"财经快讯监控执行失败：{e}",
            data={"error_type": type(e).__name__, "state_db": STATE_DB},
        )
    finally:
        conn.close()


if __name__ == "__main__":
    asyncio.run(main())
