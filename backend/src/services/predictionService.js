import { predictFromSeries } from '../algorithms/predictionAlgorithmV1.5.js';
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
    console.error(`Error loading schools for year ${year}:`, error.message);
    throw error;
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
    console.error(`Error loading metadata for year ${year}:`, error.message);
    throw error;
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
 * 为指定年份生成预测并写入 predictions 表
 *
 * 与 scripts/generate-predictions-2027.js 共用同一算法函数 predictFromSeries，
 * 保证"脚本离线生成"与"API 在线生成"结果完全一致。
 *
 * 做法：一次性载入全部历史录取线 → 为每所学校构建稀疏锚点序列 →
 *       取最近/次近锚点做间隔归一化动量预测。
 *
 * @param {number} targetYear 目标年
 * @param {object} options
 * @param {boolean} options.dryRun 只算不写库
 */
async function generatePredictions(targetYear, options = {}) {
  const { dryRun = false } = options;

  try {
    console.log(`\n📊 开始为 ${targetYear} 年生成预测...`);

    // 1) 年份框架
    const frameRows = await query(
      'SELECT year, control_line as controlLine, total_score as totalScore FROM years'
    );
    const frames = {};
    for (const r of frameRows) {
      frames[Number(r.year)] = {
        controlLine: Number(r.controlLine),
        totalScore: Number(r.totalScore)
      };
    }
    const frameOf = y => frames[Number(y)] || null;

    // 2) 历史录取线（仅目标年之前）
    const lines = await query(
      `SELECT year, school_code as code, last_line as lastLine
       FROM admission_lines
       WHERE year < ? AND last_line IS NOT NULL`,
      [targetYear]
    );
    const series = {};
    for (const l of lines) {
      const y = Number(l.year);
      (series[l.code] = series[l.code] || {})[y] = Number(l.lastLine);
    }

    // 3) 名单：优先最近年（target-1）有数据的学校
    const prevYear = targetYear - 1;
    const prevFrame = frameOf(prevYear);
    if (!prevFrame) throw new Error(`缺少 ${prevYear} 年框架数据，无法预测`);

    const schoolRows = await query(
      'SELECT code, name FROM schools ORDER BY code'
    );
    const roster = schoolRows
      .filter(r => series[r.code] && series[r.code][prevYear] != null)
      .map(r => ({ code: r.code, name: r.name }));

    if (!roster.length) throw new Error(`${prevYear} 年无录取数据，无法预测`);

    // 4) 目标年框架
    const targetFrame = frameOf(targetYear);
    const frameTarget = targetFrame ?? prevFrame;
    const assumedFrame = !targetFrame;
    if (assumedFrame) {
      console.log(
        `⚠️  ${targetYear} 年总分/控制线未公布，沿用 ${prevYear} 年框架（${frameTarget.controlLine}/${frameTarget.totalScore}）`
      );
    }

    // 5) 逐校预测
    const predictions = [];
    for (const unit of roster) {
      const p = predictFromSeries({
        series: series[unit.code],
        targetYear,
        frameOf,
        frameTarget
      });
      if (!p) continue;
      predictions.push({
        schoolCode: unit.code,
        schoolName: unit.name,
        ...p
      });
    }
    predictions.sort((a, b) => b.predicted - a.predicted);

    console.log(`✅ 生成 ${predictions.length} 条预测`);

    if (dryRun) {
      return {
        success: true,
        year: targetYear,
        count: predictions.length,
        assumedFrame,
        frame: frameTarget,
        dryRun: true,
        preview: predictions.slice(0, 10)
      };
    }

    // 6) 写库
    let savedCount = 0;
    for (const pred of predictions) {
      await query(
        `INSERT INTO predictions
           (year, school_code, predicted_score, strategy, confidence, algorithm_version)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           predicted_score   = VALUES(predicted_score),
           strategy          = VALUES(strategy),
           confidence        = VALUES(confidence),
           algorithm_version = VALUES(algorithm_version)`,
        [
          targetYear,
          pred.schoolCode,
          pred.predicted,
          pred.strategy,
          pred.confidence,
          'v1.5-generalized'
        ]
      );
      savedCount++;
    }

    console.log(`✅ 已写入 ${savedCount} 条预测`);

    return {
      success: true,
      year: targetYear,
      count: predictions.length,
      savedCount,
      assumedFrame,
      frame: frameTarget
    };
  } catch (error) {
    console.error('预测生成失败:', error.message);
    return { success: false, error: error.message };
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
        s.type,
        s.district,
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
    console.error(`Error fetching predictions for year ${year}:`, error.message);
    throw error;
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
        s.type,
        s.district,
        p.predicted_score as predictedScore,
        p.strategy,
        p.confidence,
        p.algorithm_version as algorithmVersion,
        p.created_at as createdAt
      FROM predictions p
      LEFT JOIN schools s ON p.school_code = s.code
      WHERE p.year = ? AND p.confidence = 'high'
      ORDER BY p.predicted_score DESC
    `;

    const results = await query(sql, [year]);
    return results;
  } catch (error) {
    console.error(`Error fetching high confidence predictions:`, error.message);
    throw error;
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
    console.error(`Error fetching prediction for school ${schoolCode}:`, error.message);
    throw error;
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
        SUM(CASE WHEN confidence = 'high' THEN 1 ELSE 0 END) as highConfidence,
        SUM(CASE WHEN confidence = 'medium' THEN 1 ELSE 0 END) as mediumConfidence,
        SUM(CASE WHEN confidence = 'low' THEN 1 ELSE 0 END) as lowConfidence,
        SUM(CASE WHEN strategy = 'relative-position-momentum' THEN 1 ELSE 0 END) as momentumCount,
        COUNT(CASE WHEN error IS NOT NULL THEN 1 END) as validComparisons,
        ROUND(AVG(CASE WHEN error IS NOT NULL THEN ABS(error) END), 1) as mae,
        ROUND(SQRT(AVG(CASE WHEN error IS NOT NULL THEN error * error END)), 1) as rmse,
        SUM(CASE WHEN error IS NOT NULL AND ABS(error) <= 3 THEN 1 ELSE 0 END) as within3
      FROM predictions
      WHERE year = ?
    `;

    const results = await query(sql, [year]);
    const stats = results[0];

    if (!Number(stats.validComparisons)) {
      return {
        year: parseInt(year, 10),
        totalPredictions: Number(stats.totalPredictions),
        highConfidence: Number(stats.highConfidence || 0),
        mediumConfidence: Number(stats.mediumConfidence || 0),
        lowConfidence: Number(stats.lowConfidence || 0),
        validComparisons: 0,
        message: `${year}年尚无实际录取数据，暂无法计算预测误差；已有 ${stats.totalPredictions} 条预测`
      };
    }

    return {
      year: parseInt(year, 10),
      totalPredictions: Number(stats.totalPredictions),
      highConfidence: Number(stats.highConfidence || 0),
      mediumConfidence: Number(stats.mediumConfidence || 0),
      lowConfidence: Number(stats.lowConfidence || 0),
      validComparisons: Number(stats.validComparisons),
      mae: stats.mae,
      rmse: stats.rmse,
      within3: stats.within3,
      within3Percent: parseFloat(((stats.within3 / stats.validComparisons) * 100).toFixed(1))
    };
  } catch (error) {
    console.error('Error calculating statistics:', error.message);
    throw error;
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
