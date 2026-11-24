#!/usr/bin/env python3
"""
申奇峰暑假学习计划 - 任意Day范围每日学习内容PDF生成脚本

从 study_data.json 的 daily_learning 字段拉取学习内容，
配合 vocab_data.json 和 poetry_data.json 生成每日PDF。
注意：md_to_pdf.py 不支持 #### 四级标题（会导致无限循环），故用 **粗体** 替代。

用法:
    python3 generate_week1_pdfs.py                    # 默认生成 Day1-7（第一周）
    python3 generate_week1_pdfs.py --start 8 --end 14 # 生成第二周
    python3 generate_week1_pdfs.py --start 15 --end 21 # 生成第三周

输出目录按周自动切换：
    Day1-7 → 第一周PDF/，Day8-14 → 第二周PDF/，以此类推
"""

import json
import os
import subprocess
import sys
import argparse

# ==================== 路径配置 ====================
BASE_DIR = "/app/data/所有对话/主对话"
SCRIPTS_DIR = os.path.join(BASE_DIR, "codeact", "scripts")
STUDY_BASE_DIR = os.path.join(BASE_DIR, "孔子学习辅助")
MD_TO_PDF = os.path.join(SCRIPTS_DIR, "md_to_pdf.py")

# 数据源文件路径
STUDY_DATA_PATH = os.path.join(SCRIPTS_DIR, "study_data.json")
POETRY_DATA_PATH = os.path.join(SCRIPTS_DIR, "poetry_data.json")
VOCAB_DATA_PATH = os.path.join(SCRIPTS_DIR, "vocab_data.json")

# 每日鼓励语（7条循环）
ENCOURAGEMENT = [
    "坚持就是胜利，今天的努力是明天的底气！",
    "积少成多，聚沙成塔，每一天的进步都在积累！",
    "学如逆水行舟，不进则退，加油！",
    "今日事今日毕，自律是最好的天赋！",
    "不积跬步无以至千里，不积小流无以成江海！",
    "知识改变命运，学习成就未来，继续前行！",
    "一周的坚持已见成效，保持这份热情，未来可期！",
]

# 科目图标和标签
SUBJECT_META = {
    "math": {"label": "🔢 数学", "formula_label": "公式"},
    "chemistry": {"label": "⚗️ 化学", "formula_label": "方程式"},
    "biology": {"label": "🧬 生物", "formula_label": "公式"},
    "chinese": {"label": "📝 语文", "formula_label": "公式"},
    "english": {"label": "🔤 英语", "formula_label": "公式"},
    "physics": {"label": "⚡ 物理", "formula_label": "公式"},
}

SUBJECT_ORDER = ["math", "chemistry", "biology", "chinese", "english", "physics"]


# ==================== 周目录计算 ====================
CN_NUMS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']


def week_cn(n):
    """将周序号转为中文数字"""
    if n <= 10:
        return CN_NUMS[n]
    if n < 20:
        return '十' + CN_NUMS[n - 10]
    tens = n // 10
    ones = n % 10
    result = CN_NUMS[tens] + '十'
    if ones:
        result += CN_NUMS[ones]
    return result


def get_week_dir(start_day):
    """根据起始Day计算输出目录名"""
    week_num = (start_day - 1) // 7 + 1
    return os.path.join(STUDY_BASE_DIR, f"第{week_cn(week_num)}周PDF")


# ==================== 日期信息提取 ====================
def get_date_info(day, study_data):
    """从 study_data.json 提取日期和星期信息"""
    entry = study_data.get(str(day), {})
    date_str = entry.get("date", "")  # e.g., "2026-07-06"
    weekday = entry.get("weekday", "")  # e.g., "周一"
    if date_str:
        parts = date_str.split("-")
        date_display = f"{int(parts[1])}/{int(parts[2])}"
    else:
        date_display = f"Day{day}"
    return date_display, weekday


# ==================== 数据加载 ====================
def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_all_data():
    study_data = load_json(STUDY_DATA_PATH)
    poetry_data = load_json(POETRY_DATA_PATH)
    vocab_data = load_json(VOCAB_DATA_PATH)
    return study_data, poetry_data, vocab_data


