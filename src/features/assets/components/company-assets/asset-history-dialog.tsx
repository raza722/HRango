import { Fragment, useState } from 'react'
import { Minus, Plus } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { formatLong, NoRecord, PayrollDialog } from '@/features/payroll'
import { cn } from '@/lib/utils'

import {
  ASSET_ACTION_LABELS,
  ASSET_CONDITION_LABELS,
  ASSET_FIELD_LABELS,
  ASSET_STATUS_LABELS,
  RETURN_STATUS_LABELS,
} from '../../constants'
import { useAssetHistory, useAssetTypeOptions } from '../../hooks/use-assets'
import type { AssetHistoryRow } from '../../types/assets.types'

interface Change {
  field: string
  oldValue: string
  newValue: string
}

/** One line of the popup: an action at a moment by someone, with the fields it changed. */
interface Entry {
  id: string
  action: string
  performedAt: string
  performedBy: string
  changes: Change[]
}

const RETURN_LABELS: Partial<Record<string, string>> = RETURN_STATUS_LABELS

const LABEL_MAPS: Partial<Record<string, Partial<Record<string, string>>>> = {
  asset_condition: ASSET_CONDITION_LABELS,
  status: ASSET_STATUS_LABELS,
  is_taxable: { '0': 'No', '1': 'Yes', false: 'No', true: 'Yes' },
}

/**
 * The server sends one row per changed field; rows of the same action, moment and person
 * become one line. Type ids read as names, codes as labels.
 */
function toEntries(rows: readonly AssetHistoryRow[], typeNames: ReadonlyMap<string, string>) {
  const show = (field: string | null, value: string | null) => {
    if (value === null || value === '') return ''
    if (field === 'asset_type_id') return typeNames.get(value) ?? value
    if (field === 'file_id') return 'Attached'
    if (field === 'holder') return RETURN_LABELS[value] ?? value
    return (field && LABEL_MAPS[field]?.[value]) ?? value
  }
  const entries: Entry[] = []
  const byKey = new Map<string, Entry>()
  for (const row of rows) {
    const key = `${row.action}|${row.performedAt}|${row.performedByUserId ?? ''}`
    let entry = byKey.get(key)
    if (!entry) {
      entry = {
        id: row.id,
        action: ASSET_ACTION_LABELS[row.action] ?? row.action,
        performedAt: row.performedAt,
        performedBy: row.performedByName ?? 'System',
        changes: [],
      }
      byKey.set(key, entry)
      entries.push(entry)
    }
    if (row.fieldName) {
      entry.changes.push({
        field: ASSET_FIELD_LABELS[row.fieldName] ?? row.fieldName,
        oldValue: show(row.fieldName, row.oldValue),
        newValue: show(row.fieldName, row.newValue),
      })
    }
  }
  return entries
}

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
  const types = useAssetTypeOptions()
  const typeNames = new Map((types.data ?? []).map((type) => [type.id, type.name]))
  const entries = toEntries(history.data ?? [], typeNames)
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
                  Performed By
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
                const label = entry.performedBy
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
