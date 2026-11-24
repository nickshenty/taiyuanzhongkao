/**
 * 多参照点映射算法 v10.0 (近期趋势优先)
 * 
 * 核心改进：
 * 1. ✅ 基于完整的2017-2024年数据（排除2022年660分制）
 * 2. ✅ 训练集：2017-2021 + 2023年（6年，730分制）
 * 3. ✅ 验证集：2024年
 * 4. ✅ 近期趋势优先：2023→2024变化率权重最高
 * 5. ✅ 2020年异常处理：自动检测并降低离群点权重
 * 6. ✅ 控制线锚定：所有预测基于2024年控制线
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
 * 计算学校在某年的百分位位置
 */
function getPercentilePosition(schoolScore, year) {
  const yearData = historicalData[year];
  if (!yearData || !schoolScore) return null;
  
  const controlLine = yearData.controlLine;
  const totalScore = yearData.totalScore;
  
  const relativePosition = (schoolScore - controlLine) / (totalScore - controlLine);
  
  return {
    score: schoolScore,
    controlLine,
    totalScore,
    relativePosition
  };
}

/**
 * 计算年份对之间的变化率，并自动降低异常年份权重
 */
function getYearPairWeight(fromYear, toYear, changeRate) {
  // 基础权重：越近期权重越高
  let baseWeight = 1.0;
  
  if (toYear === 2023) {
    // 2023→2024最相关
    baseWeight = 3.0;
  } else if (toYear === 2021) {
    // 2021→2023次之
    baseWeight = 2.0;
  } else if (fromYear === 2020 || toYear === 2020) {
    // 涉及2020年的降权
    baseWeight = 0.3;
  } else {
    // 其他年份
    const distance = Math.abs(targetYear - toYear);
    baseWeight = 1.0 / (1 + distance * 0.3);
  }
  
  // 异常检测：变化率过大时降权
  const absChangeRate = Math.abs(changeRate);
  if (absChangeRate > 0.15) {
    // 变化率超过15%视为异常
    baseWeight *= 0.5;
  }
  
  return baseWeight;
}

/**
 * 使用近期趋势预测分数
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
          relativePosition: position.relativePosition,
          score
        });
      }
    }
  });
  
  if (dataPoints.length < 3) return null;
  
  // 按年份排序
  dataPoints.sort((a, b) => a.year - b.year);
  
  // 计算相邻年份的变化率
  const changes = [];
  for (let i = 1; i < dataPoints.length; i++) {
    const prev = dataPoints[i - 1];
    const curr = dataPoints[i];
    
    const changeRate = curr.relativePosition - prev.relativePosition;
    const weight = getYearPairWeight(prev.year, curr.year, changeRate);
    
    changes.push({
      fromYear: prev.year,
      toYear: curr.year,
      fromPos: prev.relativePosition,
      toPos: curr.relativePosition,
      changeRate,
      weight
    });
  }
  
  if (changes.length === 0) return null;
  
  // 加权平均变化率
  const totalWeight = changes.reduce((sum, c) => sum + c.weight, 0);
  const avgChangeRate = changes.reduce((sum, c) => 
    sum + c.changeRate * c.weight, 0) / totalWeight;
  
  // 从2023年的位置外推到2024年
  const last2023Point = dataPoints.find(p => p.year === 2023);
  
  let predicted2024RelativePosition;
  if (last2023Point) {
    // 有2023年数据，直接外推
    predicted2024RelativePosition = last2023Point.relativePosition + avgChangeRate;
  } else {
    // 没有2023年数据，从最后一个数据点外推
    const lastPoint = dataPoints[dataPoints.length - 1];
    const yearGap = targetYear - lastPoint.year;
    predicted2024RelativePosition = lastPoint.relativePosition + avgChangeRate * yearGap;
  }
  
  // 使用2024年的控制线计算预测分数
  const targetYearData = historicalData[targetYear];
  const predictedScore = targetYearData.controlLine + 
    predicted2024RelativePosition * (targetYearData.totalScore - targetYearData.controlLine);
  
  return {
    predicted: Math.round(predictedScore),
    avgChangeRate,
    dataPoints: dataPoints.length,
    has2023Data: !!last2023Point,
    changes
  };
}

/**
 * 执行回测
 */
function runBacktest() {
  console.log('='.repeat(100));
  console.log('多参照点映射算法 v10.0 - 回测报告');
  console.log('='.repeat(100));
  console.log(`训练数据: ${trainingYears.join(', ')} (排除2022年660分制)`);
  console.log(`目标年份: ${targetYear}`);
  console.log(`策略: 近期趋势优先 + 异常值自动降权`);
  console.log('');
  
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
        dataPoints: prediction.dataPoints,
        has2023Data: prediction.has2023Data
      });
    }
  });
  
  // 排序并输出
  results.sort((a, b) => b.actual - a.actual);
  
  console.log('📊 预测2024年分数线');
  console.log('-'.repeat(100));
  console.log(`\n${'学校'.padEnd(40)} ${'实际'.padStart(5)} ${'预测'.padStart(5)} ` +
    `${'误差'.padStart(6)} ${'数据'.padStart(5)} ${'2023'.padStart(5)}`);
  console.log('-'.repeat(100));
  
  results.forEach(r => {
    const errorStr = (r.error > 0 ? '+' : '') + r.error.toFixed(0);
    const errorMark = Math.abs(r.error) <= 3 ? '✓' : ' ';
    const has2023 = r.has2023Data ? '✓' : '✗';
    console.log(`${errorMark} ${r.name.padEnd(38)} ${r.actual.toString().padStart(5)} ` +
      `${r.predicted.toString().padStart(5)} ${errorStr.padStart(6)} ${r.dataPoints.toString().padStart(5)} ${has2023.padStart(5)}`);
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
  
  // 按是否有2023年数据分析
  console.log('\n' + '-'.repeat(100));
  console.log('按数据覆盖率分析:');
  console.log('-'.repeat(100));
  
  const with2023 = results.filter(r => r.has2023Data);
  const without2023 = results.filter(r => !r.has2023Data);
  
  if (with2023.length > 0) {
    const mae2023 = with2023.reduce((sum, r) => sum + r.absError, 0) / with2023.length;
    const within3_2023 = with2023.filter(r => r.absError <= 3).length;
    console.log(`有2023年数据: ${with2023.length}所, MAE=${mae2023.toFixed(2)}分, ` +
      `≤3分: ${within3_2023}/${with2023.length} (${(within3_2023/with2023.length*100).toFixed(1)}%)`);
  }
  
  if (without2023.length > 0) {
    const maeNo2023 = without2023.reduce((sum, r) => sum + r.absError, 0) / without2023.length;
    const within3_no2023 = without2023.filter(r => r.absError <= 3).length;
    console.log(`无2023年数据: ${without2023.length}所, MAE=${maeNo2023.toFixed(2)}分, ` +
      `≤3分: ${within3_no2023}/${without2023.length} (${(within3_no2023/without2023.length*100).toFixed(1)}%)`);
  }
  
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
    version: 'v10.0',
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
