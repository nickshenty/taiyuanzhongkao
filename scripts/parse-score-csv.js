/**
 * 解析录取分数线 OCR 表（官方公布表图片 → CSV）
 *
 * 来源：太原市教育局公布表经 OCR 识别为 CSV
 * 对 2026 年的校验：与原 data/years/2026.js 的 98 条逐项比对，分数 0 差异；
 *   本表额外提供 75028 山西大学附属中学晋中学校（仅第二志愿起可填）
 *   以及第一~第五志愿的完整分档线。
 *
 * 输出：data/years/{year}-ocr.json
 *   { year, totalScore, controlLine, source, schools: [
 *       { code, name, lastLine, lineChoice, choiceLines:{first..fifth},
 *         specialLine, quotaLine, quotaLineYear }
 *   ]}
 *
 * lastLine 语义 = 该校统招录取线（优先第一志愿；若仅后续志愿有值则取该值，
 *                 并用 lineChoice 标注来源，避免误读）。
 *
 * 用法：
 *   node scripts/parse-score-csv.js                     # 默认 2026
 *   node scripts/parse-score-csv.js --year=2025
 *   node scripts/parse-score-csv.js --year=2025 --input=/path/to/2025.csv
 *   node scripts/parse-score-csv.js --year=2025 --total=850 --control=615
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function argOf(name, def) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

const YEAR = Number(argOf('year', 2026));
if (!Number.isFinite(YEAR) || YEAR < 2000 || YEAR > 2100) {
  throw new Error(`无效的 --year=${argOf('year')}`);
}

const DEFAULT_CSV = path.join(ROOT, 'data', 'sources', `${YEAR}-录取分数线.csv`);
const CSV = argOf('input', DEFAULT_CSV);
const OUT = path.join(ROOT, 'data', 'years', `${YEAR}-ocr.json`);
const YEAR_JS = path.join(ROOT, 'data', 'years', `${YEAR}.js`);

// ==================== CSV 解析（支持引号与逗号转义） ====================

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function num(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ==================== 主流程 ====================

function main() {
  if (!fs.existsSync(CSV)) throw new Error(`缺少源文件：${CSV}`);

  const text = fs.readFileSync(CSV, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(text);
  const header = rows[0].map(h => h.trim());

  const col = name => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`CSV 缺少列「${name}」，实际列：${header.join(',')}`);
    return i;
  };

  const iCode = col('学校代码');
  const iName = col('招生学校');
  const iSpecial = col('特色办学实验班-总分');
  const iFirst = col('第一志愿-总分');
  const choiceCols = [
    ['first', col('第一志愿-总分')],
    ['second', col('第二志愿-总分')],
    ['third', col('第三志愿-总分')],
    ['fourth', col('第四志愿-总分')],
    ['fifth', col('第五志愿-总分')]
  ];

  // 定向线来自 2026.js（OCR 表不含定向线）
  let quotaByCode = new Map();
  // 默认框架按年份内置，可用 --total / --control 覆盖
  const knownFrames = { 2025: { totalScore: 850, controlLine: 615 }, 2026: { totalScore: 839, controlLine: 603 } };
  let frame = knownFrames[YEAR] ?? { totalScore: null, controlLine: null };
  const argTotal = Number(argOf('total', NaN));
  const argControl = Number(argOf('control', NaN));
  if (Number.isFinite(argTotal)) frame.totalScore = argTotal;
  if (Number.isFinite(argControl)) frame.controlLine = argControl;
  if (fs.existsSync(YEAR_JS)) {
    const d = require(YEAR_JS); // eslint-disable-line
    frame = { totalScore: d.totalScore, controlLine: d.minControlLine };
    quotaByCode = new Map(
      (d.schools || [])
        .filter(s => s.quotaLine != null)
        .map(s => [String(s.code), { quotaLine: Number(s.quotaLine), year: s.quotaLineYear ?? null }])
    );
  }

  const schools = [];
  const warnings = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;

    const code = String(row[iCode] ?? '').trim();
    if (!/^\d{5}$/.test(code)) continue; // 跳过空行/合计行

    const name = String(row[iName] ?? '').trim();
    const specialLine = num(row[iSpecial]);

    const choiceLines = {};
    for (const [k, idx] of choiceCols) {
      const v = num(row[idx]);
      if (v != null) choiceLines[k] = v;
    }

    // lastLine：优先第一志愿，否则取最早有值的志愿
    let lastLine = null;
    let lineChoice = null;
    if (choiceLines.first != null) {
      lastLine = choiceLines.first;
      lineChoice = 'first';
    } else {
      for (const k of ['second', 'third', 'fourth', 'fifth']) {
        if (choiceLines[k] != null) {
          lastLine = choiceLines[k];
          lineChoice = k;
          break;
        }
      }
    }

    // 特色办学实验班条目：统招各志愿为空，其录取线即特色班线
    if (lastLine == null && specialLine != null) {
      lastLine = specialLine;
      lineChoice = 'special';
    }

    if (lastLine == null && specialLine == null) {
      warnings.push(`${code} ${name}：无任何分数`);
    }
    if (lineChoice && lineChoice !== 'first') {
      warnings.push(`${code} ${name}：无第一志愿线，取${lineChoice}志愿线 ${lastLine} 作为统招线`);
    }

    const q = quotaByCode.get(code);

    schools.push({
      code,
      name,
      lastLine,
      lineChoice,
      choiceLines,
      specialLine,
      quotaLine: q?.quotaLine ?? null,
      quotaLineYear: q?.year ?? null
    });
  }

  // 与 2026.js 交叉校验
  let crossCheck = null;
  if (fs.existsSync(YEAR_JS)) {
    const d = require(YEAR_JS);
    const oldMap = new Map(d.schools.map(s => [String(s.code), s.lastLine]));
    let same = 0;
    const mismatch = [];
    const onlyOcr = [];
    for (const s of schools) {
      if (!oldMap.has(s.code)) {
        onlyOcr.push(s.code);
        continue;
      }
      const ov = oldMap.get(s.code);
      if (ov == null || s.lastLine == null) {
        if (ov !== s.lastLine) mismatch.push({ code: s.code, ocr: s.lastLine, old: ov });
        continue;
      }
      if (Math.abs(Number(ov) - Number(s.lastLine)) <= 0.05) same++;
      else mismatch.push({ code: s.code, name: s.name, ocr: s.lastLine, old: Number(ov) });
    }
    const onlyOld = [...oldMap.keys()].filter(c => !schools.some(s => s.code === c));
    crossCheck = {
      compared: same + mismatch.length,
      identical: same,
      mismatch,
      onlyInCsv: onlyOcr,
      onlyInOld: onlyOld
    };
  }

  const payload = {
    year: YEAR,
    totalScore: frame.totalScore,
    controlLine: frame.controlLine,
    source: `${path.relative(ROOT, CSV)}（教育局公布表 OCR）`,
    generatedAt: new Date().toISOString(),
    counts: {
      total: schools.length,
      withFirstChoice: schools.filter(s => s.lastLine != null && s.lineChoice === 'first').length,
      withNonFirstChoice: schools.filter(s => s.lineChoice && s.lineChoice !== 'first').length,
      withChoiceLines: schools.filter(s => Object.keys(s.choiceLines).length > 1).length,
      withSpecialLine: schools.filter(s => s.specialLine != null).length
    },
    crossCheck,
    warnings,
    schools
  };

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`解析完成：${schools.length} 条`);
  console.log(
    `  第一志愿线 ${payload.counts.withFirstChoice} 条，` +
      `非第一志愿 ${payload.counts.withNonFirstChoice} 条，` +
      `含多志愿分档 ${payload.counts.withChoiceLines} 条，` +
      `特色实验班 ${payload.counts.withSpecialLine} 条`
  );

  if (crossCheck) {
    console.log(
      `\n与 ${YEAR}.js 交叉校验：比对 ${crossCheck.compared} 条，一致 ${crossCheck.identical} 条，不一致 ${crossCheck.mismatch.length} 条`
    );
    crossCheck.mismatch.slice(0, 10).forEach(m =>
      console.log(`  ⚠️ ${m.code} ${m.name ?? ''}: CSV=${m.ocr} vs ${YEAR}.js=${m.old}`)
    );
    if (crossCheck.onlyInCsv.length) console.log(`  仅 CSV 有：${crossCheck.onlyInCsv.join(', ')}`);
    if (crossCheck.onlyInOld.length) console.log(`  仅 ${YEAR}.js 有：${crossCheck.onlyInOld.join(', ')}`);
  }

  if (warnings.length) {
    console.log('\n提示：');
    warnings.forEach(w => console.log('  -', w));
  }

  console.log(`\n✅ 已写入 ${OUT}`);
  return payload;
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

module.exports = { parseCsv, main };
