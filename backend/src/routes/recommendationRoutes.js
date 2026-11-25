import express from 'express';
import {
  getRecommendations,
  getSchoolRecommendation,
  getSchoolsByScore,
  getRecommendationInfo
} from '../controllers/recommendationController.js';

const router = express.Router();

/**
 * 获取推荐系统说明
 * GET /api/recommendations/info
 */
router.get('/info', getRecommendationInfo);

/**
 * 生成志愿推荐方案（核心API）
 * POST /api/recommendations
 * Body: {
 *   studentScore: 650,
 *   juniorSchoolId: 1,
 *   targetYear: 2027
 * }
 */
router.post('/', getRecommendations);

/**
 * 根据分数范围获取推荐学校
 * GET /api/recommendations/score-range?minScore=600&maxScore=700&year=2027
 */
router.get('/score-range', getSchoolsByScore);

/**
 * 获取学校推荐信息
 * GET /api/recommendations/school/:code?studentScore=650&year=2027
 */
router.get('/school/:code', getSchoolRecommendation);

export default router;
