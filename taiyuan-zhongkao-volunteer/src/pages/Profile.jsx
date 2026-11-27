import { loadAlgorithmInfo, loadPredictionStats, loadYears } from '../utils/dataService'
import { useAsync } from '../utils/hooks'
import { DEFAULT_TARGET_YEAR } from '../utils/constants'

export default function Profile() {
  const { data, loading, error } = useAsync(async () => {
    const [algo, stats, years] = await Promise.all([
      loadAlgorithmInfo().catch(() => null),
      loadPredictionStats(DEFAULT_TARGET_YEAR).catch(() => null),
      loadYears().catch(() => []),
    ])
    return { algo, stats, years }
  }, [])

  if (loading) return <p className="py-16 text-center text-sm text-slate-400">加载中…</p>
  if (error)
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        加载失败：{error.message}
      </div>
    )

  const { algo, stats, years } = data || {}

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">关于本系统</h1>
        <p className="mt-1 text-sm text-slate-500">
          数据来源、算法说明与预测置信度分布。
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">预测算法</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          采用<b>相对位置动量法</b>：把录取线换算为"在当年控制线与总分之间的相对位置"，
          消除各年中考总分差异（730 / 660 / 850 / 839）后再做趋势外推。
        </p>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
{`relPos(Y)   = (录取线 − 控制线) / (总分 − 控制线)
yearly      = (relPos_最近 − relPos_次近) / 年份间隔
relPos_pred = relPos_最近 + 0.5 × clamp(yearly / 2, ±0.05)
预测线      = 控制线_目标 + relPos_pred × (总分_目标 − 控制线_目标)`}
        </pre>
        {algo?.highlights && (
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {algo.highlights.map((t, i) => (
              <li key={i}>· {t}</li>
            ))}
          </ul>
        )}
        {algo?.parameters && (
          <p className="mt-2 text-xs text-slate-500">
            参数：动量权重 {algo.parameters.momentumWeight}，单步封顶 ±
            {algo.parameters.momentumCap}
          </p>
        )}
      </section>

      {algo?.backtest?.years?.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">历年回测（无数据泄漏）</h2>
          <p className="mt-1 text-xs text-slate-500">{algo.backtest.note}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm sm:min-w-[520px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="whitespace-nowrap py-2 pr-3 font-medium">目标年</th>
                  <th className="hidden py-2 pr-3 font-medium sm:table-cell">样本</th>
                  <th className="py-2 pr-3 font-medium">MAE</th>
                  <th className="hidden py-2 pr-3 font-medium sm:table-cell">≤3分</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-medium">≤10分</th>
                  <th className="hidden py-2 font-medium sm:table-cell">总分变化</th>
                </tr>
              </thead>
              <tbody>
                {algo.backtest.years.map((b) => (
                  <tr key={b.year} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-800">{b.year}</td>
                    <td className="hidden py-2 pr-3 text-slate-500 sm:table-cell">{b.sample}</td>
                    <td className="py-2 pr-3 font-medium text-slate-900">{b.mae}</td>
                    <td className="hidden py-2 pr-3 text-slate-600 sm:table-cell">{b.within3}%</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{b.within10}%</td>
                    <td className="hidden py-2 text-xs text-slate-500 sm:table-cell">{b.frame}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">{DEFAULT_TARGET_YEAR} 年预测置信度</h2>
        {stats ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="预测学校数" value={stats.totalPredictions} />
              <Metric label="高置信度" value={stats.highConfidence} tone="text-emerald-600" />
              <Metric label="中置信度" value={stats.mediumConfidence} tone="text-amber-600" />
              <Metric label="低置信度" value={stats.lowConfidence} tone="text-slate-500" />
            </div>
            {stats.validComparisons > 0 && (
              <p className="mt-3 text-sm text-slate-600">
                已回测对比 {stats.validComparisons} 所：平均绝对误差（MAE）{' '}
                <b>{stats.mae}</b> 分，误差 ≤3 分占 <b>{stats.within3Percent}%</b>。
              </p>
            )}
            {stats.message && (
              <p className="mt-3 text-xs text-slate-500">{stats.message}</p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-400">暂无统计数据</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">数据年份</h2>
        {years?.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm sm:min-w-[420px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">年份</th>
                  <th className="py-2 pr-3 font-medium">中考总分</th>
                  <th className="py-2 pr-3 font-medium">控制线</th>
                  <th className="hidden py-2 font-medium sm:table-cell">状态</th>
                </tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <tr key={y.year} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 text-slate-800">{y.year}</td>
                    <td className="py-2 pr-3 text-slate-600">{y.totalScore}</td>
                    <td className="py-2 pr-3 text-slate-600">{y.controlLine}</td>
                    <td className="hidden py-2 text-xs text-slate-500 sm:table-cell">
                      {y.dataStatus || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">暂无年份数据</p>
        )}
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <h2 className="font-semibold">使用提醒</h2>
        <ul className="mt-2 space-y-1">
          <li>· 预测线为统计估计，非官方数据，仅供填报参考。</li>
          <li>· 各年中考总分不同，请优先参考"得分率"而非绝对分数。</li>
          <li>· 定向名额每年由教育局重新分配，往年名额仅作估算。</li>
          <li>· 最终以太原市教育局公布的招生计划与录取结果为准。</li>
        </ul>
      </section>
    </div>
  )
}

function Metric({ label, value, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-semibold ${tone}`}>{value ?? '—'}</div>
    </div>
  )
}
