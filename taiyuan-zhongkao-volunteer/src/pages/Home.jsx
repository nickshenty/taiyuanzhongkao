import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ScoreInput from '../components/forms/ScoreInput'
import RecommendationCard from '../components/cards/RecommendationCard'
import { loadJuniorSchools, loadRecommendations } from '../utils/dataService'
import { useAsync } from '../utils/hooks'
import { STRATEGIES, STRATEGY_ORDER, DEFAULT_TARGET_YEAR } from '../utils/constants'

export default function Home() {
  const [result, setResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [recError, setRecError] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const autoRan = useRef(false)

  const { data: juniorData, loading: juniorLoading, error: juniorError } = useAsync(
    loadJuniorSchools,
    []
  )

  // 支持通过 URL 直接分享结果：/?score=700&junior=junior_001
  const juniorList = juniorData?.list || []
  const paramScore = searchParams.get('score')
  const paramJunior = searchParams.get('junior')

  useEffect(() => {
    if (autoRan.current) return
    if (!paramScore || !paramJunior || !juniorList.length) return
    autoRan.current = true
    handleSubmit({ studentScore: Number(paramScore), juniorSchoolId: paramJunior })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramScore, paramJunior, juniorList.length])

  async function handleSubmit({ studentScore, juniorSchoolId }) {
    setSubmitting(true)
    setRecError('')
    try {
      const data = await loadRecommendations({
        studentScore,
        juniorSchoolId,
        targetYear: DEFAULT_TARGET_YEAR,
      })
      setResult(data)
      setSearchParams({ score: String(studentScore), junior: juniorSchoolId }, { replace: true })
    } catch (e) {
      setRecError(e.message || '推荐生成失败')
      setResult(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">太原中考志愿推荐</h1>
        <p className="mt-1 text-sm text-slate-500">
          输入中考分数与就读初中，按 <b>冲 / 稳 / 保</b> 三档给出 {DEFAULT_TARGET_YEAR} 年志愿参考。
          预测依据 2026 + 2025 + 2024 年录取数据，算法版本 v1.5。
        </p>
      </section>

      {juniorError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          无法加载初中学校列表：{juniorError.message}
          <br />
          请确认后端服务已启动（默认 http://127.0.0.1:3000）。
        </div>
      )}

      <ScoreInput
        // 带参数进入时回填表单；key 变化会重建组件以应用初始值
        key={`${paramScore || ''}-${paramJunior || ''}`}
        juniorSchools={juniorList}
        initialScore={paramScore || ''}
        initialJunior={
          paramJunior ? juniorList.find((j) => j.id === paramJunior) || null : null
        }
        loading={submitting || juniorLoading}
        onSubmit={handleSubmit}
      />

      {recError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {recError}
        </div>
      )}

      {result && (
        <section className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-slate-600">
                考生分数 <b className="text-lg text-slate-900">{result.studentScore}</b>
                <span className="mx-2 text-slate-300">|</span>
                就读 <b className="text-slate-900">{result.juniorSchool?.name}</b>
              </div>
              <div className="text-sm text-slate-500">
                目标年份 <b>{result.targetYear}</b>
                <span className="ml-3">
                  共推荐 <b>{result.totalRecommendations}</b> 所
                </span>
              </div>
            </div>
            {result.quotaNote && (
              <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {result.quotaNote}
              </p>
            )}
          </div>

          {result.totalRecommendations === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              暂无可推荐学校。你的分数可能低于所有学校的预测录取线，
              或与任何学校的分差超出推荐区间（冲：−10~−5 分，稳：±5 分，保：+10 分以上）。
            </div>
          )}

          {STRATEGY_ORDER.map((key) => {
            const list = result.recommendations?.[key] || []
            if (!list.length) return null
            const s = STRATEGIES[key]
            return (
              <div key={key}>
                <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />
                  <h3 className="shrink-0 whitespace-nowrap font-semibold text-slate-900">
                    {s.label}
                  </h3>
                  <span className="min-w-0 flex-1 text-xs leading-snug text-slate-500">
                    {s.desc}
                  </span>
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {list.length} 所
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {list.map((item) => (
                    <RecommendationCard key={item.schoolCode} item={item} strategyKey={key} />
                  ))}
                </div>
              </div>
            )
          })}

          {!!result.tips?.length && (
            <ul className="space-y-1 rounded-xl bg-slate-100 p-4 text-sm text-slate-600">
              {result.tips.map((t, i) => (
                <li key={i}>· {t}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
