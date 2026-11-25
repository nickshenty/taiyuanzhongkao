/**
 * 太原中考分数线预测算法 v1.5（跨年泛化实现）
 *
 * 设计背景
 * ---------
 * 原始 v1.5 写死了 REFERENCE_YEAR=2023 / TARGET_YEAR=2024 与 6 所异常校名单，
 * 且以"绝对分数变化≥30分"识别异常校。
 * 该判定在 2024→2025 中考总分由 730 升至 850 后被考试框架变化污染：
 * 49 所样本中 18 所被误判为异常校，异常分支回测 MAE 达 68.5 分。
 *
 * 因此本实现把预测迁到**尺度无关的相对位置空间**：
 *
 *   relPos(Y)   = (score(Y) - controlLine(Y)) / (totalScore(Y) - controlLine(Y))
 *   d           = clamp((relPos_latest - relPos_prev2) / 2, -CAP, +CAP)
 *   relPos_pred = relPos_latest + WEIGHT × d
 *   score_pred  = controlLine_target + relPos_pred × (totalScore_target - controlLine_target)
 *
 * 回测（全量校区级历史，间隔归一化动量，W=0.5 / CAP=0.05）：
 *   2023 年 MAE 7.29，2024 年 MAE 8.88（均为稳定框架，最接近 2027 场景）
 *   2026 年 MAE 21.07（跨越 850→839 框架调整，难度更高）
 * 详见 docs/PREDICTION_2027.md
 *
 * 纯函数模块：不触碰数据库、不读写文件，便于单测与复用。
 */

// ==================== 可调参数 ====================

/** 动量权重：0 = 纯保持，1 = 完全外推。回测最优 0.5 */
export const MOMENTUM_WEIGHT = 0.5;

/** 相对位置单步变化封顶，抑制异常校带偏（回测最优 0.05） */
export const MOMENTUM_CAP = 0.05;

/** |ΔrelPos| × 2 超过该值标记为"波动较大"（仅提示，不改写预测） */
export const VOLATILE_THRESHOLD = 0.15;

/** 定向生录取线下调上限（太原市：统招线下50分以内，且不低于最低控制线） */
export const QUOTA_MAX_DOWNGRADE = 50;

// ==================== 工具函数 ====================

export function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
}

/**
 * 计算相对位置
 * @returns {number|null} 0~1 之间；参数缺失返回 null
 */
export function relativePosition(score, controlLine, totalScore) {
  if (score == null || !controlLine || !totalScore) return null;
  const span = totalScore - controlLine;
  if (span <= 0) return null;
  return (score - controlLine) / span;
}

/**
 * 把相对位置映射回目标年的绝对分数
 */
export function positionToScore(relPos, controlLine, totalScore) {
  if (relPos == null || !controlLine || !totalScore) return null;
  const span = totalScore - controlLine;
  if (span <= 0) return null;
  return controlLine + relPos * span;
}

// ==================== 核心预测 ====================

/**
 * 预测单所学校
 *
 * @param {object} ctx
 * @param {number|null} ctx.scoreLatest  最近年（目标年-1）录取线
 * @param {number|null} ctx.scoreRef     参考年（目标年-2）录取线，可空
 * @param {number|null} ctx.scorePrev2   （目标年-3）录取线，可空
 * @param {{controlLine:number,totalScore:number}} ctx.frameLatest  最近年框架
 * @param {{controlLine:number,totalScore:number}|null} ctx.frameRef
 * @param {{controlLine:number,totalScore:number}|null} ctx.framePrev2
 * @param {{controlLine:number,totalScore:number}} ctx.frameTarget  目标年框架
 * @returns {object|null}
 */
