#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Day6 知识管理 - 知识库问答检索
构建简易知识库，用关键词匹配 + AI问答实现智能检索
支持交互式问答
"""

import os
import sys
import ollama
import re

# ============ 配置区 ============
MODEL = "glm4:9b"
TOP_K = 2                # 检索最相关的K篇文档
SCORE_THRESHOLD = 1      # 最低匹配分数，低于此分数不检索
# ================================

def load_knowledge_base(kb_dir):
    """加载知识库所有文档"""
    documents = []
    for filename in os.listdir(kb_dir):
        if filename.endswith('.txt'):
            filepath = os.path.join(kb_dir, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read().strip()
            documents.append({
                'filename': filename,
                'title': filename.replace('.txt', ''),
                'content': content,
                'keywords': extract_keywords(content)
            })
    return documents

def extract_keywords(text):
    """简单提取文档关键词（标题、小标题、数字等）"""
    keywords = set()
    
    # 提取标题行（以数字、一、二、三等开头的行）
    for line in text.split('\n'):
        line = line.strip()
        if re.match(r'^[一二三四五六七八九十\d]+[、.\.]', line):
            keywords.add(line[:20])
    
    # 提取金额、比例等数字关键词
    for match in re.finditer(r'(\d+万?元|\d+%|\d+个?月|\d+年|\d+分)', text):
        keywords.add(match.group(1))
    
    # 提取产品名称
    product_patterns = ['小微快贷', '云税贷', '抵押经营贷', '农贷通', '农担贷', '银税互动',
                       '首贷户', '普惠金融', '涉农贷款', '信用贷款', '抵押贷款',
                       '小微企业', '个体工商户', '农户', '家庭农场']
    for p in product_patterns:
        if p in text:
            keywords.add(p)
    
    return keywords

def search_documents(query, documents, top_k=TOP_K):
    """简单关键词匹配检索"""
    # 提取查询中的关键词
    query_words = set()
    # 中文分词（简单方法：按2-4字滑窗提取）
    for i in range(len(query)):
        for w in [2, 3, 4]:
            word = query[i:i+w]
            if len(word) == w:
                query_words.add(word)
    
    # 单独添加完整查询
    query_words.add(query)
    
    # 计算每篇文档的匹配分数
    scored_docs = []
    for doc in documents:
        score = 0
        # 关键词匹配
        for word in query_words:
            if word in doc['content']:
                score += 1
        # 标题匹配加权
        for word in query_words:
            if word in doc['title']:
                score += 3
        
        if score >= SCORE_THRESHOLD:
            scored_docs.append({
                'filename': doc['filename'],
                'title': doc['title'],
                'content': doc['content'],
                'score': score
            })
    
    # 按分数排序，取前K篇
    scored_docs.sort(key=lambda x: x['score'], reverse=True)
    return scored_docs[:top_k]

def answer_question(query, retrieved_docs, model=MODEL):
    """用AI基于检索到的文档回答问题"""
    
    if not retrieved_docs:
        return "抱歉，知识库中没有找到与您问题相关的文档。"
    
    # 构建上下文
    context = ""
    for i, doc in enumerate(retrieved_docs):
        context += f"\n【文档{i+1}：{doc['title']}】\n{doc['content']}\n"
    
    prompt = f"""你是银行知识库问答助手。请根据以下检索到的文档内容回答用户的问题。

要求：
1. 只基于文档内容回答，不要编造文档中没有的信息
2. 如果文档中有具体数据，请准确引用
3. 回答要简洁明了，直接回答问题
4. 如果文档中没有相关信息，明确告知"现有知识库中未找到相关信息"
5. 在回答末尾标注信息来源文档

检索到的文档：
{context}

用户问题：{query}
"""
    
    try:
        response = ollama.chat(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            options={'temperature': 0.3}
        )
        return response['message']['content'].strip()
    except Exception as e:
        return f"[问答失败: {e}]"

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(os.path.dirname(script_dir), 'data')
    kb_dir = os.path.join(data_dir, '知识库')
    
    print("=" * 60)
    print("  📚 知识库问答检索系统")
    print("=" * 60)
    print(f"  模型: {MODEL}")
    print(f"  知识库: {kb_dir}")
    print()
    
    # 加载知识库
    print("📖 正在加载知识库...")
    documents = load_knowledge_base(kb_dir)
    
    if not documents:
        print(f"❌ 知识库为空，请检查目录: {kb_dir}")
        return
    
    print(f"✅ 已加载 {len(documents)} 篇文档:")
    for doc in documents:
        print(f"   - {doc['title']}（{len(doc['content'])}字符，{len(doc['keywords'])}个关键词）")
    print()
    print("-" * 60)
    print()
    
    # 演示问答
    demo_questions = [
        "小微企业贷款额度最高是多少？",
        "云税贷的准入条件是什么？",
        "贷款逾期多少天算关注类？",
        "涉农贷款有什么利率优惠？",
        "纳税信用A级企业能贷多少钱？",
    ]
    
    print("🤖 先演示几个示例问题：\n")
    
    for i, question in enumerate(demo_questions):
        print(f"\n{'='*60}")
        print(f"❓ 问题 {i+1}: {question}")
        print(f"{'='*60}")
        
        # 检索
        retrieved = search_documents(question, documents)
        if retrieved:
            print(f"📖 检索到 {len(retrieved)} 篇相关文档:")
            for doc in retrieved:
                print(f"   - {doc['title']}（匹配分: {doc['score']}）")
        else:
            print("📖 未检索到相关文档")
        print()
        
        # 回答
        answer = answer_question(question, retrieved)
        print("💡 回答:")
        print(answer)
        print()
    
    print("-" * 60)
    print()
    
    # 交互式问答
    print("🎯 现在进入交互模式，输入你的问题（输入 q 退出）:\n")
    
    while True:
        question = input("❓ 你的问题: ").strip()
        
        if question.lower() in ['q', 'quit', 'exit', '退出']:
            print("\n👋 再见！")
            break
        
        if not question:
            continue
        
        print()
        
        # 检索
        retrieved = search_documents(question, documents)
        if retrieved:
            print(f"📖 检索到 {len(retrieved)} 篇相关文档:")
            for doc in retrieved:
                print(f"   - {doc['title']}（匹配分: {doc['score']}）")
        else:
            print("📖 未检索到相关文档")
        print()
        
        # 回答
        print("💡 回答:")
        answer = answer_question(question, retrieved)
        print(answer)
        print()
        print("-" * 40)
        print()
    
    print()
    print("💡 动手试试:")
    print("   1. 往知识库文件夹里添加更多文档（txt格式），重新运行即可")
    print("   2. 修改 TOP_K 参数，调整检索文档数量")
    print("   3. 试试用 Open WebUI 的知识库功能（见学习指南第三部分）")
    print("      Open WebUI 内置RAG，支持语义检索，比关键词匹配更智能")

if __name__ == '__main__':
    main()
