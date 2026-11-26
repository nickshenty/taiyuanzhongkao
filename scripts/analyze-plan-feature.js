/**
 * 验证"招生计划变化"是否对分数线有预测价值
 *
 * 目的：在把 planChange 纳入模型前，先用数据检验其有效性，
 *       避免为了用特征而用特征（过度拟合）。
 *
 * 方法：
 *   1. 用与线上一致的模型（predictFromSeries）预测各年录取线，得到残差
 *        residual = actual - predicted
 *   2. 计算各校逐年计划变化率
 *        planChange = (plan_t - plan_{t-1}) / plan_{t-1}
 *   3. 统计二者的皮尔逊相关系数（预期：扩招 → 分数线偏低 → 残差为负）
 *   4. 线性拟合 residual ≈ k × planChange，把修正项加回预测，比较 MAE 变化
 *
 * 用法：node scripts/analyze-plan-feature.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

async function main() {
  const algo = await import(
    'file://' + path.join(ROOT, 'backend', 'src', 'algorithms', 'predictionAlgorithmV1.5.js')
  );
  const { predictFromSeries } = algo;

  const history = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'history-full.json'), 'utf8')
  );
  const frames = history.frames;
  const frameOf = y => frames[String(y)] || null;

  const series = {};
  for (const r of history.records) {
    if (r.score == null) continue;
    (series[r.code] = series[r.code] || {})[r.year] = r.score;
  }

  // 载入各年招生计划
  const plans = {};
  const planDir = path.join(ROOT, 'data', 'enrollment');
  for (const f of fs.readdirSync(planDir)) {
    const m = f.match(/^(\d{4})\.json$/);
    if (!m) continue;
    const year = Number(m[1]);
    const d = JSON.parse(fs.readFileSync(path.join(planDir, f), 'utf8'));
    plans[year] = new Map((d.schools || []).map(s => [s.code, s.plan]));
  }
  const planYears = Object.keys(plans).map(Number).sort();
  console.log(`可用招生计划年份：${planYears.join(', ')}`);

  // 采样：目标年需计划、且上一年也有计划
  const samples = [];
  for (const t of planYears) {
    if (!plans[t - 1]) continue;
    const fT = frameOf(t);
    if (!fT) continue;

    for (const unit of history.roster) {
      const sy = series[unit.code];
      if (!sy || sy[t] == null) continue;

      const planT = plans[t].get(unit.code);
      const planPrev = plans[t - 1].get(unit.code);
      if (planT == null || planPrev == null || planPrev <= 0) continue;

      const p = predictFromSeries({ series: sy, targetYear: t, frameOf, frameTarget: fT });
      if (!p) continue;

      samples.push({
        year: t,
        code: unit.code,
        name: unit.name,
        actual: sy[t],
        predicted: p.predicted,
        residual: sy[t] - p.predicted,
        planT,
        planPrev,
        planChange: (planT - planPrev) / planPrev
      });
    }
  }

  if (!samples.length) {
    console.log('❌ 无足够样本（需要连续两年计划 + 预测）');
    return;
  }

  const n = samples.length;
  console.log(`\n样本数：${n}（年份 ${[...new Set(samples.map(s => s.year))].join(', ')}）`);

  // ---- 基本统计 ----
  const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const xs = samples.map(s => s.planChange);
  const ys = samples.map(s => s.residual);
  const mx = mean(xs);
  const my = mean(ys);
  const cov = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / n;
  const sx = Math.sqrt(xs.reduce((a, x) => a + (x - mx) ** 2, 0) / n);
  const sy2 = Math.sqrt(ys.reduce((a, y) => a + (y - my) ** 2, 0) / n);
  const r = cov / (sx * sy2 || 1);
  const kSlope = cov / (sx * sx || 1);

  console.log(`计划变化率：均值 ${(mx * 100).toFixed(1)}%，标准差 ${(sx * 100).toFixed(1)}%`);
  console.log(`残差：均值 ${my.toFixed(2)} 分，标准差 ${sy2.toFixed(2)} 分`);
  console.log(`\n相关系数 r = ${r.toFixed(4)}`);
  console.log(`回归斜率 k = ${kSlope.toFixed(2)} 分 / 单位计划变化率`);

  // ---- 显著性（t 检验，近似） ----
  const tStat = r * Math.sqrt((n - 2) / (1 - r * r || 1e-9));
  console.log(`t 统计量 = ${tStat.toFixed(2)}（|t|>2 约对应 5% 显著）`);

  // ---- 分组观察 ----
  const buckets = [
    ['大幅扩招 ≥20%', s => s.planChange >= 0.2],
    ['扩招 5~20%', s => s.planChange >= 0.05 && s.planChange < 0.2],
    ['基本持平 ±5%', s => Math.abs(s.planChange) < 0.05],
    ['缩减 5~20%', s => s.planChange <= -0.05 && s.planChange > -0.2],
    ['大幅缩减 ≥20%', s => s.planChange <= -0.2]
  ];
  console.log('\n按计划变化分组（残差 = 实际 - 预测，负值表示实际低于预测）：');
  for (const [label, fn] of buckets) {
    const g = samples.filter(fn);
    if (!g.length) continue;
    const m = mean(g.map(s => s.residual));
    console.log(`  ${label.padEnd(16)} n=${String(g.length).padStart(3)}  平均残差 ${m.toFixed(2)} 分`);
  }

  // ---- 修正效果 ----
  const baseAbs = samples.map(s => Math.abs(s.residual));
  const baseMae = mean(baseAbs);

  console.log('\n=== 加入修正项后的 MAE 变化 ===');
  console.log(`基线 MAE = ${baseMae.toFixed(2)}`);
  for (const shrink of [1.0, 0.75, 0.5, 0.25]) {
    const adj = samples.map(s => {
      const corr = kSlope * s.planChange * shrink;
      return Math.abs(s.actual - (s.predicted + corr));
    });
    const mae = mean(adj);
    const delta = mae - baseMae;
    console.log(
      `  修正系数 ×${shrink.toFixed(2)}  MAE = ${mae.toFixed(2)}  (${delta >= 0 ? '+' : ''}${delta.toFixed(2)})`
    );
  }

  // ---- 只对大幅变动生效 ----
  console.log('\n仅对 |计划变化| ≥ 10% 的学校施加修正：');
  for (const k of [kSlope, kSlope * 0.5]) {
    const adj = samples.map(s => {
      const corr = Math.abs(s.planChange) >= 0.1 ? k * s.planChange : 0;
      return Math.abs(s.actual - (s.predicted + corr));
    });
    const mae = mean(adj);
    console.log(
      `  k=${k.toFixed(1)}  MAE = ${mae.toFixed(2)}  (${mae - baseMae >= 0 ? '+' : ''}${(mae - baseMae).toFixed(2)})`
    );
  }

  // ---- 结论 ----
  console.log('\n=== 结论 ===');
  const significant = Math.abs(tStat) > 2;
  const helps = mean(
    samples.map(s => Math.abs(s.actual - (s.predicted + kSlope * 0.5 * s.planChange)))
  ) < baseMae;
  console.log(`相关性显著：${significant ? '是' : '否'}（|t|=${Math.abs(tStat).toFixed(2)}）`);
  console.log(`修正后 MAE 下降：${helps ? '是' : '否'}`);
  console.log(
    !significant || !helps
      ? '→ 建议：暂时不纳入模型（证据不足）'
      : '→ 建议：可纳入模型，并在回测中进一步确认'
  );

  // 输出明细供进一步分析
  const out = path.join(ROOT, 'data', 'analysis-plan-feature.json');
  fs.writeFileSync(
    out,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), n, correlation: r, slope: kSlope, tStat, baseMae, samples },
      null,
      2
    ),
    'utf8'
  );
  console.log(`\n明细已写入 ${path.relative(ROOT, out)}`);
}

if (require.main === module) {
  main().catch(e => {
    console.error('❌', e);
    process.exit(1);
  });
}

module.exports = { main };
