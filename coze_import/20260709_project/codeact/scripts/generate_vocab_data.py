#!/usr/bin/env python3
"""
高考英语词汇数据生成脚本（提高难度版）

从 ECDICT 开源词典数据库（skywind3000/ECDICT）中提取词汇，
按 CEFR 级别（使用 collins 字段作为 CEFR 代理）分组后分配到 56 天（Day2-Day57）。

难度分布:
  - B1 快速过 (Day2-4, 3天×50=150词): collins=4 中较难的词
  - B2 主力   (Day5-26, 22天×50=1100词): collins=3 全部 + collins=4 较易部分
  - C1 进阶   (Day27-41, 15天×50=750词): collins=1 全部 + empty collins 全部 + collins=2 较易部分
  - 四级高频  (Day42-57, 16天×50=800词): tag=cet4 词汇中高考真题高频超纲词

数据来源：https://github.com/skywind3000/ECDICT (MIT License)
"""

import asyncio
import csv
import json
import os
import re
import subprocess
import sys

from codeact_sdk import CodeActSDK

# ── 常量 ──────────────────────────────────────────────

ECDICT_CSV_URL = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
CSV_CACHE_PATH = "/tmp/ecdict.csv"
OUTPUT_PATH = "./codeact/scripts/vocab_data.json"

# 新难度分配方案: (起始天, 结束天, 每天词数, 等级, 目标词数)
DISTRIBUTION_PLAN = [
    (2, 4, 50, "B1", 150),          # 3天 × 50 = 150词（B1较难词汇，快速复习）
    (5, 26, 50, "B2", 1100),        # 22天 × 50 = 1100词（B2全部词汇）
    (27, 41, 50, "C1", 750),        # 15天 × 50 = 750词（C1全部词汇）
    (42, 57, 50, "四级高频", 800),   # 16天 × 50 = 800词（四级高频/高考超纲）
]

TOTAL_WORDS = sum(plan[4] for plan in DISTRIBUTION_PLAN)  # 2800

# SDK 工具 schema 版本
TOOL_SCHEMA_VERSIONS = {
    "codeact_fetch_web": "v1_2c8d0580b3f93a58",
    "codeact_search_web": "v1_5ac1b0eba8c26f2a",
}

# ── CSV 下载 ──────────────────────────────────────────

def download_csv() -> str | None:
    """下载 ECDICT CSV（带缓存）"""
    if os.path.exists(CSV_CACHE_PATH) and os.path.getsize(CSV_CACHE_PATH) > 10_000_000:
        print(f"[CSV] 使用缓存: {CSV_CACHE_PATH} ({os.path.getsize(CSV_CACHE_PATH) / 1024 / 1024:.1f} MB)")
        return CSV_CACHE_PATH

    print(f"[CSV] 下载 ECDICT CSV: {ECDICT_CSV_URL}")
    try:
        result = subprocess.run(
            ["curl", "-sL", "-o", CSV_CACHE_PATH, ECDICT_CSV_URL],
            timeout=300,
            capture_output=True,
            text=True,
        )
        if result.returncode == 0 and os.path.exists(CSV_CACHE_PATH):
            size_mb = os.path.getsize(CSV_CACHE_PATH) / 1024 / 1024
            print(f"[CSV] 下载完成: {size_mb:.1f} MB")
            return CSV_CACHE_PATH
        else:
            print(f"[CSV] 下载失败, returncode={result.returncode}, stderr={result.stderr[:200]}")
    except Exception as e:
        print(f"[CSV] 下载异常: {e}")
    return None


# ── POS 与释义提取 ────────────────────────────────────

# 词性前缀正则（覆盖 ECDICT translation 字段中常见格式）
POS_PATTERN = re.compile(
    r'^\s*(?:'
    r'(vt|vi|v|aux|modal)\.'   # 动词
    r'|(n)\.'                   # 名词
    r'|(a|adj)\.'               # 形容词
    r'|(adv|adv)\.'             # 副词
    r'|(art)\.'                 # 冠词
    r'|(prep)\.'                # 介词
    r'|(conj)\.'                # 连词
    r'|(pron)\.'                # 代词
    r'|(num)\.'                 # 数词
    r'|(int|interj)\.'          # 感叹词
    r')\s*(.*)',
    re.IGNORECASE,
)

