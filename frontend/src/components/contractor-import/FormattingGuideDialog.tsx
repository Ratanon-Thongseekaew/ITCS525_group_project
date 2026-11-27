import { HelpCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { MAX_DATA_ROWS, MAX_FILE_MB, REPORT_COLUMNS } from './report-file'

const RULES = [
  'One file per contractor and month. Choose both before uploading.',
  'Each bin_id must be a bin the selected contractor picked up in the report month. Its sorting center is read from the bin.',
  'Weights are in kg: plain numbers such as 12.5, without thousands separators. A blank category counts as 0; received_kg is required.',
  'The six categories can add up to less than received_kg (flagged as uncategorized) but not more.',
  'List each bin once. A bin already reported is flagged, and saving replaces its outcomes.',
]

/** Explains the report columns and the rules each row is checked against. */
export function FormattingGuideDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="self-start px-0 text-muted-foreground sm:self-auto"
        >
          <HelpCircle aria-hidden="true" />
          Formatting Guide
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Formatting Guide</DialogTitle>
          <DialogDescription>
            CSV or XLSX, up to {MAX_FILE_MB} MB and {MAX_DATA_ROWS.toLocaleString()} rows, with
            these columns in the first row:
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-wrap gap-1.5">
          {REPORT_COLUMNS.map((column) => (
            <li key={column} className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
              {column}
            </li>
          ))}
        </ul>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
