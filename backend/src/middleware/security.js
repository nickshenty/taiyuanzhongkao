/**
 * 生产环境中间件：安全响应头 + 轻量限流
 *
 * 不引入额外依赖（保持部署体积小、无供应链风险）：
 *   - securityHeaders：常规安全头 + 文档页 CSP
 *   - rateLimit：滑动窗口计数，按 IP 限流
 */

/**
 * 安全响应头
 *
 * CSP 说明：接口文档页 (GET /) 内联了样式与脚本，故允许 'unsafe-inline'；
 * 前端 SPA 由 Nginx 独立托管，不使用本 CSP。
 */
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

  if (req.path === '/' || req.path.startsWith('/api')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"
    );
  }

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

/**
 * 滑动窗口限流
 *
 * 单进程内存实现，适用于单机部署；多实例需改用 Redis。
 *
 * @param {object} opts
 * @param {number} opts.windowMs 窗口长度（毫秒）
 * @param {number} opts.max      窗口内最大请求数
 * @param {string} opts.name     用于日志与响应头
 */
export function rateLimit({ windowMs = 60_000, max = 300, name = 'global' } = {}) {
  const hits = new Map(); // ip -> { count, resetAt }

  // 定期清理过期条目，避免内存无限增长；unref 使其不阻塞进程退出
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, rec] of hits) {
      if (rec.resetAt <= now) hits.delete(ip);
    }
  }, windowMs);
  if (typeof timer.unref === 'function') timer.unref();

  return function limiter(req, res, next) {
    // 经过反向代理时需 app.set('trust proxy', ...) 才能拿到真实 IP
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();

    let rec = hits.get(ip);
    if (!rec || rec.resetAt <= now) {
      rec = { count: 0, resetAt: now + windowMs };
      hits.set(ip, rec);
    }
    rec.count += 1;

    const remaining = Math.max(0, max - rec.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(rec.resetAt / 1000)));

    if (rec.count > max) {
      const retryAfter = Math.ceil((rec.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        success: false,
        error: '请求过于频繁，请稍后再试',
        scope: name,
        retryAfter
      });
    }
    next();
  };
}
