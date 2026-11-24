/**
 * v1.5增强版推荐算法 - 集成动态阈值
 * 基于原recommend.js，增加动态阈值支持
 */

const { calculateDynamicThresholds, getRiskWithDynamicThresholds } = require('./recommend-v15');

const riskMeta = {
  out: { label: "风险过高", tone: "danger", advice: "与参考线差距较大，不建议作为核心志愿。" },
  rush: { label: "冲", tone: "warn", advice: "有冲刺空间，建议放在前部且数量控制。" },
  match: { label: "稳", tone: "ok", advice: "与分数匹配度较高，适合放在中部主力志愿。" },
  safe: { label: "保", tone: "calm", advice: "安全边际较好，适合作为后部保底志愿。" }
}

const byGapDesc = (a, b) => b.gap - a.gap
const byLineDesc = (a, b) => b.lastLine - a.lastLine
const byAllocationDesc = (a, b) => (b.quotaAllocation || 0) - (a.quotaAllocation || 0) || byLineDesc(a, b)

const formatSignedScore = (value) => {
  const fixed = Number(value).toFixed(2)
  return value >= 0 ? `+${fixed}` : fixed
}

const formatScore = (value) => Number(value).toFixed(2)

/**
 * v1.0原始getRisk函数（保留作为fallback）
 */
function getRiskV10(gap) {
  if (gap < -8) return "out"
  if (gap <= 8) return "rush"
  if (gap <= 28) return "match"
  return "safe"
}

/**
 * enrichSchool函数 - 支持v1.0和v1.5两种模式
 * @param {number} score - 考生分数
 * @param {Object} school - 学校对象
 * @param {Object} data - 年度数据
 * @param {Object} overrides - 覆盖参数
 * @param {Object} options - 选项 { useDynamicThresholds: boolean }
 */
function enrichSchool(score, school, data, overrides = {}, options = {}) {
  const line = overrides.lastLine ?? school.lastLine
  const planTotal = Object.prototype.hasOwnProperty.call(overrides, "planTotal") ? overrides.planTotal : school.planTotal
  const planNote = Object.prototype.hasOwnProperty.call(overrides, "planNote") ? overrides.planNote : school.planNote
  const gap = score - line
  
  let risk;
  let dynamicInfo = null;
  
  // 如果启用动态阈值且有必要数据
  if (options.useDynamicThresholds && data.totalScore && school.tier) {
    try {
      // 计算招生计划变化率
      let planChangeRate = 0;
      if (school.planTotal && school.planTotalLastYear) {
        planChangeRate = (school.planTotal - school.planTotalLastYear) / school.planTotalLastYear;
      }
      
      // 计算动态阈值
      const dynamicResult = calculateDynamicThresholds({
        score,
        totalScore: data.totalScore,
        schoolTier: school.tier,
        volatility: school.volatility || 5,
        planChangeRate
      });
      
      // 使用动态阈值计算风险
      risk = getRiskWithDynamicThresholds(gap, dynamicResult.thresholds);
      
      // 保存动态信息供调试
      dynamicInfo = {
        thresholds: dynamicResult.thresholds,
        multiplier: dynamicResult.multipliers.total,
        appliedRule: dynamicResult.debug.appliedRule
      };
    } catch (error) {
      // 动态阈值计算失败时回退到v1.0
      console.warn('动态阈值计算失败，回退到v1.0固定阈值:', error.message);
      risk = getRiskV10(gap);
    }
  } else {
    // 使用v1.0固定阈值
    risk = getRiskV10(gap);
  }
  
  const result = {
    ...school,
    ...overrides,
    lastLine: line,
    planTotal,
    planNote,
    gap,
    gapDisplay: formatSignedScore(gap),
    lastLineDisplay: formatScore(line),
    planDisplay: planTotal ? `${planTotal} 人` : "待核对",
    risk,
    riskLabel: riskMeta[risk].label,
    tone: riskMeta[risk].tone,
    advice: riskMeta[risk].advice
  };
  
  // 如果使用了动态阈值，附加调试信息
  if (dynamicInfo) {
    result._dynamicThresholds = dynamicInfo;
  }
  
  return result;
}

function buildPlan(items, batchKey, options = {}) {
  const scoped = items.filter((item) => item.batch === batchKey && item.risk !== "out")
  const riskSorter = options.allocationAware ? byAllocationDesc : byLineDesc
  const matchSorter = options.allocationAware ? byAllocationDesc : byGapDesc
  const rush = scoped.filter((item) => item.risk === "rush").sort(riskSorter).slice(0, 2)
  const match = scoped.filter((item) => item.risk === "match").sort(matchSorter).slice(0, 3)
  const safeSlots = Math.max(1, 6 - rush.length - match.length)
  const safe = scoped.filter((item) => item.risk === "safe").sort(riskSorter).slice(0, safeSlots)
  return [...rush, ...match, ...safe].slice(0, 6)
}

