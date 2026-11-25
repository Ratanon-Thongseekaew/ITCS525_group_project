import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import {
  fetchContractorReportOptions,
  importContractorReport,
  parseAndValidateContractorFile,
  validateContractorReport,
  type ContractorReportImportResponse,
  type ContractorReportOptionItem,
} from '@/api'
import { ImportResultStep } from '@/components/contractor-import/ImportResultStep'
import { ImportReviewStep } from '@/components/contractor-import/ImportReviewStep'
import { ImportUploadStep } from '@/components/contractor-import/ImportUploadStep'
import type { ImportOption, ReportRow } from '@/components/contractor-import/types'
import { Stepper } from '@/components/Stepper'
import { Card, CardContent } from '@/components/ui/card'

const IMPORT_STEPS = [
  { title: 'Step 1: Upload File', description: 'CSV, XLSX + Site & Month' },
  { title: 'Step 2: Review 6 Categories', description: 'Verify weights & rules' },
  { title: 'Step 3: Save Report', description: 'Persist to MySQL database' },
]

// Used until the options request answers, or when it fails offline.
const FALLBACK_SITE_OPTIONS: ImportOption[] = [
  { value: '1', label: 'Bangkok Sorting Center (DASH-BKK)' },
  { value: '2', label: 'Chiang Mai Sorting Center (DASH-CNX)' },
]
const FALLBACK_CONTRACTOR_OPTIONS: ImportOption[] = [
  { value: 'Dashboard GreenLoop Recycling', label: 'Dashboard GreenLoop Recycling' },
  { value: 'Dashboard Circular Fibre Co.', label: 'Dashboard Circular Fibre Co.' },
]

const DEFAULT_DEMO_ROWS: ReportRow[] = [
  {
    row: 1,
    binId: 'BIN-C-0047',
    contractor: 'Dashboard GreenLoop Recycling',
    storeWeight: 12.3,
    reportedWeight: 12.1,
    upcycledKg: 4.2,
    fibreToFibreKg: 4.8,
    downcycledKg: 1.8,
    exportedKg: 0.6,
    landfilledKg: 0.2,
    energyRecoveryKg: 0.2,
    uncategorizedKg: 0.3,
    status: 'Verified',
  },
  {
    row: 2,
    binId: 'BIN-C-0046',
    contractor: 'ReWeave Recyclers',
    storeWeight: 15.1,
    reportedWeight: 10.0,
    upcycledKg: 5.3,
    fibreToFibreKg: 2.7,
    downcycledKg: 1.0,
    exportedKg: 0.6,
    landfilledKg: 0.4,
    energyRecoveryKg: 0.6,
    uncategorizedKg: 0,
    status: 'Error',
    errorDetail: 'Disposition weights exceed received weight by 0.600 kg.',
  },
  {
    row: 3,
    binId: 'MISSING_ID',
    contractor: 'Loopfibre Co.',
    storeWeight: 14.0,
    reportedWeight: 13.9,
    upcycledKg: 3.5,
    fibreToFibreKg: 4.5,
    downcycledKg: 3.0,
    exportedKg: 2.0,
    landfilledKg: 0.9,
    energyRecoveryKg: 0,
    uncategorizedKg: 0,
    status: 'Error',
    errorDetail: 'Missing or invalid Bin ID format.',
  },
  {
    row: 4,
    binId: 'BIN-C-0042',
    contractor: 'Dashboard GreenLoop Recycling',
    storeWeight: 16.5,
    reportedWeight: 16.0,
    upcycledKg: 4.5,
    fibreToFibreKg: 4.0,
    downcycledKg: 3.2,
    exportedKg: 2.5,
    landfilledKg: 1.0,
    energyRecoveryKg: 0.3,
    uncategorizedKg: 0.5,
    status: 'Warning',
    errorDetail: 'Uncategorized remainder: 0.50 kg.',
  },
]

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

