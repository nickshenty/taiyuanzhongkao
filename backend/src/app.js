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

// 端点索引（根路径与 /api 共用一份，避免文档与实现脱节）
const ENDPOINTS = {
  基础: {
    'GET /health': '健康检查',
    'GET /api': '本端点索引'
  },
  年份: {
    'GET /api/years': '所有年份（含总分、控制线）',
    'GET /api/years/:year': '年份详情 + 统计',
    'GET /api/years/:year/schools': '该年全部学校及预测',
    'GET /api/years/:year/batches': '批次配置',
    'GET /api/years/latest/prediction': '最新预测年份'
  },
  学校: {
    'GET /api/schools': '学校列表（?name=&type=&district=&page=&limit=）',
    'GET /api/schools/list/all': '全部学校（按区县分组）',
    'GET /api/schools/types': '学校类型枚举',
    'GET /api/schools/districts': '区县枚举',
    'GET /api/schools/:code': '学校详情',
    'GET /api/schools/:code/history': '历年分数线 + 预测 + 招生计划'
  },
  初中与定向名额: {
    'GET /api/junior-schools': '初中学校列表',
    'GET /api/junior-schools/list/all': '全部初中（按区县分组）',
    'GET /api/junior-schools/:id/quotas': '定向名额（?year=）',
    'GET /api/junior-schools/:id/quotas/history': '历年定向名额'
  },
  预测: {
    'GET /api/predictions/:year': '该年所有预测（分页）',
    'GET /api/predictions/:year/high-confidence': '高置信度预测',
    'GET /api/predictions/:year/statistics': '预测统计与置信度分布',
    'GET /api/predictions/school/:code?year=': '单校预测',
    'POST /api/predictions/generate': '在线生成预测（{year, dryRun}）'
  },
  志愿推荐: {
    'POST /api/recommendations': '冲/稳/保推荐（{studentScore, juniorSchoolId, targetYear}）',
    'GET /api/recommendations/info': '推荐规则说明',
    'GET /api/recommendations/score-range': '按分数区间查学校',
    'GET /api/recommendations/school/:code': '单校匹配度'
  },
  算法: {
    'GET /api/algorithm/info': '算法说明与回测数据',
    'GET /api/algorithm/backtest?year=': '指定年份回测结果'
  }
};

function apiIndex() {
  return {
    service: '太原中考志愿咨询系统 API',
    version: '1.0.0',
    algorithm: ALGORITHM_INFO.version,
    status: 'running',
    note: '本服务仅提供 JSON 接口；前端页面请访问 http://localhost:5173',
    endpoints: ENDPOINTS
  };
}

// 根路径：避免直接访问后端地址时看到 Not Found
app.get('/', (req, res) => res.json(apiIndex()));

// API基础端点
app.get('/api', (req, res) => res.json(apiIndex()));

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

// 算法回测（数据来自 config/algorithmInfo.js 的离线回测结果）
// 说明：不用数据库统计，因为 predictions 表只存"未来年份"的预测，
// 没有对应的实际值；真正的回测是离线跑出来的（见 scripts/generate-predictions.js）。
app.get('/api/algorithm/backtest', (req, res) => {
  const year = req.query.year ? Number(req.query.year) : null;
  const years = ALGORITHM_INFO.backtest.years;
  const picked = year ? years.filter(y => y.year === year) : years;

  if (year && !picked.length) {
    return res.status(404).json({
      success: false,
      error: `没有 ${year} 年的回测数据`,
      availableYears: years.map(y => y.year)
    });
  }

  res.json({
    success: true,
    algorithm: ALGORITHM_INFO.version,
    note: ALGORITHM_INFO.backtest.note,
    years: picked
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    hint: '接口均以 /api 开头，可访问 GET / 查看全部端点索引'
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
