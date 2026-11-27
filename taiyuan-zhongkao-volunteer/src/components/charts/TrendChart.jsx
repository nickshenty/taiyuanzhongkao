import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/**
 * 学校历年录取线趋势图 + 2027 预测点
 *
 * 关键点：各年中考总分不同（730 / 660 / 850 / 839），
 * 直接比较绝对分数会误导，因此提供"原始分 / 得分率"两种视图。
 *
 * @param {Array} history  [{year,lastLine,quotaLine,controlLine,totalScore}]
 * @param {Array} predictions [{year,predictedScore,confidence}]
 */
export default function TrendChart({ history = [], predictions = [] }) {
  const preds = predictions.filter((p) => p.predictedScore != null)
  const predYear = preds.length ? Math.max(...preds.map((p) => p.year)) : null

  const rows = history
    .filter((h) => h.lastLine != null)
    .map((h) => {
      const total = Number(h.totalScore) || null
      return {
        year: h.year,
        line: Number(h.lastLine),
        quota: h.quotaLine != null ? Number(h.quotaLine) : null,
        rate: total ? Number(((Number(h.lastLine) / total) * 100).toFixed(1)) : null,
        total,
      }
    })

  // 预测点的得分率必须用"基准年"的总分作分母（预测分数沿用最近年框架），
  // 不能用最早年份的总分，否则会出现 >100% 的荒谬结果。
  const latestTotal = rows.length ? rows[rows.length - 1].total : null

  // 追加预测点
  for (const p of preds) {
    const existing = rows.find((r) => r.year === p.year)
    const total = latestTotal
    const value = Number(p.predictedScore)
    if (existing) {
      existing.line = value
      existing.isForecast = true
    } else {
      rows.push({
        year: p.year,
        line: value,
        quota: null,
        rate: total ? Number(((value / total) * 100).toFixed(1)) : null,
        isForecast: true,
      })
    }
  }
  rows.sort((a, b) => a.year - b.year)

  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-slate-400">暂无历史数据</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-2 text-sm font-medium text-slate-700">历年录取线（原始分）</h4>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={['dataMin - 20', 'dataMax + 20']} />
              <Tooltip
                formatter={(v, name) => [v, name === 'line' ? '录取线' : name]}
                labelFormatter={(y) => `${y} 年`}
              />
              {predYear && (
                <ReferenceLine
                  x={predYear}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{ value: '预测', fontSize: 11, fill: '#b45309', position: 'top' }}
                />
              )}
              <Line
                type="monotone"
                dataKey="line"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name="录取线"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          注意：各年中考总分不同（730 / 660 / 850 / 839），原始分不宜直接横向比较。
        </p>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-medium text-slate-700">得分率视角（消除总分差异）</h4>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                domain={['dataMin - 2', 'dataMax + 2']}
                unit="%"
              />
              <Tooltip
                formatter={(v) => [`${v}%`, '得分率']}
                labelFormatter={(y) => `${y} 年`}
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#059669"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="得分率"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
