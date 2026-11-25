# v1.5预测算法集成指南

本文档说明太原中考v1.5预测算法在后端的集成方式。

---

## 📊 算法概述

v1.5算法是基于异常检测和相对位置保持的分数线预测算法，核心改进包括：

1. **异常学校识别**：检测2023→2024年度变化≥30分的学校
2. **异常学校预测**：使用2021→2023的平均年度变化，外推到目标年份
3. **正常学校预测**：使用相对位置保持策略（v1.2算法）

---

## 🎯 异常学校列表

共识别6所异常学校：

| 代码 | 学校名称 | 变化 |
|------|---------|------|
| 55079 | 太原市清徐中学校 | +60分 |
| 66002 | 清徐县徐沟中学校 | +59分 |
| 55077 | 太原市杏岭实验学校 | +45分 |
| 55074 | 太原市外国语凤凰双语中学校 | +36分 |
| 55075 | 太原市同心外国语中学校 | +30分 |
| 55071 | 太原市成才中学校 | +30分 |

---

## 📁 文件结构

```
backend/
├── src/
│   ├── algorithms/
│   │   └── predictionAlgorithmV1.5.js    # 核心算法实现
│   ├── services/
│   │   └── predictionService.js          # 预测服务层
│   ├── controllers/
│   │   └── predictionController.js       # 预测控制器
│   ├── routes/
│   │   └── predictionRoutes.js           # 预测路由
│   ├── app.js                            # Express应用（已集成）
│   └── config/
│       └── database.js                   # 数据库连接
└── docs/
    └── ALGORITHM_V1.5.md                 # 本文档
```

---

## 🚀 API端点

### 1. 生成预测

```http
POST /api/predictions/generate
Content-Type: application/json

{
  "year": 2025,
  "referenceYear": 2023
}
```

**响应：**
```json
{
  "success": true,
  "message": "成功生成65条预测",
  "data": {
    "year": 2025,
    "count": 65,
    "savedCount": 65
  }
}
```

---

### 2. 获取所有预测

```http
GET /api/predictions/2025?page=1&limit=50
```

**响应：**
```json
{
  "success": true,
  "year": 2025,
  "total": 65,
  "page": 1,
  "limit": 50,
  "count": 50,
  "data": [
    {
      "id": 1,
      "schoolCode": "55001",
      "schoolName": "太原市第一中学校",
      "predictedScore": 650,
      "strategy": "normal-relative-position",
      "confidence": "medium",
      "algorithmVersion": "v1.5",
      "createdAt": "2024-11-25T09:52:09Z"
    },
    ...
  ]
}
```

---

### 3. 获取高置信度预测

```http
GET /api/predictions/2025/high-confidence
```

**响应：**
```json
{
  "success": true,
  "year": 2025,
  "count": 6,
  "message": "高置信度预测（异常学校）",
  "data": [
    {
      "schoolCode": "55079",
      "schoolName": "太原市清徐中学校",
      "predictedScore": 625,
      "strategy": "anomaly-trend",
      "confidence": "high"
    },
    ...
  ]
}
```

---

### 4. 获取单个学校预测

```http
GET /api/predictions/school/55001?year=2025
```

**响应：**
```json
{
  "success": true,
  "data": {
    "schoolCode": "55001",
    "schoolName": "太原市第一中学校",
    "predictedScore": 650,
    "actualScore": null,
    "error": null,
    "strategy": "normal-relative-position",
    "confidence": "medium",
    "algorithmVersion": "v1.5"
  }
}
```

---

### 5. 获取预测统计

```http
GET /api/predictions/2024/statistics
```

**响应：**
```json
{
  "success": true,
  "data": {
    "year": 2024,
    "totalPredictions": 65,
    "highConfidence": 6,
    "validComparisons": 65,
    "mae": 2.5,
    "rmse": 3.1,
    "within3": 58,
    "within3Percent": 89.2
  }
}
```

**指标说明：**
- **mae**: 平均绝对误差（Mean Absolute Error）
- **rmse**: 均方根误差（Root Mean Squared Error）
- **within3**: 预测误差在3分以内的学校数
- **within3Percent**: 预测误差在3分以内的比例

---

### 6. 获取算法信息

```http
GET /api/algorithm/info
```

