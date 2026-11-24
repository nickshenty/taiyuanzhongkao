/**
 * 多参照点映射算法 v3.0 (修正版)
 * 
 * 核心修正：
 * 1. ❌ 不再对2020年数据进行归一化（避免抬高基准）
 * 2. ✅ 识别2020年异常，在计算趋势时降低其权重
 * 3. ✅ 保留近期年份趋势权重
 * 4. ❌ 移除控制线修正（效果不明显且引入额外误差）
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

// 参照锚点学校
const ANCHOR_SCHOOLS = [
  { code: '65028', name: '山西大学附属中学校', weight: 1.0 },
  { code: '65010', name: '山西省实验中学（晋阳街校区）', weight: 0.95 },
  { code: '65001', name: '太原市外国语学校（漪汾校区）', weight: 0.9 },
  { code: '65003', name: '太原市成成中学校（迎泽校区）', weight: 0.85 },
  { code: '65005', name: '太原市第五中学校（青年路校区）', weight: 0.8 }
];

/**
 * 获取学校在某年的分数线（原始值）
 */
function getSchoolScore(schoolCode, year) {
  const yearData = historicalData[year];
  if (!yearData) return null;
  
  const school = yearData.schools.find(s => s.code === schoolCode);
  return school ? school.lastLine : null;
}

/**
 * 计算年份权重（考虑趋势和2020异常）
 */
function getYearWeight(year, targetYear) {
  // 2020年权重降低50%
  if (year === 2020) {
    return 0.5;
  }
  
  // 近期年份权重递增（但不过度）
  const yearsFromStart = year - 2017;
  const trendWeight = 1 + 0.08 * yearsFromStart; // 8%递增（比v2降低）
  
  // 距离目标年份的衰减
  const distance = Math.abs(targetYear - year);
  const distanceWeight = 1 / (1 + distance * 0.05);
  
  return trendWeight * distanceWeight;
}

/**
 * 计算相对位置（v3.0）
 */
function calculateRelativePositionsV3(targetSchoolCode, targetYear) {
  const positions = [];
  const trainingYears = years.filter(y => y !== targetYear);
  
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
          targetScore,
          anchorScore,
          yearWeight,
          is2020: year === 2020
        });
      }
    });
    
    if (relativeDiffs.length > 0) {
      // 加权平均相对差值
      const totalWeight = relativeDiffs.reduce((sum, d) => sum + d.yearWeight, 0);
      const weightedAvgDiff = relativeDiffs.reduce((sum, d) => 
        sum + d.diff * d.yearWeight, 0) / totalWeight;
      
      // 计算标准差（用于评估稳定性）
      const variance = relativeDiffs.reduce((sum, d) => 
        sum + Math.pow(d.diff - weightedAvgDiff, 2) * d.yearWeight, 0) / totalWeight;
      const stdDev = Math.sqrt(variance);
      
      positions.push({
        anchorCode: anchor.code,
        anchorName: anchor.name,
        anchorWeight: anchor.weight,
        avgDiff: weightedAvgDiff,
        stdDev,
        dataPoints: relativeDiffs.length,
        stability: stdDev < 10 ? 'high' : stdDev < 20 ? 'medium' : 'low',
        details: relativeDiffs
      });
    }
  });
  
  return positions;
}

/**
 * 预测分数（v3.0）
 */
