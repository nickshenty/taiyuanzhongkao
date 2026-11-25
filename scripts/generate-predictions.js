/**
 * 太原中考分数线预测生成器（全量校区级，年份自动识别）
 *
 * 基准年 = data/history-full.json 中的 latestYear（即数据里最新的年份）
 * 目标年 = 基准年 + 1（可用 --target=YYYY 覆盖）
 *
 * 前置：先运行 node scripts/build-history.js 生成 data/history-full.json
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
 *   node scripts/generate-predictions.js                  # 自动：最新年 + 1
 *   node scripts/generate-predictions.js --target=2028    # 手动指定目标年
 *   node scripts/generate-predictions.js --no-backtest
 *
 * 输出
 * ----
 *   data/predictions-{目标年}.json   逐年存档
 *   data/predictions-latest.json     最新指针（导入器读取此文件）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HISTORY = path.join(ROOT, 'data', 'history-full.json');
const DATA_DIR = path.join(ROOT, 'data');

function argOf(name, def) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

async function main() {
  const noBacktest = process.argv.includes('--no-backtest');

  if (!fs.existsSync(HISTORY)) {
    throw new Error(`缺少 ${HISTORY}，请先运行 node scripts/build-history.js`);
  }

  // 动态导入后端算法模块（保证与 API 侧同一套逻辑）
  const algo = await import(
    'file://' + path.join(ROOT, 'backend', 'src', 'algorithms', 'predictionAlgorithmV1.5.js')
  );
  const { predictFromSeries, rescore, relativePosition, MOMENTUM_WEIGHT, MOMENTUM_CAP } = algo;

  const history = JSON.parse(fs.readFileSync(HISTORY, 'utf8'));
  const frames = history.frames;
  const frameOf = y => frames[String(y)] || null;

  // 年份自动推导：基准年取数据中最新年份，目标年 = 基准年 + 1
  const availableYears = Object.keys(frames)
    .map(Number)
    .sort((a, b) => a - b);
  const LATEST_YEAR = history.latestYear ?? availableYears[availableYears.length - 1];
  const TARGET_YEAR = Number(argOf('target', LATEST_YEAR + 1));
  if (!Number.isFinite(TARGET_YEAR) || TARGET_YEAR <= LATEST_YEAR) {
    throw new Error(`非法的目标年 ${TARGET_YEAR}（必须大于基准年 ${LATEST_YEAR}）`);
  }

  // 回测年份：默认覆盖全部可用年份（便于逐检验证算法稳定性）
  // 可用 --backtest-years=3 只看最近 3 年
  const btArg = argOf('backtest-years', 'all');
  let BACKTEST_YEARS = availableYears.filter(y => y <= LATEST_YEAR);
  if (btArg !== 'all') {
    const k = Number(btArg);
    if (Number.isFinite(k) && k > 0) BACKTEST_YEARS = BACKTEST_YEARS.slice(-k);
  }

  const OUT = path.join(DATA_DIR, `predictions-${TARGET_YEAR}.json`);
  const OUT_LATEST = path.join(DATA_DIR, 'predictions-latest.json');

  console.log(`基准年 ${LATEST_YEAR} → 目标年 ${TARGET_YEAR}`);

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

  // ==================== 生成目标年预测 ====================
  const latestFrame = frameOf(LATEST_YEAR);
  if (!latestFrame) throw new Error(`缺少 ${LATEST_YEAR} 年框架`);
  const frameTarget = {
    controlLine: latestFrame.controlLine,
    totalScore: latestFrame.totalScore,
    assumed: true
  };

  console.log(`\n=== 生成 ${TARGET_YEAR} 年预测 ===`);
  const results = [];
  for (const unit of history.roster) {
    const sy = series[unit.code];
    if (!sy) continue;
    const p = predictFromSeries({
      series: sy,
      targetYear: TARGET_YEAR,
      frameOf,
      frameTarget
    });
    if (!p) continue;
    results.push({
      code: unit.code,
      name: unit.name,
      parent: unit.parent,
      special: unit.special,
      scoreLatest: sy[LATEST_YEAR] ?? null,
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
      controlLine: frameTarget.controlLine,
      totalScore: frameTarget.totalScore,
      assumption:
        `${TARGET_YEAR}年总分与控制线尚未公布，预测按"沿用${LATEST_YEAR}年框架"换算；官方公布后可用 rescore(relPosPred, 新控制线, 新总分) 一键重算。`,
      basedOnYear: LATEST_YEAR
    },
    scope: history.scope,
    backtests,
    statistics: stat,
    schools: results
  };

  const json = JSON.stringify(payload, null, 2);
  fs.writeFileSync(OUT, json, 'utf8');
  fs.writeFileSync(OUT_LATEST, json, 'utf8');
  console.log(`\n✅ 已写入 ${OUT}`);
  console.log(`✅ 已更新 ${OUT_LATEST}（供导入器指向最新预测）`);

  console.log('\n前15名：');
  results.slice(0, 15).forEach(r =>
    console.log(
      `  ${String(r.predicted2027).padStart(4)}  ${r.name}  (${LATEST_YEAR}:${r.scoreLatest ?? '-'} ${r.confidence})`
    )
  );
  console.log('\n后10名：');
  results.slice(-10).forEach(r =>
    console.log(
      `  ${String(r.predicted2027).padStart(4)}  ${r.name}  (${LATEST_YEAR}:${r.scoreLatest ?? '-'} ${r.confidence})`
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

module.exports = { main };
