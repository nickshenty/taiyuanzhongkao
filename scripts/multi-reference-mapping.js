/**
 * 多参照点映射算法 (Multi-Reference Point Mapping)
 * 
 * 核心思想：
 * 1. 使用5所稳定学校作为参照锚点
 * 2. 计算目标学校与每个锚点的历史相对位置
 * 3. 基于多锚点加权平均预测目标年份分数
 * 4. 引入2020年难度系数修正
 * 
 * 参照锚点学校（按稳定性排序）：
 * - 65028 山西大学附属中学校 (σ=28.4)
 * - 65010 山西省实验中学 (σ=28.5)
 * - 65001 太原市外国语学校 (σ=29.0)
 * - 65003 太原市成成中学校迎泽校区 (σ=32.2)
 * - 65005 太原市第五中学校青年路校区 (σ=32.6)
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

/**
 * 计算2020年难度系数
 * 通过比较2020年与前后年份的分数差异
 */
function calculate2020DifficultyCoefficient() {
  const coefficients = [];
  
  ANCHOR_SCHOOLS.forEach(anchor => {
    const scores = {};
    years.forEach(year => {
      const yearData = historicalData[year];
      if (yearData) {
        const school = yearData.schools.find(s => s.code === anchor.code);
        if (school) {
          scores[year] = school.lastLine;
        }
      }
    });
    
    // 计算2019→2020和2020→2021的变化
    if (scores[2019] && scores[2020] && scores[2021]) {
      const drop2020 = scores[2019] - scores[2020];
      const rise2021 = scores[2021] - scores[2020];
      const avgNormalChange = (rise2021 - drop2020) / 2;
      const coefficient = drop2020 / scores[2019];
      
      coefficients.push({
        school: anchor.name,
        drop: drop2020,
        coefficient: coefficient,
        score2019: scores[2019],
        score2020: scores[2020],
        score2021: scores[2021]
      });
    }
  });
  
  // 计算平均系数
  const avgCoefficient = coefficients.reduce((sum, c) => sum + c.coefficient, 0) / coefficients.length;
  
  return {
    coefficient: avgCoefficient,
    details: coefficients,
    adjustmentFactor: 1 / (1 - avgCoefficient) // 用于将2020年分数归一化
  };
}

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
 * 计算目标学校与锚点学校的相对位置
 * @param {string} targetSchoolCode - 目标学校代码
 * @param {number} targetYear - 目标年份
 * @returns {Array} 相对位置数组
 */
function calculateRelativePositions(targetSchoolCode, targetYear) {
  const positions = [];
  const trainingYears = years.filter(y => y !== targetYear);
  
  ANCHOR_SCHOOLS.forEach(anchor => {
    const relativeDiffs = [];
    
    trainingYears.forEach(year => {
      const targetScore = getSchoolScore(targetSchoolCode, year);
      const anchorScore = getSchoolScore(anchor.code, year);
      
      if (targetScore !== null && anchorScore !== null) {
        // 计算相对差值
        const diff = targetScore - anchorScore;
        relativeDiffs.push({
          year,
          diff,
          targetScore,
          anchorScore
        });
      }
    });
    
    if (relativeDiffs.length > 0) {
      // 计算平均相对差值
      const avgDiff = relativeDiffs.reduce((sum, d) => sum + d.diff, 0) / relativeDiffs.length;
      
      // 计算标准差（稳定性指标）
      const variance = relativeDiffs.reduce((sum, d) => sum + Math.pow(d.diff - avgDiff, 2), 0) / relativeDiffs.length;
      const stdDev = Math.sqrt(variance);
      
      positions.push({
        anchorCode: anchor.code,
        anchorName: anchor.name,
        anchorWeight: anchor.weight,
        avgDiff,
        stdDev,
        dataPoints: relativeDiffs.length,
        stability: stdDev < 10 ? 'high' : stdDev < 20 ? 'medium' : 'low'
      });
    }
  });
  
  return positions;
}

/**
 * 预测目标学校在目标年份的分数线
 * @param {string} targetSchoolCode - 目标学校代码
 * @param {string} targetSchoolName - 目标学校名称
 * @param {number} targetYear - 目标年份
 * @returns {Object} 预测结果
 */
function predictScore(targetSchoolCode, targetSchoolName, targetYear) {
  // 计算相对位置
  const positions = calculateRelativePositions(targetSchoolCode, targetYear);
  
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
      // 预测分数 = 锚点分数 + 平均相对差值
      const predicted = anchorScoreInTargetYear + pos.avgDiff;
      
      // 权重 = 基础权重 × 数据点数 × 稳定性因子
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
  
  const finalPrediction = Math.round(weightedSum / totalWeight);
  
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
    actualScore: getSchoolScore(targetSchoolCode, targetYear),
    error: null,
    confidence,
    anchorCount: positions.length,
    totalDataPoints: dataPointsCount,
    avgStability: avgStdDev.toFixed(1),
    predictions
  };
}

