/**
 * 对"招生计划"长图做分块 OCR 并还原成结构化表格
 *
 * 背景：教育局 2025/2026 年的招生计划以整页长图发布（如 1236×8942），
 * 直接用 Vision 整体 OCR 会因缩放导致中文识别严重失真；
 * 按 1200px 高度分块后，每块内文字相对更大，识别准确率显著提升。
 *
 * 依赖：macOS（sips + swift scripts/ocr-image.swift）
 *
 * 用法：
 *   node scripts/ocr-plan-image.js --year=2026 \
 *     --input=data/sources/enrollment/2026-plan.png
 *
 * 输出：data/enrollment/{year}.json（与 parse-enrollment.js 同结构）
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'enrollment');
const SWIFT = path.join(ROOT, 'scripts', 'ocr-image.swift');

const BAND_H = 1200; // 每块高度
const OVERLAP = 120; // 相邻块重叠，避免切断表格行

function argOf(name, def) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

function imageSize(file) {
  const out = execFileSync('sips', ['-g', 'pixelHeight', '-g', 'pixelWidth', file], {
    encoding: 'utf8'
  });
  const h = Number((out.match(/pixelHeight:\s*(\d+)/) || [])[1]);
  const w = Number((out.match(/pixelWidth:\s*(\d+)/) || [])[1]);
  return { w, h };
}

function cropBand(src, dst, offset, height, width) {
  // 用法：sips -c <高> <宽> --cropOffset <top> <left>
  execFileSync(
    'sips',
    ['-c', String(height), String(width), '--cropOffset', String(offset), '0', src, '--out', dst],
    { stdio: 'ignore' }
  );
}

function ocrBand(file) {
  const out = execFileSync('swift', [SWIFT, file], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return out
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [y, x, ...rest] = line.split('\t');
      return { y: Number(y), x: Number(x), text: rest.join('\t') };
    })
    .filter(r => Number.isFinite(r.y) && Number.isFinite(r.x));
}

/** 把同一水平高度（y 接近）的文字合并成一行 */
function groupRows(items, tol = 0.006) {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const rows = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - it.y) <= tol) {
      last.cells.push(it);
    } else {
      rows.push({ y: it.y, cells: [it] });
    }
  }
  for (const r of rows) r.cells.sort((a, b) => a.x - b.x);
  return rows;
}

/**
 * 版式列位（归一化 x 坐标，依据实际页面测量）：
 *   0.00–0.07 学校编码（可能带 ★/☆/◆）
 *   0.07–0.29 学校名称
 *   0.29–0.33 招生计划（人）
 *   0.33–0.61 学校地址
 *   0.61–0.67 学费标准
 *   0.67–0.74 住宿情况
 *   0.74–     招生电话 / 备注
 * 用列位而非"第一个中文单元格"可以避免名称缺失时把地址误当校名。
 */
function extractRow(cells) {
  let code = null;
  let mark = '';
  let name = null;
  let plan = null;

  for (const c of cells) {
    const t = c.text.trim();
    if (c.x < 0.08) {
      const cm = t.match(/^[★☆◆\s]*(\d{5})/);
      if (cm && !code) {
        code = cm[1];
        mark = t.replace(cm[1], '').replace(/[^★☆◆]/g, '');
      }
    } else if (c.x >= 0.08 && c.x < 0.29) {
      // 校名：含中文、长度合理，排除纯数字与标记
      if (!name && /[\u4e00-\u9fa5]/.test(t) && t.length >= 3) name = t;
    } else if (c.x >= 0.29 && c.x < 0.335) {
      if (plan == null && /^\d{2,4}$/.test(t)) plan = Number(t);
    }
  }

  // 兜底：编码缺失时从任意含 5 位数字的单元格补救
  if (!code) {
    for (const c of cells) {
      const cm = c.text.match(/(\d{5})/);
      if (cm && c.x < 0.10) {
        code = cm[1];
        break;
      }
    }
  }
  if (!code) return null;

  // 兜底：校名缺失时，取 0.08–0.40 内最长的中文串
  if (!name) {
    const cand = cells
      .filter(c => c.x >= 0.08 && c.x < 0.40 && /[\u4e00-\u9fa5]/.test(c.text))
      .sort((a, b) => b.text.length - a.text.length)[0];
    if (cand) name = cand.text.trim();
  }

  return { code, name: name || '', plan, mark };
}

