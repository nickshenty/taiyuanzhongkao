/**
 * 多参照点映射算法 v6.0 (完整数据版)
 * 
 * 核心改进：
 * 1. ✅ 基于完整的2017-2024年数据（排除2022年660分制）
 * 2. ✅ 训练集：2017-2021 + 2023年（6年，730分制）
 * 3. ✅ 验证集：2024年
 * 4. ✅ 选择覆盖全部训练年份的锚点学校
 * 5. ✅ 2020年异常处理（权重0.4）
 * 6. ✅ 距离加权 + 稳定性评估
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

// 锚点学校选择标准：
// 1. 在2017-2021+2023全部6年都有数据
// 2. 覆盖不同分数段（高/中/低）
// 3. 在2024年也有数据（用于预测）
const ANCHOR_SCHOOLS = [
  { code: '65028', name: '山西大学附属中学校', tier: 'top' },
  { code: '65005', name: '太原市第五中学校（青年路校区）', tier: 'top' },
  { code: '65010', name: '山西省实验中学（晋阳街校区）', tier: 'top' },
  { code: '65001', name: '太原市外国语学校（漪汾校区）', tier: 'top' },
  { code: '65030', name: '太原师范学院附属中学', tier: 'high' },
  { code: '65003', name: '太原市成成中学校（迎泽校区）', tier: 'high' },
  { code: '65008', name: '太原市成成中学校（晋源校区）', tier: 'high' },
  { code: '65012', name: '太原市第十二中���校（早西关校区）', tier: 'mid' }
];

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
 * 计算年份权重
 */
function getYearWeight(year, targetYear) {
  // 2020年异常，权重降低
  if (year === 2020) return 0.4;
  
  // 距离目标年份越近权重越高
  const distance = Math.abs(targetYear - year);
  return 1 / (1 + distance * 0.15);
}

/**
 * 验证锚点学校的数据覆盖率
 */
function validateAnchorCoverage() {
  console.log('\n📍 验证锚点学校数据覆盖率:');
  console.log('-'.repeat(100));
  
  const results = [];
  ANCHOR_SCHOOLS.forEach(anchor => {
    const coverage = {};
    let missingYears = [];
    
    // 检查训练年份覆盖
    trainingYears.forEach(year => {
      const score = getSchoolScore(anchor.code, year);
      coverage[year] = score !== null;
      if (score === null) missingYears.push(year);
    });
    
    // 检查目标年份
    const has2024 = getSchoolScore(anchor.code, targetYear) !== null;
    coverage[targetYear] = has2024;
    if (!has2024) missingYears.push(targetYear);
    
    const trainingCoverage = trainingYears.filter(y => coverage[y]).length;
    const isValid = trainingCoverage === trainingYears.length && has2024;
    
    results.push({
      anchor,
      trainingCoverage,
      has2024,
      isValid,
      missingYears
    });
    
    const status = isValid ? '✅' : '❌';
    console.log(`${status} ${anchor.name.padEnd(35)} 训练:${trainingCoverage}/${trainingYears.length} 2024:${has2024?'有':'无'}`);
    if (missingYears.length > 0) {
      console.log(`   缺失年份: ${missingYears.join(', ')}`);
    }
  });
  
  const validAnchors = results.filter(r => r.isValid).length;
  console.log(`\n有效锚点: ${validAnchors}/${ANCHOR_SCHOOLS.length}`);
  
  return results.every(r => r.isValid);
}

/**
 * 计算相对位置并预测分数
 */