export function predictSchool(ctx) {
  const { scoreLatest, scoreRef = null, scorePrev2 = null } = ctx;
  const { frameLatest, frameTarget } = ctx;
  const frameRef = ctx.frameRef ?? null;
  const framePrev2 = ctx.framePrev2 ?? null;

  if (scoreLatest == null) return null;
  if (!frameLatest || !frameTarget) return null;

  const rpLatest = relativePosition(
    scoreLatest,
    frameLatest.controlLine,
    frameLatest.totalScore
  );

  // 最近年框架缺失：只能保守沿用绝对分数
  if (rpLatest == null) {
    return {
      predicted: Math.round(clamp(scoreLatest, frameTarget.controlLine, frameTarget.totalScore)),
      strategy: 'hold-absolute',
      confidence: 'low',
      volatile: false,
      relPosPred: null,
      detail: { note: '缺最近年框架数据，沿用最近年绝对分数' }
    };
  }

  const rpRef =
    frameRef != null
      ? relativePosition(scoreRef, frameRef.controlLine, frameRef.totalScore)
      : null;
  const rpPrev2 =
    framePrev2 != null
      ? relativePosition(scorePrev2, framePrev2.controlLine, framePrev2.totalScore)
      : null;

  let rpPred = rpLatest;
  let basis;
  let rawDelta = null;

  if (rpPrev2 != null) {
    // 两年动量：relPos 变化的一半作为年度动量，再乘权重并封顶
    const halfStep = (rpLatest - rpPrev2) / 2;
    rawDelta = halfStep;
    const d = clamp(halfStep, -MOMENTUM_CAP, MOMENTUM_CAP);
    rpPred = rpLatest + MOMENTUM_WEIGHT * d;
    basis = 'momentum-2y-damped';
  } else if (rpRef != null) {
    // 仅一年动量：先用半步近似，再同样封顶
    const step = rpLatest - rpRef;
    rawDelta = step / 2;
    const d = clamp(step / 2, -MOMENTUM_CAP, MOMENTUM_CAP);
    rpPred = rpLatest + MOMENTUM_WEIGHT * d;
    basis = 'momentum-1y-damped';
  } else {
    basis = 'hold-relative';
  }

  rpPred = clamp(rpPred, 0, 1);

  const raw = positionToScore(
    rpPred,
    frameTarget.controlLine,
    frameTarget.totalScore
  );
  if (raw == null) return null;

  const volatile = rawDelta != null && Math.abs(rawDelta) * 2 >= VOLATILE_THRESHOLD;

  let confidence =
    basis === 'momentum-2y-damped' ? 'high' : basis === 'momentum-1y-damped' ? 'medium' : 'low';
  if (volatile && confidence === 'high') confidence = 'medium';

  return {
    predicted: Math.round(clamp(raw, frameTarget.controlLine, frameTarget.totalScore)),
    strategy: 'relative-position-momentum',
    confidence,
    volatile,
    relPosPred: Number(rpPred.toFixed(4)),
    detail: {
      relPosLatest: Number(rpLatest.toFixed(4)),
      relPosPred: Number(rpPred.toFixed(4)),
      basis,
      rawDelta: rawDelta == null ? null : Number(rawDelta.toFixed(4))
    }
  };
}

/**
 * 基于"锚点序列"的预测（推荐使用）
 *
 * 与 predictSchool 的区别：不要求历史恰为连续三年，而是接受任意稀疏的
 * (year, score) 序列，自动取"最近锚点"与"次近锚点"，并按两者年份间隔
 * 归一化年度动量。适配真实数据（部分学校缺 2024 或 2025）。
 *
 * @param {object} params
 * @param {Object<number, number>} params.series  {year: score}
 * @param {number} params.targetYear
 * @param {Function} params.frameOf  (year) => {controlLine,totalScore} | null
 * @param {{controlLine:number,totalScore:number}} params.frameTarget
 */
export function predictFromSeries({ series, targetYear, frameOf, frameTarget }) {
  if (!series || !frameTarget) return null;

  const years = Object.keys(series)
    .map(Number)
    .filter(y => Number.isFinite(y) && series[y] != null && y < targetYear)
    .sort((a, b) => b - a);

  if (!years.length) return null;

  const yLatest = years[0];
  const sLatest = series[yLatest];
  const fLatest = frameOf(yLatest);
  if (!fLatest) return null;

  const rpLatest = relativePosition(sLatest, fLatest.controlLine, fLatest.totalScore);
  if (rpLatest == null) return null;

  let rpPred = rpLatest;
  let basis = 'hold-relative';
  let yearlyMomentum = null;
  let anchorYears = [yLatest];

  if (years.length >= 2) {
    // 取次近锚点
    const yPrev = years[1];
    const fPrev = frameOf(yPrev);
    const rpPrev = fPrev
      ? relativePosition(series[yPrev], fPrev.controlLine, fPrev.totalScore)
      : null;

    if (rpPrev != null) {
      const gap = Math.max(1, yLatest - yPrev);
      yearlyMomentum = (rpLatest - rpPrev) / gap;
      const d = clamp(yearlyMomentum / 2, -MOMENTUM_CAP, MOMENTUM_CAP);
      rpPred = rpLatest + MOMENTUM_WEIGHT * d;
      basis = years.length >= 2 ? 'momentum-anchor' : 'hold-relative';
      anchorYears = [yLatest, yPrev];
    }
  }

  rpPred = clamp(rpPred, 0, 1);

  const raw = positionToScore(rpPred, frameTarget.controlLine, frameTarget.totalScore);
  if (raw == null) return null;

  const volatile = yearlyMomentum != null && Math.abs(yearlyMomentum) >= VOLATILE_THRESHOLD;

  return {
    predicted: Math.round(clamp(raw, frameTarget.controlLine, frameTarget.totalScore)),
    strategy: basis === 'momentum-anchor' ? 'relative-position-momentum' : 'hold-relative',
    confidence: basis === 'momentum-anchor' ? (volatile ? 'medium' : 'high') : 'low',
    volatile,
    relPosPred: Number(rpPred.toFixed(4)),
    anchorYears,
    detail: {
      relPosLatest: Number(rpLatest.toFixed(4)),
      relPosPred: Number(rpPred.toFixed(4)),
      basis,
      yearlyMomentum: yearlyMomentum == null ? null : Number(yearlyMomentum.toFixed(4))
    }
  };
}

