#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""山西及周边省份马拉松赛事搜索脚本。

覆盖省份：山西、陕西、河南、河北、内蒙古
数据来源：已知赛事日历页面（主源）+ codeact_search_web 搜索（补充源）
状态管理：SQLite 增量去重，首次运行建基线，后续只推送新赛事
result_mode：auto → 有新赛事 display_only（@主人），无新赛事 no_reply

参数（sys.argv）：
  1. result_mode: auto / display_only / notify / no_reply（默认 auto）
  2. search_depth: quick / full（默认 quick，控制搜索关键词数量）
"""

import asyncio
import json
import os
import re
import sqlite3
import sys
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

from pydantic import BaseModel, Field
from codeact_sdk import CodeActSDK

# ===== SDK 工具 Schema 版本 =====
TOOL_SCHEMA_VERSIONS = {
    "codeact_search_web": "v1_5ac1b0eba8c26f2a",
    "codeact_fetch_web": "v1_2c8d0580b3f93a58",
}

# ===== 常量 =====
TARGET_PROVINCES: Set[str] = {"山西", "陕西", "河南", "河北", "内蒙古"}
DB_PATH = "./codeact/output/marathon_events.db"
REPORT_DIR = "./codeact/output"

# 省份前缀（用于事件名称归一化时去除）
PROVINCE_PREFIXES: List[str] = [
    "山西省", "陕西省", "河南省", "河北省", "内蒙古自治区",
    "山西", "陕西", "河南", "河北", "内蒙古",
]

# 已知赛事日历页面（主数据源）
KNOWN_SOURCES: List[str] = [
    "https://m.sohu.com/a/976941629_617478/",       # 2026全年马拉松日历(1月更新)
    "https://m.sohu.com/a/1041110658_121124690/",     # 2026下半年马拉松日历(6月更新)
    "https://www.163.com/dy/article/KR2QDF3Q0513EF9U.html",  # 2026年5-12月日历(4月更新)
]

# 快速搜索关键词（8个）
QUICK_QUERIES: List[str] = [
    "2026年马拉松赛事日历 中国田协 目录 山西 陕西 河南 河北 内蒙古",
    "山西马拉松2026 太原马拉松 赛事排期 报名",
    "陕西马拉松2026 西安马拉松 延安 榆林 赛事",
    "河南马拉松2026 郑州马拉松 安阳 赛事",
    "河北马拉松2026 石家庄 雄安 保定 赛事",
    "内蒙古马拉松2026 呼和浩特 包头 赛事",
    "2026马拉松赛事报名 最酷 跑团邦 马拉马拉",
    "2026下半年马拉松日历 山西 陕西 河南 河北",
]

# 完整搜索关键词（15个，在 quick 基础上增加7个）
FULL_QUERIES: List[str] = QUICK_QUERIES + [
    "山西半程马拉松2026 临汾 长治 高平 稷山 报名",
    "陕西半程马拉松2026 宝鸡 汉中 报名",
    "河南半程马拉松2026 新县 报名",
    "河北半程马拉松2026 沧州 涉县 定州 衡水 报名",
    "内蒙古半程马拉松2026 阿尔山 呼伦贝尔 鄂尔多斯 报名",
    "chinamarathon.com 2026赛事 山西 陕西 河南 河北 内蒙古",
    "2026马拉松报名信息 zuicool 山西 陕西 河南 河北 内蒙古",
]


# ===== Pydantic 结构化模型 =====

class MarathonEvent(BaseModel):
    """单场马拉松赛事信息"""
    event_name: str = Field(description="赛事名称，如'2026太原马拉松'")
    event_date: str = Field(description="举办日期，如'2026-09-27'或'2026年9月'或'待定'")
    province: str = Field(description="省份，如'山西'、'陕西'、'河南'、'河北'、'内蒙古'")
    city: str = Field(default="", description="地级市，如'太原市'")
    county: str = Field(default="", description="县/区，如'杏花岭区'")
    race_type: str = Field(default="", description="赛事项目，如'全程/半程'或'半程'")
    category: str = Field(default="", description="赛事类别，如'A类'、'B类'、'C类'")
    registration_status: str = Field(default="待定", description="报名状态：报名中/即将报名/已结束/待定")
    source_url: str = Field(default="", description="赛事官网或报名链接")


class MarathonEventList(BaseModel):
    """从网页中提取的马拉松赛事列表"""
    events: List[MarathonEvent] = Field(default_factory=list, description="提取到的赛事列表")


class CandidateSelection(BaseModel):
    """搜索候选 URL 筛选结果"""
    selected_urls: List[str] = Field(default_factory=list)
    reason: str = ""


# ===== 工具函数 =====

def _coerce_model(v: Any, model_cls: type) -> Any:
    """安全提取 LLM 结构化输出，兼容模型实例、dict、JSON 字符串。"""
    if isinstance(v, model_cls):
        return v
    if isinstance(v, str):
        return model_cls(**json.loads(v))
    if isinstance(v, dict):
        return model_cls(**v)
    raise ValueError(f"LLM 返回格式不可用，期望 {model_cls.__name__}")


def _norm_url(url: str) -> str:
    """URL 归一化：去除 query、fragment、末尾斜杠。"""
    return (url or "").split("#", 1)[0].split("?", 1)[0].rstrip("/")


def _collapse_text(text: str) -> str:
    """压缩空白，保留换行结构。"""
    text = re.sub(r"<[^>]+>", " ", text or " ")
    text = text.replace("\\n", "\n").replace("\u00a0", " ")
    return re.sub(r"[ \t]+", " ", text).strip()


def normalize_event_name(name: str) -> str:
    """归一化赛事名称：去掉年份、省份前缀、特殊字符差异。"""
    name = (name or "").strip()
    # 去掉所有 "2026" 和 "年"
    name = name.replace("2026", "").replace("年", "")
    # 去掉省份前缀
    for prov in PROVINCE_PREFIXES:
        if name.startswith(prov):
            name = name[len(prov):]
            break
    # 归一化特殊字符
    name = name.replace("・", "·").replace("•", "·").replace("．", "·")
    name = name.replace("\u201c", "").replace("\u201d", "")
    name = name.replace("\u2018", "").replace("\u2019", "")
    name = name.replace('"', "").replace("'", "")
    name = name.replace("（", "(").replace("）", ")")
    # 去掉所有空白
    name = re.sub(r"\s+", "", name)
    return name


def normalize_date(date_str: str) -> str:
    """将各种日期格式归一化为可排序字符串。"""
    raw = (date_str or "").strip()
    if not raw or raw in ("待定", "TBD"):
        return "待定"

    # 2026-09-27
    m = re.match(r"2026-(\d{1,2})-(\d{1,2})", raw)
    if m:
        return f"2026-{int(m.group(1)):02d}-{int(m.group(2)):02d}"

    # 2026年9月27日
    m = re.match(r"2026年(\d{1,2})月(\d{1,2})日", raw)
    if m:
        return f"2026-{int(m.group(1)):02d}-{int(m.group(2)):02d}"

    # X月X日
    m = re.match(r"(\d{1,2})月(\d{1,2})日", raw)
    if m:
        return f"2026-{int(m.group(1)):02d}-{int(m.group(2)):02d}"

    # X.XX 格式（如 9.27）
    m = re.match(r"(\d{1,2})\.(\d{1,2})$", raw)
    if m:
        return f"2026-{int(m.group(1)):02d}-{int(m.group(2)):02d}"

    # 2026年X月
    m = re.match(r"2026年(\d{1,2})月", raw)
    if m:
        return f"2026-{int(m.group(1)):02d}"

    # X月（无日期）
    m = re.match(r"(\d{1,2})月$", raw)
    if m:
        return f"2026-{int(m.group(1)):02d}"

    # X月—X月 / X月-X月（取起始月）
    m = re.match(r"(\d{1,2})月[—\-~](\d{1,2})?月?", raw)
    if m:
        return f"2026-{int(m.group(1)):02d}"

    return raw


def make_event_key(event: MarathonEvent) -> str:
    """生成去重主键：归一化名称（去除所有标点）+ 省份。

    不含日期，避免日期精度变化导致误判新赛事；
    去除所有非中文/非字母数字字符，避免标点差异（如 · vs 无）导致误判。
    """
    name = normalize_event_name(event.event_name)
    # 去除所有非中文、非字母数字字符，做模糊匹配
    name = re.sub(r"[^\u4e00-\u9fa5a-zA-Z0-9]", "", name)
    province = event.province.strip()
    return f"{name}|{province}"


def _merge_one(a: MarathonEvent, b: MarathonEvent) -> MarathonEvent:
    """合并两个同名同省赛事，优先保留更完整的数据。"""
    def pick(a_val: str, b_val: str, default: str = "") -> str:
        if a_val and a_val != default:
            return a_val
        if b_val and b_val != default:
            return b_val
        return default

    # 日期取更精确的那个
    a_date = normalize_date(a.event_date)
    b_date = normalize_date(b.event_date)
    date = a.event_date if len(a_date) >= len(b_date) else b.event_date

    # 名称取更完整的（含 "2026" 前缀的更正式）
    name = a.event_name if len(a.event_name) >= len(b.event_name) else b.event_name

    return MarathonEvent(
        event_name=name,
        event_date=date,
        province=a.province,
        city=pick(a.city, b.city),
        county=pick(a.county, b.county),
        race_type=pick(a.race_type, b.race_type),
        category=pick(a.category, b.category),
        registration_status=pick(a.registration_status, b.registration_status, "待定"),
        source_url=pick(a.source_url, b.source_url),
    )


def merge_events(events: List[MarathonEvent]) -> List[MarathonEvent]:
    """两轮合并：先按精确 key 去重，再按名称+省份做日期前缀模糊合并。"""
    # 第一轮：精确 key 去重
    by_key: Dict[str, MarathonEvent] = {}
    for e in events:
        if e.province.strip() not in TARGET_PROVINCES:
            continue
        key = make_event_key(e)
        if key not in by_key:
            by_key[key] = e
        else:
            by_key[key] = _merge_one(by_key[key], e)

    # 第二轮：名称+省份分组，日期前缀匹配合并
    by_name_prov: Dict[str, List[MarathonEvent]] = {}
    for e in by_key.values():
        name = normalize_event_name(e.event_name)
        np_key = f"{name}|{e.province.strip()}"
        by_name_prov.setdefault(np_key, []).append(e)

    merged: List[MarathonEvent] = []
    for group in by_name_prov.values():
        if len(group) == 1:
            merged.append(group[0])
            continue
        # 按日期精确度降序排列（更精确的在前）
        group.sort(key=lambda e: len(normalize_date(e.event_date)), reverse=True)
        result = [group[0]]
        for e in group[1:]:
            e_date = normalize_date(e.event_date)
            matched = False
            for i, r in enumerate(result):
                r_date = normalize_date(r.event_date)
                # 合并条件：一个日期是另一个的前缀，或其中一方为"待定"
                if r_date == "待定" or e_date == "待定" or \
                   r_date.startswith(e_date) or e_date.startswith(r_date):
                    result[i] = _merge_one(r, e)
                    matched = True
                    break
            if not matched:
                result.append(e)
        merged.extend(result)

    return merged


def event_sort_key(event: MarathonEvent) -> str:
    """排序键：按日期升序，待定排最后。"""
    date = normalize_date(event.event_date)
    if date == "待定":
        return "9999-99"
    return date


def split_text(text: str, limit: int = 12000) -> List[str]:
    """将长文本分块，带重叠覆盖全文。"""
    text = _collapse_text(text)
    if len(text) <= limit:
        return [text] if text else []
    chunks: List[str] = []
    start = 0
    overlap = min(500, limit // 10)
    while start < len(text):
        end = min(len(text), start + limit)
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


# ===== SQLite 状态管理 =====

def init_db() -> sqlite3.Connection:
    """初始化状态库，返回连接。"""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS events (
            event_key     TEXT PRIMARY KEY,
            event_name    TEXT NOT NULL,
            event_date    TEXT NOT NULL,
            province      TEXT NOT NULL,
            city          TEXT DEFAULT '',
            county        TEXT DEFAULT '',
            race_type     TEXT DEFAULT '',
            category      TEXT DEFAULT '',
            registration_status TEXT DEFAULT '',
            source_url    TEXT DEFAULT '',
            first_seen_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS meta (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    conn.commit()
    return conn


def get_meta(conn: sqlite3.Connection, key: str, default: str = "") -> str:
    row = conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
    return row[0] if row else default


def set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", (key, value))
    conn.commit()


def get_existing_keys(conn: sqlite3.Connection) -> Set[str]:
    return {row[0] for row in conn.execute("SELECT event_key FROM events")}


def insert_events(conn: sqlite3.Connection, events: List[MarathonEvent]) -> int:
    """插入或更新赛事（UPSERT），返回新插入的数量（不含更新）。"""
    now = datetime.now().isoformat(timespec="seconds")
    new_count = 0
    for event in events:
        key = make_event_key(event)
        date = normalize_date(event.event_date)
        # 先检查是否已存在
        existed = conn.execute(
            "SELECT 1 FROM events WHERE event_key=?", (key,)
        ).fetchone()
        if existed:
            # 已存在：更新更完整的字段（不覆盖已有的非空值，除非新值更精确）
            conn.execute("""
                UPDATE events SET
                    event_name = CASE WHEN length(?) > length(event_name) THEN ? ELSE event_name END,
                    event_date = CASE WHEN length(?) > length(event_date) THEN ? ELSE event_date END,
                    city = CASE WHEN ? != '' AND city = '' THEN ? ELSE city END,
                    county = CASE WHEN ? != '' AND county = '' THEN ? ELSE county END,
                    race_type = CASE WHEN ? != '' AND race_type = '' THEN ? ELSE race_type END,
                    category = CASE WHEN ? != '' AND category = '' THEN ? ELSE category END,
                    registration_status = CASE WHEN ? != '待定' AND registration_status = '待定' THEN ? ELSE registration_status END,
                    source_url = CASE WHEN ? != '' AND source_url = '' THEN ? ELSE source_url END
                WHERE event_key = ?
            """, (event.event_name, event.event_name,
                  date, date,
                  event.city, event.city,
                  event.county, event.county,
                  event.race_type, event.race_type,
                  event.category, event.category,
                  event.registration_status, event.registration_status,
                  event.source_url, event.source_url,
                  key))
        else:
            # 新赛事：插入
            conn.execute(
                "INSERT INTO events "
                "(event_key, event_name, event_date, province, city, county, "
                "race_type, category, registration_status, source_url, first_seen_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (key, event.event_name, date,
                 event.province, event.city, event.county,
                 event.race_type, event.category, event.registration_status,
                 event.source_url, now),
            )
            new_count += 1
    conn.commit()
    return new_count


# ===== 搜索 =====

async def run_searches(
    sdk: CodeActSDK, queries: List[str]
) -> List[Dict[str, Any]]:
    """并发执行多个搜索查询，返回去重后的候选列表。"""
    sem = asyncio.Semaphore(5)

    async def search_one(query: str) -> Optional[Dict[str, Any]]:
        async with sem:
            try:
                result = await sdk.call_tool(
                    "codeact_search_web",
                    {"query": query, "response_length": "long"},
                    schema_version=TOOL_SCHEMA_VERSIONS["codeact_search_web"],
                )
                return result
            except Exception as e:
                print(f"  [搜索失败] {query[:30]}...: {e}")
                return None

    results = await asyncio.gather(
        *(search_one(q) for q in queries), return_exceptions=True
    )

    all_candidates: List[Dict[str, Any]] = []
    seen_urls: Set[str] = set()

    for r in results:
        if isinstance(r, Exception) or r is None:
            continue
        if r.get("is_success") is False:
            continue
        for item in r.get("results") or []:
            url = _norm_url(str(item.get("url") or ""))
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            snippet = re.sub(r"\s+", " ", str(item.get("snippet") or "")).strip()[:300]
            all_candidates.append({
                "title": item.get("title") or "",
                "url": url,
                "publish_time": item.get("publish_time") or "",
                "snippet": snippet,
            })

    return all_candidates


# ===== 候选筛选 =====

async def select_candidates(
    sdk: CodeActSDK, candidates: List[Dict[str, Any]], max_select: int = 8
) -> List[Dict[str, Any]]:
    """LLM 批量筛选搜索候选 URL。"""
    if not candidates:
        return []

    batches = [candidates[i:i + 10] for i in range(0, min(len(candidates), 30), 10)]
    sem = asyncio.Semaphore(3)

    async def select_batch(batch: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        lines = []
        for item in batch:
            lines.append(
                f"标题：{item.get('title', '')}\n"
                f"URL：{item.get('url', '')}\n"
                f"发布时间：{item.get('publish_time', '') or '未提供'}\n"
                f"摘要：{item.get('snippet', '')}"
            )
        prompt = (
            "从以下搜索结果中选择需要 fetch 正文核验的完整 URL，"
            "用于提取2026年山西、陕西、河南、河北、内蒙古五省的马拉松赛事信息。"
            "只返回 URL，不返回序号；"
            "优先赛事日历、赛事目录、报名信息页面，排除与马拉松无关的页面。\n\n"
            + "\n\n".join(lines)
        )
        async with sem:
            try:
                result = await sdk.call_llm(
                    messages=[{"role": "user", "content": prompt}],
                    response_format=CandidateSelection,
                )
                selection = _coerce_model(result, CandidateSelection)
                selected_urls = {_norm_url(url) for url in selection.selected_urls}
                return [
                    item for item in batch
                    if _norm_url(item.get("url", "")) in selected_urls
                ]
            except Exception as e:
                print(f"  [候选筛选失败]: {e}")
                return batch[:3]

    batch_results = await asyncio.gather(
        *(select_batch(b) for b in batches), return_exceptions=True
    )
    selected: List[Dict[str, Any]] = []
    for r in batch_results:
        if not isinstance(r, Exception):
            selected.extend(r)

    return selected[:max_select]


# ===== 网页抓取 =====

async def fetch_page(
    sdk: CodeActSDK, url: str, sem: asyncio.Semaphore
) -> Dict[str, Any]:
    """抓取单个网页，返回 {url, title, content, ok}。"""
    async with sem:
        try:
            page = await sdk.call_tool(
                "codeact_fetch_web",
                {"url": url},
                schema_version=TOOL_SCHEMA_VERSIONS["codeact_fetch_web"],
            )
            if page.get("is_success") is False:
                return {"url": url, "ok": False, "error": page.get("error", "")}
            content = str(page.get("content") or "").strip()
            if not content:
                return {"url": url, "ok": False, "error": "页面正文为空"}
            return {
                "url": url,
                "ok": True,
                "title": str(page.get("title") or ""),
                "content": content,
            }
        except Exception as e:
            return {"url": url, "ok": False, "error": str(e)}


# ===== LLM 事件抽取 =====

async def extract_events_from_page(
    sdk: CodeActSDK, url: str, title: str, content: str, llm_sem: asyncio.Semaphore
) -> List[MarathonEvent]:
    """从单个页面正文中提取马拉松赛事信息。"""
    chunks = split_text(content, 12000)
    if not chunks:
        return []

    async def extract_chunk(idx: int, chunk: str) -> MarathonEventList:
        async with llm_sem:
            prompt = (
                f"从以下网页正文分块中提取2026年山西省、陕西省、河南省、河北省、"
                f"内蒙古自治区的马拉松赛事信息。\n"
                f"只提取上述5个省份的赛事，忽略其他省份。\n"
                f"页面标题：{title}\n"
                f"来源URL：{url}\n"
                f"分块：{idx + 1}/{len(chunks)}\n\n"
                f"正文：\n{chunk}\n\n"
                "提取要求：\n"
                "1. 只提取当前分块中明确出现的赛事信息，不要编造\n"
                "2. event_date 尽量精确到日，如'2026-09-27'；只有月份时写'2026年X月'\n"
                "3. province 只能是：山西、陕西、河南、河北、内蒙古\n"
                "4. race_type 填写全程/半程/全程+半程/迷你等\n"
                "5. category 填写A类/B类/C类，没有则留空\n"
                "6. registration_status 如有报名信息则填写，否则填'待定'\n"
                "7. source_url 如页面中有赛事官网或报名链接则填写\n"
                "8. 如果当前分块没有目标省份的赛事，返回空列表\n"
            )
            result = await sdk.call_llm(
                messages=[{"role": "user", "content": prompt}],
                response_format=MarathonEventList,
            )
            return _coerce_model(result, MarathonEventList)

    partial = await asyncio.gather(
        *(extract_chunk(i, c) for i, c in enumerate(chunks)),
        return_exceptions=True,
    )

    events: List[MarathonEvent] = []
    seen_keys: Set[str] = set()
    for p in partial:
        if isinstance(p, Exception):
            continue
        for e in p.events:
            if e.province.strip() in TARGET_PROVINCES:
                key = make_event_key(e)
                if key not in seen_keys:
                    seen_keys.add(key)
                    events.append(e)

    return events


# ===== 报告生成 =====

def write_full_report(events: List[MarathonEvent]) -> str:
    """将完整赛事列表写入 Markdown 报告文件。"""
    report_path = os.path.join(REPORT_DIR, "marathon_events_report.md")
    os.makedirs(REPORT_DIR, exist_ok=True)

    lines: List[str] = [
        "# 🏃 2026年山西及周边省份马拉松赛事排期",
        "",
        f"> 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "> 覆盖省份：山西、陕西、河南、河北、内蒙古",
        f"> 赛事总数：{len(events)} 场",
        "",
    ]

    # 按省份分组
    by_province: Dict[str, List[MarathonEvent]] = {}
    for e in events:
        by_province.setdefault(e.province, []).append(e)

    for province in ["山西", "陕西", "河南", "河北", "内蒙古"]:
        if province not in by_province:
            continue
        prov_events = sorted(by_province[province], key=event_sort_key)
        lines.append(f"## {province}（{len(prov_events)} 场）")
        lines.append("")
        lines.append("| 日期 | 赛事名称 | 地点 | 项目 | 类别 | 报名状态 | 链接 |")
        lines.append("|------|---------|------|------|------|---------|------|")
        for e in prov_events:
            date = normalize_date(e.event_date)
            location_parts = [x for x in [e.city, e.county] if x]
            location = "·".join(location_parts) if location_parts else province
            link = e.source_url if e.source_url else "-"
            lines.append(
                f"| {date} | {e.event_name} | {location} | {e.race_type} | "
                f"{e.category} | {e.registration_status} | {link} |"
            )
        lines.append("")

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return report_path


def build_init_message(events: List[MarathonEvent], report_path: str) -> str:
    """首次运行基线初始化消息。"""
    province_counts: Dict[str, int] = {}
    for e in events:
        province_counts[e.province] = province_counts.get(e.province, 0) + 1

    lines: List[str] = [
        "🏃 山西及周边马拉松赛事基线初始化完成",
        "",
        f"共发现 {len(events)} 场赛事，覆盖 {len(province_counts)} 个省份：",
    ]
    for p in ["山西", "陕西", "河南", "河北", "内蒙古"]:
        if p in province_counts:
            lines.append(f"  - {p}：{province_counts[p]} 场")

    # 标注9月赛事（用户目标月）
    sep_events = [
        e for e in events
        if normalize_date(e.event_date).startswith("2026-09")
    ]
    if sep_events:
        lines.append("")
        lines.append("📅 9月赛事（太原马拉松前后，适合热身/训练赛）：")
        for e in sep_events:
            date = normalize_date(e.event_date)
            location = "·".join(x for x in [e.province, e.city] if x)
            lines.append(f"  - {date} | {e.event_name}（{location}，{e.race_type}）")

    abs_path = os.path.abspath(report_path)
    lines.append("")
    lines.append(f"完整赛事列表：[马拉松赛事报告](computer://{abs_path})")

    return "\n".join(lines)


def build_new_events_message(new_events: List[MarathonEvent]) -> str:
    """新赛事增量推送消息。"""
    new_events = sorted(new_events, key=event_sort_key)
    today = datetime.now().strftime("%Y-%m-%d")

    lines: List[str] = [
        f"[主人](at://owner) 🏃 山西及周边马拉松赛事更新（{today}）",
        "",
        f"本次新发现 {len(new_events)} 场赛事：",
        "",
    ]

    for e in new_events:
        date = normalize_date(e.event_date)
        location_parts = [x for x in [e.province, e.city, e.county] if x]
        location = "·".join(location_parts) if location_parts else e.province
        race_info = e.race_type or "-"
        if e.category:
            race_info += f" | {e.category}"

        lines.append(f"📅 {date} | {e.event_name}")
        lines.append(f"   📍 {location}")
        lines.append(f"   🏁 {race_info} | 报名：{e.registration_status}")
        if e.source_url:
            lines.append(f"   🔗 {e.source_url}")
        lines.append("")

    return "\n".join(lines)


# ===== 主流程 =====

async def main() -> None:
    result_mode_raw = sys.argv[1] if len(sys.argv) > 1 else "auto"
    search_depth = sys.argv[2] if len(sys.argv) > 2 else "quick"

    print(f"[参数] result_mode={result_mode_raw}, search_depth={search_depth}")

    sdk = CodeActSDK()
    conn: Optional[sqlite3.Connection] = None

    try:
        # 参数校验
        mode = (result_mode_raw or "auto").strip().lower()
        if mode not in {"auto", "display_only", "notify", "no_reply"}:
            mode = "auto"
        depth = (search_depth or "quick").strip().lower()
        if depth not in {"quick", "full"}:
            depth = "quick"

        # 初始化状态库
        conn = init_db()
        baseline_done = get_meta(conn, "baseline_completed", "0") == "1"

        # 确定搜索关键词
        queries = FULL_QUERIES if depth == "full" else QUICK_QUERIES
        print(f"[搜索] 使用 {len(queries)} 个查询关键词（{depth} 模式）")

        # 并发信号量
        fetch_sem = asyncio.Semaphore(5)
        llm_sem = asyncio.Semaphore(3)

        # ===== Step 1: 抓取已知主源 + 并发搜索 =====
        print("[步骤1] 抓取已知赛事日历页面 + 搜索候选...")

        known_fetch_tasks = [
            fetch_page(sdk, url, fetch_sem) for url in KNOWN_SOURCES
        ]
        search_task = run_searches(sdk, queries)

        known_pages = await asyncio.gather(*known_fetch_tasks, return_exceptions=True)
        search_candidates = await search_task

        # 处理已知源抓取结果
        pages_to_extract: List[Tuple[str, str, str]] = []  # (url, title, content)
        for i, r in enumerate(known_pages):
            if isinstance(r, Exception):
                print(f"  [已知源失败] {KNOWN_SOURCES[i]}: {r}")
                continue
            if r.get("ok"):
                pages_to_extract.append((r["url"], r["title"], r["content"]))
                print(f"  [已知源成功] {r['url']} (正文 {len(r['content'])} 字符)")
            else:
                print(f"  [已知源失败] {r['url']}: {r.get('error', '')}")

        print(f"[搜索] 获得 {len(search_candidates)} 条候选 URL")

        # ===== Step 2: LLM 筛选搜索候选并抓取 =====
        if search_candidates:
            selected = await select_candidates(sdk, search_candidates, max_select=8)
            print(f"[候选筛选] 选中 {len(selected)} 个 URL")

            # 去掉已知源中已有的 URL
            known_urls = {_norm_url(u) for u in KNOWN_SOURCES}
            selected = [
                item for item in selected
                if _norm_url(item.get("url", "")) not in known_urls
            ]
            print(f"[候选筛选] 去重后 {len(selected)} 个待抓取")

            if selected:
                fetch_tasks = [
                    fetch_page(sdk, item["url"], fetch_sem) for item in selected
                ]
                fetched = await asyncio.gather(*fetch_tasks, return_exceptions=True)
                for r in fetched:
                    if isinstance(r, Exception):
                        continue
                    if r.get("ok"):
                        pages_to_extract.append((r["url"], r["title"], r["content"]))
                        print(f"  [搜索源成功] {r['url']} (正文 {len(r['content'])} 字符)")
                    else:
                        print(f"  [搜索源失败] {r['url']}: {r.get('error', '')}")

        print(f"[抓取汇总] 共 {len(pages_to_extract)} 个页面待抽取")

        # ===== Step 3: 并发 LLM 抽取赛事信息 =====
        print("[步骤2] LLM 抽取赛事信息...")

        extract_tasks = [
            extract_events_from_page(sdk, url, title, content, llm_sem)
            for url, title, content in pages_to_extract
        ]
        extract_results = await asyncio.gather(*extract_tasks, return_exceptions=True)

        all_events: List[MarathonEvent] = []
        for r in extract_results:
            if isinstance(r, Exception):
                print(f"  [抽取异常] {r}")
                continue
            all_events.extend(r)

        print(f"[抽取汇总] 共抽取到 {len(all_events)} 场赛事（含重复）")

        # ===== Step 4: 去重 + 过滤 + 合并 =====
        unique_events = merge_events(all_events)
        unique_events.sort(key=event_sort_key)
        print(f"[去重] 合并后 {len(unique_events)} 场赛事")

        # ===== Step 5: 增量对比 =====
        existing_keys = get_existing_keys(conn)
        new_events: List[MarathonEvent] = []
        for e in unique_events:
            key = make_event_key(e)
            if key not in existing_keys:
                new_events.append(e)

        print(f"[增量] 新发现 {len(new_events)} 场（已有 {len(existing_keys)} 场）")

        # 入库：新赛事插入 + 已有赛事更新字段
        inserted = insert_events(conn, unique_events)
        print(f"[入库] 新增 {inserted} 条，更新 {len(unique_events) - inserted} 条")

        # ===== Step 6: 输出与提交 =====
        if not baseline_done:
            # ----- 首次运行：基线初始化 -----
            set_meta(conn, "baseline_completed", "1")
            set_meta(conn, "baseline_completed_at",
                     datetime.now().isoformat(timespec="seconds"))

            report_path = write_full_report(unique_events)
            message = build_init_message(unique_events, report_path)

            actual_mode = "display_only" if mode == "auto" else mode

            await sdk.submit_result(
                result_mode=actual_mode,
                status="success",
                message=message,
                data={
                    "total_events": len(unique_events),
                    "new_events": len(unique_events),
                    "baseline_initialized": True,
                    "report_path": report_path,
                    "search_depth": depth,
                },
            )
            print(f"[完成] 基线初始化，共 {len(unique_events)} 场赛事")
        else:
            # ----- 后续运行：增量推送 -----
            if new_events:
                message = build_new_events_message(new_events)
                actual_mode = "display_only" if mode == "auto" else mode

                await sdk.submit_result(
                    result_mode=actual_mode,
                    status="success",
                    message=message,
                    data={
                        "total_events": len(unique_events),
                        "new_events": len(new_events),
                        "baseline_initialized": True,
                        "search_depth": depth,
                    },
                )
                print(f"[完成] 增量推送 {len(new_events)} 场新赛事")
            else:
                # 无新赛事
                actual_mode = "no_reply" if mode == "auto" else mode
                message = "NO_REPLY" if actual_mode == "no_reply" else (
                    f"本次未发现新赛事。当前库中共有 {len(unique_events)} 场赛事。"
                )

                await sdk.submit_result(
                    result_mode=actual_mode,
                    status="success",
                    message=message,
                    data={
                        "total_events": len(unique_events),
                        "new_events": 0,
                        "baseline_initialized": True,
                        "search_depth": depth,
                    },
                )
                print(f"[完成] 无新赛事，result_mode={actual_mode}")

    except Exception as e:
        print(f"[错误] {e}\n{traceback.format_exc()}")
        await sdk.submit_result(
            result_mode="notify",
            status="error",
            message=f"马拉松赛事搜索失败：{e}",
            data={"error_type": type(e).__name__},
        )
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    asyncio.run(main())
