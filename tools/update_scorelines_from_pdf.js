const fs = require("fs")
const path = require("path")

const data = require("../data/years/2025")

const root = path.resolve(__dirname, "..")
const extractedDir = path.join(root, "data", "extracted", "2025", "scorelines")
const dataFile = path.join(root, "data", "years", "2025.js")

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (ch === "\"" && next === "\"") {
        cell += "\""
        i += 1
      } else if (ch === "\"") {
        quoted = false
      } else {
        cell += ch
      }
      continue
    }
    if (ch === "\"") {
      quoted = true
    } else if (ch === ",") {
      row.push(cell)
      cell = ""
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""))
      rows.push(row)
      row = []
      cell = ""
    } else {
      cell += ch
    }
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((item) => item.some(Boolean))
}

function parseLine(value) {
  const normalized = String(value || "").trim()
  const match = normalized.match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

const publicByCode = new Map([
  ["65044", { district: "清徐县", tags: ["县市高中"] }],
  ["65037", { district: "太原市", tags: ["城区高中"] }],
  ["65043", { district: "清徐县", tags: ["县市高中"] }]
])

const publicByName = new Map([
  ["阳曲县第一中学校", { id: "no_code_yangqu_1", district: "阳曲县", tags: ["县市高中"] }],
  ["娄烦县娄烦中学", { id: "no_code_loufan", district: "娄烦县", tags: ["县市高中"] }],
  ["古交市第一中学校", { id: "no_code_gujiao_1", district: "古交市", tags: ["县市高中"] }]
])

const staleNoCodeNames = new Set([
  "航天实验班",
  "人工智能实验班",
  "外语实验班",
  "科创实验班",
  "595分",
  "510分",
  "-",
  "625",
  "628.5"
])

function inferSchool(row) {
  const [sequence, codeOrName, maybeName, maybeLine, maybeRateOrNote] = row
  const hasCode = /^\d{5}$/.test(codeOrName)
  const code = hasCode ? codeOrName : "待核对"
  const name = hasCode ? maybeName : codeOrName
  const firstLine = parseLine(hasCode ? maybeLine : maybeName)
  const scoreRate = hasCode ? maybeRateOrNote : ""
  const sourceNote = hasCode ? "" : maybeRateOrNote || ""
  if (!sequence || !name || !firstLine || sequence === "序号") return null

  const existing = data.schools.find((item) => item.code === code && code !== "待核对")
  const publicMeta = publicByCode.get(code) || publicByName.get(name)
  const isPublic = existing ? existing.type === "公办" : Boolean(publicMeta)
  return {
    sequence: Number(sequence),
    code,
    id: existing?.id || publicMeta?.id || code,
    name,
    firstLine,
    secondLine: hasCode && row.length >= 7 ? parseLine(row[4]) : null,
    thirdLine: hasCode && row.length >= 7 ? parseLine(row[5]) : null,
    scoreRate,
    sourceNote,
    lineApproximate: String(hasCode ? maybeLine : maybeName).includes("约"),
    type: existing?.type || (isPublic ? "公办" : "民办"),
    district: existing?.district || publicMeta?.district || "太原市",
    batch: existing?.batch || (isPublic ? "unified" : "private"),
    tags: existing?.tags || publicMeta?.tags || ["民办"]
  }
}

const rowsByCodeOrName = new Map()
for (const file of fs.readdirSync(extractedDir).filter((item) => item.endsWith(".csv"))) {
  const rows = parseCsv(fs.readFileSync(path.join(extractedDir, file), "utf8"))
  for (const row of rows.slice(1)) {
    const parsed = inferSchool(row)
    if (!parsed || !Number.isFinite(parsed.sequence) || parsed.sequence < 1 || parsed.sequence > 44) continue
    rowsByCodeOrName.set(parsed.code === "待核对" ? parsed.name : parsed.code, parsed)
  }
}

const scoreRows = [...rowsByCodeOrName.values()].sort((a, b) => a.sequence - b.sequence)
const existingByCode = new Map(data.schools.map((school) => [school.code, school]))
const existingNoCodeByName = new Map(data.schools.filter((school) => school.code === "待核对").map((school) => [school.name, school]))
const seen = new Set()

function formatChoiceLines(row) {
  const parts = [`第一志愿${row.firstLine.toFixed(1)}分`]
  if (Number.isFinite(row.secondLine)) parts.push(`第二志愿${row.secondLine.toFixed(1)}分`)
  if (Number.isFinite(row.thirdLine)) parts.push(`第三志愿${row.thirdLine.toFixed(1)}分`)
  return parts.join("，")
}

function mergeSchool(row) {
  const old = row.code === "待核对" ? existingNoCodeByName.get(row.name) : existingByCode.get(row.code)
  const base = old || {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    district: row.district,
    batch: row.batch,
    tags: row.tags,
    planTotal: null,
    planNote: "招生计划待继续核对"
  }
  const noteSuffix = row.lineApproximate
    ? `2025年录取分数线汇总表显示${row.name}第一志愿约${row.firstLine.toFixed(1)}分。${row.sourceNote ? row.sourceNote : ""}`
    : `2025年录取分数线汇总表显示${formatChoiceLines(row)}。`

  return {
    ...base,
    id: base.id || row.id,
    code: base.code || row.code,
    name: base.name || row.name,
    type: base.type || row.type,
    district: base.district || row.district,
    batch: base.batch || row.batch,
    tags: base.tags || row.tags,
    lastLine: row.firstLine,
    choiceLines: {
      first: row.firstLine,
      ...(Number.isFinite(row.secondLine) ? { second: row.secondLine } : {}),
      ...(Number.isFinite(row.thirdLine) ? { third: row.thirdLine } : {})
    },
    scoreRate: row.scoreRate || null,
    lineApproximate: row.lineApproximate || undefined,
    note: noteSuffix.trim()
  }
}

const updatedSchools = []
for (const row of scoreRows) {
  const key = row.code === "待核对" ? row.name : row.code
  seen.add(key)
  updatedSchools.push(mergeSchool(row))
}

for (const school of data.schools) {
  const key = school.code === "待核对" ? school.name : school.code
  if (school.code === "待核对" && staleNoCodeNames.has(school.name)) continue
  if (!seen.has(key)) updatedSchools.push(school)
}

updatedSchools.sort((a, b) => (b.lastLine || 0) - (a.lastLine || 0) || String(a.code).localeCompare(String(b.code), "zh-Hans-CN"))

function js(value, indent = 4) {
  const space = " ".repeat(indent)
  const next = " ".repeat(indent + 2)
  if (Array.isArray(value)) {
    if (!value.length) return "[]"
    return `[\n${value.map((item) => `${next}${js(item, indent + 2)}`).join(",\n")}\n${space}]`
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined)
    if (!entries.length) return "{}"
    return `{\n${entries.map(([k, v]) => `${next}${k}: ${js(v, indent + 2)}`).join(",\n")}\n${space}}`
  }
  return JSON.stringify(value)
}

const source = fs.readFileSync(dataFile, "utf8")
const start = source.indexOf("  schools: [")
const endMarker = "\n  ]\n}"
const end = source.indexOf(endMarker, start)
if (start < 0 || end < 0) throw new Error("Could not locate schools block")

const replacement = `  schools: ${js(updatedSchools, 2)}`
fs.writeFileSync(dataFile, `${source.slice(0, start)}${replacement}${source.slice(end + "\n  ]".length)}`)

console.log(`Updated ${scoreRows.length} scoreline rows; schools now ${updatedSchools.length}.`)
