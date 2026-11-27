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
import { API_GROUPS, toFlatIndex } from './config/apiEndpoints.js';
import { renderApiDocs } from './docs/apiDocsHtml.js';
import { securityHeaders, rateLimit } from './middleware/security.js';

// 加载环境变量
dotenv.config();

const app = express();

// 位于 Nginx 等反向代理之后时，需信任代理才能取到真实客户端 IP（限流按 IP 计数）
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

// 安全响应头
app.use(securityHeaders);

// 中间件配置
// 生产环境务必把 CORS_ORIGIN 设为实际域名（支持逗号分隔多个）；
// 开发环境默认放开，便于本机联调。
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : process.env.NODE_ENV === 'production'
    ? false // 生产环境未配置时不启用跨域（前后端同源部署即可正常工作）
    : '*';

app.use(
  cors({
    origin: corsOrigin,
    credentials: true
  })
);

// 请求体大小限制，防止超大 payload 占满内存
app.use(bodyParser.json({ limit: process.env.BODY_LIMIT || '256kb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: process.env.BODY_LIMIT || '256kb' }));

// 全局限流
app.use(
  '/api',
  rateLimit({
    windowMs: Number(process.env.RATE_WINDOW_MS ?? 60_000),
    max: Number(process.env.RATE_MAX ?? 300),
    name: 'global'
  })
);

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

// 端点索引：定义见 config/apiEndpoints.js（HTML 文档与 JSON 共用同一份）
function apiIndex() {
  return {
    service: '太原中考志愿咨询系统 API',
    version: '1.0.0',
    algorithm: ALGORITHM_INFO.version,
    status: 'running',
    docs: 'GET / 为 HTML 文档页；本路径返回 JSON 索引',
    frontend: 'http://localhost:5173',
    endpoints: toFlatIndex()
  };
}

// 根路径：HTML 接口文档页（避免直接访问后端看到 Not Found）
app.get('/', (req, res) => {
  res.type('html').send(renderApiDocs());
});

// API基础端点
app.get('/api', (req, res) =>
  res.json({
    ...apiIndex(),
    groups: API_GROUPS.map(g => ({ title: g.title, count: g.items.length }))
  })
);

// ==================== 路由挂载 ====================

// 预测相关路由
app.use('/api/predictions', predictionRoutes);

// 学校相关路由
app.use('/api/schools', schoolRoutes);

// 初中学校相关路由
app.use('/api/junior-schools', juniorSchoolRoutes);

// 年份相关路由
app.use('/api/years', yearRoutes);

// 志愿推荐相关路由（计算较重，单独更严格限流）
app.use(
  '/api/recommendations',
  rateLimit({
    windowMs: Number(process.env.REC_RATE_WINDOW_MS ?? 60_000),
    max: Number(process.env.REC_RATE_MAX ?? 60),
    name: 'recommendations'
  }),
  recommendationRoutes
);

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
