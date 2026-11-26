import { Link } from 'react-router-dom'
import { CONFIDENCE, STRATEGIES, formatDiff, formatScore, typeBadge } from '../../utils/constants'

/**
 * 单所学校推荐卡片
 *
 * @param {object} item 后端 /api/recommendations 返回的单条推荐
 * @param {string} strategyKey risky | stable | safe
 */
export default function RecommendationCard({ item, strategyKey }) {
  const strategy = STRATEGIES[strategyKey]
  const conf = CONFIDENCE[item.confidence] || CONFIDENCE.low

  return (
    <Link
      to={`/school/${item.schoolCode}`}
      className="group block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate font-medium text-slate-900 group-hover:text-blue-700">
            {item.schoolName}
          </h4>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`rounded px-1.5 py-0.5 text-[11px] ${typeBadge(item.type)}`}>
              {item.type || '普通高中'}
            </span>
            {item.district && (
              <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500">
                {item.district}
              </span>
            )}
            <span className={`rounded px-1.5 py-0.5 text-[11px] ring-1 ${conf.cls}`}>
              {conf.label}
            </span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className={`text-xl font-semibold ${strategy.text}`}>
            {formatScore(item.predictedScore)}
          </div>
          <div className="text-[11px] text-slate-400">2027 预测线</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
        <span className="text-slate-500">
          你的分数{' '}
          <b className={item.scoreDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
            {formatDiff(item.scoreDiff)}
          </b>{' '}
          分
        </span>

        <div className="flex items-center gap-1.5">
          {item.hasDirectedQuota && (
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] ${
                item.quotaUpgraded
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
              title={
                item.quotaLineEstimate
                  ? `按定向名额估算，约 ${item.quotaLineEstimate} 分可录`
                  : '本校有定向名额'
              }
            >
              {item.quotaUpgraded ? '定向可冲' : '有定向名额'}
            </span>
          )}
          <span className={`rounded px-1.5 py-0.5 text-[11px] ${strategy.badge} ring-1`}>
            {strategy.label}
          </span>
        </div>
      </div>
    </Link>
  )
}
