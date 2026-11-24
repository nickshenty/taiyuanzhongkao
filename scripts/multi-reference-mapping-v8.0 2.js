/**
 * 多参照点映射算法 v8.0 (线性趋势外推)
 * 
 * 核心改进：
 * 1. ✅ 基于完整的2017-2024年数据（排除2022年660分制）
 * 2. ✅ 训练集：2017-2021 + 2023年（6年，730分制）
 * 3. ✅ 验证集：2024年
 * 4. ✅ 线性回归：捕捉学校相对位置的上升/下降趋势
 * 5. ✅ 趋势外推：预测2024年的相对位置
 * 6. ✅ 控制线锚定：使用2024年控制线还原分数
 */

const fs = require('fs');
const path = require('path');

// 加载历史数据（排除2022年）
const trainingYears = [2017, 2018, 2019, 2020, 2021, 2023];
const targetYear = 2024;
const historicalData = {};

[...trainingYears, targetYear].forEach(year => {
  const filePath = path.join(__dirname, `../data/years/${year}.json`);
  if (fs.existsSync(filePath)) {
    historicalData[year] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
});

/**
 * 获取学校在某年的分数线
 */
function getSchoolScore(schoolCode, year) {
  const yearData = historicalData[year];
  if (!yearData) return null;
  
  const school = yearData.schools.find(s => s.code === schoolCode);
  return school ? school.lastLine : null;
}

/**
 * 获取学校名称
 */
function getSchoolName(schoolCode) {
  for (const year of [...trainingYears, targetYear]) {
    const yearData = historicalData[year];
    if (!yearData) continue;
    const school = yearData.schools.find(s => s.code === schoolCode);
    if (school) return school.name;
  }
  return schoolCode;
}

/**
 * 计算学校在某年的百分位位置（相对于控制线）
 */
function getPercentilePosition(schoolScore, year) {
  const yearData = historicalData[year];
  if (!yearData || !schoolScore) return null;
  
  const controlLine = yearData.controlLine;
  const totalScore = yearData.totalScore;
  
  // 计算相对位置：(学校分数 - 控制线) / (满分 - 控制线)
  const relativePosition = (schoolScore - controlLine) / (totalScore - controlLine);
  
  return {
    score: schoolScore,
    controlLine,
    totalScore,
    relativePosition,
    scoreAboveControl: schoolScore - controlLine
  };
}

/**
 * 线性回归：y = a + bx
 * 返回 { slope, intercept, r2 }
 */
function linearRegression(points) {
  const n = points.length;
  if (n < 2) return null;
  
  // 计算均值
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;
  
  // 计算斜率和截距
  let numerator = 0;
  let denominator = 0;
  
  points.forEach(p => {
    numerator += (p.x - meanX) * (p.y - meanY);
    denominator += (p.x - meanX) * (p.x - meanX);
  });
  
  if (denominator === 0) return null;
  
  const slope = numerator / denominator;
  const intercept = meanY - slope * meanX;
  
  // 计算R²
  const totalSS = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
  const residualSS = points.reduce((sum, p) => {
    const predicted = intercept + slope * p.x;
    return sum + Math.pow(p.y - predicted, 2);
  }, 0);
  
  const r2 = totalSS > 0 ? 1 - (residualSS / totalSS) : 0;
  
  return { slope, intercept, r2 };
}

/**
 * 使用线性趋势预测分数
 */
function predictSchoolScore(targetSchoolCode) {
  // 收集历史数据点
  const dataPoints = [];
  
  trainingYears.forEach(year => {
    const score = getSchoolScore(targetSchoolCode, year);
    if (score !== null) {
      const position = getPercentilePosition(score, year);
      if (position) {
        dataPoints.push({
          year,
          x: year,
          y: position.relativePosition,
          score,
          ...position
        });
      }
    }
  });
  
  if (dataPoints.length < 3) return null;
  
  // 执行线性回归
  const regression = linearRegression(dataPoints);
  if (!regression) return null;
  
  // 预测2024年的相对位置
  const predictedRelativePosition = regression.intercept + regression.slope * targetYear;
  
  // 使用2024年的控制线和满分计算预测分数
  const targetYearData = historicalData[targetYear];
  const targetControlLine = targetYearData.controlLine;
  const targetTotalScore = targetYearData.totalScore;
  
  const predictedScore = targetControlLine + 
    predictedRelativePosition * (targetTotalScore - targetControlLine);
  
  // 计算标准差（残差）
  const residuals = dataPoints.map(p => {
    const fitted = regression.intercept + regression.slope * p.x;
    return Math.pow(p.y - fitted, 2);
  });
  const stdError = Math.sqrt(residuals.reduce((a, b) => a + b, 0) / dataPoints.length);
  
  return {
    predicted: Math.round(predictedScore),
    predictedRelativePosition,
    slope: regression.slope,
    intercept: regression.intercept,
    r2: regression.r2,
    stdError,
    dataPoints: dataPoints.length,
    historicalData: dataPoints,
    trend: regression.slope > 0.01 ? 'rising' : (regression.slope < -0.01 ? 'falling' : 'stable')
  };
}

/**
 * 执行回测
 */
function runBacktest() {
  console.log('='.repeat(100));
  console.log('多参照点映射算法 v8.0 - 回测报告');
  console.log('='.repeat(100));
  console.log(`训练数据: ${trainingYears.join(', ')} (排除2022年660分制)`);
  console.log(`目标年份: ${targetYear}`);
  console.log(`策略: 线性趋势外推 + 控制线锚定`);
  console.log('');
  
  // 预测所有学校
  console.log('📊 预测2024年分数线');
  console.log('-'.repeat(100));
  
  const targetYearData = historicalData[targetYear];
  const results = [];
  
  targetYearData.schools.forEach(school => {
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
        slope: prediction.slope,
        r2: prediction.r2,
        trend: prediction.trend,
        dataPoints: prediction.dataPoints
      });
    }
  });
  
  // 排序并输出结果
  results.sort((a, b) => b.actual - a.actual);
  
  console.log(`\n${'学校'.padEnd(40)} ${'实际'.padStart(5)} ${'预测'.padStart(5)} ` +
    `${'误差'.padStart(6)} ${'趋势'.padStart(8)} ${'R²'.padStart(6)}`);
  console.log('-'.repeat(100));
  
  results.forEach(r => {
    const errorStr = (r.error > 0 ? '+' : '') + r.error.toFixed(0);
    const errorMark = Math.abs(r.error) <= 3 ? '✓' : ' ';
    const trendIcon = r.trend === 'rising' ? '↗' : (r.trend === 'falling' ? '↘' : '→');
    console.log(`${errorMark} ${r.name.padEnd(38)} ${r.actual.toString().padStart(5)} ` +
      `${r.predicted.toString().padStart(5)} ${errorStr.padStart(6)} ${(trendIcon + r.trend).padStart(8)} ` +
      `${r.r2.toFixed(3).padStart(6)}`);
  });
  
  // 统计分析
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
  
  // 趋势分析
  console.log('\n' + '-'.repeat(100));
  console.log('趋势分布:');
  console.log('-'.repeat(100));
  
  const risingSchools = results.filter(r => r.trend === 'rising');
  const fallingSchools = results.filter(r => r.trend === 'falling');
  const stableSchools = results.filter(r => r.trend === 'stable');
  
  console.log(`上升趋势 (↗): ${risingSchools.length}所, MAE=${(risingSchools.reduce((s,r)=>s+r.absError,0)/risingSchools.length).toFixed(2)}分`);
  console.log(`下降趋势 (↘): ${fallingSchools.length}所, MAE=${(fallingSchools.reduce((s,r)=>s+r.absError,0)/fallingSchools.length).toFixed(2)}分`);
  console.log(`稳定 (→): ${stableSchools.length}所, MAE=${(stableSchools.reduce((s,r)=>s+r.absError,0)/stableSchools.length).toFixed(2)}分`);
  
  // 分数段分析
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
  
  // 目标达成评估
  console.log('\n' + '='.repeat(100));
  console.log('🎯 目标达成评估');
  console.log('='.repeat(100));
  console.log(`目标1: MAE ≤ 3分 → ${mae <= 3 ? '✅ 达成' : `❌ 未达成 (${mae.toFixed(2)}分)`}`);
  console.log(`目标2: 85%学校误差≤3分 → ${within3/totalSchools >= 0.85 ? '✅ 达成' : `❌ 未达成 (${(within3/totalSchools*100).toFixed(1)}%)`}`);
  
  console.log('\n' + '='.repeat(100));
  
  return {
    version: 'v8.0',
    mae,
    rmse,
    totalSchools,
    within3,
    within3Percent: parseFloat((within3/totalSchools*100).toFixed(1)),
    results
  };
}

// 执行回测
if (require.main === module) {
  runBacktest();
}

module.exports = {
  predictSchoolScore,
  runBacktest,
  trainingYears
};
