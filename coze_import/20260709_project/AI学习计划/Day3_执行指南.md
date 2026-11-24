# Day 3 执行指南 —— Web界面部署：告别命令行

> 日期：2026-07-03（周五）
> 设备：MacBook Air M5（16GB / Apple Silicon）
> 前置条件：Ollama 已安装且至少有1个模型（Day1已完成 ✅，已有 qwen2.5:7b 等4个模型）

---

## 📋 今日总览

你现在已经能在终端里跟 AI 对话了，但每次都要开终端敲命令，体验确实差点意思。今天的目标是给你装一个**类 ChatGPT 的图形界面**，以后像用网页一样跟 AI 聊天。

有两条路可以走：

| 方案 | 难度 | 适合谁 | 优势 |
|------|------|--------|------|
| **方案A：Open WebUI（Docker）** | ⭐⭐⭐ | 想体验完整 Docker 部署流程 | 功能最全、最像 ChatGPT、支持多模型切换 |
| **方案B：LM Studio** | ⭐ | 不想碰命令行 | 零命令行、苹果M5官方推荐、MLX加速性能翻倍 |

**建议**：两个都装。先花20分钟走方案B（立刻能用），再花30分钟走方案A（体验完整部署流程）。学习嘛，两个都体验一遍最有收获。

---

## 方案A：Open WebUI（Docker 部署）

### 第一步：安装 Docker Desktop

1. **打开浏览器**，访问 https://www.docker.com/products/docker-desktop/
2. 点击 **「Download for Mac」** 按钮
   - ⚠️ 重要：页面会自动识别你的芯片类型，确保显示的是 **「Apple chip」**（不是 Intel chip）
   - 如果没自动识别，手动选 Apple Silicon 版本
3. 下载完成后，找到 `Docker.dmg` 文件（通常在"下载"文件夹）
4. **双击打开** `Docker.dmg`
5. 在弹出的窗口中，**把左边的 Docker 鲸鱼图标拖到右边的 Applications 文件夹**
6. 等待拷贝完成（几十秒）
7. 打开 **启动台（Launchpad）**，找到 Docker 图标，**点击启动**
8. 首次启动会要求：
   - 允许键盘输入权限 → 点「允许」
   - 输入 Mac 登录密码 → 输入你的电脑密码
   - 接受订阅协议 → 点「Accept」（个人使用免费）
9. **等待 Docker 引擎启动**：菜单栏出现鲸鱼图标且不再动画，表示就绪
   - 可以在终端输入 `docker --version` 验证，看到版本号就说明安装成功

> 💡 如果你之前装过 Homebrew，也可以用 `brew install --cask docker` 一键安装，效果一样。

### 第二步：确认 Ollama 在运行

Open WebUI 需要连接 Ollama 才能工作，先确保 Ollama 在跑：

1. 看菜单栏有没有小羊驼图标 🦙
   - 有 → Ollama 在运行，继续下一步
   - 没有 → 打开终端，输入 `ollama serve` 启动
2. 验证模型可用：终端输入 `ollama list`，应该能看到你之前下载的模型列表

### 第三步：部署 Open WebUI

打开**终端**，复制粘贴以下命令并回车：

```bash
docker run -d -p 3000:8080 \
  --add-host=host.docker.internal:host-gateway \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  -v open-webui:/app/backend/data \
  --restart always \
  --name open-webui \
  ghcr.io/open-webui/open-webui:main
```

**命令逐行解释**（不用记，了解即可）：
- `-d`：后台运行
- `-p 3000:8080`：把容器的 8080 端口映射到你电脑的 3000 端口
- `--add-host=host.docker.internal:host-gateway`：让容器能找到你电脑上的 Ollama（Mac 必需）
- `-e OLLAMA_BASE_URL=...`：告诉 Open WebUI 去哪里找 Ollama
- `-v open-webui:/app/backend/data`：保存你的聊天记录和设置
- `--restart always`：开机自动启动
- `--name open-webui`：给容器起个名字方便管理

首次运行会自动下载镜像（约 1-2 GB），耐心等几分钟。

### 第四步：首次使用

1. **打开浏览器**，访问 `http://localhost:3000`
2. 第一次打开会让你**注册管理员账号**：
   - 随便填个邮箱和密码（这是本地账号，不会上传到任何地方）
   - 第一个注册的自动成为管理员
3. 登录后，在左上角的**模型下拉框**应该能看到你 Ollama 里的模型（qwen2.5:7b、glm4:9b 等）
4. **选一个模型，开始聊天！** 🎉

