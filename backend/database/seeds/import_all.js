/**
 * 统一数据导入器：把 data/years/* 与 data/predictions2027.json 导入 MySQL
 *
 * 说明：
 *   - 兼容两种格式：旧式 {year,totalScore,controlLine,schools[]}.json
 *                    新式结构化 {yearLabel,totalScore,minControlLine,schools[]}.js（2025/2026）
 *   - ⚠️ 2026 年使用 data/years/2026.js（权威，已与教育局公布表核对）；
 *         不得使用 2026-merged.json（切分错位，分数不可信）。
 *
 * 用法：
 *   node backend/database/seeds/import_all.js            # 全量导入
 *   node backend/database/seeds/import_all.js --years=2024,2025,2026
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../..');
const YEARS_DIR = path.join(ROOT, 'data', 'years');

const ALL_YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

// ==================== 数据加载（与预测脚本保持一致的口径） ====================

function loadJson(year) {
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
      lastLine: s.lastLine ?? null,
      quotaLine: s.quotaLine ?? null,
      type: null,
      district: null
    })),
    juniorSchools: [],
    quotaAllocations: {}
  };
}

function loadStructured(year) {
  const p = path.join(YEARS_DIR, `${year}.js`);
  if (!fs.existsSync(p)) return null;
  delete require.cache[require.resolve(p)];
  const d = require(p);
  return {
    year,
    totalScore: d.totalScore,
    controlLine: d.minControlLine,
    schools: (d.schools || []).map(s => ({
      code: s.code,
      name: s.name,
      lastLine: s.lastLine ?? null,
      quotaLine: s.quotaLine ?? null,
      type: s.type ?? null,
      district: s.district ?? null,
      quotaCode: s.quotaCode ?? null
    })),
    juniorSchools: d.juniorSchools || [],
    quotaAllocations: d.quotaAllocations || {}
  };
}

/**
 * 加载 OCR 解析版年份数据（data/years/{year}-ocr.json）
 * 相比 2026.js 额外提供：分志愿录取线、特色班线、以及仅出现在表中的学校
 */
function loadOcr(year) {
  const p = path.join(YEARS_DIR, `${year}-ocr.json`);
  if (!fs.existsSync(p)) return null;
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  return {
    year,
    totalScore: d.totalScore,
    controlLine: d.controlLine,
    schools: (d.schools || []).map(s => ({
      code: s.code,
      name: s.name,
      lastLine: s.lastLine ?? null,
      quotaLine: s.quotaLine ?? null,
      type: null,
      district: null,
      choiceLines: s.choiceLines ?? null,
      specialLine: s.specialLine ?? null,
      lineChoice: s.lineChoice ?? null,
      quotaCode: null
    })),
    juniorSchools: [],
    quotaAllocations: {}
  };
}

function loadYear(year) {
  // OCR 解析版优先：分志愿线更完整，且包含仅出现在当年表中的学校
  const ocr = loadOcr(year);
  if (ocr) {
    // 用结构化数据补全 quotaLine（OCR 表不含定向线）
    const s = loadStructured(year);
    if (s) {
      const q = new Map(s.schools.filter(x => x.quotaLine != null).map(x => [x.code, x.quotaLine]));
      for (const school of ocr.schools) {
        if (school.quotaLine == null && q.has(school.code)) school.quotaLine = q.get(school.code);
      }
      // 保留结构化数据里的初中/定向名额
      ocr.juniorSchools = s.juniorSchools;
      ocr.quotaAllocations = s.quotaAllocations;
      // 补充 type/district
      const meta = new Map(s.schools.map(x => [x.code, x]));
      for (const school of ocr.schools) {
        const m = meta.get(school.code);
        if (m) {
          school.type = school.type ?? m.type;
          school.district = school.district ?? m.district;
          // 定向名额使用的是"定向代码"(如659xx)，必须保留才能正确映射
          school.quotaCode = school.quotaCode ?? m.quotaCode ?? null;
        }
      }
    }
    return ocr;
  }

  if (year === 2025 || year === 2026) {
    const s = loadStructured(year);
    if (s) return s;
  }
  return loadJson(year);
}

// ==================== 导入逻辑 ====================

function argYears() {
  const a = process.argv.find(x => x.startsWith('--years='));
  if (!a) return ALL_YEARS;
  return a
    .split('=')[1]
    .split(',')
    .map(x => parseInt(x.trim(), 10))
    .filter(n => Number.isFinite(n));
}

