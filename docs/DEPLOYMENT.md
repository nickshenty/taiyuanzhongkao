# 部署上线指南

把本系统从本机开发环境部署到公网，让其他人可以通过域名访问。

---

## 一、先决定两件事

### 1. 服务器放在哪里（决定是否需要备案）

| 方案 | 备案 | 大陆访问速度 | 说明 |
|------|------|-------------|------|
| **大陆云服务器**（阿里云/腾讯云）| **需要 ICP 备案** | 快 | 备案约 1–3 周，期间域名无法解析到大陆服务器 |
| **香港/海外 VPS** | 不需要 | 一般（100–300ms） | 开箱即用，适合先上线试用 |
| 内网穿透（Cloudflare Tunnel 等）| 不需要 | 视线路而定 | 无需公网 IP，适合临时演示，不建议长期 |

> **关于备案**：个人可以备案非经营性网站，但教育类内容审核较严。
> 若你打算长期运营或涉及付费咨询，建议以企业主体备案并向云厂商客服确认类目。
> 只想尽快让朋友试用，先用香港 VPS 最省事。

### 2. 技术栈保持不变

本项目是 **Node.js + MySQL + React 单页应用**，一台 2 核 2G 的机器足够：

```
用户浏览器
    │  HTTPS 443
    ▼
  Nginx  ──── 静态文件（前端 dist/）
    │
    └── /api ──► Node (PM2) 127.0.0.1:3002 ──► MySQL 8 (127.0.0.1:3306)
```

数据库不对公网开放，Node 只监听回环，唯一对外的是 Nginx 的 443。

---

## 二、方案 A：单机部署（推荐）

以下命令以 Ubuntu 22.04 为例，域名以 `zk.example.com` 代替，请自行替换。

### 步骤 1：安装基础环境

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx

# MySQL 8
sudo apt-get install -y mysql-server
sudo mysql_secure_installation

# PM2（进程守护）
sudo npm i -g pm2
```

### 步骤 2：创建数据库与账号

```bash
sudo mysql -uroot -p
```

```sql
CREATE DATABASE taiyuan_zhongkao
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- 不要用 root 跑应用，单独建账号
CREATE USER 'taiyuan'@'localhost' IDENTIFIED BY '换成强密码';
GRANT ALL PRIVILEGES ON taiyuan_zhongkao.* TO 'taiyuan'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 步骤 3：拉取代码

```bash
sudo mkdir -p /srv && cd /srv
sudo git clone https://github.com/nickshenty/taiyuanzhongkao.git
cd taiyuanzhongkao
```

### 步骤 4：安装依赖并配置环境变量

```bash
# 后端
cd backend
npm ci --omit=dev
cp .env.production.example .env
nano .env          # 填写 DB_PASSWORD、CORS_ORIGIN 等
```

`.env` 关键项：

```env
NODE_ENV=production
PORT=3002
HOST=127.0.0.1
DB_HOST=127.0.0.1
DB_USER=taiyuan
DB_PASSWORD=上一步设置的密码
DB_NAME=taiyuan_zhongkao
CORS_ORIGIN=            # 同域部署留空即可
TRUST_PROXY=1
```

### 步骤 5：建表并导入数据

```bash
cd /srv/taiyuanzhongkao

# 建表（按顺序执行迁移）
for f in backend/database/migrations/*.sql; do
  mysql -utaiyuan -p taiyuan_zhongkao < "$f"
done

# 导入数据（录取线、预测、定向名额、招生计划）
cd backend && npm run seed
```

预期输出：

```
✅ years：10 条
✅ schools：114 条（当前在用 99 条，基准年 2026）
✅ admission_lines：852 条
✅ junior_schools：145 条，quota_allocations：2165 条
✅ predictions(2027)：99 条
✅ enrollment_plans：703 条
```

### 步骤 6：构建前端

```bash
cd /srv/taiyuanzhongkao/taiyuan-zhongkao-volunteer
npm ci
npm run build          # 产物在 dist/

sudo mkdir -p /var/www/taiyuan-zhongkao
sudo cp -r dist/* /var/www/taiyuan-zhongkao/
sudo chown -R www-data:www-data /var/www/taiyuan-zhongkao
```

> 前端默认用相对路径 `/api`，与 Nginx 同域部署即可，**无需**设置 `VITE_API_BASE`。

### 步骤 7：启动后端

```bash
cd /srv/taiyuanzhongkao
mkdir -p logs
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup            # 按提示执行输出的那行命令，实现开机自启

# 确认
pm2 status
curl -s localhost:3002/health
```

### 步骤 8：配置 Nginx 与 HTTPS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/taiyuan-zhongkao
sudo sed -i 's/zk.example.com/你的域名/g' /etc/nginx/sites-available/taiyuan-zhongkao
sudo ln -s /etc/nginx/sites-available/taiyuan-zhongkao /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 先只启用 HTTP 部分以便申请证书（或直接跑 certbot 的 nginx 模式）
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名

sudo nginx -t && sudo systemctl reload nginx
```

certbot 会自动申请证书、改写配置并设置自动续期（`systemctl list-timers | grep certbot` 可查）。

### 步骤 9：验证

```bash
curl -I https://你的域名/                 # 200，且带 HSTS
curl -s https://你的域名/api/years | head  # 返回 JSON
curl -s https://你的域名/health            # {"status":"ok"}

# 推荐接口
curl -s -X POST https://你的域名/api/recommendations \
  -H 'Content-Type: application/json' \
  -d '{"studentScore":700,"juniorSchoolId":"junior_001","targetYear":2027}'
```

浏览器打开 `https://你的域名`，用手机再验一遍。

