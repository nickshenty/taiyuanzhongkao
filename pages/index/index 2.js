const { availableYears, defaultYear, getAdmissionData } = require("../../data")
const { recommend } = require("../../utils/recommend")

const initialData = getAdmissionData(defaultYear)

Page({
  data: {
    data: initialData,
    availableYears,
    selectedYearIndex: availableYears.indexOf(defaultYear),
    juniorSchoolNames: initialData.juniorSchools.map((item) => item.name),
    selectedJuniorSchoolIndex: null,
    selectedJuniorSchoolName: "",
    selectedJuniorSchoolId: "",
    score: "",
    hasQuota: false,
    error: "",
    result: null
  },

  onScoreInput(event) {
    this.setData({ score: event.detail.value, error: "" })
  },

  onYearChange(event) {
    const selectedYearIndex = Number(event.detail.value)
    const selectedYear = availableYears[selectedYearIndex]
    const data = getAdmissionData(selectedYear)
    this.setData({
      data,
      selectedYearIndex,
      juniorSchoolNames: data.juniorSchools.map((item) => item.name),
      selectedJuniorSchoolIndex: null,
      selectedJuniorSchoolName: "",
      selectedJuniorSchoolId: "",
      error: "",
      result: null
    })
  },

  onQuotaChange(event) {
    const hasQuota = event.detail.value
    this.setData({
      hasQuota,
      error: "",
      selectedJuniorSchoolIndex: hasQuota ? this.data.selectedJuniorSchoolIndex : null,
      selectedJuniorSchoolName: hasQuota ? this.data.selectedJuniorSchoolName : "",
      selectedJuniorSchoolId: hasQuota ? this.data.selectedJuniorSchoolId : ""
    })
  },

  onJuniorSchoolChange(event) {
    const index = Number(event.detail.value)
    const school = this.data.data.juniorSchools[index]
    this.setData({
      selectedJuniorSchoolIndex: index,
      selectedJuniorSchoolName: school.name,
      selectedJuniorSchoolId: school.id,
      error: ""
    })
  },

  onRecommend() {
    const result = recommend({
      score: this.data.score,
      hasQuota: this.data.hasQuota,
      juniorSchoolId: this.data.selectedJuniorSchoolId,
      data: this.data.data
    })

    if (!result.ok) {
      this.setData({ error: result.message, result: null })
      return
    }

    this.setData({ error: "", result })
  },

  openSchool(event) {
    const id = event.currentTarget.dataset.id
    const batch = event.currentTarget.dataset.batch || ""
    wx.navigateTo({
      url: `/pages/school/school?id=${id}&score=${this.data.score}&batch=${batch}`
        + `&juniorSchoolId=${this.data.selectedJuniorSchoolId}&year=${this.data.data.yearLabel}`
    })
  }
})
