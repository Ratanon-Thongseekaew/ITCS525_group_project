import { useCallback, useEffect, useRef, useState } from 'react'

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

interface ResourceResult<T> {
  requestKey: string
  data: T | null
  error: string | null
}

/**
 * Loads data when `key` changes (or on retry), aborting stale requests. A null key skips loading.
 * Loading is derived from whether the latest request has finished, so no state is set in effects.
 */
export function useApiResource<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
  fallbackError: string,
) {
  const loadRef = useRef(load)
  const [retryCount, setRetryCount] = useState(0)
  const [result, setResult] = useState<ResourceResult<T> | null>(null)
  const requestKey = key === null ? null : `${key}#${retryCount}`

  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    if (requestKey === null) return
    const controller = new AbortController()

    loadRef
      .current(controller.signal)
      .then((data) => setResult({ requestKey, data, error: null }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setResult({ requestKey, data: null, error: errorMessage(error, fallbackError) })
      })

    return () => controller.abort()
  }, [fallbackError, requestKey])

  const retry = useCallback(() => setRetryCount((count) => count + 1), [])
  const update = useCallback(
    (updater: (data: T) => T) =>
      setResult((current) =>
        current?.data ? { ...current, data: updater(current.data) } : current,
      ),
    [],
  )

  const isCurrent = result !== null && result.requestKey === requestKey
  return {
    data: isCurrent ? result.data : null,
    error: isCurrent ? result.error : null,
    isLoading: requestKey !== null && !isCurrent,
    retry,
    update,
  }
}
