# GitHub 自动备份使用说明

## 🔗 GitHub仓库地址
https://github.com/nickshenty/taiyuanzhongkao

---

## 📦 已配置的备份方式

### 方式1：自动备份脚本（推荐）
**路径**: `scripts/git-auto-backup.sh`

**功能**：
- 自动检测文件更改
- 显示更改的文件列表
- 自动提交并推送到GitHub
- 带时间戳的提交信息

**使用方法**：
```bash
# 自动备份（使用时间戳作为提交信息）
./scripts/git-auto-backup.sh

# 自定义提交信息
./scripts/git-auto-backup.sh "完成v1.5算法开发"
```

---

### 方式2：快速备份脚本
**路径**: `scripts/git-quick-backup.sh`

**功能**：一键提交并推送

**使用方法**：
```bash
# 快速备份
./scripts/git-quick-backup.sh

# 带自定义信息
./scripts/git-quick-backup.sh "新增uni-app前端"
```

---

### 方式3：手动Git命令
```bash
cd /Users/shenzheng/Documents/TaiyuanZhongkao

# 查看状态
git status

# 添加所有更改
git add -A

# 提交
git commit -m "你的提交信息"

# 推送到GitHub
git push origin main
```

---

## 🔄 定时自动备份（可选）

### 使用macOS launchd设置每日自动备份

1. 创建定时任务配置：
```bash
cat > ~/Library/LaunchAgents/com.taiyuanzhongkao.backup.plist << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.taiyuanzhongkao.backup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/shenzheng/Documents/TaiyuanZhongkao/scripts/git-auto-backup.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>18</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/taiyuanzhongkao-backup.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/taiyuanzhongkao-backup-error.log</string>
</dict>
</plist>
PLIST
```

2. 加载定时任务：
```bash
launchctl load ~/Library/LaunchAgents/com.taiyuanzhongkao.backup.plist
```

3. 查看任务状态：
```bash
launchctl list | grep taiyuanzhongkao
```

4. 停止定时任务：
```bash
launchctl unload ~/Library/LaunchAgents/com.taiyuanzhongkao.backup.plist
```

---

## 📋 .gitignore 配置

已排除以下文件/目录：
- `node_modules/` - Node.js依赖
- `.env*` - 环境变量文件
- `.tools/` - 工具目录
- `tmp/`, `logs/` - 临时文件和日志
- `project.private.config.json` - 微信小程序私有配置
- `.DS_Store` - macOS系统文件

---

## ✅ 首次推送检查清单

- [x] 添加远程仓库：`git remote add origin https://github.com/nickshenty/taiyuanzhongkao.git`
- [x] 创建 `.gitignore`
- [x] 创建备份脚本
- [ ] 首次推送：`./scripts/git-quick-backup.sh "Initial commit"`

---

## 🚨 注意事项

1. **敏感信息**：确保不要提交包含密码、API密钥等敏感信息的文件
2. **大文件**：避免提交超过100MB的大文件
3. **分支管理**：默认推送到 `main` 分支
4. **网络连接**：推送前确保网络连接正常

---

## 📞 问题排查

### 推送失败：Authentication failed
**解决方案**：配置GitHub访问令牌
```bash
# 使用Personal Access Token
git remote set-url origin https://YOUR_TOKEN@github.com/nickshenty/taiyuanzhongkao.git
```

### 推送失败：rejected
**原因**：远程仓库有本地没有的提交
**解决方案**：
```bash
git pull origin main --rebase
git push origin main
```

---

## 🎯 最佳实践

1. **频繁提交**：完成一个功能模块后立即备份
2. **清晰的提交信息**：描述本次更改的内容
3. **定期检查**：访问GitHub仓库确认备份成功
4. **分支策略**：重要功能开发使用独立分支

---

更新时间：2024-11-24
