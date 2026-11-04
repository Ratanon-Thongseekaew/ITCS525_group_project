import { useEffect, useState } from 'react'
import ContractorReportImport from '../components/ContractorReportImport'
import { TextileTrackLoader } from '../components/TextileTrackLoader'

export function ManagerPage() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadingTimer = window.setTimeout(() => {
      setIsLoading(false)
    }, 2_000)

    return () => window.clearTimeout(loadingTimer)
  }, [])

  if (isLoading) {
    return <TextileTrackLoader className="fixed inset-0 z-50" label="loading..." size={220} />
  }

  return (
    <div className="p-4">
      <ContractorReportImport />
    </div>
  )
}

export default ManagerPage
