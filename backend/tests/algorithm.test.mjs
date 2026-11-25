import assert from 'node:assert';
import {
  relativePosition,
  positionToScore,
  predictSchool,
  predictYear,
  backtestYear,
  rescore,
  clamp,
  MOMENTUM_WEIGHT,
  MOMENTUM_CAP
} from '../src/algorithms/predictionAlgorithmV1.5.js';

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log('✅', name); }
  catch (e) { fail++; console.log('❌', name, '->', e.message); }
};
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// ---------- 相对位置 ----------
t('relativePosition 基本计算', () => {
  near(relativePosition(695, 603, 839), (695 - 603) / (839 - 603));
});
t('relativePosition 边界：等于控制线 → 0', () => {
  assert.equal(relativePosition(603, 603, 839), 0);
});
t('relativePosition 边界：等于总分 → 1', () => {
  assert.equal(relativePosition(839, 603, 839), 1);
});
t('relativePosition 参数缺失 → null', () => {
  assert.equal(relativePosition(null, 603, 839), null);
  assert.equal(relativePosition(700, 0, 839), null);
  assert.equal(relativePosition(700, 603, 603), null); // span=0
});

// ---------- 反算 ----------
t('positionToScore 与 relativePosition 互逆', () => {
  const rp = relativePosition(700, 603, 839);
  near(positionToScore(rp, 603, 839), 700);
});
t('rescore 可在新框架下重算', () => {
  const rp = 0.5;
  assert.equal(rescore(rp, 603, 839), Math.round(603 + 0.5 * 236));
  assert.equal(rescore(rp, 615, 850), Math.round(615 + 0.5 * 235));
});

// ---------- 预测：三种 basis ----------
const frameLatest = { controlLine: 603, totalScore: 839 };

t('无 prev2/ref → hold-relative，预测=最近年分数', () => {
  const p = predictSchool({
    scoreLatest: 700,
    frameLatest,
    frameTarget: frameLatest
  });
  assert.equal(p.strategy, 'relative-position-momentum');
  assert.equal(p.predicted, 700);
  assert.equal(p.confidence, 'low');
  assert.equal(p.detail.basis, 'hold-relative');
});

t('只有 ref → 1y 动量，置信度 medium', () => {
  const frameRef = { controlLine: 615, totalScore: 850 };
  const p = predictSchool({
    scoreLatest: 700,
    scoreRef: 690, // 2025 相对位置更低
    frameLatest,
    frameRef,
    frameTarget: frameLatest
  });
  assert.equal(p.detail.basis, 'momentum-1y-damped');
  assert.equal(p.confidence, 'medium');
  assert.ok(p.predicted > 700, '相对位置上升应带动预测上移');
});

t('有 prev2 → 2y 动量，置信度 high', () => {
  const frameRef = { controlLine: 615, totalScore: 850 };
  const framePrev2 = { controlLine: 523, totalScore: 730 };
  const p = predictSchool({
    scoreLatest: 700,
    scoreRef: 690,
    scorePrev2: 600,
    frameLatest,
    frameRef,
    framePrev2,
    frameTarget: frameLatest
  });
  assert.equal(p.detail.basis, 'momentum-2y-damped');
  assert.equal(p.confidence, 'high');
});

// ---------- 动量封顶 ----------
t('动量变化被 CAP 封顶', () => {
  const framePrev2 = { controlLine: 523, totalScore: 730 };
  // 构造 prev2 相对位置极低 → 半步变化很大
  const p = predictSchool({
    scoreLatest: 800,
    scorePrev2: 530, // relPos ≈ 0.034
    frameLatest,
    framePrev2,
    frameTarget: frameLatest
  });
  const halfStep = (p.detail.relPosLatest - relativePosition(530, 523, 730)) / 2;
  assert.ok(halfStep > MOMENTUM_CAP, '构造的半步应超过封顶');
  near(p.relPosPred, p.detail.relPosLatest + MOMENTUM_WEIGHT * MOMENTUM_CAP, 1e-4);
});

// ---------- 边界钳制 ----------
t('预测值不会超出目标年框架', () => {
  const tight = { controlLine: 603, totalScore: 839 };
  const p = predictSchool({
    scoreLatest: 838,
    scorePrev2: 604,
    frameLatest: tight,
    framePrev2: { controlLine: 603, totalScore: 839 },
    frameTarget: tight
  });
  assert.ok(p.predicted <= tight.totalScore && p.predicted >= tight.controlLine);
});

t('最近年无分数 → null', () => {
  assert.equal(predictSchool({ scoreLatest: null, frameLatest, frameTarget: frameLatest }), null);
});

// ---------- 批量与回测 ----------
const mkYear = (year, controlLine, totalScore, rows) => ({
  year,
  controlLine,
  totalScore,
  schools: rows.map(([code, name, lastLine]) => ({ code, name, lastLine }))
});

t('predictYear 批量预测按分数降序', () => {
  const years = {
    2025: mkYear(2025, 615, 850, [['A', '甲', 800], ['B', '乙', 700]]),
    2024: mkYear(2024, 523, 730, [['A', '甲', 680], ['B', '乙', 600]])
  };
  const res = predictYear({
    targetYear: 2026,
    frameTarget: { controlLine: 603, totalScore: 839 },
    years,
    roster: [{ code: 'A', name: '甲' }, { code: 'B', name: '乙' }]
  });
  assert.equal(res.length, 2);
  assert.ok(res[0].predicted >= res[1].predicted);
});

t('predictYear 缺少最近年数据则抛错', () => {
  assert.throws(() => predictYear({ targetYear: 2026, frameTarget: { controlLine: 603, totalScore: 839 }, years: {}, roster: [] }));
});

t('backtestYear 能算出 MAE', () => {
  const years = {
    2025: mkYear(2025, 615, 850, [['A', '甲', 800]]),
    2024: mkYear(2024, 523, 730, [['A', '甲', 680]]),
    2026: mkYear(2026, 603, 839, [['A', '甲', 810]])
  };
  const bt = backtestYear({ targetYear: 2026, years });
  assert.ok(bt);
  assert.equal(bt.sampleSize, 1);
  assert.equal(typeof bt.mae, 'number');
});

t('clamp 正常', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(99, 0, 10), 10);
});

console.log(`\n通过 ${pass}，失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
