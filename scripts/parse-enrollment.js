/**
 * 解析官方"普通高中学校招生计划"页面（HTML）为结构化 JSON
 *
 * 数据来源：太原市教育局 中考招生 > 中考资讯
 *   例：2019年 https://jyj.taiyuan.gov.cn/zkzx/20190621/1042522.html
 *
 * 页面特征：正文由多个 <table> 组成（公办/民办分节），列结构一致：
 *   学校编码 | 学校名称 | 招生计划（人） | 学校地址 | 学费标准 | 住宿情况 | 招生电话
 * 编码前可能带 ★（省级示范）/☆（市级示范）/◆ 等标记，需剥离。
 * 表内还可能混入"备注：民办学校…"整行，需跳过。
 *
 * 依赖：需先下载 HTML（脚本不联网，便于复现与审计）
 *   curl -sL "URL" -o /tmp/plan2019.html
 *   node scripts/parse-enrollment.js --year=2019 --input=/tmp/plan2019.html
 *
 * 输出：data/enrollment/{year}.json
 *   { year, source, counts, schools: [{ code, name, plan, mark }] }
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'enrollment');

function argOf(name, def) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

// ==================== 极简 HTML 表格提取 ====================
// 不引入依赖：按 <table>…</table> 切块，再按 <tr> / <td|th> 提取文本。

function stripTags(s) {
  return String(s)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTables(html) {
  const tables = [];
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  let tm;
  while ((tm = tableRe.exec(html)) !== null) {
    const tableHtml = tm[0];
    const rows = [];
    const rowRe = /<tr[\s\S]*?<\/tr>/gi;
    let rm;
    while ((rm = rowRe.exec(tableHtml)) !== null) {
      const rowHtml = rm[0];
      const cells = [];
      const cellRe = /<t[dh][\s\S]*?<\/t[dh]>/gi;
      let cm;
      while ((cm = cellRe.exec(rowHtml)) !== null) {
        cells.push(stripTags(cm[0]));
      }
      if (cells.length) rows.push(cells);
    }
    tables.push(rows);
  }
  return tables;
}

// ==================== 主流程 ====================

function main() {
  const year = Number(argOf('year', ''));
  const input = argOf('input', '');
  const sourceUrl = argOf('url', '');

  if (!Number.isFinite(year) || year < 2000) throw new Error('必须指定 --year=YYYY');
  if (!input || !fs.existsSync(input)) throw new Error(`HTML 文件不存在：${input}`);

  const html = fs.readFileSync(input, 'utf8');
  const tables = extractTables(html);

  const byCode = new Map();
  const invalid = [];

  for (const rows of tables) {
    for (const cells of rows) {
      if (!cells.length) continue;
      const codeCell = cells[0] || '';

      // 跳过表头与备注行
      if (/学校\s*编码/.test(codeCell)) continue;
      if (/^备注/.test(codeCell)) continue;

      const m = codeCell.match(/(\d{5})/);
      if (!m) continue;

      const code = m[1];
      const mark = codeCell.replace(code, '').trim(); // ★ / ☆ / ◆
      const name = cells[1] || '';

      // 招生计划列：取第一段数字
      let plan = null;
      const planCell = cells[2] || '';
      const pm = planCell.match(/(\d+)/);
      if (pm) plan = Number(pm[1]);

      if (!name) {
        invalid.push({ code, reason: '无学校名称' });
        continue;
      }

      // 同代码出现多次时保留有计划的那条
      const prev = byCode.get(code);
      if (!prev || (prev.plan == null && plan != null)) {
        byCode.set(code, { code, name, plan, mark });
      }
    }
  }

  const schools = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  const totalPlan = schools.reduce((s, x) => s + (x.plan || 0), 0);

  const payload = {
    year,
    source: sourceUrl || path.basename(input),
    generatedAt: new Date().toISOString(),
    counts: {
      schools: schools.length,
      withPlan: schools.filter(s => s.plan != null).length,
      totalPlan
    },
    invalid,
    schools
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `${year}.json`);
  fs.writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8');

  console.log(
    `${year} 年招生计划：${schools.length} 所，合计 ${totalPlan} 人（有计划 ${payload.counts.withPlan} 所）`
  );
  if (invalid.length) console.log(`  跳过异常行 ${invalid.length} 条`);
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

module.exports = { main, extractTables, stripTags };
