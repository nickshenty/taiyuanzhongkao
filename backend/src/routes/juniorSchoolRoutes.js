import express from 'express';
import {
  getJuniorSchools,
  getAllJuniorSchools,
  getJuniorSchoolQuotas,
  getJuniorSchoolQuotasHistory
} from '../controllers/juniorSchoolController.js';

const router = express.Router();

/**
 * 获取初中学校列表（支持搜索、筛选、分页）
 * GET /api/junior-schools?name=&district=&page=1&limit=50
 */
router.get('/', getJuniorSchools);

/**
 * 获取初中学校列表（用于前端选择）
 * GET /api/junior-schools/list/all
 */
router.get('/list/all', getAllJuniorSchools);

/**
 * 获取初中学校的定向名额信息
 * GET /api/junior-schools/:id/quotas?year=2027
 */
router.get('/:id/quotas', getJuniorSchoolQuotas);

/**
 * 获取初中学校的所有年份定向名额
 * GET /api/junior-schools/:id/quotas/history
 */
router.get('/:id/quotas/history', getJuniorSchoolQuotasHistory);

export default router;
