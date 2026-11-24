/**
 * v1.5 动态阈值推荐算法
 * 根据分数段、学校层次、历年波动动态调整"冲稳保"阈值
 */

/**
 * 计算动态阈值
 * @param {Object} context - 上下文参数
 * @param {number} context.score - 考生分数
 * @param {number} context.totalScore - 中考总分
 * @param {string} context.schoolTier - 学校层次：'省级示范'|'市级示范'|'一般高中'|'民办'
 * @param {number} context.volatility - 学校历年波动（标准差），默认5分
 * @param {number} context.planChangeRate - 招生计划变化率，默认0（-1表示缩招100%，+1表示扩招100%）
 * @returns {Object} { rush: [min, max], match: [min, max], safe: [min, max] }
 */
function calculateDynamicThresholds(context) {
  const { score, totalScore, schoolTier, volatility = 5, planChangeRate = 0 } = context;
  
  // 基准阈值（v1.0固定值）
  const baseThresholds = {
    rush: [-8, 8],    // 冲：统招线下8分到上8分
    match: [8, 28],   // 稳：统招线上8-28分
    safe: [28, 100]   // 保：统招线上28分以上
  };
  
  // 1. 根据分数段调整（高分段更激烈，低分段更宽松）
  let scoreMultiplier = 1.0;
  const scoreRate = score / totalScore;
  
  if (scoreRate >= 0.93) {
    // 高分段（780+/839分，即93%以上）：竞争激烈，阈值收紧
    scoreMultiplier = 0.75;
  } else if (scoreRate >= 0.77) {
    // 中高分段（650-780/839，即77%-93%）：标准阈值
    scoreMultiplier = 1.0;
  } else if (scoreRate >= 0.72) {
    // 中低分段（603-650/839，即72%-77%）：接近控制线，阈值略放宽
    scoreMultiplier = 1.2;
  } else {
    // 低分段（<603/839，即<72%）：选择有限，阈值显著放宽
    scoreMultiplier = 1.5;
  }
  
  // 2. 根据学校层次调整（高层次学校更稳定）
  let tierMultiplier = 1.0;
  
  if (schoolTier === '省级示范') {
    // 省示范：录取线稳定，竞争激烈，阈值收紧
    tierMultiplier = 0.85;
  } else if (schoolTier === '市级示范') {
    // 市示范：相对稳定
    tierMultiplier = 0.95;
  } else if (schoolTier === '民办') {
    // 民办：波动大，阈值放宽
    tierMultiplier = 1.3;
  } else {
    // 一般高中：标准
    tierMultiplier = 1.0;
  }
  
  // 3. 根据历年波动调整（波动大的学校阈值放宽）
  const volatilityMultiplier = 1 + (volatility - 5) / 20;
  // volatility=5时，乘数=1.0（标准）
  // volatility=10时，乘数=1.25（波动大，阈值放宽25%）
  // volatility=0时，乘数=0.75（波动小，阈值收紧25%）
  
  // 4. 根据招生计划变化调整
  let planMultiplier = 1.0;
  
  if (planChangeRate > 0.1) {
    // 扩招10%以上：录取概率提升，阈值下调
    planMultiplier = 0.9;
  } else if (planChangeRate > 0.2) {
    // 扩招20%以上：录取概率显著提升
    planMultiplier = 0.8;
  } else if (planChangeRate < -0.1) {
    // 缩招10%以上：录取概率下降，阈值上调
    planMultiplier = 1.1;
  } else if (planChangeRate < -0.2) {
    // 缩招20%以上：录取概率显著下降
    planMultiplier = 1.2;
  }
  
  // 综合调整系数
  const totalMultiplier = scoreMultiplier * tierMultiplier * volatilityMultiplier * planMultiplier;
  
  // 应用调整系数到基准阈值
  const dynamicThresholds = {
    rush: [
      baseThresholds.rush[0] * totalMultiplier,
      baseThresholds.rush[1] * totalMultiplier
    ],
    match: [
      baseThresholds.match[0] * totalMultiplier,
      baseThresholds.match[1] * totalMultiplier
    ],
    safe: [
      baseThresholds.safe[0] * totalMultiplier,
      baseThresholds.safe[1] * totalMultiplier
    ]
  };
  
  return {
    thresholds: dynamicThresholds,
    multipliers: {
      score: scoreMultiplier,
      tier: tierMultiplier,
      volatility: volatilityMultiplier,
      plan: planMultiplier,
      total: totalMultiplier
    },
    debug: {
      scoreRate: scoreRate.toFixed(3),
      appliedRule: scoreRate >= 0.93 ? '高分段' : scoreRate >= 0.77 ? '中高分段' : scoreRate >= 0.72 ? '中低分段' : '低分段'
    }
  };
}

