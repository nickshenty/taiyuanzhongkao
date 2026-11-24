#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Day6 知识管理 - 环境检查脚本
检查 Python、Ollama、pdftotext 等环境是否就绪
"""

import subprocess
import sys
import os

def check_python():
    """检查Python版本"""
    version = sys.version
    print(f"✅ Python 版本: {version.split()[0]}")
    return True

def check_ollama():
    """检查Ollama是否安装且运行中"""
    try:
        result = subprocess.run(['ollama', 'list'], capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            # 过滤空行和表头
            models = [l for l in lines if l.strip() and not l.startswith('NAME')]
            if models:
                print(f"✅ Ollama 运行中，共 {len(models)} 个模型可用:")
                for m in models:
                    name = m.split()[0]
                    print(f"   - {name}")
                return True
            else:
                print("⚠️  Ollama 运行中，但没有已下载的模型")
                return False
        else:
            print("❌ Ollama 未运行，请在终端执行: ollama serve")
            return False
    except FileNotFoundError:
        print("❌ Ollama 未安装")
        return False
    except subprocess.TimeoutExpired:
        print("❌ Ollama 响应超时，可能服务未启动")
        return False
    except Exception as e:
        print(f"❌ Ollama 检查失败: {e}")
        return False

def check_pdftotext():
    """检查pdftotext是否可用"""
    try:
        result = subprocess.run(['which', 'pdftotext'], capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            print(f"✅ pdftotext 可用: {result.stdout.strip()}")
            return True
        else:
            print("⚠️  pdftotext 未安装（处理PDF时需要）")
            print("   安装方法: brew install poppler")
            return False
    except Exception:
        print("⚠️  pdftotext 检查失败")
        return False

def check_python_packages():
    """检查Python依赖包"""
    packages = {
        'ollama': '调用本地AI模型',
    }
    
    all_ok = True
    for pkg, desc in packages.items():
        try:
            __import__(pkg)
            print(f"✅ {pkg} 已安装（{desc}）")
        except ImportError:
            print(f"❌ {pkg} 未安装（{desc}）")
            print(f"   安装: pip3 install {pkg}")
            all_ok = False
    
    return all_ok

def check_data_files():
    """检查示例数据文件"""
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
    
    expected_files = [
        '监管文件_普惠金融指导意见.txt',
        '政策文件_旧版.txt',
        '政策文件_新版.txt',
        '会议记录_普惠金融工作推进会.txt',
    ]
    
    kb_dir = os.path.join(data_dir, '知识库')
    expected_kb_files = [
        '小微企业税收优惠政策.txt',
        '个人经营性贷款产品手册.txt',
        '普惠金融信贷风险管理制度.txt',
        '乡村振兴金融服务政策要点.txt',
    ]
    
    all_ok = True
    for f in expected_files:
        path = os.path.join(data_dir, f)
        if os.path.exists(path):
            size = os.path.getsize(path)
            print(f"✅ {f}（{size//1024}KB）")
        else:
            print(f"❌ 缺少文件: {f}")
            all_ok = False
    
    for f in expected_kb_files:
        path = os.path.join(kb_dir, f)
        if os.path.exists(path):
            size = os.path.getsize(path)
            print(f"✅ 知识库/{f}（{size//1024}KB）")
        else:
            print(f"❌ 缺少文件: 知识库/{f}")
            all_ok = False
    
    return all_ok

def main():
    print("=" * 50)
    print("  Day6 知识管理 - 环境检查")
    print("=" * 50)
    print()
    
    print("【1/5】检查 Python...")
    check_python()
    print()
    
    print("【2/5】检查 Ollama...")
    check_ollama()
    print()
    
    print("【3/5】检查 pdftotext（PDF处理工具）...")
    check_pdftotext()
    print()
    
    print("【4/5】检查 Python 依赖包...")
    check_python_packages()
    print()
    
    print("【5/5】检查示例数据文件...")
    check_data_files()
    print()
    
    print("=" * 50)
    print("  环境检查完成！")
    print("=" * 50)
    print()
    print("如果以上都是 ✅，可以开始学习啦！")
    print("如果有 ❌，请按提示安装缺失的组件。")
    print()
    print("学习指南请参考: 学习指南_Day6.md")

if __name__ == '__main__':
    main()
