/** 冲 / 稳 / 保 三档展示配置（与后端 recommendationService 保持一致） */

const STRATEGIES = {
  risky: {
    key: 'risky',
    label: '冲一冲',
    desc: '低于预测线 5–10 分',
    color: '#e11d48',
    bg: '#fff1f2',
    border: '#fecdd3'
  },
  stable: {
    key: 'stable',
    label: '稳一稳',
    desc: '与预测线相差 ±5 分内',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe'
  },
  safe: {
    key: 'safe',
    label: '保一保',
    desc: '高于预测线 10 分以上',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#a7f3d0'
  }
}

const ORDER = ['risky', 'stable', 'safe']

const CONFIDENCE = {
  high: { label: '高置信', color: '#047857', bg: '#ecfdf5' },
  medium: { label: '中置信', color: '#b45309', bg: '#fffbeb' },
  low: { label: '低置信', color: '#64748b', bg: '#f1f5f9' }
}

/** 把后端推荐结果整理成页面用的分组结构 */
function buildGroups(result) {
  if (!result || !result.recommendations) return []
  return ORDER.map((key) => {
    const cfg = STRATEGIES[key]
    const list = (result.recommendations[key] || []).map((s) => ({
      ...s,
      diffText:
        s.scoreDiff == null
          ? '—'
          : `${s.scoreDiff > 0 ? '+' : ''}${s.scoreDiff}`,
      conf: CONFIDENCE[s.confidence] || CONFIDENCE.low
    }))
    return { ...cfg, list }
  }).filter((g) => g.list.length > 0)
}

/** 分数展示：整数不带小数点 */
function fmt(score) {
  if (score == null) return '—'
  const n = Number(score)
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10)
}

module.exports = { STRATEGIES, ORDER, CONFIDENCE, buildGroups, fmt }
