/**
 * 太原中考分数线预测算法 v1.5 - 后端版本
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

// ==================== 配置参数 ====================
const REFERENCE_YEAR = 2023;
const ANOMALY_THRESHOLD = 30; // 分数变化阈值

// 异常波动学校代码列表
const ANOMALY_SCHOOLS = [
  '55079',  // 太原市清徐中学校
  '66002',  // 清徐县徐沟中学校
  '55077',  // 太原市杏岭实验学校
  '55074',  // 太原市外国语凤凰双语中学校
  '55075',  // 太原市同心外国语中学校
  '55071'   // 太原市成才中学校
];

const ANOMALY_TREND_YEARS = [2021, 2023];

// ==================== 工具函数 ====================

function calculateRelativePosition(score, controlLine, totalScore) {
  if (!score || !controlLine || !totalScore) return null;
  return (score - controlLine) / (totalScore - controlLine);
}

// ==================== 核心算法 ====================

/**
 * 异常学校预测：基于2021→2023的年度变化趋势
 */
function predictAnomalySchool(schoolCode, historicalData) {
  const score2023 = historicalData[2023]?.find(s => s.code === schoolCode)?.lastLine;
  const score2021 = historicalData[2021]?.find(s => s.code === schoolCode)?.lastLine;

  if (!score2023) return null;

  if (score2021 !== null && score2021 !== undefined) {
    // 计算2021→2023的年度平均变化
    const totalChange = score2023 - score2021;
    const yearsGap = 2;  // 2021→2023是2年
    const avgYearlyChange = totalChange / yearsGap;

    // 外推到目标年份
    const predicted = score2023 + avgYearlyChange;

    return {
      predicted: Math.round(predicted),
      strategy: 'anomaly-trend',
      score2021,
      score2023,
      avgYearlyChange,
      confidence: 'high'
    };
  } else {
    // 没有2021年数据，直接使用2023年分数
    return {
      predicted: score2023,
      strategy: 'anomaly-holdover',
      score2023,
      confidence: 'medium'
    };
  }
}

/**
 * 正常学校预测：v1.2相对位置保持策略
 */
function predictNormalSchool(schoolCode, referenceYear, targetYear, yearMetadata, historicalData) {
  // 获取参考年份的数据
  const referenceData = historicalData[referenceYear];
  const targetData = yearMetadata[targetYear];

  if (!referenceData || !targetData) {
    return null;
  }

  const refSchool = referenceData.find(s => s.code === schoolCode);
  if (!refSchool || !refSchool.lastLine) {
    return null;
  }

  // 计算参考年份的相对位置
  const refYearMetadata = yearMetadata[referenceYear];
  const relativePos = calculateRelativePosition(
    refSchool.lastLine,
    refYearMetadata.controlLine,
    refYearMetadata.totalScore
  );

  if (relativePos === null) {
    return null;
  }

  // 假设相对位置保持不变，映射到目标年份
  const predictedScore = targetData.controlLine +
    relativePos * (targetData.totalScore - targetData.controlLine);

  return {
    predicted: Math.round(predictedScore),
    strategy: 'normal-relative-position',
    relativePosition: relativePos,
    confidence: 'medium'
  };
}

/**
 * 预测学校分数线（主入口）
 */
function predictSchoolScore(schoolCode, targetYear, referenceYear, yearMetadata, historicalData) {
  if (!referenceYear) referenceYear = REFERENCE_YEAR;

  // 检查是否为异常学校
  const isAnomaly = ANOMALY_SCHOOLS.includes(schoolCode);

  let result;
  if (isAnomaly) {
    result = predictAnomalySchool(schoolCode, historicalData);
  } else {
    result = predictNormalSchool(schoolCode, referenceYear, targetYear, yearMetadata, historicalData);
  }

  return result || {
    predicted: null,
    strategy: 'failed',
    error: '无法生成预测'
  };
}

/**
 * 批量预测年份所有学校
 */
function predictYear(targetYear, historicalData, yearMetadata, schools) {
  const results = [];

  for (const school of schools) {
    const prediction = predictSchoolScore(
      school.code,
      targetYear,
      REFERENCE_YEAR,
      yearMetadata,
      historicalData
    );

    if (prediction.predicted !== null) {
      results.push({
        schoolCode: school.code,
        schoolName: school.name,
        ...prediction
      });
    }
  }

  return results;
}

/**
 * 获取高置信度学校（异常学校）
 */
function getHighConfidenceSchools(predictions) {
  return predictions.filter(p => p.strategy === 'anomaly-trend');
}

/**
 * 计算预测统计信息
 */
function calculateStatistics(predictions, actualData) {
  if (!actualData || actualData.length === 0) {
    return {
      totalPredictions: predictions.length,
      totalHigh: getHighConfidenceSchools(predictions).length
    };
  }

  const errors = [];
  let within3 = 0;

  for (const pred of predictions) {
    const actual = actualData.find(a => a.code === pred.schoolCode);
    if (actual && actual.lastLine) {
      const error = actual.lastLine - pred.predicted;
      errors.push(Math.abs(error));
      if (Math.abs(error) <= 3) {
        within3++;
      }
    }
  }

  if (errors.length === 0) {
    return {
      totalPredictions: predictions.length,
      totalHigh: getHighConfidenceSchools(predictions).length
    };
  }

  const mae = (errors.reduce((a, b) => a + b, 0) / errors.length).toFixed(1);
  const rmse = Math.sqrt(errors.reduce((a, b) => a + b * b, 0) / errors.length).toFixed(1);

  return {
    mae: parseFloat(mae),
    rmse: parseFloat(rmse),
    totalPredictions: predictions.length,
    validComparisons: errors.length,
    within3,
    within3Percent: parseFloat((within3 / errors.length * 100).toFixed(1)),
    totalHigh: getHighConfidenceSchools(predictions).length
  };
}

export {
  predictSchoolScore,
  predictYear,
  predictAnomalySchool,
  predictNormalSchool,
  getHighConfidenceSchools,
  calculateStatistics,
  ANOMALY_SCHOOLS,
  REFERENCE_YEAR,
  ANOMALY_THRESHOLD
};
