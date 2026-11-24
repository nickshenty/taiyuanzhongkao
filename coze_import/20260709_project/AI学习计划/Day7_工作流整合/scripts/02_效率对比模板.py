#!/usr/bin/env python3
"""
效率对比记录工具
================
记录传统方式 vs AI辅助方式的任务效率对比，生成统计报告。

功能：
    1. 添加记录 — 输入任务名、传统耗时、AI耗时、质量评分、模型名
    2. 查看记录 — 查看所有已记录的效率对比数据
    3. 生成报告 — 自动统计总节省时间、平均节省比例、高价值场景排名

使用方式：
    python3 02_效率对比模板.py

数据存储：
    JSON 格式，保存在脚本同目录下的 efficiency_records.json

前置条件：
    无需 Ollama，纯本地数据处理
"""

import json
import os
from datetime import datetime

# ============================================================
# 配置
# ============================================================
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "efficiency_records.json")


# ============================================================
# 数据读写
# ============================================================
def load_records():
    """加载已有记录"""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def save_records(records):
    """保存记录"""
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)


# ============================================================
# 功能一：添加记录
# ============================================================
def add_record():
    """添加一条效率对比记录"""
    print("\n" + "─" * 50)
    print("  📝 添加效率对比记录")
    print("─" * 50)

    task = input("  任务名称（如：普惠金融通报起草）: ").strip()
    if not task:
        print("  ⚠️ 任务名称不能为空")
        return

    # 任务分类
    categories = ["普惠金融", "个贷业务", "乡村金融", "管理效率", "知识管理", "研究学习", "其他"]
    print(f"\n  任务分类：")
    for i, cat in enumerate(categories, 1):
        print(f"    {i}. {cat}")
    cat_choice = input("  选择分类（输入数字，默认7）: ").strip()
    try:
        category = categories[int(cat_choice) - 1] if cat_choice else "其他"
    except (ValueError, IndexError):
        category = "其他"

    # 传统方式耗时
    traditional_time = input_float("  传统方式耗时（分钟）: ")
    if traditional_time is None:
        return

    # AI辅助耗时
    ai_time = input_float("  AI辅助耗时（分钟）: ")
    if ai_time is None:
        return

    # 质量评分
    quality = input_float("  AI输出质量评分（1-10分）: ", min_val=1, max_val=10)
    if quality is None:
        return

    # 使用模型
    models = ["glm4:9b", "deepseek-r1:7b", "qwen2.5:7b", "gemma3:12b", "Apple Intelligence", "其他"]
    print(f"\n  使用模型/工具：")
    for i, m in enumerate(models, 1):
        print(f"    {i}. {m}")
    model_choice = input("  选择模型（输入数字，默认1）: ").strip()
    try:
        model = models[int(model_choice) - 1] if model_choice else "glm4:9b"
    except (ValueError, IndexError):
        model = "glm4:9b"
    if model == "其他":
        model = input("  请输入模型/工具名称: ").strip()

    # 备注
    note = input("  备注（可选，如：需人工修改数据和措辞）: ").strip()

    # 计算节省
    saved_time = traditional_time - ai_time
    saved_pct = (saved_time / traditional_time * 100) if traditional_time > 0 else 0

    record = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "task": task,
        "category": category,
        "traditional_min": traditional_time,
        "ai_min": ai_time,
        "saved_min": round(saved_time, 1),
        "saved_pct": round(saved_pct, 1),
        "quality": quality,
        "model": model,
        "note": note,
    }

    records = load_records()
    records.append(record)
    save_records(records)

    print(f"\n  ✅ 记录已保存！")
    print(f"     任务：{task}")
    print(f"     节省时间：{saved_time:.1f} 分钟（{saved_pct:.1f}%）")


def input_float(prompt, min_val=0, max_val=None):
    """安全读取浮点数输入"""
    while True:
        raw = input(prompt).strip()
        if not raw:
            return None
        try:
            val = float(raw)
            if val < min_val:
                print(f"  ⚠️ 数值不能小于 {min_val}")
                continue
            if max_val and val > max_val:
                print(f"  ⚠️ 数值不能大于 {max_val}")
                continue
            return val
        except ValueError:
            print(f"  ⚠️ 请输入有效数字")


