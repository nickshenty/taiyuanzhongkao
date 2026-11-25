import express from 'express';
import {
  getAllPredictions,
  getHighConfidence,
  getSchoolPredictionController,
  getPredictionStats,
  generatePredictionsController,
  getAlgorithmInfo,
  getBacktestResults
} from '../controllers/predictionController.js';

const router = express.Router();

// ==================== 预测路由 ====================

/**
 * 获取指定年份的所有预测
 * GET /api/predictions/:year
 */
router.get('/:year', getAllPredictions);

/**
 * 获取高置信度预测（异常学校）
 * GET /api/predictions/:year/high-confidence
 */
router.get('/:year/high-confidence', getHighConfidence);

/**
 * 获取预测准确性统计
 * GET /api/predictions/:year/statistics
 */
router.get('/:year/statistics', getPredictionStats);

/**
 * 获取单个学校的预测
 * GET /api/predictions/school/:code?year=2024
 */
router.get('/school/:code', getSchoolPredictionController);

/**
 * 生成指定年份的预测
 * POST /api/predictions/generate
 * Body: { year: 2025, referenceYear: 2023 }
 */
router.post('/generate', generatePredictionsController);

// ==================== 算法信息路由 ====================

/**
 * 获取算法说明
 * GET /api/algorithm/info
 */
router.get('/algorithm/info', getAlgorithmInfo);

/**
 * 获取算法回测结果
 * GET /api/algorithm/backtest?year=2024
 */
router.get('/algorithm/backtest', getBacktestResults);

export default router;