# 归一化映射
POS_NORMALIZE = {
    'vt': 'v.', 'vi': 'v.', 'v': 'v.', 'aux': 'aux.', 'modal': 'aux.',
    'n': 'n.',
    'a': 'adj.', 'adj': 'adj.',
    'adv': 'adv.',
    'art': 'art.',
    'prep': 'prep.',
    'conj': 'conj.',
    'pron': 'pron.',
    'num': 'num.',
    'int': 'int.', 'interj': 'int.',
}

# 需要清理的方括号注释
BRACKET_RE = re.compile(r'\[[^\]]*\]')

# 英文单词/短语模式（用于过滤 meaning 中的英文残留）
ENGLISH_WORD_RE = re.compile(r'[a-zA-Z]{2,}')


def extract_pos_and_meaning(translation: str) -> tuple[str, str]:
    """
    从 ECDICT translation 字段提取词性和中文释义。
    """
    if not translation or not translation.strip():
        return "", ""

    text = translation.replace("\\r\\n", "\n").replace("\\n", "\n").replace("\r\n", "\n").replace("\r", "\n")
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    pos = ""
    meaning = ""

    first_line_cleaned = _clean_meaning(lines[0]) if lines else ""
    first_line_has_chinese = _has_chinese(first_line_cleaned)
    first_line_has_pos = bool(POS_PATTERN.match(lines[0])) if lines else False

    if first_line_has_chinese and not first_line_has_pos:
        meaning = first_line_cleaned
        for line in lines[1:]:
            m = POS_PATTERN.match(line)
            if m:
                raw_pos = None
                for g in m.groups():
                    if g:
                        raw_pos = g.lower()
                        break
                if raw_pos:
                    pos = POS_NORMALIZE.get(raw_pos, raw_pos + ".")
                    break

    if not pos and not meaning:
        for line in lines:
            m = POS_PATTERN.match(line)
            if m:
                raw_pos = None
                for g in m.groups():
                    if g:
                        raw_pos = g.lower()
                        break
                if raw_pos:
                    candidate_meaning = m.group(m.lastindex) or ""
                    cleaned = _clean_meaning(candidate_meaning)
                    if cleaned and _has_chinese(cleaned):
                        pos = POS_NORMALIZE.get(raw_pos, raw_pos + ".")
                        meaning = cleaned
                        break
                    if not pos:
                        pos = POS_NORMALIZE.get(raw_pos, raw_pos + ".")
                        meaning = cleaned

    if not pos and not meaning and lines:
        for line in lines:
            if line.startswith("[") and "]" in line and len(line) < 15:
                continue
            cleaned = _clean_meaning(line)
            if cleaned and _has_chinese(cleaned):
                meaning = cleaned
                break
        if not meaning and lines:
            meaning = _clean_meaning(lines[0])

    if meaning:
        parts = re.split(r'[,，;；]', meaning)
        if len(parts) > 4:
            meaning = "，".join(parts[:4])

    return pos, meaning


def _clean_meaning(text: str) -> str:
    """清理释义文本：移除注释、英文残留、多余分隔符"""
    if not text:
        return ""
    result = BRACKET_RE.sub("", text)
    result = ENGLISH_WORD_RE.sub("", result)
    result = re.sub(r'[,，;；]{2,}', "，", result)
    result = result.strip(" ,，;；.。:：")
    result = result.replace(",", "，")
    return result


def _has_chinese(text: str) -> bool:
    """检查文本是否包含中文字符"""
    return bool(re.search(r'[\u4e00-\u9fff]', text))


# ── CSV 解析 ────────────────────────────────────────────

def parse_word_entry(row: dict) -> dict | None:
    """从 CSV 行构建词条 dict"""
    word = row.get("word", "").strip()
    translation = row.get("translation", "").strip()
    if not word or not translation:
        return None

    pos, meaning = extract_pos_and_meaning(translation)

    try:
        frq = int(row.get("frq", "0") or "0")
    except (ValueError, TypeError):
        frq = 0
    try:
        bnc = int(row.get("bnc", "0") or "0")
    except (ValueError, TypeError):
        bnc = 0

    return {
        "word": word,
        "pos": pos,
        "meaning": meaning,
        "collins": row.get("collins", "").strip(),
        "tag": row.get("tag", ""),
        "_frq": frq,
        "_bnc": bnc,
    }


