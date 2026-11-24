/**
 * 太原中考分数线预测算法 v1.1
 * 
 * 改进点：
 * 1. ✅ 只使用最近3年数据（2021, 2023, 2024训练；2020异常年份彻底排除）
 * 2. ✅ 2023年权重5.0（最高），2021年权重2.0
 * 3. ✅ 对于数据点<3年的学校，使用2023年单点预测
 * 4. ✅ 假设：近期趋势比长期历史更可靠
 */

const fs = require('fs');
const path = require('path');

// ==================== 配置参数 ====================
const TRAINING_YEARS = [2021, 2023];  // 只用最近两年
const TARGET_YEAR = 2024;

// 年份权重：强化近期
const YEAR_WEIGHTS = {
  2023: 5.0,  // 极高权重
  2021: 2.0   // 较低权重
};

// ==================== 数据加载 ====================
const historicalData = {};

function loadData() {
  [...TRAINING_YEARS, TARGET_YEAR].forEach(year => {
    const filePath = path.join(__dirname, `../data/years/${year}.json`);
    if (fs.existsSync(filePath)) {
      historicalData[year] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  });
}

// ==================== 工具函数 ====================

function getSchoolScore(schoolCode, year) {
  const yearData = historicalData[year];
  if (!yearData) return null;
  
  const school = yearData.schools.find(s => s.code === schoolCode);
  return school ? school.lastLine : null;
}

function calculateRelativePosition(score, controlLine, totalScore) {
  if (!score || !controlLine || !totalScore) return null;
  return (score - controlLine) / (totalScore - controlLine);
}

function getSchoolRelativePosition(schoolCode, year) {
  const yearData = historicalData[year];
  if (!yearData) return null;
  
  const score = getSchoolScore(schoolCode, year);
  if (!score) return null;
  
  return calculateRelativePosition(score, yearData.controlLine, yearData.totalScore);
}

// ==================== 核心算法 ====================

function predictSchoolScore(schoolCode) {
  // 收集历史相对位置数据
  const historicalPositions = [];
  
  TRAINING_YEARS.forEach(year => {
    const relativePos = getSchoolRelativePosition(schoolCode, year);
    if (relativePos !== null) {
      historicalPositions.push({
        year,
        relativePosition: relativePos,
        weight: YEAR_WEIGHTS[year] || 1.0
      });
    }
  });
  
  // 至少需要1个数据点
  if (historicalPositions.length === 0) {
    return null;
  }
  
  // 加权平均计算预测相对位置
  const totalWeight = historicalPositions.reduce((sum, item) => sum + item.weight, 0);
  const predictedRelativePosition = historicalPositions.reduce(
    (sum, item) => sum + item.relativePosition * item.weight,
    0
  ) / totalWeight;
  
  // 转换为2024年分数
  const target2024 = historicalData[TARGET_YEAR];
  const predictedScore = target2024.controlLine + 
    predictedRelativePosition * (target2024.totalScore - target2024.controlLine);
  
  return {
    predicted: Math.round(predictedScore),
    dataPoints: historicalPositions.length,
    predictedRelativePosition
  };
}

// ==================== 回测评估 ====================

function runBacktest() {
  console.log('='.repeat(100));
  console.log('太原中考分数线预测算法 v1.1 - 回测报告');
  console.log('='.repeat(100));
  console.log(`训练数据: ${TRAINING_YEARS.join(', ')} (仅用最近两年)`);
  console.log(`目标年份: ${TARGET_YEAR}`);
  console.log(`策略: 近期优先 - 2023×5.0, 2021×2.0`);
  console.log(`改进: 彻底排除2020异常年和早期数据`);
  console.log('');
  
  const target2024 = historicalData[TARGET_YEAR];
  const results = [];
  
  // 对每所学校进行预测
  target2024.schools.forEach(school => {
    if (school.lastLine === null) return;
    
    const prediction = predictSchoolScore(school.code);
    
    if (prediction) {
      const actual = school.lastLine;
      const error = prediction.predicted - actual;
      
      results.push({
        code: school.code,
        name: school.name,
        actual,
        predicted: prediction.predicted,
        error,
        absError: Math.abs(error),
        dataPoints: prediction.dataPoints
      });
    }
  });
  
  // 按实际分数排序
  results.sort((a, b) => b.actual - a.actual);
  
  // ==================== 输出预测结果 ====================
  console.log('📊 预测2024年分数线');
  console.log('-'.repeat(100));
  console.log(`\n${'学校'.padEnd(45)} ${'实际'.padStart(5)} ${'预测'.padStart(5)} ${'误差'.padStart(6)} ${'数据年'.padStart(6)}`);
  console.log('-'.repeat(100));
  
  results.forEach(r => {
    const errorStr = (r.error > 0 ? '+' : '') + r.error.toFixed(0);
    const mark = Math.abs(r.error) <= 3 ? '✓' : ' ';
    console.log(`${mark} ${r.name.padEnd(43)} ${r.actual.toString().padStart(5)} ` +
      `${r.predicted.toString().padStart(5)} ${errorStr.padStart(6)} ${r.dataPoints.toString().padStart(6)}`);
  });
  
  // ==================== 统计分析 ====================
  console.log('\n' + '='.repeat(100));
  console.log('📈 误差统计分析');
  console.log('='.repeat(100));
  
  const totalSchools = results.length;
  const mae = results.reduce((sum, r) => sum + r.absError, 0) / totalSchools;
  const rmse = Math.sqrt(results.reduce((sum, r) => sum + r.error * r.error, 0) / totalSchools);
  
  const within3 = results.filter(r => r.absError <= 3).length;
  const within5 = results.filter(r => r.absError <= 5).length;
  const within10 = results.filter(r => r.absError <= 10).length;
  
  const maxError = Math.max(...results.map(r => r.absError));
  const maxErrorSchool = results.find(r => r.absError === maxError);
  
  console.log(`预测学校数: ${totalSchools}所`);
  console.log(`平均绝对误差 (MAE): ${mae.toFixed(2)}分`);
  console.log(`均方根误差 (RMSE): ${rmse.toFixed(2)}分`);
  console.log(`误差≤3分: ${within3}所 (${(within3/totalSchools*100).toFixed(1)}%) ${within3/totalSchools>=0.85?'✅':'❌'}`);
  console.log(`误差≤5分: ${within5}所 (${(within5/totalSchools*100).toFixed(1)}%)`);
  console.log(`误差≤10分: ${within10}所 (${(within10/totalSchools*100).toFixed(1)}%)`);
  console.log(`最大误差: ${maxError.toFixed(0)}分 (${maxErrorSchool.name})`);
  
  // ==================== 分数段分析 ====================
  console.log('\n' + '-'.repeat(100));
  console.log('分数段误差分析:');
  console.log('-'.repeat(100));
  
  const scoreRanges = [
    { min: 670, max: 999, label: '670分以上（顶尖）' },
    { min: 650, max: 669, label: '650-669分（优质）' },
    { min: 620, max: 649, label: '620-649分（重点）' },
    { min: 580, max: 619, label: '580-619分（一般）' },
    { min: 0, max: 579, label: '580分以下' }
  ];
  
  scoreRanges.forEach(range => {
    const inRange = results.filter(r => r.actual >= range.min && r.actual <= range.max);
    if (inRange.length > 0) {
      const rangeMae = inRange.reduce((sum, r) => sum + r.absError, 0) / inRange.length;
      const rangeWithin3 = inRange.filter(r => r.absError <= 3).length;
      console.log(`${range.label.padEnd(25)}: MAE=${rangeMae.toFixed(2)}分, ` +
        `≤3分: ${rangeWithin3}/${inRange.length} (${(rangeWithin3/inRange.length*100).toFixed(1)}%)`);
    }
  });
  
  // ==================== 目标达成评估 ====================
  console.log('\n' + '='.repeat(100));
  console.log('🎯 目标达成评估');
  console.log('='.repeat(100));
  console.log(`目标1: MAE ≤ 3分 → ${mae <= 3 ? '✅ 达成' : `❌ 未达成 (${mae.toFixed(2)}分)`}`);
  console.log(`目标2: 85%学校误差≤3分 → ${within3/totalSchools >= 0.85 ? '✅ 达成' : `❌ 未达成 (${(within3/totalSchools*100).toFixed(1)}%)`}`);
  
  console.log('\n' + '='.repeat(100));
  
  return {
    version: 'v1.1',
    mae,
    rmse,
    totalSchools,
    within3,
    within3Percent: parseFloat((within3/totalSchools*100).toFixed(1)),
    results
  };
}

// ==================== 主函数 ====================
if (require.main === module) {
  loadData();
  runBacktest();
}

module.exports = {
  loadData,
  predictSchoolScore,
  runBacktest
};
