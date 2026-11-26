/**
 * 算法说明的唯一事实来源
 *
 * 曾出现"app.js 与 predictionController 各自硬编码一份说明"的情况，
 * 算法改为相对位置动量后两处都未更新，前端展示的还是旧的"异常校趋势外推"。
 * 现统一从此处读取，改动算法时只需改这一个文件。
 */

export const ALGORITHM_INFO = {
  name: '太原中考分数线预测算法 v1.5（跨年泛化版）',
  version: 'v1.5-generalized',
  summary: '把录取线换算为相对位置后做动量外推，消除各年中考总分差异。',

  formula: [
    'relPos(Y)   = (录取线 - 控制线) / (总分 - 控制线)',
    'yearly      = (relPos_最近锚点 - relPos_次近锚点) / 年份间隔',
    'relPos_pred = relPos_最近锚点 + 0.5 × clamp(yearly / 2, ±0.05)',
    '预测线      = 控制线_目标 + relPos_pred × (总分_目标 - 控制线_目标)'
  ],

  parameters: {
    momentumWeight: 0.5,
    momentumCap: 0.05,
    description:
      '动量权重 0.5 为半步阻尼；相对位置单步变化封顶 ±0.05，抑制异常波动带偏。'
  },

  highlights: [
    '尺度无关：自动吸收 730 / 660 / 850 / 839 等各年总分差异',
    '间隔归一：允许历史锚点年份不连续（适配部分年份数据缺失）',
    '半步阻尼 + 封顶：抑制单校异常跳变对预测的影响',
    '可重算：输出保留 relPosPred，官方公布新框架后可一键换算'
  ],

  dataCoverage: {
    historyYears: '2017–2026（2019 起为校区级，2017/2018 为学校级）',
    campusUnits: 90,
    distinctSchools: 84,
    referenceYears: [2026, 2025, 2024]
  },

  // 回测结果（仅用目标年之前的锚点，无数据泄漏）
  backtest: {
    note: '框架指当年总分/控制线；稳定年份误差最小，总分突变年份误差显著放大。',
    years: [
      { year: 2020, sample: 85, mae: 8.24, within3: 29.4, within10: 72.9, frame: '730→660' },
      { year: 2021, sample: 84, mae: 10.19, within3: 34.5, within10: 76.2, frame: '660→730' },
      { year: 2022, sample: 90, mae: 11.09, within3: 30.0, within10: 66.7, frame: '730→660' },
      { year: 2023, sample: 91, mae: 8.65, within3: 33.0, within10: 64.8, frame: '660→730' },
      { year: 2024, sample: 88, mae: 7.52, within3: 36.4, within10: 78.4, frame: '730→730' },
      { year: 2025, sample: 96, mae: 15.75, within3: 17.7, within10: 39.6, frame: '730→850' },
      { year: 2026, sample: 98, mae: 10.44, within3: 40.8, within10: 75.5, frame: '850→839' }
    ]
  },

  // 推荐档位（与 recommendationService 保持一致）
  strategies: {
    risky: { label: '冲一冲', rule: '考生分数低于预测线 5–10 分', maxCount: 3 },
    stable: { label: '稳一稳', rule: '与预测线相差 ±5 分以内', maxCount: 2 },
    safe: { label: '保一保', rule: '考生分数高于预测线 10 分以上', maxCount: 2 }
  },

  quotaRule:
    '本校有定向名额且考生分数 ≥ 预测线 − 50 分（且不低于最低控制线）时，可通过定向录取，按"冲"档计入。'
};

export default ALGORITHM_INFO;
