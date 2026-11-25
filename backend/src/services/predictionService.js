import {
  predictSchoolScore,
  predictYear,
  getHighConfidenceSchools,
  calculateStatistics
} from '../algorithms/predictionAlgorithmV1.5.js';
import { query } from '../config/database.js';

/**
 * 预测服务层
 * 负责：
 * 1. 从数据库加载历史数据
 * 2. 调用v1.5算法进行预测
 * 3. 保存预测结果到数据库
 * 4. 提供预测查询API
 */

// ==================== 数据加载函数 ====================

/**
 * 从数据库加载指定年份的学校数据
 */
async function loadYearSchools(year) {
  try {
    const sql = `
      SELECT 
        s.code,
        s.name,
        a.last_line as lastLine,
        a.quota_line as quotaLine,
        a.batch,
        a.plan_count as planCount
      FROM schools s
      LEFT JOIN admission_lines a ON s.code = a.school_code AND a.year = ?
      ORDER BY s.code
    `;
    const schools = await query(sql, [year]);
    return schools;
  } catch (error) {
    console.error(`Error loading schools for year ${year}:`, error);
    return [];
  }
}

/**
 * 从数据库加载年份元数据
 */
async function loadYearMetadata(year) {
  try {
    const sql = 'SELECT year, control_line as controlLine, total_score as totalScore FROM years WHERE year = ?';
    const results = await query(sql, [year]);
    if (results.length === 0) return null;

    return {
      year: results[0].year,
      controlLine: results[0].controlLine,
      totalScore: results[0].totalScore
    };
  } catch (error) {
    console.error(`Error loading metadata for year ${year}:`, error);
    return null;
  }
}

/**
 * 构建历史数据结构用于算法
 */
async function buildHistoricalData(years) {
  const historicalData = {};

  for (const year of years) {
    const schools = await loadYearSchools(year);
    historicalData[year] = schools;
  }

  return historicalData;
}

/**
 * 构建年份元数据结构
 */
async function buildYearMetadata(years) {
  const yearMetadata = {};

  for (const year of years) {
    const metadata = await loadYearMetadata(year);
    if (metadata) {
      yearMetadata[year] = metadata;
    }
  }

  return yearMetadata;
}

// ==================== 预测生成函数 ====================

/**
 * 为指定年份生成预测
 */
