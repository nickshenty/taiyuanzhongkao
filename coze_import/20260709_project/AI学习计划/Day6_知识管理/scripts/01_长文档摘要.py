#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Day6 知识管理 - 长文档摘要工具
将长文档分块摘要，再汇总生成完整摘要
支持 .txt 和 .pdf 文件
"""

import os
import sys
import subprocess

# ============ 配置区 ============
MODEL = "glm4:9b"          # 主力模型（Day4验证的公文首选）
CHUNK_SIZE = 1500           # 每块字符数（中文约750字）
OVERLAP = 200               # 块间重叠字符数
# ================================

def read_file(filepath):
    """读取文件内容，支持txt和pdf"""
    ext = os.path.splitext(filepath)[1].lower()
    
    if ext == '.txt':
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    
    elif ext == '.pdf':
        # 使用pdftotext提取PDF文本
        try:
            result = subprocess.run(
                ['pdftotext', '-enc', 'UTF-8', filepath, '-'],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                return result.stdout
            else:
                print(f"❌ pdftotext 提取失败: {result.stderr}")
                return None
        except FileNotFoundError:
            print("❌ pdftotext 未安装，请执行: brew install poppler")
            print("   或者手动将PDF内容复制到txt文件中使用")
            return None
        except Exception as e:
            print(f"❌ PDF读取失败: {e}")
            return None
    
    else:
        print(f"❌ 不支持的文件格式: {ext}（支持 .txt 和 .pdf）")
        return None

def chunk_text(text, chunk_size=CHUNK_SIZE, overlap=OVERLAP):
    """
    将长文本分割为带重叠的块
    尝试在段落或句子边界处分块，保持语义完整
    """
    chunks = []
    start = 0
    total_len = len(text)
    
    while start < total_len:
        end = start + chunk_size
        
        if end >= total_len:
            # 最后一块，直接取到末尾
            chunks.append(text[start:].strip())
            break
        
        # 尝试在段落边界分块
        chunk = text[start:end]
        
        # 找最后一个段落分隔
        best_break = chunk.rfind('\n\n')
        if best_break == -1 or best_break < chunk_size * 0.5:
            # 找最后一个句号
            best_break = chunk.rfind('。')
        if best_break == -1 or best_break < chunk_size * 0.5:
            # 找最后一个换行
            best_break = chunk.rfind('\n')
        if best_break == -1 or best_break < chunk_size * 0.5:
            # 找不到好的断点，强制截断
            best_break = chunk_size
        
        chunk = text[start:start + best_break + 1].strip()
        if chunk:
            chunks.append(chunk)
        
        # 下一块从断点减去重叠开始
        start = start + best_break + 1 - overlap
        if start < 0:
            start = 0
    
    return chunks

def summarize_chunk(chunk, model=MODEL):
    """用本地模型对单个文本块生成摘要"""
    import ollama
    
    prompt = f"""请对以下文本生成简洁摘要，提取核心要点。
要求：
1. 用要点列表形式，每点一行
2. 保留关键数据、日期、政策名称
3. 每个要点不超过50字
4. 不要添加原文没有的内容

文本内容：
{chunk}
"""
    
    try:
        response = ollama.chat(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            options={'temperature': 0.3}
        )
        return response['message']['content'].strip()
    except Exception as e:
        return f"[摘要生成失败: {e}]"

def generate_final_summary(chunk_summaries, model=MODEL):
    """将各块摘要汇总为最终摘要"""
    import ollama
    
    combined = "\n\n".join([f"【第{i+1}部分摘要】\n{s}" for i, s in enumerate(chunk_summaries)])
    
    prompt = f"""以下是一篇长文档各部分的摘要，请将它们整合为一份完整的文档摘要。

要求：
1. 开头用2-3句话概括全文核心内容
2. 然后用要点列表列出关键政策要点（按重要性排序）
3. 最后用1-2句话说明该文件对基层银行工作的指导意义
4. 总字数控制在500字以内

各部分摘要：
{combined}
"""
    
    try:
        response = ollama.chat(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            options={'temperature': 0.3}
        )
        return response['message']['content'].strip()
    except Exception as e:
        return f"[最终摘要生成失败: {e}]"

def main():
    # 定位数据文件
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(os.path.dirname(script_dir), 'data')
    
    # 默认使用监管文件作为示例
    default_file = os.path.join(data_dir, '监管文件_普惠金融指导意见.txt')
    
    # 如果命令行传入了文件路径，使用它
    if len(sys.argv) > 1:
        filepath = sys.argv[1]
    else:
        filepath = default_file
    
    print("=" * 60)
    print("  📄 长文档摘要工具")
    print("=" * 60)
    print(f"  模型: {MODEL}")
    print(f"  文件: {os.path.basename(filepath)}")
    print()
    
    # 读取文件
    text = read_file(filepath)
    if not text:
        print("❌ 无法读取文件内容")
        return
    
    text = text.strip()
    total_chars = len(text)
    print(f"  文档长度: {total_chars} 字符")
    print()
    
    # 分块
    chunks = chunk_text(text)
    print(f"  分块数量: {len(chunks)} 块（每块约{CHUNK_SIZE}字符，重叠{OVERLAP}字符）")
    print()
    print("-" * 60)
    print()
    
    # 逐块摘要
    print("📝 正在逐块生成摘要...\n")
    chunk_summaries = []
    for i, chunk in enumerate(chunks):
        print(f"【第 {i+1}/{len(chunks)} 块】（{len(chunk)}字符）")
        print(f"内容预览: {chunk[:80]}...")
        print()
        
        summary = summarize_chunk(chunk)
        chunk_summaries.append(summary)
        
        print("摘要结果:")
        print(summary)
        print()
        print("-" * 40)
        print()
    
    # 汇总最终摘要
    if len(chunks) > 1:
        print("📋 正在生成最终整合摘要...\n")
        final_summary = generate_final_summary(chunk_summaries)
        print("=" * 60)
        print("  📋 最终文档摘要")
        print("=" * 60)
        print()
        print(final_summary)
        print()
    else:
        print("=" * 60)
        print("  📋 文档摘要")
        print("=" * 60)
        print()
        print(chunk_summaries[0])
        print()
    
    # 保存摘要到文件
    output_path = os.path.join(script_dir, f"摘要_{os.path.basename(filepath).replace('.txt', '').replace('.pdf', '')}.md")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(f"# 文档摘要：{os.path.basename(filepath)}\n\n")
        f.write(f"**原文长度**: {total_chars} 字符\n")
        f.write(f"**分块数量**: {len(chunks)} 块\n")
        f.write(f"**使用模型**: {MODEL}\n\n")
        f.write("---\n\n")
        f.write("## 最终摘要\n\n")
        if len(chunks) > 1:
            f.write(final_summary)
        else:
            f.write(chunk_summaries[0])
        f.write("\n\n---\n\n")
        f.write("## 各分块详细摘要\n\n")
        for i, s in enumerate(chunk_summaries):
            f.write(f"### 第{i+1}部分\n\n{s}\n\n")
    
    print(f"✅ 摘要已保存至: {output_path}")
    print()
    print("💡 动手试试:")
    print("   1. 修改开头的 MODEL 为 'qwen2.5:7b'，对比不同模型的摘要质量")
    print("   2. 修改 CHUNK_SIZE 为 800 或 2500，观察分块大小对摘要质量的影响")
    print("   3. 把你工作中的一份PDF文件路径作为参数传入:")
    print("      python3 01_长文档摘要.py /path/to/your.pdf")

if __name__ == '__main__':
    main()
