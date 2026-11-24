#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""每日测试卷推送脚本

为申奇峰暑假学习计划每天晚上推送当日测试卷PDF到飞书。
与 daily_study_push.py 使用相同的 Day 计算逻辑（Day1=7/6），确保早晚一致。

参数顺序: result_mode, dry_run
- result_mode: 默认 no_reply
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

PLAN_START = dt.date(2026, 7, 6)   # Day 1（与 daily_study_push.py 一致）
CHAT_ID = "oc_94e0aa95f5924fb482f1321dc891e39d"
DATA_PATH = Path(__file__).parent / "study_data.json"

BASE_DIR = Path(__file__).resolve().parent.parent.parent
KONGZI_DIR = BASE_DIR / "孔子学习辅助"

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
    d = dt.date.fromisoformat(date_str)
    return f"{d.month}月{d.day}日"

# ═══════════════════════════════════════════════
# PDF 查找
# ═══════════════════════════════════════════════

def find_test_pdf(day: int) -> str | None:
    """在 孔子学习辅助/*周PDF/ 目录下查找 Day{N}_测试卷.pdf"""
    pdf_name = f"Day{day}_测试卷.pdf"
    if not KONGZI_DIR.exists():
        return None
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
    """构建晚间测试卷推送消息"""
    date_str = format_date(d["date"])
    lines = []

    lines.append(f"🌙 奇峰，今晚的测试卷来了！（{date_str} {d['weekday']}）")
    lines.append("")

    tests = d.get("tests", [])
    if tests:
        lines.append("📋 今晚测试项目：")
        for t in tests:
            lines.append(f"  • {t}")
        lines.append("")

    # 学校作业提醒
    hw = d.get("school_hw", {})
    if hw:
        lines.append("📚 今日学校作业完成情况自查：")
        for subj in ["chemistry", "math", "chinese", "english", "biology"]:
            if subj in hw:
                labels = {"chemistry": "化学", "math": "数学", "chinese": "语文", "english": "英语", "biology": "生物"}
                lines.append(f"  ☐ {labels.get(subj, subj)}：{hw[subj][:40]}")
        lines.append("")

    if has_pdf:
        lines.append("📄 测试卷PDF见上方文件，做完对着答案自己批一下。")
    else:
        lines.append("📝 测试卷还在准备中，先复习今天学的内容吧！")

    lines.append("")
    lines.append("💪 做完早点休息，保持好状态明天继续！")

    return "\n".join(lines)

# ═══════════════════════════════════════════════
# 飞书发送
# ═══════════════════════════════════════════════

def send_feishu_text(message: str) -> str:
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
    sdk = CodeActSDK()

    try:
        today = dt.date.today()
        day = get_day_number(today)

        if day == 0:
            print(f"今天 {today} 不在暑假计划范围内，跳过推送")
            await sdk.submit_result(result_mode="no_reply", status="success", message="NO_REPLY")
            return

        # 22:00后不推送
        now = dt.datetime.now()
        if now.hour >= 22:
            print(f"已过22:00，跳过推送")
            await sdk.submit_result(result_mode="no_reply", status="success", message="NO_REPLY")
            return

        data = load_study_data()
        d = data[str(day)]

        pdf_rel_path = find_test_pdf(day)
        has_pdf = pdf_rel_path is not None
        print(f"[PDF] Day{day} 测试卷: {pdf_rel_path or '未找到'}")

        message = build_message(d, day, has_pdf)

        print(f"\n{'─' * 50}")
        print(message)
        print(f"{'─' * 50}\n")

        if dry_run == "1":
            print("[dry-run] 跳过飞书发送")
        else:
            send_feishu_text(message)
            print("[完成] 文本消息已发送到飞书")

            if has_pdf:
                send_feishu_file(pdf_rel_path)
                print(f"[完成] 测试卷PDF已发送: {pdf_rel_path}")
            else:
                print("[跳过] 测试卷PDF不存在，仅发送文本消息")

        await sdk.submit_result(
            result_mode=result_mode, status="success",
            message="NO_REPLY",
            data={"day": day, "has_pdf": has_pdf},
        )

    except Exception as e:
        print(f"[错误] {e}")
        await sdk.submit_result(result_mode="notify", status="error", message=f"测试卷推送失败: {e}")


if __name__ == "__main__":
    asyncio.run(main())
