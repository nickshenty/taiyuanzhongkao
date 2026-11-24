#!/usr/bin/env python3
"""
每日AI工作流演示脚本
====================
串联四个时段的AI工作流：早晨简报 → 公文起草 → 数据分析 → 学习整理
使用 ollama 库调用本地模型 GLM4:9B 和 DeepSeek-R1:7B

使用方式：
    python3 01_每日AI工作流.py

前置条件：
    1. Ollama 已启动 (ollama serve)
    2. 已安装 ollama 库 (pip3 install ollama)
    3. 已下载模型 glm4:9b 和 deepseek-r1:7b
"""

import ollama
import json
import os
from datetime import datetime

# ============================================================
# 模型配置
# ============================================================
MODEL_WRITE = "glm4:9b"        # 公文写作主力（Day4验证8.5分）
MODEL_REASON = "deepseek-r1:7b"  # 推理分析主力
MODEL_FAST = "qwen2.5:7b"       # 快速摘要备选

# 输出目录
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "output")


# ============================================================
# 工具函数
# ============================================================
def call_model(model: str, system_prompt: str, user_prompt: str) -> str:
    """调用本地模型，返回文本响应"""
    try:
        response = ollama.chat(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return response["message"]["content"]
    except Exception as e:
        return f"[模型调用失败] {e}"


def print_section(title: str, emoji: str = ""):
    """打印分节标题"""
    line = "═" * 60
    print(f"\n{line}")
    print(f"  {emoji} {title}")
    print(f"{line}\n")


def print_substep(title: str):
    """打印子步骤"""
    print(f"\n── {title} ──")


def save_output(filename: str, content: str):
    """保存输出到文件"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  📁 已保存: {filepath}")


# ============================================================
# 时段一：早晨 — AI简报与待办梳理
# ============================================================
def morning_briefing():
    """早晨时段：通知摘要 + 待办梳理 + 行业要闻"""
    print_section("时段一：早晨 AI简报与待办梳理", "🌅")

    # 模拟当日收到的通知邮件
    notifications = """
【通知1】分行风险管理部：请各业务条线于7月10日前提交上半年风险自查报告，重点排查普惠贷款领域。
【通知2】省行普惠金融部：转发总行《关于进一步加大小微企业首贷户拓展力度的通知》，请认真组织学习落实。
【通知3】办公室：周四（7月10日）上午9:00召开分行季度经营分析会，副行长需汇报普惠金融条线情况。
【邮件4】某支行行长请示：辖区一家农业企业申请经营性贷款500万元，涉及跨行业务，请审批。
【通知5】合规部：近期监管检查将重点关注个贷资金流向，请提前做好自查。
"""

    system_prompt = (
        "你是建设银行朔州分行副行长的工作助手，擅长从繁杂的通知邮件中"
        "快速提炼关键信息，按优先级排序，标注需要副行长亲自决策的事项。"
    )

    user_prompt = f"""以下是我今天收到的通知和邮件，请整理为：

1. 今日待办清单（按优先级排序，标注时限）
2. 需要我亲自决策的事项（标⭐）
3. 可授权给部门处理的事项
4. 本周重要时间节点提醒

通知邮件内容：
{notifications}
"""

    print_substep("正在调用 GLM4:9B 生成本日工作简报...")
    result = call_model(MODEL_WRITE, system_prompt, user_prompt)
    print(result)

    # 保存结果
    today = datetime.now().strftime("%Y%m%d")
    save_output(f"早晨简报_{today}.md", f"# 每日AI工作简报\n\n生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}\n模型：{MODEL_WRITE}\n\n---\n\n{result}")

    return result


# ============================================================
# 时段二：上午 — AI辅助公文起草
# ============================================================
def morning_document():
    """上午时段：公文起草演示"""
    print_section("时段二：上午 AI辅助公文起草", "🏢")

    system_prompt = (
        "你是建设银行朔州分行普惠金融部的公文写作专家，具有20年银行公文写作经验。"
        "你的文风正式、简洁、数据准确，格式符合建行标准业务通报要求。"
    )

    user_prompt = """请起草一份《关于2026年二季度普惠金融业务运行情况的通报》。

背景数据（虚构示例）：
- 普惠贷款余额：28.6亿元，较年初增长3.2亿元，增幅12.6%
- 小微企业贷款：新增首贷户42户，余额15.3亿元
- 涉农贷款：余额9.8亿元，较年初增长1.1亿元
- 乡村金融服务点：新设3个，累计覆盖28个行政村
- 不良率：1.23%，较年初下降0.05个百分点
- 主要举措：开展"普惠金融进园区"活动、推出线上化小微贷款产品、深化银政合作
- 存在问题：部分支行首贷户拓展进度滞后、个别产品线上化率偏低
- 下步计划：加大首贷户拓展考核力度、推进产品线上化改造、开展乡村金融专项营销

要求：
1. 建行标准业务通报格式
2. 包含：一、业务运行总体情况；二、主要工作举措；三、存在问题；四、下步工作计划
3. 1500字左右
4. 语言正式、简洁、数据准确
5. 自动补充落款和日期
"""

    print_substep("正在调用 GLM4:9B 起草普惠金融业务通报...")
    result = call_model(MODEL_WRITE, system_prompt, user_prompt)
    print(result)

    today = datetime.now().strftime("%Y%m%d")
    save_output(f"普惠金融通报_{today}.md", f"# 普惠金融业务通报（AI辅助初稿）\n\n生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}\n模型：{MODEL_WRITE}\n\n---\n\n{result}")

    return result


# ============================================================
# 时段三：下午 — AI数据分析
# ============================================================
def afternoon_analysis():
    """下午时段：业务数据分析演示"""
    print_section("时段三：下午 AI数据分析", "📊")

    # 模拟业务数据
    business_data = """
建行朔州分行普惠金融业务数据（2026年上半年）

月份      普惠贷款余额(亿)  新增(亿)  小微首贷户  不良率(%)  涉农贷款(亿)
1月       25.4              0.0       5           1.28       8.7
2月       26.1              0.7       8           1.27       8.9
3月       26.8              0.7       10          1.25       9.1
4月       27.2              0.4       6           1.26       9.3
5月       27.9              0.7       9           1.24       9.5
6月       28.6              0.7       11          1.23       9.8

支行业绩排名（按普惠贷款增量）：
1. 朔城支行：+0.9亿
2. 平鲁支行：+0.7亿
3. 山阴支行：+0.6亿
4. 怀仁支行：+0.5亿
5. 应县支行：+0.3亿
6. 右玉支行：+0.2亿

需关注：
- 4月新增贷款环比下降43%（0.7→0.4亿）
- 应县支行和右玉支行增量明显偏低
- 不良率持续下降但绝对值仍高于省行平均水平（1.15%）
"""

    system_prompt = (
        "你是银行数据分析专家，擅长从业务数据中发现趋势、异常和风险信号。"
        "你的分析风格是：先给结论，再用数据支撑，最后给行动建议。"
    )

    user_prompt = f"""以下是建行朔州分行2026年上半年普惠金融业务数据，请进行深度分析：

{business_data}

请输出：
1. 总体趋势分析（上半年整体走势，同比增长情况）
2. 数据异常点识别（哪些月份/支行数据异常，可能原因）
3. 风险预警信号（哪些指标需要关注）
4. 支行业绩差异化分析（为什么有的支行好有的差）
5. 下一步工作建议（3-5条具体可执行的建议）

分析要求：
- 用数据说话，每个结论都要有数字支撑
- 异常分析要给出可能的业务原因
- 建议要具体可执行，不要泛泛而谈
"""

    print_substep("正在调用 DeepSeek-R1:7B 进行业务数据分析...")
    result = call_model(MODEL_REASON, system_prompt, user_prompt)
    print(result)

    today = datetime.now().strftime("%Y%m%d")
    save_output(f"数据分析报告_{today}.md", f"# 普惠金融数据分析报告（AI辅助）\n\n生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}\n模型：{MODEL_REASON}\n\n---\n\n{result}")

    return result


# ============================================================
# 时段四：晚上 — AI辅助学习整理
# ============================================================
def evening_learning():
    """晚上时段：学习整理与知识归档"""
    print_section("时段四：晚上 AI辅助学习整理", "🌙")

    # 模拟今天学习/工作的内容摘要
    daily_content = """
今日工作与学习内容摘要：

1. 上午起草了二季度普惠金融业务通报，重点数据：余额28.6亿，增幅12.6%，不良率1.23%
2. 下午分析了上半年业务数据，发现4月新增贷款环比下降43%，需关注季节性因素
3. 收到总行《关于加大小微企业首贷户拓展力度的通知》，核心要求：首贷户占比不低于30%
4. 了解到省行不良率平均水平为1.15%，我行1.23%仍有差距
5. 周四需在季度经营分析会上汇报普惠金融条线情况
6. 阅读了《金融研究》关于普惠金融数字化转型的文章，核心观点是线上化率与风控效率正相关
"""

    system_prompt = (
        "你是银行副行长的知识管理助手，擅长将每日零散的工作和学习内容"
        "整理为结构化的知识卡片，便于长期积累和检索。"
    )

    user_prompt = f"""以下是我今天的工作与学习内容摘要，请整理为知识卡片：

{daily_content}

请输出：
1. 今日工作要点回顾（3条以内）
2. 学习收获（新知识/新认知）
3. 待跟进事项（含时限）
4. 知识卡片（按主题分类，每张卡片含：主题、核心要点、关键数据、关联知识、标签）
5. 一句话今日总结

知识卡片分类建议：普惠金融、个贷业务、乡村金融、管理效率、研究学习
"""

    print_substep("正在调用 GLM4:9B 整理今日知识卡片...")
    result = call_model(MODEL_WRITE, system_prompt, user_prompt)
    print(result)

    today = datetime.now().strftime("%Y%m%d")
    save_output(f"知识卡片_{today}.md", f"# 每日知识卡片\n\n生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}\n模型：{MODEL_WRITE}\n\n---\n\n{result}")

    return result


# ============================================================
# 主流程
# ============================================================
def main():
    print()
    print("╔" + "═" * 60 + "╗")
    print("║" + "  每日AI工作流演示".center(48) + "║")
    print("║" + f"  日期：{datetime.now().strftime('%Y-%m-%d %A')}".center(48) + "║")
    print("║" + "  模型：GLM4:9B + DeepSeek-R1:7B".center(48) + "║")
    print("╚" + "═" * 60 + "╝")

    # 环境检查
    print_section("环境检查", "🔍")
    try:
        models = ollama.list()
        model_names = [m.model for m in models.models] if hasattr(models, "models") else []
        print(f"  Ollama 连接成功，可用模型：{len(model_names)} 个")

        required = [MODEL_WRITE, MODEL_REASON]
        for m in required:
            status = "✅" if m in model_names else "❌ 未找到"
            print(f"  {m}: {status}")

        missing = [m for m in required if m not in model_names]
        if missing:
            print(f"\n  ⚠️  缺少模型: {missing}")
            print(f"  请运行: ollama pull {' '.join(missing)}")
            return
    except Exception as e:
        print(f"  ❌ Ollama 连接失败: {e}")
        print(f"  请确认 Ollama 已启动: ollama serve")
        return

    print("\n  ✅ 环境检查通过，开始演示四个时段的AI工作流...")

    # 执行四个时段
    print("\n" + "─" * 60)
    print("  以下内容均为演示，使用虚构的银行业务数据。")
    print("  实际使用时，请替换为你真实的业务数据和通知内容。")
    print("─" * 60)

    # 时段一：早晨
    morning_briefing()

    # 时段二：上午
    morning_document()

    # 时段三：下午
    afternoon_analysis()

    # 时段四：晚上
    evening_learning()

    # 总结
    print_section("工作流演示完成", "✅")
    print(f"  四个时段的AI工作流已全部演示完毕。")
    print(f"  所有输出已保存到: {os.path.abspath(OUTPUT_DIR)}")
    print(f"\n  📋 演示内容回顾：")
    print(f"     🌅 早晨：通知邮件摘要 + 待办清单（GLM4:9B）")
    print(f"     🏢 上午：普惠金融业务通报起草（GLM4:9B）")
    print(f"     📊 下午：上半年业务数据分析（DeepSeek-R1:7B）")
    print(f"     🌙 晚上：每日知识卡片整理（GLM4:9B）")
    print(f"\n  💡 实际使用建议：")
    print(f"     1. 将脚本中的示例数据替换为你的真实业务数据")
    print(f"     2. 在 Open WebUI 中保存常用 Prompt 模板，日常直接使用")
    print(f"     3. 配合 02_效率对比模板.py 记录每次AI使用的效率提升")
    print(f"     4. 持续优化 Prompt，让AI输出越来越贴合你的工作需求")
    print()


if __name__ == "__main__":
    main()
