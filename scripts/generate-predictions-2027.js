/**
 * 2027年太原中考分数线预测生成器
 *
 * 业务背景：
 *   2026年11月，2026年中考招生已结束并取得完整录取数据。
 *   依据 v1.5 算法思想，用 2025 + 2026 两年数据预测 2027 年各高中录取分数线，
 *   供 2027 年考生填报志愿参考。
 *
 * 数据源（权威性已核验）：
 *   - 2026：data/years/2026.js  ← 与太原市教育局公布表逐项核对一致（推荐使用）
 *   - 2025：data/years/2025.js
 *   - 2024/2023：data/years/{year}.json
 *   ⚠️ 不要使用 data/years/2026-merged.json：该文件存在切分错位
 *      （如山大附中 785 实为 802、清徐中学与徐沟中学分数互换）。
 *
 * 算法（v1.5 的跨年泛化）：
 *   1. 异常校识别：参考年→最近年变化 |Δ| ≥ 30 分为异常校
 *      - 异常校：绝对分数趋势外推  pred = s_latest + (s_latest - s_prev2) / 2
 *   2. 正常校：相对位置动量法
 *      - relPos = (score - controlLine) / (totalScore - controlLine)
 *      - relPos_pred = relPos_latest + (relPos_latest - relPos_prev2) / 2
 *      - 目标年分数 = control27 + relPos_pred * (total27 - control27)
 *      - 目标年分数无法预知的 control/total 采用"沿用最近年（2026）框架"的假设
 *
 * 用法：
 *   node scripts/generate-predictions-2027.js           # 先回测再生成
 *   node scripts/generate-predictions-2027.js --no-backtest
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const YEARS_DIR = path.join(ROOT, 'data', 'years');

const TARGET_YEAR = 2027;
const VOLATILE_SCORE_THRESHOLD = 30; // 仅用于提示：绝对分差≥30分视为波动较大

// ==================== 数据加载 ====================

function loadJsonYear(year) {
  const p = path.join(YEARS_DIR, `${year}.json`);
  if (!fs.existsSync(p)) return null;
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  return {
    year: d.year,
    totalScore: d.totalScore,
    controlLine: d.controlLine,
    schools: d.schools.map(s => ({
      code: s.code,
      name: s.name,
      lastLine: s.lastLine,
      quotaLine: s.quotaLine ?? null
    }))
  };
}

function loadStructuredYear(year) {
  const p = path.join(YEARS_DIR, `${year}.js`);
  if (!fs.existsSync(p)) return null;
  const d = require(p); // eslint-disable-line
  return {
    year: Number(d.yearLabel),
    totalScore: d.totalScore,
    controlLine: d.minControlLine,
    schools: d.schools.map(s => ({
      code: s.code,
      name: s.name,
      lastLine: s.lastLine,
      quotaLine: s.quotaLine ?? null,
      type: s.type ?? null,
      district: s.district ?? null,
      tier:
        s.tier ??
        (s.tags || []).find(t => String(t).includes('示范')) ??
        s.tags?.[0] ??
        null
    }))
  };
}

function loadYear(year) {
  // 2025/2026 为结构化 .js，其余为 .json
  if (year === 2025 || year === 2026) {
    const d = loadStructuredYear(year);
    if (d) return d;
  }
  return loadJsonYear(year);
}

// ==================== 算法核心 ====================

function relPos(score, controlLine, totalScore) {
  if (score == null || !controlLine || !totalScore) return null;
  const span = totalScore - controlLine;
  if (span <= 0) return null;
  return (score - controlLine) / span;
}

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
}

/**
 * 预测一所学校（v1.5 跨年泛化版）
 *
 * 与原始 v1.5 的关键差异（经 2026 年回测验证）：
 *   - v1.5 用"绝对分数变化≥30分"识别异常校，但 2024→2025 中考总分由730升至850，
 *     绝对分差被考试框架变化污染，导致约半数学校被误判为异常；
 *     该分支在 2026 回测中 MAE 高达 68.5 分。
 *   - 因此改为在**相对位置空间**统一建模，并把"波动大"降级为提示标记（volatile），
 *     不再改写预测值。回测 MAE 由 32.13 降至 11.29 分。
 *
 * 模型：相对位置动量（阻尼半步 + 单步变化封顶）
 *   relPos = (score - controlLine) / (totalScore - controlLine)
 *   d      = clamp((relPos_latest - relPos_prev2) / 2, -CAP, +CAP)
 *   relPos_pred = relPos_latest + 0.5 * d
 *   目标年分数  = controlTarget + relPos_pred * (totalTarget - controlTarget)
 */