/**
 * 主推荐函数
 * @param {Object} params
 * @param {number} params.score - 考生分数
 * @param {boolean} params.hasQuota - 是否有定向资格
 * @param {string} params.juniorSchoolId - 初中学校ID
 * @param {Object} params.data - 年度数据
 * @param {Object} params.options - 选项 { useDynamicThresholds: boolean, algorithm: 'v1.0'|'v1.5' }
 */
function recommend({ score, hasQuota, juniorSchoolId, data, options = {} }) {
  const numericScore = Number(score)
  const activeYear = Number(data.yearLabel)
  
  // 默认启用v1.5动态阈值
  const useDynamicThresholds = options.algorithm === 'v1.5' || options.useDynamicThresholds !== false;
  
  if (!Number.isFinite(numericScore)) {
    return { ok: false, message: "请输入有效的中考分数。" }
  }

  if (numericScore < 0 || numericScore > data.totalScore) {
    return { ok: false, message: `分数需在 0-${data.totalScore} 分之间。` }
  }

  if (hasQuota && data.quotaAllocationReady && !juniorSchoolId) {
    return { ok: false, message: "请选择初中就读学校后再生成定向生推荐。" }
  }

  const hasCurrentQuotaAllocations = Number(data.quotaAllocationYear) === activeYear
  const quotaAllocation = hasCurrentQuotaAllocations && juniorSchoolId ? data.quotaAllocations[juniorSchoolId] || {} : {}
  const juniorSchool = juniorSchoolId ? data.juniorSchools.find((item) => item.id === juniorSchoolId) : null
  
  const enrichOptions = { useDynamicThresholds };
  
  const enriched = data.schools.map((school) =>
    enrichSchool(numericScore, school, data, {
      planTotal: school.planYear && Number(school.planYear) !== activeYear ? null : school.planTotal,
      planNote: school.planYear && Number(school.planYear) !== activeYear ? `${activeYear}年招生计划待核对` : school.planNote
    }, enrichOptions)
  )
  
  const quotaCandidates = data.schools
    .filter((school) => school.type === "公办" && Number(school.quotaLineYear) === activeYear && Number.isFinite(Number(school.quotaLine)))
    .filter((school) => !hasCurrentQuotaAllocations || !juniorSchoolId || quotaAllocation[school.quotaCode] > 0)
    .map((school) =>
      enrichSchool(numericScore, school, data, {
        batch: "quota",
        code: school.quotaCode,
        lastLine: school.quotaLine,
        planTotal: hasCurrentQuotaAllocations && juniorSchoolId ? quotaAllocation[school.quotaCode] : null,
        quotaAllocation: hasCurrentQuotaAllocations && juniorSchoolId ? quotaAllocation[school.quotaCode] : null,
        planNote: hasCurrentQuotaAllocations && juniorSchoolId
          ? `${juniorSchool.name}定向名额${quotaAllocation[school.quotaCode]}人 · ${activeYear}参考线${formatScore(school.quotaLine)}分`
          : `${activeYear}年${school.quotaLineArea || "定向二次分配"}参考线${formatScore(school.quotaLine)}分 · 到校名额待补充`,
        note: `当前展示${activeYear}年官方定向二次分配线；首次定向录取线按初中毕业学校和招生高中分别划定。${hasCurrentQuotaAllocations ? "" : `${activeYear}年指标到校分配表尚未录入，暂不显示所选初中的名额数。`}`
      }, enrichOptions)
    )
    
  const belowControlLine = numericScore < data.minControlLine
  const early = buildPlan(enriched, "early")
  const unified = buildPlan(enriched, "unified")
  const quota = hasQuota ? buildPlan(quotaCandidates, "quota", { allocationAware: true }) : []

  return {
    ok: true,
    score: numericScore,
    algorithm: useDynamicThresholds ? 'v1.5 动态阈值' : 'v1.0 固定阈值',
    belowControlLine,
    controlLineWarning: belowControlLine
      ? `当前分数低于${activeYear}年最低控制线${data.minControlLine}分，录取可能性较低。`
      : null,
    early,
    unified,
    quota,
    allSchools: enriched,
    quotaCandidates
  }
}

module.exports = {
  recommend,
  enrichSchool,
  buildPlan,
  getRiskV10,
  // 导出供外部使用
  calculateDynamicThresholds,
  getRiskWithDynamicThresholds
}
