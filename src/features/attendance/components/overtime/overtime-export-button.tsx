import { useState } from 'react'
import { toast } from 'sonner'

import { DownloadCircleIcon } from '@/components/icons/attendance-menu-icons'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'

import { overtimeApi } from '../../api/overtime.api'
import type { OvertimeExportParams } from '../../types/overtime.types'
import { overtimeOutlineButtonClass } from '../../utils/overtime-styles'

/**
 * "Export": the list as the API exports it (`GET /requests/overtime/export` with the tab's view
 * and filters, every page), saved as a CSV file.
 */
export function OvertimeExportButton({
  params,
  disabled = false,
}: {
  params: OvertimeExportParams
  disabled?: boolean
}) {
  const [exporting, setExporting] = useState(false)
  return (
    <Button
      variant="outline"
      disabled={disabled || exporting}
      onClick={() => {
        setExporting(true)
        overtimeApi
          .exportCsv(params)
          .catch((error: unknown) => {
            toast.error(error instanceof ApiError ? error.message : 'Could not export the list.')
          })
          .finally(() => {
            setExporting(false)
          })
      }}
      className={overtimeOutlineButtonClass}
    >
      <DownloadCircleIcon className="size-5" /> {exporting ? 'Exporting…' : 'Export'}
    </Button>
  )
}
