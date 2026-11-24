#!/bin/bash

# 太原中考项目 - GitHub自动备份脚本
# 功能：自动提交更改并推送到GitHub

set -e

# 项目根目录
PROJECT_ROOT="/Users/shenzheng/Documents/TaiyuanZhongkao"
cd "$PROJECT_ROOT"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== 太原中考项目 GitHub 自动备份 ===${NC}"
echo ""

# 检查是否有更改
if git diff-index --quiet HEAD -- 2>/dev/null; then
    echo -e "${YELLOW}没有检测到文件更改，无需备份${NC}"
    exit 0
fi

# 显示更改的文件
echo -e "${GREEN}检测到以下文件已更改:${NC}"
git status --short

# 添加所有更改
echo ""
echo -e "${GREEN}添加文件到暂存区...${NC}"
git add -A

# 生成提交信息（带时间戳）
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
COMMIT_MSG="Auto backup: $TIMESTAMP"

# 如果提供了自定义提交信息，使用它
if [ ! -z "$1" ]; then
    COMMIT_MSG="$1"
fi

# 提交更改
echo -e "${GREEN}提交更改...${NC}"
git commit -m "$COMMIT_MSG"

# 推送到GitHub
echo ""
echo -e "${GREEN}推送到GitHub...${NC}"
git push origin main

echo ""
echo -e "${GREEN}✅ 备份完成！已推送到 https://github.com/nickshenty/taiyuanzhongkao${NC}"
