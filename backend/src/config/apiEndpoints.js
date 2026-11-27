/**
 * API 端点定义（唯一事实来源）
 *
 * 供两处使用：
 *   1. GET /     → HTML 文档页（docs/apiDocsHtml.js 渲染）
 *   2. GET /api  → JSON 索引
 * 新增或修改接口时只需改这里，避免文档与实现脱节。
 *
 * 字段说明：
 *   method    HTTP 方法
 *   path      路径（含 :param 占位）
 *   desc      一句话说明
 *   params    查询参数说明（可选）
 *   body      POST 请求体示例（可选）
 *   returns   返回结构简述（可选）
 */

export const API_GROUPS = [
  {
    title: '基础',
    icon: 'i',
    items: [
      { method: 'GET', path: '/health', desc: '健康检查，返回服务状态与时间戳' },
      { method: 'GET', path: '/api', desc: '端点索引（JSON 版）' }
    ]
  },
  {
    title: '年份',
    icon: 'y',
    items: [
      {
        method: 'GET',
        path: '/api/years',
        desc: '所有年份，含中考总分与最低控制线',
        returns: '{ success, count, data: [{ year, controlLine, totalScore, dataStatus }] }'
      },
      {
        method: 'GET',
        path: '/api/years/:year',
        desc: '年份详情 + 该年学校统计',
        params: { year: '年份，如 2026' }
      },
      {
        method: 'GET',
        path: '/api/years/:year/schools',
        desc: '该年全部学校及对应预测分数',
        params: { year: '年份', type: '学校类型筛选，默认 all' }
      },
      {
        method: 'GET',
        path: '/api/years/:year/batches',
        desc: '该年志愿批次配置'
      },
      {
        method: 'GET',
        path: '/api/years/latest/prediction',
        desc: '返回最新有预测数据的年份'
      }
    ]
  },
  {
    title: '学校',
    icon: 's',
    items: [
      {
        method: 'GET',
        path: '/api/schools',
        desc: '学校列表，支持搜索与分页',
        params: {
          name: '校名模糊搜索',
          type: '学校类型',
          district: '区县',
          page: '页码，默认 1',
          limit: '每页条数，默认 20',
          includeLegacy: '为 true 时包含历史代码'
        }
      },
      { method: 'GET', path: '/api/schools/list/all', desc: '全部当前在用学校（按区县分组）' },
      { method: 'GET', path: '/api/schools/types', desc: '学校类型枚举' },
      { method: 'GET', path: '/api/schools/districts', desc: '区县枚举' },
      {
        method: 'GET',
        path: '/api/schools/:code',
        desc: '学校基础信息',
        params: { code: '学校代码，如 65028' }
      },
      {
        method: 'GET',
        path: '/api/schools/:code/history',
        desc: '历年录取线、定向线、分志愿线、招生计划与预测',
        params: { code: '学校代码' },
        returns: '{ success, school, history: [{ year, lastLine, quotaLine, choiceLines, planCount, controlLine, totalScore }], predictions: [...] }'
      }
    ]
  },
  {
    title: '初中与定向名额',
    icon: 'j',
    items: [
      {
        method: 'GET',
        path: '/api/junior-schools',
        desc: '初中学校列表',
        params: { name: '校名搜索', district: '区县', page: '页码', limit: '每页条数' }
      },
      { method: 'GET', path: '/api/junior-schools/list/all', desc: '全部初中学校（按区县分组）' },
      {
        method: 'GET',
        path: '/api/junior-schools/:id/quotas',
        desc: '该初中的定向名额分配',
        params: { id: '初中学校 ID，如 junior_001', year: '年份' }
      },
      {
        method: 'GET',
        path: '/api/junior-schools/:id/quotas/history',
        desc: '该初中历年定向名额'
      }
    ]
  },
  {
    title: '预测',
    icon: 'p',
    items: [
      {
        method: 'GET',
        path: '/api/predictions/:year',
        desc: '该年所有学校预测线，按分数降序',
        params: { year: '目标年份，如 2027', page: '页码', limit: '每页条数' },
        returns: '{ success, year, total, page, limit, data: [{ schoolCode, schoolName, type, district, predictedScore, strategy, confidence }] }'
      },
      {
        method: 'GET',
        path: '/api/predictions/:year/high-confidence',
        desc: '仅返回高置信度预测'
      },
      {
        method: 'GET',
        path: '/api/predictions/:year/statistics',
        desc: '预测统计与置信度分布',
        returns: '{ success, data: { totalPredictions, highConfidence, mediumConfidence, lowConfidence, mae, rmse } }'
      },
      {
        method: 'GET',
        path: '/api/predictions/school/:code',
        desc: '单所学校的预测',
        params: { code: '学校代码', year: '年份' }
      },
      {
        method: 'POST',
        path: '/api/predictions/generate',
        desc: '在线生成指定年份的预测并写库',
        body: { year: 2028, dryRun: true },
        returns: 'dryRun 为 true 时只返回前 10 条预览，不写库'
      }
    ]
  },
  {
    title: '志愿推荐（核心）',
    icon: 'r',
    items: [
      {
        method: 'POST',
        path: '/api/recommendations',
        desc: '按分数与就读初中生成冲 / 稳 / 保三档推荐',
        body: { studentScore: 700, juniorSchoolId: 'junior_001', targetYear: 2027 },
        returns:
          '{ success, data: { studentScore, juniorSchool, recommendations: { risky, stable, safe }, quotaNote, tips } }'
      },
      { method: 'GET', path: '/api/recommendations/info', desc: '推荐规则说明（档位定义、数量上限）' },
      {
        method: 'GET',
        path: '/api/recommendations/score-range',
        desc: '按分数区间查询学校',
        params: { minScore: '最低分', maxScore: '最高分', year: '年份' }
      },
      {
        method: 'GET',
        path: '/api/recommendations/school/:code',
        desc: '某校与考生分数的匹配度',
        params: { code: '学校代码', studentScore: '考生分数', year: '年份' }
      }
    ]
  },
  {
    title: '算法',
    icon: 'a',
    items: [
      {
        method: 'GET',
        path: '/api/algorithm/info',
        desc: '算法说明、公式、参数与历年回测',
        returns: '{ success, name, version, summary, formula, parameters, highlights, backtest }'
      },
      {
        method: 'GET',
        path: '/api/algorithm/backtest',
        desc: '历年回测结果（MAE、准确率）',
        params: { year: '只取某一年（可选）' },
        returns: '{ success, algorithm, note, years: [{ year, sample, mae, within3, within10, frame }] }'
      }
    ]
  }
];

/** 扁平化为 JSON 索引：{ "GET /api/years": "说明" } */
export function toFlatIndex() {
  const out = {};
  for (const g of API_GROUPS) {
    for (const it of g.items) {
      out[`${it.method} ${it.path}`] = it.desc;
    }
  }
  return out;
}
