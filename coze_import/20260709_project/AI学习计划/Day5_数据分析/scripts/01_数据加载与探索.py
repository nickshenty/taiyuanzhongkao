#!/usr/bin/env python3
"""
Day5 - 脚本01：数据加载与探索
用pandas加载CSV，进行基础数据探索
运行方式：python3 01_数据加载与探索.py
"""

import pandas as pd
import os

# ===== 1. 加载数据 =====
data_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "普惠金融贷款数据_2024-2026.csv")
print(f"📂 加载数据文件: {os.path.basename(data_file)}")

df = pd.read_csv(data_file, encoding="utf-8-sig")
print(f"✅ 成功加载 {len(df)} 条记录，{len(df.columns)} 个字段\n")

# ===== 2. 查看数据概览 =====
print("=" * 60)
print("【1】数据前5行预览")
print("=" * 60)
print(df.head().to_string(index=False))

# ===== 3. 数据基本信息 =====
print(f"\n{'=' * 60}")
print("【2】数据基本信息")
print("=" * 60)
print(f"总记录数: {len(df)}")
print(f"字段列表: {list(df.columns)}")
print(f"\n各字段类型:")
print(df.dtypes)

# ===== 4. 基础统计 =====
print(f"\n{'=' * 60}")
print("【3】数值字段统计")
print("=" * 60)
numeric_cols = ["贷款金额(万元)", "贷款利率(%)", "贷款期限(月)", "贷款余额(万元)", "逾期天数", "客户年龄", "年营收(万元)"]
print(df[numeric_cols].describe().round(2).to_string())

# ===== 5. 分类字段分布 =====
print(f"\n{'=' * 60}")
print("【4】分类字段分布")
print("=" * 60)

for col in ["行业分类", "贷款类型", "所属支行", "担保方式", "风险等级"]:
    print(f"\n--- {col} ---")
    counts = df[col].value_counts()
    for val, cnt in counts.items():
        pct = cnt / len(df) * 100
        bar = "█" * int(pct / 2)
        print(f"  {val:10s}: {cnt:3d}户 ({pct:5.1f}%) {bar}")

# ===== 6. 简单分析 =====
print(f"\n{'=' * 60}")
print("【5】关键业务指标")
print("=" * 60)

total_amount = df["贷款金额(万元)"].sum()
total_balance = df["贷款余额(万元)"].sum()
avg_rate = df["贷款利率(%)"].mean()
avg_amount = df["贷款金额(万元)"].mean()
overdue_count = len(df[df["逾期天数"] > 0])
overdue_rate = overdue_count / len(df) * 100

print(f"贷款总额: {total_amount:,.2f} 万元")
print(f"贷款余额: {total_balance:,.2f} 万元")
print(f"平均贷款金额: {avg_amount:,.2f} 万元")
print(f"平均利率: {avg_rate:.2f}%")
print(f"逾期客户数: {overdue_count} 户")
print(f"逾期率: {overdue_rate:.1f}%")

# ===== 7. 分支行对比 =====
print(f"\n{'=' * 60}")
print("【6】各支行贷款规模对比")
print("=" * 60)

branch_stats = df.groupby("所属支行").agg(
    客户数=("客户编号", "count"),
    贷款总额=("贷款金额(万元)", "sum"),
    平均利率=("贷款利率(%)", "mean"),
    逾期户数=("逾期天数", lambda x: (x > 0).sum())
).round(2)
print(branch_stats.to_string())

# ===== 8. 行业分布 =====
print(f"\n{'=' * 60}")
print("【7】各行业贷款情况")
print("=" * 60)

industry_stats = df.groupby("行业分类").agg(
    客户数=("客户编号", "count"),
    贷款总额=("贷款金额(万元)", "sum"),
    平均金额=("贷款金额(万元)", "mean")
).round(2).sort_values("贷款总额", ascending=False)
print(industry_stats.to_string())

print(f"\n{'=' * 60}")
print("✅ 数据探索完成！")
print("下一步：运行 02_AI客户画像分析.py 体验AI分析")
print("=" * 60)
