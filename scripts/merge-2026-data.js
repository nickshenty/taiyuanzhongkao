/**
 * 2026年数据整合脚本
 * 将采集到的招生计划和分数线数据合并到项目中
 */

const fs = require('fs');
const path = require('path');

// 读取采集的数据
const scoresPath = '/Users/shenzheng/Desktop/ai_study/taiyuan_2026_scores.json';
const enrollmentPath = '/Users/shenzheng/Desktop/ai_study/taiyuan_2026_enrollment.json';

const scoresData = JSON.parse(fs.readFileSync(scoresPath, 'utf-8'));
const enrollmentData = JSON.parse(fs.readFileSync(enrollmentPath, 'utf-8'));

// 创建学校代码到招生计划的映射
const enrollmentMap = new Map();
enrollmentData.forEach(school => {
  enrollmentMap.set(school['学校代码'], {
    planTotal: school.planTotal,
    planYear: school.planYear,
    tier: school.tier,
    accommodation: school['住宿情况']
  });
});

// 创建学校代码到分数线的映射
const scoresMap = new Map(Object.entries(scoresData));

// 统计信息
let stats = {
  totalSchools: 0,
  withScores: 0,
  withEnrollment: 0,
  withQuotaLine: 0,
  provincial: 0,
  municipal: 0,
  general: 0,
  private: 0
};

// 合并数据
const mergedSchools = [];

// 处理有分数线的学校
for (const [code, scoreInfo] of scoresMap.entries()) {
  const enrollment = enrollmentMap.get(code);
  
  const school = {
    code,
    name: scoreInfo.name,
    lastLine: scoreInfo.lastLine,
    choiceLines: scoreInfo.choiceLines,
    quotaLine: scoreInfo.quotaLine || null,
    quotaLineYear: scoreInfo.quotaLineYear || null,
    planTotal: enrollment?.planTotal || null,
    planYear: enrollment?.planYear || null,
    tier: enrollment?.tier || '一般高中',
    accommodation: enrollment?.accommodation || '待核对'
  };
  
  mergedSchools.push(school);
  stats.totalSchools++;
  stats.withScores++;
  if (enrollment) stats.withEnrollment++;
  if (scoreInfo.quotaLine) stats.withQuotaLine++;
  
  // 统计层次
  if (school.tier === '省级示范') stats.provincial++;
  else if (school.tier === '市级示范') stats.municipal++;
  else if (school.tier === '民办') stats.private++;
  else stats.general++;
}

// 处理只有招生计划没有分数线的学校
for (const school of enrollmentData) {
  const code = school['学校代码'];
  if (!scoresMap.has(code)) {
    mergedSchools.push({
      code,
      name: school['学校名称'],
      lastLine: null,
      choiceLines: null,
      quotaLine: null,
      quotaLineYear: null,
      planTotal: school.planTotal,
      planYear: school.planYear,
      tier: school.tier,
      accommodation: school['住宿情况']
    });
    
    stats.totalSchools++;
    stats.withEnrollment++;
    
    if (school.tier === '省级示范') stats.provincial++;
    else if (school.tier === '市级示范') stats.municipal++;
    else if (school.tier === '民办') stats.private++;
    else stats.general++;
  }
}

// 按学校代码排序
mergedSchools.sort((a, b) => a.code.localeCompare(b.code));

// 输出统计
console.log('=== 2026年数据整合统计 ===');
console.log(`总学校数: ${stats.totalSchools}`);
console.log(`有分数线: ${stats.withScores}所`);
console.log(`有招生计划: ${stats.withEnrollment}所`);
console.log(`有定向二次线: ${stats.withQuotaLine}所`);
console.log('');
console.log('按层次统计:');
console.log(`  省级示范: ${stats.provincial}所`);
console.log(`  市级示范: ${stats.municipal}所`);
console.log(`  一般高中: ${stats.general}所`);
console.log(`  民办学校: ${stats.private}所`);

// 保存合并结果
const outputPath = path.join(__dirname, '../data/years/2026-merged.json');
fs.writeFileSync(outputPath, JSON.stringify(mergedSchools, null, 2), 'utf-8');
console.log('');
console.log(`✅ 合并数据已保存至: ${outputPath}`);

// 输出前5所学校示例
console.log('');
console.log('=== 数据示例（前5所） ===');
mergedSchools.slice(0, 5).forEach(school => {
  console.log(`${school.code} ${school.name}`);
  console.log(`  层次: ${school.tier}`);
  console.log(`  统招线: ${school.lastLine || '无数据'}`);
  console.log(`  定向线: ${school.quotaLine || '无'}`);
  console.log(`  招生计划: ${school.planTotal || '无数据'}人`);
  console.log('');
});
