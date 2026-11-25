import express from 'express';
import {
  getYears,
  getYearDetail,
  getLatestPredictionYear,
  getYearSchools,
  getYearBatches
} from '../controllers/yearController.js';

const router = express.Router();

/**
 * 获取所有年份信息
 * GET /api/years
 */
router.get('/', getYears);

/**
 * 获取最新的预测年份
 * GET /api/years/latest/prediction
 */
router.get('/latest/prediction', getLatestPredictionYear);

/**
 * 获取年份详情
 * GET /api/years/:year
 */
router.get('/:year', getYearDetail);

/**
 * 获取年份的所有学校及预测分数
 * GET /api/years/:year/schools
 */
router.get('/:year/schools', getYearSchools);

/**
 * 获取批次配置
 * GET /api/years/:year/batches
 */
router.get('/:year/batches', getYearBatches);

export default router;
