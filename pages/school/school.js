const api = require('../../utils/api')
const { fmt } = require('../../utils/ui')
const config = require('../../utils/config')

Page({
  data: {
    code: '',
    loading: true,
    error: '',
    school: null,
    forecast: null,
    latest: null,
    rows: [],
    disclaimer: config.DISCLAIMER,
    targetYear: config.TARGET_YEAR
  },

  onLoad(query) {
    const code = query && query.code
    if (!code) {
      return this.setData({ loading: false, error: '缺少学校代码' })
    }
    this.setData({ code })
    wx.setNavigationBarTitle({ title: '学校详情' })
    this.loadDetail(code)
  },

  loadDetail(code) {
    api
      .getSchoolDetail(code)
      .then(({ school, history, predictions }) => {
        const forecast = (predictions || [])
          .filter((p) => p.predictedScore != null)
          .sort((a, b) => b.year - a.year)[0]

        const latest = history.length ? history[history.length - 1] : null

        // 得分率条形：把 60%~100% 映射到 0~100% 宽度，便于区分
        const rows = history
          .filter((h) => h.lastLine != null)
          .map((h) => {
            const total = Number(h.totalScore) || 0
            const rate = total ? (Number(h.lastLine) / total) * 100 : null
            const width = rate == null ? 0 : Math.max(4, Math.min(100, ((rate - 60) / 40) * 100))
            return {
              year: h.year,
              line: fmt(h.lastLine),
              quota: fmt(h.quotaLine),
              plan: h.planCount != null ? `${h.planCount}` : '—',
              rate: rate == null ? '—' : rate.toFixed(1) + '%',
              width: Math.round(width)
            }
          })
          .reverse() // 最近年份在上

        this.setData({
          loading: false,
          school,
          forecast,
          latest,
          rows
        })
      })
      .catch((err) => {
        this.setData({ loading: false, error: err.message })
      })
  },

  onShareAppMessage() {
    const { school, code } = this.data
    return {
      title: school ? `${school.name} · 历年录取线与 2027 预测` : '学校详情',
      path: `/pages/school/school?code=${code}`
    }
  }
})