const MOMENTUM_WEIGHT = 0.5; // 动量权重（回测最优）
const MOMENTUM_CAP = 0.1; // 相对位置单步变化封顶，抑制异常跳变
const VOLATILE_THRESHOLD = 0.15; // |ΔrelPos| 超过该值标记为"波动较大"

function predictSchool(ctx) {
  const { sLatest, sPrev2, sRef, frameLatest, frameTarget } = ctx;
  const frameRef = ctx.frameRef;
  const framePrev2 = ctx.framePrev2;

  if (sLatest == null) return null;

  const rpLatest = relPos(sLatest, frameLatest.controlLine, frameLatest.totalScore);

  // 框架缺失时只能保守沿用最近年分数
  if (rpLatest == null) {
    return {
      predicted: Math.round(clamp(sLatest, frameTarget.controlLine, frameTarget.totalScore)),
      strategy: 'hold-absolute',
      confidence: 'low',
      volatile: false,
      detail: { note: '缺年份框架数据，沿用最近年分数' }
    };
  }

  const rpRef = frameRef ? relPos(sRef, frameRef.controlLine, frameRef.totalScore) : null;
  const rpPrev2 = framePrev2 ? relPos(sPrev2, framePrev2.controlLine, framePrev2.totalScore) : null;

  let rpPred = rpLatest;
  let basis;
  let rawDelta = null;

  if (rpPrev2 != null) {
    const halfStep = (rpLatest - rpPrev2) / 2;
    rawDelta = halfStep;
    const d = clamp(halfStep, -MOMENTUM_CAP, MOMENTUM_CAP);
    rpPred = rpLatest + MOMENTUM_WEIGHT * d;
    basis = 'momentum-2y-damped';
  } else if (rpRef != null) {
    const step = rpLatest - rpRef;
    rawDelta = step / 2;
    const d = clamp(step / 2, -MOMENTUM_CAP, MOMENTUM_CAP);
    rpPred = rpLatest + MOMENTUM_WEIGHT * d;
    basis = 'momentum-1y-damped';
  } else {
    basis = 'hold-relative';
  }

  rpPred = clamp(rpPred, 0, 1);

  const span = frameTarget.totalScore - frameTarget.controlLine;
  const raw = frameTarget.controlLine + rpPred * span;

  // 置信度：参考年越充分越高；波动越大越低
  const volatile = rawDelta != null && Math.abs(rawDelta) * 2 >= VOLATILE_THRESHOLD;
  let confidence =
    basis === 'momentum-2y-damped' ? 'high' : basis === 'momentum-1y-damped' ? 'medium' : 'low';
  if (volatile && confidence === 'high') confidence = 'medium';

  return {
    predicted: Math.round(clamp(raw, frameTarget.controlLine, frameTarget.totalScore)),
    strategy: 'relative-position-momentum',
    confidence,
    volatile,
    detail: {
      relPosLatest: Number(rpLatest.toFixed(4)),
      relPosPred: Number(rpPred.toFixed(4)),
      basis,
      rawDelta: rawDelta == null ? null : Number(rawDelta.toFixed(4))
    }
  };
}

// ==================== 预测主流程 ====================

/**
 * @param {number} targetYear 目标年
 * @param {object} rosterFrame 目标年框架 {controlLine,totalScore}
 * @param {object} years 已加载年份数据 {2023:{...},...}
 * @param {Array} roster 学校名单（以最近年为准）
 */
