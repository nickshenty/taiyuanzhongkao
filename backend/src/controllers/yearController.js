import { query } from '../config/database.js';

/**
 * 获取所有年份信息
 * GET /api/years
 */
async function getYears(req, res) {
  try {
    const sql = 'SELECT year, control_line as controlLine, total_score as totalScore, data_status as dataStatus FROM years ORDER BY year DESC';
    const years = await query(sql, []);

    res.json({
      success: true,
      count: years.length,
      data: years
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 获取年份详情
 * GET /api/years/:year
 */
async function getYearDetail(req, res) {
  try {
    const { year } = req.params;

    const sql = 'SELECT year, control_line as controlLine, total_score as totalScore, data_status as dataStatus FROM years WHERE year = ?';
    const years = await query(sql, [year]);

    if (years.length === 0) {
      return res.status(404).json({
        success: false,
        error: '年份数据不存在'
      });
    }

    const yearData = years[0];

    // 获取该年份的学校统计
    const statsSql = `
      SELECT 
        COUNT(DISTINCT a.school_code) as schoolCount,
        MIN(a.last_line) as minScore,
        MAX(a.last_line) as maxScore,
        ROUND(AVG(a.last_line), 1) as avgScore
      FROM admission_lines a
      WHERE a.year = ?
    `;
    const stats = await query(statsSql, [year]);

    res.json({
      success: true,
      data: {
        ...yearData,
        statistics: stats[0]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 获取最新的预测年份
 * GET /api/years/latest/prediction
 */
async function getLatestPredictionYear(req, res) {
  try {
    const sql = `
      SELECT DISTINCT year
      FROM predictions
      ORDER BY year DESC
      LIMIT 1
    `;
    const results = await query(sql, []);

    if (results.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: '暂无预测数据'
      });
    }

    res.json({
      success: true,
      data: results[0].year
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 获取年份的所有学校及预测分数
 * GET /api/years/:year/schools
 */
async function getYearSchools(req, res) {
  try {
    const { year } = req.params;
    const { type = 'all' } = req.query;

    // 检查年份是否存在
    const yearSql = 'SELECT year FROM years WHERE year = ?';
    const yearCheck = await query(yearSql, [year]);

    if (yearCheck.length === 0) {
      return res.status(404).json({
        success: false,
        error: '年份数据不存在'
      });
    }

    // 获取学校及其分数线
    let sql = `
      SELECT 
        s.code,
        s.name,
        s.type,
        s.district,
        a.last_line as lastLine,
        a.quota_line as quotaLine,
        a.batch,
        a.plan_count as planCount,
        p.predicted_score as predictedScore,
        p.strategy,
        p.confidence
      FROM schools s
      LEFT JOIN admission_lines a ON s.code = a.school_code AND a.year = ?
      LEFT JOIN predictions p ON s.code = p.school_code AND p.year = ?
      WHERE (a.last_line IS NOT NULL OR a.quota_line IS NOT NULL OR p.predicted_score IS NOT NULL)
    `;
    const params = [year, year];

    // 按类型筛选
    if (type !== 'all') {
      sql += ' AND s.type = ?';
      params.push(type);
    }

    sql += ' ORDER BY s.code';

    const rawSchools = await query(sql, params);
    const schools = rawSchools.map(x => ({
      ...x,
      lastLine: x.lastLine == null ? null : Number(x.lastLine),
      quotaLine: x.quotaLine == null ? null : Number(x.quotaLine)
    }));

    res.json({
      success: true,
      year: parseInt(year),
      count: schools.length,
      type: type,
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
 * 获取批次配置
 * GET /api/years/:year/batches
 */
async function getYearBatches(req, res) {
  try {
    const { year } = req.params;

    const sql = `
      SELECT 
        id,
        year,
        batch_code as batchCode,
        batch_name as batchName,
        sort_order as sortOrder,
        max_schools as maxSchools
      FROM batches
      WHERE year = ?
      ORDER BY sort_order
    `;

    const batches = await query(sql, [year]);

    res.json({
      success: true,
      year: parseInt(year),
      count: batches.length,
      data: batches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export {
  getYears,
  getYearDetail,
  getLatestPredictionYear,
  getYearSchools,
  getYearBatches
};