def parse_csv(csv_path: str) -> tuple[list[dict], list[dict]]:
    """
    解析 CSV，返回:
      - gk_words: tag 包含 'gk' 的词条
      - cet4_words: tag 包含 'cet4' 的词条（包含 gk+cet4 重叠）
    """
    gk_words = []
    cet4_words = []

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            tags = row.get("tag", "").split()
            entry = parse_word_entry(row)
            if not entry:
                continue

            if "gk" in tags:
                gk_words.append(entry)
            if "cet4" in tags:
                cet4_words.append(entry)

    return gk_words, cet4_words


# ── 词频排序 ────────────────────────────────────────────

def sort_by_freq_asc(words: list[dict]) -> list[dict]:
    """
    按词频升序排序（常用词在前 = 较易在前）。
    frq > 0 的按 frq 升序（数值越小越常用 = 越容易），
    frq = 0 的按 bnc 升序，
    都为 0 的按字母顺序。
    """
    def sort_key(w):
        frq = w["_frq"]
        bnc = w["_bnc"]
        word = w["word"].lower()
        if frq > 0:
            return (0, frq, word)
        elif bnc > 0:
            return (1, bnc, word)
        else:
            return (2, 0, word)

    return sorted(words, key=sort_key)


def sort_by_freq_desc(words: list[dict]) -> list[dict]:
    """
    按词频降序排序（低频词在前 = 较难在前）。
    """
    def sort_key(w):
        frq = w["_frq"]
        bnc = w["_bnc"]
        word = w["word"].lower()
        if frq > 0:
            return (0, -frq, word)
        elif bnc > 0:
            return (1, -bnc, word)
        else:
            return (2, 0, word)

    return sorted(words, key=sort_key)


# ── 难度分选 ────────────────────────────────────────────

# 各 collins 级别的最低词频阈值（排除异常基础词）
# collins 字段不完全可靠：部分极常用词（如 in/can/up）被归入 collins=2
# 通过 frq 阈值过滤掉这些异常词
LEVEL_MIN_FRQ = {
    "4": 500,    # B1: 排除 will(48)/use(92)/may(119) 等异常基础词
    "3": 300,    # B2: 排除 make(45)/know(47)/so(55) 等异常基础词
    "2": 2000,   # C1: 排除 in(6)/can(37)/up(50) 等异常基础词
    "1": 2000,   # C1+: 排除 take(63)/just(66)/even(107) 等异常基础词
    "": 2000,    # empty collins: 排除 American(176)/teacher(371) 等
}


def filter_by_frq(words: list[dict], min_frq: int) -> tuple[list[dict], list[dict]]:
    """
    按最低词频过滤，返回 (保留的词, 被过滤的词)。
    frq=0（未知频率）的词保留，只过滤 0 < frq < min_frq 的异常基础词。
    """
    kept = []
    removed = []
    for w in words:
        frq = w["_frq"]
        if 0 < frq < min_frq:
            removed.append(w)
        else:
            kept.append(w)
    return kept, removed


