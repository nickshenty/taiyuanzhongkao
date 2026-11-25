import {
  getPredictions,
  getHighConfidencePredictions,
  getSchoolPrediction,
  getPredictionStatistics,
  generatePredictions
} from '../services/predictionService.js';

/**
 * 获取指定年份的所有预测
 * GET /api/predictions/:year
 */
async function getAllPredictions(req, res) {
  try {
    const { year } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const predictions = await getPredictions(year);

    // 分页处理
    const offset = (page - 1) * limit;
    const paginatedResults = predictions.slice(offset, offset + limit);

    res.json({
      success: true,
      year: parseInt(year),
      total: predictions.length,
      page,
      limit,
      count: paginatedResults.length,
      data: paginatedResults
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 获取高置信度预测（异常学校）
 * GET /api/predictions/:year/high-confidence
 */
async function getHighConfidence(req, res) {
  try {
    const { year } = req.params;

    const predictions = await getHighConfidencePredictions(year);

    res.json({
      success: true,
      year: parseInt(year),
      count: predictions.length,
      message: '高置信度预测（异常学校）',
      data: predictions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 获取单个学校的预测
 * GET /api/predictions/school/:code?year=2024
 */
async function getSchoolPredictionController(req, res) {
  try {
    const { code } = req.params;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const prediction = await getSchoolPrediction(code, year);

    if (!prediction) {
      return res.status(404).json({
        success: false,
        error: '未找到该学校的预测数据'
      });
    }

    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 获取预测准确性统计
 * GET /api/predictions/:year/statistics
 */
async function getPredictionStats(req, res) {
  try {
    const { year } = req.params;

    const statistics = await getPredictionStatistics(year);

    if (!statistics) {
      return res.status(500).json({
        success: false,
        error: '无法生成统计数据'
      });
    }

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 生成指定年份的预测
 * POST /api/predictions/generate
 */
async function generatePredictionsController(req, res) {
  try {
    const { year, referenceYear } = req.body;

    if (!year) {
      return res.status(400).json({
        success: false,
        error: '必须指定目标年份 (year)'
      });
    }

    const result = await generatePredictions(year, referenceYear || 2023);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.status(201).json({
      success: true,
      message: `成功生成${result.count}条预测`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 获取算法说明
 * GET /api/algorithm/info
 */
async function getAlgorithmInfo(req, res) {
  res.json({
    success: true,
    algorithm: 'v1.5',
    name: '太原中考分数线预测算法v1.5',
    description: '基于异常检测和相对位置保持的分数线预测算法',
    improvements: [
      '识别异常波动学校（2023→2024年度变化≥30分）',
      '异常学校使用趋势外推策略（基于2021→2023年度变化）',
      '正常学校使用相对位置保持策略'
    ],
    anomalySchools: 6,
    strategies: {
      anomaly_trend: '异常学校趋势外推法',
      anomaly_holdover: '异常学校直接保留法',
      normal_relative_position: '正常学校相对位置法',
      failed: '预测失败'
    },
    confidenceLevel: {
      high: '高置信度（异常学校趋势预测）',
      medium: '中置信度（相对位置保持或其他异常）',
      low: '低置信度（数据不完整）'
    }
  });
}

/**
 * 获取算法回测结果
 * GET /api/algorithm/backtest?year=2024
 */
async function getBacktestResults(req, res) {
  try {
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({
        success: false,
        error: '必须指定目标年份 (year)'
      });
    }

    const statistics = await getPredictionStatistics(year);

    if (!statistics) {
      return res.status(500).json({
        success: false,
        error: '无法获取回测数据'
      });
    }

    res.json({
      success: true,
      backtestYear: parseInt(year),
      algorithm: 'v1.5',
      results: statistics,
      interpretation: {
        mae: 'Mean Absolute Error - 平均绝对误差',
        rmse: 'Root Mean Squared Error - 均方根误差',
        within3: '预测误差在3分以内的学校数',
        within3Percent: '预测误差在3分以内的比例'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export {
  getAllPredictions,
  getHighConfidence,
  getSchoolPredictionController,
  getPredictionStats,
  generatePredictionsController,
  getAlgorithmInfo,
  getBacktestResults
};
