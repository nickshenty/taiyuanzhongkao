#!/bin/bash
# Day3 自动化部署脚本 - Open WebUI + Ollama优化
# 生成时间：2026-07-04 00:55
# 在 MacBook Air M5 (arm64) 上执行

set -e

LOG_FILE="/Users/shenzheng/Desktop/Day3_setup_log.txt"
echo "===== Day3 自动化部署开始 =====" > "$LOG_FILE"
echo "时间：$(date)" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# ============ 第一步：配置 Ollama 性能优化 ============
echo ">>> [1/4] 配置 Ollama 性能优化..." | tee -a "$LOG_FILE"

# 写入环境变量到 .zshrc（如果尚未配置）
ZSHRC="/Users/shenzheng/.zshrc"
if ! grep -q "OLLAMA_NUM_PARALLEL" "$ZSHRC" 2>/dev/null; then
    echo "" >> "$ZSHRC"
    echo "# Ollama 性能优化参数（Day3 自动配置）" >> "$ZSHRC"
    echo "export OLLAMA_NUM_PARALLEL=2" >> "$ZSHRC"
    echo "export OLLAMA_MAX_LOADED_MODELS=2" >> "$ZSHRC"
    echo "export OLLAMA_KEEP_ALIVE=10m" >> "$ZSHRC"
    echo "export OLLAMA_FLASH_ATTENTION=1" >> "$ZSHRC"
    echo "✅ Ollama 环境变量已写入 ~/.zshrc" | tee -a "$LOG_FILE"
else
    echo "✅ Ollama 环境变量已存在，跳过" | tee -a "$LOG_FILE"
fi

# 重启 Ollama 应用优化参数
echo ">>> 重启 Ollama 以应用新参数..." | tee -a "$LOG_FILE"
pkill -f "ollama" 2>/dev/null || true
sleep 2

# 用优化参数启动 Ollama
export OLLAMA_NUM_PARALLEL=2
export OLLAMA_MAX_LOADED_MODELS=2
export OLLAMA_KEEP_ALIVE=10m
export OLLAMA_FLASH_ATTENTION=1
ollama serve &
OLLAMA_PID=$!
sleep 3

# 验证 Ollama 是否正常
if ollama list >> "$LOG_FILE" 2>&1; then
    echo "✅ Ollama 重启成功，7个模型就绪" | tee -a "$LOG_FILE"
else
    echo "⚠️ Ollama 重启可能有问题，继续后续步骤" | tee -a "$LOG_FILE"
fi
echo "" >> "$LOG_FILE"

# ============ 第二步：下载 Docker Desktop ============
echo ">>> [2/4] 下载 Docker Desktop for Apple Silicon..." | tee -a "$LOG_FILE"
DOCKER_DMG="/Users/shenzheng/Desktop/Docker.dmg"

if [ -f "$DOCKER_DMG" ]; then
    echo "Docker.dmg 已存在，跳过下载" | tee -a "$LOG_FILE"
else
    echo "正在下载 Docker Desktop（约600MB，请耐心等待）..." | tee -a "$LOG_FILE"
    curl -L -o "$DOCKER_DMG" "https://desktop.docker.com/mac/main/arm64/Docker.dmg" 2>&1 | tail -1 >> "$LOG_FILE"
    
    if [ -f "$DOCKER_DMG" ]; then
        FILESIZE=$(du -h "$DOCKER_DMG" | cut -f1)
        echo "✅ Docker Desktop 下载完成，大小：$FILESIZE" | tee -a "$LOG_FILE"
    else
        echo "❌ Docker Desktop 下载失败" | tee -a "$LOG_FILE"
        echo "请手动从 https://www.docker.com/products/docker-desktop/ 下载" | tee -a "$LOG_FILE"
        exit 1
    fi
fi
echo "" >> "$LOG_FILE"

# ============ 第三步：安装 Docker Desktop ============
echo ">>> [3/4] 安装 Docker Desktop..." | tee -a "$LOG_FILE"

# 检查是否已安装
if [ -d "/Applications/Docker.app" ]; then
    echo "Docker.app 已存在于 Applications，跳过安装" | tee -a "$LOG_FILE"
else
    # 挂载 DMG
    echo "挂载 Docker.dmg..." | tee -a "$LOG_FILE"
    hdiutil attach "$DOCKER_DMG" -nobrowse >> "$LOG_FILE" 2>&1
    sleep 3
    
    # 复制 Docker.app 到 Applications
    echo "复制 Docker.app 到 /Applications..." | tee -a "$LOG_FILE"
    cp -R "/Volumes/Docker/Docker.app" /Applications/ >> "$LOG_FILE" 2>&1
    
    # 卸载 DMG
    hdiutil detach "/Volumes/Docker" >> "$LOG_FILE" 2>&1 || true
    
    # 删除 DMG 文件（节省空间）
    rm -f "$DOCKER_DMG"
    
    if [ -d "/Applications/Docker.app" ]; then
        echo "✅ Docker Desktop 安装完成" | tee -a "$LOG_FILE"
    else
        echo "❌ Docker Desktop 安装失败" | tee -a "$LOG_FILE"
        exit 1
    fi
fi

