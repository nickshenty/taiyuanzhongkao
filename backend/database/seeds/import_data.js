import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'taiyuan_zhongkao',
  multipleStatements: true
};

// 读取JSON数据文件
function loadYearData(year) {
  const dataPath = path.join(__dirname, `../../../data/years/${year}.json`);
  if (!fs.existsSync(dataPath)) {
    console.log(`⚠️  ${year}.json 不存在，跳过`);
    return null;
  }
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  return data;
}

// 导入年份数据
async function importYearData(connection, year, data) {
  console.log(`\n📅 导入 ${year} 年数据...`);

  // 1. 插入年份信息
  await connection.execute(
    'INSERT IGNORE INTO years (year, control_line, total_score, data_status) VALUES (?, ?, ?, ?)',
    [year, data.controlLine, data.totalScore, data.dataStatus || '数据完整']
  );
  console.log(`  ✅ 年份信息已插入`);

  // 2. 插入学校和分数线
  let schoolCount = 0;
  let lineCount = 0;

  for (const school of data.schools) {
    // 插入学校信息
    await connection.execute(
      'INSERT IGNORE INTO schools (code, name, type, district) VALUES (?, ?, ?, ?)',
      [school.code, school.name, school.type || '', school.district || '']
    );
    schoolCount++;

    // 插入录取分数线
    await connection.execute(
      `INSERT INTO admission_lines 
       (year, school_code, last_line, quota_line, batch, plan_count) 
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
       last_line = VALUES(last_line),
       quota_line = VALUES(quota_line),
       batch = VALUES(batch),
       plan_count = VALUES(plan_count)`,
      [
        year,
        school.code,
        school.lastLine || null,
        school.quotaLine || null,
        school.batch || null,
        school.planCount || null
      ]
    );
    lineCount++;
  }

  console.log(`  ✅ ${schoolCount} 所学校信息已插入`);
  console.log(`  ✅ ${lineCount} 条分数线记录已插入`);

  // 3. 插入初中学校（如果有）
  if (data.juniorSchools && data.juniorSchools.length > 0) {
    let juniorCount = 0;
    for (const junior of data.juniorSchools) {
      await connection.execute(
        'INSERT IGNORE INTO junior_schools (id, name, district) VALUES (?, ?, ?)',
        [junior.id, junior.name, junior.district || '']
      );
      juniorCount++;
    }
    console.log(`  ✅ ${juniorCount} 所初中学校已插入`);
  }

  // 4. 插入定向名额分配（如果有）
  if (data.quotaAllocations && data.quotaAllocations.length > 0) {
    let quotaCount = 0;
    for (const quota of data.quotaAllocations) {
      await connection.execute(
        `INSERT INTO quota_allocations 
         (year, junior_school_id, senior_school_code, quota_count) 
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quota_count = VALUES(quota_count)`,
        [year, quota.juniorSchoolId, quota.seniorSchoolCode, quota.count]
      );
      quotaCount++;
    }
    console.log(`  ✅ ${quotaCount} 条定向名额已插入`);
  }

  // 5. 插入批次配置（如果有）
  if (data.batches && data.batches.length > 0) {
    let batchCount = 0;
    for (const batch of data.batches) {
      await connection.execute(
        `INSERT INTO batches 
         (year, batch_code, batch_name, sort_order, max_schools) 
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
         batch_name = VALUES(batch_name),
         sort_order = VALUES(sort_order),
         max_schools = VALUES(max_schools)`,
        [year, batch.key, batch.title, batch.order || 0, batch.maxCount || 0]
      );
      batchCount++;
    }
    console.log(`  ✅ ${batchCount} 个批次配置已插入`);
  }
}

// 主函数
async function main() {
  console.log('='.repeat(60));
  console.log('🚀 太原中考数据导入工具');
  console.log('='.repeat(60));
  console.log('');

  let connection;

  try {
    // 连接数据库
    console.log('📡 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // 获取所有年份数据文件
    const dataDir = path.join(__dirname, '../../../data/years');
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    const years = files.map(f => parseInt(f.replace('.json', ''))).filter(y => !isNaN(y)).sort();

    console.log(`📂 发现 ${years.length} 个年份数据: ${years.join(', ')}\n`);

    // 逐年导入数据
    for (const year of years) {
      const data = loadYearData(year);
      if (data) {
        await importYearData(connection, year, data);
      }
    }

    // 统计总数
    console.log('\n' + '='.repeat(60));
    console.log('📊 数据导入统计');
    console.log('='.repeat(60));

    const [yearRows] = await connection.query('SELECT COUNT(*) as count FROM years');
    console.log(`年份数据: ${yearRows[0].count} 条`);

    const [schoolRows] = await connection.query('SELECT COUNT(*) as count FROM schools');
    console.log(`学校数据: ${schoolRows[0].count} 所`);

    const [lineRows] = await connection.query('SELECT COUNT(*) as count FROM admission_lines');
    console.log(`分数线数据: ${lineRows[0].count} 条`);

    const [juniorRows] = await connection.query('SELECT COUNT(*) as count FROM junior_schools');
    console.log(`初中学校: ${juniorRows[0].count} 所`);

    const [quotaRows] = await connection.query('SELECT COUNT(*) as count FROM quota_allocations');
    console.log(`定向名额: ${quotaRows[0].count} 条`);

    console.log('\n✅ 数据导入完成！');

  } catch (error) {
    console.error('\n❌ 导入失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 执行导入
main();
