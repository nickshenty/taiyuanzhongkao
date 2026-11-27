/**
 * API 文档 HTML 渲染
 *
 * 设计目标：
 *   1. 单文件渲染，无任何外部依赖（不引 CDN，离线可用）
 *   2. 响应式，手机端可正常浏览
 *   3. GET 接口可"就地测试"，直接显示返回的 JSON
 *
 * 数据来源：config/apiEndpoints.js（端点）+ config/algorithmInfo.js（算法信息）
 */

import { API_GROUPS } from '../config/apiEndpoints.js';
import { ALGORITHM_INFO } from '../config/algorithmInfo.js';

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** 给 :param 占位符填入示例值，便于直接点"测试" */
const SAMPLE = {
  ':year': '2027',
  ':code': '65028',
  ':id': 'junior_001'
};

function samplePath(path) {
  let p = path;
  for (const [k, v] of Object.entries(SAMPLE)) p = p.split(k).join(v);
  return p;
}

function methodClass(m) {
  return m === 'GET' ? 'm-get' : m === 'POST' ? 'm-post' : 'm-other';
}

function renderItem(it, idx) {
  const id = `ep-${idx}`;
  const params = it.params
    ? `<div class="meta"><span class="meta-k">参数</span>
         <div class="meta-v">${Object.entries(it.params)
           .map(([k, v]) => `<code>${esc(k)}</code> ${esc(v)}`)
           .join('<br>')}</div></div>`
    : '';
  const body = it.body
    ? `<div class="meta"><span class="meta-k">请求体</span>
         <div class="meta-v"><pre class="inline">${esc(JSON.stringify(it.body, null, 2))}</pre></div></div>`
    : '';
  const returns = it.returns
    ? `<div class="meta"><span class="meta-k">返回</span>
         <div class="meta-v"><code class="block">${esc(it.returns)}</code></div></div>`
    : '';

  const tester =
    it.method === 'GET'
      ? `<div class="tester" id="t-${id}" hidden>
           <div class="tester-row">
             <input id="u-${id}" value="${esc(samplePath(it.path))}" spellcheck="false" />
             <button class="btn-run" data-id="${id}">发送</button>
           </div>
           <pre class="out" id="o-${id}">点击「发送」查看返回</pre>
         </div>`
      : '';

  const testBtn =
    it.method === 'GET'
      ? `<button class="btn-test" data-id="${id}">测试</button>`
      : '';

  return `
    <article class="ep" id="${id}">
      <div class="ep-head">
        <span class="method ${methodClass(it.method)}">${esc(it.method)}</span>
        <code class="path">${esc(it.path)}</code>
        ${testBtn}
      </div>
      <p class="desc">${esc(it.desc)}</p>
      ${params}${body}${returns}
      ${tester}
    </article>`;
}