# ==================== 安全处理函数 ====================
def sanitize_content(text):
    """处理正文内容，避免md_to_pdf.py解析器问题：
    - 行首 # 会被误判为标题导致无限循环，需转义
    - 行首 | 会被误判为表格，需转义
    """
    if not text:
        return text
    lines = text.split("\n")
    fixed = []
    for line in lines:
        stripped = line.strip()
        # 行首 # 但不是 # / ## / ### 标准标题 → 加空格转义
        if stripped.startswith("#") and not (
            stripped.startswith("# ") or stripped.startswith("## ") or stripped.startswith("### ")
        ):
            fixed.append("\\#" + line[1:] if len(line) > 0 else "\\#")
        # 行首 | 转义
        elif stripped.startswith("|"):
            fixed.append("\\|" + line[1:] if len(line) > 0 else "\\|")
        else:
            fixed.append(line)
    return "\n".join(fixed)


def format_content_paragraphs(content):
    """对长文本内容进行分段排版"""
    if not content:
        return content
    if content.count("\n") > 3:
        return content

    import re
    result = content
    # Step 1: 中文数字编号前插入空行并加粗
    result = re.sub(r"([一二三四五六七八九十]+、)", lambda m: f"\n\n**{m.group(1)}** ", result)
    # Step 2: 阿拉伯数字编号前插入换行
    result = re.sub(r"([^\n\d])(\d+\.)", r"\1\n\2", result)
    # Step 3: "第X步"前插入换行
    result = re.sub(r"([^\n])(第[一二三四五六七八九十]+步)", r"\1\n\2", result)
    # 清理多余空行
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip()


# ==================== Markdown 拼接函数 ====================
def build_vocab_section(day, vocab_data):
    """构建英语词汇部分"""
    lines = []
    lines.append("## 🔤 英语词汇")
    lines.append("")
    key = str(day)
    if key not in vocab_data:
        lines.append("> 今日为词汇测试日，不学新词")
        lines.append("")
        return "\n".join(lines)

    v = vocab_data[key]
    level = v.get("level", "")
    batch = v.get("batch", "")
    count = v.get("count", 0)
    words = v.get("words", [])

    lines.append(f"**等级：** {level}　**批次：** 第{batch}批　**词数：** {count}词")
    lines.append("")
    lines.append("| 序号 | 单词 | 词性 | 释义 |")
    lines.append("|------|------|------|------|")
    for idx, w in enumerate(words, 1):
        word = w.get("word", "").replace("|", "\\|")
        pos = w.get("pos", "").replace("|", "\\|")
        meaning = w.get("meaning", "").replace("|", "\\|")
        lines.append(f"| {idx} | {word} | {pos} | {meaning} |")
    lines.append("")
    return "\n".join(lines)


def build_poetry_section(day, poetry_data):
    """构建语文古诗文部分"""
    lines = []
    lines.append("## 📜 语文古诗文")
    lines.append("")
    key = str(day)
    if key not in poetry_data:
        lines.append("> 今日无古诗文学习内容")
        lines.append("")
        return "\n".join(lines)

    p = poetry_data[key]
    title = p.get("title", "")
    author = p.get("author", "")
    dynasty = p.get("dynasty", "")
    original = p.get("original", "")
    translation = p.get("translation", "")
    notes = p.get("notes", [])
    key_points = p.get("key_points", "")

    lines.append(f"### {title}")
    author_parts = []
    if dynasty:
        author_parts.append(dynasty)
    if author:
        author_parts.append("· " + author)
    if author_parts:
        lines.append(f"**{'　'.join(author_parts)}**")
    lines.append("")

    lines.append("**原文**")
    lines.append("")
    lines.append(f"> {original.replace(chr(10), chr(10) + '> ')}")
    lines.append("")

    lines.append("**译文**")
    lines.append("")
    lines.append(f"> {translation.replace(chr(10), chr(10) + '> ')}")
    lines.append("")

    if notes:
        lines.append("**注释**")
        lines.append("")
        for note in notes:
            word = note.get("word", "")
            meaning = note.get("meaning", "")
            lines.append(f"- **{word}** → {meaning}")
        lines.append("")

    if key_points:
        lines.append("**背诵要点**")
        lines.append("")
        lines.append(sanitize_content(key_points))
        lines.append("")

    return "\n".join(lines)