---

## 三、方案 B：Docker Compose

适合希望 MySQL 与 API 一起容器化管理的场景。

```bash
cd /srv/taiyuanzhongkao/deploy
cp .env.example .env && nano .env     # 设置两个强密码
docker compose up -d

# 查看状态
docker compose ps
docker compose logs -f api
```

Compose 会：
- 首次启动自动执行 `backend/database/migrations/*.sql` 建表
- MySQL 与 API 均只绑定 `127.0.0.1`，公网不可直连
- 数据持久化在 `mysql-data` 卷中

**数据导入**（在仓库根目录执行，连本机 3306）：

```bash
cd /srv/taiyuanzhongkao/backend
# 临时用 compose 里配置的账号连本机端口
DB_HOST=127.0.0.1 DB_USER=taiyuan DB_PASSWORD=你的密码 npm run seed
```

前端构建与 Nginx 配置同方案 A 的步骤 6、8。

---

## 四、日常运维

### 年度数据更新（每年 7 月中考录取结束后）

```bash
cd /srv/taiyuanzhongkao

# 1) 把新的分数线/招生计划 CSV 放到 data/sources/
# 2) 解析（脚本自动识别年份）
node scripts/parse-score-csv.js --year=2027
node scripts/parse-enrollment-csv.js --year=2027

# 3) 重建历史 → 生成预测（目标年 = 最新年 + 1，自动推导）
node scripts/build-history.js
node scripts/generate-predictions.js

# 4) 导入数据库
cd backend && npm run seed

# 5) 前端无需重新构建（数据全由接口提供），刷新页面即可
```

> 若 2028 年官方公布新的总分/控制线，更新 `data/years/2028.json` 后重跑即可，
> 预测会按新框架重算。

### 数据库备份

```bash
# 每天 3:00 备份，保留 14 天
cat > /etc/cron.daily/tyzk-backup <<'EOF'
#!/bin/bash
set -e
DIR=/srv/backups
mkdir -p "$DIR"
mysqldump -utaiyuan -p'密码' --single-transaction --routines taiyuan_zhongkao \
  | gzip > "$DIR/tyzk-$(date +%F).sql.gz"
find "$DIR" -name 'tyzk-*.sql.gz' -mtime +14 -delete
EOF
sudo chmod +x /etc/cron.daily/tyzk-backup
```

### 日志与监控

```bash
pm2 logs taiyuan-zhongkao-api --lines 100     # 应用日志
sudo tail -f /var/log/nginx/access.log         # 访问日志
pm2 monit                                      # CPU/内存
```

建议加一个免费的外部探活（如 UptimeRobot）监控 `https://你的域名/health`。

### 发版更新

```bash
cd /srv/taiyuanzhongkao
git pull

# 后端有改动时
cd backend && npm ci --omit=dev && pm2 reload taiyuan-zhongkao-api

# 前端有改动时（重新构建并覆盖静态文件）
cd ../taiyuan-zhongkao-volunteer && npm ci && npm run build
sudo cp -r dist/* /var/www/taiyuan-zhongkao/
```

`pm2 reload` 是零停机重载；前端资源带 hash，覆盖后用户刷新即生效。

---

## 五、安全与合规检查清单

上线前逐项确认：

- [ ] `.env` 未提交到 Git（`.gitignore` 已包含）
- [ ] 数据库使用独立账号，非 root；密码 ≥16 位
- [ ] MySQL 仅监听 `127.0.0.1`，不暴露 3306
- [ ] 后端 `HOST=127.0.0.1`，仅通过 Nginx 对外
- [ ] 已启用 HTTPS，HTTP 自动跳转
- [ ] `CORS_ORIGIN` 设为实际域名（同域部署可留空）
- [ ] 限流默认值合适（全局 300/分，推荐 60/分），可按流量调整
- [ ] 已配置数据库每日备份并验证过恢复
- [ ] 页面已有免责声明（"预测仅供参考，以官方发布为准"）
- [ ] 已确认备案状态与网站内容类目一致

> 本系统提供的是**统计预测**，不构成录取承诺。
> 页脚与"关于"页均已注明"预测数据仅供参考，实际录取以太原市教育局官方发布为准"，
> 请保留该提示。

---

## 六、成本估算（参考）

| 项目 | 费用 |
|------|------|
| 云服务器 2 核 2G | ¥60–100 /月（轻量应用服务器更便宜）|
| 域名 | ¥30–60 /年 |
| HTTPS 证书 | 免费（Let's Encrypt）|
| 备案 | 免费，需时间 |
| **合计** | **约 ¥800–1300 /年** |

---

## 七、常见问题

**Q：打开域名显示 502**
Nginx 连不上后端。检查 `pm2 status` 是否 online、`curl 127.0.0.1:3002/health` 是否通。

**Q：接口返回 500，日志显示数据库连接失败**
数据库没起或密码不对。`systemctl status mysql`，再核对 `backend/.env`。

**Q：前端页面正常但接口 404**
Nginx 的 `location /api/` 未生效。确认 `proxy_pass http://taiyuan_api;`（注意末尾无斜杠，路径会原样转发）。

**Q：手机能开但电脑打不开，或反之**
检查 DNS 解析与 HTTPS 证书是否覆盖所用域名（`www` 需单独签发或加泛域名）。

**Q：想限制只有特定人能用**
可加 Nginx `auth_basic` 简单口令，或在后端加一个 `X-Access-Token` 校验中间件。

**Q：要不要上 CDN**
当前静态资源总大小约 600KB（gzip 后 ~170KB），CDN 收益有限。用户量上来后再考虑。