def select_words_by_difficulty(gk_words: list[dict], cet4_words: list[dict]) -> list[dict]:
    """
    按新难度分配方案选取词汇（含频率过滤）:
      B1 (150): collins=4 中较难的 150 词（frq≥500）
      B2 (1100): collins=3 全部 + collins=4 较易部分（frq≥300/500）
      C1 (750): collins=2 较易部分 + collins=1 全部 + empty collins 全部（frq≥2000）
      四级高频 (800): cet4 词汇中排除已选和异常基础词，按频率优先
    """
    # ── 按 collins 分组并过滤异常基础词 ──
    collins_groups: dict[str, list[dict]] = {
        "5": [], "4": [], "3": [], "2": [], "1": [], "": []
    }
    for w in gk_words:
        c = w["collins"]
        if c in collins_groups:
            collins_groups[c].append(w)
        else:
            collins_groups[""].append(w)

    # 过滤异常基础词，收集被排除的词
    excluded_basic = set()  # 异常基础词集合（排除出所有后续选择）
    for c in ["4", "3", "2", "1", ""]:
        min_frq = LEVEL_MIN_FRQ.get(c, 0)
        kept, removed = filter_by_frq(collins_groups[c], min_frq)
        collins_groups[c] = kept
        for w in removed:
            excluded_basic.add(w["word"].lower())
        print(f"  collins={c!r}: {len(kept)} kept (removed {len(removed)} anomalous basic)")

    # ── B1: collins=4 较难的 150 词 ──
    c4_asc = sort_by_freq_asc(collins_groups["4"])
    b1_pool = c4_asc[-150:]  # 最难的 150
    b1_pool = sort_by_freq_asc(b1_pool)  # 日内由易到难
    print(f"[B1] 选取 {len(b1_pool)} 词, 前5: {[w['word'] for w in b1_pool[:5]]}")

    # ── B2: collins=4 较易 + collins=3 全部 ──
    b2_need_from_c4 = 1100 - len(collins_groups["3"])  # 需从 c4 补充的数量
    b2_fill_from_c4 = c4_asc[:b2_need_from_c4]  # 最易的部分（未用于 B1）
    c3_asc = sort_by_freq_asc(collins_groups["3"])
    b2_pool = b2_fill_from_c4 + c3_asc  # 先 B1-bridge（较易）, 再 B2 全部
    print(f"[B2] 选取 {len(b2_pool)} 词 (c4较易 {len(b2_fill_from_c4)} + c3全部 {len(c3_asc)}), 前5: {[w['word'] for w in b2_pool[:5]]}")

    # ── C1: collins=2 较易 + collins=1 全部 + empty 全部 ──
    c2_asc = sort_by_freq_asc(collins_groups["2"])
    c1_asc = sort_by_freq_asc(collins_groups["1"])
    empty_asc = sort_by_freq_asc(collins_groups[""])
    c1_from_c2_and_c1 = len(c1_asc) + len(empty_asc)  # c1 + empty 合计
    c1_need_from_c2 = max(0, 750 - c1_from_c2_and_c1)  # 需从 c2 补充
    c1_fill_from_c2 = c2_asc[:c1_need_from_c2]  # 最易的 c2（C1 入门）
    c1_pool = c1_fill_from_c2 + c1_asc + empty_asc
    print(f"[C1] 选取 {len(c1_pool)} 词 (c2较易 {len(c1_fill_from_c2)} + c1全部 {len(c1_asc)} + empty全部 {len(empty_asc)}), 前5: {[w['word'] for w in c1_pool[:5]]}")

    # ── 四级高频: 从 cet4 词汇中排除已选和异常基础词 ──
    used_words = set()
    for w in b1_pool + b2_pool + c1_pool:
        used_words.add(w["word"].lower())
    # 异常基础词也排除（如 will/use/may/in/can 等不应出现在四级高频中）
    used_words |= excluded_basic

    cet4_gk_overlap = []  # gk+cet4 但未选入 B1/B2/C1
    cet4_pure = []         # 纯 cet4（非 gk）

    for w in cet4_words:
        wl = w["word"].lower()
        if wl in used_words:
            continue
        tags = w["tag"].split()
        if "gk" in tags:
            cet4_gk_overlap.append(w)
        else:
            cet4_pure.append(w)

    print(f"[四级] gk+cet4 未选: {len(cet4_gk_overlap)}, 纯 cet4: {len(cet4_pure)}")

    cet4_gk_sorted = sort_by_freq_asc(cet4_gk_overlap)
    cet4_pure_sorted = sort_by_freq_asc(cet4_pure)

    cet4_pool = cet4_gk_sorted + cet4_pure_sorted
    cet4_pool = cet4_pool[:800]
    print(f"[四级] 选取 {len(cet4_pool)} 词, 前5: {[w['word'] for w in cet4_pool[:5]]}")

    # ── 合并 ──
    all_selected = b1_pool + b2_pool + c1_pool + cet4_pool
    print(f"[总计] 选取 {len(all_selected)} 词 (目标 {TOTAL_WORDS})")

    return all_selected


# ── 分配到天 ────────────────────────────────────────────

