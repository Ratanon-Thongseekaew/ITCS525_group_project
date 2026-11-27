import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import {
  fetchContractorReportOptions,
  importContractorReport,
  parseAndValidateContractorFile,
  type ContractorReportImportResponse,
  type ContractorReportOptionItem,
  type ContractorReportParsedRow,
} from '@/api'
import { ImportResultStep } from '@/components/contractor-import/ImportResultStep'
import { ImportReviewStep } from '@/components/contractor-import/ImportReviewStep'
import { ImportUploadStep } from '@/components/contractor-import/ImportUploadStep'
import {
  downloadCsv,
  MAX_FILE_MB,
  REPORT_COLUMNS,
  rejectedRowsCsv,
  SAMPLE_REPORT_CSV,
} from '@/components/contractor-import/report-file'
import type { ReportRow } from '@/components/contractor-import/types'
import { Stepper } from '@/components/Stepper'
import { Card, CardContent } from '@/components/ui/card'
import { useSession } from '@/lib/auth-session'

const IMPORT_STEPS = [
  { title: 'Step 1: Upload File', description: 'CSV or XLSX, month and contractor' },
  { title: 'Step 2: Review 6 Categories', description: 'Check weights and rules' },
  { title: 'Step 3: Save Report', description: 'Add outcomes to the dashboard' },
]

/** The month before today as YYYY-MM, since reports cover the month just finished. */
function previousMonth(today = new Date()): string {
  const month = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Failed to read selected file.'))
    reader.readAsDataURL(file)
  })
}

function toReportRow(row: ContractorReportParsedRow): ReportRow {
  return {
    row: row.row,
    binId: row.bin_id,
    siteName: row.site_name,
    staffWeight: row.staff_weight_kg,
    reportedWeight: row.received_kg,
    upcycledKg: row.dispositions.upcycled_kg,
    fibreToFibreKg: row.dispositions.fibre_to_fibre_kg,
    downcycledKg: row.dispositions.downcycled_kg,
    exportedKg: row.dispositions.exported_kg,
    landfilledKg: row.dispositions.landfilled_kg,
    energyRecoveryKg: row.dispositions.incinerated_energy_recovery_kg,
    uncategorizedKg: row.uncategorized_weight_kg,
    status: row.status,
    errors: row.errors,
    warnings: row.warnings,
  }
}

export default function ContractorReportImport() {
  const navigate = useNavigate()
  const user = useSession()?.user
  const actorId = user && user.role !== 'staff' ? user.id : null

  const [step, setStep] = useState<number>(1)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  const [contractors, setContractors] = useState<ContractorReportOptionItem[]>([])
  const [contractorsError, setContractorsError] = useState<string | null>(null)
  const [contractorId, setContractorId] = useState<number | null>(null)
  const [reportMonth, setReportMonth] = useState<string>(() => previousMonth())

  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [isSample, setIsSample] = useState<boolean>(false)
  const [validatedRows, setValidatedRows] = useState<ReportRow[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ContractorReportImportResponse | null>(null)

  useEffect(() => {
    let active = true
    fetchContractorReportOptions()
      .then((data) => {
        if (!active) return
        setContractors(data.contractors)
        setContractorId((current) => current ?? data.contractors[0]?.id ?? null)
      })
      .catch(() => {
        if (active) setContractorsError('The contractor list could not be loaded. Reload the page.')
      })
    return () => {
      active = false
    }
  }, [])

  const contractorName = contractors.find((item) => item.id === contractorId)?.name ?? ''

  const reviewReport = async (
    filename: string,
    readBase64: () => Promise<string>,
    sample: boolean,
  ) => {
    if (actorId === null) {
      setValidationError('Sign in as a manager or admin to import reports.')
      return
    }
    if (contractorId === null) {
      setValidationError('Choose the contractor who sent the report.')
      return
    }
    setIsProcessing(true)
    setValidationError(null)
    setSaveError(null)
    try {
      // The month and contractor are checked against each bin's handoff.
      const parsed = await parseAndValidateContractorFile({
        actorId,
        filename,
        contentBase64: await readBase64(),
        reportMonth,
        contractorId,
      })
      setValidatedRows(parsed.rows.map(toReportRow))
      setUploadedFileName(parsed.filename)
      setIsSample(sample)
      setStep(2)
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : 'The uploaded file could not be validated.',
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileSelected = (file: File) => {
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setValidationError(`The file is larger than ${MAX_FILE_MB} MB.`)
      return
    }
    void reviewReport(file.name, () => fileToBase64(file), false)
  }

  const handleStartSampleReview = () =>
    void reviewReport(
      `contractor_report_${reportMonth}_sample.csv`,
      async () => btoa(SAMPLE_REPORT_CSV),
      true,
    )

  const savableRows = isSample ? [] : validatedRows.filter((row) => row.status !== 'Error')

  const handleSaveRecords = async () => {
    if (actorId === null || contractorId === null) return
    if (savableRows.length === 0) {
      setSaveError('No valid rows available to import. Please fix the rejected rows first.')
      return
    }
    setIsSaving(true)
    setSaveError(null)
    try {
      const response = await importContractorReport({
        actor_id: actorId,
        contractor_id: contractorId,
        report_month: reportMonth,
        source_filename: uploadedFileName ?? `report_${reportMonth}.csv`,
        rows: savableRows.map((row) => ({
          row: row.row,
          bin_id: row.binId,
          received_kg: row.reportedWeight,
          dispositions: {
            upcycled_kg: row.upcycledKg,
            fibre_to_fibre_kg: row.fibreToFibreKg,
            downcycled_kg: row.downcycledKg,
            exported_kg: row.exportedKg,
            landfilled_kg: row.landfilledKg,
            incinerated_energy_recovery_kg: row.energyRecoveryKg,
          },
        })),
      })
      setImportResult(response)
      setStep(3)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save contractor report.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <Stepper steps={IMPORT_STEPS} current={step} />

      <Card>
        <CardContent className="p-6 md:p-8">
          {step === 1 ? (
            <ImportUploadStep
              contractorOptions={contractors.map((item) => ({
                value: String(item.id),
                label: item.name,
              }))}
              contractor={contractorId === null ? '' : String(contractorId)}
              onContractorChange={(value) => setContractorId(Number(value))}
              reportMonth={reportMonth}
              onReportMonthChange={setReportMonth}
              isProcessing={isProcessing}
              error={validationError ?? contractorsError}
              onFileSelected={handleFileSelected}
              onDownloadTemplate={() =>
                downloadCsv(
                  'contractor_monthly_report_template.csv',
                  `${REPORT_COLUMNS.join(',')}\n`,
                )
              }
              onReviewSample={handleStartSampleReview}
              onCancel={() => navigate('/manager')}
            />
          ) : null}

          {step === 2 ? (
            <ImportReviewStep
              rows={validatedRows}
              reportMonth={reportMonth}
              fileName={uploadedFileName}
              contractor={contractorName}
              isSample={isSample}
              savableCount={savableRows.length}
              isSaving={isSaving}
              error={saveError}
              onBack={() => setStep(1)}
              onSave={() => void handleSaveRecords()}
              onDownloadRejected={() =>
                downloadCsv(
                  `rejected_rows_${uploadedFileName?.replace(/\.(csv|xlsx)$/i, '') ?? reportMonth}.csv`,
                  rejectedRowsCsv(validatedRows),
                )
              }
            />
          ) : null}

          {step === 3 ? (
            <ImportResultStep
              result={importResult}
              onViewDashboard={() => navigate('/manager/compliance-dashboard')}
              onImportAnother={() => {
                setImportResult(null)
                setStep(1)
              }}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