/**
 * 使用动态阈值计算风险等级
 * @param {number} gap - 分差（考生分数 - 学校录取线）
 * @param {Object} thresholds - 动态阈值对象
 * @returns {string} 'out' | 'rush' | 'match' | 'safe'
 */
function getRiskWithDynamicThresholds(gap, thresholds) {
  if (gap < thresholds.rush[0]) {
    return 'out';  // 风险过高
  }
  if (gap <= thresholds.rush[1]) {
    return 'rush'; // 冲
  }
  if (gap <= thresholds.match[1]) {
    return 'match'; // 稳
  }
  return 'safe';    // 保
}

/**
 * v1.5增强版enrichSchool函数
 * @param {number} score - 考生分数
 * @param {Object} school - 学校对象
 * @param {Object} data - 年度数据（包含totalScore）
 * @param {Object} overrides - 覆盖参数
 * @returns {Object} 增强后的学校对象
 */
function enrichSchoolV15(score, school, data, overrides = {}) {
  const line = overrides.lastLine ?? school.lastLine;
  const planTotal = Object.prototype.hasOwnProperty.call(overrides, 'planTotal') 
    ? overrides.planTotal 
    : school.planTotal;
  const planNote = Object.prototype.hasOwnProperty.call(overrides, 'planNote') 
    ? overrides.planNote 
    : school.planNote;
  
  const gap = score - line;
  
  // 计算招生计划变化率（如果有历史数据）
  let planChangeRate = 0;
  if (school.planTotal && school.planTotalLastYear) {
    planChangeRate = (school.planTotal - school.planTotalLastYear) / school.planTotalLastYear;
  }
  
  // 获取学校层次
  const schoolTier = school.tier || '一般高中';
  
  // 计算动态阈值
  const dynamicResult = calculateDynamicThresholds({
    score,
    totalScore: data.totalScore,
    schoolTier,
    volatility: school.volatility || 5,
    planChangeRate
  });
  
  // 使用动态阈值计算风险等级
  const risk = getRiskWithDynamicThresholds(gap, dynamicResult.thresholds);
  
  // 风险元数据
  const riskMeta = {
    out: { label: '风险过高', tone: 'danger', advice: '与参考线差距较大，不建议作为核心志愿。' },
    rush: { label: '冲', tone: 'warn', advice: '有冲刺空间，建议放在前部且数量控制。' },
    match: { label: '稳', tone: 'ok', advice: '与分数匹配度较高，适合放在中部主力志愿。' },
    safe: { label: '保', tone: 'calm', advice: '安全边际较好，适合作为后部保底志愿。' }
  };
  
  // 格式化函数
  const formatSignedScore = (value) => {
    const fixed = Number(value).toFixed(2);
    return value >= 0 ? `+${fixed}` : fixed;
  };
  const formatScore = (value) => Number(value).toFixed(2);
  
  return {
    ...school,
    ...overrides,
    lastLine: line,
    planTotal,
    planNote,
    gap,
    gapDisplay: formatSignedScore(gap),
    lastLineDisplay: formatScore(line),
    planDisplay: planTotal ? `${planTotal} 人` : '待核对',
    risk,
    riskLabel: riskMeta[risk].label,
    tone: riskMeta[risk].tone,
    advice: riskMeta[risk].advice,
    // v1.5新增：动态阈值信息（可选，用于调试）
    dynamicThresholds: dynamicResult.thresholds,
    thresholdMultiplier: dynamicResult.multipliers.total,
    appliedRule: dynamicResult.debug.appliedRule
  };
}

module.exports = {
  calculateDynamicThresholds,
  getRiskWithDynamicThresholds,
  enrichSchoolV15
};
