/**
 * 多参照点映射算法 v2.0 (优化版)
 * 
 * 新增优化：
 * 1. 2020年难度系数归一化
 * 2. 近期年份趋势权重
 * 3. 最低控制线修正
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
  { code: '65028', name: '山西大学附属中学校', weight: 1.0, stdDev: 28.4 },
  { code: '65010', name: '山西省实验中学（晋阳街校区）', weight: 0.95, stdDev: 28.5 },
  { code: '65001', name: '太原市外国语学校（漪汾校区）', weight: 0.9, stdDev: 29.0 },
  { code: '65003', name: '太原市成成中学校（迎泽校区）', weight: 0.85, stdDev: 32.2 },
  { code: '65005', name: '太原市第五中学校（青年路校区）', weight: 0.8, stdDev: 32.6 }
];

// 2020年归一化系数（根据回测分析得出）
const DIFFICULTY_2020_FACTOR = 1.135;

/**
 * 获取学校在某年的分数线（带2020年归一化）
 */
function getSchoolScore(schoolCode, year, normalize2020 = true) {
  const yearData = historicalData[year];
  if (!yearData) return null;
  
  const school = yearData.schools.find(s => s.code === schoolCode);
  if (!school) return null;
  
  // 对2020年数据进行归一化
  if (year === 2020 && normalize2020) {
    return Math.round(school.lastLine * DIFFICULTY_2020_FACTOR);
  }
  
  return school.lastLine;
}

/**
 * 计算年份权重（近期年份权重更高）
 */
function getYearWeight(year, targetYear) {
  const yearsFromStart = year - 2017;
  const trendWeight = 1 + 0.15 * yearsFromStart; // 15%递增
  
  // 距离目标年份越近，权重越高
  const distance = Math.abs(targetYear - year);
  const distanceWeight = 1 / (1 + distance * 0.1);
  
  return trendWeight * distanceWeight;
}

/**
 * 计算最低控制线修正系数
 */
function getControlLineAdjustment(targetYear, trainingYears) {
  const targetData = historicalData[targetYear];
  if (!targetData || !targetData.minControlLine) return 1.0;
  
  const trainingLines = trainingYears
    .map(y => historicalData[y]?.minControlLine)
    .filter(line => line !== null && line !== undefined);
  
  if (trainingLines.length === 0) return 1.0;
  
  const avgTrainingLine = trainingLines.reduce((sum, l) => sum + l, 0) / trainingLines.length;
  const targetLine = targetData.minControlLine;
  
  // 控制线差异系数
  const adjustment = targetLine / avgTrainingLine;
  
  return adjustment;
}

/**
 * 计算相对位置（优化版）
 */
function calculateRelativePositionsV2(targetSchoolCode, targetYear) {
  const positions = [];
  const trainingYears = years.filter(y => y !== targetYear);
  
  ANCHOR_SCHOOLS.forEach(anchor => {
    const relativeDiffs = [];
    
    trainingYears.forEach(year => {
      const targetScore = getSchoolScore(targetSchoolCode, year, true);
      const anchorScore = getSchoolScore(anchor.code, year, true);
      
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
    
    if (relativeDiffs.length > 0) {
      // 加权平均相对差值
      const totalWeight = relativeDiffs.reduce((sum, d) => sum + d.yearWeight, 0);
      const weightedAvgDiff = relativeDiffs.reduce((sum, d) => sum + d.diff * d.yearWeight, 0) / totalWeight;
      
      // 计算标准差
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
        stability: stdDev < 10 ? 'high' : stdDev < 20 ? 'medium' : 'low'
      });
    }
  });
  
  return positions;
}

/**
 * 预测分数（优化版v2.0）
 */