async function main() {
  const yearsWanted = argYears();
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'taiyuan_zhongkao',
    connectionLimit: 5,
    multipleStatements: true
  });

  try {
    await pool.query('SELECT 1');
    console.log('✅ 数据库连接成功');
  } catch (e) {
    console.error('❌ 数据库连接失败：', e.message);
    process.exit(1);
  }

  // 载入全部年份
  const loaded = [];
  for (const y of yearsWanted) {
    const d = loadYear(y);
    if (!d) {
      console.log(`⚠️  ${y} 年数据不存在，跳过`);
      continue;
    }
    loaded.push(d);
    console.log(`📅 ${y}：${d.schools.length} 所，总分 ${d.totalScore}，控制线 ${d.controlLine}`);
  }

  // ---- 1. years ----
  for (const d of loaded) {
    await pool.execute(
      `INSERT INTO years (year, control_line, total_score, data_status)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         control_line = VALUES(control_line),
         total_score  = VALUES(total_score),
         data_status  = VALUES(data_status)`,
      [d.year, d.controlLine, d.totalScore, `${d.schools.length}所已导入`]
    );
  }
  console.log(`\n✅ years：${loaded.length} 条`);

  // ---- 2. schools（合并所有年份，补全 type/district）----
  const schoolMap = new Map();
  const invalidCodes = [];
  for (const d of loaded) {
    for (const s of d.schools) {
      // 学校代码必须是 5 位数字；历史数据曾出现 "待核对" 之类占位值
      if (!/^\d{5}$/.test(String(s.code))) {
        invalidCodes.push({ year: d.year, code: s.code, name: s.name });
        continue;
      }
      const prev = schoolMap.get(s.code) || {};
      schoolMap.set(s.code, {
        code: s.code,
        name: s.name || prev.name,
        type: s.type || prev.type || null,
        district: s.district || prev.district || null
      });
    }
  }
  if (invalidCodes.length) {
    console.warn(`⚠️  跳过 ${invalidCodes.length} 条非法学校代码记录：`);
    for (const b of invalidCodes.slice(0, 10)) {
      console.warn(`   ${b.year} ${JSON.stringify(b.code)} ${b.name}`);
    }
    console.warn('   请在数据源中修正为正式学校代码后重新导入。');
  }

  for (const s of schoolMap.values()) {
    await pool.execute(
      `INSERT INTO schools (code, name, type, district)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name     = VALUES(name),
         type     = COALESCE(VALUES(type), type),
         district = COALESCE(VALUES(district), district)`,
      [s.code, s.name, s.type, s.district]
    );
  }
  // 重算 is_current：以本次导入的最新年份有录取数据的学校为准
  const maxYear = Math.max(...loaded.map(d => d.year));
  await pool.execute('UPDATE schools SET is_current = 0');
  await pool.execute(
    `UPDATE schools s
     SET s.is_current = 1
     WHERE EXISTS (
       SELECT 1 FROM (
         SELECT DISTINCT school_code FROM admission_lines WHERE year = ?
       ) t WHERE t.school_code = s.code
     )`,
    [maxYear]
  );
  const [[curRow]] = await pool.query('SELECT COUNT(*) AS n FROM schools WHERE is_current = 1');
  console.log(`✅ schools：${schoolMap.size} 条（当前在用 ${curRow.n} 条，基准年 ${maxYear}）`);

  // ---- 3. admission_lines ----
  let lineCount = 0;
  for (const d of loaded) {
    for (const s of d.schools) {
      if (!/^\d{5}$/.test(String(s.code))) continue; // 已在 schools 阶段报告
      if (s.lastLine == null && s.quotaLine == null) continue;
      await pool.execute(
        `INSERT INTO admission_lines
           (year, school_code, last_line, quota_line, choice_lines, special_line, line_choice)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           last_line    = VALUES(last_line),
           quota_line   = VALUES(quota_line),
           choice_lines = VALUES(choice_lines),
           special_line = VALUES(special_line),
           line_choice  = VALUES(line_choice)`,
        [
          d.year,
          s.code,
          s.lastLine,
          s.quotaLine,
          s.choiceLines ? JSON.stringify(s.choiceLines) : null,
          s.specialLine ?? null,
          s.lineChoice ?? null
        ]
      );
      lineCount++;
    }
  }
  console.log(`✅ admission_lines：${lineCount} 条`);

  // ---- 4. junior_schools + quota_allocations（2025/2026 结构化数据）----
  let juniorCount = 0;
  let quotaCount = 0;
  let skippedQuota = 0;
  for (const d of loaded) {
    const juniors = d.juniorSchools || [];
    if (!juniors.length) continue;

    for (const j of juniors) {
      await pool.execute(
        `INSERT INTO junior_schools (id, name, district)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           district = COALESCE(VALUES(district), district)`,
        [String(j.id), j.name, j.district ?? null]
      );
      juniorCount++;
    }

    // 定向名额使用的是"定向代码"（如 65928），需映射为学校代码（65028）
    const quotaCodeToSchool = new Map();
    for (const s of d.schools) {
      if (s.quotaCode) quotaCodeToSchool.set(String(s.quotaCode), String(s.code));
    }

    for (const [juniorId, alloc] of Object.entries(d.quotaAllocations || {})) {
      // alloc 形如 { "65028": 5, ... } 或 { allocations: {...} }
      const items = alloc && typeof alloc === 'object' && !Array.isArray(alloc) ? alloc : {};
      const map = items.allocations && typeof items.allocations === 'object' ? items.allocations : items;
      for (const [rawCode, count] of Object.entries(map)) {
        const n = Number(count);
        if (!Number.isFinite(n) || n <= 0) continue;
        const seniorCode = quotaCodeToSchool.get(String(rawCode)) || String(rawCode);
        if (!schoolMap.has(seniorCode)) {
          skippedQuota++;
          continue; // 目标学校不在 schools 表中，跳过以避免外键失败
        }
        await pool.execute(
          `INSERT INTO quota_allocations (year, junior_school_id, senior_school_code, quota_count)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE quota_count = VALUES(quota_count)`,
          [d.year, String(juniorId), seniorCode, n]
        );
        quotaCount++;
      }
    }
  }
  console.log(
    `✅ junior_schools：${juniorCount} 条，quota_allocations：${quotaCount} 条` +
      (skippedQuota ? `（跳过 ${skippedQuota} 条无对应学校）` : '')
  );

  // ---- 5. predictions（目标年，自动指向最新）----
  // 优先 predictions-latest.json（生成器每次都会刷新），
  // 回退到旧的 predictions2027.json 以兼容历史快照
  const predCandidates = [
    path.join(ROOT, 'data', 'predictions-latest.json'),
    path.join(ROOT, 'data', 'predictions2027.json')
  ];
  const predFile = predCandidates.find(f => fs.existsSync(f));
  if (predFile) {
    const pred = JSON.parse(fs.readFileSync(predFile, 'utf8'));

    // 目标年框架未公布时，写入一条"预测框架"年份记录，
    // 以便推荐接口能取到控制线/总分（明确标注为沿用最近年）
    if (pred.frame) {
      await pool.execute(
        `INSERT INTO years (year, control_line, total_score, data_status)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           control_line = VALUES(control_line),
           total_score  = VALUES(total_score),
           data_status  = VALUES(data_status)`,
        [
          pred.targetYear,
          pred.frame.controlLine,
          pred.frame.totalScore,
          '预测框架：总分/控制线沿用2026年，待官方公布后重算'
        ]
      );
      console.log(`✅ years(${pred.targetYear})：已写入预测框架`);
    }

    let n = 0;
    for (const s of pred.schools || []) {
      await pool.execute(
        `INSERT INTO predictions
           (year, school_code, predicted_score, strategy, confidence, algorithm_version)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           predicted_score   = VALUES(predicted_score),
           strategy          = VALUES(strategy),
           confidence        = VALUES(confidence),
           algorithm_version = VALUES(algorithm_version)`,
        [
          pred.targetYear,
          s.code,
          s.predicted2027,
          s.strategy,
          s.confidence,
          pred.algorithm || 'v1.5-generalized'
        ]
      );
      n++;
    }
    console.log(`✅ predictions(${pred.targetYear})：${n} 条`);
  } else {
    console.log('⚠️  未找到预测文件（data/predictions-latest.json），跳过预测导入');
  }

  await pool.end();
  console.log('\n🎉 导入完成');
}

if (process.argv[1] && process.argv[1].endsWith('import_all.js')) {
  main().catch(e => {
    console.error('❌ 导入失败：', e);
    process.exit(1);
  });
}

export { loadYear, ALL_YEARS };
