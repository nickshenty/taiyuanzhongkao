/**
 * 领域数据服务：对 API 原始返回做一层轻量整形，供页面直接使用。
 *
 * 设计原则：页面只关心"要什么数据"，不关心后端字段名；
 * 若后端字段变化，只需改这里。
 */

import api from './api'

/** 初中学校列表（按区县分组） */
export async function loadJuniorSchools() {
  const res = await api.getJuniorSchools()
  return {
    groups: res.grouped || {},
    list: res.data || [],
    total: res.total || 0,
  }
}

/** 年份列表（含总分、控制线） */
export async function loadYears() {
  const res = await api.getYears()
  return (res.data || []).sort((a, b) => b.year - a.year)
}

/** 最新预测年份 */
export async function loadLatestPredictionYear() {
  const years = await loadYears()
  // 后端 years 表包含目标年（预测框架行），取有 predictions 的最大年份
  return years.length ? Math.max(...years.map((y) => y.year)) : null
}

/** 某年全部预测（按分数降序，后端已排序） */
export async function loadPredictions(year, params = { limit: 200 }) {
  const res = await api.getPredictions(year, params)
  return {
    total: res.total || 0,
    list: res.data || [],
  }
}

/** 学校详情：历史分数线 + 预测 */
export async function loadSchoolDetail(code) {
  const res = await api.getSchoolHistory(code)
  return {
    school: res.school,
    history: (res.history || []).slice().sort((a, b) => a.year - b.year),
    predictions: res.predictions || [],
  }
}

/** 志愿推荐 */
export async function loadRecommendations(payload) {
  const res = await api.getRecommendations(payload)
  return res.data
}

/** 预测统计（置信度分布、回测指标） */
export async function loadPredictionStats(year) {
  const res = await api.getPredictionStatistics(year)
  return res.data
}

/** 算法信息 */
export async function loadAlgorithmInfo() {
  const res = await api.getAlgorithmInfo()
  return res
}
