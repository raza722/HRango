import { Fragment, useState } from 'react'
import { Minus, Plus } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { formatLong, NoRecord, PayrollDialog } from '@/features/payroll'
import { cn } from '@/lib/utils'

import { useAssetHistory } from '../../hooks/use-assets'

/** Figma "Company Assets History": headings Poppins Medium 16 #303030, rows Poppins Medium 18 #303030. */
const headText = 'text-base text-title'
const cellText = 'text-base font-medium text-title sm:text-lg'

/**
 * "Asset History": who did what and when; each line opens to the fields it
 * changed (Field, Old Value, New Value). The newest line starts open.
 */
export function AssetHistoryDialog({
  assetId,
  assetName,
  onClose,
}: {
  assetId: string
  assetName: string
  onClose: () => void
}) {
  const history = useAssetHistory(assetId)
  const entries = history.data ?? []
  const [open, setOpen] = useState<Set<string> | null>(null)
  // Until the person toggles a line, the newest one is open.
  const expanded = open ?? new Set(entries.slice(0, 1).map((entry) => entry.id))
  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOpen(next)
  }

  return (
    <PayrollDialog title="Asset History" onClose={onClose} readOnly className="max-w-5xl">
      {history.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : entries.length === 0 ? (
        <NoRecord />
      ) : (
        <div className="-mx-1 scrollbar-thin overflow-x-auto px-1">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="sr-only">History of {assetName}</caption>
            <thead>
              <tr className={cn('bg-[#17263A]/[0.06] dark:bg-muted', headText)}>
                <th scope="col" className="py-3 pr-3 pl-12 font-medium">
                  Employee
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Action
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Performed At
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isOpen = expanded.has(entry.id)
                const label = `${entry.performedBy.name} - ${entry.performedBy.code}`
                return (
                  <Fragment key={entry.id}>
                    <tr className={cn('border-b last:border-b-0', cellText)}>
                      <td className="py-3 pr-3">
                        <span className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-label={`${isOpen ? 'Hide' : 'Show'} the changes of ${entry.action}, ${formatLong(entry.performedAt.slice(0, 10))}`}
                            onClick={() => {
                              toggle(entry.id)
                            }}
                            className="flex size-8 shrink-0 items-center justify-center rounded text-heading outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
                          >
                            {isOpen ? (
                              <Minus aria-hidden="true" className="size-4" />
                            ) : (
                              <Plus aria-hidden="true" className="size-4" />
                            )}
                          </button>
                          <span>{label}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3">{entry.action}</td>
                      <td className="px-3 py-3">{formatLong(entry.performedAt.slice(0, 10))}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={3} className="pb-4 pl-2">
                          {entry.changes.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-muted-foreground">
                              No fields changed.
                            </p>
                          ) : (
                            <table className="w-full max-w-[56rem] text-left text-sm">
                              <caption className="sr-only">
                                Fields changed by {entry.action}
                              </caption>
                              <thead>
                                <tr className={cn('bg-[#17263A]/[0.06] dark:bg-muted', headText)}>
                                  <th scope="col" className="rounded-l-md px-5 py-2.5 font-medium">
                                    Field
                                  </th>
                                  <th scope="col" className="px-5 py-2.5 text-center font-medium">
                                    Old Value
                                  </th>
                                  <th
                                    scope="col"
                                    className="rounded-r-md px-5 py-2.5 text-center font-medium"
                                  >
                                    New Value
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {entry.changes.map((change) => (
                                  <tr key={change.field} className={cellText}>
                                    <td className="px-5 py-2.5">{change.field}</td>
                                    <td className="px-5 py-2.5 text-center">
                                      {change.oldValue || '—'}
                                    </td>
                                    <td className="px-5 py-2.5 text-center">
                                      {change.newValue || '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </PayrollDialog>
  )
}
