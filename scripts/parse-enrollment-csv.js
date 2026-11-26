/**
 * 解析招生计划 CSV（OCR 结果）为标准 JSON
 *
 * 用于官方计划页以图片发布、经 OCR 转成 CSV 的情形（如 2025/2026）。
 * 输出结构与 parse-enrollment.js 一致，供 import_all.js 统一读取。
 *
 * CSV 列名容错：学校代码 / 招生学校 / 招生计划-人数（或"招生计划(人)""计划数"等）
 *
 * 用法：
 *   node scripts/parse-enrollment-csv.js --year=2026 \
 *     --input=data/sources/enrollment/2026-plan.csv
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'enrollment');

function argOf(name, def) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

/** 解 CSV（支持引号与逗号转义） */
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
    } else if (ch !== '\r') field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** 在表头中查找列索引（容错多种写法） */
function findCol(header, patterns) {
  for (let i = 0; i < header.length; i++) {
    if (patterns.some(p => header[i].includes(p))) return i;
  }
  return -1;
}

function main() {
  const year = Number(argOf('year', ''));
  const input = argOf('input', '');
  if (!Number.isFinite(year)) throw new Error('必须指定 --year=YYYY');
  if (!input || !fs.existsSync(input)) throw new Error(`CSV 不存在：${input}`);

  const text = fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('CSV 为空');

  const header = rows[0].map(h => h.trim());
  const iCode = findCol(header, ['学校代码', '代码', '编码']);
  const iName = findCol(header, ['招生学校', '学校名称']);
  const iPlan = findCol(header, ['招生计划', '计划数', '计划']);
  const iMark = findCol(header, ['标记', '示范']);

  if (iCode < 0 || iName < 0) {
    throw new Error(`CSV 缺少必要列（学校代码 / 招生学校）。实际表头：${header.join(',')}`);
  }

  const byCode = new Map();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    const codeRaw = String(row[iCode] ?? '').trim();
    const m = codeRaw.match(/(\d{5})/);
    if (!m) continue;
    const code = m[1];
    const name = String(row[iName] ?? '').trim();
    if (!name) continue;

    let plan = null;
    if (iPlan >= 0) {
      const pm = String(row[iPlan] ?? '').match(/(\d+)/);
      if (pm) plan = Number(pm[1]);
    }
    const mark = iMark >= 0 ? String(row[iMark] ?? '').trim() : codeRaw.replace(code, '').trim();

    const prev = byCode.get(code);
    if (!prev || (prev.plan == null && plan != null)) byCode.set(code, { code, name, plan, mark });
  }

  const schools = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  const totalPlan = schools.reduce((s, x) => s + (x.plan || 0), 0);

  const payload = {
    year,
    source: path.relative(ROOT, input),
    method: 'CSV（OCR）',
    generatedAt: new Date().toISOString(),
    counts: {
      schools: schools.length,
      withPlan: schools.filter(s => s.plan != null).length,
      totalPlan
    },
    invalid: [],
    schools
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `${year}.json`);
  fs.writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8');

  console.log(
    `${year} 年招生计划（CSV）：${schools.length} 所，合计 ${totalPlan} 人（有计划 ${payload.counts.withPlan} 所）`
  );
  console.log(`✅ 已写入 ${path.relative(ROOT, out)}`);
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

module.exports = { main, parseCsv };
