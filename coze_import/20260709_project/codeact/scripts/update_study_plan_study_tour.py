#!/usr/bin/env python3
"""
更新 study_data.json：
- Day33-38（研学期间）：理科暂停，只保留英语和语文
- Day39-57：将原 Day33-52 的理科内容按 Day+6 映射后移
"""

import json
import copy
import os

DATA_FILE = os.path.join(os.path.dirname(__file__), "study_data.json")

# 研学暂停期间的理科占位内容
PAUSED_DAILY_LEARNING = {
    "topic": "研学期间暂停",
    "content": "研学外出期间，理科暂停集中学习，利用碎片时间复习英语词汇和语文古诗文。",
    "key_points": [],
    "formulas": [],
    "common_mistakes": [],
    "practice_guide": "",
}

PAUSED_SCHOOL_HW = "研学期间暂停"

SCIENCE_FIELDS = ["math", "chemistry", "biology", "physics"]


def load_data():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def extract_science_snapshot(day_data):
    """提取某天的理科相关字段快照（深拷贝）"""
    snapshot = {}
    # daily_learning 的理科字段
    snapshot["daily_learning_science"] = {}
    dl = day_data.get("daily_learning", {})
    for field in SCIENCE_FIELDS:
        if field in dl:
            snapshot["daily_learning_science"][field] = copy.deepcopy(dl[field])
    # school_hw 的理科字段
    snapshot["school_hw_science"] = {}
    sh = day_data.get("school_hw", {})
    for field in SCIENCE_FIELDS:
        if field in sh:
            snapshot["school_hw_science"][field] = copy.deepcopy(sh[field])
    # main_subject
    snapshot["main_subject"] = copy.deepcopy(day_data.get("main_subject", {}))
    # science_subject
    snapshot["science_subject"] = copy.deepcopy(day_data.get("science_subject", {}))
    # tests
    snapshot["tests"] = copy.deepcopy(day_data.get("tests", []))
    return snapshot


def apply_science_snapshot(day_data, snapshot):
    """将理科快照应用到某天（只覆盖理科字段）"""
    dl = day_data.get("daily_learning", {})
    for field, value in snapshot["daily_learning_science"].items():
        dl[field] = copy.deepcopy(value)
    day_data["daily_learning"] = dl

    sh = day_data.get("school_hw", {})
    for field, value in snapshot["school_hw_science"].items():
        sh[field] = copy.deepcopy(value)
    day_data["school_hw"] = sh

    day_data["main_subject"] = copy.deepcopy(snapshot["main_subject"])
    day_data["science_subject"] = copy.deepcopy(snapshot["science_subject"])
    day_data["tests"] = copy.deepcopy(snapshot["tests"])


def apply_pause(day_data):
    """将某天设为研学暂停状态（理科部分）"""
    # daily_learning 理科字段
    dl = day_data.get("daily_learning", {})
    for field in SCIENCE_FIELDS:
        if field in dl:
            dl[field] = copy.deepcopy(PAUSED_DAILY_LEARNING)
    day_data["daily_learning"] = dl

    # school_hw 理科字段
    sh = day_data.get("school_hw", {})
    for field in SCIENCE_FIELDS:
        if field in sh:
            sh[field] = PAUSED_SCHOOL_HW
    day_data["school_hw"] = sh

    # main_subject
    ms = day_data.get("main_subject", {})
    ms["name"] = "研学外出"
    ms["topic"] = "研学期间碎片学习"
    day_data["main_subject"] = ms

    # science_subject
    ss = day_data.get("science_subject", {})
    ss["name"] = "研学暂停"
    ss["topic"] = "研学期间暂停理科学习"
    day_data["science_subject"] = ss

    # tests 清空
    day_data["tests"] = []