function predictScoreV3(targetSchoolCode, targetSchoolName, targetYear) {
  const positions = calculateRelativePositionsV3(targetSchoolCode, targetYear);
  
  if (positions.length === 0) {
    return {
      schoolCode: targetSchoolCode,
      schoolName: targetSchoolName,
      targetYear,
      predictedScore: null,
      confidence: 'none',
      error: '无足够历史数据进行预测'
    };
  }
  
  // 基于多锚点预测
  let weightedSum = 0;
  let totalWeight = 0;
  const predictions = [];
  
  positions.forEach(pos => {
    const anchorScoreInTargetYear = getSchoolScore(pos.anchorCode, targetYear);
    
    if (anchorScoreInTargetYear !== null) {
      const predicted = anchorScoreInTargetYear + pos.avgDiff;
      
      // 综合权重：基础权重 × 稳定性因子
      const stabilityFactor = pos.stdDev < 10 ? 1.3 : pos.stdDev < 20 ? 1.0 : 0.7;
      const weight = pos.anchorWeight * stabilityFactor * Math.sqrt(pos.dataPoints);
      
      weightedSum += predicted * weight;
      totalWeight += weight;
      
      predictions.push({
        anchorName: pos.anchorName,
        anchorScore: anchorScoreInTargetYear,
        avgDiff: Math.round(pos.avgDiff * 10) / 10,
        predicted: Math.round(predicted),
        weight: Math.round(weight * 100) / 100,
        stability: pos.stability
      });
    }
  });
  
  if (totalWeight === 0) {
    return {
      schoolCode: targetSchoolCode,
      schoolName: targetSchoolName,
      targetYear,
      predictedScore: null,
      confidence: 'none',
      error: '目标年份锚点学校数据缺失'
    };
  }
  
  const finalPrediction = Math.round(weightedSum / totalWeight);
  
  // 评估置信度
  const avgStdDev = positions.reduce((sum, p) => sum + p.stdDev, 0) / positions.length;
  const dataPointsCount = positions.reduce((sum, p) => sum + p.dataPoints, 0);
  
  let confidence = 'low';
  if (positions.length >= 4 && avgStdDev < 12 && dataPointsCount >= 20) {
    confidence = 'high';
  } else if (positions.length >= 3 && avgStdDev < 20 && dataPointsCount >= 12) {
    confidence = 'medium';
  }
  
  return {
    schoolCode: targetSchoolCode,
    schoolName: targetSchoolName,
    targetYear,
    predictedScore: finalPrediction,
    actualScore: getSchoolScore(targetSchoolCode, targetYear),
    error: null,
    confidence,
    anchorCount: positions.length,
    totalDataPoints: dataPointsCount,
    avgStability: Math.round(avgStdDev * 10) / 10,
    predictions
  };
}

/**
 * 批量预测并生成回测报告 v3.0
 */
