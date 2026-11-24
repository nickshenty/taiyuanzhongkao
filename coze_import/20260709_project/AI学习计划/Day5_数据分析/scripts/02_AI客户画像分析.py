#!/usr/bin/env python3
"""
Day5 - 脚本02：AI客户画像分析
用pandas提取数据，调用本地Ollama模型做AI分析
运行方式：python3 02_AI客户画像分析.py
"""

import pandas as pd
import os
import sys
import json

# ===== 配置 =====
MODEL = "qwen2.5:7b"  # 可改为 glm4:9b / deepseek-r1:7b 等
data_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "普惠金融贷款数据_2024-2026.csv")

def call_ollama(prompt, model=MODEL):
    """调用本地Ollama模型"""
    try:
        import ollama
        response = ollama.chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            options={"temperature": 0.3}  # 低温度=更稳定
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
print(f"📂 已加载 {len(df)} 条数据\n")

# ===== 2. 风险客户画像分析 =====
print("=" * 60)
print("【场景1】风险客户画像分析")
print("=" * 60)

# 筛选有风险的客户
risk_df = df[df["风险等级"].isin(["关注", "次级", "可疑"])].copy()
print(f"发现风险客户 {len(risk_df)} 户\n")

# 准备数据摘要（注意：不要把原始数据直接喂给模型，先做pandas统计）
risk_summary = f"""
以下是我行普惠金融风险客户数据统计：
- 风险客户总数：{len(risk_df)}户（其中关注{len(risk_df[risk_df['风险等级']=='关注'])}户，次级{len(risk_df[risk_df['风险等级']=='次级'])}户，可疑{len(risk_df[risk_df['风险等级']=='可疑'])}户）
- 风险客户平均贷款金额：{risk_df['贷款金额(万元)'].mean():.1f}万元
- 风险客户平均逾期天数：{risk_df['逾期天数'].mean():.0f}天
- 风险客户涉及行业：{', '.join(risk_df['行业分类'].unique())}
- 风险客户担保方式分布：{dict(risk_df['担保方式'].value_counts())}
- 风险客户所属支行：{dict(risk_df['所属支行'].value_counts())}
- 信用类风险客户占比：{len(risk_df[risk_df['担保方式']=='信用'])/len(risk_df)*100:.1f}%
"""

prompt = f"""你是建设银行普惠金融风险分析专家。请根据以下数据，分析风险客户的共同特征，并提出风险防范建议。

{risk_summary}

请从以下角度分析：
1. 风险客户的行业集中度
2. 担保方式与风险的关系
3. 可能的风险成因
4. 下一步风险管控建议

请用简洁专业的语言回答，200字以内。"""

print("正在调用AI分析...\n")
result = call_ollama(prompt)
print(f"🤖 AI分析结果：\n")
print(result)

# ===== 3. 高价值客户画像 =====
print(f"\n{'=' * 60}")
print("【场景2】高价值客户画像分析")
print("=" * 60)

# 定义高价值客户：贷款金额大 + 正常类 + 年营收高
high_value = df[(df["贷款金额(万元)"] > df["贷款金额(万元)"].quantile(0.75)) & 
                (df["风险等级"] == "正常")].copy()
print(f"发现高价值客户 {len(high_value)} 户\n")

hv_summary = f"""
以下是我行普惠金融高价值客户数据统计：
- 高价值客户总数：{len(high_value)}户
- 平均贷款金额：{high_value['贷款金额(万元)'].mean():.1f}万元
- 平均年营收：{high_value['年营收(万元)'].mean():.1f}万元
- 涉及行业：{', '.join(high_value['行业分类'].unique())}
- 贷款类型分布：{dict(high_value['贷款类型'].value_counts())}
- 所属支行：{dict(high_value['所属支行'].value_counts())}
"""

prompt2 = f"""你是建设银行普惠金融客户经营专家。请根据以下数据，分析高价值客户的特征，并提出深化服务建议。

{hv_summary}

请分析：
1. 高价值客户的行业和贷款类型特征
2. 这些客户的潜在需求
3. 交叉营销建议（存款、理财、结算等）
4. 客户维护策略

请用简洁专业的语言回答，200字以内。"""

print("正在调用AI分析...\n")
result2 = call_ollama(prompt2)
print(f"🤖 AI分析结果：\n")
print(result2)

# ===== 4. 单客户详细画像 =====
print(f"\n{'=' * 60}")
print("【场景3】单客户详细画像（示例）")
print("=" * 60)

# 取一个风险客户做详细画像
sample = risk_df.iloc[0]
customer_profile = f"""
客户编号：{sample['客户编号']}
行业：{sample['行业分类']}
贷款类型：{sample['贷款类型']}
所属支行：{sample['所属支行']}
贷款金额：{sample['贷款金额(万元)']}万元
贷款利率：{sample['贷款利率(%)']}%
贷款期限：{sample['贷款期限(月)']}个月
贷款余额：{sample['贷款余额(万元)']}万元
担保方式：{sample['担保方式']}
风险等级：{sample['风险等级']}
逾期天数：{sample['逾期天数']}天
客户年龄：{sample['客户年龄']}岁
年营收：{sample['年营收(万元)']}万元
"""

prompt3 = f"""你是建设银行客户经理。请为以下客户生成一份客户画像分析报告。

{customer_profile}

请包含：
1. 客户基本信息概述
2. 风险评估
3. 可能的风险原因分析
4. 建议的下一步行动措施

格式要像银行内部报告，简洁专业。"""

print(f"分析客户：{sample['客户编号']}\n")
print("正在调用AI分析...\n")
result3 = call_ollama(prompt3)
print(f"🤖 客户画像报告：\n")
print(result3)

print(f"\n{'=' * 60}")
print("✅ 客户画像分析完成！")
print("=" * 60)
