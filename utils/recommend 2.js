const getRisk = (gap) => {
  if (gap < -8) return "out"
  if (gap <= 8) return "rush"
  if (gap <= 28) return "match"
  return "safe"
}

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

function enrichSchool(score, school, overrides = {}) {
  const line = overrides.lastLine ?? school.lastLine
  const planTotal = Object.prototype.hasOwnProperty.call(overrides, "planTotal") ? overrides.planTotal : school.planTotal
  const planNote = Object.prototype.hasOwnProperty.call(overrides, "planNote") ? overrides.planNote : school.planNote
  const gap = score - line
  const risk = getRisk(gap)
  return {
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
  }
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

function recommend({ score, hasQuota, juniorSchoolId, data }) {
  const numericScore = Number(score)
  const activeYear = Number(data.yearLabel)
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
  const enriched = data.schools.map((school) =>
    enrichSchool(numericScore, school, {
      planTotal: school.planYear && Number(school.planYear) !== activeYear ? null : school.planTotal,
      planNote: school.planYear && Number(school.planYear) !== activeYear ? `${activeYear}年招生计划待核对` : school.planNote
    })
  )
  const quotaCandidates = data.schools
    .filter((school) => school.type === "公办" && Number(school.quotaLineYear) === activeYear && Number.isFinite(Number(school.quotaLine)))
    .filter((school) => !hasCurrentQuotaAllocations || !juniorSchoolId || quotaAllocation[school.quotaCode] > 0)
    .map((school) =>
      enrichSchool(numericScore, school, {
        batch: "quota",
        code: school.quotaCode,
        lastLine: school.quotaLine,
        planTotal: hasCurrentQuotaAllocations && juniorSchoolId ? quotaAllocation[school.quotaCode] : null,
        quotaAllocation: hasCurrentQuotaAllocations && juniorSchoolId ? quotaAllocation[school.quotaCode] : null,
        planNote: hasCurrentQuotaAllocations && juniorSchoolId
          ? `${juniorSchool.name}定向名额${quotaAllocation[school.quotaCode]}人 · ${activeYear}参考线${formatScore(school.quotaLine)}分`
          : `${activeYear}年${school.quotaLineArea || "定向二次分配"}参考线${formatScore(school.quotaLine)}分 · 到校名额待补充`,
        note: `当前展示${activeYear}年官方定向二次分配线；首次定向录取线按初中毕业学校和招生高中分别划定。${hasCurrentQuotaAllocations ? "" : `${activeYear}年指标到校分配表尚未录入，暂不显示所选初中的名额数。`}`
      })
    )
  const belowControlLine = numericScore < data.minControlLine
  const unified = belowControlLine ? [] : buildPlan(enriched, "unified")
  const early = belowControlLine ? [] : buildPlan(enriched, "early")
  const privatePlan = belowControlLine ? [] : buildPlan(enriched, "private")
  const quota = hasQuota && !belowControlLine ? buildPlan(quotaCandidates, "quota", { allocationAware: true }) : []

  const ladder = [
    { key: "early", title: "提前类/特色类", items: early },
    { key: "unified", title: "普通高中统招生", items: unified },
    { key: "quota", title: "定向生", items: quota },
    { key: "private", title: "民办/其他普通高中", items: privatePlan }
  ]

  const summary = belowControlLine
    ? `当前分数低于${activeYear}年普通高中最低录取控制线，请重点关注官方补录、职业高中、中职和五年制高职等路径。`
    : `当前分数达到${activeYear}年普通高中最低录取控制线，可按冲、稳、保梯度组合志愿。`

  return {
    ok: true,
    score: numericScore,
    scoreDisplay: formatScore(numericScore),
    juniorSchoolName: juniorSchool ? juniorSchool.name : "",
    belowControlLine,
    summary,
    ladder,
    allSchools: enriched.sort(byLineDesc)
  }
}

module.exports = {
  recommend,
  riskMeta
}