function backtestPredictionsV3() {
  console.log('='.repeat(100));
  console.log('多参照点映射算法 v3.0 - 回测验证报告（修正版）');
  console.log('='.repeat(100));
  
  console.log('\n✨ v3.0核心改进:\n');
  console.log('  1. ❌ 移除2020年数据归一化（避免抬高基准）');
  console.log('  2. ✅ 2020年数据权重降低50%（识别异常但不修改原值）');
  console.log('  3. ✅ 优化近期年份趋势权重（8%递增，比v2更保守）');
  console.log('  4. ❌ 移除控制线修正（简化模型，减少误差源）');
  
  // 回测：使用2017-2023预测2024
  console.log('\n' + '='.repeat(100));
  console.log('回测任务: 使用2017-2023年数据预测2024年');
  console.log('='.repeat(100));
  
  const targetYear = 2024;
  const testSchools = [
    { code: '65028', name: '山西大学附属中学校' },
    { code: '65005', name: '太原市第五中学校（青年路校区）' },
    { code: '66005', name: '太原市第五中学校（龙城校区）' },
    { code: '65001', name: '太原市外国语学校（漪汾校区）' },
    { code: '65003', name: '太原市成成中学校（迎泽校区）' },
    { code: '65002', name: '太原市第二中学校' },
    { code: '65004', name: '太原市实验中学校' },
    { code: '65006', name: '太原市进山中学校' }
  ];
  
  const results = [];
  console.log('\n预测结果:\n');
  console.log('学校                                   预测分数  实际分数  误差   置信度   锚点数  数据点');
  console.log('-'.repeat(110));
  
  testSchools.forEach(school => {
    const result = predictScoreV3(school.code, school.name, targetYear);
    results.push(result);
    
    if (result.predictedScore !== null && result.actualScore !== null) {
      const error = Math.abs(result.predictedScore - result.actualScore);
      const errorStr = error <= 3 ? `✅ ${error}` : error <= 5 ? `⚠️ ${error}` : error <= 10 ? `❌ ${error}` : `❌❌ ${error}`;
      
      console.log(`${result.schoolName.padEnd(38)} ${result.predictedScore.toString().padStart(6)}    ${result.actualScore.toString().padStart(6)}    ${errorStr.padEnd(8)} ${result.confidence.padEnd(8)} ${result.anchorCount.toString().padStart(3)}     ${result.totalDataPoints.toString().padStart(3)}`);
    } else if (result.predictedScore !== null) {
      console.log(`${result.schoolName.padEnd(38)} ${result.predictedScore.toString().padStart(6)}    无实际数据`);
    } else {
      console.log(`${result.schoolName.padEnd(38)} 无法预测`);
    }
  });
  
  // 计算MAE
  const validResults = results.filter(r => r.predictedScore !== null && r.actualScore !== null);
  
  let mae = null;
  let within3 = 0;
  let within5 = 0;
  let within10 = 0;
  
  if (validResults.length > 0) {
    mae = validResults.reduce((sum, r) => sum + Math.abs(r.predictedScore - r.actualScore), 0) / validResults.length;
    within3 = validResults.filter(r => Math.abs(r.predictedScore - r.actualScore) <= 3).length;
    within5 = validResults.filter(r => Math.abs(r.predictedScore - r.actualScore) <= 5).length;
    within10 = validResults.filter(r => Math.abs(r.predictedScore - r.actualScore) <= 10).length;
    
    console.log('\n' + '='.repeat(100));
    console.log('精度评估:\n');
    console.log(`  平均绝对误差 (MAE): ${mae.toFixed(2)}分`);
    console.log(`  ±3分内准确率: ${within3}/${validResults.length} (${(within3/validResults.length*100).toFixed(1)}%)`);
    console.log(`  ±5分内准确率: ${within5}/${validResults.length} (${(within5/validResults.length*100).toFixed(1)}%)`);
    console.log(`  ±10分内准确率: ${within10}/${validResults.length} (${(within10/validResults.length*100).toFixed(1)}%)`);
    console.log(`  目标达成: ${mae <= 3 ? '✅ 是' : mae <= 5 ? '⚠️ 接近' : mae <= 10 ? '⚠️ 可接受' : '❌ 否'} (目标MAE ≤ 3分)`);
    
    // 版本对比
    console.log('\n📊 版本对比:\n');
    console.log(`  v1.0 MAE: 10.40分 (无优化)`);
    console.log(`  v2.0 MAE: 73.40分 (归一化错误)`);
    console.log(`  v3.0 MAE: ${mae.toFixed(2)}分`);
    
    if (mae < 10.40) {
      console.log(`  ✅ v3.0相比v1.0改进: ${(10.40 - mae).toFixed(2)}分 (${((1 - mae/10.40)*100).toFixed(1)}%)`);
    } else {
      console.log(`  ⚠️ v3.0相比v1.0: ${(mae - 10.40).toFixed(2)}分误差增加`);
    }
  }
  
  // 保存详细结果
  const report = {
    algorithm: 'Multi-Reference Point Mapping',
    version: '3.0',
    changes: [
      '移除2020年数据归一化',
      '2020年权重降低至0.5',
      '近期年份趋势权重优化为8%递增',
      '移除控制线修正'
    ],
    backtestDate: new Date().toISOString(),
    trainingYears: years.filter(y => y !== targetYear),
    targetYear,
    anchorSchools: ANCHOR_SCHOOLS,
    results,
    summary: mae !== null ? {
      mae: parseFloat(mae.toFixed(2)),
      within3Count: within3,
      within3Rate: (within3/validResults.length*100).toFixed(1) + '%',
      within5Count: within5,
      within5Rate: (within5/validResults.length*100).toFixed(1) + '%',
      within10Count: within10,
      within10Rate: (within10/validResults.length*100).toFixed(1) + '%',
      targetAchieved: mae <= 3
    } : null
  };
  
  const reportPath = path.join(__dirname, '../data/analysis/backtest-report-v3.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n✅ 详细报告已保存: ${reportPath}`);
  console.log('='.repeat(100));
}

// 执行回测
if (require.main === module) {
  backtestPredictionsV3();
}

module.exports = {
  predictScoreV3,
  calculateRelativePositionsV3,
  getSchoolScore,
  getYearWeight,
  ANCHOR_SCHOOLS
};