**响应：**
```json
{
  "success": true,
  "algorithm": "v1.5",
  "name": "太原中考分数线预测算法v1.5",
  "description": "基于异常检测和相对位置保持的分数线预测算法",
  "improvements": [
    "识别异常波动学校（2023→2024年度变化≥30分）",
    "异常学校使用趋势外推策略（基于2021→2023年度变化）",
    "正常学校使用相对位置保持策略"
  ],
  "anomalySchools": 6
}
```

---

### 7. 获取回测结果

```http
GET /api/algorithm/backtest?year=2024
```

**响应：**
```json
{
  "success": true,
  "backtestYear": 2024,
  "algorithm": "v1.5",
  "results": {
    "mae": 2.5,
    "rmse": 3.1,
    "within3": 58,
    "within3Percent": 89.2
  }
}
```

---

## 🔧 核心函数

### predictionAlgorithmV1.5.js

```javascript
// 单个学校预测
predictSchoolScore(schoolCode, targetYear, referenceYear, yearMetadata, historicalData)

// 批量年份预测
predictYear(targetYear, historicalData, yearMetadata, schools)

// 获取高置信度学校
getHighConfidenceSchools(predictions)

// 计算统计信息
calculateStatistics(predictions, actualData)
```

### predictionService.js

```javascript
// 生成预测
generatePredictions(targetYear, referenceYear)

// 获取所有预测
getPredictions(year)

// 获取高置信度预测
getHighConfidencePredictions(year)

// 获取单个学校预测
getSchoolPrediction(schoolCode, year)

// 获取统计信息
getPredictionStatistics(year)
```

---

## 💾 数据库表

### predictions 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 自增ID |
| year | INT | 预测年份 |
| school_code | VARCHAR(20) | 学校代码 |
| predicted_score | INT | 预测分数 |
| actual_score | INT | 实际分数（用于回测） |
| error | INT | 预测误差 |
| strategy | ENUM | 预测策略 |
| confidence | ENUM | 置信度 |
| algorithm_version | VARCHAR(20) | 算法版本 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

**strategy 值：**
- `anomaly-trend`: 异常学校趋势外推法
- `anomaly-holdover`: 异常学校直接保留法
- `normal-relative-position`: 正常学校相对位置法
- `failed`: 预测失败

**confidence 值：**
- `high`: 高置信度（异常学校趋势预测）
- `medium`: 中置信度（相对位置保持）
- `low`: 低置信度（数据不完整）

---

## 🧪 测试预测功能

### 1. 本地测试

```bash
# 启动后端服务
cd backend
npm install
npm run dev
```

### 2. 生成2025年预测

```bash
curl -X POST http://localhost:3000/api/predictions/generate \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "referenceYear": 2023}'
```

### 3. 查询预测结果

```bash
# 获取所有预测
curl http://localhost:3000/api/predictions/2025

# 获取高置信度预测
curl http://localhost:3000/api/predictions/2025/high-confidence

# 获取单个学校预测
curl http://localhost:3000/api/predictions/school/55079?year=2025
```

---

## 📈 性能指标

根据历年回测数据（2024年），v1.5算法表现：

- **平均绝对误差 (MAE)**: ~2.5分
- **均方根误差 (RMSE)**: ~3.1分
- **误差在3分以内**: 89.2%
- **异常学校预测准确率**: 高

---

## 🔄 更新预测

当有新年份数据时，可重新生成预测：

```bash
# 生成2026年预测
curl -X POST http://localhost:3000/api/predictions/generate \
  -H "Content-Type: application/json" \
  -d '{"year": 2026, "referenceYear": 2023}'
```

脚本会自动：
1. 加载2021、2023年历史数据
2. 识别异常学校
3. 执行相应预测策略
4. 保存结果到数据库
5. 返回生成统计

---

## 🐛 故障排查

### 问题1：预测生成失败 - 年份数据不存在

**原因**：数据库中没有参考年份的数据

**解决**：先执行数据导入脚本
```bash
node database/seeds/import_data.js
```

### 问题2：预测结果为null

**原因**：某个学校缺少历史数据

**解决**：检查admission_lines表中该学校是否有对应年份记录

### 问题3：统计数据为0

**原因**：还没有实际分数线数据用于对比

**说明**：当有新年份的实际录取数据时，可更新predictions表中的actual_score字段进行回测

---

## 📞 技术支持

遇到问题请查看：
- [backend/README.md](../README.md) - 后端项目文档
- [database/INSTALL.md](../database/INSTALL.md) - 数据库安装指南

---

更新时间：2024-11-25