def build_daily_learning_section(day, study_data):
    """构建今日学习内容板块（从 daily_learning 字段拉取）"""
    lines = []
    key = str(day)
    d = study_data.get(key, {})
    dl = d.get("daily_learning", {})

    if not dl:
        return ""

    lines.append("## 📖 今日学习内容")
    lines.append("")
    lines.append("> 每科学习流程：先复习概念 → 再做作业练习")
    lines.append("")

    for subj in SUBJECT_ORDER:
        subj_data = dl.get(subj)
        if not subj_data:
            continue

        meta = SUBJECT_META.get(subj, {"label": subj, "formula_label": "公式"})
        label = meta["label"]
        topic = subj_data.get("topic", "")
        content = subj_data.get("content", "")
        key_points = subj_data.get("key_points", [])
        formulas = subj_data.get("formulas", [])
        equations = subj_data.get("equations", [])
        common_mistakes = subj_data.get("common_mistakes", [])
        practice_guide = subj_data.get("practice_guide", "")

        # 科目标题
        if topic:
            lines.append(f"### {label}：{topic}")
        else:
            lines.append(f"### {label}")
        lines.append("")

        # 正文内容（概念复习）
        if content:
            lines.append("**概念复习**")
            lines.append("")
            formatted = format_content_paragraphs(content)
            lines.append(sanitize_content(formatted))
            lines.append("")

        # 公式
        if formulas:
            lines.append(f"**{meta['formula_label']}**")
            lines.append("")
            for idx, f in enumerate(formulas, 1):
                lines.append(f"{idx}. {sanitize_content(f)}")
            lines.append("")

        # 方程式（化学专用）
        if equations:
            lines.append("**化学方程式**")
            lines.append("")
            for idx, eq in enumerate(equations, 1):
                lines.append(f"{idx}. {sanitize_content(eq)}")
            lines.append("")

        # 关键要点
        if key_points:
            lines.append("**关键要点**")
            lines.append("")
            for idx, kp in enumerate(key_points, 1):
                lines.append(f"{idx}. {sanitize_content(kp)}")
            lines.append("")

        # 作业练习指导
        if practice_guide:
            lines.append("**作业练习指导**")
            lines.append("")
            lines.append(sanitize_content(practice_guide))
            lines.append("")

        # 易错提醒
        if common_mistakes:
            lines.append("**易错提醒**")
            lines.append("")
            for idx, cm in enumerate(common_mistakes, 1):
                lines.append(f"{idx}. {sanitize_content(cm)}")
            lines.append("")

    lines.append("---")
    lines.append("")
    return "\n".join(lines)


def build_summary_section(day):
    """构建每日学习总结"""
    lines = []
    lines.append("## 💪 每日学习总结")
    lines.append("")
    lines.append(f"> {ENCOURAGEMENT[(day - 1) % 7]}")
    lines.append("")
    lines.append("---")
    lines.append("")
    return "\n".join(lines)


def build_school_hw_section(day, study_data):
    """构建学校作业板块（表格形式）"""
    lines = []
    key = str(day)
    d = study_data.get(key, {})
    hw = d.get("school_hw", {})

    if not hw:
        return ""

    lines.append("## 📋 今日学校作业（主线任务）")
    lines.append("")

    subj_labels = {
        "chemistry": "⚗️ 化学",
        "math": "🔢 数学",
        "chinese": "📝 语文",
        "english": "🔤 英语",
        "biology": "🧬 生物",
    }

    lines.append("| 科目 | 今日任务 |")
    lines.append("|------|---------|")

    for subj in ["chemistry", "math", "chinese", "english", "biology"]:
        if subj in hw:
            label = subj_labels.get(subj, subj)
            task = hw[subj].replace("|", "\\|").replace("\n", " ")
            lines.append(f"| {label} | {task} |")

    lines.append("")
    lines.append("---")
    lines.append("")
    return "\n".join(lines)


