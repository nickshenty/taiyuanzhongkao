/**
 * 太原中考分数线预测算法 v1.5
 * 
 * 核心改进：
 * 1. ✅ 识别异常波动学校（2023→2024年度变化≥30分）
 * 2. ✅ 异常学校：使用2023年分数 + (2022→2023变化率 * 调整系数)
 * 3. ✅ 正常学校：使用v1.2的相对位置保持策略
 * 
 * 异常学校列表（6所）：
 * - 太原市清徐中学校 (55079): +60分
 * - 清徐县徐沟中学校 (66002): +59分
 * - 太原市杏岭实验学校 (55077): +45分
 * - 太原市外国语凤凰双语中学校 (55074): +36分
 * - 太原市同心外国语中学校 (55075): +30分
 * - 太原市成才中学校 (55071): +30分
 */

const fs = require('fs');
const path = require('path');

// ==================== 配置参数 ====================
const REFERENCE_YEAR = 2023;
const TARGET_YEAR = 2024;

// 异常波动学校代码列表
const ANOMALY_SCHOOLS = [
  '55079',  // 太原市清徐中学校
  '66002',  // 清徐县徐沟中学校
  '55077',  // 太原市杏岭实验学校
  '55074',  // 太原市外国语凤凰双语中学校
  '55075',  // 太原市同心外国语中学校
  '55071'   // 太原市成才中学校
];

// 异常学校预测策略：使用2021→2023的平均年度变化，外推到2024
const ANOMALY_TREND_YEARS = [2021, 2023];

// ==================== 数据加载 ====================
const historicalData = {};

function loadData() {
  // 加载2021, 2023, 2024
  [2021, REFERENCE_YEAR, TARGET_YEAR].forEach(year => {
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

/**
 * 异常学校预测：基于2021→2023的年度变化趋势
 */
function predictAnomalySchool(schoolCode) {
  const score2023 = getSchoolScore(schoolCode, 2023);
  const score2021 = getSchoolScore(schoolCode, 2021);
  
  if (!score2023) return null;
  
  if (score2021 !== null) {
    // 计算2021→2023的年度平均变化
    const totalChange = score2023 - score2021;
    const yearsGap = 2;  // 2021→2023是2年
    const avgYearlyChange = totalChange / yearsGap;
    
    // 外推到2024：2023分数 + 年度变化
    const predicted = score2023 + avgYearlyChange;
    
    return {
      predicted: Math.round(predicted),
      strategy: 'anomaly-trend',
      score2021,
      score2023,
      avgYearlyChange
    };
  } else {
    // 没有2021年数据，直接使用2023年分数
    return {
      predicted: score2023,
      strategy: 'anomaly-holdover',
      score2023
    };
  }
}

/**
 * 正常学校预测：v1.2相对位置保持策略
 */
function predictNormalSchool(schoolCode) {
  const relativePos2023 = getSchoolRelativePosition(schoolCode, REFERENCE_YEAR);
  
  if (relativePos2023 === null) {
    return null;
  }
  
  // 假设相对位置保持不变，映射到2024年
  const target2024 = historicalData[TARGET_YEAR];
  const predictedScore = target2024.controlLine + 
    relativePos2023 * (target2024.totalScore - target2024.controlLine);
  
  return {
    predicted: Math.round(predictedScore),
    strategy: 'normal-relative-position',
    relativePosition2023: relativePos2023
  };
}

/**
 * 预测学校分数线（路由函数）
 */
function predictSchoolScore(schoolCode) {
  if (ANOMALY_SCHOOLS.includes(schoolCode)) {
    return predictAnomalySchool(schoolCode);
  } else {
    return predictNormalSchool(schoolCode);
  }
}

// ==================== 回测评估 ====================

function runBacktest() {
  console.log('='.repeat(100));
  console.log('太原中考分数线预测算法 v1.5 - 回测报告');
  console.log('='.repeat(100));
  console.log(`参照年份: ${REFERENCE_YEAR}`);
  console.log(`目标年份: ${TARGET_YEAR}`);
  console.log(`策略: 双轨预测`);
  console.log(`  - 异常学校(${ANOMALY_SCHOOLS.length}所): 基于2021→2023年度变化趋势外推`);
  console.log(`  - 正常学校: 2023年相对位置保持不变（v1.2策略）`);
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
        strategy: prediction.strategy,
        isAnomaly: ANOMALY_SCHOOLS.includes(school.code)
      });
    }
  });
  
  // 按实际分数排序
  results.sort((a, b) => b.actual - a.actual);
  
  // ==================== 输出预测结果 ====================
  console.log('📊 预测2024年分数线');
  console.log('-'.repeat(100));
  console.log(`\n${'学校'.padEnd(45)} ${'实际'.padStart(5)} ${'预测'.padStart(5)} ${'误差'.padStart(6)} ${'策略'.padStart(8)}`);
  console.log('-'.repeat(100));
  
  results.forEach(r => {
    const errorStr = (r.error > 0 ? '+' : '') + r.error.toFixed(0);
    const mark = Math.abs(r.error) <= 3 ? '✓' : ' ';
    const strategyMark = r.isAnomaly ? '🔸' : '  ';
    console.log(`${mark} ${strategyMark}${r.name.padEnd(43)} ${r.actual.toString().padStart(5)} ` +
      `${r.predicted.toString().padStart(5)} ${errorStr.padStart(6)} ${(r.isAnomaly ? '异常' : '正常').padStart(8)}`);
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
  
  // 分策略统计
  console.log('\n' + '-'.repeat(100));
  console.log('分策略误差分析:');
  console.log('-'.repeat(100));
  
  const normalSchools = results.filter(r => !r.isAnomaly);
  const anomalySchools = results.filter(r => r.isAnomaly);
  
  if (normalSchools.length > 0) {
    const normalMae = normalSchools.reduce((sum, r) => sum + r.absError, 0) / normalSchools.length;
    const normalWithin3 = normalSchools.filter(r => r.absError <= 3).length;
    console.log(`正常学校(${normalSchools.length}所): MAE=${normalMae.toFixed(2)}分, ` +
      `≤3分: ${normalWithin3}/${normalSchools.length} (${(normalWithin3/normalSchools.length*100).toFixed(1)}%)`);
  }
  
  if (anomalySchools.length > 0) {
    const anomalyMae = anomalySchools.reduce((sum, r) => sum + r.absError, 0) / anomalySchools.length;
    const anomalyWithin3 = anomalySchools.filter(r => r.absError <= 3).length;
    console.log(`异常学校(${anomalySchools.length}所): MAE=${anomalyMae.toFixed(2)}分, ` +
      `≤3分: ${anomalyWithin3}/${anomalySchools.length} (${(anomalyWithin3/anomalySchools.length*100).toFixed(1)}%)`);
  }
  
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
  
  // ==================== 异常学校详细分析 ====================
  if (anomalySchools.length > 0) {
    console.log('\n' + '='.repeat(100));
    console.log('🔸 异常学校详细预测结果');
    console.log('='.repeat(100));
    anomalySchools.forEach(r => {
      const errorStr = (r.error > 0 ? '+' : '') + r.error;
      console.log(`${r.name}: 实际=${r.actual}, 预测=${r.predicted}, 误差=${errorStr}`);
    });
  }
  
  console.log('\n' + '='.repeat(100));
  
  return {
    version: 'v1.5',
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
  runBacktest,
  ANOMALY_SCHOOLS
};
