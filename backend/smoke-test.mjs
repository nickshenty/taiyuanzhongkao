/**
 * 路由冒烟测试（自适应：自动探测数据库是否可用）
 *
 * 目的：验证 Express 路由挂载、控制器接线、响应结构。
 * 原理：mysql2 连接池惰性连接，导入 app 不会立即连库。
 *
 * 逻辑：
 *   1. 先请求 /api/years 探测数据库是否可用
 *   2. 数据库可用      → 期望 DB 接口 200，并校验关键字段
 *   3. 数据库不可用    → 期望 DB 接口 500（证明路由已挂载，而非 404）
 *
 * 运行：npm run test:smoke
 */
import app from './src/app.js';

const server = app.listen(0);
await new Promise(r => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

let pass = 0;
let fail = 0;
const check = (ok, label, detail = '') => {
  if (ok) {
    pass++;
    console.log(`✅ ${label}${detail ? ' — ' + detail : ''}`);
  } else {
    fail++;
    console.log(`❌ ${label}${detail ? ' — ' + detail : ''}`);
  }
};

const req = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* 非 JSON 响应 */
  }
  return { status: res.status, json };
};

// ---------- 1. 探测数据库 ----------
const probe = await req('GET', '/api/years');
const dbUp = probe.status === 200 && probe.json?.success === true;
console.log(`\n数据库状态：${dbUp ? '可用' : '不可用'}（依据 GET /api/years → ${probe.status}）\n`);

// ---------- 2. 静态接口 ----------
for (const path of ['/health', '/api', '/api/algorithm/info', '/api/recommendations/info']) {
  const r = await req('GET', path);
  check(r.status === 200, `GET ${path}`, `status=${r.status}`);
}

// ---------- 3. 数据接口 ----------
const dataPaths = [
  ['GET', '/api/years'],
  ['GET', '/api/schools?limit=5'],
  ['GET', '/api/schools/types'],
  ['GET', '/api/schools/districts'],
  ['GET', '/api/junior-schools?limit=5'],
  ['GET', '/api/junior-schools/list/all'],
  ['GET', '/api/predictions/2027?limit=5'],
  ['GET', '/api/predictions/2027/statistics']
];

const expected = dbUp ? 200 : 500;
for (const [method, path] of dataPaths) {
  const r = await req(method, path);
  check(r.status === expected, `${method} ${path}`, `status=${r.status} (期望 ${expected})`);
}

// ---------- 4. 数据库可用时校验响应结构 ----------
if (dbUp) {
  const years = await req('GET', '/api/years');
  check(
    Array.isArray(years.json?.data) && years.json.data.length > 0,
    'years 返回非空数组',
    `count=${years.json?.count}`
  );
  check(
    years.json?.data?.some(y => Number(y.year) === 2026),
    'years 含 2026 年',
    ''
  );

  const preds = await req('GET', '/api/predictions/2027?limit=5');
  const list = preds.json?.data ?? [];
  check(list.length > 0, '2027 预测非空', `count=${list.length}`);
  check(
    list.every(p => typeof p.predictedScore === 'number'),
    '预测分数为数值类型',
    ''
  );
  check(
    list.every(p => p.schoolName && p.schoolCode),
    '预测含学校名与代码',
    ''
  );

  const stats = await req('GET', '/api/predictions/2027/statistics');
  check(
    stats.json?.data?.totalPredictions > 0,
    '2027 统计含预测总数',
    `total=${stats.json?.data?.totalPredictions}`
  );

  // 学校历史：数值化校验
  const hist = await req('GET', '/api/schools/65028/history');
  const h0 = hist.json?.history?.[0];
  check(
    h0 && typeof h0.lastLine === 'number',
    '历史分数线为数值类型',
    `lastLine=${h0?.lastLine}`
  );

  // 推荐：核心业务链路
  const junior = await req('GET', '/api/junior-schools?limit=1');
  const jid = junior.json?.data?.[0]?.id;
  if (jid) {
    const rec = await req('POST', '/api/recommendations', {
      studentScore: 700,
      juniorSchoolId: jid,
      targetYear: 2027
    });
    const rd = rec.json?.data;
    check(rec.status === 200 && rd?.success !== false, 'POST /api/recommendations 成功', `status=${rec.status}`);
    const total =
      (rd?.recommendations?.risky?.length ?? 0) +
      (rd?.recommendations?.stable?.length ?? 0) +
      (rd?.recommendations?.safe?.length ?? 0);
    check(total > 0, '推荐返回冲/稳/保结果', `total=${total}`);
    check(
      rd?.recommendations?.risky?.every(s => s.scoreDiff >= -50 - 5),
      '冲档分数差在合理范围',
      ''
    );
  }
}

// ---------- 5. 参数校验 ----------
const bad = await req('POST', '/api/recommendations', {});
check(bad.status === 400, 'POST /api/recommendations 缺参返回 400', `status=${bad.status}`);

const badYear = await req('POST', '/api/recommendations', {
  studentScore: 700,
  juniorSchoolId: 'x',
  targetYear: 1999
});
check(badYear.status === 400, '无效目标年返回 400', `status=${badYear.status}`);

// ---------- 6. 404 ----------
const nf = await req('GET', '/api/__nope__');
check(nf.status === 404, '未知路由返回 404', `status=${nf.status}`);

server.close();
console.log(`\n通过 ${pass}，失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