/**
 * 批量预测
 *
 * @param {object} params
 * @param {number} params.targetYear
 * @param {{controlLine:number,totalScore:number}} params.frameTarget 目标年框架
 * @param {Object<number, {controlLine:number,totalScore:number,schools:Array}>} params.years 年份数据
 * @param {Array<{code:string,name:string}>} params.roster 学校名单（通常取最近年）
 * @returns {Array}
 */
export function predictYear({ targetYear, frameTarget, years, roster }) {
  const yLatest = years[targetYear - 1];
  const yRef = years[targetYear - 2];
  const yPrev2 = years[targetYear - 3];
  if (!yLatest) throw new Error(`缺少 ${targetYear - 1} 年数据`);

  const toMap = y => (y ? new Map(y.schools.map(s => [s.code, s])) : new Map());
  const iLatest = toMap(yLatest);
  const iRef = toMap(yRef);
  const iPrev2 = toMap(yPrev2);

  const frameOf = y => (y ? { controlLine: y.controlLine, totalScore: y.totalScore } : null);

  const results = [];
  for (const school of roster) {
    const latest = iLatest.get(school.code);
    const latestScore = latest?.lastLine ?? null;
    if (latestScore == null) continue;

    const p = predictSchool({
      scoreLatest: latestScore,
      scoreRef: iRef.get(school.code)?.lastLine ?? null,
      scorePrev2: iPrev2.get(school.code)?.lastLine ?? null,
      frameLatest: frameOf(yLatest),
      frameRef: frameOf(yRef),
      framePrev2: frameOf(yPrev2),
      frameTarget
    });
    if (!p) continue;

    results.push({
      schoolCode: school.code,
      schoolName: school.name,
      type: school.type ?? latest.type ?? null,
      district: school.district ?? latest.district ?? null,
      scoreLatest: latestScore,
      scoreRef: iRef.get(school.code)?.lastLine ?? null,
      scorePrev2: iPrev2.get(school.code)?.lastLine ?? null,
      ...p
    });
  }

  results.sort((a, b) => b.predicted - a.predicted);
  return results;
}

/**
 * 回测：用同一算法预测目标年，并与真实值比对
 *
 * @returns {object|null}
 */
export function backtestYear({ targetYear, years, roster }) {
  const actual = years[targetYear];
  if (!actual) return null;

  const frameTarget = { controlLine: actual.controlLine, totalScore: actual.totalScore };
  const list = (roster ?? actual.schools).map(s => ({
    code: s.code,
    name: s.name,
    type: s.type ?? null,
    district: s.district ?? null
  }));

  const preds = predictYear({ targetYear, frameTarget, years, roster: list });
  const actualMap = new Map(actual.schools.map(s => [s.code, s.lastLine]));

  const rows = [];
  for (const p of preds) {
    const a = actualMap.get(p.schoolCode);
    if (a == null) continue;
    rows.push({ ...p, actual: a, error: a - p.predicted });
  }
  if (!rows.length) return null;

  const abs = rows.map(r => Math.abs(r.error));
  const mae = abs.reduce((x, y) => x + y, 0) / abs.length;
  const rmse = Math.sqrt(abs.reduce((x, y) => x + y * y, 0) / abs.length);

  return {
    targetYear,
    sampleSize: rows.length,
    mae: Number(mae.toFixed(2)),
    rmse: Number(rmse.toFixed(2)),
    within3: abs.filter(e => e <= 3).length,
    within3Percent: Number(((abs.filter(e => e <= 3).length / rows.length) * 100).toFixed(1)),
    within5Percent: Number(((abs.filter(e => e <= 5).length / rows.length) * 100).toFixed(1)),
    within10Percent: Number(((abs.filter(e => e <= 10).length / rows.length) * 100).toFixed(1)),
    rows
  };
}

/**
 * 按目标年真实框架重算分数（官方公布总分/控制线后使用）
 */
export function rescore(relPosPred, controlLine, totalScore) {
  const s = positionToScore(relPosPred, controlLine, totalScore);
  return s == null ? null : Math.round(clamp(s, controlLine, totalScore));
}

export default {
  MOMENTUM_WEIGHT,
  MOMENTUM_CAP,
  VOLATILE_THRESHOLD,
  QUOTA_MAX_DOWNGRADE,
  relativePosition,
  positionToScore,
  predictSchool,
  predictFromSeries,
  predictYear,
  backtestYear,
  rescore,
  clamp
};
