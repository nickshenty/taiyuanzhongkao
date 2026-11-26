import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import predictionRoutes from './routes/predictionRoutes.js';
import schoolRoutes from './routes/schoolRoutes.js';
import juniorSchoolRoutes from './routes/juniorSchoolRoutes.js';
import yearRoutes from './routes/yearRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import { ALGORITHM_INFO } from './config/algorithmInfo.js';

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

// 学校相关路由
app.use('/api/schools', schoolRoutes);

// 初中学校相关路由
app.use('/api/junior-schools', juniorSchoolRoutes);

// 年份相关路由
app.use('/api/years', yearRoutes);

// 志愿推荐相关路由
app.use('/api/recommendations', recommendationRoutes);

// 算法信息（唯一事实来源：config/algorithmInfo.js）
app.get('/api/algorithm/info', (req, res) => {
  res.json({ success: true, ...ALGORITHM_INFO });
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
