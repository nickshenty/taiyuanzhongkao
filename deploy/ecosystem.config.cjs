/**
 * PM2 进程配置
 *
 * 用法：
 *   npm i -g pm2
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save && pm2 startup    # 开机自启
 *
 * 常用命令：
 *   pm2 status
 *   pm2 logs taiyuan-zhongkao-api
 *   pm2 reload taiyuan-zhongkao-api   # 零停机重载
 */
module.exports = {
  apps: [
    {
      name: 'taiyuan-zhongkao-api',
      cwd: './backend',
      script: 'src/server.js',

      // 单实例即可支撑当前流量；若需多核并行可改 'max'，
      // 但注意限流为内存实现，多实例下需改用 Redis 才能全局生效。
      instances: 1,
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        HOST: '127.0.0.1'
      },

      // 内存超限自动重启，防止泄漏累积
      max_memory_restart: '400M',

      // 崩溃重启策略
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 10,
      min_uptime: '20s',

      // 日志（按日切割需配合 pm2-logrotate）
      output: './logs/out.log',
      error: './logs/error.log',
      merge_logs: true,
      time: true,

      // 优雅退出：与 server.js 中的 SIGTERM 处理配合
      kill_timeout: 10000,
      wait_ready: false,
      listen_timeout: 10000
    }
  ]
};
