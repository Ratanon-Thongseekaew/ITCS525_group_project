import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import ContractorReportImport from '../components/ContractorReportImport'

export default function ContractorReportImportPage() {
  const navigate = useNavigate()

  return (
    <section className="flex flex-col gap-7">
      <PageHeader
        breadcrumbs={[{ label: 'Operations' }, { label: 'Compliance' }, { label: 'Import' }]}
        title="Import Monthly Outcome Report File"
        description="Upload and validate monthly outcome report file from contractor"
        actions={
          <Button type="button" variant="outline" onClick={() => navigate('/manager')}>
            <ArrowLeft aria-hidden="true" />
            Back
          </Button>
        }
      />

      <ContractorReportImport />
    </section>
  )
}
