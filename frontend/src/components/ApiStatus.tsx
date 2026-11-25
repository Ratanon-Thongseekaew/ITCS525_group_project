import { useEffect, useState } from 'react'
import { getGreeting } from '@/api'
import { Badge } from '@/components/ui/badge'

export function ApiStatus() {
  const [connected, setConnected] = useState(false)
  const [label, setLabel] = useState('Connecting')

  useEffect(() => {
    let active = true

    getGreeting()
      .then(() => {
        if (active) {
          setConnected(true)
          setLabel('API connected')
        }
      })
      .catch(() => {
        if (active) setLabel('API offline')
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <Badge variant={connected ? 'success' : 'warning'} className="hidden sm:inline-flex">
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </Badge>
  )
}
