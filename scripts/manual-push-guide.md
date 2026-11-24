# GitHub推送问题排查指南

## 问题：Failed to connect to github.com port 443

这通常是网络配置问题，以下是解决方案：

### 方案1：检查网络代理设置

如果你使用VPN或代理：

```bash
# 设置Git使用HTTP代理
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890

# 或设置SOCKS5代理
git config --global http.proxy socks5://127.0.0.1:7890
git config --global https.proxy socks5://127.0.0.1:7890

# 推送
git push origin main
```

### 方案2：使用SSH代替HTTPS

```bash
# 修改远程地址为SSH
git remote set-url origin git@github.com:nickshenty/taiyuanzhongkao.git

# 推送
git push origin main
```

### 方案3：手动推送

在终端执行：
```bash
cd /Users/shenzheng/Documents/TaiyuanZhongkao
git push origin main
```

---

## 自动备份机制说明

从现在开始，每次Kiro在对话中进行程序更新后，会自动尝试推送到GitHub。
如果推送失败，更改仍会保存在本地Git仓库中，你可以稍后手动推送。

查看待推送的提交：
```bash
git log origin/main..HEAD
```