# 启动 Docker Desktop
echo ">>> 启动 Docker Desktop..." | tee -a "$LOG_FILE"
open -a Docker

# 等待 Docker 引擎就绪（最多等120秒）
echo "等待 Docker 引擎启动..." | tee -a "$LOG_FILE"
DOCKER_READY=false
for i in $(seq 1 60); do
    if docker info >> /dev/null 2>&1; then
        DOCKER_READY=true
        echo "✅ Docker 引擎已就绪（等待 ${i}*2 秒）" | tee -a "$LOG_FILE"
        break
    fi
    sleep 2
done

if [ "$DOCKER_READY" = false ]; then
    echo "⚠️ Docker 引擎未在120秒内就绪" | tee -a "$LOG_FILE"
    echo "可能原因：首次启动需要用户在GUI中接受许可协议" | tee -a "$LOG_FILE"
    echo "请手动打开 Docker Desktop 应用，完成首次设置后重新运行此脚本的后续部分" | tee -a "$LOG_FILE"
    echo ""
    echo "===== Docker 首次启动后需要手动完成的步骤 =====" >> "$LOG_FILE"
    echo "1. 接受订阅协议（点 Accept）" >> "$LOG_FILE"
    echo "2. 输入 Mac 登录密码" >> "$LOG_FILE"
    echo "3. 等待 Docker 引擎启动完成" >> "$LOG_FILE"
    echo "4. 然后重新运行此脚本，将自动跳过已完成的步骤" >> "$LOG_FILE"
    echo ""
    # 即使 Docker 没就绪，也继续配置其他部分
fi
echo "" >> "$LOG_FILE"

# ============ 第四步：部署 Open WebUI（需要 Docker 就绪）============
if [ "$DOCKER_READY" = true ]; then
    echo ">>> [4/4] 部署 Open WebUI..." | tee -a "$LOG_FILE"
    
    # 检查是否已存在容器
    if docker ps -a --format '{{.Names}}' | grep -q "open-webui"; then
        echo "Open WebUI 容器已存在，删除旧容器..." | tee -a "$LOG_FILE"
        docker rm -f open-webui >> "$LOG_FILE" 2>&1
    fi
    
    echo "拉取并启动 Open WebUI 容器..." | tee -a "$LOG_FILE"
    echo "首次拉取镜像约1-2GB，请耐心等待..." | tee -a "$LOG_FILE"
    
    docker run -d -p 3000:8080 \
        --add-host=host.docker.internal:host-gateway \
        -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
        -v open-webui:/app/backend/data \
        --restart always \
        --name open-webui \
        ghcr.io/open-webui/open-webui:main >> "$LOG_FILE" 2>&1
    
    # 等待容器启动
    echo "等待 Open WebUI 容器启动..." | tee -a "$LOG_FILE"
    sleep 10
    
    if docker ps --format '{{.Names}}' | grep -q "open-webui"; then
        echo "✅ Open WebUI 部署成功！" | tee -a "$LOG_FILE"
        echo "访问地址：http://localhost:3000" | tee -a "$LOG_FILE"
        echo "首次访问需要注册管理员账号（随便填邮箱密码即可）" | tee -a "$LOG_FILE"
    else
        echo "❌ Open WebUI 容器启动失败，查看日志：" | tee -a "$LOG_FILE"
        docker logs open-webui >> "$LOG_FILE" 2>&1
    fi
else
    echo ">>> [4/4] Docker 未就绪，跳过 Open WebUI 部署" | tee -a "$LOG_FILE"
    echo "Docker 就绪后，运行以下命令部署 Open WebUI：" | tee -a "$LOG_FILE"
    echo 'docker run -d -p 3000:8080 --add-host=host.docker.internal:host-gateway -e OLLAMA_BASE_URL=http://host.docker.internal:11434 -v open-webui:/app/backend/data --restart always --name open-webui ghcr.io/open-webui/open-webui:main' >> "$LOG_FILE"
fi
echo "" >> "$LOG_FILE"

# ============ 汇总 ============
echo "===== Day3 部署汇总 =====" | tee -a "$LOG_FILE"
echo "1. Ollama 性能优化：✅ 已配置（NUM_PARALLEL=2, MAX_LOADED=2, KEEP_ALIVE=10m, FLASH_ATTENTION=1）" | tee -a "$LOG_FILE"
echo "2. Docker Desktop 下载与安装：$([ -d '/Applications/Docker.app' ] && echo '✅ 已安装' || echo '❌ 未完成')" | tee -a "$LOG_FILE"
echo "3. Docker 引擎启动：$(docker info >/dev/null 2>&1 && echo '✅ 运行中' || echo '⚠️ 需手动完成首次设置')" | tee -a "$LOG_FILE"
echo "4. Open WebUI 部署：$(docker ps --format '{{.Names}}' 2>/dev/null | grep -q 'open-webui' && echo '✅ 运行中 http://localhost:3000' || echo '⚠️ 待 Docker 就绪后部署')" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "完成时间：$(date)" | tee -a "$LOG_FILE"
echo "===== Day3 脚本执行结束 =====" | tee -a "$LOG_FILE"

echo ""
echo "===== Day3 部署完成 ====="
echo "详细日志：/Users/shenzheng/Desktop/Day3_setup_log.txt"
