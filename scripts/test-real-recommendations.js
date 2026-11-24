/**
 * v1.5算法实际推荐场景测试
 * 对比v1.0和v1.5在真实数据上的推荐结果
 */

const { recommend } = require('../utils/recommend-v15-integrated');
const fs = require('fs');

// 读取2026年合并数据
const mergedData = JSON.parse(fs.readFileSync('./data/years/2026-merged.json', 'utf-8'));

// 构建测试用的data对象
const testData = {
  yearLabel: 2026,
  totalScore: 839,
  minControlLine: 603,
  schools: mergedData.map(school => ({
    id: school.code,
    code: school.code,
    name: school.name,
    type: school.tier === '民办' ? '民办' : '公办',
    tier: school.tier,
    batch: school.tier === '民办' ? 'private' : 'unified',
    lastLine: school.lastLine,
    choiceLines: school.choiceLines,
    quotaLine: school.quotaLine,
    quotaLineYear: school.quotaLineYear,
    quotaCode: school.code,
    planTotal: school.planTotal,
    planYear: school.planYear,
    tags: [school.tier]
  })).filter(s => s.lastLine !== null), // 只保留有分数线的学校
  juniorSchools: [],
  quotaAllocations: {},
  quotaAllocationReady: false
};

console.log('=== v1.5算法实际推荐测试 ===\n');
console.log(`数据: 2026年 ${testData.schools.length}所学校\n`);

// 测试场景
const testCases = [
  {
    name: '高分考生(800分) - 冲刺顶尖学校',
    score: 800,
    description: '应该推荐山大附中(802)、五中青年路(795)等'
  },
  {
    name: '中上分考生(770分) - 省示范主力',
    score: 770,
    description: '应该稳定推荐成成中学、十二中等省示范'
  },
  {
    name: '中等考生(700分) - 市示范+一般高中',
    score: 700,
    description: '应该推荐小店一中、草坪一中等'
  },
  {
    name: '中下考生(650分) - 一般高中',
    score: 650,
    description: '应该推荐可靠的一般高中'
  },
  {
    name: '接近控制线(615分)',
    score: 615,
    description: '应该有较多保底选择'
  }
];

testCases.forEach((testCase, index) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试${index + 1}: ${testCase.name}`);
  console.log(`说明: ${testCase.description}`);
  console.log('='.repeat(60));
  
  // v1.0推荐
  const resultV10 = recommend({
    score: testCase.score,
    hasQuota: false,
    juniorSchoolId: null,
    data: testData,
    options: { algorithm: 'v1.0' }
  });
  
  // v1.5推荐
  const resultV15 = recommend({
    score: testCase.score,
    hasQuota: false,
    juniorSchoolId: null,
    data: testData,
    options: { algorithm: 'v1.5' }
  });
  
  console.log(`\n📊 v1.0 固定阈值推荐 (统招):`);
  if (resultV10.unified && resultV10.unified.length > 0) {
    resultV10.unified.slice(0, 6).forEach((school, i) => {
      console.log(`  ${i + 1}. [${school.riskLabel}] ${school.name} (${school.lastLine}分, 分差${school.gapDisplay})`);
    });
  } else {
    console.log('  无推荐');
  }
  
  console.log(`\n📍 v1.5 动态阈值推荐 (统招):`);
  if (resultV15.unified && resultV15.unified.length > 0) {
    resultV15.unified.slice(0, 6).forEach((school, i) => {
      const dynamicInfo = school._dynamicThresholds 
        ? ` [系数${school._dynamicThresholds.multiplier.toFixed(2)}x]` 
        : '';
      console.log(`  ${i + 1}. [${school.riskLabel}] ${school.name} (${school.lastLine}分, 分差${school.gapDisplay})${dynamicInfo}`);
    });
  } else {
    console.log('  无推荐');
  }
  
  // 统计差异
  const v10Schools = new Set(resultV10.unified?.map(s => s.code) || []);
  const v15Schools = new Set(resultV15.unified?.map(s => s.code) || []);
  
  const onlyInV10 = [...v10Schools].filter(code => !v15Schools.has(code));
  const onlyInV15 = [...v15Schools].filter(code => !v10Schools.has(code));
  
  if (onlyInV10.length > 0 || onlyInV15.length > 0) {
    console.log(`\n🔄 差异分析:`);
    if (onlyInV10.length > 0) {
      const schools = onlyInV10.map(code => resultV10.unified.find(s => s.code === code).name);
      console.log(`  仅v1.0推荐: ${schools.join(', ')}`);
    }
    if (onlyInV15.length > 0) {
      const schools = onlyInV15.map(code => resultV15.unified.find(s => s.code === code).name);
      console.log(`  仅v1.5推荐: ${schools.join(', ')}`);
    }
  } else {
    console.log(`\n✅ 两版本推荐结果一致`);
  }
});

console.log('\n' + '='.repeat(60));
console.log('✅ 测试完成！');
console.log('='.repeat(60));