# ============================================================
# 功能二：查看记录
# ============================================================
def view_records():
    """查看所有记录"""
    records = load_records()

    print("\n" + "─" * 50)
    print("  📋 效率对比记录")
    print("─" * 50)

    if not records:
        print("  暂无记录。请先添加记录。")
        return

    print(f"\n  共 {len(records)} 条记录\n")
    print(f"  {'#':<3} {'日期':<12} {'任务':<20} {'分类':<8} {'传统':>6} {'AI':>6} {'节省':>6} {'%':>6} {'评分':>4} {'模型':<16}")
    print(f"  {'─'*3} {'─'*12} {'─'*20} {'─'*8} {'─'*6} {'─'*6} {'─'*6} {'─'*6} {'─'*4} {'─'*16}")

    for i, r in enumerate(records, 1):
        task_short = r["task"][:18] + ".." if len(r["task"]) > 20 else r["task"]
        print(
            f"  {i:<3} {r['date']:<12} {task_short:<20} {r['category']:<8} "
            f"{r['traditional_min']:>6.0f} {r['ai_min']:>6.0f} {r['saved_min']:>6.0f} "
            f"{r['saved_pct']:>5.1f}% {r['quality']:>4.0f} {r['model']:<16}"
        )
        if r.get("note"):
            print(f"      └ 备注：{r['note']}")

    # 小计
    total_traditional = sum(r["traditional_min"] for r in records)
    total_ai = sum(r["ai_min"] for r in records)
    total_saved = total_traditional - total_ai
    avg_pct = (total_saved / total_traditional * 100) if total_traditional > 0 else 0

    print(f"\n  📊 小计：")
    print(f"     传统方式总耗时：{total_traditional:.0f} 分钟（{total_traditional/60:.1f} 小时）")
    print(f"     AI辅助总耗时：  {total_ai:.0f} 分钟（{total_ai/60:.1f} 小时）")
    print(f"     总节省时间：    {total_saved:.0f} 分钟（{total_saved/60:.1f} 小时）")
    print(f"     平均节省比例：  {avg_pct:.1f}%")