### 如果看不到模型？

这是最常见的问题，按顺序排查：

1. **确认 Ollama 在运行**：终端输入 `ollama list`，能列出模型说明 Ollama 正常
2. **检查 Open WebUI 连接配置**：
   - 点左下角头像 → **Admin Panel**（管理面板）
   - 点 **Settings** → **Connections**
   - 确认 Ollama 地址是 `http://host.docker.internal:11434`
   - 点旁边的刷新按钮，看到绿色✅表示连接成功
3. **查看容器日志**：终端输入 `docker logs open-webui`，看有没有报错
4. **重启容器**：终端输入 `docker restart open-webui`

### Docker 常用管理命令

```bash
# 查看运行中的容器
docker ps

# 停止 Open WebUI
docker stop open-webui

# 启动 Open WebUI
docker start open-webui

# 删除容器（数据不丢，存在 volume 里）
docker rm -f open-webui

# 查看日志
docker logs open-webui
```

---

## 方案B：LM Studio（零命令行）

> 🔥 苹果在 M5 发布时官方点名推荐了 LM Studio，因为它支持 MLX 后端，在 M 芯片上推理速度约为 Ollama 的 2 倍。

### 第一步：下载安装

1. 打开浏览器，访问 https://lmstudio.ai
2. 点击 **「Download for Mac」**（自动识别 Apple Silicon）
3. 下载完成后，双击 `.dmg` 文件
4. 把 LM Studio 图标拖到 Applications 文件夹
5. 从启动台打开 LM Studio

### 第二步：下载模型

LM Studio 有自己的模型库，和 Ollama 的模型格式不同（LM Studio 用 GGUF/MLX 格式）：

1. 打开 LM Studio，在左侧搜索栏输入模型名，比如 `qwen`
2. 选择一个适合的版本（推荐 Q4_K_M 量化版，平衡速度和质量）
3. 点击 **Download**
4. 下载完成后，在左侧点 **Chat**（聊天）图标
5. 顶部下拉选择刚下载的模型，点 **Load**
6. 开始聊天！

### 第三步：开启 MLX 加速（重要！）

这是 LM Studio 在 M5 上的杀手锏：

1. 点左侧 **Settings**（齿轮图标）
2. 找到 **Backend** 或 **Inference Engine**
3. 把默认的 `llama.cpp` 切换为 `MLX`
4. 重新 Load 模型
5. 体验速度提升 🚀

### Context Length 设置建议

在 Settings 里有个 Context Length 滑块，控制模型能"记住"多少内容：

| 场景 | 建议值 | 说明 |
|------|--------|------|
| 日常对话 | 8192 (8K) | 够用，内存占用低 |
| 分析长文档 | 16384 (16K) | 能处理一篇文章 |
| 不要超过 | 32768 (32K) | 16GB 内存扛不住，会崩 |

如果遇到 `Compute error`，基本就是 Context Length 设太大了，调小后 Unload → 重新 Load 即可。

---

## 方案C：直接用 Ollama 的内置 Web 界面（最快）

其实 Ollama 自己也有个简易 Web 界面，如果你不想装 Docker 也不想装 LM Studio，这是最快的：

终端输入：
```bash
# 确认 Ollama 在运行后
# 直接在浏览器访问 Ollama 的 API 页面
open http://localhost:11434
```

不过这个界面非常简陋，仅用于验证 Ollama 是否正常工作。真正日常使用还是推荐方案 A 或 B。

---

## Ollama 性能优化

### 方法一：环境变量配置（推荐）

在终端中设置环境变量，然后重启 Ollama：

```bash
# 停止当前 Ollama
pkill ollama

# 设置优化参数后启动
OLLAMA_NUM_PARALLEL=2 \
OLLAMA_MAX_LOADED_MODELS=2 \
OLLAMA_KEEP_ALIVE=10m \
ollama serve &
```

**参数说明**：
- `OLLAMA_NUM_PARALLEL=2`：允许同时处理 2 个请求（默认1）
- `OLLAMA_MAX_LOADED_MODELS=2`：最多同时加载 2 个模型（16GB 内存建议不超过2）
- `OLLAMA_KEEP_ALIVE=10m`：模型加载后保持 10 分钟不卸载（默认5分钟，减少反复加载）

### 方法二：永久配置（写入 Shell 配置文件）

