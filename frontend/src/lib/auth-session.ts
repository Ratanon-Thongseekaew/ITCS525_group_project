import { useEffect, useSyncExternalStore } from 'react'
import { getCurrentUser, setUnauthorizedHandler, type User } from '@/api'

/**
 * The signed-in session, kept in `sessionStorage`: it survives a reload and ends with the tab.
 * The stored user only drives what the screen shows; the server checks every protected request.
 */
export interface Session {
  token: string
  user: User
}

export const SESSION_KEY = 'textile-track-session'

const listeners = new Set<() => void>()
let cachedRaw: string | null = null
let cachedSession: Session | null = null
let expired = false

function readRaw() {
  try {
    return window.sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

function parseSession(raw: string | null): Session | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<Session>
    return value.token && value.user?.role ? (value as Session) : null
  } catch {
    return null
  }
}

/** Returns the same object until the stored value changes, as `useSyncExternalStore` needs. */
export function getSession() {
  const raw = readRaw()
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedSession = parseSession(raw)
  }
  return cachedSession
}

function write(session: Session | null) {
  try {
    if (session) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else window.sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Storage is blocked, so signing in cannot persist.
  }
  listeners.forEach((listener) => listener())
}

export function signIn(session: Session) {
  expired = false
  write(session)
}

export function signOut() {
  expired = false
  write(null)
}

/** True after the server rejected the last session, until the next sign in or out. */
export function sessionExpired() {
  return expired
}

// Ignores a late `401` from an earlier session.
setUnauthorizedHandler((token) => {
  if (getSession()?.token !== token) return
  expired = true
  write(null)
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSession() {
  return useSyncExternalStore(subscribe, getSession)
}

/** Refreshes the stored user once on page load, and signs out if the token is no longer valid. */
export function useSessionCheck() {
  useEffect(() => {
    const token = getSession()?.token
    if (!token) return
    getCurrentUser(token)
      .then((user) => {
        if (getSession()?.token === token) write({ token, user })
      })
      .catch(() => {
        // A 401 is handled above. Other failures keep the session so an outage doesn't sign out.
      })
  }, [])
}
