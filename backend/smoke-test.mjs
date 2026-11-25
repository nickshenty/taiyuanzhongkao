/**
 * 路由冒烟测试（无需数据库）
 *
 * 目的：验证 Express 应用的路由挂载与控制器接线是否正确。
 * 原理：createPool 是惰性连接，导入 app 不会真正连库。
 *       - 纯静态接口应返回 200
 *       - 依赖数据库的接口在"无数据库"环境下应返回 500（而非 404）
 *       若本机数据库可用，这些用例会变为 200 —— 属预期差异，非缺陷。
 *
 * 运行：npm run test:smoke
 */
import app from './src/app.js';

const server = app.listen(0);
await new Promise(r => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

const cases = [
  ['GET', '/health', 200],
  ['GET', '/api', 200],
  ['GET', '/api/algorithm/info', 200],
  ['GET', '/api/recommendations/info', 200],
  ['GET', '/api/years', 500],
  ['GET', '/api/schools', 500],
  ['GET', '/api/schools/types', 500],
  ['GET', '/api/junior-schools/list/all', 500],
  ['GET', '/api/predictions/2027', 500],
];

let bad = 0;
for (const [method, path, expect] of cases) {
  const res = await fetch(base + path, { method });
  const ok = res.status === expect;
  if (!ok) bad++;
  console.log(`${ok ? '✅' : '❌'} ${method} ${path} -> ${res.status} (expect ${expect})`);
}

// POST 校验：缺参数应 400（不触库）
const r = await fetch(base + '/api/recommendations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
});
console.log(`${r.status === 400 ? '✅' : '❌'} POST /api/recommendations (no body) -> ${r.status} (expect 400)`);
if (r.status !== 400) bad++;

server.close();
console.log(bad === 0 ? '\n✅ 路由冒烟测试全部通过' : `\n❌ ${bad} 项失败`);
process.exit(bad === 0 ? 0 : 1);
