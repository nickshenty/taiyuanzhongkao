const config = require('../../utils/config')
const api = require('../../utils/api')
const { buildGroups } = require('../../utils/ui')

Page({
  data: {
    targetYear: config.TARGET_YEAR,
    disclaimer: config.DISCLAIMER,

    score: '',
    junior: null,
    loading: false,
    error: '',

    // 选校弹层
    juniorOpen: false,
    keyword: '',
    juniorList: [],
    filteredJuniors: [],

    // 推荐结果
    result: null,
    groups: [],
    quotaNote: ''
  },

  onLoad() {
    this.loadJuniorSchools()
  },

  /** 拉取初中学校列表（145 所，用于选校） */
  loadJuniorSchools() {
    api
      .getJuniorSchools()
      .then((list) => {
        this.setData({ juniorList: list, filteredJuniors: list })
      })
      .catch((err) => {
        this.setData({
          error: `无法加载初中学校列表：${err.message}`
        })
      })
  },

  onScoreInput(e) {
    this.setData({ score: e.detail.value, error: '' })
  },

  // ---------- 选校弹层 ----------
  openJuniorPicker() {
    this.setData({ juniorOpen: true, keyword: '', filteredJuniors: this.data.juniorList })
  },

  closeJuniorPicker() {
    this.setData({ juniorOpen: false })
  },

  onJuniorSearch(e) {
    const kw = (e.detail.value || '').trim()
    const list = this.data.juniorList
    this.setData({
      keyword: kw,
      filteredJuniors: kw ? list.filter((s) => s.name.indexOf(kw) >= 0) : list
    })
  },

  pickJunior(e) {
    const id = e.currentTarget.dataset.id
    const junior = this.data.juniorList.find((s) => s.id === id) || null
    this.setData({ junior, juniorOpen: false, error: '' })
  },

  noop() {},

  // ---------- 提交 ----------
  onSubmit() {
    const score = Number(this.data.score)
    if (!this.data.score || isNaN(score)) {
      return this.setData({ error: '请输入中考分数' })
    }
    if (score < 0 || score > 900) {
      return this.setData({ error: '分数应在 0–900 之间' })
    }
    if (!this.data.junior) {
      return this.setData({ error: '请选择就读的初中学校（用于定向名额判断）' })
    }

    this.setData({ loading: true, error: '' })

    api
      .getRecommendations({
        studentScore: score,
        juniorSchoolId: this.data.junior.id,
        targetYear: config.TARGET_YEAR
      })
      .then((data) => {
        this.setData({
          result: data,
          groups: buildGroups(data),
          quotaNote: data.quotaNote || '',
          loading: false
        })
      })
      .catch((err) => {
        this.setData({ loading: false, error: err.message })
      })
  },

  // ---------- 跳转 ----------
  toSchool(e) {
    const code = e.currentTarget.dataset.code
    wx.navigateTo({ url: `/pages/school/school?code=${code}` })
  },

  onShareAppMessage() {
    const { result, score, junior } = this.data
    const title = result
      ? `${score} 分（${junior.name}）的 2027 志愿推荐`
      : `${config.APP_NAME} · 输入分数看冲稳保`
    return {
      title,
      path: '/pages/index/index'
    }
  }
})
