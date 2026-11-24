const { defaultYear, getAdmissionData } = require("../../data")
const { recommend } = require("../../utils/recommend")

Page({
  data: {
    school: null
  },

  onLoad(options) {
    const data = getAdmissionData(options.year || defaultYear)
    const batch = options.batch || ""
    const result = recommend({
      score: options.score,
      hasQuota: batch === "quota",
      juniorSchoolId: options.juniorSchoolId || "",
      data
    })
    const schools = result.ok
      ? batch
        ? (result.ladder.find((item) => item.key === batch) || { items: [] }).items
        : result.allSchools
      : []
    const school = schools.find((item) => item.id === options.id) || (result.ok ? result.allSchools.find((item) => item.id === options.id) : null)
    this.setData({ school })
  }
})
