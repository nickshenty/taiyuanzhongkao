#!/usr/bin/env python3
"""
Day5 - 脚本04：自动生成数据分析报告
整合pandas统计 + AI分析，一键生成完整业务报告
运行方式：python3 04_自动生成分析报告.py
"""

import pandas as pd
import os
import sys
from datetime import datetime

# ===== 配置 =====
MODEL = "glm4:9b"  # 报告生成用GLM4，公文质量更好
data_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "普惠金融贷款数据_2024-2026.csv")
output_dir = os.path.dirname(os.path.abspath(__file__))

def call_ollama(prompt, model=MODEL):
    """调用本地Ollama模型"""
    try:
        import ollama
        response = ollama.chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            options={"temperature": 0.4}
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
df["放款年月"] = df["放款日期"].dt.to_period("M")
print(f"📂 已加载 {len(df)} 条数据\n")

# ===== 2. 计算所有统计指标 =====
print("正在计算统计指标...")

stats = {}
stats["总客户数"] = len(df)
stats["贷款总额"] = df["贷款金额(万元)"].sum()
stats["贷款余额"] = df["贷款余额(万元)"].sum()
stats["平均金额"] = df["贷款金额(万元)"].mean()
stats["平均利率"] = df["贷款利率(%)"].mean()
stats["逾期户数"] = len(df[df["逾期天数"] > 0])
stats["逾期率"] = stats["逾期户数"] / stats["总客户数"] * 100
stats["不良户数"] = len(df[df["风险等级"].isin(["次级", "可疑"])])
stats["不良率"] = stats["不良户数"] / stats["总客户数"] * 100

# 分支行统计
branch = df.groupby("所属支行").agg(
    客户数=("客户编号", "count"),
    贷款额=("贷款金额(万元)", "sum"),
    余额=("贷款余额(万元)", "sum"),
    逾期数=("逾期天数", lambda x: (x > 0).sum())
).round(2)

# 行业统计
industry = df.groupby("行业分类")["贷款金额(万元)"].sum().sort_values(ascending=False)

# 月度趋势
monthly = df.groupby("放款年月")["贷款金额(万元)"].sum()

# ===== 3. 构建报告数据 =====
report_data = f"""
【普惠金融贷款业务数据分析报告】

报告日期：{datetime.now().strftime("%Y年%m月%d日")}
数据范围：{df['放款日期'].min().strftime("%Y-%m-%d")} 至 {df['放款日期'].max().strftime("%Y-%m-%d")}

一、总体情况
- 客户总数：{stats['总客户数']}户
- 贷款总额：{stats['贷款总额']:,.2f}万元
- 贷款余额：{stats['贷款余额']:,.2f}万元
- 平均贷款金额：{stats['平均金额']:,.2f}万元
- 平均利率：{stats['平均利率']:.2f}%

二、风险指标
- 逾期客户：{stats['逾期户数']}户，逾期率{stats['逾期率']:.1f}%
- 不良客户（次级+可疑）：{stats['不良户数']}户，不良率{stats['不良率']:.1f}%

三、分支行分布
{branch.to_string()}

四、行业集中度
{industry.to_string()}

五、月度放款趋势
{monthly.to_string()}
"""

print("正在调用AI生成分析报告...\n")

# ===== 4. AI生成报告 =====
prompt = f"""你是建设银行朔州分行普惠金融部分析专员。请根据以下数据，撰写一份结构化的业务数据分析报告。

{report_data}

报告要求：
1. 格式：正式银行内部报告格式
2. 内容：包含总体情况分析、风险分析、分支行对比、行业分析、趋势研判、下一步建议
3. 语言：专业、简洁、有数据支撑
4. 篇幅：800-1000字
5. 结尾：标注"本报告由AI辅助生成，数据仅供内部参考"

请直接输出报告全文。"""

report = call_ollama(prompt)

# ===== 5. 保存报告 =====
report_full = f"""# 普惠金融贷款业务数据分析报告

> 生成时间：{datetime.now().strftime("%Y-%m-%d %H:%M")}
> AI模型：{MODEL}
> 数据来源：模拟数据（学习用途）

---

{report}

---

## 附：原始数据统计

### 分支行明细
```
{branch.to_string()}
```

### 行业明细
```
{industry.to_string()}
```

### 月度趋势
```
{monthly.to_string()}
```

---

*本报告由AI辅助生成，数据仅供学习参考，不代表真实业务数据。*
"""

output_file = os.path.join(output_dir, f"普惠金融分析报告_{datetime.now().strftime('%Y%m%d')}.md")
with open(output_file, "w", encoding="utf-8") as f:
    f.write(report_full)

print("=" * 60)
print("✅ 报告生成完成！")
print(f"📁 报告已保存：{output_file}")
print("=" * 60)
print(f"\n报告预览：\n")
print(report[:500] + "...\n")
print(f"完整报告请查看文件：{os.path.basename(output_file)}")
