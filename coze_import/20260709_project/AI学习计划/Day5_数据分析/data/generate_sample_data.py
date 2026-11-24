#!/usr/bin/env python3
"""
生成模拟普惠金融贷款数据（脱敏/虚构）
用途：AI学习Day5数据分析练习
注意：所有数据均为虚构，仅用于学习目的
"""

import csv
import random
import os
from datetime import datetime, timedelta

random.seed(42)  # 固定随机种子保证可复现

# ===== 基础数据池 =====
INDUSTRIES = ["批发零售", "餐饮服务", "制造业", "农林牧渔", "物流运输", 
              "建筑装饰", "信息技术", "居民服务", "教育文化", "住宿餐饮"]

LOAN_TYPES = ["小微贷", "农户贷", "个体工商户贷", "科技信用贷", "流动资金贷款"]

BRANCHES = ["朔城支行", "平鲁支行", "山阴支行", "怀仁支行", "应县支行"]

GUARANTY = ["信用", "保证", "抵押", "质押"]

RISK_LEVELS = ["正常", "关注", "次级", "可疑"]

MANAGERS = ["张明", "李红", "王强", "赵芳", "刘伟", "陈静"]

# ===== 生成数据 =====
data = []
start_date = datetime(2024, 1, 1)
end_date = datetime(2026, 6, 30)

for i in range(1, 81):  # 80条记录
    cust_id = f"PH{2024}{i:04d}"
    cust_name = f"朔州XX商贸有限公司{i}" if random.random() > 0.3 else f"个体户王{chr(0x4e00 + i)}"
    
    industry = random.choice(INDUSTRIES)
    loan_type = random.choice(LOAN_TYPES)
    branch = random.choice(BRANCHES)
    manager = random.choice(MANAGERS)
    
    # 贷款金额：小微贷偏小，流动资金偏大
    if loan_type == "小微贷":
        amount = round(random.uniform(10, 100), 2)
    elif loan_type == "流动资金贷款":
        amount = round(random.uniform(100, 500), 2)
    else:
        amount = round(random.uniform(20, 200), 2)
    
    # 利率：3.5%-6.5%
    rate = round(random.uniform(3.5, 6.5), 2)
    
    # 期限：6/12/24/36个月
    term = random.choice([6, 12, 24, 36])
    
    # 放款日期
    days_diff = (end_date - start_date).days
    loan_date = start_date + timedelta(days=random.randint(0, days_diff))
    loan_date_str = loan_date.strftime("%Y-%m-%d")
    
    # 到期日期
    maturity_date = loan_date + timedelta(days=term * 30)
    maturity_date_str = maturity_date.strftime("%Y-%m-%d")
    
    # 贷款余额：部分已还款
    if maturity_date < datetime.now():
        # 已到期的，余额为0或很小
        balance = round(amount * random.uniform(0, 0.1), 2)
    else:
        # 未到期的，按时间比例计算剩余
        total_days = term * 30
        elapsed_days = (datetime.now() - loan_date).days
        remaining_ratio = max(0, 1 - elapsed_days / total_days)
        balance = round(amount * remaining_ratio * random.uniform(0.9, 1.0), 2)
    
    # 担保方式
    guaranty = random.choices(GUARANTY, weights=[30, 25, 35, 10])[0]
    
    # 风险等级：大部分正常，少数关注/次级
    risk = random.choices(RISK_LEVELS, weights=[75, 18, 5, 2])[0]
    
    # 逾期天数
    if risk == "正常":
        overdue = 0
    elif risk == "关注":
        overdue = random.randint(1, 30)
    elif risk == "次级":
        overdue = random.randint(31, 90)
    else:
        overdue = random.randint(91, 180)
    
    # 客户年龄
    age = random.randint(28, 58)
    
    # 年营收（万元）
    revenue = round(amount * random.uniform(2, 8), 2)
    
    data.append([
        cust_id, cust_name, industry, loan_type, branch, manager,
        amount, rate, term, loan_date_str, maturity_date_str,
        balance, guaranty, risk, overdue, age, revenue
    ])

# ===== 写入CSV =====
output_dir = os.path.dirname(os.path.abspath(__file__))
output_file = os.path.join(output_dir, "普惠金融贷款数据_2024-2026.csv")

header = [
    "客户编号", "客户名称", "行业分类", "贷款类型", "所属支行", "客户经理",
    "贷款金额(万元)", "贷款利率(%)", "贷款期限(月)", "放款日期", "到期日期",
    "贷款余额(万元)", "担保方式", "风险等级", "逾期天数", "客户年龄", "年营收(万元)"
]

with open(output_file, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f)
    writer.writerow(header)
    writer.writerows(data)

print(f"✅ 已生成 {len(data)} 条模拟数据")
print(f"📁 文件路径: {output_file}")

# 打印统计概览
print(f"\n=== 数据概览 ===")
print(f"总客户数: {len(data)}")
print(f"贷款类型分布:")
types = {}
for row in data:
    t = row[3]
    types[t] = types.get(t, 0) + 1
for t, c in sorted(types.items(), key=lambda x: -x[1]):
    print(f"  {t}: {c}户")
print(f"风险等级分布:")
risks = {}
for row in data:
    r = row[13]
    risks[r] = risks.get(r, 0) + 1
for r in ["正常", "关注", "次级", "可疑"]:
    print(f"  {r}: {risks.get(r, 0)}户")
