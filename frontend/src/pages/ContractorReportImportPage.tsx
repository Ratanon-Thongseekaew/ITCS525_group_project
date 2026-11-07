import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import ContractorReportImport from '../components/ContractorReportImport'

export default function ContractorReportImportPage() {
  const navigate = useNavigate()

  return (
    <section className="flex flex-col gap-7">
      <div className="flex flex-col gap-6">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Operations</span>
          <span className="text-slate-500" aria-hidden="true">
            /
          </span>
          <span className="text-slate-500">Compliance</span>
          <span className="text-slate-500" aria-hidden="true">
            /
          </span>
          <span className="font-medium text-slate-900" aria-current="page">
            Import
          </span>
        </nav>

        <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-[26px] leading-[26px] font-medium tracking-[-1px] text-slate-900">
              Import Monthly Outcome Report File
            </h1>
            <p className="text-sm text-slate-500">
              Upload and validate monthly outcome report file from contractor
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/manager')}
            className="self-start sm:self-auto"
          >
            <ArrowLeft aria-hidden="true" />
            <span className="text-sm font-medium text-slate-700">Back</span>
          </Button>
        </header>
      </div>

      <ContractorReportImport />
    </section>
  )
}
