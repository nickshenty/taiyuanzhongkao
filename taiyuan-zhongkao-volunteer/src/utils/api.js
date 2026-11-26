/**
 * 后端 API 客户端
 *
 * 开发环境通过 Vite 代理（vite.config.js）把 /api 转发到本地后端，
 * 生产环境可用 VITE_API_BASE 指定完整地址。
 */

const BASE =
  (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '') + '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  let body = null
  try {
    body = await res.json()
  } catch {
    /* 非 JSON 响应 */
  }

  if (!res.ok) {
    const msg =
      body?.error || body?.message || `请求失败（HTTP ${res.status}）`
    const err = new Error(msg)
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

const qs = (obj) => {
  const p = new URLSearchParams()
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.append(k, v)
  })
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const api = {
  // ---------- 基础 ----------
  health: () => request('/../../health').catch(() => null),

  getYears: () => request('/years'),
  getYear: (year) => request(`/years/${year}`),
  getYearSchools: (year, type = 'all') =>
    request(`/years/${year}/schools${qs({ type })}`),

  // ---------- 学校 ----------
  getSchools: (params) => request(`/schools${qs(params)}`),
  getSchool: (code) => request(`/schools/${code}`),
  getSchoolHistory: (code) => request(`/schools/${code}/history`),

  // ---------- 初中 / 定向 ----------
  getJuniorSchools: () => request('/junior-schools/list/all'),
  getJuniorSchoolQuotas: (id, year) =>
    request(`/junior-schools/${id}/quotas${qs({ year })}`),

  // ---------- 预测 ----------
  getPredictions: (year, params) =>
    request(`/predictions/${year}${qs(params)}`),
  getPredictionStatistics: (year) =>
    request(`/predictions/${year}/statistics`),
  getSchoolPrediction: (code, year) =>
    request(`/predictions/school/${code}${qs({ year })}`),

  // ---------- 推荐（核心） ----------
  getRecommendations: ({ studentScore, juniorSchoolId, targetYear }) =>
    request('/recommendations', {
      method: 'POST',
      body: JSON.stringify({ studentScore, juniorSchoolId, targetYear }),
    }),

  // ---------- 算法信息 ----------
  getAlgorithmInfo: () => request('/algorithm/info'),
  getRecommendationInfo: () => request('/recommendations/info'),
}

export default api
