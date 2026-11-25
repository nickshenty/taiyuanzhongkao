import { query } from '../config/database.js';

/**
 * 志愿推荐服务
 * 核心功能：根据考生分数、就读初中、目标年份生成填报方案
 */

/**
 * 推荐等级定义
 */
// 定向生录取线下调上限（太原市规则：控制在统招线下50分以内，且不低于最低控制线）
const QUOTA_MAX_DOWNGRADE = 50;

const RECOMMENDATION_LEVELS = {
  RISKY: 'risky',      // 冲一冲：分数低于预测5-10分
  STABLE: 'stable',    // 稳一稳：接近预测分数（±5分以内）
  SAFE: 'safe'         // 保一保：分数高于预测10分以上
};

/**
 * 计算推荐等级
 */
function calculateRecommendationLevel(studentScore, predictedScore) {
  if (!predictedScore) return null;

  const diff = studentScore - predictedScore;

  if (diff >= 10) {
    return RECOMMENDATION_LEVELS.SAFE;
  } else if (diff >= -5) {
    return RECOMMENDATION_LEVELS.STABLE;
  } else if (diff >= -10) {
    return RECOMMENDATION_LEVELS.RISKY;
  }

  return null; // 分数过低
}

/**
 * 获取学校推荐信息
 */
async function getSchoolRecommendationInfo(schoolCode, year, studentScore) {
  try {
    // 获取学校基本信息
    const schoolSql = 'SELECT code, name, type, district FROM schools WHERE code = ?';
    const schools = await query(schoolSql, [schoolCode]);

    if (schools.length === 0) return null;

    const school = schools[0];

    // 获取该年份的预测分数
    const predictionSql = `
      SELECT 
        predicted_score as predictedScore,
        strategy,
        confidence
      FROM predictions
      WHERE school_code = ? AND year = ?
    `;
    const predictions = await query(predictionSql, [schoolCode, year]);

    const prediction = predictions.length > 0 ? predictions[0] : null;
    const predictedScore = prediction?.predictedScore;

    // 计算推荐等级
    const level = calculateRecommendationLevel(studentScore, predictedScore);

    // 获取历史分数线（用于参考）
    const historySql = `
      SELECT 
        year,
        last_line as lastLine
      FROM admission_lines
      WHERE school_code = ?
      ORDER BY year DESC
      LIMIT 3
    `;
    const history = await query(historySql, [schoolCode]);

    return {
      schoolCode: school.code,
      schoolName: school.name,
      type: school.type,
      district: school.district,
      studentScore,
      predictedScore: predictedScore || null,
      level: level,
      strategy: prediction?.strategy || null,
      confidence: prediction?.confidence || null,
      scoreDiff: predictedScore ? studentScore - predictedScore : null,
      history: history,
      levelName: level ? getLevelName(level) : '分数过低'
    };
  } catch (error) {
    console.error('Error getting school recommendation:', error);
    return null;
  }
}

/**
 * 获取推荐等级的中文名称
 */
function getLevelName(level) {
  const names = {
    [RECOMMENDATION_LEVELS.RISKY]: '冲一冲',
    [RECOMMENDATION_LEVELS.STABLE]: '稳一稳',
    [RECOMMENDATION_LEVELS.SAFE]: '保一保'
  };
  return names[level] || '未知';
}

/**
 * 纯函数：判定单所学校的推荐档位（不依赖数据库，便于单测）
 *
 * 规则（依据用户业务定义）：
 *   - 保一保 safe   ：考生分数 ≥ 预测线 + 10
 *   - 稳一稳 stable ：预测线 -5 ≤ 考生分数 < 预测线 + 10
 *   - 冲一冲 risky  ：预测线 -10 ≤ 考生分数 < 预测线 - 5
 *   - 定向修正      ：本校有定向名额且考生分数 ≥ 预测线 - 50 时，
 *                     统招无望也可通过定向录取，按"冲"档计入并标记 quotaUpgraded
 *
 * @returns {{level:string|null, quotaUpgraded:boolean, quotaLineEstimate:number|null, scoreDiff:number}}
 */
