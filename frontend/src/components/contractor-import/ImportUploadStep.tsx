import { useRef, type ChangeEvent, type DragEvent } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Download,
  FileSpreadsheet,
  HelpCircle,
  LoaderCircle,
  UploadCloud,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ImportOption } from './types'

const FORMATTING_GUIDE =
  'Formatting guide: Include bin_id, contractor, received_kg, and all 6 disposition categories (upcycled_kg, fibre_to_fibre_kg, downcycled_kg, exported_kg, landfilled_kg, incinerated_energy_recovery_kg).'

interface ImportUploadStepProps {
  siteOptions: readonly ImportOption[]
  siteId: string
  onSiteChange: (value: string) => void
  contractorOptions: readonly ImportOption[]
  contractor: string
  onContractorChange: (value: string) => void
  reportMonth: string
  onReportMonthChange: (value: string) => void
  isProcessing: boolean
  error: string | null
  onFileSelected: (file: File) => void
  onDownloadTemplate: () => void
  onNext: () => void
  onCancel: () => void
}

function OptionSelect({
  id,
  value,
  options,
  onChange,
}: {
  id: string
  value: string
  options: readonly ImportOption[]
  onChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="[&>span]:truncate">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Step 1: choose the site, month, and contractor, then upload a file or review the sample. */
export function ImportUploadStep({
  siteOptions,
  siteId,
  onSiteChange,
  contractorOptions,
  contractor,
  onContractorChange,
  reportMonth,
  onReportMonthChange,
  isProcessing,
  error,
  onFileSelected,
  onDownloadTemplate,
  onNext,
  onCancel,
}: ImportUploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) onFileSelected(file)
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (file) onFileSelected(file)
  }

  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-sm font-semibold text-foreground">Upload File</h3>

      <FieldGroup className="grid gap-4 md:grid-cols-3">
        <Field className="gap-1.5">
          <FieldLabel htmlFor="site-select">Sorting Center (Site)</FieldLabel>
          <OptionSelect
            id="site-select"
            value={siteId}
            options={siteOptions}
            onChange={onSiteChange}
          />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="report-month">Report Month</FieldLabel>
          <Input
            id="report-month"
            type="month"
            value={reportMonth}
            onChange={(event) => event.target.value && onReportMonthChange(event.target.value)}
          />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="contractor-select">Contractor</FieldLabel>
          <OptionSelect
            id="contractor-select"
            value={contractor}
            options={contractorOptions}
            onChange={onContractorChange}
          />
        </Field>
      </FieldGroup>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx"
        onChange={handleFileInputChange}
        className="hidden"
        aria-label="Contractor report file"
      />

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center transition-colors hover:border-primary/60 md:p-14"
      >
        {isProcessing ? (
          <div role="status" className="flex flex-col items-center gap-3 py-6">
            <LoaderCircle className="size-8 animate-spin text-primary" aria-hidden="true" />
            <p className="text-xs font-semibold text-foreground">
              Parsing spreadsheet & validating 6 disposition categories...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UploadCloud className="size-6" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-foreground">Drag and drop file here or</p>
            <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()}>
              Choose file
            </Button>
          </div>
        )}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col justify-between gap-1 border-b pb-4 text-xs text-muted-foreground sm:flex-row">
        <span>Supported Formats: CSV, XLSX (6 EPR disposition categories)</span>
        <div className="flex gap-4">
          <span>Maximum File: 1</span>
          <span>Maximum File Size: 100MB</span>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-3 rounded-xl border bg-muted/50 p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold text-foreground">Table Example Template</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Download the CSV template containing all 6 required EPR disposition categories
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start sm:self-auto"
          onClick={onDownloadTemplate}
        >
          <Download aria-hidden="true" />
          Download
        </Button>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row">
        <Button
          type="button"
          variant="link"
          size="sm"
          className="self-start px-0 text-muted-foreground sm:self-auto"
          onClick={() => alert(FORMATTING_GUIDE)}
        >
          <HelpCircle aria-hidden="true" />
          Formatting Guide
        </Button>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onNext}>
            Next
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}
