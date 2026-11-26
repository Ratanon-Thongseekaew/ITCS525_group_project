import { useCallback, useMemo, useState } from 'react'
import { getHandoffOptions } from '@/api'
import { useApiResource } from '@/lib/use-api-resource'
import type { HandoffActorOption, HandoffOptions } from '@/types/handoff'

// Garment Sorting still asks which staff account is working through this temporary picker
// (the handoff and Direct Resale pages use the signed-in account). The choice is remembered
// per browser. Storage can be unavailable
// (private windows, blocked site data), so it's optional.
const ACTOR_KEY = 'textile-track:handoff-actor-id'

function readStoredActorId() {
  try {
    const value = Number(window.localStorage.getItem(ACTOR_KEY))
    return Number.isInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function storeActorId(value: number | null) {
  try {
    if (value === null) window.localStorage.removeItem(ACTOR_KEY)
    else window.localStorage.setItem(ACTOR_KEY, String(value))
  } catch {
    // Ignore: the picker still works for this page view.
  }
}

export interface HandoffWorkspace {
  options: HandoffOptions | null
  // Staff accounts only; managers and admins don't use these pages.
  staffAccounts: HandoffActorOption[]
  isLoading: boolean
  error: string | null
  retry: () => void
  actor: HandoffActorOption | null
  setActorId: (id: number | null) => void
  // The chosen staff member's site; null until a staff account with a site is chosen.
  siteId: number | null
  siteName: string | null
}

export function useHandoffWorkspace(): HandoffWorkspace {
  const {
    data: options,
    isLoading,
    error,
    retry,
  } = useApiResource('handoff-options', getHandoffOptions, 'Staff accounts could not be loaded.')
  const [actorId, setActorIdState] = useState(readStoredActorId)

  const setActorId = useCallback((id: number | null) => {
    setActorIdState(id)
    storeActorId(id)
  }, [])

  return useMemo(() => {
    const staffAccounts = options?.actors.filter((option) => option.role === 'staff') ?? []
    const actor = staffAccounts.find((option) => option.id === actorId) ?? null
    const siteId = actor?.site_ids[0] ?? null
    const siteName = options?.sites.find((site) => site.id === siteId)?.name ?? null

    return {
      options,
      staffAccounts,
      isLoading,
      error,
      retry,
      actor,
      setActorId,
      siteId,
      siteName,
    }
  }, [actorId, error, isLoading, options, retry, setActorId])
}