def main():
    data = load_data()

    # ===== 步骤1: 保存原 Day33-52 的理科快照 =====
    # 映射关系: Day39 ← 原Day33, Day40 ← 原Day34, ..., Day57 ← 原Day51
    # 即: 新Day(33+k+6) ← 原Day(33+k), k=0..19, 即原Day33..Day52
    # Day39 = 原33, Day40 = 原34, ..., Day44 = 原38, Day45 = 原39, ..., Day57 = 原51
    # 原Day52的理科内容映射到Day57? 不对:
    #   Day39 ← 原33 (39 = 33 + 6)
    #   Day40 ← 原34
    #   Day41 ← 原35
    #   Day42 ← 原36
    #   Day43 ← 原37
    #   Day44 ← 原38
    #   Day45 ← 原39
    #   Day46 ← 原40
    #   ...
    #   Day57 ← 原51 (57 = 51 + 6)
    # 所以需要保存原 Day33 到 Day51 的理科快照

    original_snapshots = {}
    for orig_day in range(33, 52):  # 33..51
        original_snapshots[orig_day] = extract_science_snapshot(data[str(orig_day)])

    # 也保存原 Day52-57 的理科快照用于验证对比
    original_52_57 = {}
    for orig_day in range(52, 58):
        original_52_57[orig_day] = extract_science_snapshot(data[str(orig_day)])

    # 保存原 Day1-32 的快照用于验证
    original_1_32 = {}
    for orig_day in range(1, 33):
        original_1_32[orig_day] = extract_science_snapshot(data[str(orig_day)])

    # ===== 步骤2: 修改 Day33-38 为研学暂停 =====
    for day_num in range(33, 39):
        apply_pause(data[str(day_num)])

    # ===== 步骤3: 将原 Day33-51 的理科内容映射到 Day39-57 =====
    # 新 Day = 原 Day + 6
    for orig_day in range(33, 52):  # 原 33..51 → 新 39..57
        new_day = orig_day + 6
        snapshot = original_snapshots[orig_day]
        apply_science_snapshot(data[str(new_day)], snapshot)

    # ===== 步骤4: 保存 =====
    save_data(data)

    # ===== 验证 =====
    print("=" * 60)
    print("验证结果")
    print("=" * 60)

    # 验证 Day1-32 未变
    print("\n--- Day1-32 未变验证 ---")
    unchanged_count = 0
    for day_num in range(1, 33):
        day_data = data[str(day_num)]
        orig_snapshot = original_1_32[day_num]
        current_snapshot = extract_science_snapshot(day_data)
        if current_snapshot == orig_snapshot:
            unchanged_count += 1
        else:
            print(f"  ⚠️ Day{day_num} 内容已变化！")
    print(f"  Day1-32 共 {unchanged_count}/32 天未变 ✓")

    # 验证 Day33-38 理科暂停
    print("\n--- Day33-38 理科暂停验证 ---")
    for day_num in range(33, 39):
        day_data = data[str(day_num)]
        dl = day_data.get("daily_learning", {})
        sh = day_data.get("school_hw", {})
        ms = day_data.get("main_subject", {})
        ss = day_data.get("science_subject", {})
        tests = day_data.get("tests", [])

        all_paused = True
        for field in SCIENCE_FIELDS:
            if field in dl:
                if dl[field].get("topic") != "研学期间暂停":
                    all_paused = False
            if field in sh:
                if sh[field] != "研学期间暂停":
                    all_paused = False

        ms_ok = ms.get("name") == "研学外出" and ms.get("topic") == "研学期间碎片学习"
        ss_ok = ss.get("name") == "研学暂停" and ss.get("topic") == "研学期间暂停理科学习"
        tests_ok = tests == []

        status = "✓" if (all_paused and ms_ok and ss_ok and tests_ok) else "✗"
        print(f"  Day{day_num}: 理科暂停={all_paused}, main_subject={ms_ok}, science_subject={ss_ok}, tests空={tests_ok} {status}")

    # 验证 Day39-57 理科内容来源
    print("\n--- Day39-57 理科内容来源验证 ---")
    for orig_day in range(33, 52):
        new_day = orig_day + 6
        day_data = data[str(new_day)]
        current_snapshot = extract_science_snapshot(day_data)
        orig_snapshot = original_snapshots[orig_day]
        match = current_snapshot == orig_snapshot
        status = "✓" if match else "✗"
        ms_name = day_data.get("main_subject", {}).get("name", "N/A")
        ss_name = day_data.get("science_subject", {}).get("name", "N/A")
        print(f"  Day{new_day} ← 原 Day{orig_day}: {status}  (main={ms_name}, sci={ss_name})")

    # 验证 Day33-38 英语语文保持原样
    print("\n--- Day33-38 英语/语文保持原样验证 ---")
    data_bak = None
    bak_path = os.path.join(os.path.dirname(__file__), "study_data.json.bak")
    with open(bak_path, "r", encoding="utf-8") as f:
        data_bak = json.load(f)

    for day_num in range(33, 39):
        current = data[str(day_num)]
        original = data_bak[str(day_num)]
        dl_en = current.get("daily_learning", {}).get("english", {})
        dl_cn = current.get("daily_learning", {}).get("chinese", {})
        orig_dl_en = original.get("daily_learning", {}).get("english", {})
        orig_dl_cn = original.get("daily_learning", {}).get("chinese", {})
        sh_en = current.get("school_hw", {}).get("english", "")
        sh_cn = current.get("school_hw", {}).get("chinese", "")
        orig_sh_en = original.get("school_hw", {}).get("english", "")
        orig_sh_cn = original.get("school_hw", {}).get("chinese", "")

        en_ok = dl_en == orig_dl_en and sh_en == orig_sh_en
        cn_ok = dl_cn == orig_dl_cn and sh_cn == orig_sh_cn
        status = "✓" if (en_ok and cn_ok) else "✗"
        print(f"  Day{day_num}: english={en_ok}, chinese={cn_ok} {status}")

    print("\n" + "=" * 60)
    print("更新完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
