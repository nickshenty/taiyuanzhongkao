/**
 * 2027年太原中考分数线预测生成器（全量校区级）
 *
 * 前置：先运行 node scripts/build-history-2027.js 生成 data/history-full.json
 *
 * 数据源
 * ------
 *   - 2026：data/years/2026.js（权威，已与教育局公布表逐项核对）
 *   - 2025：data/years/2025.js
 *   - 2017-2024：data/years/{year}.json（学校级）
 *   ⚠️ 禁用 data/years/2026-merged.json（行错位，40 所分数不可信）
 *
 * 算法
 * ----
 * 复用后端同一实现 backend/src/algorithms/predictionAlgorithmV1.5.js：
 *   relPos  = (score - controlLine) / (totalScore - controlLine)
 *   yearly  = (relPos_最近 - relPos_次近) / 年份间隔
 *   relPos_pred = relPos_最近 + 0.5 × clamp(yearly/2, ±0.05)
 *   score_pred  = control_目标 + relPos_pred × (total_目标 - control_目标)
 *
 * 目标年框架未知时沿用最近年框架，并保留 relPosPred 以便官方公布后一键重算。
 *
 * 用法
 * ----
 *   node scripts/generate-predictions-2027.js
 *   node scripts/generate-predictions-2027.js --no-backtest
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HISTORY = path.join(ROOT, 'data', 'history-full.json');
const OUT = path.join(ROOT, 'data', 'predictions2027.json');
const TARGET_YEAR = 2027;
const BACKTEST_YEARS = [2023, 2024, 2026];

async function main() {
  const noBacktest = process.argv.includes('--no-backtest');

  if (!fs.existsSync(HISTORY)) {
    throw new Error(`缺少 ${HISTORY}，请先运行 node scripts/build-history-2027.js`);
  }

  // 动态导入后端算法模块（保证与 API 侧同一套逻辑）
  const algo = await import(
    'file://' + path.join(ROOT, 'backend', 'src', 'algorithms', 'predictionAlgorithmV1.5.js')
  );
  const { predictFromSeries, rescore, relativePosition, MOMENTUM_WEIGHT, MOMENTUM_CAP } = algo;

  const history = JSON.parse(fs.readFileSync(HISTORY, 'utf8'));
  const frames = history.frames;
  const frameOf = y => frames[String(y)] || null;

  // 每单元锚点序列
  const series = {};
  for (const r of history.records) {
    if (r.score == null) continue;
    (series[r.code] = series[r.code] || {})[r.year] = r.score;
  }

  console.log(
    `口径：${history.scope.ordinaryUnits} 个普通高中招生单元 / ${history.scope.distinctParentSchools} 所高中` +
      `（另 ${history.scope.specialEntries} 个特色班/试点班）`
  );
  console.log(`参数：W=${MOMENTUM_WEIGHT}, CAP=${MOMENTUM_CAP}，间隔归一化动量`);

  // ==================== 回测 ====================
  const backtests = {};
  if (!noBacktest) {
    console.log('\n=== 回测（仅使用目标年之前的锚点，无数据泄漏） ===');
    for (const T of BACKTEST_YEARS) {
      const fT = frameOf(T);
      if (!fT) continue;

      const rows = [];
      for (const unit of history.roster) {
        const sy = series[unit.code];
        if (!sy || sy[T] == null) continue;
        const p = predictFromSeries({
          series: sy,
          targetYear: T,
          frameOf,
          frameTarget: fT
        });
        if (!p) continue;
        rows.push({ ...p, actual: sy[T], error: sy[T] - p.predicted, name: unit.name });
      }
      if (!rows.length) continue;

      const abs = rows.map(r => Math.abs(r.error));
      const mae = abs.reduce((a, b) => a + b, 0) / abs.length;
      const bt = {
        targetYear: T,
        sampleSize: rows.length,
        mae: Number(mae.toFixed(2)),
        rmse: Number(Math.sqrt(abs.reduce((a, b) => a + b * b, 0) / abs.length).toFixed(2)),
        within3Percent: Number(((abs.filter(e => e <= 3).length / rows.length) * 100).toFixed(1)),
        within5Percent: Number(((abs.filter(e => e <= 5).length / rows.length) * 100).toFixed(1)),
        within10Percent: Number(((abs.filter(e => e <= 10).length / rows.length) * 100).toFixed(1)),
        frameChange: `${frameOf(T - 1)?.totalScore ?? '?'}/${frameOf(T - 1)?.controlLine ?? '?'} -> ${fT.totalScore}/${fT.controlLine}`,
        worst: rows
          .slice()
          .sort((a, b) => Math.abs(b.error) - Math.abs(a.error))
          .slice(0, 5)
          .map(r => ({ name: r.name, predicted: r.predicted, actual: r.actual, error: r.error }))
      };
      backtests[T] = bt;

      console.log(
        `${T} 年  样本 ${String(bt.sampleSize).padStart(3)}  MAE ${String(bt.mae).padStart(6)}  ` +
          `≤3分 ${String(bt.within3Percent).padStart(4)}%  ≤5分 ${String(bt.within5Percent).padStart(4)}%  ` +
          `≤10分 ${String(bt.within10Percent).padStart(4)}%   框架 ${bt.frameChange}`
      );
    }
  }

  // ==================== 生成 2027 ====================
  const f2026 = frameOf(2026);
  if (!f2026) throw new Error('缺少 2026 年框架');
  const frame2027 = {
    controlLine: f2026.controlLine,
    totalScore: f2026.totalScore,
    assumed: true
  };

  console.log('\n=== 生成 2027 年预测 ===');
  const results = [];
  for (const unit of history.roster) {
    const sy = series[unit.code];
    if (!sy) continue;
    const p = predictFromSeries({
      series: sy,
      targetYear: TARGET_YEAR,
      frameOf,
      frameTarget: frame2027
    });
    if (!p) continue;
    results.push({
      code: unit.code,
      name: unit.name,
      parent: unit.parent,
      special: unit.special,
      score2026: sy[2026] ?? null,
      anchorYears: p.anchorYears,
      predicted2027: p.predicted,
      relPosPred: p.relPosPred,
      confidence: p.confidence,
      strategy: p.strategy,
      volatile: p.volatile
    });
  }
  results.sort((a, b) => b.predicted2027 - a.predicted2027);

  const stat = {
    total: results.length,
    high: results.filter(r => r.confidence === 'high').length,
    medium: results.filter(r => r.confidence === 'medium').length,
    low: results.filter(r => r.confidence === 'low').length,
    volatile: results.filter(r => r.volatile).length,
    min: Math.min(...results.map(r => r.predicted2027)),
    max: Math.max(...results.map(r => r.predicted2027))
  };
  console.log(
    `共 ${stat.total} 个单元，区间 ${stat.min}~${stat.max}；` +
      `置信度 high ${stat.high} / medium ${stat.medium} / low ${stat.low}；波动 ${stat.volatile}`
  );

  const payload = {
    targetYear: TARGET_YEAR,
    algorithm: 'v1.5-generalized',
    generatedAt: new Date().toISOString(),
    parameters: { momentumWeight: MOMENTUM_WEIGHT, momentumCap: MOMENTUM_CAP },
    frame: {
      controlLine: frame2027.controlLine,
      totalScore: frame2027.totalScore,
      assumption:
        '2027年总分与控制线尚未公布，预测按"沿用2026年框架"换算；官方公布后可用 rescore(relPosPred, 新控制线, 新总分) 一键重算。'
    },
    scope: history.scope,
    backtests,
    statistics: stat,
    schools: results
  };

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\n✅ 已写入 ${OUT}`);

  console.log('\n前15名：');
  results.slice(0, 15).forEach(r =>
    console.log(
      `  ${String(r.predicted2027).padStart(4)}  ${r.name}  (2026:${r.score2026 ?? '-'} ${r.confidence})`
    )
  );
  console.log('\n后10名：');
  results.slice(-10).forEach(r =>
    console.log(
      `  ${String(r.predicted2027).padStart(4)}  ${r.name}  (2026:${r.score2026 ?? '-'} ${r.confidence})`
    )
  );

  return payload;
}

if (require.main === module) {
  main().catch(e => {
    console.error('❌', e.message);
    process.exit(1);
  });
}

module.exports = { main, TARGET_YEAR, BACKTEST_YEARS };
