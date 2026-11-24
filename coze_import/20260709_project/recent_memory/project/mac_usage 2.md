# MacBook Air M5 AI能力使用指南

## 一、Apple Intelligence（苹果智能）— 系统级AI
这是M5最大的AI卖点，系统级写作、摘要、图像生成都在本地运行。

⚠️ **关键前提**：目前Apple Intelligence需要**美区Apple ID + 系统语言/地区设为美国/英语**，国区暂未开放。

### 开启步骤：
1. 系统设置 → Apple ID切换为美区账号
2. 地区设为美国，语言设为英语
3. 系统设置 → Apple Intelligence & Siri → 加入等待列表
4. 收到通知后开启

### 核心功能：
- **写作工具**：选中文字后右键或 `Control+Command+空格`，可润色、改写、摘要、翻译
- **Siri增强**：支持上下文理解 + ChatGPT集成
- **通知摘要**：自动压缩通知为要点
- **Image Playground**：文字描述生成图片

M5每个CPU/GPU核心都集成了Neural Accelerator，本地运行LLM几乎零延迟。

## 二、本地部署私有AI助手 — 隐私优先
如果你不想数据上云，可以在M5上跑本地大模型：

1. **Ollama**（推荐）— 一行命令装好，支持Llama、Qwen、DeepSeek等模型
   ```bash
   brew install ollama
   ollama run qwen2.5:7b    # 通义千问中文很强
   ```
   M5的16GB内存跑7B模型很流畅

2. **apfel** — 直接调用系统内置模型，零配置完全本地化
3. **LM Studio** — 图形界面，适合不想碰命令行的场景

## 三、AI增强核心场景
- **写邮件/公文**：Apple写作工具或本地LLM，用于润色、改写、生成草稿
- **读长文档**：macOS自带摘要功能，选中文字右键→摘要
- **代码辅助**：Cursor + 本地Ollama，隐私安全不泄代码

## 四、推荐组合
1. **Apple Intelligence**（美区账号）：日常润色邮件、摘要通知
2. **Ollama+Qwen2.5**：中文能力强，适合公文、学习、投资分析
3. **Cursor**：配合本地模型进行编程辅助