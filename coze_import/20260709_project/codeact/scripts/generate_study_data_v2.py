#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成学校作业驱动的 study_data.json v2

核心变更：
- 新增 school_hw 字段，每日五科学校作业任务
- main_subject/science_subject 标题改为学校作业主题
- 保留 english/chinese/reading/tests 字段保持推送脚本兼容
"""

import json
import datetime as dt
from pathlib import Path

BASE = Path("/app/data/所有对话/主对话")
SCRIPTS = BASE / "codeact" / "scripts"

# ═══════════════════════════════════════════════
# 学校作业进度表
# ═══════════════════════════════════════════════

# 化学18份巩固训练 (每3天1份，2天做+1天间隔)
CHEM_PAPERS = [
    # (编号, 起始日, 结束日, 主题)
    ("1-1", "7/8", "7/9", "物质分类、胶体、离子方程式、氧化还原反应"),
    ("1-2", "7/11", "7/12", "电解质与非电解质、离子共存、氧化还原"),
    ("2-1", "7/14", "7/15", "钠的化合物(Na₂O/Na₂O₂/Na₂CO₃/NaHCO₃)、氯气"),
    ("2-2", "7/17", "7/18", "钠的实验操作、钠的化合物性质综合"),
    ("3-1", "7/20", "7/21", "金属材料、铁及其化合物"),
    ("3-2", "7/23", "7/24", "铝、氧化铝、铝盐、金属材料综合"),
    ("4-1", "7/26", "7/27", "化学用语、原子结构、同位素"),
    ("4-2", "7/29", "7/30", "微粒结构示意图、元素周期表与周期律"),
    ("5-1", "8/1", "8/2", "硅及其化合物、化学与生活"),
    ("5-2", "8/4", "8/5", "硅单质及化合物、硅酸盐材料"),
    ("6-1", "8/7", "8/8", "化学能与电能（原电池原理与应用）"),
    ("6-2", "8/10", "8/11", "化学电源、金属腐蚀与防护"),
    ("7-1", "8/13", "8/14", "化学反应与能量（反应热、焓变）"),
    ("7-2", "8/16", "8/17", "化学反应速率与化学平衡"),
    ("8-1", "8/19", "8/20", "有机化合物基础（甲烷、乙烯、苯）"),
    ("8-2", "8/22", "8/23", "乙醇、乙酸、基本营养物质"),
    ("9-1", "8/25", "8/26", "化学综合复习（无机部分）"),
    ("9-2", "8/28", "8/28", "化学综合复习（有机+实验部分）"),
]

# 数学5个专题 (每周1个)
MATH_TOPICS = [
    (1, "平面向量", "向量的概念与线性运算、数量积、向量应用"),
    (2, "立体几何位置关系", "线面/面面平行与垂直的判定与性质"),
    (3, "立体几何角与距离", "线面角、二面角、点到面的距离计算"),
    (4, "统计与概率", "随机抽样、用样本估计总体、概率计算"),
    (5, "空间向量", "空间向量及其运算、空间向量在立体几何中的应用"),
]

# 语文3套组合练习
CHINESE_SETS = [
    (1, "组合练习(一)", "诗歌用典理论 + 古诗杨万里《喜雨》"),
    (2, "组合练习(二)", "古代车战制度 + 古诗韩愈《汴州乱》"),
    (3, "组合练习(三)", "文学类阅读李娟《属于我的马》"),
]

# 英语7份阅读试卷
ENGLISH_PAPERS = [
    (1, "试卷1", "纽约旧货店 + 芬兰驯鹿"),
    (2, "试卷2", "成吉思汗公园 + 伦敦书店"),
    (3, "试卷3", "教育网站 + 世界新年传统"),
    (4, "试卷4", "巴黎一日游 + 烹饪学位"),
    (5, "试卷5", "综合阅读训练（上）"),
    (6, "试卷6", "综合阅读训练（下）"),
    (7, "试卷7", "综合阅读训练（终）"),
]

# 生物进度
BIO_PROGRESS = [
    # (周, 任务, 详情)
    (1, "选必一第1章", "内环境与稳态：细胞生活的环境、内环境成分与理化性质、稳态"),
    (2, "选必一第2章", "神经调节：神经调节的结构基础、神经冲动的产生与传导、神经系统的分级调节"),
    (2, "第1章素养测评", "选必一第1章内环境与稳态 100分闭卷测评"),
    (3, "第2章素养测评", "选必一第2章神经调节 100分闭卷测评"),
    (3, "必修二开始", "必修二遗传与进化：遗传因子的发现（孟德尔杂交实验）"),
    (4, "必修二继续", "基因与染色体的关系（减数分裂、基因在染色体上）"),
    (5, "必修二继续", "基因的本质（DNA是主要遗传物质、DNA分子结构）"),
    (5, "综合测评1", "必修二遗传与进化综合素能测评1（100分）"),
    (6, "必修二继续", "基因的表达、基因突变及其他变异"),
    (6, "综合测评2", "必修二遗传与进化综合测评2 全书综合（100分）"),
    (7, "全面复习", "选必一+必修二全面复习"),
    (8, "查漏补缺", "重点知识点强化记忆"),
]

# ═══════════════════════════════════════════════
# 辅助函数
# ═══════════════════════════════════════════════

def date_to_day(date_str):
    """将 7/8 格式转为 datetime"""
    return dt.date(2026, int(date_str.split("/")[0]), int(date_str.split("/")[1]))

def get_week_number(day_num):
    """Day编号转周次 (Day1-7=周1, Day8-14=周2, ...)"""
    return (day_num - 1) // 7 + 1

def find_chem_paper(day_date):
    """找到当天的化学巩固训练"""
    for num, start, end, topic in CHEM_PAPERS:
        start_d = date_to_day(start)
        end_d = date_to_day(end)
        if start_d <= day_date <= end_d:
            return (num, topic, True)  # 正式做
        # 检查是否是前一天或后一天（间隔日）
        prev_day = day_date - dt.timedelta(days=1)
        next_day = day_date + dt.timedelta(days=1)
        if prev_day == end_d:
            return (num, topic + "（昨日完成，今日复习错题）", False)
    return None

def get_math_topic(week):
    """获取数学专题"""
    if week <= 5:
        return MATH_TOPICS[week - 1]
    else:
        return (week, "复习整理", f"5个专题综合复习（第{week-5}轮）")

def get_chinese_task(week):
    """获取语文作业"""
    if week <= 3:
        return CHINESE_SETS[week - 1]
    return None

def get_english_task(week):
    """获取英语试卷"""
    if week <= 7:
        # 前几周每周1-2份
        if week == 1:
            return [(1, "试卷1", "纽约旧货店+芬兰驯鹿"), (2, "试卷2", "成吉思汗公园+伦敦书店")]
        elif week <= 4:
            return [ENGLISH_PAPERS[week + 1]]
        elif week == 5:
            return [ENGLISH_PAPERS[4], ENGLISH_PAPERS[6]]
        else:
            return [ENGLISH_PAPERS[week - 1]]
    return []

def get_bio_task(week):
    """获取生物进度"""
    tasks = []
    for w, task, detail in BIO_PROGRESS:
        if w == week:
            tasks.append((task, detail))
    return tasks

# ═══════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════

def main():
    # 加载原始 study_data.json
    with open(SCRIPTS / "study_data.json", "r", encoding="utf-8") as f:
        study_data = json.load(f)

    PLAN_START = dt.date(2026, 7, 6)  # Day 1 = 7/6

    for day_str, day_data in study_data.items():
        day_num = int(day_str)
        day_date = dt.date.fromisoformat(day_data["date"])
        week = get_week_number(day_num)

        # === 学校作业 ===
        school_hw = {}

        # 化学
        chem = find_chem_paper(day_date)
        if chem:
            num, topic, is_active = chem
            if is_active:
                school_hw["chemistry"] = f"巩固{num}（正式）：{topic}"
            else:
                school_hw["chemistry"] = f"巩固{num}（复习）：{topic}"
        else:
            # 检查是否是预习日（明日有化学作业）
            tomorrow = day_date + dt.timedelta(days=1)
            chem_tomorrow = find_chem_paper(tomorrow)
            if chem_tomorrow:
                school_hw["chemistry"] = f"巩固{chem_tomorrow[0]}预习：{chem_tomorrow[1]}"
            else:
                # 检查是否是间隔日
                yesterday = day_date - dt.timedelta(days=1)
                chem_yesterday = find_chem_paper(yesterday)
                if chem_yesterday:
                    school_hw["chemistry"] = f"巩固{chem_yesterday[0]}收尾+错题整理"
                else:
                    school_hw["chemistry"] = "化学自主复习"

        # 数学
        math_num, math_topic, math_detail = get_math_topic(week)
        if week <= 5:
            school_hw["math"] = f"专题{math_num}：{math_topic} - {math_detail}"
        else:
            school_hw["math"] = f"{math_topic}：{math_detail}"

        # 语文
        chinese = get_chinese_task(week)
        if chinese:
            num, name, detail = chinese
            school_hw["chinese"] = f"{name}：{detail}"
        else:
            school_hw["chinese"] = "自由阅读 + 古诗文复习"

        # 英语
        english_tasks = get_english_task(week)
        if english_tasks:
            parts = [f"{t[1]}（{t[2]}）" for t in english_tasks]
            school_hw["english"] = " + ".join(parts)
        else:
            school_hw["english"] = "词汇巩固 + 阅读训练"

        # 生物
        bio_tasks = get_bio_task(week)
        if bio_tasks:
            parts = [f"{t[0]}：{t[1]}" for t in bio_tasks]
            school_hw["biology"] = " | ".join(parts)
        else:
            school_hw["biology"] = "生物自主复习"

        day_data["school_hw"] = school_hw

        # === 更新 main_subject 和 science_subject ===
        # main_subject: 周一/三/五/日=数学, 周二/四/六=物理
        # 但现在数学由学校作业驱动，物理纯补充
        ms = day_data.get("main_subject", {})
        ss = day_data.get("science_subject", {})

        # 数学日：更新主题为学校作业专题
        if ms.get("name") == "数学":
            ms["topic"] = f"{school_hw['math']}（孔子知识点：{ms.get('topic','')}）"
        elif ms.get("name") == "物理":
            ms["topic"] = f"物理补充：{ms.get('topic','')}"

        # 化学日：更新主题为学校巩固训练
        if ss.get("name") == "化学":
            ss["topic"] = f"{school_hw['chemistry']}（孔子知识点：{ss.get('topic','')}）"
        elif ss.get("name") == "生物":
            ss["topic"] = f"{school_hw['biology']}（孔子知识点：{ss.get('topic','')}）"

        # === 更新 reading ===
        reading_parts = []
        if week <= 3 and chinese:
            reading_parts.append(f"语文{chinese[1]}")
        en_tasks = get_english_task(week)
        if en_tasks:
            reading_parts.append(f"英语{en_tasks[0][1]}阅读")
        day_data["reading"] = " / ".join(reading_parts) if reading_parts else "自由阅读 + 古诗文复习"

        # === 更新 tests ===
        tests = day_data.get("tests", [])
        # 添加学校作业相关测试
        if chem and chem[2]:  # 化学巩固训练正式日
            tests.append(f"化学巩固{chem[0]}检测")
        # 生物测评周
        for w, task, detail in BIO_PROGRESS:
            if w == week and "测评" in task:
                tests.append(f"生物{task}")

        day_data["tests"] = tests

    # 保存
    output_path = SCRIPTS / "study_data.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(study_data, f, ensure_ascii=False, indent=2)

    print(f"[OK] study_data.json 已更新，{len(study_data)} 天数据")
    
    # 验证：打印第一周
    print("\n=== 第一周预览 ===")
    for i in range(1, 8):
        d = study_data[str(i)]
        print(f"\nDay{i} ({d['date']} {d['weekday']})")
        print(f"  学校作业:")
        for subj, task in d["school_hw"].items():
            print(f"    {subj}: {task[:60]}")
        print(f"  tests: {d.get('tests', [])}")

if __name__ == "__main__":
    main()
