# 太原中考志愿咨询系统

根据考生中考分数与就读初中，预测各高中录取线并给出 **冲 / 稳 / 保** 三档志愿参考。

> 预测为统计估计，**非官方数据**，实际录取以太原市教育局发布为准。

---

## 组成

| 模块 | 目录 | 说明 |
|------|------|------|
| **Web 前端** | `taiyuan-zhongkao-volunteer/` | React + Vite + Tailwind，手机/桌面自适应 |
| **后端 API** | `backend/` | Express + MySQL，28 个端点 + HTML 接口文档页 |
| **数据流水线** | `scripts/` | 官方表 OCR 解析 → 历史补全 → 预测生成 |
| **数据** | `data/` | 历年录取线、预测结果、招生计划、定向名额 |
| 微信小程序 | `pages/`、`utils/` | 原生小程序，调用后端 API（见 [docs/MINIPROGRAM.md](docs/MINIPROGRAM.md)）|

---

## 快速开始（本地开发）

```bash
# 1) 数据库（Docker）
docker run -d --name tyzk-mysql \
  -e MYSQL_ROOT_PASSWORD=tyzk123456 \
  -e MYSQL_DATABASE=taiyuan_zhongkao \
  -p 3306:3306 mysql:8.0 \
  --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci

# 2) 后端
cd backend
npm ci
cp .env.example .env          # 填写数据库密码
for f in database/migrations/*.sql; do
  docker exec -i tyzk-mysql mysql -uroot -ptyzk123456 taiyuan_zhongkao < "$f"
done
npm run seed                  # 导入数据
PORT=3002 npm start           # 浏览器打开 http://127.0.0.1:3002/ 看接口文档

# 3) 前端（另开终端）
cd taiyuan-zhongkao-volunteer
npm ci
npm run dev                   # http://localhost:5173
```

手机访问：终端会打印 `Network: http://<你的局域网IP>:5173`，手机连同一 Wi-Fi 后打开该地址。

---

## 数据与算法

**数据规模**

| 内容 | 数量 | 覆盖 |
|------|------|------|
| 录取分数线 | 852 条 | 2017–2026（2019 起为校区级）|
| 2027 年预测 | 99 条 | 90 个普通高中招生单元 + 9 个特色班 |
| 定向名额 | 2,165 条 | 2025 年（145 所初中 × 对应高中）|
| 招生计划 | 703 条 | 2019–2026 |

**算法**：相对位置动量法——把录取线换算成"在当年控制线与总分之间的相对位置"，
消除各年中考总分差异（730 / 660 / 850 / 839）后做趋势外推。

```
relPos_pred = relPos_最近锚点 + 0.5 × clamp(yearly / 2, ±0.05)
```

回测（仅用目标年之前的锚点，无数据泄漏）：稳定框架年份 MAE 7.5–8.7 分，
与 2027 同构的 2026 年回测 **MAE 10.44 分、误差≤10 分占 75.5%**。

详见 [docs/PREDICTION_2027.md](docs/PREDICTION_2027.md)。

---

## 部署上线

完整的公网部署步骤见 **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**，
包含备案说明、Nginx + PM2 配置、Docker Compose 方案、备份与年度更新流程。

配套文件：

- `deploy/nginx.conf` — 站点配置（静态托管 + `/api` 反代 + HTTPS）
- `deploy/ecosystem.config.cjs` — PM2 进程配置
- `deploy/docker-compose.yml` — MySQL + API 容器编排
- `backend/Dockerfile` — 后端镜像
- `backend/.env.production.example` — 生产环境变量模板

---

## 年度更新（每年中考录取结束后）

```bash
# 1) 把新的分数线 / 招生计划 CSV 放进 data/sources/
# 2) 解析、重建历史、生成预测（年份自动推导，无需改代码）
node scripts/parse-score-csv.js --year=2027
node scripts/parse-enrollment-csv.js --year=2027
node scripts/build-history.js
node scripts/generate-predictions.js

# 3) 导入数据库
cd backend && npm run seed
```

前端数据全部来自接口，无需重新构建。

---

## 文档索引

| 文档 | 内容 |
|------|------|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | 部署上线、运维、备份、常见问题 |
| [docs/PREDICTION_2027.md](docs/PREDICTION_2027.md) | 数据审计、算法修正、回测证据 |
| [docs/MINIPROGRAM.md](docs/MINIPROGRAM.md) | 微信小程序部署：备案、域名配置、审核发布 |
| [docs/ENROLLMENT_PLAN.md](docs/ENROLLMENT_PLAN.md) | 招生计划采集与特征有效性验证（结论：不纳入模型）|
| [backend/docs/ALGORITHM_V1.5.md](backend/docs/ALGORITHM_V1.5.md) | 算法与接口详解 |
| [backend/README.md](backend/README.md) | 后端启动、接口清单、测试 |
| [taiyuan-zhongkao-volunteer/README.md](taiyuan-zhongkao-volunteer/README.md) | 前端启动、目录结构、移动端适配说明 |

---

## 测试

```bash
cd backend
npm test              # 算法 + 推荐分类单元测试（32 项）
npm run test:smoke    # 接口冒烟测试（自适应有无数据库）
```

---

## 微信小程序

小程序端已改造为**调用后端 API**（不再使用本地静态数据），包含首页推荐与学校详情两个页面。

```
├── app.js / app.json / app.wxss     # 小程序全局配置
├── utils/config.js                  # ★ 接口地址（上线前改 PROD_BASE）
├── utils/api.js                     # wx.request 封装
├── utils/ui.js                      # 冲稳保档位与结果整形
└── pages/index/ , pages/school/     # 两个页面
```

**上线前置条件**：企业/个体户主体 + 已备案域名 + HTTPS
（微信强制要求，且个人主体不支持 web-view）。

完整的备案、后台配置、审核发布步骤见 **[docs/MINIPROGRAM.md](docs/MINIPROGRAM.md)**。

本地调试：用微信开发者工具导入本仓库根目录，勾选「不校验合法域名」即可连
`http://localhost:3002` 运行。

---

## 许可

MIT
