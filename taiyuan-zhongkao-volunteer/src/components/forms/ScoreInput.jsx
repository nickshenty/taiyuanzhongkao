import { useEffect, useMemo, useRef, useState } from 'react'
import { SCORE_RANGE } from '../../utils/constants'

/**
 * 分数 + 就读初中 输入表单
 *
 * 初中学校会影响"定向名额"判定，因此必填。
 * 145 所初中用下拉太笨重，这里做成可搜索的组合框。
 */
export default function ScoreInput({
  juniorSchools = [],
  initialScore = '',
  initialJunior = null,
  loading = false,
  onSubmit,
}) {
  const [score, setScore] = useState(String(initialScore ?? ''))
  const [junior, setJunior] = useState(initialJunior)
  const [keyword, setKeyword] = useState(initialJunior?.name || '')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const boxRef = useRef(null)

  // 点击外部收起下拉
  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = useMemo(() => {
    const k = keyword.trim()
    if (!k) return juniorSchools.slice(0, 30)
    return juniorSchools.filter((s) => s.name.includes(k)).slice(0, 30)
  }, [keyword, juniorSchools])

  function submit(e) {
    e.preventDefault()
    const v = Number(score)
    if (!score || Number.isNaN(v)) return setError('请输入中考分数')
    if (v < SCORE_RANGE.min || v > SCORE_RANGE.max)
      return setError(`分数应在 ${SCORE_RANGE.min}–${SCORE_RANGE.max} 之间`)
    if (!junior) return setError('请选择就读的初中学校（用于定向名额判断）')
    setError('')
    onSubmit?.({ studentScore: v, juniorSchoolId: junior.id })
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">中考分数</span>
          <input
            type="number"
            inputMode="decimal"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="例如 700"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <div className="relative block" ref={boxRef}>
          <span className="mb-1 block text-sm font-medium text-slate-700">
            就读初中学校
            <span className="ml-1 text-xs font-normal text-slate-400">（影响定向名额）</span>
          </span>
          <input
            type="text"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              setJunior(null)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder="输入校名搜索，如「太原市第二中学校」"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          {junior && (
            <p className="mt-1 truncate text-xs text-emerald-600">已选择：{junior.name}</p>
          )}
          {open && filtered.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {filtered.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setJunior(s)
                      setKeyword(s.name)
                      setOpen(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                  >
                    {s.name}
                    {s.district && (
                      <span className="ml-2 text-xs text-slate-400">{s.district}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? '正在计算推荐…' : '生成志愿推荐方案'}
      </button>
    </form>
  )
}
