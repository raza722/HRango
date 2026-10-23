import { useState } from 'react'
import { X } from 'lucide-react'

import { fieldControlClassName } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { btn, PayrollDialog, SearchSelect, toolbarButton } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { useRequestSettingsLookups, useSaveRequestFlow } from '../../hooks/use-request-settings'
import { FLOW_NODE_LABELS, flowRequestTypeLabel } from '../../settings.constants'
import {
  FLOW_NODE_TYPES,
  type FlowNode,
  type FlowNodeType,
  type FlowRequestType,
} from '../../types/request-settings.types'

/** A row being edited: the node may not be chosen yet, and the numbers are typed text. */
interface DraftRow {
  id: number
  canEdit: boolean
  onLooker: boolean
  canDisagree: boolean
  isCondition: boolean
  node: FlowNodeType | ''
  employeeId: string | null
  next: string
  expression: string
  ifTrue: string
  ifFalse: string
}

const text = (value: number | null) => (value === null ? '' : String(value))
const toDraft = (node: FlowNode): DraftRow => ({
  ...node,
  next: text(node.next),
  ifTrue: text(node.ifTrue),
  ifFalse: text(node.ifFalse),
})

const FLAGS = [
  ['canEdit', 'Can Edit'],
  ['onLooker', 'On Looker'],
  ['canDisagree', 'Can Disagree'],
  ['isCondition', 'Is Condition'],
] as const

const choosesPerson = (node: FlowNodeType | '') => node === 'employee' || node === 'consentee'

/** Grey, as drawn, while a box does not apply to its row. */
const boxClass = cn(
  fieldControlClassName,
  'h-9 px-2 text-title disabled:border-transparent disabled:bg-[#D9D9D9] disabled:opacity-100 sm:px-2 dark:disabled:bg-muted',
)

/** Turns the rows into nodes, or says what to fix first. */
function toNodes(rows: DraftRow[]): FlowNode[] | string {
  const nodes: FlowNode[] = []
  for (const row of rows) {
    const label = `Row ${String(row.id)}`
    if (!row.node) return `${label}: choose the node.`
    const numbers = [row.next, row.ifTrue, row.ifFalse].map((value) =>
      value.trim() === '' ? null : Number(value),
    )
    if (numbers.some((value) => value !== null && (!Number.isInteger(value) || value < 1))) {
      return `${label}: Next, If True and If False take a row ID.`
    }
    const [next = null, ifTrue = null, ifFalse = null] = numbers
    nodes.push({
      id: row.id,
      canEdit: row.canEdit,
      onLooker: row.onLooker,
      canDisagree: row.canDisagree,
      isCondition: row.isCondition,
      node: row.node,
      employeeId: choosesPerson(row.node) ? row.employeeId : null,
      next: row.isCondition ? null : next,
      expression: row.isCondition ? row.expression : '',
      ifTrue: row.isCondition ? ifTrue : null,
      ifFalse: row.isCondition ? ifFalse : null,
    })
  }
  return nodes
}

/**
 * "Request Flow Edit": the steps of a request type's approval flow. Each row
 * is a node (who acts), what they may do, and where the flow goes next; a
 * condition row sends it to If True or If False by its expression. The
 * frame has Cancel only: Save is added so the changes can be kept.
 */
