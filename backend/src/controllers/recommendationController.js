import {
  generateRecommendations,
  getSchoolRecommendationInfo,
  getSchoolsByScoreRange
} from '../services/recommendationService.js';

/**
 * 生成志愿推荐方案（核心API）
 * POST /api/recommendations
 * Body: {
 *   studentScore: 650,
 *   juniorSchoolId: 1,
 *   targetYear: 2027
 * }
 */
async function getRecommendations(req, res) {
  try {
    const { studentScore, juniorSchoolId, targetYear } = req.body;

    // 参数验证
    if (!studentScore || !juniorSchoolId || !targetYear) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：studentScore, juniorSchoolId, targetYear'
      });
    }

    if (typeof studentScore !== 'number' || studentScore < 0 || studentScore > 840) {
      return res.status(400).json({
        success: false,
        error: '考生分数应为0-840之间的数字'
      });
    }

    const recommendations = await generateRecommendations(
      studentScore,
      juniorSchoolId,
      targetYear
    );

    if (!recommendations.success) {
      return res.status(400).json(recommendations);
    }

    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 获取学校推荐信息
 * GET /api/recommendations/school/:code?studentScore=650&year=2027
 */
async function getSchoolRecommendation(req, res) {
  try {
    const { code } = req.params;
    const { studentScore, year } = req.query;

    if (!studentScore || !year) {
      return res.status(400).json({
        success: false,
        error: '缺少参数：studentScore, year'
      });
    }

    const recommendation = await getSchoolRecommendationInfo(
      code,
      parseInt(year),
      parseInt(studentScore)
    );

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        error: '学校不存在'
      });
    }

    res.json({
      success: true,
      data: recommendation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 根据分数范围获取推荐学校
 * GET /api/recommendations/score-range?minScore=600&maxScore=700&year=2027
 */
async function getSchoolsByScore(req, res) {
  try {
    const { minScore, maxScore, year } = req.query;

    if (!minScore || !maxScore || !year) {
      return res.status(400).json({
        success: false,
        error: '缺少参数：minScore, maxScore, year'
      });
    }

    const result = await getSchoolsByScoreRange(
      parseInt(minScore),
      parseInt(maxScore),
      parseInt(year)
    );

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 获取推荐系统说明
 * GET /api/recommendations/info
 */
async function getRecommendationInfo(req, res) {
  res.json({
    success: true,
    system: 'AI志愿推荐系统',
    algorithm: 'v1.5预测算法',
    recommendations: {
      risky: {
        name: '冲一冲',
        description: '分数低于预测5-10分，风险较大但可尝试',
        maxCount: 3
      },
      stable: {
        name: '稳一稳',
        description: '分数接近预测（±5分以内），录取概率较大',
        maxCount: 2
      },
      safe: {
        name: '保一保',
        description: '分数高于预测10分以上，录取概率较高',
        maxCount: 2
      }
    },
    factors: [
      '学生中考分数',
      '就读初中学校（影响定向名额）',
      '目标年份预测分数线',
      '学校类型和地区',
      '历史分数线趋势'
    ],
    tips: [
      '冲一冲：风险较大，但如果录取得到心仪学校',
      '稳一稳：综合考虑，根据去年分数线选择',
      '保一保：作为备选方案，确保有学校就读'
    ]
  });
}

export {
  getRecommendations,
  getSchoolRecommendation,
  getSchoolsByScore,
  getRecommendationInfo
};