def build_day_markdown(day, study_data, poetry_data, vocab_data):
    """为单天构建完整Markdown内容"""
    date_str, weekday = get_date_info(day, study_data)
    lines = []

    # 研学外出日标记
    is_study_tour = study_data.get(str(day), {}).get("study_tour", False)
    tour_suffix = "（研学外出日）" if is_study_tour else ""

    # 1. 页面标题
    lines.append(f"# 申奇峰暑假学习 · Day{day}（{date_str} {weekday}）{tour_suffix}")
    lines.append("")

    # 2. 学校作业板块（最前面）
    lines.append(build_school_hw_section(day, study_data))

    # 3. 今日学习内容（从 daily_learning 拉取）
    lines.append(build_daily_learning_section(day, study_data))

    # 4. 英语词汇
    lines.append(build_vocab_section(day, vocab_data))

    # 5. 语文古诗文
    lines.append(build_poetry_section(day, poetry_data))

    # 6. 每日学习总结
    lines.append(build_summary_section(day))

    return "\n".join(lines)


# ==================== PDF 生成 ====================
def convert_md_to_pdf(md_path, pdf_path):
    """调用 md_to_pdf.py 将 Markdown 转为 PDF"""
    cmd = ["python3", MD_TO_PDF, md_path, pdf_path]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        print(f"[ERROR] md_to_pdf failed for {md_path}")
        print(f"  stderr: {result.stderr[:500]}")
        return False
    return True


# ==================== 主流程 ====================
def main():
    parser = argparse.ArgumentParser(
        description="申奇峰暑假学习计划 - 任意Day范围学习内容PDF生成"
    )
    parser.add_argument(
        "--start", type=int, default=1,
        help="起始Day编号（默认1）"
    )
    parser.add_argument(
        "--end", type=int, default=7,
        help="结束Day编号（默认7）"
    )
    args = parser.parse_args()

    start_day = args.start
    end_day = args.end

    if start_day < 1 or end_day < 1 or start_day > end_day:
        print(f"[ERROR] Invalid day range: start={start_day}, end={end_day}")
        sys.exit(1)

    days = list(range(start_day, end_day + 1))

    # 计算输出目录
    output_dir = get_week_dir(start_day)
    os.makedirs(output_dir, exist_ok=True)

    # 加载数据
    print("[INFO] Loading JSON data files...")
    study_data, poetry_data, vocab_data = load_all_data()
    print(f"  study_data: {len(study_data)} days")
    print(f"  poetry_data: {len(poetry_data)} poems")
    print(f"  vocab_data: {len(vocab_data)} days")
    print(f"  Day range: Day{start_day}-Day{end_day}")
    print(f"  Output dir: {output_dir}")
    print()

    # 生成每天的MD和PDF
    success_count = 0
    fail_count = 0
    results = []

    for day in days:
        print(f"\n{'='*50}")
        print(f"[INFO] Processing Day{day}...")

        # 生成Markdown
        md_content = build_day_markdown(day, study_data, poetry_data, vocab_data)
        md_filename = f"Day{day}_学习内容.md"
        pdf_filename = f"Day{day}_学习内容.pdf"
        md_path = os.path.join(output_dir, md_filename)
        pdf_path = os.path.join(output_dir, pdf_filename)

        # 写入MD文件
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)
        md_size = len(md_content)
        print(f"  MD written: {md_path} ({md_size} chars)")

        # 转PDF
        if convert_md_to_pdf(md_path, pdf_path):
            pdf_size = os.path.getsize(pdf_path)
            print(f"  PDF created: {pdf_path} ({pdf_size:,} bytes)")
            success_count += 1
            results.append({"day": day, "status": "ok", "md_size": md_size, "pdf_size": pdf_size})
        else:
            fail_count += 1
            results.append({"day": day, "status": "fail", "md_size": md_size, "pdf_size": 0})

    print(f"\n{'='*50}")
    print(f"[DONE] Success: {success_count}/{len(days)}, Failed: {fail_count}/{len(days)}")
    print(f"Output directory: {output_dir}")

    # 列出生成的文件
    print("\n[FILES]")
    for f in sorted(os.listdir(output_dir)):
        if f.startswith("Day") and (f.endswith(".pdf") or f.endswith(".md")):
            fpath = os.path.join(output_dir, f)
            fsize = os.path.getsize(fpath)
            print(f"  {f} ({fsize:,} bytes)")

    return success_count, fail_count, results


if __name__ == "__main__":
    success, fail, results = main()
    if fail > 0:
        sys.exit(1)
    else:
        sys.exit(0)
