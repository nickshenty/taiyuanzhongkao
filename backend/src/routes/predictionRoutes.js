import express from 'express';
import {
  getAllPredictions,
  getHighConfidence,
  getSchoolPredictionController,
  getPredictionStats,
  generatePredictionsController
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

export default router;
