#!/usr/bin/env python3
"""
申奇峰暑假学习计划 - 理科重分配脚本
研学期间(Day33-38)理科暂停，通过压缩复习/练习天数把部分内容拉到研学前。
从 study_data.json.bak 恢复原始数据，重新分配后输出到 study_data.json。
"""
import json
import copy
import os
import re
import sys
import asyncio

# ===== Paths =====
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BAK_FILE = os.path.join(SCRIPT_DIR, "study_data.json.bak")
BAK2_FILE = os.path.join(SCRIPT_DIR, "study_data.json.bak2")
OUT_FILE = os.path.join(SCRIPT_DIR, "study_data.json")

# ===== Constants =====
STUDY_TOUR_DAYS = set(range(33, 39))  # Day33-38
SCIENCE_SUBJECTS = ["math", "physics", "chemistry", "biology"]
PAUSE_PLACEHOLDER = {
    "topic": "研学期间暂停",
    "content": "研学外出期间，理科学习暂停。请利用碎片时间复习英语词汇和语文古诗文。",
    "key_points": [],
    "common_mistakes": [],
}

# Calendar-based tests (tied to weekday, not content)
CALENDAR_TESTS = {
    "英语词汇速测 21:30",
    "数学周中测试 21:30",
    "物理周末测试 21:30",
    "本周学习复盘 19:00（含古诗文默写检测）",
    "化学/生物小测 21:30",
}