def distribute_words(words: list[dict]) -> dict:
    """将单词按 DISTRIBUTION_PLAN 分配到 56 天"""
    result = {}
    idx = 0

    for start_day, end_day, words_per_day, level, target_count in DISTRIBUTION_PLAN:
        batch_num = 1
        for day in range(start_day, end_day + 1):
            day_words_raw = words[idx: idx + words_per_day]
            idx += words_per_day

            day_words = [
                {"word": w["word"], "pos": w["pos"], "meaning": w["meaning"]}
                for w in day_words_raw
            ]

            result[str(day)] = {
                "level": level,
                "batch": batch_num,
                "count": len(day_words),
                "words": day_words,
            }
            batch_num += 1

    return result


# ── 主流程 ────────────────────────────────────────────

async def main():
    result_mode = sys.argv[1] if len(sys.argv) > 1 else "display_only"
    print(f"[参数] result_mode={result_mode}")
    print(f"[参数] 总目标词数: {TOTAL_WORDS}, 分配方案: {[(p[3], p[4]) for p in DISTRIBUTION_PLAN]}")

    sdk = CodeActSDK()

    try:
        # Step 1: 下载/定位 CSV
        csv_path = download_csv()
        if not csv_path:
            await sdk.submit_result(
                result_mode="notify",
                status="error",
                message="无法下载 ECDICT CSV 文件，请检查网络连接",
            )
            return

        # Step 2: 解析 CSV，分别获取 gk 和 cet4 词汇
        print("[解析] 开始解析 CSV...")
        gk_words, cet4_words = parse_csv(csv_path)
        print(f"[解析] gk 词汇: {len(gk_words)}, cet4 词汇: {len(cet4_words)}")

        # Step 3: 按难度分选
        print("[分选] 按难度级别分选词汇...")
        print("  collins 分布 (gk):")
        selected_words = select_words_by_difficulty(gk_words, cet4_words)

        if len(selected_words) < TOTAL_WORDS:
            print(f"[警告] 词汇数量不足: {len(selected_words)} < {TOTAL_WORDS}")
        elif len(selected_words) > TOTAL_WORDS:
            selected_words = selected_words[:TOTAL_WORDS]
            print(f"[调整] 截取前 {TOTAL_WORDS} 词")

        # 统计缺失情况
        missing_pos = sum(1 for w in selected_words if not w["pos"])
        missing_meaning = sum(1 for w in selected_words if not w["meaning"])
        print(f"[统计] 缺失词性: {missing_pos}, 缺失释义: {missing_meaning}")

        # 如果有缺失词性或释义，用 LLM 补充
        if missing_pos > 0 or missing_meaning > 0:
            print(f"[LLM] 补充 {missing_pos + missing_meaning} 个缺失字段...")
            await supplement_with_llm(sdk, selected_words)

        # Step 4: 分配到56天
        print("[分配] 分配词汇到56天...")
        vocab_data = distribute_words(selected_words)

        # Step 5: 写入 JSON
        os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(vocab_data, f, ensure_ascii=False, indent=2)
        print(f"[完成] JSON 文件已写入: {OUTPUT_PATH}")

        # 验证
        total_in_json = sum(d["count"] for d in vocab_data.values())
        days_with_data = sum(1 for d in vocab_data.values() if d["count"] > 0)
        print(f"[验证] JSON 中总词数: {total_in_json}, 有效天数: {days_with_data}")

        # 统计各等级
        level_stats = {}
        for day_data in vocab_data.values():
            lvl = day_data["level"]
            level_stats[lvl] = level_stats.get(lvl, 0) + day_data["count"]

        stats_msg = " | ".join(f"{k}: {v}词" for k, v in level_stats.items())
        print(f"[验证] 等级分布: {stats_msg}")

        # 采样输出
        day2_words = [w["word"] for w in vocab_data["2"]["words"][:10]]
        day30_words = [w["word"] for w in vocab_data["30"]["words"][:5]]
        day50_words = [w["word"] for w in vocab_data["50"]["words"][:5]]
        print(f"[采样] Day2 前10: {day2_words}")
        print(f"[采样] Day30 前5: {day30_words}")
        print(f"[采样] Day50 前5: {day50_words}")

        actual_mode = result_mode if result_mode != "auto" else "display_only"
        abs_path = os.path.abspath(OUTPUT_PATH)

        # 构建详细报告
        detail_lines = []
        detail_lines.append(f"高考英语词汇数据已重新生成（提高难度版）")
        detail_lines.append(f"")
        detail_lines.append(f"总词数: {total_in_json} | 天数: {days_with_data} (Day2-Day57)")
        detail_lines.append(f"")
        detail_lines.append(f"难度分布:")
        for plan in DISTRIBUTION_PLAN:
            start, end, per_day, level, target = plan
            days = end - start + 1
            actual = sum(
                vocab_data[str(d)]["count"]
                for d in range(start, end + 1)
                if str(d) in vocab_data
            )
            detail_lines.append(f"  {level}: Day{start}-{end} ({days}天, {actual}词)")
        detail_lines.append(f"")
        detail_lines.append(f"采样:")
        detail_lines.append(f"  Day2 前10词: {', '.join(day2_words)}")
        detail_lines.append(f"  Day30 前5词: {', '.join(day30_words)}")
        detail_lines.append(f"  Day50 前5词: {', '.join(day50_words)}")
        detail_lines.append(f"")
        detail_lines.append(f"数据来源: ECDICT 开源词典 (tag=gk + tag=cet4, MIT License)")
        detail_lines.append(f"文件路径: [vocab_data.json]({abs_path})")

        await sdk.submit_result(
            result_mode=actual_mode,
            status="success",
            message="\n".join(detail_lines),
            data={
                "output_path": OUTPUT_PATH,
                "total_words": total_in_json,
                "gk_words_found": len(gk_words),
                "cet4_words_found": len(cet4_words),
                "days": days_with_data,
                "missing_pos": missing_pos,
                "missing_meaning": missing_meaning,
                "level_stats": level_stats,
                "day2_sample": day2_words,
                "day30_sample": day30_words,
                "day50_sample": day50_words,
            },
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        await sdk.submit_result(
            result_mode="notify",
            status="error",
            message=f"执行失败: {e}",
        )


async def supplement_with_llm(sdk: CodeActSDK, words: list[dict]):
    """用 LLM 批量补充缺失的词性或释义"""
    from pydantic import BaseModel

    class WordSupplement(BaseModel):
        word: str
        pos: str
        meaning: str

    class SupplementResult(BaseModel):
        items: list[WordSupplement]

    need_supplement = [
        {"word": w["word"], "pos": w["pos"], "meaning": w["meaning"]}
        for w in words
        if not w["pos"] or not w["meaning"]
    ]

    if not need_supplement:
        return

    batch_size = 50
    supplemented = {}

    for i in range(0, len(need_supplement), batch_size):
        batch = need_supplement[i: i + batch_size]
        batch_words = [item["word"] for item in batch]

        prompt = (
            "请为以下英语单词补充词性和中文释义。"
            "词性用英文缩写（如 v. n. adj. adv. prep. conj. pron. art. num. int. aux.）。"
            "释义用中文，多个释义用中文分号（；）分隔。\n"
            "只返回 JSON，格式: {\"items\": [{\"word\": \"...\", \"pos\": \"...\", \"meaning\": \"...\"}]}\n\n"
            "单词列表:\n" + "\n".join(batch_words)
        )

        try:
            result = await sdk.call_llm(
                messages=[{"role": "user", "content": prompt}],
                response_format=SupplementResult,
            )
            if result and hasattr(result, "items"):
                for item in result.items:
                    supplemented[item.word.lower()] = {
                        "pos": item.pos,
                        "meaning": item.meaning,
                    }
                print(f"[LLM] 批次 {i // batch_size + 1}: 补充了 {len(result.items)} 个词")
        except Exception as e:
            print(f"[LLM] 批次 {i // batch_size + 1} 失败: {e}")

    for w in words:
        key = w["word"].lower()
        if key in supplemented:
            sup = supplemented[key]
            if not w["pos"] and sup["pos"]:
                w["pos"] = sup["pos"]
            if not w["meaning"] and sup["meaning"]:
                w["meaning"] = sup["meaning"]


if __name__ == "__main__":
    asyncio.run(main())