/** 中文校名归一化，用于与官方名单比对（容忍 OCR 常见错字） */
function normName(s) {
  return String(s || '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\s+/g, '')
    .replace(/[0-9０-９]/g, '')
    .replace(/中学|学校|高级|校$/g, '')
    .replace(/^太原市/, '')
    .replace(/^山西省?/, '');
}

/** 编辑距离 */
function lev(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function main() {
  const year = Number(argOf('year', ''));
  const input = argOf('input', '');
  const sourceUrl = argOf('url', '');
  if (!Number.isFinite(year)) throw new Error('必须指定 --year=YYYY');
  if (!input || !fs.existsSync(input)) throw new Error(`图片不存在：${input}`);

  const { w, h } = imageSize(input);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'planocr-'));

  const results = new Map();
  let bandNo = 0;

  for (let top = 0; top < h; top += BAND_H - OVERLAP) {
    const height = Math.min(BAND_H, h - top);
    if (height < 60) break;
    bandNo++;

    const bandFile = path.join(tmp, `band-${bandNo}.png`);
    cropBand(input, bandFile, top, height, w);

    const items = ocrBand(bandFile);
    const rows = groupRows(items);
    for (const r of rows) {
      const rec = extractRow(r.cells);
      if (rec && rec.name) {
        // 同一学校可能因重叠出现在两块中，保留有计划的那条
        const prev = results.get(rec.code);
        if (!prev || (prev.plan == null && rec.plan != null)) results.set(rec.code, rec);
      }
    }
    process.stderr.write(`  分块 ${bandNo}：top=${top} 高=${height} 识别 ${rows.length} 行\n`);
  }

  // ---- 与官方分数线名单比对，修正 OCR 误识的学校编码 ----
  const rosterFile = ['2026-ocr.json', `${year}-ocr.json`]
    .map(f => path.join(ROOT, 'data', 'years', f))
    .find(f => fs.existsSync(f));
  let corrected = 0;
  let unmatched = [];
  if (rosterFile) {
    const roster = JSON.parse(fs.readFileSync(rosterFile, 'utf8')).schools || [];
    const byNorm = new Map(roster.map(r => [normName(r.name), r]));

    const fixed = new Map();
    for (const rec of results.values()) {
      const key = normName(rec.name);
      let hit = byNorm.get(key);

      if (!hit && key.length >= 3) {
        // 允许少量错字：找编辑距离最小的
        let best = null;
        let bestD = Infinity;
        for (const [k, r] of byNorm) {
          const d = lev(key, k);
          if (d < bestD) {
            bestD = d;
            best = r;
          }
        }
        const tol = Math.max(1, Math.floor(key.length * 0.34));
        if (best && bestD <= tol) hit = best;
      }

      if (hit) {
        if (hit.code !== rec.code) corrected++;
        rec.code = String(hit.code);
        rec.name = hit.name; // 用官方校名覆盖 OCR 文本
      } else {
        unmatched.push(rec);
        continue;
      }
      const prev = fixed.get(rec.code);
      if (!prev || (prev.plan == null && rec.plan != null)) fixed.set(rec.code, rec);
    }
    results.clear();
    for (const [k, v] of fixed) results.set(k, v);
  }

  if (corrected) console.log(`🔧 依据官方名单修正学校编码 ${corrected} 处`);
  if (unmatched.length) {
    console.log(`⚠️  ${unmatched.length} 条无法匹配官方名单（已丢弃）：`);
    unmatched.slice(0, 5).forEach(u => console.log(`    ${u.code} ${u.name}`));
  }

  const schools = [...results.values()].sort((a, b) => a.code.localeCompare(b.code));
  const totalPlan = schools.reduce((s, x) => s + (x.plan || 0), 0);

  const payload = {
    year,
    source: sourceUrl || path.basename(input),
    method: 'macOS Vision OCR（分块）',
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

  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(
    `${year} 年招生计划（OCR）：${schools.length} 所，合计 ${totalPlan} 人（有计划 ${payload.counts.withPlan} 所）`
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

module.exports = { main, extractRow, groupRows, normName, lev };
