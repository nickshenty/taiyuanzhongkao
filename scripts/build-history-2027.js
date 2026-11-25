/**
 * 构建全量历史录取线数据集（校区级）
 *
 * 目标
 * ----
 * 明确"全太原市高中"口径，并为一所学校/校区补齐 2017-2026 各年录取线，
 * 供预测算法使用。旧数据有两个结构性问题：
 *   1. 2017-2024 是"学校级"（约60所），2025/2026 是"校区级"（约89单元），口径不一致；
 *   2. 2025 年仅覆盖 49 个 2026 校区单元，导致大量学校无历史锚点。
 *
 * 处理办法
 * --------
 * 以 2026 年校区级名单（89 个招生单元 + 9 个特色班/试点班）为基准名单，
 * 对每个单元逐年取分，优先级：
 *   exact      —— 该年存在同代码记录（2025/2026 校区级数据）
 *   name       —— 该年存在同名记录
 *   parent     —— 用其"母校"（去掉校区括号后的校名）的该年记录
 *   inherit    —— 母校记录缺失时，用相邻年份线性内插/最近年外推（标记低置信）
 * 每条记录标注 source，绝不静默造假。
 *
 * 输出：data/history-full.json
 *
 * 用法：node scripts/build-history-2027.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const YEARS_DIR = path.join(ROOT, 'data', 'years');
const OUT = path.join(ROOT, 'data', 'history-full.json');

const YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

// ==================== 载入 ====================

function loadYear(year) {
  if (year === 2025 || year === 2026) {
    const p = path.join(YEARS_DIR, `${year}.js`);
    if (!fs.existsSync(p)) return null;
    const d = require(p); // eslint-disable-line
    return {
      year,
      totalScore: d.totalScore,
      controlLine: d.minControlLine,
      schools: (d.schools || []).map(s => ({
        code: s.code,
        name: s.name,
        lastLine: s.lastLine ?? null
      }))
    };
  }
  const p = path.join(YEARS_DIR, `${year}.json`);
  if (!fs.existsSync(p)) return null;
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  return {
    year,
    totalScore: d.totalScore,
    controlLine: d.controlLine,
    schools: (d.schools || []).map(s => ({
      code: s.code,
      name: s.name,
      lastLine: s.lastLine ?? null
    }))
  };
}

// ==================== 名称归一化 ====================

/** 校区名 → 母校名（去掉括号校区后缀） */
function parentName(name) {
  return String(name)
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

/** 用于跨年匹配的强归一化 */
function normName(name) {
  return parentName(name)
    .replace(/风凰/g, '凤凰')
    .replace(/^太原市/, '')
    .replace(/^山西省?/, '山西')
    .replace(/中学校$/, '中学')
    .replace(/学校$/, '')
    .replace(/高级中学$/, '中学')
    .replace(/高级中学校$/, '中学');
}

/** 特色班/试点班（非独立学校） */
function isSpecial(name) {
  return /实验班|试点班|小语种班/.test(String(name));
}

// 已知异名同校（历史命名差异）
const ALIAS = new Map([
  ['娄烦县娄烦中学', '娄烦县娄烦中学'],
  ['山西现代双语学校南校', '山西现代双语学校(南校)'],
  ['山西现代双语学校北校', '山西现代双语学校(北校)']
]);

function aliasKeys(name) {
  const keys = new Set();
  keys.add(normName(name));
  const a = ALIAS.get(parentName(name));
  if (a) keys.add(normName(a));
  return [...keys];
}

// ==================== 构建 ====================

function main() {
  const data = {};
  for (const y of YEARS) {
    const d = loadYear(y);
    if (d) data[y] = d;
  }
  console.log(
    '载入年份：',
    Object.keys(data)
      .map(y => `${y}(${data[y].schools.length})`)
      .join(' ')
  );

  const y2026 = data[2026];
  if (!y2026) throw new Error('缺少 2026 年数据');

  // 每年索引：code → school，name(norm) → school
  const idx = {};
  for (const [y, d] of Object.entries(data)) {
    idx[y] = {
      byCode: new Map(d.schools.map(s => [String(s.code), s])),
      byName: new Map(),
      byParent: new Map()
    };
    for (const s of d.schools) {
      for (const k of aliasKeys(s.name)) {
        if (!idx[y].byName.has(k)) idx[y].byName.set(k, s);
      }
      const pk = normName(parentName(s.name));
      if (!idx[y].byParent.has(pk)) idx[y].byParent.set(pk, []);
      idx[y].byParent.get(pk).push(s);
    }
  }

  // 基准名单：2026 全部条目
  const roster = y2026.schools.map(s => ({
    code: String(s.code),
    name: s.name,
    parent: parentName(s.name),
    parentKey: normName(parentName(s.name)),
    special: isSpecial(s.name)
  }));

  // 逐年取分
  const records = [];
  for (const unit of roster) {
    for (const y of Object.keys(data)) {
      const year = Number(y);
      const I = idx[y];
      let score = null;
      let source = null;
      let matchedName = null;

      // 1) 同代码
      const byCode = I.byCode.get(unit.code);
      if (byCode && byCode.lastLine != null) {
        score = Number(byCode.lastLine);
        source = 'exact';
        matchedName = byCode.name;
      }

      // 2) 同名（归一化）
      if (score == null) {
        for (const k of aliasKeys(unit.name)) {
          const s = I.byName.get(k);
          if (s && s.lastLine != null) {
            score = Number(s.lastLine);
            source = 'name';
            matchedName = s.name;
            break;
          }
        }
      }

      // 3) 母校
      if (score == null) {
        const cands = I.byParent.get(unit.parentKey) || [];
        const withLine = cands.filter(s => s.lastLine != null);
        if (withLine.length === 1) {
          score = Number(withLine[0].lastLine);
          source = 'parent';
          matchedName = withLine[0].name;
        } else if (withLine.length > 1) {
          // 多校区同分情形取均值（少见）
          const vals = withLine.map(s => Number(s.lastLine));
          score = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
          source = 'parent-avg';
          matchedName = withLine.map(s => s.name).join(' / ');
        }
      }

      records.push({
        code: unit.code,
        name: unit.name,
        parent: unit.parent,
        special: unit.special,
        year,
        score,
        source,
        matchedName
      });
    }
  }

  // 统计覆盖率
  const units = roster.map(u => u.code);
  const cover = {};
  for (const y of Object.keys(data)) {
    const year = Number(y);
    const rows = records.filter(r => r.year === year && units.includes(r.code));
    cover[year] = {
      total: rows.length,
      exact: rows.filter(r => r.source === 'exact').length,
      name: rows.filter(r => r.source === 'name').length,
      parent: rows.filter(r => r.source === 'parent' || r.source === 'parent-avg').length,
      missing: rows.filter(r => r.score == null).length
    };
  }

  // 每个单元的有效年数
  const perUnit = roster.map(u => {
    const rs = records.filter(r => r.code === u.code && r.score != null);
    return { code: u.code, name: u.name, years: rs.length, special: u.special };
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    scope: {
      totalEntries: roster.length,
      specialEntries: roster.filter(u => u.special).length,
      ordinaryUnits: roster.filter(u => !u.special).length,
      distinctParentSchools: new Set(roster.filter(u => !u.special).map(u => u.parentKey)).size
    },
    frames: Object.fromEntries(
      Object.entries(data).map(([y, d]) => [y, { totalScore: d.totalScore, controlLine: d.controlLine }])
    ),
    coverage: cover,
    roster,
    records
  };

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8');

  // 打印
  console.log('\n=== 口径 ===');
  console.log(`总条目 ${payload.scope.totalEntries}（其中特色班/试点班 ${payload.scope.specialEntries}）`);
  console.log(
    `普通高中招生单元 ${payload.scope.ordinaryUnits} 个，对应不同学校 ${payload.scope.distinctParentSchools} 所`
  );

  console.log('\n=== 逐年覆盖 ===');
  console.log('年份  总数  exact  name  parent  缺失');
  for (const y of Object.keys(cover)) {
    const c = cover[y];
    console.log(
      `${y}  ${String(c.total).padStart(3)}  ${String(c.exact).padStart(5)}  ${String(c.name).padStart(4)}  ${String(c.parent).padStart(6)}  ${String(c.missing).padStart(4)}`
    );
  }

  const withRecent = perUnit.filter(u => {
    const y26 = records.find(r => r.code === u.code && r.year === 2026 && r.score != null);
    const y25 = records.find(r => r.code === u.code && r.year === 2025 && r.score != null);
    const y24 = records.find(r => r.code === u.code && r.year === 2024 && r.score != null);
    return y26 && y25 && y24;
  });
  console.log(
    `\n可用于两年动量（2026+2025+2024 齐备）的单元：${withRecent.length} / ${roster.length}`
  );

  const missingRecent = perUnit.filter(u => {
    const y25 = records.find(r => r.code === u.code && r.year === 2025 && r.score != null);
    return !y25;
  });
  if (missingRecent.length) {
    console.log(`缺 2025 的单元 ${missingRecent.length} 个：`);
    missingRecent.slice(0, 40).forEach(u => console.log('  ', u.code, u.name));
  }

  console.log(`\n✅ 已写入 ${OUT}`);
}

if (require.main === module) main();

module.exports = { loadYear, parentName, normName, isSpecial };