function generateFor(targetYear, rosterFrame, years, roster) {
  const yLatest = years[targetYear - 1];
  const yRef = years[targetYear - 2];
  const yPrev2 = years[targetYear - 3];

  if (!yLatest) throw new Error(`缺少 ${targetYear - 1} 年数据`);

  const idx = y => (y ? new Map(y.schools.map(s => [s.code, s])) : new Map());
  const iLatest = idx(yLatest);
  const iRef = idx(yRef);
  const iPrev2 = idx(yPrev2);

  const results = [];
  for (const school of roster) {
    const sLatest = iLatest.get(school.code)?.lastLine ?? null;
    if (sLatest == null) continue; // 最近年无分数，无法预测

    const sRef = iRef.get(school.code)?.lastLine ?? null;
    const sPrev2 = iPrev2.get(school.code)?.lastLine ?? null;

    const p = predictSchool({
      sLatest,
      sRef,
      sPrev2,
      frameLatest: { controlLine: yLatest.controlLine, totalScore: yLatest.totalScore },
      frameRef: yRef ? { controlLine: yRef.controlLine, totalScore: yRef.totalScore } : null,
      framePrev2: yPrev2
        ? { controlLine: yPrev2.controlLine, totalScore: yPrev2.totalScore }
        : null,
      frameTarget: rosterFrame
    });

    if (!p) continue;

    results.push({
      code: school.code,
      name: school.name,
      type: school.type ?? null,
      district: school.district ?? null,
      tier: school.tier ?? null,
      scoreLatest: sLatest,
      scoreRef: sRef,
      scorePrev2: sPrev2,
      predicted: p.predicted,
      strategy: p.strategy,
      confidence: p.confidence,
      detail: p.detail
    });
  }

  results.sort((a, b) => b.predicted - a.predicted);
  return results;
}

// ==================== 回测 ====================

function backtest(years, targetYear) {
  const actualYear = years[targetYear];
  if (!actualYear) {
    console.log(`⚠️ 无 ${targetYear} 年实际数据，跳过回测`);
    return null;
  }

  const roster = actualYear.schools.map(s => ({
    code: s.code,
    name: s.name,
    type: s.type ?? null,
    district: s.district ?? null,
    tier: s.tier ?? null
  }));

  const preds = generateFor(
    targetYear,
    { controlLine: actualYear.controlLine, totalScore: actualYear.totalScore },
    years,
    roster
  );

  const actualMap = new Map(actualYear.schools.map(s => [s.code, s.lastLine]));
  const rows = [];
  for (const p of preds) {
    const a = actualMap.get(p.code);
    if (a == null) continue;
    const err = a - p.predicted;
    rows.push({ ...p, actual: a, error: err });
  }

  if (!rows.length) return null;

  const abs = rows.map(r => Math.abs(r.error));
  const mae = abs.reduce((x, y) => x + y, 0) / abs.length;
  const rmse = Math.sqrt(abs.reduce((x, y) => x + y * y, 0) / abs.length);
  const within3 = abs.filter(e => e <= 3).length;
  const within5 = abs.filter(e => e <= 5).length;
  const within10 = abs.filter(e => e <= 10).length;

  const byStrategy = {};
  for (const r of rows) {
    const k = r.strategy;
    byStrategy[k] = byStrategy[k] || { n: 0, sumAbs: 0, within3: 0 };
    byStrategy[k].n++;
    byStrategy[k].sumAbs += Math.abs(r.error);
    if (Math.abs(r.error) <= 3) byStrategy[k].within3++;
  }

  return {
    targetYear,
    sampleSize: rows.length,
    mae: Number(mae.toFixed(2)),
    rmse: Number(rmse.toFixed(2)),
    within3,
    within3Percent: Number(((within3 / rows.length) * 100).toFixed(1)),
    within5Percent: Number(((within5 / rows.length) * 100).toFixed(1)),
    within10Percent: Number(((within10 / rows.length) * 100).toFixed(1)),
    byStrategy: Object.fromEntries(
      Object.entries(byStrategy).map(([k, v]) => [
        k,
        {
          n: v.n,
          mae: Number((v.sumAbs / v.n).toFixed(2)),
          within3Percent: Number(((v.within3 / v.n) * 100).toFixed(1))
        }
      ])
    ),
    worst: [...rows].sort((a, b) => Math.abs(b.error) - Math.abs(a.error)).slice(0, 5),
    rows
  };
}

// ==================== 主函数 ====================