def load_data(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def deep_copy(obj):
    return copy.deepcopy(obj)


# ===== Merge helpers =====

def merge_lists_dedup(lists):
    """Merge multiple lists, deduplicating by value (string comparison)."""
    seen = set()
    result = []
    for lst in lists:
        if not lst:
            continue
        for item in lst:
            key = item if isinstance(item, str) else json.dumps(item, ensure_ascii=False)
            if key not in seen:
                seen.add(key)
                result.append(item)
    return result


def merge_subjects(orig_data, day_nums, subject_key, merged_topic=None):
    """
    Merge daily_learning[subject_key] from multiple orig days.
    Returns a merged dict with: topic, content, key_points, common_mistakes, and any extra fields (formulas, equations, practice_guide).
    """
    items = []
    for dn in day_nums:
        d = orig_data[str(dn)]
        sub = d.get("daily_learning", {}).get(subject_key, {})
        if sub:
            items.append(sub)

    if not items:
        return {}
    if len(items) == 1:
        return deep_copy(items[0])

    merged = {}
    # Topic: use merged_topic if provided, else join
    if merged_topic:
        merged["topic"] = merged_topic
    else:
        merged["topic"] = "；".join(it.get("topic", "") for it in items if it.get("topic"))

    # Content: concatenate
    contents = [it.get("content", "") for it in items if it.get("content")]
    merged["content"] = "\n\n".join(contents)

    # key_points: merge and dedup
    kp_lists = [it.get("key_points", []) for it in items]
    merged["key_points"] = merge_lists_dedup(kp_lists)

    # common_mistakes: merge and dedup
    cm_lists = [it.get("common_mistakes", []) for it in items]
    merged["common_mistakes"] = merge_lists_dedup(cm_lists)

    # Extra fields: formulas, equations, practice_guide
    for field in ["formulas", "equations", "practice_guide"]:
        vals = [it.get(field) for it in items if it.get(field)]
        if vals:
            if isinstance(vals[0], list):
                merged[field] = merge_lists_dedup(vals)
            elif isinstance(vals[0], str):
                merged[field] = "；".join(vals)
            else:
                merged[field] = vals[0]

    return merged


def merge_school_hw(orig_data, day_nums, subject_key, separator=" + "):
    """Merge school_hw[subject_key] strings from multiple orig days, deduplicating identical strings."""
    seen = set()
    parts = []
    for dn in day_nums:
        d = orig_data[str(dn)]
        hw = d.get("school_hw", {}).get(subject_key, "")
        if hw and hw not in seen:
            seen.add(hw)
            parts.append(hw)
    return separator.join(parts) if parts else ""


def get_science_tests(tests):
    """Filter out science-specific tests (non-calendar tests)."""
    return [t for t in tests if t not in CALENDAR_TESTS]


def get_calendar_tests(tests):
    """Get only calendar-based tests."""
    return [t for t in tests if t in CALENDAR_TESTS]


# ===== 孔子知识点 extraction =====

def extract_kzjj_from_topic(topic):
    """Extract 孔子知识点 text from a topic string like '...（孔子知识点：XXX）'"""
    if not topic:
        return None
    m = re.search(r'（孔子知识点：(.+?)）', topic)
    if m:
        return m.group(1)
    return None


def strip_kzjj_from_topic(topic):
    """Remove the 孔子知识点 suffix from a topic string."""
    if not topic:
        return topic
    return re.sub(r'（孔子知识点：.+?）', '', topic).strip()


def build_main_subject(orig_day_data, new_math_hw, new_physics_hw, source_physics_day_data, source_math_day_nums):
    """
    Build main_subject for a new day.
    - On math days (MS=数学): topic = math_hw + (孔子知识点：XXX), key_points = orig 孔子知识点 key_points
    - On physics days (MS=物理): topic = physics_hw, key_points = physics key_points from source
    """
    orig_ms = orig_day_data.get("main_subject", {})
    ms_name = orig_ms.get("name", "")
    ms = {"name": ms_name}

    if ms_name == "数学":
        kzjj = extract_kzjj_from_topic(orig_ms.get("topic", ""))
        if kzjj:
            ms["topic"] = new_math_hw + f"（孔子知识点：{kzjj}）"
        else:
            ms["topic"] = new_math_hw
        ms["key_points"] = orig_ms.get("key_points", "")
    elif ms_name == "物理":
        # On physics days, topic is the physics hw description
        ms["topic"] = new_physics_hw
        # key_points: try to get from source physics day's main_subject
        if source_physics_day_data:
            src_ms = source_physics_day_data.get("main_subject", {})
            if src_ms.get("name") == "物理":
                ms["key_points"] = src_ms.get("key_points", "")
            else:
                # Source day was a math day; construct from daily_learning physics key_points
                phys_kp = source_physics_day_data.get("daily_learning", {}).get("physics", {}).get("key_points", [])
                ms["key_points"] = "、".join(phys_kp[:3]) if phys_kp else ""
        else:
            ms["key_points"] = orig_ms.get("key_points", "")
    else:
        ms["topic"] = orig_ms.get("topic", "")
        ms["key_points"] = orig_ms.get("key_points", "")

    return ms


def build_science_subject(orig_day_data, new_science_hw):
    """
    Build science_subject for a new day.
    SS is always 化学 or 生物, with 孔子知识点 in topic.
    """
    orig_ss = orig_day_data.get("science_subject", {})
    ss_name = orig_ss.get("name", "")
    kzjj = extract_kzjj_from_topic(orig_ss.get("topic", ""))

    ss = {"name": ss_name}
    if kzjj:
        ss["topic"] = new_science_hw + f"（孔子知识点：{kzjj}）"
    else:
        ss["topic"] = new_science_hw
    ss["key_points"] = orig_ss.get("key_points", "")
    return ss


# ===== Subject mappings =====

def build_physics_mapping():
    """
    Returns dict: new_day -> list of orig_day_nums (1=direct, 2+=merge)
    Based on the precise mapping in the task description.
    """
    mapping = {}
    # Pre-tour (Day3-32)
    mapping[3] = [3]
    mapping[4] = [4]
    mapping[5] = [5, 6]      # merge: 平抛运动计算与综合练习
    mapping[6] = [7]
    mapping[7] = [8]
    mapping[8] = [9]
    mapping[9] = [10]
    mapping[10] = [11]
    mapping[11] = [12]
    mapping[12] = [13]
    mapping[13] = [14]
    mapping[14] = [15, 16]   # merge: 皮带传动与综合练习
    mapping[15] = [17]
    mapping[16] = [18]
    mapping[17] = [19]
    mapping[18] = [20]
    mapping[19] = [21]
    mapping[20] = [22]
    mapping[21] = [23]
    mapping[22] = [24]
    mapping[23] = [25, 26]   # merge: 天体运动计算与综合练习
    mapping[24] = [27]
    mapping[25] = [28]
    mapping[26] = [29]
    mapping[27] = [30]
    mapping[28] = [31]
    mapping[29] = [32]
    mapping[30] = [33]       # 研学前启动
    mapping[31] = [34]
    mapping[32] = [35]
    # Day33-38: study tour (no mapping)
    # Post-tour (Day39-57)
    mapping[39] = [36]
    mapping[40] = [37]
    mapping[41] = [38, 39]   # merge: 功能关系与机械能守恒实验
    mapping[42] = [40]
    mapping[43] = [41]
    mapping[44] = [42]
    mapping[45] = [43]
    mapping[46] = [44]
    mapping[47] = [45]
    mapping[48] = [46]
    mapping[49] = [47]
    mapping[50] = [48]
    mapping[51] = [49]
    mapping[52] = [50]
    mapping[53] = [51]
    mapping[54] = [52]
    mapping[55] = [53]
    mapping[56] = [54, 55]   # merge: 天体与机械能综合复习
    mapping[57] = [56, 57]   # merge: 动量与全册模拟
    return mapping


def build_math_mapping():
    """
    Math: 55 orig days -> 49 days (compress 6).
    Compressions:
    1. merge orig Day20+21 (立体几何专题复习上下)
    2. merge orig Day27+28 (统计概率专题复习上下)
    3. merge orig Day39+40 (五专题综合训练上下)
    4. merge orig Day41+42 (综合模拟训练上下)
    5. merge orig Day55+56+57 (暑假总结最后3天->1天)
    """
    mapping = {}
    # Pre-tour (Day3-32 = 30 slots)
    mapping[3] = [3]
    mapping[4] = [4]
    mapping[5] = [5]
    mapping[6] = [6]
    mapping[7] = [7]
    mapping[8] = [8]
    mapping[9] = [9]
    mapping[10] = [10]
    mapping[11] = [11]
    mapping[12] = [12]
    mapping[13] = [13]
    mapping[14] = [14]
    mapping[15] = [15]
    mapping[16] = [16]
    mapping[17] = [17]
    mapping[18] = [18]
    mapping[19] = [19]
    mapping[20] = [20, 21]   # merge: 立体几何专题复习上下
    mapping[21] = [22]
    mapping[22] = [23]
    mapping[23] = [24]
    mapping[24] = [25]
    mapping[25] = [26]
    mapping[26] = [27, 28]   # merge: 统计概率专题复习上下
    mapping[27] = [29]
    mapping[28] = [30]
    mapping[29] = [31]
    mapping[30] = [32]
    mapping[31] = [33]       # pulled to pre-tour
    mapping[32] = [34]       # pulled to pre-tour
    # Day33-38: study tour
    # Post-tour (Day39-57 = 19 slots)
    mapping[39] = [35]
    mapping[40] = [36]
    mapping[41] = [37]
    mapping[42] = [38]
    mapping[43] = [39, 40]   # merge: 五专题综合训练上下
    mapping[44] = [41, 42]   # merge: 综合模拟训练上下
    mapping[45] = [43]
    mapping[46] = [44]
    mapping[47] = [45]
    mapping[48] = [46]
    mapping[49] = [47]
    mapping[50] = [48]
    mapping[51] = [49]
    mapping[52] = [50]
    mapping[53] = [51]
    mapping[54] = [52]
    mapping[55] = [53]
    mapping[56] = [54]
    mapping[57] = [55, 56, 57]  # merge: 暑假总结最后3天
    return mapping


def build_chemistry_mapping():
    """
    Chemistry: 55 orig days -> 49 days (compress 6).
    Compressions:
    1. merge orig Day30+31 (巩固5-2正式+复习)
    2. merge orig Day19+20 (巩固3-2正式+复习)
    3. merge orig Day42+43 (巩固7-2正式+复习)
    4. merge orig Day46+47 (巩固8-1正式(苯)+复习)
    5. merge orig Day53+54 (巩固9-2预习+正式)
    6. merge orig Day55+56 (化学暑假总复习+学习方法总结)
    """
    mapping = {}
    # Pre-tour (Day3-32 = 30 slots)
    mapping[3] = [3]
    mapping[4] = [4]
    mapping[5] = [5]
    mapping[6] = [6]
    mapping[7] = [7]
    mapping[8] = [8]
    mapping[9] = [9]
    mapping[10] = [10]
    mapping[11] = [11]
    mapping[12] = [12]
    mapping[13] = [13]
    mapping[14] = [14]
    mapping[15] = [15]
    mapping[16] = [16]
    mapping[17] = [17]
    mapping[18] = [18]
    mapping[19] = [19, 20]   # merge: 巩固3-2正式(铝盐)+复习
    mapping[20] = [21]
    mapping[21] = [22]
    mapping[22] = [23]
    mapping[23] = [24]
    mapping[24] = [25]
    mapping[25] = [26]
    mapping[26] = [27]
    mapping[27] = [28]
    mapping[28] = [29]
    mapping[29] = [30, 31]   # merge: 巩固5-2正式(硅酸盐)+复习
    mapping[30] = [32]
    mapping[31] = [33]       # pulled to pre-tour
    mapping[32] = [34]
    # Day33-38: study tour
    # Post-tour (Day39-57 = 19 slots)
    mapping[39] = [35]
    mapping[40] = [36]
    mapping[41] = [37]
    mapping[42] = [38]
    mapping[43] = [39]
    mapping[44] = [40]
    mapping[45] = [41]
    mapping[46] = [42, 43]   # merge: 巩固7-2正式(化学平衡)+复习
    mapping[47] = [44]
    mapping[48] = [45]
    mapping[49] = [46, 47]   # merge: 巩固8-1正式(苯)+复习
    mapping[50] = [48]
    mapping[51] = [49]
    mapping[52] = [50]
    mapping[53] = [51]
    mapping[54] = [52]
    mapping[55] = [53, 54]   # merge: 巩固9-2预习+正式
    mapping[56] = [55, 56]   # merge: 化学暑假总复习+学习方法总结
    mapping[57] = [57]
    return mapping


def build_biology_mapping():
    """
    Biology: 55 orig days -> 49 days (compress 6).
    Compressions:
    1. merge orig Day6+7 (内环境与稳态自测+复习总结)
    2. merge orig Day13+14 (神经调节自测+复习)
    3. merge orig Day25+26 (基因本质综合复习+综合测评1准备)
    4. merge orig Day48+49 (查漏补缺:薄弱知识点+知识网络整合)
    5. merge orig Day51+52 (查漏补缺:遗传学综合+稳态调节综合)
    6. merge orig Day55+56 (生物暑假总复习+学习方法总结)
    """
    mapping = {}
    # Pre-tour (Day3-32 = 30 slots)
    mapping[3] = [3]
    mapping[4] = [4]
    mapping[5] = [5]
    mapping[6] = [6, 7]      # merge: 自测+复习总结
    mapping[7] = [8]
    mapping[8] = [9]
    mapping[9] = [10]
    mapping[10] = [11]
    mapping[11] = [12]
    mapping[12] = [13, 14]   # merge: 神经调节自测+复习
    mapping[13] = [15]
    mapping[14] = [16]
    mapping[15] = [17]
    mapping[16] = [18]
    mapping[17] = [19]
    mapping[18] = [20]
    mapping[19] = [21]
    mapping[20] = [22]
    mapping[21] = [23]
    mapping[22] = [24]
    mapping[23] = [25, 26]   # merge: 基因本质综合复习+综合测评1准备
    mapping[24] = [27]
    mapping[25] = [28]
    mapping[26] = [29]
    mapping[27] = [30]
    mapping[28] = [31]
    mapping[29] = [32]
    mapping[30] = [33]       # pulled to pre-tour (综合测评2)
    mapping[31] = [34]
    mapping[32] = [35]
    # Day33-38: study tour
    # Post-tour (Day39-57 = 19 slots)
    mapping[39] = [36]
    mapping[40] = [37]
    mapping[41] = [38]
    mapping[42] = [39]
    mapping[43] = [40]
    mapping[44] = [41]
    mapping[45] = [42]
    mapping[46] = [43]
    mapping[47] = [44]
    mapping[48] = [45]
    mapping[49] = [46]
    mapping[50] = [47]
    mapping[51] = [48, 49]   # merge: 查漏补缺薄弱+知识网络整合
    mapping[52] = [50]
    mapping[53] = [51, 52]   # merge: 查漏补缺遗传学综合+稳态调节综合
    mapping[54] = [53]
    mapping[55] = [54]
    mapping[56] = [55, 56]   # merge: 生物暑假总复习+学习方法总结
    mapping[57] = [57]
    return mapping


# ===== Physics school_hw compression =====

def build_physics_hw_mapping():
    """
    Physics school_hw follows the same day mapping as daily_learning.
    For merged days (计算题+综合练习), combine the hw strings.
    The mapping is the same as physics daily_learning mapping.
    """
    return build_physics_mapping()


# ===== Main transformation =====

def transform(orig_data):
    """Transform original data according to the reallocation plan."""
    new_data = {}

    phys_map = build_physics_mapping()
    math_map = build_math_mapping()
    chem_map = build_chemistry_mapping()
    bio_map = build_biology_mapping()

    for day_num in range(1, 58):
        day_key = str(day_num)
        orig_day = orig_data[day_key]

        # Start with a deep copy of the orig day (to preserve date, weekday, english, chinese, reading, etc.)
        new_day = deep_copy(orig_day)

        # Day1-2: completely unchanged
        if day_num <= 2:
            new_data[day_key] = new_day
            continue

        # Study tour days (Day33-38): pause science
        if day_num in STUDY_TOUR_DAYS:
            # Keep english, chinese, reading unchanged (already in new_day)
            # Set science daily_learning to pause placeholder
            dl = new_day.get("daily_learning", {})
            for subj in SCIENCE_SUBJECTS:
                if subj == "math":
                    dl["math"] = {
                        "topic": "研学期间暂停",
                        "content": "研学外出期间，理科学习暂停。请利用碎片时间复习英语词汇和语文古诗文。",
                        "key_points": [],
                        "common_mistakes": [],
                    }
                elif subj == "physics":
                    dl["physics"] = {
                        "topic": "研学期间暂停",
                        "content": "研学外出期间，理科学习暂停。请利用碎片时间复习英语词汇和语文古诗文。",
                        "key_points": [],
                        "common_mistakes": [],
                    }
                elif subj == "chemistry":
                    dl["chemistry"] = {
                        "topic": "研学期间暂停",
                        "content": "研学外出期间，理科学习暂停。请利用碎片时间复习英语词汇和语文古诗文。",
                        "key_points": [],
                        "common_mistakes": [],
                    }
                elif subj == "biology":
                    dl["biology"] = {
                        "topic": "研学期间暂停",
                        "content": "研学外出期间，理科学习暂停。请利用碎片时间复习英语词汇和语文古诗文。",
                        "key_points": [],
                        "common_mistakes": [],
                    }
            new_day["daily_learning"] = dl

            # school_hw: science fields -> "研学期间暂停"
            hw = new_day.get("school_hw", {})
            for subj in SCIENCE_SUBJECTS:
                hw[subj] = "研学期间暂停"
            new_day["school_hw"] = hw

            # main_subject and science_subject
            new_day["main_subject"] = {
                "name": "研学外出",
                "topic": "研学期间碎片学习",
            }
            new_day["science_subject"] = {
                "name": "研学暂停",
                "topic": "研学期间暂停理科学习",
            }

            # tests: cleared
            new_day["tests"] = []

            # study_tour
            new_day["study_tour"] = True

            new_data[day_key] = new_day
            continue

        # Non-study-tour, non-Day1-2 days: apply science mappings
        new_day["study_tour"] = False

        # --- daily_learning science subjects ---
        dl = new_day.get("daily_learning", {})

        # Math
        if day_num in math_map:
            math_days = math_map[day_num]
            if len(math_days) == 1:
                dl["math"] = deep_copy(orig_data[str(math_days[0])]["daily_learning"]["math"])
            else:
                dl["math"] = merge_subjects(orig_data, math_days, "math")

        # Physics
        if day_num in phys_map:
            phys_days = phys_map[day_num]
            if len(phys_days) == 1:
                dl["physics"] = deep_copy(orig_data[str(phys_days[0])]["daily_learning"]["physics"])
            else:
                # Custom merged topics for physics
                merged_topics = {
                    5: "平抛运动计算与综合练习",
                    14: "皮带传动与综合练习",
                    23: "天体运动计算与综合练习",
                    41: "功能关系与机械能守恒实验",
                    56: "天体运动与机械能守恒综合复习",
                    57: "动量守恒与全册模拟综合复习",
                }
                mt = merged_topics.get(day_num)
                dl["physics"] = merge_subjects(orig_data, phys_days, "physics", merged_topic=mt)

        # Chemistry
        if day_num in chem_map:
            chem_days = chem_map[day_num]
            if len(chem_days) == 1:
                dl["chemistry"] = deep_copy(orig_data[str(chem_days[0])]["daily_learning"]["chemistry"])
            else:
                dl["chemistry"] = merge_subjects(orig_data, chem_days, "chemistry")

        # Biology
        if day_num in bio_map:
            bio_days = bio_map[day_num]
            if len(bio_days) == 1:
                dl["biology"] = deep_copy(orig_data[str(bio_days[0])]["daily_learning"]["biology"])
            else:
                dl["biology"] = merge_subjects(orig_data, bio_days, "biology")

        new_day["daily_learning"] = dl

        # --- school_hw science subjects ---
        hw = new_day.get("school_hw", {})

        # Math hw
        if day_num in math_map:
            math_days = math_map[day_num]
            hw["math"] = merge_school_hw(orig_data, math_days, "math")

        # Physics hw
        if day_num in phys_map:
            phys_days = phys_map[day_num]
            hw["physics"] = merge_school_hw(orig_data, phys_days, "physics")

        # Chemistry hw
        if day_num in chem_map:
            chem_days = chem_map[day_num]
            hw["chemistry"] = merge_school_hw(orig_data, chem_days, "chemistry")

        # Biology hw
        if day_num in bio_map:
            bio_days = bio_map[day_num]
            hw["biology"] = merge_school_hw(orig_data, bio_days, "biology")

        new_day["school_hw"] = hw

        # --- main_subject and science_subject ---
        # Get new hw strings
        new_math_hw = hw.get("math", "")
        new_physics_hw = hw.get("physics", "")
        if not new_physics_hw:
            # Day1-2 don't have physics hw, but we're past Day2
            new_physics_hw = ""

        # For physics main_subject, find the source physics day data
        source_physics_data = None
        if day_num in phys_map:
            phys_days = phys_map[day_num]
            source_physics_data = orig_data[str(phys_days[0])]

        new_day["main_subject"] = build_main_subject(
            orig_day, new_math_hw, new_physics_hw, source_physics_data, None
        )

        # science_subject: use 化学 or 生物 hw depending on the calendar day's SS name
        ss_name = orig_day.get("science_subject", {}).get("name", "")
        if ss_name == "化学":
            new_science_hw = hw.get("chemistry", "")
        elif ss_name == "生物":
            new_science_hw = hw.get("biology", "")
        else:
            new_science_hw = ""

        new_day["science_subject"] = build_science_subject(orig_day, new_science_hw)

        # --- tests ---
        # Start with calendar-based tests from the orig calendar day
        cal_tests = get_calendar_tests(orig_day.get("tests", []))
        new_tests = list(cal_tests)

        # Add science-specific tests from source days
        science_test_set = set()
        for subj_name, subj_map in [("math", math_map), ("physics", phys_map),
                                      ("chemistry", chem_map), ("biology", bio_map)]:
            if day_num in subj_map:
                for src_day in subj_map[day_num]:
                    src_tests = get_science_tests(orig_data[str(src_day)].get("tests", []))
                    for t in src_tests:
                        science_test_set.add(t)

        new_tests.extend(sorted(science_test_set))
        new_day["tests"] = new_tests

        new_data[day_key] = new_day

    return new_data


# ===== Validation =====

def validate(orig_data, new_data):
    """Run validation checks and return list of errors."""
    errors = []

    # 1. Day1-2 identical to original
    for i in [1, 2]:
        if json.dumps(new_data[str(i)], ensure_ascii=False) != json.dumps(orig_data[str(i)], ensure_ascii=False):
            errors.append(f"Day{i} differs from original")

    # 2. Total days = 57
    if len(new_data) != 57:
        errors.append(f"Total days = {len(new_data)}, expected 57")

    # 3. Study tour days
    for i in range(33, 39):
        d = new_data[str(i)]
        if not d.get("study_tour"):
            errors.append(f"Day{i} study_tour should be True")
        # Check science paused
        for subj in SCIENCE_SUBJECTS:
            dl_subj = d.get("daily_learning", {}).get(subj, {})
            if dl_subj.get("topic") != "研学期间暂停":
                errors.append(f"Day{i} {subj} topic should be '研学期间暂停', got '{dl_subj.get('topic')}'")
            hw_subj = d.get("school_hw", {}).get(subj, "")
            if hw_subj != "研学期间暂停":
                errors.append(f"Day{i} {subj} hw should be '研学期间暂停'")
        if d.get("tests") != []:
            errors.append(f"Day{i} tests should be empty, got {d.get('tests')}")
        if d.get("main_subject", {}).get("name") != "研学外出":
            errors.append(f"Day{i} main_subject name should be '研学外出'")
        if d.get("science_subject", {}).get("name") != "研学暂停":
            errors.append(f"Day{i} science_subject name should be '研学暂停'")

    # 4. Non-study-tour days study_tour = False
    for i in range(1, 58):
        if i in STUDY_TOUR_DAYS:
            continue
        if new_data[str(i)].get("study_tour") != False:
            errors.append(f"Day{i} study_tour should be False")

    # 5. English/Chinese unchanged on all days
    for i in range(1, 58):
        orig_d = orig_data[str(i)]
        new_d = new_data[str(i)]
        if json.dumps(new_d.get("english"), ensure_ascii=False) != json.dumps(orig_d.get("english"), ensure_ascii=False):
            errors.append(f"Day{i} english changed")
        if json.dumps(new_d.get("chinese"), ensure_ascii=False) != json.dumps(orig_d.get("chinese"), ensure_ascii=False):
            errors.append(f"Day{i} chinese changed")
        if json.dumps(new_d.get("reading"), ensure_ascii=False) != json.dumps(orig_d.get("reading"), ensure_ascii=False):
            errors.append(f"Day{i} reading changed")
        # daily_learning english/chinese unchanged
        if json.dumps(new_d.get("daily_learning", {}).get("english"), ensure_ascii=False) != json.dumps(orig_d.get("daily_learning", {}).get("english"), ensure_ascii=False):
            errors.append(f"Day{i} daily_learning.english changed")
        if json.dumps(new_d.get("daily_learning", {}).get("chinese"), ensure_ascii=False) != json.dumps(orig_d.get("daily_learning", {}).get("chinese"), ensure_ascii=False):
            errors.append(f"Day{i} daily_learning.chinese changed")
        # school_hw english/chinese unchanged
        if new_d.get("school_hw", {}).get("english", "") != orig_d.get("school_hw", {}).get("english", ""):
            errors.append(f"Day{i} school_hw.english changed")
        if new_d.get("school_hw", {}).get("chinese", "") != orig_d.get("school_hw", {}).get("chinese", ""):
            errors.append(f"Day{i} school_hw.chinese changed")
        # date/weekday/day unchanged
        if new_d.get("date") != orig_d.get("date"):
            errors.append(f"Day{i} date changed")
        if new_d.get("weekday") != orig_d.get("weekday"):
            errors.append(f"Day{i} weekday changed")
        if new_d.get("day") != orig_d.get("day"):
            errors.append(f"Day{i} day changed")

    # 6. Physics mapping verification
    phys_map = build_physics_mapping()
    pre_tour_phys = sum(1 for d in range(3, 33) if d in phys_map)
    post_tour_phys = sum(1 for d in range(39, 58) if d in phys_map)
    if pre_tour_phys != 30:
        errors.append(f"Physics pre-tour days = {pre_tour_phys}, expected 30")
    if post_tour_phys != 19:
        errors.append(f"Physics post-tour days = {post_tour_phys}, expected 19")

    # 7. Math mapping verification
    math_map = build_math_mapping()
    pre_tour_math = sum(1 for d in range(3, 33) if d in math_map)
    post_tour_math = sum(1 for d in range(39, 58) if d in math_map)
    if pre_tour_math != 30:
        errors.append(f"Math pre-tour days = {pre_tour_math}, expected 30")
    if post_tour_math != 19:
        errors.append(f"Math post-tour days = {post_tour_math}, expected 19")

    # 8. Chemistry mapping verification
    chem_map = build_chemistry_mapping()
    pre_tour_chem = sum(1 for d in range(3, 33) if d in chem_map)
    post_tour_chem = sum(1 for d in range(39, 58) if d in chem_map)
    if pre_tour_chem != 30:
        errors.append(f"Chemistry pre-tour days = {pre_tour_chem}, expected 30")
    if post_tour_chem != 19:
        errors.append(f"Chemistry post-tour days = {post_tour_chem}, expected 19")

    # 9. Biology mapping verification
    bio_map = build_biology_mapping()
    pre_tour_bio = sum(1 for d in range(3, 33) if d in bio_map)
    post_tour_bio = sum(1 for d in range(39, 58) if d in bio_map)
    if pre_tour_bio != 30:
        errors.append(f"Biology pre-tour days = {pre_tour_bio}, expected 30")
    if post_tour_bio != 19:
        errors.append(f"Biology post-tour days = {post_tour_bio}, expected 19")

    # 10. All science subjects have content (non-empty topic) on non-study-tour days
    for i in range(3, 58):
        if i in STUDY_TOUR_DAYS:
            continue
        d = new_data[str(i)]
        for subj in SCIENCE_SUBJECTS:
            dl_subj = d.get("daily_learning", {}).get(subj, {})
            if not dl_subj.get("topic"):
                errors.append(f"Day{i} {subj} has empty topic")
            # Only check content if the source data had it (not all subjects have content field)
            hw_val = d.get("school_hw", {}).get(subj, "")
            if not hw_val:
                errors.append(f"Day{i} {subj} school_hw is empty")

    return errors


def print_summary(new_data):
    """Print a summary of the new plan for quick verification."""
    print("\n" + "=" * 80)
    print("重分配后的理科内容概览")
    print("=" * 80)

    for i in range(1, 58):
        d = new_data[str(i)]
        date = d.get("date", "")
        wday = d.get("weekday", "")
        st = d.get("study_tour", False)

        if st:
            print(f"Day{i} ({date} {wday}) [研学暂停]")
            continue

        dl = d.get("daily_learning", {})
        math_t = dl.get("math", {}).get("topic", "")[:35]
        phys_t = dl.get("physics", {}).get("topic", "")[:35]
        chem_t = dl.get("chemistry", {}).get("topic", "")[:35]
        bio_t = dl.get("biology", {}).get("topic", "")[:35]

        ms_name = d.get("main_subject", {}).get("name", "")
        ss_name = d.get("science_subject", {}).get("name", "")

        print(f"Day{i} ({date} {wday}) MS={ms_name} SS={ss_name}")
        print(f"  数: {math_t}")
        print(f"  物: {phys_t}")
        print(f"  化: {chem_t}")
        print(f"  生: {bio_t}")


# ===== Main =====

def run_transform():
    """Run the full transformation and return (new_data, errors, orig_data)."""
    print("=== 申奇峰暑假学习计划 - 理科重分配 ===\n")

    # Step 0: Backup current state
    if os.path.exists(OUT_FILE):
        import shutil
        shutil.copy2(OUT_FILE, BAK2_FILE)
        print(f"当前 study_data.json 已备份到 study_data.json.bak2")

    # Step 1: Load original data from backup
    if not os.path.exists(BAK_FILE):
        raise FileNotFoundError(f"备份文件 {BAK_FILE} 不存在!")

    orig_data = load_data(BAK_FILE)
    print(f"已从 {BAK_FILE} 恢复原始数据 ({len(orig_data)} 天)")

    # Step 2: Transform
    print("\n开始重分配...")
    new_data = transform(orig_data)
    print("重分配完成")

    # Step 3: Validate
    print("\n运行验证检查...")
    errors = validate(orig_data, new_data)
    if errors:
        print(f"\n❌ 验证发现 {len(errors)} 个问题:")
        for e in errors:
            print(f"  - {e}")
    else:
        print("✅ 所有验证检查通过!")

    # Step 4: Print summary
    print_summary(new_data)

    # Step 5: Save
    save_data(OUT_FILE, new_data)
    print(f"\n✅ 结果已保存到 {OUT_FILE}")

    # Print mapping verification
    print("\n=== 映射验证 ===")
    for subj, mmap_fn in [("物理", build_physics_mapping), ("数学", build_math_mapping),
                           ("化学", build_chemistry_mapping), ("生物", build_biology_mapping)]:
        m = mmap_fn()
        pre = sum(1 for d in range(3, 33) if d in m)
        post = sum(1 for d in range(39, 58) if d in m)
        total = pre + post
        merges = sum(1 for v in m.values() if len(v) > 1)
        print(f"  {subj}: 研学前={pre}天, 研学后={post}天, 总计={total}天, 合并={merges}处")

    return new_data, errors, orig_data


async def main():
    result_mode = sys.argv[1] if len(sys.argv) > 1 else "notify"

    from codeact_sdk import CodeActSDK
    sdk = CodeActSDK()

    try:
        new_data, errors, orig_data = run_transform()

        if errors:
            msg = f"理科重分配完成但有 {len(errors)} 个验证问题，请检查。\n"
            for e in errors[:10]:
                msg += f"  - {e}\n"
            await sdk.submit_result(
                result_mode="notify",
                status="error",
                message=msg,
                data={"error_count": len(errors)},
            )
        else:
            message = (
                "[主人](at://owner) 申奇峰暑假学习计划理科重分配已完成！\n\n"
                "📋 重分配概要：\n"
                "• 研学期间 Day33-38（8/7-8/12）理科全部暂停，英语语文不变\n"
                "• 物理：压缩4份作业(5天→4天)，研学前30天(作业1-6+作业7前3天)，研学后19天\n"
                "• 数学：合并立体几何/统计概率专题复习、综合训练、暑假总结(55→49天)\n"
                "• 化学：合并6处复习日(55→49天)，原电池应用拉到研学前\n"
                "• 生物：合并6处复习日(55→49天)，综合测评2拉到研学前\n"
                "• Day1-2 完全不变，英语语文全部保持原始内容\n"
                "• study_data.json 已更新，原数据备份在 .bak，当前状态备份在 .bak2"
            )
            await sdk.submit_result(
                result_mode=result_mode if result_mode != "auto" else "notify",
                status="success",
                message=message,
                data={
                    "output_file": OUT_FILE,
                    "backup_file": BAK_FILE,
                    "backup2_file": BAK2_FILE,
                    "total_days": len(new_data),
                    "study_tour_days": list(STUDY_TOUR_DAYS),
                },
            )
    except Exception as e:
        import traceback
        traceback.print_exc()
        await sdk.submit_result(
            result_mode="notify",
            status="error",
            message=f"理科重分配执行失败: {e}",
            data={"error_type": type(e).__name__},
        )


if __name__ == "__main__":
    asyncio.run(main())