async function generatePredictions(targetYear, referenceYear = 2023) {
  try {
    console.log(`\n📊 开始为${targetYear}年生成预测...`);

    // 加载历史数据（需要2021、2023年数据用于异常学校预测）
    const historicalData = await buildHistoricalData([2021, 2023]);
    const yearMetadata = await buildYearMetadata([2021, 2023, targetYear]);

    if (!yearMetadata[targetYear]) {
      throw new Error(`${targetYear}年元数据不存在`);
    }

    // 获取所有学校
    const allSchools = await query('SELECT code, name FROM schools ORDER BY code');

    // 执行预测
    const predictions = predictYear(targetYear, historicalData, yearMetadata, allSchools);

    console.log(`✅ 生成了${predictions.length}条预测`);

    // 保存到数据库
    let savedCount = 0;
    for (const pred of predictions) {
      const sql = `
        INSERT INTO predictions 
        (year, school_code, predicted_score, strategy, confidence, algorithm_version)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        predicted_score = VALUES(predicted_score),
        strategy = VALUES(strategy),
        confidence = VALUES(confidence),
        updated_at = CURRENT_TIMESTAMP
      `;

      await query(sql, [
        targetYear,
        pred.schoolCode,
        pred.predicted,
        pred.strategy,
        pred.confidence,
        'v1.5'
      ]);

      savedCount++;
    }

    console.log(`✅ 已保存${savedCount}条预测到数据库`);

    return {
      success: true,
      year: targetYear,
      count: predictions.length,
      savedCount
    };
  } catch (error) {
    console.error('预测生成失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 获取指定年份的所有预测
 */
async function getPredictions(year) {
  try {
    const sql = `
      SELECT 
        p.id,
        p.year,
        p.school_code as schoolCode,
        s.name as schoolName,
        p.predicted_score as predictedScore,
        p.strategy,
        p.confidence,
        p.algorithm_version as algorithmVersion,
        p.created_at as createdAt,
        p.updated_at as updatedAt
      FROM predictions p
      LEFT JOIN schools s ON p.school_code = s.code
      WHERE p.year = ?
      ORDER BY p.predicted_score DESC
    `;

    const results = await query(sql, [year]);
    return results;
  } catch (error) {
    console.error(`Error fetching predictions for year ${year}:`, error);
    return [];
  }
}

/**
 * 获取指定年份的高置信度预测（异常学校）
 */
async function getHighConfidencePredictions(year) {
  try {
    const sql = `
      SELECT 
        p.id,
        p.year,
        p.school_code as schoolCode,
        s.name as schoolName,
        p.predicted_score as predictedScore,
        p.strategy,
        p.confidence,
        p.algorithm_version as algorithmVersion,
        p.created_at as createdAt
      FROM predictions p
      LEFT JOIN schools s ON p.school_code = s.code
      WHERE p.year = ? AND p.strategy = 'anomaly-trend'
      ORDER BY p.predicted_score DESC
    `;

    const results = await query(sql, [year]);
    return results;
  } catch (error) {
    console.error(`Error fetching high confidence predictions:`, error);
    return [];
  }
}

/**
 * 获取单个学校的预测
 */
async function getSchoolPrediction(schoolCode, year) {
  try {
    const sql = `
      SELECT 
        p.id,
        p.year,
        p.school_code as schoolCode,
        s.name as schoolName,
        p.predicted_score as predictedScore,
        p.actual_score as actualScore,
        p.error,
        p.strategy,
        p.confidence,
        p.algorithm_version as algorithmVersion,
        p.created_at as createdAt,
        p.updated_at as updatedAt
      FROM predictions p
      LEFT JOIN schools s ON p.school_code = s.code
      WHERE p.school_code = ? AND p.year = ?
    `;

    const results = await query(sql, [schoolCode, year]);
    return results[0] || null;
  } catch (error) {
    console.error(`Error fetching prediction for school ${schoolCode}:`, error);
    return null;
  }
}

/**
 * 计算预测准确性统计
 */
async function getPredictionStatistics(year) {
  try {
    const sql = `
      SELECT 
        COUNT(*) as totalPredictions,
        SUM(CASE WHEN strategy = 'anomaly-trend' THEN 1 ELSE 0 END) as highConfidence,
        COUNT(DISTINCT CASE WHEN error IS NOT NULL THEN school_code END) as validComparisons,
        ROUND(AVG(ABS(error)), 1) as mae,
        ROUND(SQRT(AVG(error * error)), 1) as rmse,
        SUM(CASE WHEN ABS(error) <= 3 THEN 1 ELSE 0 END) as within3
      FROM predictions
      WHERE year = ? AND error IS NOT NULL
    `;

    const results = await query(sql, [year]);
    const stats = results[0];

    if (stats.validComparisons === 0) {
      return {
        year,
        totalPredictions: stats.totalPredictions,
        highConfidence: stats.highConfidence,
        message: '没有实际数据用于对比'
      };
    }

    return {
      year,
      totalPredictions: stats.totalPredictions,
      highConfidence: stats.highConfidence,
      validComparisons: stats.validComparisons,
      mae: stats.mae,
      rmse: stats.rmse,
      within3: stats.within3,
      within3Percent: parseFloat(((stats.within3 / stats.validComparisons) * 100).toFixed(1))
    };
  } catch (error) {
    console.error('Error calculating statistics:', error);
    return null;
  }
}

export {
  generatePredictions,
  getPredictions,
  getHighConfidencePredictions,
  getSchoolPrediction,
  getPredictionStatistics,
  loadYearSchools,
  loadYearMetadata,
  buildHistoricalData,
  buildYearMetadata
};
