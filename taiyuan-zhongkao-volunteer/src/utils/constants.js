/** 前端常量：档位、颜色、文案 */

/** 默认目标年份（后端 predictions 表中最新的预测年） */
export const DEFAULT_TARGET_YEAR = 2027

/** 冲/稳/保三档 */
export const STRATEGIES = {
  risky: {
    key: 'risky',
    label: '冲一冲',
    short: '冲',
    desc: '分数低于预测线 5–10 分，风险较大，但录取则超值',
    badge: 'bg-rose-100 text-rose-700 ring-rose-200',
    dot: 'bg-rose-500',
    bar: 'bg-rose-500',
    text: 'text-rose-600',
    probability: '15–25%',
  },
  stable: {
    key: 'stable',
    label: '稳一稳',
    short: '稳',
    desc: '分数与预测线相差 5 分以内，录取概率较大',
    badge: 'bg-blue-100 text-blue-700 ring-blue-200',
    dot: 'bg-blue-500',
    bar: 'bg-blue-500',
    text: 'text-blue-600',
    probability: '45–65%',
  },
  safe: {
    key: 'safe',
    label: '保一保',
    short: '保',
    desc: '分数高于预测线 10 分以上，录取把握较大',
    badge: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    text: 'text-emerald-600',
    probability: '75–85%',
  },
}

export const STRATEGY_ORDER = ['risky', 'stable', 'safe']

/** 置信度 */
export const CONFIDENCE = {
  high: { label: '高置信度', short: '高', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  medium: { label: '中置信度', short: '中', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  low: { label: '低置信度', short: '低', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
}

/** 学校类型标签配色 */
export function typeBadge(type) {
  if (!type) return 'bg-slate-100 text-slate-600'
  if (type.includes('示范')) return 'bg-indigo-50 text-indigo-700'
  if (type.includes('民办')) return 'bg-orange-50 text-orange-700'
  if (type.includes('公办')) return 'bg-sky-50 text-sky-700'
  return 'bg-slate-100 text-slate-600'
}

/** 分数差展示：正数表示考生高于预测线 */
export function formatDiff(diff) {
  if (diff == null) return '—'
  const v = Math.round(diff * 10) / 10
  return `${v > 0 ? '+' : ''}${v}`
}

/** 分数展示：去掉无意义的小数 */
export function formatScore(score) {
  if (score == null) return '—'
  return Number.isInteger(score) ? String(score) : String(Math.round(score * 10) / 10)
}

/** 后端 strategy 枚举 → 中文说明 */
export const STRATEGY_LABELS = {
  'relative-position-momentum': '相对位置动量',
  'hold-relative': '保持（无历史锚点）',
  'hold-absolute': '保持（缺框架）',
  'anomaly-trend': '异常校趋势外推',
  'anomaly-holdover': '异常校保持',
  'normal-relative-position': '相对位置法',
  failed: '预测失败',
}

export function strategyLabel(s) {
  return STRATEGY_LABELS[s] || s || '—'
}

/** 中考分数合理区间（用于输入校验） */
export const SCORE_RANGE = { min: 0, max: 850 }
