/**
 * 太原中考分数线预测算法 v1.3
 * 
 * 核心改进：
 * 1. ✅ 基于v1.2的相对位置保持假设
 * 2. ✅ 新增：检测2021→2023的变化趋势，外推到2024
 * 3. ✅ 策略：如果学校有明显上升/下降趋势，应用趋势修正
 * 4. ✅ 混合模型：基础预测 + 趋势调整
 */

const fs = require('fs');
const path = require('path');

// ==================== 配置参数 ====================
const TRAINING_YEARS = [2021, 2023];
const TARGET_YEAR = 2024;

// 趋势权重：如果2021→2023变化显著，给予趋势一定权重
const TREND_WEIGHT = 0.5;  // 趋势调整占50%

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
  // 获取2023年相对位置（基础预测）
  const relativePos2023 = getSchoolRelativePosition(schoolCode, 2023);
  
  if (relativePos2023 === null) {
    return null;
  }
  
  // 基础预测：假设相对位置不变
  const target2024 = historicalData[TARGET_YEAR];
  let predictedScore = target2024.controlLine + 
    relativePos2023 * (target2024.totalScore - target2024.controlLine);
  
  // 尝试获取2021年数据，检测趋势
  const relativePos2021 = getSchoolRelativePosition(schoolCode, 2021);
  
  if (relativePos2021 !== null) {
    // 计算2021→2023的相对位置变化
    const relativeTrend = relativePos2023 - relativePos2021;
    
    // 如果有明显趋势，外推到2024
    // 假设2023→2024的变化 = (2021→2023变化) / 2 (因为时间间隔为2年vs1年)
    const predictedRelativePos2024 = relativePos2023 + relativeTrend / 2;
    
    // 趋势预测
    const trendPredictedScore = target2024.controlLine + 
      predictedRelativePos2024 * (target2024.totalScore - target2024.controlLine);
    
    // 混合：基础预测 + 趋势预测
    predictedScore = predictedScore * (1 - TREND_WEIGHT) + trendPredictedScore * TREND_WEIGHT;
    
    return {
      predicted: Math.round(predictedScore),
      relativePos2023,
      relativePos2021,
      relativeTrend,
      hasTrend: true
    };
  }
  
  // 没有2021年数据，只用基础预测
  return {
    predicted: Math.round(predictedScore),
    relativePos2023,
    hasTrend: false
  };
}

// ==================== 回测评估 ====================

function runBacktest() {
  console.log('='.repeat(100));
  console.log('太原中考分数线预测算法 v1.3 - 回测报告');
  console.log('='.repeat(100));
  console.log(`训练数据: ${TRAINING_YEARS.join(', ')}`);
  console.log(`目标年份: ${TARGET_YEAR}`);
  console.log(`策略: 相对位置保持 + 趋势外推 (权重=${TREND_WEIGHT})`);
  console.log(`改进: 识别2021→2023趋势，外推到2024`);
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
        hasTrend: prediction.hasTrend
      });
    }
  });
  
  // 按实际分数排序
  results.sort((a, b) => b.actual - a.actual);
  
  // ==================== 输出预测结果 ====================
  console.log('📊 预测2024年分数线');
  console.log('-'.repeat(100));
  console.log(`\n${'学校'.padEnd(45)} ${'实际'.padStart(5)} ${'预测'.padStart(5)} ${'误差'.padStart(6)} ${'趋势'.padStart(4)}`);
  console.log('-'.repeat(100));
  
  results.forEach(r => {
    const errorStr = (r.error > 0 ? '+' : '') + r.error.toFixed(0);
    const mark = Math.abs(r.error) <= 3 ? '✓' : ' ';
    const trendMark = r.hasTrend ? '✓' : '✗';
    console.log(`${mark} ${r.name.padEnd(43)} ${r.actual.toString().padStart(5)} ` +
      `${r.predicted.toString().padStart(5)} ${errorStr.padStart(6)} ${trendMark.padStart(4)}`);
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
  
  const withTrend = results.filter(r => r.hasTrend).length;
  const withoutTrend = results.filter(r => !r.hasTrend).length;
  
  console.log(`预测学校数: ${totalSchools}所 (有趋势数据: ${withTrend}所, 无趋势数据: ${withoutTrend}所)`);
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
    version: 'v1.3',
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
