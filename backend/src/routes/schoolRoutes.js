import express from 'express';
import {
  getSchools,
  getSchoolDetail,
  getSchoolHistory,
  getAllSchools,
  getSchoolTypes,
  getDistricts
} from '../controllers/schoolController.js';

const router = express.Router();

/**
 * 获取学校列表（支持搜索、筛选、分页）
 * GET /api/schools?name=&type=&district=&page=1&limit=20
 */
router.get('/', getSchools);

/**
 * 获取所有学校（用于前端选择）
 * GET /api/schools/list/all
 */
router.get('/list/all', getAllSchools);

/**
 * 获取学校类型列表
 * GET /api/schools/types
 */
router.get('/types', getSchoolTypes);

/**
 * 获取学校所在区县列表
 * GET /api/schools/districts
 */
router.get('/districts', getDistricts);

/**
 * 获取学校详情
 * GET /api/schools/:code
 */
router.get('/:code', getSchoolDetail);

/**
 * 获取学校历史分数线
 * GET /api/schools/:code/history
 */
router.get('/:code/history', getSchoolHistory);

export default router;
