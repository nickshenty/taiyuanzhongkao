import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadPredictions } from '../utils/dataService'
import { useAsync } from '../utils/hooks'
import {
  CONFIDENCE,
  DEFAULT_TARGET_YEAR,
  formatScore,
  strategyLabel,
  typeBadge,
} from '../utils/constants'

export default function DataCompare() {
  const { data, loading, error } = useAsync(
    () => loadPredictions(DEFAULT_TARGET_YEAR, { limit: 200 }),
    []
  )
  const [keyword, setKeyword] = useState('')
  const [conf, setConf] = useState('all')
  const [selected, setSelected] = useState([])

  const list = data?.list || []

  const filtered = useMemo(() => {
    return list.filter((s) => {
      if (keyword && !s.schoolName?.includes(keyword.trim())) return false
      if (conf !== 'all' && s.confidence !== conf) return false
      return true
    })
  }, [list, keyword, conf])

  function toggle(code) {
    setSelected((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : prev.length >= 3
          ? prev
          : [...prev, code]
    )
  }

  const selectedItems = selected
    .map((c) => list.find((s) => s.schoolCode === c))
    .filter(Boolean)

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        加载失败：{error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">
          {DEFAULT_TARGET_YEAR} 年录取线预测一览
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          共 {data?.total ?? 0} 所普通高中。可搜索、按置信度筛选，最多选择 3 所进行并排对比。
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索学校名称"
          className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <select
          value={conf}
          onChange={(e) => setConf(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          <option value="all">全部置信度</option>
          <option value="high">高置信度</option>
          <option value="medium">中置信度</option>
          <option value="low">低置信度</option>
        </select>
        <span className="text-sm text-slate-500">
          命中 {filtered.length} 所 · 已选 {selected.length}/3
        </span>
      </div>

      {selectedItems.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {selectedItems.map((s) => (
            <div key={s.schoolCode} className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-medium text-slate-900">{s.schoolName}</h3>
                <button
                  onClick={() => toggle(s.schoolCode)}
                  className="text-xs text-slate-400 hover:text-rose-600"
                >
                  移除
                </button>
              </div>
              <div className="mt-2 text-2xl font-semibold text-blue-700">
                {formatScore(s.predictedScore)}
              </div>
              <div className="text-xs text-slate-500">
                {DEFAULT_TARGET_YEAR} 预测线 ·{' '}
                {CONFIDENCE[s.confidence]?.label || s.confidence}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-400">加载中…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-3 py-2.5 font-medium">对比</th>
                  <th className="px-3 py-2.5 font-medium">学校</th>
                  <th className="px-3 py-2.5 font-medium">类型</th>
                  <th className="px-3 py-2.5 text-right font-medium">预测线</th>
                  <th className="px-3 py-2.5 font-medium">置信度</th>
                  <th className="px-3 py-2.5 font-medium">策略</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const c = CONFIDENCE[s.confidence] || CONFIDENCE.low
                  const checked = selected.includes(s.schoolCode)
                  return (
                    <tr key={s.schoolCode} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(s.schoolCode)}
                          disabled={!checked && selected.length >= 3}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          to={`/school/${s.schoolCode}`}
                          className="font-medium text-slate-800 hover:text-blue-600"
                        >
                          {s.schoolName}
                        </Link>
                        <span className="ml-2 text-xs text-slate-400">{s.schoolCode}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] ${typeBadge(s.type)}`}
                        >
                          {s.type || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">
                        {formatScore(s.predictedScore)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[11px] ring-1 ${c.cls}`}>
                          {c.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{strategyLabel(s.strategy)}</td>
                    </tr>
                  )
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-slate-400">
                      没有匹配的学校
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