export default function ContractorReportImport() {
  const navigate = useNavigate()

  const [step, setStep] = useState<number>(1)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  const [sites, setSites] = useState<ContractorReportOptionItem[]>([])
  const [contractors, setContractors] = useState<ContractorReportOptionItem[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<number>(1)
  const [selectedContractor, setSelectedContractor] = useState<string>(
    'Dashboard GreenLoop Recycling',
  )
  const [reportMonth, setReportMonth] = useState<string>('2026-11')

  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [validatedRows, setValidatedRows] = useState<ReportRow[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ContractorReportImportResponse | null>(null)

  useEffect(() => {
    let active = true
    fetchContractorReportOptions()
      .then((data) => {
        if (!active) return
        setSites(data.sites)
        setContractors(data.contractors)
        if (data.sites.length > 0) {
          setSelectedSiteId(data.sites[0].id)
        }
        if (data.contractors.length > 0) {
          setSelectedContractor(data.contractors[0].name)
        }
      })
      .catch(() => {
        // Fallback options remain usable if offline
      })
    return () => {
      active = false
    }
  }, [])

  const handleFileSelected = async (file: File) => {
    setIsProcessing(true)
    setValidationError(null)
    setSaveError(null)
    try {
      const base64 = await fileToBase64(file)
      const parsed = await parseAndValidateContractorFile(file.name, base64)
      const mapped: ReportRow[] = parsed.rows.map((r) => ({
        row: r.row,
        binId: r.bin_id,
        contractor: r.contractor,
        storeWeight: r.store_weight_kg,
        reportedWeight: r.received_kg,
        upcycledKg: r.dispositions.upcycled_kg,
        fibreToFibreKg: r.dispositions.fibre_to_fibre_kg,
        downcycledKg: r.dispositions.downcycled_kg,
        exportedKg: r.dispositions.exported_kg,
        landfilledKg: r.dispositions.landfilled_kg,
        energyRecoveryKg: r.dispositions.incinerated_energy_recovery_kg,
        uncategorizedKg: r.uncategorized_weight_kg,
        status: r.status,
        errorDetail: r.errors.join(' '),
      }))
      setValidatedRows(mapped)
      setUploadedFileName(parsed.filename)
      setStep(2)
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : 'The uploaded file could not be validated.',
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleStartSampleReview = async () => {
    setIsProcessing(true)
    setValidationError(null)
    setSaveError(null)
    try {
      const response = await validateContractorReport(
        DEFAULT_DEMO_ROWS.map((row) => ({
          row: row.row,
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
      )
      const merged = DEFAULT_DEMO_ROWS.map((row) => {
        const res = response.rows.find((item) => item.row === row.row)
        return {
          ...row,
          uncategorizedKg: res?.uncategorized_weight_kg ?? row.uncategorizedKg,
          status: res && !res.is_valid ? ('Error' as const) : row.status,
          errorDetail: res && !res.is_valid ? res.errors.join(' ') : row.errorDetail,
        }
      })
      setValidatedRows(merged)
      setUploadedFileName(`contractor_report_${reportMonth}_sample.csv`)
      setStep(2)
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : 'The report could not be validated.',
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownloadTemplate = () => {
    const csvContent = [
      'bin_id,contractor,store_weight_kg,received_kg,upcycled_kg,fibre_to_fibre_kg,downcycled_kg,exported_kg,landfilled_kg,incinerated_energy_recovery_kg',
      `DASH-BKK-2026-11-RECYCLE,${selectedContractor},24.0,24.0,4.0,10.0,4.5,2.0,1.0,2.5`,
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'contractor_monthly_report_template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const savableRows = validatedRows.filter((row) => row.status !== 'Error')

  const handleSaveRecords = async () => {
    if (savableRows.length === 0) {
      setSaveError('No valid rows available to import. Please fix the rejected rows first.')
      return
    }
    setIsSaving(true)
    setSaveError(null)
    try {
      const response = await importContractorReport({
        site_id: selectedSiteId,
        contractor_name: selectedContractor,
        report_month: reportMonth,
        source_filename: uploadedFileName ?? `report_${reportMonth}.csv`,
        rows: savableRows.map((row) => ({
          row: row.row,
          bin_id: row.binId,
          contractor: row.contractor,
          store_weight_kg: row.storeWeight,
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

  const siteOptions = sites.length
    ? sites.map((site) => ({ value: String(site.id), label: `${site.name} (${site.code})` }))
    : FALLBACK_SITE_OPTIONS
  const contractorOptions = contractors.length
    ? contractors.map((contractor) => ({ value: contractor.name, label: contractor.name }))
    : FALLBACK_CONTRACTOR_OPTIONS
  const selectedSiteLabel =
    sites.find((s) => s.id === selectedSiteId)?.name ?? `Site #${selectedSiteId}`

  return (
    <div className="flex w-full flex-col gap-6">
      <Stepper steps={IMPORT_STEPS} current={step} />

      <Card>
        <CardContent className="p-6 md:p-8">
          {step === 1 ? (
            <ImportUploadStep
              siteOptions={siteOptions}
              siteId={String(selectedSiteId)}
              onSiteChange={(value) => setSelectedSiteId(Number(value))}
              contractorOptions={contractorOptions}
              contractor={selectedContractor}
              onContractorChange={setSelectedContractor}
              reportMonth={reportMonth}
              onReportMonthChange={setReportMonth}
              isProcessing={isProcessing}
              error={validationError}
              onFileSelected={(file) => void handleFileSelected(file)}
              onDownloadTemplate={handleDownloadTemplate}
              onNext={() => void handleStartSampleReview()}
              onCancel={() => navigate('/manager')}
            />
          ) : null}

          {step === 2 ? (
            <ImportReviewStep
              rows={validatedRows}
              siteLabel={selectedSiteLabel}
              reportMonth={reportMonth}
              fileName={uploadedFileName}
              contractor={selectedContractor}
              savableCount={savableRows.length}
              isSaving={isSaving}
              error={saveError}
              onBack={() => setStep(1)}
              onSave={() => void handleSaveRecords()}
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
