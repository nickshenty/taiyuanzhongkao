/**
 * 2017-2024年历史数据完整性审核脚本
 */

const fs = require('fs');
const path = require('path');

// 加载2026年学校列表作为主列表
const data2026 = require('../data/years/2026.js');

// 提取普通高中学校
const masterSchoolList = data2026.schools
  .filter(s => s.batch === 'unified' || s.batch === 'private')
  .map(s => ({
    code: s.code,
    name: s.name,
    type: s.tags[0],
    line2026: s.lastLine
  }))
  .sort((a, b) => a.code.localeCompare(b.code));

console.log('='.repeat(100));
console.log('太原中考历史数据完整性审核报告 (2017-2024)');
console.log('='.repeat(100));
console.log(`\n📊 基准学校列表: ${masterSchoolList.length}所学校 (基于2026年)\n`);
console.log('-'.repeat(100));

// 加载历史数据
const years = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const historicalData = {};

years.forEach(year => {
  const filePath = path.join(__dirname, `../data/years/${year}.json`);
  if (fs.existsSync(filePath)) {
    historicalData[year] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
});

// 数据完整性统计
console.log('\n📋 年度数据完整性:\n');

const yearlyStats = {};
years.forEach(year => {
  const data = historicalData[year];
  if (data) {
    const count = data.schools.length;
    const coverage = (count / masterSchoolList.length * 100).toFixed(1);
    const status = count >= 40 ? '✅ 良好' : count >= 20 ? '⚠️ 部分' : count > 0 ? '⚠️ 不足' : '❌ 缺失';
    
    yearlyStats[year] = {
      count,
      coverage: parseFloat(coverage),
      totalScore: data.totalScore,
      minControlLine: data.minControlLine,
      status
    };
    
    console.log(`${year}年: ${count.toString().padStart(2)}所学校 (${coverage.padStart(5)}%)  ${status}  [${data.totalScore}分制, 最低线${data.minControlLine}]`);
  } else {
    yearlyStats[year] = { count: 0, coverage: 0, status: '❌ 缺失' };
    console.log(`${year}年:  0所学校 (  0.0%)  ❌ 缺失`);
  }
});

// 学校维度数据矩阵
console.log('\n' + '='.repeat(100));
console.log('学校维度数据完整性分析');
console.log('='.repeat(100));

const schoolMatrix = {};

masterSchoolList.forEach(school => {
  schoolMatrix[school.code] = {
    name: school.name,
    type: school.type,
    dataPoints: {},
    lines: []
  };
  
  years.forEach(year => {
    const yearData = historicalData[year];
    if (yearData) {
      const found = yearData.schools.find(s => s.code === school.code);
      if (found) {
        schoolMatrix[school.code].dataPoints[year] = found.lastLine;
        schoolMatrix[school.code].lines.push(found.lastLine);
      } else {
        schoolMatrix[school.code].dataPoints[year] = null;
      }
    } else {
      schoolMatrix[school.code].dataPoints[year] = null;
    }
  });
  
  // 计算完整度
  const validYears = years.filter(y => schoolMatrix[school.code].dataPoints[y] !== null);
  schoolMatrix[school.code].completeness = validYears.length;
  schoolMatrix[school.code].completenessPct = (validYears.length / years.length * 100).toFixed(0);
  
  // 计算波动率（仅对有3年以上数据的学校）
  if (schoolMatrix[school.code].lines.length >= 3) {
    const lines = schoolMatrix[school.code].lines;
    const mean = lines.reduce((a, b) => a + b, 0) / lines.length;
    const variance = lines.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / lines.length;
    schoolMatrix[school.code].stdDev = Math.sqrt(variance);
    schoolMatrix[school.code].range = Math.max(...lines) - Math.min(...lines);
  }
});

// 按完整度排序
const sortedSchools = Object.entries(schoolMatrix)
  .sort((a, b) => b[1].completeness - a[1].completeness);

console.log('\n📊 完整度排名 (Top 40):');
console.log('排名  代码   学校名称                               类型     2017  2018  2019  2020  2021  2022  2023  2024  完整度');
console.log('-'.repeat(130));

sortedSchools.slice(0, 40).forEach(([code, data], index) => {
  const rank = (index + 1).toString().padStart(3);
  const nameDisplay = data.name.substring(0, 32).padEnd(35);
  const typeDisplay = data.type.padEnd(6);
  const lines = years.map(y => {
    const val = data.dataPoints[y];
    return val ? val.toString().padStart(5) : '  -  ';
  }).join(' ');
  const completeness = `${data.completeness}/8`;
  
  console.log(`${rank}  ${code}  ${nameDisplay} ${typeDisplay} ${lines}  ${completeness}`);
});

// 识别新成立学校
console.log('\n' + '='.repeat(100));
console.log('🆕 新成立学校识别 (数据点≤2个)');
console.log('='.repeat(100));

const newSchools = sortedSchools.filter(([code, data]) => data.completeness <= 2 && data.completeness > 0);

console.log(`\n共识别 ${newSchools.length} 所可能的新成立学校:\n`);

newSchools.forEach(([code, data]) => {
  const firstYear = years.find(y => data.dataPoints[y] !== null);
  const yearsList = years.filter(y => data.dataPoints[y] !== null).join(', ');
  console.log(`${code}  ${data.name.padEnd(40)}  首次: ${firstYear || '未知'}  (出现年份: ${yearsList})`);
});

// 完全缺失的学校
const missingSchools = sortedSchools.filter(([code, data]) => data.completeness === 0);
console.log(`\n\n⚠️ 完全无历史数据的学校: ${missingSchools.length}所\n`);
missingSchools.slice(0, 20).forEach(([code, data]) => {
  console.log(`${code}  ${data.name}`);
});

// 稳定性分析（核心学校）
console.log('\n' + '='.repeat(100));
console.log('📈 核心学校稳定性分析 (数据点≥5个)');
console.log('='.repeat(100));

const stableSchools = sortedSchools
  .filter(([code, data]) => data.completeness >= 5 && data.stdDev !== undefined)
  .sort((a, b) => a[1].stdDev - b[1].stdDev)
  .slice(0, 30);

console.log('\n学校                                   数据点  平均分  标准差  极差   稳定性评级');
console.log('-'.repeat(100));

stableSchools.forEach(([code, data]) => {
  const nameDisplay = data.name.substring(0, 35).padEnd(37);
  const count = data.completeness.toString().padStart(4);
  const mean = (data.lines.reduce((a, b) => a + b, 0) / data.lines.length).toFixed(1).padStart(6);
  const stdDev = data.stdDev.toFixed(1).padStart(6);
  const range = data.range.toString().padStart(4);
  
  let rating = '';
  if (data.stdDev < 3) rating = '★★★★★ 极稳';
  else if (data.stdDev < 5) rating = '★★★★  稳定';
  else if (data.stdDev < 10) rating = '★★★   一般';
  else if (data.stdDev < 20) rating = '★★    波动';
  else rating = '★     高波';
  
  console.log(`${nameDisplay}  ${count}   ${mean}  ${stdDev}  ${range}   ${rating}`);
});

// 生成审核报告JSON
const report = {
  auditDate: new Date().toISOString(),
  masterListCount: masterSchoolList.length,
  yearRange: '2017-2024',
  yearlyStats,
  schoolMatrix,
  dataQuality: {
    totalSchools: masterSchoolList.length,
    schoolsWithFullData: sortedSchools.filter(([c, d]) => d.completeness === 8).length,
    schoolsWithPartialData: sortedSchools.filter(([c, d]) => d.completeness > 0 && d.completeness < 8).length,
    schoolsWithNoData: missingSchools.length,
    avgCompleteness: (sortedSchools.reduce((sum, [c, d]) => sum + d.completeness, 0) / sortedSchools.length).toFixed(2)
  },
  stableSchools: stableSchools.map(([code, data]) => ({
    code,
    name: data.name,
    stdDev: data.stdDev,
    range: data.range,
    completeness: data.completeness
  })),
  recommendations: [
    '旧体系数据(2017-2024)已基本完整，可用于训练',
    '对于数据点<3的学校，预测时标记为null或降低置信度',
    '超稳定学校(标准差<3分)共' + stableSchools.filter(([c,d]) => d.stdDev < 3).length + '所，可作为参照锚点',
    '需补充2017-2019年更多学校数据以提升整体完整度'
  ]
};

const reportPath = path.join(__dirname, '../data/analysis/data-audit-report.json');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log('\n' + '='.repeat(100));
console.log(`\n✅ 审核报告已保存: ${reportPath}`);
console.log('\n📊 总体数据质量:');
console.log(`   - 完整数据(8年): ${report.dataQuality.schoolsWithFullData}所 (${(report.dataQuality.schoolsWithFullData/masterSchoolList.length*100).toFixed(1)}%)`);
console.log(`   - 部分数据(1-7年): ${report.dataQuality.schoolsWithPartialData}所`);
console.log(`   - 无数据: ${report.dataQuality.schoolsWithNoData}所`);
console.log(`   - 平均完整度: ${report.dataQuality.avgCompleteness}/8年`);
console.log('\n' + '='.repeat(100));
