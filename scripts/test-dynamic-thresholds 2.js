/**
 * v1.5动态阈值算法测试脚本
 * 验证不同场景下的阈值调整效果
 */

const { calculateDynamicThresholds } = require('../utils/recommend-v15');

console.log('=== v1.5 动态阈值算法测试 ===\n');

// 测试场景
const scenarios = [
  {
    name: '高分考生(800分) - 省级示范',
    context: { score: 800, totalScore: 839, schoolTier: '省级示范' }
  },
  {
    name: '高分考生(800分) - 一般高中',
    context: { score: 800, totalScore: 839, schoolTier: '一般高中' }
  },
  {
    name: '中分考生(700分) - 省级示范',
    context: { score: 700, totalScore: 839, schoolTier: '省级示范' }
  },
  {
    name: '中分考生(700分) - 民办学校',
    context: { score: 700, totalScore: 839, schoolTier: '民办' }
  },
  {
    name: '低分考生(620分) - 一般高中',
    context: { score: 620, totalScore: 839, schoolTier: '一般高中' }
  },
  {
    name: '扩招学校(700分) - 省级示范 +20%扩招',
    context: { score: 700, totalScore: 839, schoolTier: '省级示范', planChangeRate: 0.2 }
  },
  {
    name: '高波动学校(700分) - 民办 波动10分',
    context: { score: 700, totalScore: 839, schoolTier: '民办', volatility: 10 }
  }
];

// v1.0基准阈值
console.log('📊 v1.0 基准阈值（固定）:');
console.log('  冲: [-8, +8]');
console.log('  稳: [+8, +28]');
console.log('  保: [+28, +100]');
console.log('');

// 测试每个场景
scenarios.forEach((scenario, index) => {
  console.log(`${index + 1}. ${scenario.name}`);
  console.log(`   考生: ${scenario.context.score}分 / 学校层次: ${scenario.context.schoolTier}`);
  
  const result = calculateDynamicThresholds(scenario.context);
  
  console.log(`   分数段: ${result.debug.appliedRule} (${result.debug.scoreRate})`);
  console.log(`   综合调整系数: ${result.multipliers.total.toFixed(2)}x`);
  console.log(`   - 分数段: ${result.multipliers.score.toFixed(2)}x`);
  console.log(`   - 学校层次: ${result.multipliers.tier.toFixed(2)}x`);
  console.log(`   - 波动: ${result.multipliers.volatility.toFixed(2)}x`);
  console.log(`   - 招生计划: ${result.multipliers.plan.toFixed(2)}x`);
  
  console.log(`   📍 动态阈值:`);
  console.log(`      冲: [${result.thresholds.rush[0].toFixed(1)}, ${result.thresholds.rush[1].toFixed(1)}]`);
  console.log(`      稳: [${result.thresholds.match[0].toFixed(1)}, ${result.thresholds.match[1].toFixed(1)}]`);
  console.log(`      保: [${result.thresholds.safe[0].toFixed(1)}, ${result.thresholds.safe[1].toFixed(1)}]`);
  console.log('');
});

// 实际案例测试
console.log('=== 实际案例测试 ===\n');

const realCases = [
  {
    studentScore: 795,
    schoolName: '山西大学附中',
    schoolLine: 802,
    schoolTier: '省级示范',
    expected: 'rush'
  },
  {
    studentScore: 810,
    schoolName: '山西大学附中',
    schoolLine: 802,
    schoolTier: '省级示范',
    expected: 'match'
  },
  {
    studentScore: 750,
    schoolName: '太原市实验中学',
    schoolLine: 750,
    schoolTier: '一般高中',
    expected: 'rush'
  },
  {
    studentScore: 765,
    schoolName: '太原市实验中学',
    schoolLine: 750,
    schoolTier: '一般高中',
    expected: 'match'
  }
];

realCases.forEach((testCase, index) => {
  const gap = testCase.studentScore - testCase.schoolLine;
  const result = calculateDynamicThresholds({
    score: testCase.studentScore,
    totalScore: 839,
    schoolTier: testCase.schoolTier
  });
  
  let risk = 'out';
  if (gap >= result.thresholds.rush[0] && gap <= result.thresholds.rush[1]) {
    risk = 'rush';
  } else if (gap > result.thresholds.rush[1] && gap <= result.thresholds.match[1]) {
    risk = 'match';
  } else if (gap > result.thresholds.match[1]) {
    risk = 'safe';
  }
  
  const passed = risk === testCase.expected ? '✅' : '❌';
  
  console.log(`案例${index + 1}: ${passed}`);
  console.log(`  学生${testCase.studentScore}分 报考 ${testCase.schoolName}(${testCase.schoolLine}分)`);
  console.log(`  分差: ${gap > 0 ? '+' : ''}${gap}分`);
  console.log(`  预期风险: ${testCase.expected} | 实际风险: ${risk}`);
  console.log(`  动态阈值: 冲[${result.thresholds.rush[0].toFixed(1)}, ${result.thresholds.rush[1].toFixed(1)}] 稳[${result.thresholds.match[0].toFixed(1)}, ${result.thresholds.match[1].toFixed(1)}]`);
  console.log('');
});

console.log('✅ 测试完成！');
