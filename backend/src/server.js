import app from './app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 太原中考志愿咨询系统 - 后端服务');
  console.log('='.repeat(50));
  console.log(`📡 服务器运行在: http://localhost:${PORT}`);
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 算法版本: v1.5`);
  console.log('='.repeat(50));
  console.log('');
  console.log('可用端点:');
  console.log(`  GET  /health           - 健康检查`);
  console.log(`  GET  /api              - API信息`);
  console.log('');
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n收到SIGINT信号，正在关闭服务器...');
  process.exit(0);
});
