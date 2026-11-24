# 太原中考志愿咨询系统 - 后端API

Node.js + Express + MySQL 后端服务，提供数据查询和v1.5分数线预测算法。

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

复制环境变量模板并配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置数据库连接信息：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=taiyuan_zhongkao
```

### 3. 初始化数据库

```bash
# 创建数据库
mysql -u root -p
CREATE DATABASE taiyuan_zhongkao CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 执行迁移脚本（待创建）
node database/migrations/001_create_tables.js
node database/seeds/import_data.js
```

### 4. 启动服务

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm start
```

服务默认运行在 `http://localhost:3000`

---

## 📡 API端点

### 健康检查
```
GET /health
```

### 基础信息
```
GET /api
```

### 年份相关
```
GET /api/years                    获取所有年份列表
GET /api/years/:year              获取指定年份信息
```

### 学校相关
```
GET /api/schools                  获取学校列表（支持搜索、分页）
GET /api/schools/:code            获取学校详情
GET /api/schools/:code/history    获取学校历史分数线
```

### 分数线预测
```
GET /api/predictions/:year        获取指定年份所有预测
GET /api/predictions/:year/:code  获取单个学校预测
GET /api/predictions/confidence/high  获取高置信度学校（24所）
```

### 志愿推荐
```
POST /api/recommend
{
  "score": 650,
  "year": 2024,
  "hasQuota": true,
  "juniorSchoolId": "xxx"
}
```

### 算法说明
```
GET /api/algorithm/info           算法介绍
GET /api/algorithm/backtest       回测数据
```

---

## 📂 项目结构

```
backend/
├── src/
│   ├── app.js              # Express应用入口
│   ├── server.js           # 服务器启动
│   ├── routes/             # 路由定义
│   ├── controllers/        # 控制器（处理请求）
│   ├── services/           # 业务逻辑层
│   ├── models/             # 数据模型
│   ├── algorithms/         # v1.5预测算法
│   ├── middleware/         # 中间件
│   └── config/             # 配置文件
│       └── database.js     # 数据库连接池
├── database/
│   ├── migrations/         # 数据库迁移脚本
│   └── seeds/              # 初始数据导入
├── tests/                  # 测试文件
├── .env.example            # 环境变量模板
├── package.json
└── README.md
```

---

## 🔧 技术栈

- **Node.js** 18+
- **Express** 4.x - Web框架
- **MySQL** 8.0 - 数据库
- **mysql2** - MySQL驱动（Promise支持）
- **dotenv** - 环境变量管理
- **cors** - 跨域支持
- **nodemon** - 开发热重载

---

## 📊 数据库设计

### 主要表结构

- `years` - 年份基础信息（控制线、总分）
- `schools` - 学校信息
- `admission_lines` - 历史录取分数线
- `predictions` - 分数线预测（v1.5算法生成）
- `junior_schools` - 初中学校
- `quota_allocations` - 定向名额分配

---

## 🧪 测试

```bash
npm test
```

---

## 📝 开发日志

### v1.0.0 (2024-11-24)
- ✅ 项目初始化
- ✅ Express服务器配置
- ✅ 数据库连接池配置
- ⏳ 数据库表结构设计（进行中）
- ⏳ v1.5算法集成（计划中）
- ⏳ API接口开发（计划中）

---

## 🚀 部署

### 使用PM2部署

```bash
# 安装PM2
npm install -g pm2

# 启动服务
pm2 start src/server.js --name taiyuanzhongkao-api

# 查看日志
pm2 logs taiyuanzhongkao-api

# 重启服务
pm2 restart taiyuanzhongkao-api
```

### Nginx反向代理配置

```nginx
server {
    listen 80;
    server_name api.taiyuanzhongkao.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📄 许可证

MIT