# ============================================================
# 功能三：生成报告
# ============================================================
def generate_report():
    """生成效率对比分析报告"""
    records = load_records()

    print("\n" + "─" * 50)
    print("  📊 效率对比分析报告")
    print("─" * 50)

    if not records:
        print("  暂无记录，无法生成报告。")
        return

    # 总体统计
    total_traditional = sum(r["traditional_min"] for r in records)
    total_ai = sum(r["ai_min"] for r in records)
    total_saved = total_traditional - total_ai
    avg_pct = (total_saved / total_traditional * 100) if total_traditional > 0 else 0
    avg_quality = sum(r["quality"] for r in records) / len(records)

    report_lines = []
    report_lines.append("# AI效率对比分析报告")
    report_lines.append(f"\n> 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}")
    report_lines.append(f"> 记录总数：{len(records)} 条")
    report_lines.append("\n---\n")

    # 一、总体概况
    report_lines.append("## 一、总体概况\n")
    report_lines.append(f"| 指标 | 数值 |")
    report_lines.append(f"|------|------|")
    report_lines.append(f"| 记录任务数 | {len(records)} 个 |")
    report_lines.append(f"| 传统方式总耗时 | {total_traditional:.0f} 分钟（{total_traditional/60:.1f} 小时） |")
    report_lines.append(f"| AI辅助总耗时 | {total_ai:.0f} 分钟（{total_ai/60:.1f} 小时） |")
    report_lines.append(f"| **总节省时间** | **{total_saved:.0f} 分钟（{total_saved/60:.1f} 小时）** |")
    report_lines.append(f"| 平均节省比例 | {avg_pct:.1f}% |")
    report_lines.append(f"| 平均质量评分 | {avg_quality:.1f}/10 |")
    report_lines.append("")

    # 二、按分类统计
    report_lines.append("## 二、按业务分类统计\n")
    categories = {}
    for r in records:
        cat = r["category"]
        if cat not in categories:
            categories[cat] = {"count": 0, "trad": 0, "ai": 0, "saved": 0, "quality": 0}
        categories[cat]["count"] += 1
        categories[cat]["trad"] += r["traditional_min"]
        categories[cat]["ai"] += r["ai_min"]
        categories[cat]["saved"] += r["saved_min"]
        categories[cat]["quality"] += r["quality"]

    report_lines.append("| 分类 | 任务数 | 传统耗时 | AI耗时 | 节省时间 | 节省比例 | 平均质量 |")
    report_lines.append("|------|--------|---------|--------|---------|---------|---------|")
    for cat, data in sorted(categories.items(), key=lambda x: x[1]["saved"], reverse=True):
        pct = (data["saved"] / data["trad"] * 100) if data["trad"] > 0 else 0
        avg_q = data["quality"] / data["count"]
        report_lines.append(
            f"| {cat} | {data['count']} | {data['trad']:.0f}分 | {data['ai']:.0f}分 | "
            f"{data['saved']:.0f}分 | {pct:.1f}% | {avg_q:.1f} |"
        )
    report_lines.append("")

    # 三、高价值场景排名（按节省时间排序）
    report_lines.append("## 三、高价值AI场景排名（按节省时间排序）\n")
    sorted_by_saved = sorted(records, key=lambda x: x["saved_min"], reverse=True)
    report_lines.append("| 排名 | 任务 | 节省时间 | 节省比例 | 质量评分 | 使用模型 |")
    report_lines.append("|------|------|---------|---------|---------|---------|")
    for i, r in enumerate(sorted_by_saved, 1):
        report_lines.append(
            f"| {i} | {r['task']} | {r['saved_min']:.0f}分钟 | {r['saved_pct']:.1f}% | "
            f"{r['quality']:.0f}/10 | {r['model']} |"
        )
    report_lines.append("")

    # 四、模型使用统计
    report_lines.append("## 四、模型使用统计\n")
    model_stats = {}
    for r in records:
        m = r["model"]
        if m not in model_stats:
            model_stats[m] = {"count": 0, "saved": 0, "quality": 0}
        model_stats[m]["count"] += 1
        model_stats[m]["saved"] += r["saved_min"]
        model_stats[m]["quality"] += r["quality"]

    report_lines.append("| 模型/工具 | 使用次数 | 总节省时间 | 平均质量评分 |")
    report_lines.append("|----------|---------|-----------|-------------|")
    for m, data in sorted(model_stats.items(), key=lambda x: x[1]["saved"], reverse=True):
        avg_q = data["quality"] / data["count"]
        report_lines.append(f"| {m} | {data['count']} | {data['saved']:.0f}分钟 | {avg_q:.1f}/10 |")
    report_lines.append("")

    # 五、详细记录
    report_lines.append("## 五、详细记录\n")
    for i, r in enumerate(records, 1):
        report_lines.append(f"### {i}. {r['task']}")
        report_lines.append(f"- **日期**：{r['date']}")
        report_lines.append(f"- **分类**：{r['category']}")
        report_lines.append(f"- **传统耗时**：{r['traditional_min']:.0f} 分钟")
        report_lines.append(f"- **AI耗时**：{r['ai_min']:.0f} 分钟")
        report_lines.append(f"- **节省**：{r['saved_min']:.0f} 分钟（{r['saved_pct']:.1f}%）")
        report_lines.append(f"- **质量评分**：{r['quality']:.0f}/10")
        report_lines.append(f"- **使用模型**：{r['model']}")
        if r.get("note"):
            report_lines.append(f"- **备注**：{r['note']}")
        report_lines.append("")

    # 六、优化建议
    report_lines.append("## 六、优化建议\n")
    best_cat = max(categories.items(), key=lambda x: x[1]["saved"])
    worst_quality = min(records, key=lambda x: x["quality"])
    report_lines.append(f"1. **高价值场景**：{best_cat[0]}类任务节省时间最多（{best_cat[1]['saved']:.0f}分钟），建议优先使用AI")
    report_lines.append(f"2. **质量待提升**：\"{worst_quality['task']}\"质量评分最低（{worst_quality['quality']:.0f}/10），")
    report_lines.append(f"   建议优化Prompt或更换模型（当前：{worst_quality['model']}）")
    report_lines.append(f"3. **持续记录**：保持每次使用AI后记录效率数据，积累2周后可做更深入分析")
    report_lines.append(f"4. **模型优化**：对比不同模型在同一任务上的表现，找到最优搭配")
    report_lines.append("")

    report_text = "\n".join(report_lines)

    # 打印到终端
    print(report_text)

    # 保存报告
    report_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "output")
    os.makedirs(report_dir, exist_ok=True)
    report_file = os.path.join(report_dir, f"效率对比报告_{datetime.now().strftime('%Y%m%d')}.md")
    with open(report_file, "w", encoding="utf-8") as f:
        f.write(report_text)
    print(f"\n  📁 报告已保存：{report_file}")