function predictScoreV2(targetSchoolCode, targetSchoolName, targetYear) {
  const positions = calculateRelativePositionsV2(targetSchoolCode, targetYear);
  
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
    // 注意：目标年份的锚点分数不需要归一化（因为是实际值）
    const anchorScoreInTargetYear = getSchoolScore(pos.anchorCode, targetYear, false);
    
    if (anchorScoreInTargetYear !== null) {
      const predicted = anchorScoreInTargetYear + pos.avgDiff;
      
      const stabilityFactor = pos.stdDev < 10 ? 1.2 : pos.stdDev < 20 ? 1.0 : 0.8;
      const weight = pos.anchorWeight * pos.dataPoints * stabilityFactor;
      
      weightedSum += predicted * weight;
      totalWeight += weight;
      
      predictions.push({
        anchorName: pos.anchorName,
        anchorScore: anchorScoreInTargetYear,
        avgDiff: pos.avgDiff,
        predicted,
        weight,
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
  
  let finalPrediction = weightedSum / totalWeight;
  
  // 应用最低控制线修正
  const trainingYears = years.filter(y => y !== targetYear);
  const controlLineAdj = getControlLineAdjustment(targetYear, trainingYears);
  
  // 仅当控制线有明显变化时应用修正（±5%以上）
  if (Math.abs(controlLineAdj - 1.0) > 0.05) {
    finalPrediction *= controlLineAdj;
  }
  
  finalPrediction = Math.round(finalPrediction);
  
  // 评估置信度
  const avgStdDev = positions.reduce((sum, p) => sum + p.stdDev, 0) / positions.length;
  const dataPointsCount = positions.reduce((sum, p) => sum + p.dataPoints, 0);
  
  let confidence = 'low';
  if (positions.length >= 4 && avgStdDev < 15 && dataPointsCount >= 15) {
    confidence = 'high';
  } else if (positions.length >= 3 && avgStdDev < 25 && dataPointsCount >= 10) {
    confidence = 'medium';
  }
  
  return {
    schoolCode: targetSchoolCode,
    schoolName: targetSchoolName,
    targetYear,
    predictedScore: finalPrediction,
    actualScore: getSchoolScore(targetSchoolCode, targetYear, false),
    error: null,
    confidence,
    anchorCount: positions.length,
    totalDataPoints: dataPointsCount,
    avgStability: avgStdDev.toFixed(1),
    controlLineAdjustment: controlLineAdj.toFixed(3),
    predictions
  };
}

/**
 * 批量预测并生成回测报告 v2.0
 */
function backtestPredictionsV2() {
  console.log('='.repeat(100));
  console.log('多参照点映射算法 v2.0 - 回测验证报告（优化版）');
  console.log('='.repeat(100));
  
  console.log('\n✨ 新增优化:\n');
  console.log('  1. 2020年数据归一化（系数: 1.135）');
  console.log('  2. 近期年份趋势权重（2023年权重+90%）');
  console.log('  3. 最低控制线修正');
  
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
    { code: '65010', name: '山西省实验中学（晋阳街校区）' },
    { code: '65004', name: '太原市实验中学校' },
    { code: '65006', name: '太原市进山中学校' }
  ];
  
  const results = [];
  console.log('\n预测结果:\n');
  console.log('学校                                   预测分数  实际分数  误差   置信度   控制线修正');
  console.log('-'.repeat(100));
  
  testSchools.forEach(school => {
    const result = predictScoreV2(school.code, school.name, targetYear);
    results.push(result);
    
    if (result.predictedScore !== null && result.actualScore !== null) {
      const error = Math.abs(result.predictedScore - result.actualScore);
      const errorStr = error <= 3 ? `✅ ${error}` : error <= 5 ? `⚠️ ${error}` : error <= 10 ? `❌ ${error}` : `❌❌ ${error}`;
      
      console.log(`${result.schoolName.padEnd(38)} ${result.predictedScore.toString().padStart(6)}    ${result.actualScore.toString().padStart(6)}    ${errorStr.padEnd(8)} ${result.confidence.padEnd(8)} ${result.controlLineAdjustment}`);
    } else {
      console.log(`${result.schoolName.padEnd(38)} 无法预测或无实际数据`);
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
    console.log(`  目标达成: ${mae <= 3 ? '✅ 是' : mae <= 5 ? '⚠️ 接近' : '❌ 否'} (目标MAE ≤ 3分)`);
    
    // 与v1.0对比
    console.log('\n📊 与v1.0版本对比:\n');
    console.log(`  v1.0 MAE: 10.40分`);
    console.log(`  v2.0 MAE: ${mae.toFixed(2)}分`);
    console.log(`  改进: ${(10.40 - mae).toFixed(2)}分 (${((1 - mae/10.40)*100).toFixed(1)}%)`);
  }
  
  // 保存详细结果
  const report = {
    algorithm: 'Multi-Reference Point Mapping',
    version: '2.0',
    optimizations: [
      '2020年难度系数归一化 (1.135)',
      '近期年份趋势权重（递增15%）',
      '最低控制线修正'
    ],
    backtestDate: new Date().toISOString(),
    trainingYears: years.filter(y => y !== targetYear),
    targetYear,
    anchorSchools: ANCHOR_SCHOOLS,
    results,
    summary: mae !== null ? {
      mae: mae.toFixed(2),
      within3Count: within3,
      within3Rate: (within3/validResults.length*100).toFixed(1) + '%',
      within5Count: within5,
      within5Rate: (within5/validResults.length*100).toFixed(1) + '%',
      within10Count: within10,
      within10Rate: (within10/validResults.length*100).toFixed(1) + '%',
      targetAchieved: mae <= 3,
      improvementVsV1: {
        v1MAE: 10.40,
        v2MAE: parseFloat(mae.toFixed(2)),
        improvement: parseFloat((10.40 - mae).toFixed(2)),
        improvementPercent: parseFloat(((1 - mae/10.40)*100).toFixed(1))
      }
    } : null
  };
  
  const reportPath = path.join(__dirname, '../data/analysis/backtest-report-v2.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n✅ 详细报告已保存: ${reportPath}`);
  console.log('='.repeat(100));
}

// 执行回测
if (require.main === module) {
  backtestPredictionsV2();
}

module.exports = {
  predictScoreV2,
  calculateRelativePositionsV2,
  getSchoolScore,
  ANCHOR_SCHOOLS,
  DIFFICULTY_2020_FACTOR
};