export function FlowEditDialog({
  requestType,
  nodes,
  onClose,
}: {
  requestType: FlowRequestType
  nodes: FlowNode[]
  onClose: () => void
}) {
  const lookups = useRequestSettingsLookups()
  const save = useSaveRequestFlow()
  const [rows, setRows] = useState<DraftRow[]>(() => nodes.map(toDraft))
  const [error, setError] = useState<string | null>(null)
  const employeeOptions = (lookups.data?.employees ?? []).map((person) => ({
    value: person.id,
    label: person.name,
    hint: person.code,
  }))

  const patch = (id: number, change: Partial<DraftRow>) => {
    setError(null)
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row)))
  }
  const addNode = () => {
    setError(null)
    setRows((current) => {
      const id = Math.max(0, ...current.map((row) => row.id)) + 1
      return [
        ...current,
        {
          id,
          canEdit: true,
          onLooker: false,
          canDisagree: false,
          isCondition: false,
          node: '',
          employeeId: null,
          next: '',
          expression: '',
          ifTrue: '',
          ifFalse: '',
        },
      ]
    })
  }

  const submit = () => {
    const result = toNodes(rows)
    if (typeof result === 'string') {
      setError(result)
      return
    }
    save.mutate(
      { requestType, nodes: result },
      {
        onSuccess: onClose,
        onError: (failure) => {
          setError(failure instanceof ApiError ? failure.message : 'Could not save the flow.')
        },
      },
    )
  }

  return (
    <PayrollDialog
      title="Request Flow Edit"
      onClose={onClose}
      onSave={submit}
      pending={save.isPending}
      error={error}
      className="max-w-7xl"
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{flowRequestTypeLabel(requestType)}</p>
          <Button type="button" onClick={addNode} className={cn(toolbarButton, btn.navy)}>
            Add Node
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] border-separate border-spacing-0 text-sm text-title">
            <caption className="sr-only">Nodes of the flow</caption>
            <thead>
              <tr className="[&_th]:h-10 [&_th]:bg-[#17263A]/[0.06] [&_th]:px-2 [&_th]:text-sm [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-[#303030] dark:[&_th]:bg-muted dark:[&_th]:text-heading [&_th:first-child]:rounded-l-md [&_th:last-child]:rounded-r-md">
                <th scope="col">ID</th>
                {FLAGS.map(([, label]) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
                <th scope="col">Node</th>
                <th scope="col">Employee</th>
                <th scope="col">Next</th>
                <th scope="col">Expression</th>
                <th scope="col">If True</th>
                <th scope="col">If False</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-2 py-6 text-center text-muted-foreground">
                    No nodes yet. Add Node puts in the first step.
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const name = `row ${String(row.id)}`
                return (
                  <tr key={row.id} className="align-top [&_td]:px-2 [&_td]:py-2">
                    <td className="pt-4 text-center">{row.id}</td>
                    {FLAGS.map(([key, label]) => (
                      <td key={key} className="pt-4 text-center">
                        <Checkbox
                          tone="navy"
                          aria-label={`${label}, ${name}`}
                          checked={row[key]}
                          onCheckedChange={(checked) => {
                            patch(row.id, { [key]: checked === true })
                          }}
                        />
                      </td>
                    ))}
                    <td>
                      <select
                        aria-label={`Node, ${name}`}
                        value={row.node}
                        onChange={(event) => {
                          const node = event.target.value as FlowNodeType | ''
                          patch(row.id, {
                            node,
                            employeeId: choosesPerson(node) ? row.employeeId : null,
                          })
                        }}
                        className={cn(boxClass, 'min-w-32')}
                      >
                        <option value="">Select Node</option>
                        {FLOW_NODE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {FLOW_NODE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="min-w-40">
                      <SearchSelect
                        aria-label={`Employee, ${name}`}
                        value={row.employeeId}
                        onChange={(employeeId) => {
                          patch(row.id, { employeeId })
                        }}
                        options={employeeOptions}
                        placeholder="Select Employee"
                        disabled={!choosesPerson(row.node)}
                        className={cn(
                          'h-9',
                          !choosesPerson(row.node) &&
                            'border-transparent bg-[#D9D9D9] opacity-100 dark:bg-muted',
                        )}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        aria-label={`Next, ${name}`}
                        value={row.next}
                        disabled={row.isCondition}
                        onChange={(event) => {
                          patch(row.id, { next: event.target.value })
                        }}
                        className={cn(boxClass, 'w-16')}
                      />
                    </td>
                    <td>
                      <textarea
                        aria-label={`Expression, ${name}`}
                        value={row.expression}
                        disabled={!row.isCondition}
                        placeholder={row.isCondition ? 'days > 3' : undefined}
                        rows={2}
                        onChange={(event) => {
                          patch(row.id, { expression: event.target.value })
                        }}
                        className={cn(boxClass, 'h-auto min-h-14 w-28 py-1.5')}
                      />
                    </td>
                    {(['ifTrue', 'ifFalse'] as const).map((key) => (
                      <td key={key}>
                        <input
                          type="number"
                          min={1}
                          inputMode="numeric"
                          aria-label={`${key === 'ifTrue' ? 'If True' : 'If False'}, ${name}`}
                          value={row[key]}
                          disabled={!row.isCondition}
                          onChange={(event) => {
                            patch(row.id, { [key]: event.target.value })
                          }}
                          className={cn(boxClass, 'w-16')}
                        />
                      </td>
                    ))}
                    <td className="pt-3.5 text-center">
                      <button
                        type="button"
                        aria-label={`Remove ${name}`}
                        onClick={() => {
                          setError(null)
                          setRows((current) => current.filter((item) => item.id !== row.id))
                        }}
                        className="inline-flex size-5 items-center justify-center rounded-full bg-[#E50141] text-white outline-none hover:bg-[#E50141]/90 focus-visible:ring-2 focus-visible:ring-ring/60"
                      >
                        <X aria-hidden="true" className="size-3" strokeWidth={3} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PayrollDialog>
  )
}
