import { query } from '../config/database.js';

/**
 * 获取所有初中学校（支持搜索）
 * GET /api/junior-schools?name=&district=&page=1&limit=50
 */
async function getJuniorSchools(req, res) {
  try {
    const { name, district, page = 1, limit = 50 } = req.query;

    let sql = 'SELECT id, name, district FROM junior_schools WHERE 1=1';
    const params = [];

    // 按名称搜索
    if (name) {
      sql += ' AND name LIKE ?';
      params.push(`%${name}%`);
    }

    // 按区县筛选
    if (district) {
      sql += ' AND district = ?';
      params.push(district);
    }

    sql += ' ORDER BY id';

    // 获取总数
    const countSql = `SELECT COUNT(*) as total FROM junior_schools WHERE 1=1 ${
      name ? 'AND name LIKE ?' : ''
    } ${district ? 'AND district = ?' : ''}`;
    const countResult = await query(countSql, params);
    const total = countResult[0].total;

    // 分页（LIMIT/OFFSET 使用已校验整数直拼，避免 mysql2 预处理限制）
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (safePage - 1) * safeLimit;
    sql += ` LIMIT ${safeLimit} OFFSET ${offset}`;

    const schools = await query(sql, params);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      count: schools.length,
      data: schools
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 获取初中学校列表（用于前端选择）
 * GET /api/junior-schools/list/all
 */
async function getAllJuniorSchools(req, res) {
  try {
    const sql = 'SELECT id, name, district FROM junior_schools ORDER BY id';
    const schools = await query(sql, []);

    // 按区县分组
    const grouped = {};
    schools.forEach(school => {
      const district = school.district || '其他';
      if (!grouped[district]) {
        grouped[district] = [];
      }
      grouped[district].push(school);
    });

    res.json({
      success: true,
      total: schools.length,
      grouped: grouped,
      data: schools
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 获取初中学校的定向名额信息
 * GET /api/junior-schools/:id/quotas?year=2027
 */
async function getJuniorSchoolQuotas(req, res) {
  try {
    const { id } = req.params;
    const { year = new Date().getFullYear() } = req.query;

    // 获取初中学校信息
    const juniorSql = 'SELECT id, name, district FROM junior_schools WHERE id = ?';
    const juniorSchools = await query(juniorSql, [id]);

    if (juniorSchools.length === 0) {
      return res.status(404).json({
        success: false,
        error: '初中学校不存在'
      });
    }

    // 获取定向名额分配
    const quotasSql = `
      SELECT 
        qa.senior_school_code as seniorSchoolCode,
        s.name as seniorSchoolName,
        qa.quota_count as quotaCount
      FROM quota_allocations qa
      LEFT JOIN schools s ON qa.senior_school_code = s.code
      WHERE qa.junior_school_id = ? AND qa.year = ?
      ORDER BY qa.quota_count DESC
    `;
    const quotas = await query(quotasSql, [id, year]);

    res.json({
      success: true,
      year: parseInt(year),
      juniorSchool: juniorSchools[0],
      quotas: quotas,
      totalQuotas: quotas.reduce((sum, q) => sum + q.quotaCount, 0)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 获取初中学校的所有年份定向名额
 * GET /api/junior-schools/:id/quotas/history
 */
async function getJuniorSchoolQuotasHistory(req, res) {
  try {
    const { id } = req.params;

    // 获取初中学校信息
    const juniorSql = 'SELECT id, name, district FROM junior_schools WHERE id = ?';
    const juniorSchools = await query(juniorSql, [id]);

    if (juniorSchools.length === 0) {
      return res.status(404).json({
        success: false,
        error: '初中学校不存在'
      });
    }

    // 获取所有年份的定向名额
    const historySql = `
      SELECT 
        qa.year,
        qa.senior_school_code as seniorSchoolCode,
        s.name as seniorSchoolName,
        qa.quota_count as quotaCount
      FROM quota_allocations qa
      LEFT JOIN schools s ON qa.senior_school_code = s.code
      WHERE qa.junior_school_id = ?
      ORDER BY qa.year DESC, qa.quota_count DESC
    `;
    const history = await query(historySql, [id]);

    // 按年份分组
    const grouped = {};
    history.forEach(record => {
      if (!grouped[record.year]) {
        grouped[record.year] = [];
      }
      grouped[record.year].push({
        seniorSchoolCode: record.seniorSchoolCode,
        seniorSchoolName: record.seniorSchoolName,
        quotaCount: record.quotaCount
      });
    });

    res.json({
      success: true,
      juniorSchool: juniorSchools[0],
      quotasByYear: grouped
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export {
  getJuniorSchools,
  getAllJuniorSchools,
  getJuniorSchoolQuotas,
  getJuniorSchoolQuotasHistory
};
