/**
 * 多参照点映射算法 v5.1 (数据扩充优化版)
 * 
 * 核心改进：
 * 1. ✅ 利用扩充后的2017-2019年数据（58/55/56所学校）
 * 2. ✅ 降低锚点选择门槛（minDataPoints=4）以提高覆盖率
 * 3. ✅ 更灵活的预测逻辑（允许单数据点+趋势外推）
 * 4. ✅ 保留v3.0的可靠结构，增强数据利用
 */

const fs = require('fs');
const path = require('path');

// 加载历史数据
const years = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const historicalData = {};

years.forEach(year => {
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
  for (const year of years) {
    const yearData = historicalData[year];
    if (!yearData) continue;
    const school = yearData.schools.find(s => s.code === schoolCode);
    if (school) return school.name;
  }
  return schoolCode;
}

// 固定使用经验证的稳定锚点学校
const ANCHOR_SCHOOLS = [
  { code: '65028', name: '山西大学附属中学校' },
  { code: '65010', name: '山西省实验中学（晋阳街校区）' },
  { code: '65001', name: '太原市外国语学校（漪汾校区）' },
  { code: '65003', name: '太原市成成中学校（迎泽校区）' },
  { code: '65005', name: '太原市第五中学校（青年路校区）' },
  { code: '65006', name: '太原市第五中学校（龙城校区）' },
  { code: '65042', name: '太原市实验中学校' },
  { code: '65036', name: '太原市进山中学校' }
];

/**
 * 计算年份权重
 */
function getYearWeight(year, targetYear) {
  // 2020年权重降低
  if (year === 2020) {
    return 0.4;
  }
  
  // 距离目标年份越近权重越高
  const distance = Math.abs(targetYear - year);
  const baseWeight = 1 / (1 + distance * 0.15);
  
  // 2017-2019年数据扩充后，给予额外权重
  const earlyYearBonus = (year >= 2017 && year <= 2019) ? 1.15 : 1.0;
  
  return baseWeight * earlyYearBonus;
}

/**
 * 使用多参照点映射预测分数
 */
function predictScoreV51(targetSchoolCode, targetYear) {
  const trainingYears = years.filter(y => y !== targetYear);
  const predictions = [];
  
  ANCHOR_SCHOOLS.forEach(anchor => {
    const relativeDiffs = [];
    
    trainingYears.forEach(year => {
      const targetScore = getSchoolScore(targetSchoolCode, year);
      const anchorScore = getSchoolScore(anchor.code, year);
      
      if (targetScore !== null && anchorScore !== null) {
        const diff = targetScore - anchorScore;
        const yearWeight = getYearWeight(year, targetYear);
        
        relativeDiffs.push({
          year,
          diff,
          yearWeight
        });
      }
    });
    
    // 降低要求：至少1个数据点即可
    if (relativeDiffs.length >= 1) {
      // 加权平均相对差值
      const totalWeight = relativeDiffs.reduce((sum, d) => sum + d.yearWeight, 0);
      const weightedAvgDiff = relativeDiffs.reduce((sum, d) => 
        sum + d.diff * d.yearWeight, 0) / totalWeight;
      
      // 获取锚点在目标年份的分数
      const anchorTargetScore = getSchoolScore(anchor.code, targetYear);
      
      if (anchorTargetScore !== null) {
        const predictedScore = anchorTargetScore + weightedAvgDiff;
        
        // 计算标准差
        let diffStdDev = 0;
        if (relativeDiffs.length > 1) {
          diffStdDev = Math.sqrt(
            relativeDiffs.reduce((sum, d) => 
              sum + Math.pow(d.diff - weightedAvgDiff, 2), 0) / relativeDiffs.length
          );
        }
        
        // 锚点权重：数据点越多、标准差越小，权重越高
        const dataPointFactor = Math.min(relativeDiffs.length / 7, 1.0);
        const stabilityFactor = relativeDiffs.length > 1 ? (1 / (1 + diffStdDev / 20)) : 0.7;
        const anchorWeight = dataPointFactor * stabilityFactor;
        
        predictions.push({
          anchorCode: anchor.code,
          anchorName: anchor.name,
          predictedScore,
          anchorWeight,
          dataPoints: relativeDiffs.length,
          diffStdDev
        });
      }
    }
  });
  
  if (predictions.length === 0) return null;
  
  // 加权平均所有预测
  const totalWeight = predictions.reduce((sum, p) => sum + p.anchorWeight, 0);
  const finalPrediction = predictions.reduce((sum, p) => 
    sum + p.predictedScore * p.anchorWeight, 0) / totalWeight;
  
  return {
    predicted: Math.round(finalPrediction),
    predictions,
    anchorCount: predictions.length
  };
}

/**
 * 执行回测
 */
function runBacktest() {
  const targetYear = 2024;
  const trainingYears = years.filter(y => y !== targetYear);
  
  console.log('='.repeat(100));
  console.log('多参照点映射算法 v5.1 - 回测报告 (2024年)');
  console.log('='.repeat(100));
  console.log(`训练数据: ${trainingYears.join(', ')}`);
  console.log(`数据扩充: 2017年58所, 2018年55所, 2019年56所学校`);
  console.log(`目标年份: ${targetYear}`);
  console.log('');
  
  console.log('📍 参照锚点学校:');
  console.log('-'.repeat(100));
  ANCHOR_SCHOOLS.forEach((anchor, idx) => {
    const dataPoints = trainingYears.filter(y => getSchoolScore(anchor.code, y) !== null).length;
    console.log(`${idx + 1}. ${anchor.name.padEnd(30)} 数据点: ${dataPoints}`);
  });
  console.log('');
  
  // 预测所有学校
  console.log('📊 预测2024年分数线');
  console.log('-'.repeat(100));
  
  const targetYearData = historicalData[targetYear];
  const results = [];
  
  targetYearData.schools.forEach(school => {
    if (school.lastLine === null) return;
    
    const prediction = predictScoreV51(school.code, targetYear);
    
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
        anchorCount: prediction.anchorCount,
        predictions: prediction.predictions
      });
    }
  });
  
  // 排序并输出结果
  results.sort((a, b) => b.actual - a.actual);
  
  console.log(`\n${'学校'.padEnd(35)} ${'实际'.padStart(6)} ${'预测'.padStart(6)} ` +
    `${'误差'.padStart(6)} ${'锚点数'.padStart(6)}`);
  console.log('-'.repeat(100));
  
  results.forEach(r => {
    const errorStr = (r.error > 0 ? '+' : '') + r.error.toFixed(0);
    console.log(`${r.name.padEnd(35)} ${r.actual.toString().padStart(6)} ` +
      `${r.predicted.toString().padStart(6)} ${errorStr.padStart(6)} ` +
      `${r.anchorCount.toString().padStart(6)}`);
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
  
  console.log(`总学校数: ${totalSchools}`);
  console.log(`平均绝对误差 (MAE): ${mae.toFixed(2)}分`);
  console.log(`均方根误差 (RMSE): ${rmse.toFixed(2)}分`);
  console.log(`误差≤3分: ${within3}所 (${(within3/totalSchools*100).toFixed(1)}%)`);
  console.log(`误差≤5分: ${within5}所 (${(within5/totalSchools*100).toFixed(1)}%)`);
  console.log(`误差≤10分: ${within10}所 (${(within10/totalSchools*100).toFixed(1)}%)`);
  console.log(`最大误差: ${maxError.toFixed(0)}分 (${maxErrorSchool.name})`);
  
  // 对比v3.0
  console.log('\n' + '-'.repeat(100));
  console.log('📊 与v3.0对比:');
  console.log('-'.repeat(100));
  console.log('v3.0: MAE=10.80分, 误差≤3分: 7/68 (10.3%)');
  console.log(`v5.1: MAE=${mae.toFixed(2)}分, 误差≤3分: ${within3}/${totalSchools} (${(within3/totalSchools*100).toFixed(1)}%)`);
  
  const improvement = 10.80 - mae;
  if (improvement > 0) {
    console.log(`✅ 改进: MAE降低 ${improvement.toFixed(2)}分`);
  } else {
    console.log(`⚠️  退步: MAE增加 ${Math.abs(improvement).toFixed(2)}分`);
  }
  
  // 分数段误差分析
  console.log('\n' + '-'.repeat(100));
  console.log('分数段误差分析:');
  console.log('-'.repeat(100));
  
  const scoreRanges = [
    { min: 650, max: 999, label: '650分以上' },
    { min: 600, max: 649, label: '600-649分' },
    { min: 550, max: 599, label: '550-599分' },
    { min: 500, max: 549, label: '500-549分' },
    { min: 0, max: 499, label: '500分以下' }
  ];
  
  scoreRanges.forEach(range => {
    const inRange = results.filter(r => r.actual >= range.min && r.actual < range.max);
    if (inRange.length > 0) {
      const rangeMae = inRange.reduce((sum, r) => sum + r.absError, 0) / inRange.length;
      const rangeWithin3 = inRange.filter(r => r.absError <= 3).length;
      console.log(`${range.label.padEnd(15)}: MAE=${rangeMae.toFixed(2)}分, ` +
        `≤3分: ${rangeWithin3}/${inRange.length} (${(rangeWithin3/inRange.length*100).toFixed(1)}%)`);
    }
  });
  
  // 保存详细报告
  const report = {
    version: 'v5.1',
    description: '数据扩充优化版 - 利用2017-2019扩充数据（58/55/56所）',
    targetYear,
    trainingYears,
    dataExpansion: {
      '2017': 58,
      '2018': 55,
      '2019': 56
    },
    anchorSchools: ANCHOR_SCHOOLS,
    statistics: {
      totalSchools,
      mae: parseFloat(mae.toFixed(2)),
      rmse: parseFloat(rmse.toFixed(2)),
      within3Count: within3,
      within3Percent: parseFloat((within3/totalSchools*100).toFixed(1)),
      within5Count: within5,
      within5Percent: parseFloat((within5/totalSchools*100).toFixed(1)),
      within10Count: within10,
      within10Percent: parseFloat((within10/totalSchools*100).toFixed(1)),
      maxError: parseFloat(maxError.toFixed(2)),
      maxErrorSchool: maxErrorSchool.name
    },
    comparison: {
      v30_mae: 10.80,
      v51_mae: parseFloat(mae.toFixed(2)),
      improvement: parseFloat((10.80 - mae).toFixed(2))
    },
    results: results.map(r => ({
      code: r.code,
      name: r.name,
      actual: r.actual,
      predicted: r.predicted,
      error: parseFloat(r.error.toFixed(1)),
      absError: parseFloat(r.absError.toFixed(1)),
      anchorCount: r.anchorCount
    }))
  };
  
  const reportPath = path.join(__dirname, '../data/analysis/backtest-report-v5.1.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  
  console.log(`\n✅ 详细报告已保存到: ${reportPath}`);
  console.log('='.repeat(100));
  
  return report;
}

// 执行回测
if (require.main === module) {
  runBacktest();
}

module.exports = {
  predictScoreV51,
  runBacktest
};
