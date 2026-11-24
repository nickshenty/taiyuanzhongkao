#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Day6 知识管理 - 会议纪要自动化
将会议记录/转写文本整理为结构化会议纪要
支持从txt文件或直接输入文本
"""

import os
import sys
import ollama
from datetime import datetime

# ============ 配置区 ============
MODEL = "glm4:9b"
# ================================

def generate_structured_minutes(transcript, model=MODEL):
    """用AI将会议记录整理为结构化纪要"""
    
    prompt = f"""你是银行会议纪要撰写专家。请将以下会议记录整理为一份结构化、规范的会议纪要。

要求按以下格式输出：

---
# 会议纪要

## 一、会议基本信息
- 会议名称：
- 会议时间：
- 会议地点：
- 主持人：
- 参会人员：
- 记录人：

## 二、会议议程
（列出会议的主要议题）

## 三、会议内容摘要
（按议题分别摘要讨论要点，每个议题2-4条要点）

### 议题一：xxx
- 要点1
- 要点2

### 议题二：xxx
- 要点1
- 要点2

## 四、会议决议
（列出会议上做出的明确决定，编号列出）

## 五、工作安排
| 序号 | 工作事项 | 责任人 | 完成时限 |
|------|---------|--------|---------|

## 六、下次会议安排
（如有提及）

---

注意事项：
1. 保持客观，不要添加会议中没有讨论的内容
2. 量化数据要准确引用（金额、百分比、户数等）
3. 工作安排要明确责任人和时限
4. 语言要简洁正式，符合银行公文风格

会议记录原文：
{transcript}
"""
    
    try:
        response = ollama.chat(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            options={'temperature': 0.3}
        )
        return response['message']['content'].strip()
    except Exception as e:
        return f"[纪要生成失败: {e}]"

def generate_action_items(transcript, model=MODEL):
    """提取待办事项清单"""
    
    prompt = f"""请从以下会议记录中提取所有待办事项，生成一份简洁的待办清单。

要求：
1. 只列出明确指派的任务（有责任人的）
2. 每项标注责任人和完成时限
3. 按优先级排序（有明确时限的排前面）
4. 用简洁的一句话描述每项任务

会议记录：
{transcript}

输出格式：
## 待办事项清单

| 优先级 | 事项 | 责任人 | 时限 | 状态 |
|--------|------|--------|------|------|
| 高 | xxx | xxx | xxx | 待启动 |
"""
    
    try:
        response = ollama.chat(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            options={'temperature': 0.3}
        )
        return response['message']['content'].strip()
    except Exception as e:
        return f"[待办清单生成失败: {e}]"

def generate_briefing(transcript, model=MODEL):
    """生成一句话简报"""
    
    prompt = f"""请用一段话（100字以内）概括以下会议的核心内容和最重要的决策。

会议记录：
{transcript}
"""
    
    try:
        response = ollama.chat(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            options={'temperature': 0.3}
        )
        return response['message']['content'].strip()
    except Exception as e:
        return f"[简报生成失败: {e}]"

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(os.path.dirname(script_dir), 'data')
    
    default_file = os.path.join(data_dir, '会议记录_普惠金融工作推进会.txt')
    
    if len(sys.argv) > 1:
        filepath = sys.argv[1]
    else:
        filepath = default_file
    
    print("=" * 60)
    print("  📝 会议纪要自动化工具")
    print("=" * 60)
    print(f"  模型: {MODEL}")
    print(f"  文件: {os.path.basename(filepath)}")
    print()
    
    # 读取会议记录
    if not os.path.exists(filepath):
        print(f"❌ 文件不存在: {filepath}")
        return
    
    with open(filepath, 'r', encoding='utf-8') as f:
        transcript = f.read().strip()
    
    print(f"  记录长度: {len(transcript)} 字符")
    print()
    print("-" * 60)
    
    # 第一步：生成结构化纪要
    print("\n📝 第一步：生成结构化会议纪要...\n")
    print("⏳ AI正在整理会议内容，请稍候（约20-40秒）...\n")
    
    minutes = generate_structured_minutes(transcript)
    print(minutes)
    print()
    print("-" * 60)
    
    # 第二步：生成待办清单
    print("\n📝 第二步：提取待办事项清单...\n")
    action_items = generate_action_items(transcript)
    print(action_items)
    print()
    print("-" * 60)
    
    # 第三步：生成一句话简报
    print("\n📝 第三步：生成会议简报...\n")
    briefing = generate_briefing(transcript)
    print("📢 会议简报:")
    print(briefing)
    print()
    
    # 保存结果
    timestamp = datetime.now().strftime('%Y%m%d_%H%M')
    output_path = os.path.join(script_dir, f"会议纪要_{timestamp}.md")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(f"<!-- 自动生成于 {datetime.now().strftime('%Y-%m-%d %H:%M')} -->\n\n")
        f.write(minutes)
        f.write("\n\n---\n\n")
        f.write("## 待办事项清单\n\n")
        f.write(action_items)
        f.write("\n\n---\n\n")
        f.write("## 会议简报\n\n")
        f.write(f"> {briefing}\n")
    
    print(f"\n✅ 纪要已保存至: {output_path}")
    print()
    print("💡 动手试试:")
    print("   1. 把你工作中的一场会议记录（txt格式）路径传入:")
    print("      python3 05_会议纪要自动化.py /path/to/meeting.txt")
    print("   2. 修改 prompt 中的格式要求，定制你喜欢的纪要模板")
    print("   3. 关于录音转文字：见学习指南第四部分的 Whisper 安装指南")
    print("      录音 → Whisper转文字 → 本脚本整理纪要 = 完整自动化流程")

if __name__ == '__main__':
    main()
