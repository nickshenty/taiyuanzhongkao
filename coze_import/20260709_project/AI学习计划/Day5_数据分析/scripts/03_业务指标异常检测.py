#!/usr/bin/env python3
"""
Day5 - 脚本03：业务指标异常检测
用pandas检测异常数据，再用AI解读异常原因
运行方式：python3 03_业务指标异常检测.py
"""

import pandas as pd
import os
import sys

# ===== 配置 =====
MODEL = "qwen2.5:7b"
data_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "普惠金融贷款数据_2024-2026.csv")

def call_ollama(prompt, model=MODEL):
    """调用本地Ollama模型"""
    try:
        import ollama
        response = ollama.chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            options={"temperature": 0.3}
        )
        return response["message"]["content"]
    except ImportError:
        print("❌ ollama库未安装，请运行: pip3 install ollama")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 调用模型失败: {e}")
        print("   请确认Ollama已启动: ollama serve")
        sys.exit(1)

# ===== 1. 加载数据 =====
df = pd.read_csv(data_file, encoding="utf-8-sig")
df["放款日期"] = pd.to_datetime(df["放款日期"])
print(f"📂 已加载 {len(df)} 条数据\n")

# ===== 2. 异常检测1：利率异常 =====
print("=" * 60)
print("【检测1】贷款利率异常检测")
print("=" * 60)

rate_mean = df["贷款利率(%)"].mean()
rate_std = df["贷款利率(%)"].std()
upper = rate_mean + 2 * rate_std  # 均值+2倍标准差
lower = rate_mean - 2 * rate_std

rate_anomaly = df[(df["贷款利率(%)"] > upper) | (df["贷款利率(%)"] < lower)]
print(f"平均利率: {rate_mean:.2f}% (±{rate_std:.2f}%)")
print(f"异常阈值: < {lower:.2f}% 或 > {upper:.2f}%")
print(f"发现利率异常: {len(rate_anomaly)} 户")
if len(rate_anomaly) > 0:
    for _, row in rate_anomaly.head(5).iterrows():
        print(f"  - {row['客户编号']}: 利率{row['贷款利率(%)']}%, 类型{row['贷款类型']}, 金额{row['贷款金额(万元)']}万元")

# ===== 3. 异常检测2：金额异常 =====
print(f"\n{'=' * 60}")
print("【检测2】贷款金额异常检测")
print("=" * 60)

amount_q1 = df["贷款金额(万元)"].quantile(0.25)
amount_q3 = df["贷款金额(万元)"].quantile(0.75)
iqr = amount_q3 - amount_q1
amount_upper = amount_q3 + 1.5 * iqr  # IQR方法
amount_lower = amount_q1 - 1.5 * iqr

amount_anomaly = df[df["贷款金额(万元)"] > amount_upper]
print(f"金额四分位: Q1={amount_q1:.1f}, Q3={amount_q3:.1f}, IQR={iqr:.1f}")
print(f"异常阈值: > {amount_upper:.1f}万元")
print(f"发现金额异常: {len(amount_anomaly)} 户")
if len(amount_anomaly) > 0:
    for _, row in amount_anomaly.head(5).iterrows():
        print(f"  - {row['客户编号']}: 金额{row['贷款金额(万元)']}万元, 行业{row['行业分类']}, 类型{row['贷款类型']}")

# ===== 4. 异常检测3：逾期与担保方式关联 =====
print(f"\n{'=' * 60}")
print("【检测3】逾期客户担保方式异常分析")
print("=" * 60)

overdue_df = df[df["逾期天数"] > 0]
guaranty_overdue = overdue_df["担保方式"].value_counts()
guaranty_total = df["担保方式"].value_counts()

print("担保方式 vs 逾期率：")
for g in guaranty_total.index:
    total = guaranty_total[g]
    overdue = guaranty_overdue.get(g, 0)
    rate = overdue / total * 100 if total > 0 else 0
    flag = " ⚠️" if rate > 20 else ""
    print(f"  {g:6s}: {overdue}/{total}户 逾期率 {rate:.1f}%{flag}")

# ===== 5. 异常检测4：集中度风险 =====
print(f"\n{'=' * 60}")
print("【检测4】行业集中度风险检测")
print("=" * 60)

industry_concentration = df.groupby("行业分类")["贷款金额(万元)"].sum().sort_values(ascending=False)
total_amount = industry_concentration.sum()
print("行业贷款集中度：")
for ind, amt in industry_concentration.items():
    pct = amt / total_amount * 100
    flag = " ⚠️集中度过高" if pct > 25 else ""
    print(f"  {ind:10s}: {amt:8.1f}万元 ({pct:5.1f}%){flag}")

# ===== 6. 用AI解读异常 =====
print(f"\n{'=' * 60}")
print("【AI解读】异常检测结果综合分析")
print("=" * 60)

anomaly_summary = f"""
普惠金融贷款异常检测结果：
1. 利率异常：发现{len(rate_anomaly)}户利率偏离均值2倍标准差以上（均值{rate_mean:.2f}%）
2. 金额异常：发现{len(amount_anomaly)}户贷款金额超过IQR上限（{amount_upper:.1f}万元）
3. 担保方式与逾期关系：
   - 信用类逾期率：{guaranty_overdue.get('信用', 0)}/{guaranty_total.get('信用', 1)} = {guaranty_overdue.get('信用', 0)/max(guaranty_total.get('信用', 1),1)*100:.1f}%
   - 抵押类逾期率：{guaranty_overdue.get('抵押', 0)}/{guaranty_total.get('抵押', 1)} = {guaranty_overdue.get('抵押', 0)/max(guaranty_total.get('抵押', 1),1)*100:.1f}%
4. 行业集中度：{industry_concentration.index[0]}占比{industry_concentration.iloc[0]/total_amount*100:.1f}%
5. 逾期总额：{overdue_df['贷款余额(万元)'].sum():.1f}万元
"""

prompt = f"""你是建设银行风险管理部门分析师。请解读以下异常检测结果，给出专业判断。

{anomaly_summary}

请分析：
1. 哪些异常最需要关注？优先级排序
2. 可能的风险传导路径
3. 建议采取的风控措施（具体可操作）

300字以内，专业简洁。"""

print("正在调用AI分析...\n")
result = call_ollama(prompt)
print(f"🤖 AI风险解读：\n")
print(result)

print(f"\n{'=' * 60}")
print("✅ 异常检测完成！")
print("=" * 60)
