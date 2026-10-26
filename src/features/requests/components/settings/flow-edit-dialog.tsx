import { useState } from 'react'
import { X } from 'lucide-react'

import { fieldControlClassName, FormField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { btn, PayrollDialog, SearchSelect, toolbarButton } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import {
  useBranchOptions,
  useDepartmentOptions,
  useRequestFlow,
  useRoleOptions,
  useSaveRequestFlow,
} from '../../hooks/use-request-settings'
import {
  FLOW_NODE_LABELS,
  FLOW_SCOPE_LABELS,
  flowRequestTypeLabel,
  joinFlowType,
} from '../../settings.constants'
import {
  FLOW_NODE_TYPES,
  FLOW_SCOPES,
  type FlowNode,
  type FlowNodeType,
  type FlowPurpose,
  type FlowScope,
  type RequestFlowDetail,
  type SettingsRequestType,
} from '../../types/request-settings.types'
import { RequestEmployeeSelect } from '../shared/request-employee-field'

/** A row being edited: the node may not be chosen yet, and the numbers are typed text. */
interface DraftRow {
  stepNo: number
  canEdit: boolean
  isObserver: boolean
  canDisagree: boolean
  isCondition: boolean
  approverKind: FlowNodeType | ''
  employeeId: string | null
  roleId: string | null
  next: string
  expression: string
  ifTrue: string
  ifFalse: string
}

const text = (value: number | null) => (value === null ? '' : String(value))
const toDraft = (node: FlowNode): DraftRow => ({
  stepNo: node.stepNo,
  canEdit: node.canEdit,
  isObserver: node.isObserver,
  canDisagree: node.canDisagree,
  isCondition: node.isCondition,
  approverKind: node.approverKind ?? '',
  employeeId: node.employeeId,
  roleId: node.roleId,
  next: text(node.next),
  expression: node.expression ?? '',
  ifTrue: text(node.ifTrue),
  ifFalse: text(node.ifFalse),
})

const FLAGS = [
  ['canEdit', 'Can Edit'],
  ['isObserver', 'On Looker'],
  ['canDisagree', 'Can Disagree'],
  ['isCondition', 'Is Condition'],
] as const

/** The node's expression, as the API reads it: `<field> <op> <number>`. */
const EXPRESSION =
  /^\s*(days|amount|minutes|department_id|branch_id|location_id|grade_id|designation_id|employment_type_id)\s*(==|=|!=|<>|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)\s*$/i

/** Grey, as drawn, while a box does not apply to its row. */
const boxClass = cn(
  fieldControlClassName,
  'h-9 px-2 text-title disabled:border-transparent disabled:bg-[#D9D9D9] disabled:opacity-100 sm:px-2 dark:disabled:bg-muted',
)

/**
 * Turns the rows into nodes, or says what to fix first: the API's rules
 * (a node per number, who decides, expressions, links to existing nodes,
 * someone who decides, no loop). Empty Next / If True / If False go to the
 * next node by number.
 */
function toNodes(rows: readonly DraftRow[]): FlowNode[] | string {
  if (rows.length === 0) return 'Add at least one node.'
  const steps = rows.map((row) => row.stepNo).sort((a, b) => a - b)
  const nodes: FlowNode[] = []
  for (const row of rows) {
    const label = `Row ${String(row.stepNo)}`
    const numbers = [row.next, row.ifTrue, row.ifFalse].map((value) =>
      value.trim() === '' ? null : Number(value),
    )
    if (numbers.some((value) => value !== null && (!Number.isInteger(value) || value < 1))) {
      return `${label}: Next, If True and If False take a row ID.`
    }
    const missing = numbers.find((value) => value !== null && !steps.includes(value))
    if (missing !== undefined && missing !== null) {
      return `${label} points at row ${String(missing)}, which does not exist.`
    }
    const [next = null, ifTrue = null, ifFalse = null] = numbers
    if (row.isCondition) {
      if (!EXPRESSION.test(row.expression)) {
        return `${label}: write the condition as <field> <operator> <number>, for example days > 3.`
      }
    } else {
      if (!row.approverKind) return `${label}: choose the node.`
      if (row.approverKind === 'employee' && !row.employeeId)
        return `${label}: choose the employee.`
      if (row.approverKind === 'role' && !row.roleId) return `${label}: choose the role.`
    }
    nodes.push({
      stepNo: row.stepNo,
      approverKind: row.isCondition || !row.approverKind ? null : row.approverKind,
      employeeId: !row.isCondition && row.approverKind === 'employee' ? row.employeeId : null,
      roleId: !row.isCondition && row.approverKind === 'role' ? row.roleId : null,
      isCondition: row.isCondition,
      expression: row.isCondition ? row.expression.trim() : null,
      next: row.isCondition ? null : next,
      ifTrue: row.isCondition ? ifTrue : null,
      ifFalse: row.isCondition ? ifFalse : null,
      canEdit: row.canEdit,
      canDisagree: row.canDisagree,
      isObserver: row.isObserver,
    })
  }
  if (!nodes.some((node) => !node.isCondition && !node.isObserver)) {
    return 'A flow needs at least one node where someone decides.'
  }
  // Loops: every walk must reach the end.
  const following = (stepNo: number) => steps.find((value) => value > stepNo) ?? null
  const edges = new Map(
    nodes.map((node) => [
      node.stepNo,
      (node.isCondition
        ? [node.ifTrue ?? following(node.stepNo), node.ifFalse ?? following(node.stepNo)]
        : [node.next ?? following(node.stepNo)]
      ).filter((value): value is number => value !== null),
    ]),
  )
  const state = new Map<number, 1 | 2>()
  const visit = (stepNo: number): number | null => {
    state.set(stepNo, 1)
    for (const target of edges.get(stepNo) ?? []) {
      if (state.get(target) === 1) return target
      if (!state.has(target)) {
        const loop = visit(target)
        if (loop !== null) return loop
      }
    }
    state.set(stepNo, 2)
    return null
  }
  for (const stepNo of steps) {
    if (state.has(stepNo)) continue
    const loop = visit(stepNo)
    if (loop !== null) return `The flow goes round in a loop through row ${String(loop)}.`
  }
  return nodes
}

const blankRow = (stepNo: number): DraftRow => ({
  stepNo,
  canEdit: false,
  isObserver: false,
  canDisagree: false,
  isCondition: false,
  approverKind: '',
  employeeId: null,
  roleId: null,
  next: '',
  expression: '',
  ifTrue: '',
  ifFalse: '',
})

/**
 * "Request Flow Edit" / Create: the flow's name, whom it applies to (the
 * company, a branch, a department or one employee), and its nodes: who acts
 * (Line Manager, HOD, an authority, an employee, a role …), what they may do,
 * and where the flow goes next; a condition node routes by its expression.
 * Saving an existing flow stores a new version.
 */
export function FlowEditDialog({
  requestType,
  purpose,
  flowId,
  onSaved,
  onClose,
}: {
  requestType: SettingsRequestType
  purpose: FlowPurpose
  flowId: string | null
  onSaved?: (id: string) => void
  onClose: () => void
}) {
  const flow = useRequestFlow(flowId)
  if (flowId && !flow.data) {
    return (
      <PayrollDialog title="Request Flow Edit" onClose={onClose} readOnly className="max-w-7xl">
        <Skeleton className="h-64 w-full" />
      </PayrollDialog>
    )
  }
  return (
    <FlowForm
      requestType={requestType}
      purpose={purpose}
      flow={flow.data}
      onSaved={onSaved}
      onClose={onClose}
    />
  )
}

function FlowForm({
  requestType,
  purpose,
  flow,
  onSaved,
  onClose,
}: {
  requestType: SettingsRequestType
  purpose: FlowPurpose
  flow: RequestFlowDetail | undefined
  onSaved: ((id: string) => void) | undefined
  onClose: () => void
}) {
  const branches = useBranchOptions()
  const departments = useDepartmentOptions()
  const roles = useRoleOptions(useCan('access.roles.view'))
  const save = useSaveRequestFlow()
  const [name, setName] = useState(flow?.name ?? '')
  const [scopeType, setScopeType] = useState<FlowScope>(flow?.scopeType ?? 'company')
  const [scopeId, setScopeId] = useState<string | null>(flow?.scopeId ?? null)
  const [description, setDescription] = useState(flow?.description ?? '')
  const [isActive, setIsActive] = useState(flow?.isActive ?? true)
  const [rows, setRows] = useState<DraftRow[]>(() =>
    flow ? flow.nodes.map(toDraft) : [blankRow(1)],
  )
  const [error, setError] = useState<string | null>(null)
  const permission = 'requests.settings.flows.view'
  // The flow's saved people stay named when they have left.
  const savedPeople = [
    ...(flow?.scopeType === 'employee' ? [{ id: flow.scopeId, name: flow.scopeName }] : []),
    ...(flow?.nodes ?? []).map((node) => ({ id: node.employeeId, name: node.employeeName })),
  ]
  const roleOptions = (roles.data ?? []).map((role) => ({ value: role.id, label: role.name }))
  const scopeOptions = (
    scopeType === 'branch' ? (branches.data ?? []) : (departments.data ?? [])
  ).map((unit) => ({
    value: unit.id,
    label: unit.name,
  }))

  const patch = (stepNo: number, change: Partial<DraftRow>) => {
    setError(null)
    setRows((current) =>
      current.map((row) => (row.stepNo === stepNo ? { ...row, ...change } : row)),
    )
  }
  const addNode = () => {
    setError(null)
    setRows((current) => [
      ...current,
      blankRow(Math.max(0, ...current.map((row) => row.stepNo)) + 1),
    ])
  }

  const submit = () => {
    if (!name.trim()) {
      setError('Give the flow a name.')
      return
    }
    if (scopeType !== 'company' && !scopeId) {
      setError('Choose the branch, department or employee this flow is for.')
      return
    }
    const nodes = toNodes(rows)
    if (typeof nodes === 'string') {
      setError(nodes)
      return
    }
    save.mutate(
      {
        id: flow?.id ?? null,
        input: {
          requestType,
          purpose,
          name: name.trim(),
          scopeType,
          scopeId: scopeType === 'company' ? null : scopeId,
          description: description.trim() === '' ? null : description.trim(),
          isActive,
          nodes,
          rowVersion: flow?.rowVersion,
        },
      },
      {
        onSuccess: (saved) => {
          onSaved?.(saved.id)
          onClose()
        },
        onError: (failure) => {
          setError(failure instanceof ApiError ? failure.message : 'Could not save the flow.')
        },
      },
    )
  }

  return (
    <PayrollDialog
      title={flow ? 'Request Flow Edit' : 'Request Flow Create'}
      onClose={onClose}
      onSave={submit}
      pending={save.isPending}
      error={error}
      className="max-w-7xl"
    >
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          {flowRequestTypeLabel(joinFlowType(requestType, purpose))}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Name" required>
            {(a11y) => (
              <Input
                {...a11y}
                value={name}
                maxLength={200}
                onChange={(event) => {
                  setName(event.target.value)
                  setError(null)
                }}
              />
            )}
          </FormField>
          <FormField label="Applies To" required>
            {(a11y) => (
              <SearchSelect
                {...a11y}
                value={scopeType}
                onChange={(next) => {
                  setScopeType((next ?? 'company') as FlowScope)
                  setScopeId(null)
                  setError(null)
                }}
                placeholder="Select Applies To"
                options={FLOW_SCOPES.map((scope) => ({
                  value: scope,
                  label: FLOW_SCOPE_LABELS[scope],
                }))}
              />
            )}
          </FormField>
          {scopeType !== 'company' && (
            <FormField label={FLOW_SCOPE_LABELS[scopeType]} required>
              {(a11y) =>
                scopeType === 'employee' ? (
                  <RequestEmployeeSelect
                    {...a11y}
                    permission={permission}
                    current={savedPeople}
                    value={scopeId}
                    onChange={(next) => {
                      setScopeId(next)
                      setError(null)
                    }}
                    placeholder={`Select ${FLOW_SCOPE_LABELS[scopeType]}`}
                  />
                ) : (
                  <SearchSelect
                    {...a11y}
                    value={scopeId}
                    onChange={(next) => {
                      setScopeId(next)
                      setError(null)
                    }}
                    options={[
                      ...scopeOptions,
                      ...(flow?.scopeId &&
                      flow.scopeType === scopeType &&
                      !scopeOptions.some((item) => item.value === flow.scopeId)
                        ? [{ value: flow.scopeId, label: flow.scopeName ?? flow.scopeId }]
                        : []),
                    ]}
                    placeholder={`Select ${FLOW_SCOPE_LABELS[scopeType]}`}
                  />
                )
              }
            </FormField>
          )}
          <FormField label="Description">
            {(a11y) => (
              <Textarea
                {...a11y}
                rows={2}
                maxLength={4000}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value)
                }}
              />
            )}
          </FormField>
          <label className="flex items-center gap-2 text-sm text-title">
            <Checkbox
              tone="navy"
              checked={isActive}
              onCheckedChange={(checked) => {
                setIsActive(checked === true)
              }}
            />
            Active
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Empty Next / If True / If False go to the next node by number. A condition reads days,
            amount, minutes, department_id, branch_id, location_id, grade_id, designation_id or
            employment_type_id, e.g. days &gt; 3.
          </p>
          <Button type="button" onClick={addNode} className={cn(toolbarButton, btn.navy)}>
            Add Node
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] border-separate border-spacing-0 text-sm text-title">
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
                <th scope="col">Employee / Role</th>
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
                const name = `row ${String(row.stepNo)}`
                const picksRole = !row.isCondition && row.approverKind === 'role'
                const picksPerson = !row.isCondition && row.approverKind === 'employee'
                return (
                  <tr key={row.stepNo} className="align-top [&_td]:px-2 [&_td]:py-2">
                    <td className="pt-4 text-center">{row.stepNo}</td>
                    {FLAGS.map(([key, label]) => (
                      <td key={key} className="pt-4 text-center">
                        <Checkbox
                          tone="navy"
                          aria-label={`${label}, ${name}`}
                          checked={row[key]}
                          onCheckedChange={(checked) => {
                            patch(row.stepNo, { [key]: checked === true })
                          }}
                        />
                      </td>
                    ))}
                    <td>
                      <select
                        aria-label={`Node, ${name}`}
                        value={row.approverKind}
                        disabled={row.isCondition}
                        onChange={(event) => {
                          const approverKind = event.target.value as FlowNodeType | ''
                          patch(row.stepNo, {
                            approverKind,
                            employeeId: approverKind === 'employee' ? row.employeeId : null,
                            roleId: approverKind === 'role' ? row.roleId : null,
                          })
                        }}
                        className={cn(boxClass, 'min-w-36')}
                      >
                        <option value="">Select Node</option>
                        {FLOW_NODE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {FLOW_NODE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="min-w-44">
                      {picksRole ? (
                        <SearchSelect
                          aria-label={`Role, ${name}`}
                          value={row.roleId}
                          onChange={(value) => {
                            patch(row.stepNo, { roleId: value })
                          }}
                          options={roleOptions}
                          placeholder="Select Role"
                          className="h-9"
                        />
                      ) : (
                        <RequestEmployeeSelect
                          aria-label={`Employee, ${name}`}
                          permission={permission}
                          current={savedPeople}
                          enabled={picksPerson}
                          value={row.employeeId}
                          onChange={(value) => {
                            patch(row.stepNo, { employeeId: value })
                          }}
                          placeholder="Select Employee"
                          disabled={!picksPerson}
                          className={cn(
                            'h-9',
                            !picksPerson &&
                              'border-transparent bg-[#D9D9D9] opacity-100 dark:bg-muted',
                          )}
                        />
                      )}
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
                          patch(row.stepNo, { next: event.target.value })
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
                          patch(row.stepNo, { expression: event.target.value })
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
                            patch(row.stepNo, { [key]: event.target.value })
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
                          setRows((current) => current.filter((item) => item.stepNo !== row.stepNo))
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