```bash
# 编辑你的 shell 配置文件（M5 默认是 zsh）
nano ~/.zshrc

# 在文件末尾添加：
export OLLAMA_NUM_PARALLEL=2
export OLLAMA_MAX_LOADED_MODELS=2
export OLLAMA_KEEP_ALIVE=10m

# 保存退出（Ctrl+O 回车保存，Ctrl+X 退出）
# 然后让配置生效：
source ~/.zshrc

# 重启 Ollama
pkill ollama
ollama serve &
```

### 性能优化参数对照表

| 参数 | 默认值 | M5 16GB 推荐值 | 说明 |
|------|--------|---------------|------|
| `OLLAMA_NUM_PARALLEL` | 1 | 2 | 并发请求数 |
| `OLLAMA_MAX_LOADED_MODELS` | 0(无限) | 2 | 同时驻留模型数 |
| `OLLAMA_KEEP_ALIVE` | 5m | 10m | 模型保活时间 |
| `OLLAMA_FLASH_ATTENTION` | 0 | 1 | 开启 Flash Attention（提升速度） |

> ⚠️ `OLLAMA_FLASH_ATTENTION=1` 需要较新版本的 Ollama（v0.1.30+），你安装的 v0.31.1 支持。但部分模型可能不兼容，如果遇到报错就关掉。

---

## 今日验收清单

完成后逐项打勾：

- [ ] Docker Desktop 已安装并运行（方案A）
- [ ] Open WebUI 容器正常运行
- [ ] 浏览器访问 `http://localhost:3000` 能打开界面
- [ ] 能在 Open WebUI 中看到 Ollama 的模型列表
- [ ] 成功在 Web 界面与 AI 对话
- [ ] LM Studio 已安装（方案B）
- [ ] LM Studio 已开启 MLX 加速
- [ ] Ollama 性能参数已优化

---

## 两个方案对比总结

| 维度 | Open WebUI (Docker) | LM Studio |
|------|-------------------|-----------|
| 界面体验 | ⭐⭐⭐⭐⭐ 最像 ChatGPT | ⭐⭐⭐⭐ 简洁好用 |
| M5 性能 | 一般（走 Ollama 的 llama.cpp） | ⭐⭐⭐⭐⭐ MLX 加速，快约2倍 |
| 模型管理 | 复用 Ollama 已有模型 | 需单独下载 GGUF/MLX 格式 |
| 多模型切换 | ✅ 下拉框一键切换 | ✅ 但需先 Load |
| 聊天记录 | ✅ 本地持久化保存 | ✅ 本地保存 |
| 安装难度 | 中等（需要 Docker） | 简单（拖拽安装） |
| 适合场景 | 日常主力使用 | 快速体验、性能优先 |

**教练建议**：日常用 Open WebUI（界面好看、功能全、复用已有模型），需要跑长文档分析或追求速度时切 LM Studio（MLX 加速）。两个工具不冲突，可以共存。

---

## 常见问题 FAQ

**Q: Docker 启动很慢怎么办？**
A: 首次启动需要初始化虚拟机，等 1-2 分钟正常。如果超过 5 分钟，检查系统设置 → 隐私与安全，是否需要授权。

**Q: Open WebUI 打不开页面（localhost:3000 拒绝连接）？**
A: 容器可能还在启动中。终端输入 `docker logs open-webui` 看日志，等到看到 `Uvicorn running on http://0.0.0.0:8080` 再刷新页面。

**Q: 拉取 Docker 镜像很慢/超时？**
A: 国内网络问题。可以配置 Docker 镜像加速：
1. 点击菜单栏 Docker 鲸鱼图标 → Settings → Docker Engine
2. 在 JSON 配置中添加：
```json
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ]
}
```
3. 点 Apply & Restart，然后重新执行部署命令

**Q: LM Studio 下载模型很慢？**
A: LM Studio 的模型来自 HuggingFace，国内访问可能慢。可以尝试：
- 挂代理
- 或者跳过 LM Studio，直接用 Open WebUI + Ollama（模型已经下好了）

**Q: 两个方案可以同时用吗？**
A: 完全可以。但注意不要同时让两个工具加载大模型，16GB 内存同时跑两个 7B 模型会比较紧张。

---

## 明日预告

Day 4（7/4 周六）—— **AI 写作实战**：
- 开启 Apple Intelligence 系统级写作工具
- 用本地模型实战写一份"普惠金融上半年业务通报"
- 学习 Prompt 技巧：角色设定 + 背景信息 + 具体要求
- 对比 Apple Intelligence vs Qwen vs DeepSeek 的写作质量

今天把界面搭好，明天就拿来干活 💪
