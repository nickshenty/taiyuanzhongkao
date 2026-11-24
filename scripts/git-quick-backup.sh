#!/bin/bash
# 快速备份脚本 - 一键提交并推送到GitHub

cd /Users/shenzheng/Documents/TaiyuanZhongkao

# 自定义提交信息（可选参数）
MESSAGE="${1:-Auto backup: $(date '+%Y-%m-%d %H:%M:%S')}"

echo "🔄 开始备份到GitHub..."
git add -A
git commit -m "$MESSAGE"
git push origin main
echo "✅ 备份完成！"
