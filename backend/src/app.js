import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import predictionRoutes from './routes/predictionRoutes.js';

// 加载环境变量
dotenv.config();

const app = express();

// 中间件配置
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API基础端点
app.get('/api', (req, res) => {
  res.json({
    message: '太原中考志愿咨询系统 API',
    version: '1.0.0',
    algorithm: 'v1.5',
    endpoints: {
      predictions: 'GET /api/predictions/:year',
      algorithm: 'GET /api/algorithm/info',
      backtest: 'GET /api/algorithm/backtest'
    }
  });
});

// ==================== 路由挂载 ====================

// 预测相关路由
app.use('/api/predictions', predictionRoutes);

// 算法信息路由（备用入口）
app.get('/api/algorithm/info', (req, res) => {
  res.json({
    success: true,
    algorithm: 'v1.5',
    name: '太原中考分数线预测算法v1.5',
    description: '基于异常检测和相对位置保持的分数线预测算法',
    improvements: [
      '识别异常波动学校（2023→2024年度变化≥30分）',
      '异常学校使用趋势外推策略（基于2021→2023年度变化）',
      '正常学校使用相对位置保持策略'
    ],
    anomalySchools: 6,
    strategies: {
      anomaly_trend: '异常学校趋势外推法',
      anomaly_holdover: '异常学校直接保留法',
      normal_relative_position: '正常学校相对位置法'
    }
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

export default app;

export default app;
