import app from './app.js';
import dotenv from 'dotenv';
import { testConnection } from './config/database.js';
import pool from './config/database.js';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
// 生产环境建议监听 127.0.0.1，由 Nginx 反向代理对外提供服务；
// 如需直接对外可设 HOST=0.0.0.0
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  // 启动前检查数据库，避免服务"假活"（进程在、接口全 500）
  const ok = await testConnection();
  if (!ok && process.env.NODE_ENV === 'production') {
    console.error('❌ 生产环境数据库不可用，启动中止');
    process.exit(1);
  }

  const server = app.listen(PORT, HOST, () => {
    console.log('='.repeat(50));
    console.log('🚀 太原中考志愿咨询系统 - 后端服务');
    console.log('='.repeat(50));
    console.log(`📡 监听地址: http://${HOST}:${PORT}`);
    console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📖 接口文档: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/`);
    console.log(`🩺 健康检查: /health`);
    console.log('='.repeat(50));
  });

  // 优雅关闭：先停止接收新连接，再关闭数据库连接池
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n收到 ${signal}，正在优雅关闭…`);

    server.close(async () => {
      try {
        await pool.end();
        console.log('✅ 数据库连接池已关闭，进程退出');
      } catch (e) {
        console.error('关闭连接池出错：', e.message);
      }
      process.exit(0);
    });

    // 兜底：10 秒内未能关闭则强制退出
    setTimeout(() => {
      console.error('⚠️ 关闭超时，强制退出');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('未处理的 Promise 拒绝：', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('未捕获异常：', err);
    // 生产环境遇到未知异常直接退出，交由 PM2/Docker 重启，避免状态不确定
    if (process.env.NODE_ENV === 'production') process.exit(1);
  });
}

start();
