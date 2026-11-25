import assert from 'node:assert';
import {
  classifySchool,
  calculateRecommendationLevel,
  getLevelName,
  RECOMMENDATION_LEVELS
} from '../src/services/recommendationService.js';

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('✅', name); }
  catch (e) { fail++; console.log('❌', name, '->', e.message); }
}

// ---------- 基础档位（无定向名额） ----------
t('分数高于预测20分 → 保', () => {
  const r = classifySchool({ studentScore: 700, predictedScore: 680, hasQuota: false });
  assert.equal(r.level, RECOMMENDATION_LEVELS.SAFE);
  assert.equal(getLevelName(r.level), '保一保');
});
t('分数恰高于预测10分 → 保', () => {
  const r = classifySchool({ studentScore: 690, predictedScore: 680, hasQuota: false });
  assert.equal(r.level, RECOMMENDATION_LEVELS.SAFE);
});
t('分数高于预测9分 → 稳', () => {
  const r = classifySchool({ studentScore: 689, predictedScore: 680, hasQuota: false });
  assert.equal(r.level, RECOMMENDATION_LEVELS.STABLE);
  assert.equal(getLevelName(r.level), '稳一稳');
});
t('分数等于预测 → 稳', () => {
  const r = classifySchool({ studentScore: 680, predictedScore: 680, hasQuota: false });
  assert.equal(r.level, RECOMMENDATION_LEVELS.STABLE);
});
t('分数低于预测5分 → 稳', () => {
  const r = classifySchool({ studentScore: 675, predictedScore: 680, hasQuota: false });
  assert.equal(r.level, RECOMMENDATION_LEVELS.STABLE);
});
t('分数低于预测6分 → 冲', () => {
  const r = classifySchool({ studentScore: 674, predictedScore: 680, hasQuota: false });
  assert.equal(r.level, RECOMMENDATION_LEVELS.RISKY);
  assert.equal(getLevelName(r.level), '冲一冲');
});
t('分数低于预测10分 → 冲', () => {
  const r = classifySchool({ studentScore: 670, predictedScore: 680, hasQuota: false });
  assert.equal(r.level, RECOMMENDATION_LEVELS.RISKY);
});
t('分数低于预测11分 → 不推荐', () => {
  const r = classifySchool({ studentScore: 669, predictedScore: 680, hasQuota: false });
  assert.equal(r.level, null);
});

// ---------- 定向名额修正 ----------
t('无定向名额时低于11分被排除', () => {
  const r = classifySchool({ studentScore: 640, predictedScore: 680, hasQuota: false });
  assert.equal(r.level, null);
});
t('有定向名额，低于30分 → 定向升级为冲', () => {
  const r = classifySchool({ studentScore: 650, predictedScore: 680, hasQuota: true, controlLine: 603 });
  assert.equal(r.level, RECOMMENDATION_LEVELS.RISKY);
  assert.equal(r.quotaUpgraded, true);
  assert.equal(r.quotaLineEstimate, 630);
});
t('有定向名额，低于50分（边界）→ 定向升级', () => {
  const r = classifySchool({ studentScore: 630, predictedScore: 680, hasQuota: true, controlLine: 603 });
  assert.equal(r.level, RECOMMENDATION_LEVELS.RISKY);
  assert.equal(r.quotaUpgraded, true);
});
t('有定向名额，低于51分（超界）→ 不推荐', () => {
  const r = classifySchool({ studentScore: 629, predictedScore: 680, hasQuota: true, controlLine: 603 });
  assert.equal(r.level, null);
});
t('定向线不低于最低控制线', () => {
  const r = classifySchool({ studentScore: 610, predictedScore: 620, hasQuota: true, controlLine: 603 });
  assert.equal(r.quotaLineEstimate, 603); // 620-50=570 < 603 → 取 603
});
t('定向可强化已属冲档的标记', () => {
  const r = classifySchool({ studentScore: 672, predictedScore: 680, hasQuota: true, controlLine: 603 });
  assert.equal(r.level, RECOMMENDATION_LEVELS.RISKY);
  assert.equal(r.quotaUpgraded, true);
});
t('定向不改变稳/保档位', () => {
  const stable = classifySchool({ studentScore: 680, predictedScore: 680, hasQuota: true, controlLine: 603 });
  assert.equal(stable.level, RECOMMENDATION_LEVELS.STABLE);
  assert.equal(stable.quotaUpgraded, false);
  const safe = classifySchool({ studentScore: 700, predictedScore: 680, hasQuota: true, controlLine: 603 });
  assert.equal(safe.level, RECOMMENDATION_LEVELS.SAFE);
  assert.equal(safe.quotaUpgraded, false);
});

// ---------- 边界一致性 ----------
t('calculateRecommendationLevel 与 classifySchool 无定向时一致', () => {
  for (let d = -60; d <= 60; d++) {
    const a = calculateRecommendationLevel(700 + d, 700);
    const b = classifySchool({ studentScore: 700 + d, predictedScore: 700, hasQuota: false }).level;
    assert.equal(a, b, `diff=${d}`);
  }
});

console.log(`\n通过 ${pass}，失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
