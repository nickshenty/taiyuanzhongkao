const dataByYear = {
  "2025": require("./years/2025"),
  "2026": require("./years/2026")
}

const availableYears = Object.keys(dataByYear).sort((a, b) => Number(b) - Number(a))
const defaultYear = availableYears[0]

function getAdmissionData(year = defaultYear) {
  const key = String(year)
  const data = dataByYear[key]
  if (!data) throw new Error(`暂不支持${key}年数据，可选年份：${availableYears.join("、")}`)
  return data
}

module.exports = {
  availableYears,
  defaultYear,
  getAdmissionData
}
