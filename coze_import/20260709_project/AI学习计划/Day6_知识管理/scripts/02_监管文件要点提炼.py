#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Day6 知识管理 - 监管文件要点提炼
用AI从监管文件中提取：核心目标、量化指标、实施要求、时间节点、责任主体
"""

import os
import sys
import ollama

# ============ 配置区 ============
MODEL = "glm4:9b"
# ================================

def extract_key_points(text, model=MODEL):
    """用AI提炼监管文件要点"""
    
    prompt = f"""你是银行监管政策分析专家。请仔细阅读以下监管文件，按结构化格式提炼关键要点。

要求按以下格式输出：

## 一、文件核心定位
（2-3句话说明这份文件是干什么的，解决什么问题）

## 二、量化目标
（列出文件中所有具体的数字化目标，包括百分比、金额、户数等）

## 三、重点政策举措
（按重要性列出5-8条核心政策举措，每条一句话概括）

## 四、时间节点
（列出文件中涉及的所有时间要求和截止日期）

## 五、对基层银行的工作要求
（列出银行需要落实的具体工作事项）

## 六、需要特别关注的合规要点
（列出可能涉及违规风险的关键条款）

监管文件原文：
{text}
"""
    
    try:
        response = ollama.chat(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            options={'temperature': 0.3}
        )
        return response['message']['content'].strip()
    except Exception as e:
        return f"[要点提炼失败: {e}]"

def generate_action_checklist(text, model=MODEL):
    """生成落地执行清单"""
    
    prompt = f"""你是银行普惠金融部门负责人。请根据以下监管文件，生成一份可执行的落地工作清单。

要求：
1. 列出需要在本行落实的具体工作事项（8-12条）
2. 每条工作事项包含：事项名称、责任部门、完成时限建议、优先级（高/中/低）
3. 用表格形式输出

监管文件原文：
{text}
"""
    
    try:
        response = ollama.chat(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            options={'temperature': 0.4}
        )
        return response['message']['content'].strip()
    except Exception as e:
        return f"[工作清单生成失败: {e}]"

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(os.path.dirname(script_dir), 'data')
    
    # 默认使用监管文件
    default_file = os.path.join(data_dir, '监管文件_普惠金融指导意见.txt')
    
    if len(sys.argv) > 1:
        filepath = sys.argv[1]
    else:
        filepath = default_file
    
    print("=" * 60)
    print("  📋 监管文件要点提炼工具")
    print("=" * 60)
    print(f"  模型: {MODEL}")
    print(f"  文件: {os.path.basename(filepath)}")
    print()
    
    # 读取文件
    if not os.path.exists(filepath):
        print(f"❌ 文件不存在: {filepath}")
        return
    
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read().strip()
    
    print(f"  文档长度: {len(text)} 字符")
    print()
    print("-" * 60)
    
    # 第一步：提炼要点
    print("\n📝 第一步：提炼监管文件关键要点...\n")
    key_points = extract_key_points(text)
    print(key_points)
    print()
    print("-" * 60)
    
    # 第二步：生成执行清单
    print("\n📝 第二步：生成落地执行清单...\n")
    action_list = generate_action_checklist(text)
    print(action_list)
    print()
    
    # 保存结果
    output_path = os.path.join(script_dir, f"要点提炼_{os.path.basename(filepath).replace('.txt', '')}.md")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(f"# 监管文件要点提炼：{os.path.basename(filepath)}\n\n")
        f.write(f"**使用模型**: {MODEL}\n")
        f.write(f"**原文长度**: {len(text)} 字符\n\n")
        f.write("---\n\n")
        f.write("## 一、结构化要点\n\n")
        f.write(key_points)
        f.write("\n\n---\n\n")
        f.write("## 二、落地执行清单\n\n")
        f.write(action_list)
        f.write("\n")
    
    print(f"\n✅ 结果已保存至: {output_path}")
    print()
    print("💡 动手试试:")
    print("   1. 把你工作中收到的真实监管文件路径传入:")
    print("      python3 02_监管文件要点提炼.py /path/to/your_file.txt")
    print("   2. 修改 prompt 中的角色设定，比如改为'风险管理部负责人'，看输出差异")
    print("   3. 试试用 deepseek-r1:7b 模型，它的推理能力可能更适合分析复杂条款")

if __name__ == '__main__':
    main()
