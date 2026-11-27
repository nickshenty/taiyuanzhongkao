import { Link, useParams } from 'react-router-dom'
import TrendChart from '../components/charts/TrendChart'
import { loadSchoolDetail } from '../utils/dataService'
import { useAsync } from '../utils/hooks'
import { CONFIDENCE, formatScore, typeBadge } from '../utils/constants'

export default function SchoolDetail() {
  const { code } = useParams()
  const { data, loading, error } = useAsync(() => loadSchoolDetail(code), [code])

  if (loading) {
    return <p className="py-16 text-center text-sm text-slate-400">加载中…</p>
  }
  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        加载失败：{error.message}
      </div>
    )
  }
  if (!data?.school) {
    return <p className="py-16 text-center text-sm text-slate-400">未找到该学校</p>
  }

  const { school, history = [], predictions = [] } = data
  const latest = history[history.length - 1]
  const forecast = predictions.filter((p) => p.predictedScore != null).sort((a, b) => b.year - a.year)[0]
  const conf = forecast ? CONFIDENCE[forecast.confidence] || CONFIDENCE.low : null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/" className="hover:text-blue-600">
          首页
        </Link>
        <span>/</span>
        <span className="text-slate-700">{school.name}</span>
      </div>

      <header className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{school.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
                代码 {school.code}
              </span>
              {school.type && (
                <span className={`rounded px-2 py-0.5 ${typeBadge(school.type)}`}>
                  {school.type}
                </span>
              )}
              {school.district && (
                <span className="rounded bg-slate-50 px-2 py-0.5 text-slate-500">
                  {school.district}
                </span>
              )}
            </div>
          </div>

          {forecast && (
            <div className="text-right">
              <div className="text-3xl font-semibold text-blue-600">
                {formatScore(forecast.predictedScore)}
              </div>
              <div className="text-xs text-slate-500">{forecast.year} 年预测录取线</div>
              {conf && (
                <span className={`mt-1 inline-block rounded px-2 py-0.5 text-[11px] ring-1 ${conf.cls}`}>
                  {conf.label}
                </span>
              )}
            </div>
          )}
        </div>

        {latest && (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
            <Stat label={`${latest.year} 年录取线`} value={formatScore(latest.lastLine)} />
            <Stat label="定向生线" value={formatScore(latest.quotaLine)} />
            <Stat label="当年控制线" value={formatScore(latest.controlLine)} />
            <Stat
              label="招生计划"
              value={latest.planCount != null ? `${latest.planCount} 人` : '—'}
            />
          </div>
        )}
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-slate-900">录取线趋势</h2>
        <TrendChart history={history} predictions={predictions} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">历年明细</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm sm:min-w-[520px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">年份</th>
                <th className="py-2 pr-3 font-medium">录取线</th>
                <th className="py-2 pr-3 font-medium">招生计划</th>
                <th className="py-2 pr-3 font-medium">定向线</th>
                <th className="hidden py-2 pr-3 font-medium sm:table-cell">控制线</th>
                <th className="hidden py-2 pr-3 font-medium sm:table-cell">总分</th>
                <th className="py-2 font-medium">得分率</th>
              </tr>
            </thead>
            <tbody>
              {history.slice().reverse().map((h) => {
                const rate =
                  h.lastLine != null && h.totalScore
                    ? ((Number(h.lastLine) / Number(h.totalScore)) * 100).toFixed(1)
                    : null
                return (
                  <tr key={h.year} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 text-slate-700">{h.year}</td>
                    <td className="py-2 pr-3 font-medium text-slate-900">
                      {formatScore(h.lastLine)}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {h.planCount != null ? `${h.planCount} 人` : '—'}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{formatScore(h.quotaLine)}</td>
                    <td className="hidden py-2 pr-3 text-slate-500 sm:table-cell">
                      {formatScore(h.controlLine)}
                    </td>
                    <td className="hidden py-2 pr-3 text-slate-500 sm:table-cell">
                      {formatScore(h.totalScore)}
                    </td>
                    <td className="py-2 text-slate-500">{rate ? `${rate}%` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-semibold text-slate-800">{value}</div>
    </div>
  )
}
