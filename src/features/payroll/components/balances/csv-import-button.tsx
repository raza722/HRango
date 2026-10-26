import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { uploadFile } from '@/lib/files'
import { cn } from '@/lib/utils'

import type { ImportResult } from '../../types/payroll.types'
import { btn, toolbarButton } from '../../utils/styles'

/**
 * "Import File": pick a CSV, upload it (`POST /files`, module payroll), then hand its id to the
 * import (`{fileId}`). Rows the server could not read come back as errors and are shown.
 */
export function CsvImportButton({
  label = 'Import File',
  onImport,
}: {
  label?: string
  onImport: (fileId: string) => Promise<ImportResult>
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <Button
        disabled={busy}
        onClick={() => input.current?.click()}
        className={cn(toolbarButton, btn.green)}
      >
        {busy ? 'Importing…' : label}
      </Button>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        aria-label={`${label} (CSV)`}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          setBusy(true)
          uploadFile(file, 'payroll')
            .then((uploaded) => onImport(uploaded.id))
            .then((result) => {
              if (result.errors.length > 0) toast.error(result.errors.slice(0, 3).join('\n'))
            })
            .catch((error: unknown) => {
              toast.error(
                error instanceof ApiError ? error.message : 'The file could not be imported.',
              )
            })
            .finally(() => {
              setBusy(false)
            })
        }}
      />
    </>
  )
}
