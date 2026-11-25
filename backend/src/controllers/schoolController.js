import { query } from '../config/database.js';

/**
 * 获取学校列表（支持搜索、筛选、分页）
 * GET /api/schools?name=&type=&district=&page=1&limit=20
 */
async function getSchools(req, res) {
  try {
    const { name, type, district, page = 1, limit = 20 } = req.query;

    let sql = 'SELECT code, name, type, district FROM schools WHERE 1=1';
    const params = [];

    // 按名称搜索
    if (name) {
      sql += ' AND name LIKE ?';
      params.push(`%${name}%`);
    }

    // 按类型筛选
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    // 按区县筛选
    if (district) {
      sql += ' AND district = ?';
      params.push(district);
    }

    sql += ' ORDER BY code';

    // 获取总数
    const countResult = await query(`SELECT COUNT(*) as total FROM schools WHERE 1=1 ${
      name ? 'AND name LIKE ?' : ''
    } ${type ? 'AND type = ?' : ''} ${district ? 'AND district = ?' : ''}`, params);
    const total = countResult[0].total;

    // 分页（LIMIT/OFFSET 使用已校验整数直拼，避免 mysql2 预处理限制）
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
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
 * 获取学校详情
 * GET /api/schools/:code
 */
async function getSchoolDetail(req, res) {
  try {
    const { code } = req.params;

    const sql = 'SELECT code, name, type, district FROM schools WHERE code = ?';
    const schools = await query(sql, [code]);

    if (schools.length === 0) {
      return res.status(404).json({
        success: false,
        error: '学校不存在'
      });
    }

    res.json({
      success: true,
      data: schools[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 获取学校历史分数线
 * GET /api/schools/:code/history
 */
async function getSchoolHistory(req, res) {
  try {
    const { code } = req.params;

    // 获取学校信息
    const schoolSql = 'SELECT code, name FROM schools WHERE code = ?';
    const schools = await query(schoolSql, [code]);

    if (schools.length === 0) {
      return res.status(404).json({
        success: false,
        error: '学校不存在'
      });
    }

    // 获取历史分数线
    const historySql = `
      SELECT 
        a.year,
        a.last_line as lastLine,
        a.quota_line as quotaLine,
        a.batch,
        a.plan_count as planCount,
        a.actual_count as actualCount,
        y.control_line as controlLine,
        y.total_score as totalScore
      FROM admission_lines a
      LEFT JOIN years y ON a.year = y.year
      WHERE a.school_code = ?
      ORDER BY a.year DESC
    `;
    const history = await query(historySql, [code]);

    // 获取预测信息
    const predictionSql = `
      SELECT 
        year,
        predicted_score as predictedScore,
        strategy,
        confidence
      FROM predictions
      WHERE school_code = ?
      ORDER BY year DESC
      LIMIT 5
    `;
    const predictions = await query(predictionSql, [code]);

    res.json({
      success: true,
      school: schools[0],
      history: history,
      predictions: predictions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 获取所有学校（用于前端选择）
 * GET /api/schools/list/all
 */
async function getAllSchools(req, res) {
  try {
    const sql = 'SELECT code, name, district FROM schools ORDER BY code';
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
 * 获取学校类型列表
 * GET /api/schools/types
 */
async function getSchoolTypes(req, res) {
  try {
    const sql = 'SELECT DISTINCT type FROM schools WHERE type IS NOT NULL ORDER BY type';
    const types = await query(sql, []);

    res.json({
      success: true,
      data: types.map(t => t.type)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 获取学校所在区县列表
 * GET /api/schools/districts
 */
async function getDistricts(req, res) {
  try {
    const sql = 'SELECT DISTINCT district FROM schools WHERE district IS NOT NULL ORDER BY district';
    const districts = await query(sql, []);

    res.json({
      success: true,
      data: districts.map(d => d.district)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export {
  getSchools,
  getSchoolDetail,
  getSchoolHistory,
  getAllSchools,
  getSchoolTypes,
  getDistricts
};