function classifySchool({ studentScore, predictedScore, hasQuota, controlLine = 0 }) {
  const scoreDiff = studentScore - predictedScore;
  let level = calculateRecommendationLevel(studentScore, predictedScore);
  let quotaUpgraded = false;

  const quotaLineEstimate = hasQuota
    ? Math.max(predictedScore - QUOTA_MAX_DOWNGRADE, controlLine)
    : null;

  if (hasQuota && scoreDiff >= -QUOTA_MAX_DOWNGRADE) {
    if (!level) {
      level = RECOMMENDATION_LEVELS.RISKY;
      quotaUpgraded = true;
    } else if (level === RECOMMENDATION_LEVELS.RISKY) {
      quotaUpgraded = true;
    }
  }

  return { level, quotaUpgraded, quotaLineEstimate, scoreDiff };
}

/**
 * 生成志愿推荐方案
 */
async function generateRecommendations(studentScore, juniorSchoolId, targetYear) {
  try {
    // 验证目标年份
    const yearSql = 'SELECT year FROM years WHERE year = ?';
    const yearResults = await query(yearSql, [targetYear]);

    if (yearResults.length === 0) {
      return {
        success: false,
        error: '目标年份不存在'
      };
    }

    // 获取初中学校信息
    const juniorSql = 'SELECT id, name, district FROM junior_schools WHERE id = ?';
    const juniorResults = await query(juniorSql, [juniorSchoolId]);

    if (juniorResults.length === 0) {
      return {
        success: false,
        error: '初中学校不存在'
      };
    }

    const juniorSchool = juniorResults[0];

    // 获取该初中的定向名额。
    // 注意：定向到校名额每年中考招生计划公布后才有（如2027年名额要到2027年才发布），
    // 因此目标年无数据时回退到"最近一个有名额数据的年份"，并在返回中标注。
    let quotaYearUsed = targetYear;
    let quotas = await query(
      `SELECT qa.senior_school_code as schoolCode,
              s.name as schoolName,
              qa.quota_count as quotaCount
       FROM quota_allocations qa
       LEFT JOIN schools s ON qa.senior_school_code = s.code
       WHERE qa.junior_school_id = ? AND qa.year = ?`,
      [juniorSchoolId, targetYear]
    );

    if (quotas.length === 0) {
      const latest = await query(
        `SELECT MAX(year) as y FROM quota_allocations WHERE junior_school_id = ?`,
        [juniorSchoolId]
      );
      const y = latest[0]?.y;
      if (y) {
        quotaYearUsed = y;
        quotas = await query(
          `SELECT qa.senior_school_code as schoolCode,
                  s.name as schoolName,
                  qa.quota_count as quotaCount
           FROM quota_allocations qa
           LEFT JOIN schools s ON qa.senior_school_code = s.code
           WHERE qa.junior_school_id = ? AND qa.year = ?`,
          [juniorSchoolId, y]
        );
      }
    }

    const quotaSchoolCodes = new Set(quotas.map(q => q.schoolCode));

    // 目标年最低录取控制线（定向生线不得低于此线）
    const ctrlRow = await query('SELECT control_line as c FROM years WHERE year = ?', [targetYear]);
    const controlLineUsed = ctrlRow[0]?.c ?? 0;

    // 获取所有学校及预测分数
    const schoolsSql = `
      SELECT 
        s.code,
        s.name,
        s.type,
        s.district,
        p.predicted_score as predictedScore,
        p.strategy,
        p.confidence
      FROM schools s
      LEFT JOIN predictions p ON s.code = p.school_code AND p.year = ?
      WHERE p.predicted_score IS NOT NULL
      ORDER BY p.predicted_score DESC
    `;
    const schools = await query(schoolsSql, [targetYear]);

    // 分类推荐
    const recommendations = {
      risky: [],    // 冲一冲：分数低于预测5-10分
      stable: [],   // 稳一稳：接近预测分数
      safe: []      // 保一保：分数高于预测10分以上
    };

    for (const school of schools) {
      const hasQuota = quotaSchoolCodes.has(school.code);

      const { level, quotaUpgraded, quotaLineEstimate, scoreDiff } = classifySchool({
        studentScore,
        predictedScore: school.predictedScore,
        hasQuota,
        controlLine: controlLineUsed
      });

      if (!level) continue; // 统招与定向均无可能，跳过

      const recommendation = {
        schoolCode: school.code,
        schoolName: school.name,
        type: school.type,
        district: school.district,
        predictedScore: school.predictedScore,
        studentScore: studentScore,
        scoreDiff,
        strategy: school.strategy,
        confidence: school.confidence,
        hasDirectedQuota: hasQuota,
        // 通过定向名额获得的机会（统招分数不够，但定向可能够）
        quotaUpgraded,
        quotaLineEstimate,
        levelName: getLevelName(level)
      };

      if (level === RECOMMENDATION_LEVELS.RISKY) {
        recommendations.risky.push(recommendation);
      } else if (level === RECOMMENDATION_LEVELS.STABLE) {
        recommendations.stable.push(recommendation);
      } else if (level === RECOMMENDATION_LEVELS.SAFE) {
        recommendations.safe.push(recommendation);
      }
    }

    // 按分数排序（冲一冲从低到高，其他从高到低）
    recommendations.risky.sort((a, b) => {
      // 纯统招可冲的优先，其次才是依赖定向名额的
      if (a.quotaUpgraded !== b.quotaUpgraded) return a.quotaUpgraded ? 1 : -1;
      return a.predictedScore - b.predictedScore;
    });
    recommendations.stable.sort((a, b) => b.predictedScore - a.predictedScore);
    recommendations.safe.sort((a, b) => b.predictedScore - a.predictedScore);

    // 限制每档的推荐数量
    recommendations.risky = recommendations.risky.slice(0, 3);
    recommendations.stable = recommendations.stable.slice(0, 2);
    recommendations.safe = recommendations.safe.slice(0, 2);

    return {
      success: true,
      studentScore,
      targetYear,
      juniorSchool: {
        id: juniorSchool.id,
        name: juniorSchool.name,
        district: juniorSchool.district
      },
      recommendations,
      totalRecommendations:
        recommendations.risky.length + recommendations.stable.length + recommendations.safe.length,
      quotaYearUsed,
      quotaIsProjection: quotaYearUsed !== targetYear,
      quotaNote:
        quotaYearUsed !== targetYear
          ? `${targetYear}年定向到校名额尚未公布，定向判断暂按${quotaYearUsed}年名额估算，请以当年官方计划为准。`
          : undefined,
      tips: generateTips(studentScore, recommendations)
    };
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 生成填报建议
 */
function generateTips(studentScore, recommendations) {
  const tips = [];

  if (recommendations.risky.length > 0) {
    tips.push(`"冲一冲"推荐 ${recommendations.risky.length} 所学校 - 这些学校预测分数高于你的分数，风险较大但可尝试`);
  }

  if (recommendations.stable.length > 0) {
    tips.push(`"稳一稳"推荐 ${recommendations.stable.length} 所学校 - 这些学校预测分数与你的分数接近，录取概率较大`);
  }

  if (recommendations.safe.length > 0) {
    tips.push(`"保一保"推荐 ${recommendations.safe.length} 所学校 - 这些学校预测分数低于你的分数，录取概率较高`);
  }

  if (recommendations.risky.length === 0 && recommendations.stable.length === 0 && recommendations.safe.length === 0) {
    tips.push('暂无推荐 - 你的分数可能低于所有学校的最低预测分数');
  }

  return tips;
}

/**
 * 根据分数范围获取推荐学校
 */
async function getSchoolsByScoreRange(minScore, maxScore, targetYear) {
  try {
    const sql = `
      SELECT 
        s.code,
        s.name,
        s.type,
        s.district,
        p.predicted_score as predictedScore,
        p.strategy,
        p.confidence
      FROM schools s
      LEFT JOIN predictions p ON s.code = p.school_code AND p.year = ?
      WHERE p.predicted_score BETWEEN ? AND ?
      ORDER BY p.predicted_score DESC
    `;

    const schools = await query(sql, [targetYear, minScore, maxScore]);

    return {
      success: true,
      scoreRange: { minScore, maxScore },
      count: schools.length,
      data: schools
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export {
  generateRecommendations,
  getSchoolRecommendationInfo,
  getSchoolsByScoreRange,
  calculateRecommendationLevel,
  classifySchool,
  getLevelName,
  RECOMMENDATION_LEVELS,
  QUOTA_MAX_DOWNGRADE
};