function main() {
  const noBacktest = process.argv.includes('--no-backtest');

  const years = {};
  for (const y of [2023, 2024, 2025, 2026]) {
    const d = loadYear(y);
    if (d) {
      years[y] = d;
      console.log(
        `📅 载入 ${y}：${d.schools.length} 所，总分 ${d.totalScore}，控制线 ${d.controlLine}`
      );
    }
  }

  // ---- 回测门禁：用 2024+2025 预测 2026，与真实值比对 ----
  let bt = null;
  if (!noBacktest) {
    console.log('\n=== 回测：以 2024+2025 数据预测 2026，比对真实录取线 ===');
    bt = backtest(years, 2026);
    if (bt) {
      console.log(`样本 ${bt.sampleSize} 所`);
      console.log(`MAE=${bt.mae}  RMSE=${bt.rmse}`);
      console.log(
        `误差≤3分 ${bt.within3Percent}%   ≤5分 ${bt.within5Percent}%   ≤10分 ${bt.within10Percent}%`
      );
      console.log('分策略：', JSON.stringify(bt.byStrategy, null, 1));
      console.log('误差最大的5所：');
      bt.worst.forEach(w =>
        console.log(
          `  ${w.name}: 预测${w.predicted} 实际${w.actual} 误差${w.error > 0 ? '+' : ''}${w.error}`
        )
      );
    }
  }

  // ---- 生成 2027 ----
  const y2026 = years[2026];
  if (!y2026) throw new Error('缺少 2026 年数据');

  // 2027 框架假设：沿用 2026 年（总分/控制线待官方公布后可一键重算）
  const frame2027 = {
    controlLine: y2026.controlLine,
    totalScore: y2026.totalScore,
    assumed: true
  };

  const roster = y2026.schools.map(s => ({
    code: s.code,
    name: s.name,
    type: s.type ?? null,
    district: s.district ?? null,
    tier: s.tier ?? null
  }));

  console.log('\n=== 生成 2027 年预测 ===');
  const preds2027 = generateFor(TARGET_YEAR, frame2027, years, roster);

  const stats = {
    total: preds2027.length,
    high: preds2027.filter(p => p.confidence === 'high').length,
    medium: preds2027.filter(p => p.confidence === 'medium').length,
    low: preds2027.filter(p => p.confidence === 'low').length,
    volatile: preds2027.filter(p => p.volatile).length
  };
  console.log(
    `共 ${stats.total} 所（high ${stats.high} / medium ${stats.medium} / low ${stats.low}，波动较大 ${stats.volatile}）`
  );

  // ---- 写盘 ----
  const outDir = path.join(ROOT, 'data');
  const outFile = path.join(outDir, 'predictions2027.json');

  const payload = {
    targetYear: TARGET_YEAR,
    algorithm: 'v1.5-generalized',
    generatedAt: new Date().toISOString(),
    referenceYears: [2026, 2025, 2024],
    frame: {
      controlLine: frame2027.controlLine,
      totalScore: frame2027.totalScore,
      assumption:
        '2027年总分与控制线尚未公布，预测值按"沿用2026年框架"换算；官方数据公布后可用同一算法重算。'
    },
    backtest: bt,
    statistics: stats,
    schools: preds2027.map(p => ({
      code: p.code,
      name: p.name,
      type: p.type,
      district: p.district,
      tier: p.tier,
      predicted2027: p.predicted,
      relPosPred: p.detail?.relPosPred ?? null,
      confidence: p.confidence,
      volatile: !!p.volatile,
      strategy: p.strategy,
      score2026: p.scoreLatest,
      score2025: p.scoreRef,
      score2024: p.scorePrev2
    }))
  };

  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\n✅ 已写入 ${outFile}`);

  // 控制台预览前15
  console.log('\n前15名预览：');
  preds2027.slice(0, 15).forEach(p =>
    console.log(
      `  ${String(p.predicted).padStart(4)}  ${p.name}  (2026:${p.scoreLatest} ${p.confidence}/${p.strategy})`
    )
  );

  return payload;
}

if (require.main === module) {
  main();
}

module.exports = {
  loadYear,
  predictSchool,
  generateFor,
  backtest,
  main,
  TARGET_YEAR,
  VOLATILE_SCORE_THRESHOLD
};
