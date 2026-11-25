# 太原中考志愿咨询系统 - 后端 API

Node.js + Express + MySQL 后端服务，提供全量学校/分数线查询、2027 年分数线预测与志愿推荐。

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd backend && npm install
```

### 2. 启动 MySQL（Docker）

```bash
docker run -d --name tyzk-mysql \
  -e MYSQL_ROOT_PASSWORD=tyzk123456 \
  -e MYSQL_DATABASE=taiyuan_zhongkao \
  -p 3306:3306 mysql:8.0 \
  --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

```env
NODE_ENV=development
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tyzk123456
DB_NAME=taiyuan_zhongkao
CORS_ORIGIN=*
```

### 4. 建表

```bash
docker exec -i tyzk-mysql mysql -uroot -ptyzk123456 taiyuan_zhongkao \
  < database/migrations/001_create_tables.sql
docker exec -i tyzk-mysql mysql -uroot -ptyzk123456 taiyuan_zhongkao \
  < database/migrations/002_fix_prediction_strategy_enum.sql
```

### 5. 生成预测并导入数据

```bash
# 在仓库根目录：补全历史 → 生成 2027 预测
node scripts/build-history-2027.js
node scripts/generate-predictions-2027.js

# 回到 backend：导入数据库
npm run seed
```

### 6. 启动服务

```bash
npm run dev     # 开发（热重载）
npm start       # 生产
```

默认监听 `http://localhost:3000`。

---

## 📡 API 端点

### 基础

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api` | 服务信息与端点索引 |
| GET | `/api/algorithm/info` | 算法说明 |

### 年份

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/years` | 所有年份（含总分、控制线）|
| GET | `/api/years/:year` | 年份详情 + 统计 |
| GET | `/api/years/:year/schools` | 该年全部学校及预测（`?type=`）|
| GET | `/api/years/:year/batches` | 批次配置 |
| GET | `/api/years/latest/prediction` | 最新预测年份 |

### 学校

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/schools` | 列表（`?name=&type=&district=&page=&limit=`）|
| GET | `/api/schools/list/all` | 全部（按区县分组）|
| GET | `/api/schools/types` | 学校类型枚举 |
| GET | `/api/schools/districts` | 区县枚举 |
| GET | `/api/schools/:code` | 学校详情 |
| GET | `/api/schools/:code/history` | 历年分数线 + 预测 |

### 初中学校与定向名额

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/junior-schools` | 列表（`?name=&district=&page=&limit=`）|
| GET | `/api/junior-schools/list/all` | 全部（按区县分组）|
| GET | `/api/junior-schools/:id/quotas` | 定向名额（`?year=`）|
| GET | `/api/junior-schools/:id/quotas/history` | 历年定向名额 |

### 预测

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/predictions/:year` | 该年所有预测（分页）|
| GET | `/api/predictions/:year/high-confidence` | 高置信度预测 |
| GET | `/api/predictions/:year/statistics` | 预测统计与置信度分布 |
| GET | `/api/predictions/school/:code?year=` | 单校预测 |
| POST | `/api/predictions/generate` | 在线生成（`{year, dryRun}`）|

### 志愿推荐（核心）

```http
POST /api/recommendations
Content-Type: application/json

{
  "studentScore": 700,
  "juniorSchoolId": "junior_001",
  "targetYear": 2027
}
```

返回冲/稳/保三档推荐：

| 档位 | 判定 | 返回上限 |
|------|------|----------|
| 冲一冲 `risky` | 考生分数低于预测线 5–10 分 | 3 所 |
| 稳一稳 `stable` | 与预测线相差 ±5 分以内 | 2 所 |
| 保一保 `safe` | 考生分数高于预测线 10 分以上 | 2 所 |

**定向名额修正**：本校有定向名额、且考生分数 ≥ 预测线 − 50 分（且不低于最低控制线）时，
即使统招无望也可通过定向录取，按"冲"档计入并标记 `quotaUpgraded: true`。
目标年定向名额未公布时，自动回退到最近有名额数据的年份，并返回 `quotaNote` 提示。

其他推荐接口：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/recommendations/info` | 推荐规则说明 |
| GET | `/api/recommendations/score-range?minScore=&maxScore=&year=` | 按分数区间查学校 |
| GET | `/api/recommendations/school/:code?studentScore=&year=` | 单校匹配度 |

---

## 📂 项目结构

```
backend/
├── src/
│   ├── app.js                    # Express 应用
│   ├── server.js                 # 启动入口
│   ├── algorithms/
│   │   └── predictionAlgorithmV1.5.js   # 预测算法（纯函数）
│   ├── services/
│   │   ├── predictionService.js  # 预测生成与查询
│   │   └── recommendationService.js     # 志愿推荐
│   ├── controllers/              # 请求处理
│   ├── routes/                   # 路由定义
│   └── config/database.js        # 连接池
├── database/
│   ├── migrations/               # 001 建表 / 002 修正枚举
│   └── seeds/import_all.js       # 统一数据导入
├── tests/                        # 单元测试
├── smoke-test.mjs                # 路由冒烟测试（自适应有无数据库）
└── docs/ALGORITHM_V1.5.md        # 算法与 API 详细说明
```

---

## 🧪 测试

```bash
npm test            # 算法 + 推荐分类单元测试（32 项）
npm run test:smoke  # 路由与接口冒烟（自动探测数据库）
```

冒烟测试在**无数据库**环境下同样通过：此时依赖数据的接口预期返回 500
（证明路由已挂载而非 404）。

---

## 📊 数据库表

| 表 | 说明 |
|----|------|
| `years` | 年份总分/控制线（含 2027 预测框架行）|
| `schools` | 学校基础信息（校区级代码）|
| `admission_lines` | 历年录取线（统招线/定向线）|
| `predictions` | 预测结果（含策略、置信度）|
| `junior_schools` | 初中学校 |
| `quota_allocations` | 定向名额分配 |
| `batches` | 志愿批次配置 |

> `predictions.strategy` 已由 `ENUM('normal','anomaly')` 改为 `VARCHAR(32)`，
> 以容纳 `relative-position-momentum` 等实际取值（见迁移 002）。

---

## 📖 算法

见 [docs/ALGORITHM_V1.5.md](docs/ALGORITHM_V1.5.md)，
数据审计与回测证据见 [docs/PREDICTION_2027.md](../docs/PREDICTION_2027.md)。

---

## 📄 许可证

MIT
