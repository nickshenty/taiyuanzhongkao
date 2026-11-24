#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""每日学习任务推送脚本（含PDF发送）

为申奇峰暑假学习计划（7/6-8/31，共57天）每天早上推送当日学习任务到飞书。
从 study_data.json 读取当天数据，格式化为简短文本消息发送，
同时查找对应 Day{N}_学习内容.pdf 文件并发送到飞书。

参数顺序: result_mode, dry_run
- result_mode: 默认 no_reply（发送成功不回传主agent，失败则 notify）
- dry_run: 默认 0；为 1 时只打印不发送
"""

import asyncio
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path

from codeact_sdk import CodeActSDK

# ═══════════════════════════════════════════════
# 常量
# ═══════════════════════════════════════════════

PLAN_START = dt.date(2026, 7, 6)   # Day 1
CHAT_ID = "oc_94e0aa95f5924fb482f1321dc891e39d"
DATA_PATH = Path(__file__).parent / "study_data.json"

# 基础工作目录（lark-cli --file 要求 cwd 相对路径，拒绝绝对路径和 .. ）
BASE_DIR = Path(__file__).resolve().parent.parent.parent
KONGZI_DIR = BASE_DIR / "孔子学习辅助"

SUBJ_ICON = {"数学": "🔢", "物理": "⚛️", "化学": "⚗️", "生物": "🧬"}

ENCOURAGEMENTS = [
    "坚持就是胜利，今天的努力是明天的底气！",
    "暑假是弯道超车的机会，每一分钟都不浪费！",
    "不怕慢就怕站，今天也要稳扎稳打！",
    "自律给你自由，坚持给你力量！",
    "今天的你，比昨天更接近梦想！",
    "学习是马拉松不是百米冲刺，稳住节奏！",
    "今天的汗水，是明天的分数！",
    "专注当下，未来可期！",
    "每天进步一点点，暑假结束你会感谢自己！",
    "不积跬步无以至千里，今天每一步都算数！",
    "好习惯的复利效应，从今天开始累积！",
    "种树最好的时间是十年前，其次是现在！",
]


# ═══════════════════════════════════════════════
# 数据加载
# ═══════════════════════════════════════════════

def load_study_data() -> dict:
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def get_day_number(today: dt.date) -> int:
    delta = (today - PLAN_START).days + 1
    return delta if 1 <= delta <= 57 else 0


def format_date(date_str: str) -> str:
    """将 '2026-07-06' 格式化为 '7月6日'"""
    d = dt.date.fromisoformat(date_str)
    return f"{d.month}月{d.day}日"


# ═══════════════════════════════════════════════
# PDF 查找
# ═══════════════════════════════════════════════

def find_pdf(day: int) -> str | None:
    """在 孔子学习辅助/*周PDF/ 目录下查找 Day{N}_学习内容.pdf

    返回相对于 BASE_DIR 的路径（如 '孔子学习辅助/第一周PDF/Day1_学习内容.pdf'），
    未找到返回 None。
    """
    pdf_name = f"Day{day}_学习内容.pdf"
    if not KONGZI_DIR.exists():
        return None
    # 遍历所有 *周PDF/ 目录
    for d in sorted(KONGZI_DIR.iterdir()):
        if d.is_dir() and d.name.endswith("周PDF"):
            pdf_path = d / pdf_name
            if pdf_path.exists():
                return f"孔子学习辅助/{d.name}/{pdf_name}"
    return None


# ═══════════════════════════════════════════════
# 消息构建
# ═══════════════════════════════════════════════

def build_message(d: dict, day: int, has_pdf: bool) -> str:
    """构建简短文本消息：鼓励语 + 当天科目概要 + PDF提示"""
    tour = d.get("study_tour", False)
    lines = []

    # 标题
    date_str = format_date(d["date"])
    title = f"☀️ 早安奇峰！暑假Day{day}（{date_str} {d['weekday']}）"
    if tour:
        title += " · 研学游期间"
    lines.append(title)
    lines.append("")

    # 学习内容标题
    if has_pdf:
        lines.append("📚 今日学习内容（详见PDF）：")
    else:
        lines.append("📚 今日学习内容：")
    lines.append("")

    # 英语词汇（固定任务）
    lines.append(f"🔤 英语词汇：{d['english']}")
    # 语文古诗文（固定任务）
    lines.append(f"📝 语文古诗文：{d['chinese']}")
    lines.append("")

    # 当日各科学习内容（从 daily_learning 拉取，与学校作业对齐）
    dl = d.get("daily_learning", {})
    subj_order = [
        ("math", "🔢 数学"),
        ("chemistry", "⚗️ 化学"),
        ("biology", "🧬 生物"),
        ("chinese", "📝 语文"),
        ("english", "🔤 英语"),
        ("physics", "⚛️ 物理"),
    ]
    for key, label in subj_order:
        s = dl.get(key, {})
        if isinstance(s, dict) and s.get("topic"):
            lines.append(f"{label}：{s['topic']}")

    lines.append("")

    # 测试提醒
    tests = d.get("tests", [])
    if tests:
        lines.append("⚠️ 今晚测试：" + "、".join(tests))
        lines.append("")

    # PDF 提示
    if has_pdf:
        lines.append("📄 详细学习内容见上方PDF文件")
        lines.append("")

    # 鼓励语
    quote = ENCOURAGEMENTS[(day - 1) % len(ENCOURAGEMENTS)]
    lines.append(f"💬 {quote}")

    return "\n".join(lines)


# ═══════════════════════════════════════════════
# 飞书发送
# ═══════════════════════════════════════════════

def send_feishu_text(message: str) -> str:
    """发送文本消息到飞书"""
    result = subprocess.run(
        ["lark-cli", "im", "+messages-send", "--chat-id", CHAT_ID,
         "--as", "bot", "--text", message],
        capture_output=True, text=True, timeout=60,
        cwd=str(BASE_DIR),
    )
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(f"lark-cli 发送文本失败: {err[:300]}")
    return result.stdout.strip()


def send_feishu_file(relative_path: str) -> str:
    """发送文件到飞书（relative_path 相对于 BASE_DIR）"""
    result = subprocess.run(
        ["lark-cli", "im", "+messages-send", "--chat-id", CHAT_ID,
         "--as", "bot", "--file", relative_path],
        capture_output=True, text=True, timeout=120,
        cwd=str(BASE_DIR),
    )
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(f"lark-cli 发送文件失败: {err[:300]}")
    return result.stdout.strip()


# ═══════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════

def norm_mode(raw: str) -> str:
    mode = (raw or "no_reply").strip().lower()
    if mode == "auto":
        return "no_reply"
    return mode if mode in {"display_only", "notify", "no_reply"} else "no_reply"


async def main():
    result_mode = norm_mode(sys.argv[1] if len(sys.argv) > 1 else "no_reply")
    dry_run = sys.argv[2] if len(sys.argv) > 2 else "0"

    print(f"[参数] result_mode={result_mode}, dry_run={dry_run}")
    print(f"[路径] BASE_DIR={BASE_DIR}")
    sdk = CodeActSDK()

    try:
        today = dt.date.today()
        day = get_day_number(today)

        if day == 0:
            print(f"今天 {today} 不在暑假计划范围内（7/6-8/31），跳过推送")
            await sdk.submit_result(result_mode="no_reply", status="success", message="NO_REPLY")
            return

        data = load_study_data()
        d = data[str(day)]

        # 查找 PDF
        pdf_rel_path = find_pdf(day)
        has_pdf = pdf_rel_path is not None
        print(f"[PDF] Day{day} PDF: {pdf_rel_path or '未找到'}")

        # 构建消息
        message = build_message(d, day, has_pdf)

        print(f"\n{'─' * 50}")
        print(message)
        print(f"{'─' * 50}\n")

        if dry_run == "1":
            print("[dry-run] 跳过飞书发送")
        else:
            # 先发文本消息
            send_feishu_text(message)
            print("[完成] 文本消息已发送到飞书")

            # 再发 PDF 文件（如果存在）
            if has_pdf:
                send_feishu_file(pdf_rel_path)
                print(f"[完成] PDF文件已发送到飞书: {pdf_rel_path}")
            else:
                print("[跳过] 当天PDF文件不存在，仅发送文本消息")

        await sdk.submit_result(
            result_mode=result_mode, status="success",
            message="NO_REPLY",
            data={"day": day, "weekday": d["weekday"], "study_tour": d.get("study_tour", False), "has_pdf": has_pdf},
        )

    except Exception as e:
        print(f"[错误] {e}")
        await sdk.submit_result(result_mode="notify", status="error", message=f"每日学习推送失败: {e}")


if __name__ == "__main__":
    asyncio.run(main())