function predictSchoolScore(targetSchoolCode) {
  const positions = [];
  
  ANCHOR_SCHOOLS.forEach(anchor => {
    const relativeDiffs = [];
    
    // 计算目标学校与锚点学校在历史年份的相对差值
    trainingYears.forEach(year => {
      const targetScore = getSchoolScore(targetSchoolCode, year);
      const anchorScore = getSchoolScore(anchor.code, year);
      
      if (targetScore !== null && anchorScore !== null) {
        const diff = targetScore - anchorScore;
        const yearWeight = getYearWeight(year, targetYear);
        
        relativeDiffs.push({
          year,
          diff,
          targetScore,
          anchorScore,
          yearWeight
        });
      }
    });
    
    // 至少需要3个数据点才能预测
    if (relativeDiffs.length >= 3) {
      // 加权平均相对差值
      const totalWeight = relativeDiffs.reduce((sum, d) => sum + d.yearWeight, 0);
      const weightedAvgDiff = relativeDiffs.reduce((sum, d) => 
        sum + d.diff * d.yearWeight, 0) / totalWeight;
      
      // 计算标准差（稳定性指标）
      const variance = relativeDiffs.reduce((sum, d) => 
        sum + Math.pow(d.diff - weightedAvgDiff, 2) * d.yearWeight, 0) / totalWeight;
      const stdDev = Math.sqrt(variance);
      
      // 获取锚点在目标年份的分数
      const anchorTargetScore = getSchoolScore(anchor.code, targetYear);
      
      if (anchorTargetScore !== null) {
        const predictedScore = anchorTargetScore + weightedAvgDiff;
        
        // 锚点权重：数据点越多、越稳定，权重越高
        const dataPointFactor = Math.min(relativeDiffs.length / trainingYears.length, 1);
        const stabilityFactor = 1 / (1 + stdDev / 20);
        const weight = dataPointFactor * stabilityFactor;
        
        positions.push({
          anchorCode: anchor.code,
          anchorName: anchor.name,
          anchorTier: anchor.tier,
          anchorTargetScore,
          weightedAvgDiff,
          stdDev,
          predictedScore,
          weight,
          dataPoints: relativeDiffs.length,
          details: relativeDiffs
        });
      }
    }
  });
  
  if (positions.length === 0) return null;
  
  // 加权平均所有锚点的预测
  const totalWeight = positions.reduce((sum, p) => sum + p.weight, 0);
  const finalPrediction = positions.reduce((sum, p) => 
    sum + p.predictedScore * p.weight, 0) / totalWeight;
  
  return {
    predicted: Math.round(finalPrediction),
    positions,
    totalWeight,
    anchorCount: positions.length
  };
}

/**
 * 执行回测
 */
function runBacktest() {
  console.log('='.repeat(100));
  console.log('多参照点映射算法 v6.0 - 回测报告');
  console.log('='.repeat(100));
  console.log(`训练数据: ${trainingYears.join(', ')} (排除2022年660分制)`);
  console.log(`目标年份: ${targetYear}`);
  console.log(`锚点学校: ${ANCHOR_SCHOOLS.length}所`);
  console.log('');
  
  // 验证锚点覆盖率
  const isValid = validateAnchorCoverage();
  if (!isValid) {
    console.log('\n❌ 锚点学校数据不完整，无法继续回测');
    return;
  }
  
  // 预测所有学校
  console.log('\n📊 预测2024年分数线');
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
        anchorCount: prediction.anchorCount,
        prediction
      });
    }
  });
  
  // 排序并输出结果
  results.sort((a, b) => b.actual - a.actual);
  
  console.log(`\n${'学校'.padEnd(40)} ${'实际'.padStart(5)} ${'预测'.padStart(5)} ` +
    `${'误差'.padStart(6)} ${'锚点'.padStart(5)}`);
  console.log('-'.repeat(100));
  
  results.forEach(r => {
    const errorStr = (r.error > 0 ? '+' : '') + r.error.toFixed(0);
    const errorMark = Math.abs(r.error) <= 3 ? '✓' : ' ';
    console.log(`${errorMark} ${r.name.padEnd(38)} ${r.actual.toString().padStart(5)} ` +
      `${r.predicted.toString().padStart(5)} ${errorStr.padStart(6)} ${r.anchorCount.toString().padStart(5)}`);
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
  
  // 保存报告
  const report = {
    version: 'v6.0',
    description: '完整数据版 - 基于2017-2021+2023年数据（排除2022年660分制）',
    trainingYears,
    targetYear,
    anchorSchools: ANCHOR_SCHOOLS,
    statistics: {
      totalSchools,
      mae: parseFloat(mae.toFixed(2)),
      rmse: parseFloat(rmse.toFixed(2)),
      within3Count: within3,
      within3Percent: parseFloat((within3/totalSchools*100).toFixed(1)),
      within5Count: within5,
      within10Count: within10,
      maxError: parseFloat(maxError.toFixed(2)),
      maxErrorSchool: maxErrorSchool.name,
      goalAchieved: {
        mae: mae <= 3,
        coverage: within3/totalSchools >= 0.85
      }
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
  
  const reportPath = path.join(__dirname, '../data/analysis/backtest-report-v6.0.json');
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
  predictSchoolScore,
  runBacktest,
  ANCHOR_SCHOOLS,
  trainingYears
};
