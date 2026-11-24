const source = require("./2026-source")

const getDistrict = (name) => {
  if (name.includes("清徐")) return "清徐县"
  if (name.includes("阳曲")) return "阳曲县"
  if (name.includes("娄烦")) return "娄烦县"
  if (name.includes("古交")) return "古交市"
  return "太原市"
}

const quotaLines = source.quotaSecondAllocationLines.map(([code, school, area, line]) => ({
  code,
  school,
  area,
  line
}))

const quotaLineBySchool = new Map()
for (const item of quotaLines) {
  const current = quotaLineBySchool.get(item.school)
  if (!current || item.area === "六城区") quotaLineBySchool.set(item.school, item)
}

const schools = source.schoolLines.map(([code, name, lastLine, type]) => {
  const quota = quotaLineBySchool.get(name)
  return {
    id: code,
    code,
    name,
    type,
    district: getDistrict(name),
    batch: type === "民办" ? "private" : "unified",
    tags: [type],
    lastLine,
    choiceLines: { first: lastLine },
    planTotal: null,
    planYear: null,
    planNote: "2026年招生计划待核对",
    quotaCode: quota?.code,
    quotaLine: quota?.line,
    quotaLineYear: quota ? 2026 : null,
    quotaLineArea: quota?.area,
    note: `2026年第一志愿录取线${lastLine.toFixed(1)}分。`
  }
})

const specialSchools = source.specialProgramLines.map((item) => ({
  id: item.code,
  code: item.code,
  name: `${item.school}${item.program}`,
  type: "公办",
  district: "太原市",
  batch: "early",
  tags: ["特色办学实验班"],
  lastLine: item.admissionLine,
  choiceLines: { first: item.admissionLine },
  planTotal: null,
  planYear: null,
  planNote: `2026年最低控制线${item.controlLine.toFixed(1)}分，达到控制线后按计划、成绩和志愿择优录取。`,
  note: `2026年实际录取线${item.admissionLine.toFixed(1)}分。`
}))

const comprehensiveSchools = source.comprehensiveHighSchoolLines.map(([code, name, lastLine]) => ({
  id: code,
  code,
  name,
  type: "公办",
  district: getDistrict(name),
  batch: "unified",
  tags: ["综合高中试点班"],
  lastLine,
  choiceLines: { first: lastLine },
  planTotal: null,
  planYear: null,
  planNote: "2026年综合高中试点班招生计划待核对",
  note: `2026年第一志愿录取线${lastLine.toFixed(1)}分。`
}))

const admissionData = {
  city: "山西省太原市",
  yearLabel: source.yearLabel,
  dataStatus: source.dataStatus,
  totalScore: source.totalScore,
  minControlLine: source.minControlLine,
  sources: source.sources,
  batches: [
    {
      key: "early",
      name: "提前类/特色类",
      description: "含体育艺术特长、小语种、特色办学实验班等项目，需满足学校项目条件。"
    },
    {
      key: "unified",
      name: "普通高中统招生",
      description: "2026年普通高中录取不分批次，从839分开始每5分为一个分数段、段段清。"
    },
    {
      key: "quota",
      name: "定向生",
      description: "2026年定向生原则上在统招线下50分以内录取，且不低于603分；当前已录入定向二次分配线。"
    },
    {
      key: "private",
      name: "民办/其他普通高中",
      description: "需关注收费、住宿、校区和招生范围；民办学校收费通常较高。"
    }
  ],
  rules: source.rules,
  supplementalAdmissionLines: [],
  specialProgramLines: source.specialProgramLines,
  specialtyStudentControlLines: source.specialtyStudentControlLines,
  comprehensiveHighSchoolLines: source.comprehensiveHighSchoolLines.map(([code, name, firstLine]) => ({ code, name, firstLine })),
  quotaSecondAllocationLines: quotaLines,
  quotaSchoolCodes: [...new Set(quotaLines.map((item) => item.code))],
  quotaAllocationYear: null,
  quotaLineYear: 2026,
  quotaAllocationReady: false,
  juniorSchools: [],
  quotaAllocations: {},
  schools: [...schools, ...specialSchools, ...comprehensiveSchools].sort((a, b) => b.lastLine - a.lastLine)
}

module.exports = admissionData
