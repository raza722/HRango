import { useId, useState } from 'react'
import { Download, FileUp, Loader2 } from 'lucide-react'

import { dialogButtonClass } from '@/components/feedback/app-dialog'
import { Button } from '@/components/ui/button'

import { useImportSchedule } from '../../hooks/use-scheduling'
import type { ImportRow } from '../../types/scheduling.types'
import { IMPORT_TEMPLATE, parseScheduleCsv } from '../../utils/schedule-csv'
import { SchedulingDialog } from './scheduling-dialog'

/**
 * Import: pick a CSV (Employee Code, Date, Clock In, Clock Out, Rest Day),
 * see how many lines are good, then import. A template can be downloaded.
 */
export function ImportScheduleDialog({ onClose }: { onClose: () => void }) {
  const inputId = useId()
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const importRows = useImportSchedule()

  const read = async (file: File | undefined) => {
    if (!file) return
    setFileName(file.name)
    const parsed = parseScheduleCsv(await file.text())
    setRows(parsed.rows)
    setErrors(parsed.errors)
  }

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([IMPORT_TEMPLATE], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'schedule-import-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <SchedulingDialog
      title="Import Schedule"
      description="Upload a CSV file. Existing days for the same employee and date are replaced."
      onRequestClose={onClose}
      className="max-w-2xl"
      footer={
        <>
          <Button
            variant="success"
            size="lg"
            disabled={rows.length === 0 || importRows.isPending}
            onClick={() => {
              importRows.mutate(rows, { onSuccess: onClose })
            }}
            className={dialogButtonClass}
          >
            {importRows.isPending && <Loader2 className="animate-spin" />}
            Import
          </Button>
          <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <label
          htmlFor={inputId}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-input px-4 py-8 text-center text-sm text-field-foreground focus-within:ring-2 focus-within:ring-ring/40 hover:bg-muted"
        >
          <FileUp aria-hidden="true" className="size-8 text-primary" />
          <span className="font-medium">{fileName ?? 'Choose a CSV file'}</span>
          <span className="text-xs text-muted-foreground">
            Employee Code, Date, Clock In, Clock Out, Rest Day
          </span>
          <input
            id={inputId}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => {
              void read(event.target.files?.[0])
            }}
          />
        </label>
        <Button variant="outline" onClick={downloadTemplate} className="w-fit">
          <Download /> Download template
        </Button>
        {fileName && (
          <div aria-live="polite" className="grid gap-2 text-sm">
            <p className="text-heading">
              {rows.length} row{rows.length === 1 ? '' : 's'} ready to import
              {errors.length > 0 && `, ${errors.length} with problems`}.
            </p>
            {errors.length > 0 && (
              <ul className="scrollbar-thin max-h-32 list-disc overflow-y-auto pl-5 text-destructive">
                {errors.slice(0, 20).map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </SchedulingDialog>
  )
}
