#!/usr/bin/env python3
"""
Day5 - 脚本00：环境检查
检查Python、pandas、ollama是否就绪
运行方式：python3 00_环境检查.py
"""

import sys
import subprocess

print("=" * 50)
print("AI学习Day5 - 环境检查")
print("=" * 50)

# 1. Python版本
print(f"\n📦 Python版本: {sys.version}")
print(f"   路径: {sys.executable}")

# 2. 检查pandas
try:
    import pandas as pd
    print(f"\n✅ pandas已安装: {pd.__version__}")
except ImportError:
    print(f"\n❌ pandas未安装")
    print(f"   请运行: pip3 install pandas")
    print(f"   如果权限不够: pip3 install --user pandas")

# 3. 检查ollama Python库
try:
    import ollama
    print(f"✅ ollama库已安装: {ollama.__version__}")
except ImportError:
    try:
        # 新版ollama没有__version__属性，尝试基本导入
        import ollama
        print(f"✅ ollama库已安装")
    except ImportError:
        print(f"❌ ollama库未安装")
        print(f"   请运行: pip3 install ollama")

# 4. 检查Ollama服务是否运行
try:
    result = subprocess.run(["ollama", "list"], capture_output=True, text=True, timeout=5)
    if result.returncode == 0:
        models = [line.split()[0] for line in result.stdout.strip().split("\n")[1:] if line.strip()]
        print(f"\n🤖 Ollama服务: 运行中")
        print(f"   可用模型 ({len(models)}个):")
        for m in models:
            print(f"   - {m}")
    else:
        print(f"\n⚠️ Ollama服务可能未启动，请运行: ollama serve")
except FileNotFoundError:
    print(f"\n❌ Ollama未安装")
except subprocess.TimeoutExpired:
    print(f"\n⚠️ Ollama响应超时，可能未启动")
except Exception as e:
    print(f"\n⚠️ Ollama检查异常: {e}")

# 5. 检查数据文件
import os
data_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "普惠金融贷款数据_2024-2026.csv")
if os.path.exists(data_file):
    print(f"\n📊 数据文件: 找到")
    print(f"   路径: {os.path.abspath(data_file)}")
else:
    print(f"\n❌ 数据文件未找到: {data_file}")

print("\n" + "=" * 50)
print("环境检查完成。如全部✅，可继续下一步！")
print("如有❌，请按提示安装后重试。")
print("=" * 50)