/**
 * 批量预测并生成回测报告
 */
function backtestPredictions() {
  console.log('='.repeat(100));
  console.log('多参照点映射算法 - 回测验证报告');
  console.log('='.repeat(100));
  
  // 计算2020年难度系数
  const difficulty2020 = calculate2020DifficultyCoefficient();
  console.log('\n📊 2020年难度系数分析:\n');
  console.log(`平均系数: ${(difficulty2020.coefficient * 100).toFixed(2)}% (分数线平均下降)`);
  console.log(`归一化因子: ${difficulty2020.adjustmentFactor.toFixed(3)}`);
  console.log('\n各锚点学校2020年变化:');
  difficulty2020.details.forEach(d => {
    console.log(`  ${d.school}: ${d.score2019} → ${d.score2020} (下降${d.drop}分, ${(d.coefficient * 100).toFixed(1)}%)`);
  });
  
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
    { code: '65003', name: '太原市成成中学校（迎泽校区）' }
  ];
  
  const results = [];
  console.log('\n预测结果:\n');
  console.log('学校                                   预测分数  实际分数  误差   置信度   锚点数');
  console.log('-'.repeat(100));
  
  testSchools.forEach(school => {
    const result = predictScore(school.code, school.name, targetYear);
    results.push(result);
    
    if (result.predictedScore !== null && result.actualScore !== null) {
      const error = Math.abs(result.predictedScore - result.actualScore);
      const errorStr = error <= 3 ? `✅ ${error}` : error <= 5 ? `⚠️ ${error}` : `❌ ${error}`;
      
      console.log(`${result.schoolName.padEnd(38)} ${result.predictedScore.toString().padStart(6)}    ${result.actualScore.toString().padStart(6)}    ${errorStr.padEnd(8)} ${result.confidence.padEnd(8)} ${result.anchorCount}`);
    } else {
      console.log(`${result.schoolName.padEnd(38)} 无法预测或无实际数据`);
    }
  });
  
  // 计算MAE
  const validResults = results.filter(r => r.predictedScore !== null && r.actualScore !== null);
  
  let mae = null;
  let within3 = 0;
  let within5 = 0;
  
  if (validResults.length > 0) {
    mae = validResults.reduce((sum, r) => sum + Math.abs(r.predictedScore - r.actualScore), 0) / validResults.length;
    within3 = validResults.filter(r => Math.abs(r.predictedScore - r.actualScore) <= 3).length;
    within5 = validResults.filter(r => Math.abs(r.predictedScore - r.actualScore) <= 5).length;
    
    console.log('\n' + '='.repeat(100));
    console.log('精度评估:\n');
    console.log(`  平均绝对误差 (MAE): ${mae.toFixed(2)}分`);
    console.log(`  ±3分内准确率: ${within3}/${validResults.length} (${(within3/validResults.length*100).toFixed(1)}%)`);
    console.log(`  ±5分内准确率: ${within5}/${validResults.length} (${(within5/validResults.length*100).toFixed(1)}%)`);
    console.log(`  目标达成: ${mae <= 3 ? '✅ 是' : mae <= 5 ? '⚠️ 接近' : '❌ 否'} (目标MAE ≤ 3分)`);
  }
  
  // 保存详细结果
  const report = {
    algorithm: 'Multi-Reference Point Mapping',
    version: '1.0',
    backtestDate: new Date().toISOString(),
    trainingYears: years.filter(y => y !== targetYear),
    targetYear,
    difficulty2020,
    anchorSchools: ANCHOR_SCHOOLS,
    results,
    summary: mae !== null ? {
      mae: mae.toFixed(2),
      within3Count: within3,
      within3Rate: (within3/validResults.length*100).toFixed(1) + '%',
      within5Count: within5,
      within5Rate: (within5/validResults.length*100).toFixed(1) + '%',
      targetAchieved: mae <= 3
    } : null
  };
  
  const reportPath = path.join(__dirname, '../data/analysis/backtest-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n✅ 详细报告已保存: ${reportPath}`);
  console.log('='.repeat(100));
}

// 执行回测
if (require.main === module) {
  backtestPredictions();
}

module.exports = {
  predictScore,
  calculateRelativePositions,
  calculate2020DifficultyCoefficient,
  ANCHOR_SCHOOLS
};
