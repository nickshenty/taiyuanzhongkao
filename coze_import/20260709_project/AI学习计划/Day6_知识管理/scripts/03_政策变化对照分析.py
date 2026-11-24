#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Day6 知识管理 - 政策变化对照分析
对比新旧两版政策文件，自动识别新增、删除、修改的条款
"""

import os
import sys
import ollama

# ============ 配置区 ============
MODEL = "glm4:9b"
# ================================

def compare_policies(old_text, new_text, model=MODEL):
    """用AI对比新旧政策文件"""
    
    prompt = f"""你是银行制度文件审查专家。请仔细对比以下两版政策文件（旧版和新版），识别所有重要变化。

旧版文件：
{old_text}

---
新版文件：
{new_text}

请按以下格式输出对比分析报告：

## 一、总体变化概述
（3-4句话概括新旧版本的主要变化方向和力度）

## 二、新增条款
（列出新版中新增的内容，每条注明对应的新版条款编号）
| 新增内容 | 新版条款 | 影响分析 |
|---------|---------|---------|

## 三、删除条款
（列出旧版中被删除的内容）
| 删除内容 | 旧版条款 | 影响分析 |
|---------|---------|---------|

## 四、修改条款
（列出有实质性修改的条款，重点标注变化部分）
| 旧版内容 | 新版内容 | 变化要点 |
|---------|---------|---------|

## 五、关键变化解读
（选择3-5个最重要的变化，详细解读其背后的政策意图和对实际工作的影响）

## 六、执行建议
（针对这些变化，基层银行需要做哪些调整？列出具体行动事项）
"""
    
    try:
        response = ollama.chat(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            options={'temperature': 0.3}
        )
        return response['message']['content'].strip()
    except Exception as e:
        return f"[对照分析失败: {e}]"

def generate_transition_checklist(old_text, new_text, model=MODEL):
    """生成制度衔接工作清单"""
    
    prompt = f"""你是银行合规管理负责人。新旧两版政策文件对比如下，请生成一份制度衔接落地工作清单。

旧版文件：
{old_text}

---
新版文件：
{new_text}

请输出一份工作清单，包含：
1. 需要修订的内部制度文件
2. 需要调整的系统参数
3. 需要开展的培训事项
4. 需要通知客户的变更
5. 需要更新的风控规则

每项标注优先级（紧急/重要/常规）和责任人建议。
用表格形式输出。
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
    
    old_file = os.path.join(data_dir, '政策文件_旧版.txt')
    new_file = os.path.join(data_dir, '政策文件_新版.txt')
    
    # 支持命令行传入自定义文件
    if len(sys.argv) > 2:
        old_file = sys.argv[1]
        new_file = sys.argv[2]
    
    print("=" * 60)
    print("  📊 政策变化对照分析工具")
    print("=" * 60)
    print(f"  模型: {MODEL}")
    print(f"  旧版: {os.path.basename(old_file)}")
    print(f"  新版: {os.path.basename(new_file)}")
    print()
    
    # 读取文件
    if not os.path.exists(old_file):
        print(f"❌ 旧版文件不存在: {old_file}")
        return
    if not os.path.exists(new_file):
        print(f"❌ 新版文件不存在: {new_file}")
        return
    
    with open(old_file, 'r', encoding='utf-8') as f:
        old_text = f.read().strip()
    with open(new_file, 'r', encoding='utf-8') as f:
        new_text = f.read().strip()
    
    print(f"  旧版长度: {len(old_text)} 字符")
    print(f"  新版长度: {len(new_text)} 字符")
    print()
    print("-" * 60)
    
    # 第一步：对照分析
    print("\n📝 第一步：生成对照分析报告...\n")
    print("⏳ AI正在逐条对比新旧版本，请稍候（约30-60秒）...\n")
    
    comparison = compare_policies(old_text, new_text)
    print(comparison)
    print()
    print("-" * 60)
    
    # 第二步：生成衔接工作清单
    print("\n📝 第二步：生成制度衔接工作清单...\n")
    checklist = generate_transition_checklist(old_text, new_text)
    print(checklist)
    print()
    
    # 保存结果
    output_path = os.path.join(script_dir, "政策对照分析报告.md")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("# 政策文件变化对照分析报告\n\n")
        f.write(f"**旧版**: {os.path.basename(old_file)}\n")
        f.write(f"**新版**: {os.path.basename(new_file)}\n")
        f.write(f"**使用模型**: {MODEL}\n\n")
        f.write("---\n\n")
        f.write("## 一、对照分析报告\n\n")
        f.write(comparison)
        f.write("\n\n---\n\n")
        f.write("## 二、制度衔接工作清单\n\n")
        f.write(checklist)
        f.write("\n")
    
    print(f"\n✅ 报告已保存至: {output_path}")
    print()
    print("💡 动手试试:")
    print("   1. 把你工作中的新旧制度文件路径传入:")
    print("      python3 03_政策变化对照分析.py 旧版.txt 新版.txt")
    print("   2. 观察 AI 能否发现所有变化点——特别是额度、期限、利率等数字变化")
    print("   3. 试试用 deepseek-r1:7b 做对比，推理型模型可能发现更深层的逻辑变化")

if __name__ == '__main__':
    main()