# ============================================================
# 功能四：预置示例数据
# ============================================================
def load_demo_data():
    """加载演示数据，方便用户快速体验"""
    records = load_records()
    if records:
        confirm = input(f"\n  已有 {len(records)} 条记录，是否追加演示数据？(y/n): ").strip().lower()
        if confirm != "y":
            return

    demo_records = [
        {
            "date": "2026-07-04",
            "task": "普惠金融业务通报起草",
            "category": "普惠金融",
            "traditional_min": 90,
            "ai_min": 25,
            "saved_min": 65,
            "saved_pct": 72.2,
            "quality": 8.5,
            "model": "glm4:9b",
            "note": "Day4测试结果，格式标准，需人工修改数据和措辞",
        },
        {
            "date": "2026-07-06",
            "task": "监管文件要点提炼",
            "category": "知识管理",
            "traditional_min": 40,
            "ai_min": 8,
            "saved_min": 32,
            "saved_pct": 80.0,
            "quality": 9,
            "model": "qwen2.5:7b",
            "note": "Day6练习，AI提炼全面，偶有遗漏需人工复核",
        },
        {
            "date": "2026-07-06",
            "task": "政策新旧版本对比",
            "category": "知识管理",
            "traditional_min": 50,
            "ai_min": 12,
            "saved_min": 38,
            "saved_pct": 76.0,
            "quality": 9,
            "model": "qwen2.5:7b",
            "note": "Day6练习，AI对比全面，数字变化识别准确",
        },
        {
            "date": "2026-07-06",
            "task": "会议纪要整理",
            "category": "管理效率",
            "traditional_min": 35,
            "ai_min": 10,
            "saved_min": 25,
            "saved_pct": 71.4,
            "quality": 7,
            "model": "glm4:9b",
            "note": "Day6练习，需人工补充决策细节",
        },
        {
            "date": "2026-07-07",
            "task": "邮件润色",
            "category": "管理效率",
            "traditional_min": 10,
            "ai_min": 2,
            "saved_min": 8,
            "saved_pct": 80.0,
            "quality": 8,
            "model": "Apple Intelligence",
            "note": "系统级工具，一键完成",
        },
        {
            "date": "2026-07-07",
            "task": "业务数据分析报告",
            "category": "普惠金融",
            "traditional_min": 60,
            "ai_min": 20,
            "saved_min": 40,
            "saved_pct": 66.7,
            "quality": 8,
            "model": "deepseek-r1:7b",
            "note": "Day7演示，推理深度好，格式需调整",
        },
    ]

    records = load_records()
    records.extend(demo_records)
    save_records(records)
    print(f"\n  ✅ 已加载 {len(demo_records)} 条演示数据！")
    print(f"     当前共有 {len(records)} 条记录。")


# ============================================================
# 主菜单
# ============================================================
def main():
    while True:
        print("\n" + "╔" + "═" * 50 + "╗")
        print("║" + "  效率对比记录工具".center(34) + "║")
        print("║" + f"  数据文件：{os.path.basename(DATA_FILE)}".center(34) + "║")
        print("╚" + "═" * 50 + "╝")

        records = load_records()
        print(f"  当前记录数：{len(records)} 条")

        print(f"\n  1. 📝 添加记录")
        print(f"  2. 📋 查看记录")
        print(f"  3. 📊 生成报告")
        print(f"  4. 📦 加载演示数据")
        print(f"  0. 退出")

        choice = input("\n  请选择（0-4）: ").strip()

        if choice == "1":
            add_record()
        elif choice == "2":
            view_records()
        elif choice == "3":
            generate_report()
        elif choice == "4":
            load_demo_data()
        elif choice == "0":
            print("\n  再见！记得每次用AI后记录效率数据 💪\n")
            break
        else:
            print("  ⚠️ 无效选择，请重新输入")


if __name__ == "__main__":
    main()
