import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 通用异步请求 hook
 * - 自动处理 loading / error
 * - 组件卸载后不再 setState
 * - 支持手动 refetch
 *
 * @param {Function} fn 返回 Promise 的函数
 * @param {Array} deps 依赖
 * @param {object} opts { immediate: 是否立即执行, initialData }
 */
export function useAsync(fn, deps = [], opts = {}) {
  const { immediate = true, initialData = null } = opts
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState(null)
  const alive = useRef(true)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const run = useCallback(async (...args) => {
    setLoading(true)
    setError(null)
    try {
      const result = await fnRef.current(...args)
      if (alive.current) setData(result)
      return result
    } catch (e) {
      if (alive.current) setError(e)
      throw e
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (immediate) {
      run().catch(() => {
        /* 错误已存入 state */
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, refetch: run, setData }
}