export function renderApiDocs() {
  let idx = 0;
  const groups = API_GROUPS.map((g) => {
    const items = g.items.map((it) => renderItem(it, idx++)).join('');
    return `
      <section class="group">
        <h2><span class="badge">${esc(g.icon)}</span>${esc(g.title)}</h2>
        ${items}
      </section>`;
  }).join('');

  const backtest = ALGORITHM_INFO.backtest.years
    .map(
      (y) =>
        `<tr><td>${y.year}</td><td>${y.sample}</td><td class="num">${y.mae}</td><td class="num">${y.within10}%</td><td class="dim">${esc(y.frame)}</td></tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>太原中考志愿咨询系统 · API 文档</title>
<style>
  :root{
    --bg:#f8fafc; --card:#fff; --bd:#e2e8f0; --tx:#0f172a; --tx2:#475569; --tx3:#94a3b8;
    --blue:#2563eb; --blue-bg:#eff6ff; --green:#059669; --amber:#d97706;
  }
  *{box-sizing:border-box}
  html,body{max-width:100%;overflow-x:hidden}
  body{
    margin:0;background:var(--bg);color:var(--tx);
    font:15px/1.65 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
  }
  img,pre,table,code{max-width:100%}
  .wrap{max-width:960px;margin:0 auto;padding:24px 16px 64px}
  header{margin-bottom:24px}
  h1{font-size:22px;margin:0 0 8px}
  .sub{color:var(--tx2);font-size:14px;margin:0}
  .pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
  .pill{font-size:12px;padding:3px 10px;border-radius:999px;background:var(--blue-bg);color:var(--blue);border:1px solid #dbeafe}
  .pill.gray{background:#f1f5f9;color:var(--tx2);border-color:var(--bd)}

  .card{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:16px;margin-bottom:20px}
  .card h3{margin:0 0 8px;font-size:15px}
  .card p{margin:6px 0;color:var(--tx2);font-size:14px}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}
  code.block{
    display:block;background:#f8fafc;border:1px solid var(--bd);border-radius:6px;
    padding:8px 10px;margin-top:4px;color:var(--tx2);
    white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;
  }

  .group{margin-bottom:28px}
  h2{font-size:16px;margin:0 0 12px;display:flex;align-items:center;gap:8px}
  .badge{
    display:inline-flex;align-items:center;justify-content:center;
    width:22px;height:22px;border-radius:6px;background:#e0e7ff;color:#4338ca;
    font-size:12px;font-weight:600;text-transform:uppercase;
  }

  .ep{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:14px;margin-bottom:10px}
  .ep-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .method{
    font-size:11px;font-weight:700;padding:2px 8px;border-radius:5px;letter-spacing:.4px;
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  }
  .m-get{background:#dcfce7;color:#15803d}
  .m-post{background:#fef3c7;color:#b45309}
  .m-other{background:#e2e8f0;color:#475569}
  .path{background:#f8fafc;padding:2px 8px;border-radius:5px;border:1px solid var(--bd);word-break:break-all}
  .desc{margin:8px 0 0;font-size:14px;color:var(--tx2)}
  .btn-test{
    margin-left:auto;font-size:12px;padding:3px 10px;border-radius:6px;cursor:pointer;
    background:#fff;border:1px solid var(--bd);color:var(--blue);
  }
  .btn-test:hover{background:var(--blue-bg);border-color:#bfdbfe}

  .meta{display:flex;gap:10px;margin-top:8px;font-size:13px}
  .meta-k{flex:0 0 52px;color:var(--tx3);font-size:12px;padding-top:2px}
  .meta-v{color:var(--tx2);min-width:0;flex:1}
  .meta-v code{background:#f1f5f9;padding:1px 5px;border-radius:4px;margin-right:4px}

  pre.inline{margin:4px 0 0;background:#0f172a;color:#e2e8f0;padding:10px;border-radius:6px;overflow-x:auto;font-size:12.5px}

  .tester{margin-top:10px;padding-top:10px;border-top:1px dashed var(--bd)}
  .tester-row{display:flex;gap:8px}
  .tester input{
    flex:1;min-width:0;padding:7px 10px;border:1px solid var(--bd);border-radius:6px;
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;
  }
  .btn-run{padding:7px 14px;border-radius:6px;border:1px solid var(--blue);background:var(--blue);color:#fff;cursor:pointer;font-size:13px}
  .btn-run:disabled{opacity:.6;cursor:default}
  .out{
    margin:8px 0 0;background:#0f172a;color:#e2e8f0;padding:10px;border-radius:6px;
    overflow:auto;max-height:320px;font-size:12.5px;white-space:pre-wrap;word-break:break-word;
  }

  .table-wrap{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
  table{width:100%;min-width:420px;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #f1f5f9}
  th{color:var(--tx3);font-weight:500;font-size:12px}
  td.num{font-variant-numeric:tabular-nums}
  td.dim{color:var(--tx3)}

  footer{margin-top:32px;color:var(--tx3);font-size:12px;text-align:center}

  @media (max-width:560px){
    .wrap{padding:16px 12px 48px}
    h1{font-size:19px}
    .meta{flex-direction:column;gap:2px}
    .meta-k{flex:none}
    .ep{padding:12px}
    .tester-row{flex-direction:column}
    .btn-run{width:100%}
    .path{font-size:12px}
    table{min-width:360px;font-size:12.5px}
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>太原中考志愿咨询系统 · API 文档</h1>
    <p class="sub">本服务提供 JSON 接口；面向用户的页面请访问前端
      <a href="http://localhost:5173">http://localhost:5173</a></p>
    <div class="pills">
      <span class="pill">版本 ${esc(ALGORITHM_INFO.version)}</span>
      <span class="pill gray">算法 ${esc(ALGORITHM_INFO.name)}</span>
      <span class="pill gray">共 ${API_GROUPS.reduce((n, g) => n + g.items.length, 0)} 个端点</span>
    </div>
  </header>

  <div class="card">
    <h3>算法概要</h3>
    <p>${esc(ALGORITHM_INFO.summary)}</p>
    <div class="meta"><span class="meta-k">公式</span>
      <div class="meta-v"><code class="block">${ALGORITHM_INFO.formula.map(esc).join('<br>')}</code></div>
    </div>
  </div>

  <div class="card">
    <h3>历年回测（仅用目标年之前的锚点，无数据泄漏）</h3>
    <p>${esc(ALGORITHM_INFO.backtest.note)}</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>目标年</th><th>样本</th><th>MAE</th><th>≤10分</th><th>总分变化</th></tr></thead>
        <tbody>${backtest}</tbody>
      </table>
    </div>
  </div>

  ${groups}

  <footer>太原中考志愿咨询系统 · 预测数据仅供参考，以教育局官方发布为准</footer>
</div>

<script>
(function(){
  document.addEventListener('click', function(e){
    var t = e.target;

    if (t.classList.contains('btn-test')) {
      var id = t.getAttribute('data-id');
      var box = document.getElementById('t-' + id);
      box.hidden = !box.hidden;
      return;
    }

    if (t.classList.contains('btn-run')) {
      var id2 = t.getAttribute('data-id');
      var input = document.getElementById('u-' + id2);
      var out = document.getElementById('o-' + id2);
      var url = input.value.trim();
      t.disabled = true;
      out.textContent = '请求中…';
      fetch(url)
        .then(function(r){
          return r.text().then(function(txt){
            var body;
            try { body = JSON.stringify(JSON.parse(txt), null, 2); }
            catch(_) { body = txt; }
            out.textContent = 'HTTP ' + r.status + '\\n\\n' + body;
          });
        })
        .catch(function(err){
          out.textContent = '请求失败：' + err.message + '\\n（请确认已启动后端，且路径以 / 开头）';
        })
        .finally(function(){ t.disabled = false; });
    }
  });
})();
</script>
</body>
</html>`;
}

export default renderApiDocs;
