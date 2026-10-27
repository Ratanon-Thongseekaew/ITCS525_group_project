import { useEffect, useState } from 'react'
import { getGreeting } from '../api'

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
    <div className={`api-status ${connected ? 'api-status--online' : ''}`}>
      <span className="api-status__dot" aria-hidden="true" />
      {label}
    </div>
  )
}
