import { AppDialog } from '@/components/feedback/app-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { ChangeLogEntry } from '../../types/payroll.types'
import { formatStamp } from '../../utils/format'
import { btn, footerButton } from '../../utils/styles'
import { NoRecord } from './no-record'

/** "History": Field, Old Value, New Value, Action, Performed At and by whom. */
export function ChangeLogDialog({
  title = 'History',
  entries,
  onClose,
}: {
  title?: string
  entries: readonly ChangeLogEntry[]
  onClose: () => void
}) {
  return (
    <AppDialog
      title={title}
      onRequestClose={onClose}
      className="max-w-4xl"
      footer={
        <Button onClick={onClose} className={cn(footerButton, btn.red)}>
          Cancel
        </Button>
      }
    >
      {entries.length === 0 ? (
        <NoRecord />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-heading/60">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-heading/60 font-inter text-base text-heading sm:text-2xl">
                <th scope="col" className="px-5 py-3 font-medium">
                  Field
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Old Value
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  New Value
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Action
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Performed At
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b text-sm font-medium text-person last:border-b-0 sm:text-base"
                >
                  <td className="px-5 py-3">{entry.field}</td>
                  <td className="px-5 py-3">{entry.oldValue}</td>
                  <td className="px-5 py-3">{entry.newValue}</td>
                  <td className="px-5 py-3">{entry.action}</td>
                  <td className="px-5 py-3">
                    {formatStamp(entry.performedAt)}
                    <span className="block text-xs font-normal text-grey">
                      by {entry.performedBy}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppDialog>
  )
}
