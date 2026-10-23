import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  FLOW_AUTHORITIES,
  FLOW_NODE_TYPES,
  FLOW_REQUEST_TYPES,
  type FlowAssignmentRow,
  type FlowNode,
  type FlowNodeRow,
  type FlowRequestType,
  type RequestDelegation,
  type RequestDelegationRow,
  type RequestFlowDefinition,
  type RequestRestriction,
  type RequestRestrictionRow,
  type RequestSettingsLookups,
  SETTINGS_REQUEST_TYPE_LABELS,
  SETTINGS_REQUEST_TYPES,
} from '@/features/requests'
import type { ApiItem, Paginated } from '@/types/api'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { profileOf } from '../scheduling/seed'
import { branches } from '../settings/handlers'
import { COMPANIES } from '../settings/seed'
import {
  apiPath,
  createId,
  errorResponse,
  latency,
  paginate,
  readPageParams,
  requireAuth,
} from '../utils'
import { ME, ref } from './people'
import {
  assignmentId,
  authoritiesOf,
  companyOf,
  flowAssignments,
  flowDefinition,
  requestDelegations,
  requestFlows,
  requestRestrictions,
} from './settings-db'

export { resetRequestSettingsDb } from './settings-db'

const base = (path: string) => apiPath(`/requests/settings${path}`)
const invalid = (message: string, fieldErrors?: Record<string, string>) =>
  errorResponse(422, message, {
    code: 'VALIDATION_FAILED',
    ...(fieldErrors ? { fieldErrors } : {}),
  })
const notFound = (what: string) =>
  errorResponse(404, `That ${what} could not be found.`, { code: 'NOT_FOUND' })
const now = () => new Date().toISOString()

async function readBody<T>(request: Request, schema: z.ZodType<T>) {
  const body: unknown = await request.json().catch(() => null)
  return schema.safeParse(body)
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const ids = z.object({ ids: z.array(z.string()).min(1) })
const typeLabel = (type: string) =>
  SETTINGS_REQUEST_TYPE_LABELS[type as keyof typeof SETTINGS_REQUEST_TYPE_LABELS]
const isFlowType = (value: unknown): value is FlowRequestType =>
  (FLOW_REQUEST_TYPES as readonly unknown[]).includes(value)

const companyName = (id: string) => COMPANIES.find((company) => company.id === id)?.name ?? id
const active = () => DIRECTORY.filter((employee) => profileOf(employee).status === 'active')

/** Keeps the rows whose value lies within the optional `from`…`to` range. */
const within = (value: string, from: string | null, to: string | null) =>
  (!from || value >= from) && (!to || value <= to)

// --- Request Restriction -----------------------------------------------------------------------

const restrictionSchema = z.object({
  requestType: z.enum(SETTINGS_REQUEST_TYPES),
  startDate: day,
  endDate: day,
  description: z.string().max(500).default(''),
})

const restrictionRow = (item: RequestRestriction): RequestRestrictionRow => ({
  ...item,
  company: companyName(item.companyId),
})

// --- Delegation --------------------------------------------------------------------------------

const delegationSchema = z.object({
  delegatorId: z.string().min(1),
  delegateeId: z.string().min(1),
  requestType: z.enum(SETTINGS_REQUEST_TYPES),
  description: z.string().max(500).default(''),
})

const delegationRow = (item: RequestDelegation): RequestDelegationRow => ({
  ...item,
  delegator: ref(item.delegatorId),
  delegatee: ref(item.delegateeId),
})

/** Another active delegation of the same person and type; one at a time. */
function clashingDelegation(item: Pick<RequestDelegation, 'id' | 'delegatorId' | 'requestType'>) {
  return requestDelegations
    .all()
    .find(
      (other) =>
        other.id !== item.id &&
        other.active &&
        other.delegatorId === item.delegatorId &&
        other.requestType === item.requestType,
    )
}

// --- Request Flows -----------------------------------------------------------------------------

const rowRef = z.number().int().positive().nullable()
const nodeSchema = z.object({
  id: z.number().int().positive(),
  canEdit: z.boolean(),
  onLooker: z.boolean(),
  canDisagree: z.boolean(),
  isCondition: z.boolean(),
  node: z.enum(FLOW_NODE_TYPES),
  employeeId: z.string().nullable(),
  next: rowRef,
  expression: z.string().max(200),
  ifTrue: rowRef,
  ifFalse: rowRef,
})
const flowSchema = z.object({ nodes: z.array(nodeSchema) })

const flowRows = (nodes: FlowNode[]): FlowNodeRow[] =>
  nodes.map((node) => ({ ...node, employee: node.employeeId ? ref(node.employeeId) : null }))

/** Why the rows cannot be saved, or null. */
function flowProblem(nodes: FlowNode[]): string | null {
  if (nodes.length === 0) return 'Add at least one node.'
  const known = new Set(nodes.map((node) => node.id))
  if (known.size !== nodes.length) return 'Two rows have the same ID.'
  for (const node of nodes) {
    const row = `Row ${String(node.id)}`
    if ((node.node === 'employee' || node.node === 'consentee') && !node.employeeId) {
      return `${row}: choose the employee.`
    }
    if (node.employeeId && !findEmployee(node.employeeId)) return `${row}: unknown employee.`
    if (node.isCondition && !node.expression.trim()) return `${row}: enter the expression.`
    if (node.isCondition && (node.ifTrue === null || node.ifFalse === null)) {
      return `${row}: choose where If True and If False go.`
    }
    const targets = node.isCondition ? [node.ifTrue, node.ifFalse] : [node.next]
    for (const target of targets) {
      if (target === node.id) return `${row} cannot lead to itself.`
      if (target !== null && !known.has(target)) {
        return `${row} leads to row ${String(target)}, which does not exist.`
      }
    }
  }
  // Every path from the first row must end: no row may be reached again.
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const visit = (id: number, path: number[]): string | null => {
    if (path.includes(id))
      return `Row ${String(id)} leads back to itself; the flow would never end.`
    const node = byId.get(id)
    if (!node) return null
    const targets = node.isCondition ? [node.ifTrue, node.ifFalse] : [node.next]
    for (const target of targets) {
      if (target === null) continue
      const problem = visit(target, [...path, id])
      if (problem) return problem
    }
    return null
  }
  const [first] = nodes
  return first ? visit(first.id, []) : null
}

// --- Request Flow (authorities per employee) ---------------------------------------------------

const assignmentSchema = z.object({
  requestType: z.string().refine(isFlowType),
  employeeIds: z.array(z.string()).min(1),
  authorities: z.array(z.enum(FLOW_AUTHORITIES)).min(1),
})

export const requestSettingsHandlers = [
  http.get(base('/lookups'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    return HttpResponse.json<ApiItem<RequestSettingsLookups>>({
      data: {
        companies: COMPANIES.map((company) => ({ id: company.id, name: company.name })),
        employees: active()
          .map((employee) => ({
            ...ref(employee.id),
            department: employee.department,
            branchId: employee.branchId,
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      },
    })
  }),

  // --- restrictions ---

  http.get(base('/restrictions'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const param = (name: string) => url.searchParams.get(name)
    const rows = requestRestrictions
      .all()
      .filter(
        (item) =>
          (!param('companyId') || item.companyId === param('companyId')) &&
          (!param('requestType') || item.requestType === param('requestType')) &&
          within(item.startDate, param('startFrom'), param('startTo')) &&
          within(item.endDate, param('endFrom'), param('endTo')),
      )
      .map(restrictionRow)
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json<Paginated<RequestRestrictionRow>>(paginate(rows, page, pageSize))
  }),

  http.get(base('/restrictions/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const item = requestRestrictions.find(String(params.id))
    if (!item) return notFound('restriction')
    return HttpResponse.json<ApiItem<RequestRestrictionRow>>({ data: restrictionRow(item) })
  }),

  http.post(base('/restrictions'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, restrictionSchema)
    if (!parsed.success) return invalid('Some fields are not valid.')
    const input = parsed.data
    if (input.endDate < input.startDate) {
      return invalid('The end date is before the start date.', {
        endDate: 'End date must be on or after the start date',
      })
    }
    // Restrictions belong to the signed-in person's company.
    const companyId = companyOf(ME)
    const overlap = requestRestrictions
      .all()
      .find(
        (item) =>
          item.companyId === companyId &&
          item.requestType === input.requestType &&
          item.startDate <= input.endDate &&
          item.endDate >= input.startDate,
      )
    if (overlap) {
      const message = `${typeLabel(input.requestType)}s are already restricted on some of these dates.`
      return invalid(message, { startDate: message })
    }
    const item = requestRestrictions.insert({
      id: createId('rr'),
      companyId,
      ...input,
      description: input.description.trim(),
      createdAt: now(),
    })
    return HttpResponse.json<ApiItem<RequestRestrictionRow>>(
      { data: restrictionRow(item) },
      { status: 201 },
    )
  }),

  http.post(base('/restrictions/delete'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, ids)
    if (!parsed.success) return invalid('Choose the restrictions to delete.')
    const deleted = parsed.data.ids.filter((id) => requestRestrictions.remove(id)).length
    return HttpResponse.json<ApiItem<{ deleted: number }>>({ data: { deleted } })
  }),

  // --- delegations ---

  http.get(base('/delegations'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const param = (name: string) => url.searchParams.get(name)
    const status = param('status')
    const rows = requestDelegations
      .all()
      .filter(
        (item) =>
          (!param('delegatorId') || item.delegatorId === param('delegatorId')) &&
          (!param('delegateeId') || item.delegateeId === param('delegateeId')) &&
          (!param('requestType') || item.requestType === param('requestType')) &&
          (!status || item.active === (status === 'active')),
      )
      .map(delegationRow)
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json<Paginated<RequestDelegationRow>>(paginate(rows, page, pageSize))
  }),

  http.get(base('/delegations/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const item = requestDelegations.find(String(params.id))
    if (!item) return notFound('delegation')
    return HttpResponse.json<ApiItem<RequestDelegationRow>>({ data: delegationRow(item) })
  }),

  http.post(base('/delegations'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, delegationSchema)
    if (!parsed.success) return invalid('Some fields are not valid.')
    const input = parsed.data
    if (!findEmployee(input.delegatorId)) {
      return invalid('Choose the delegator.', { delegatorId: 'Choose an employee' })
    }
    if (!findEmployee(input.delegateeId)) {
      return invalid('Choose the delegatee.', { delegateeId: 'Choose an employee' })
    }
    if (input.delegatorId === input.delegateeId) {
      return invalid('A person cannot delegate to themselves.', {
        delegateeId: 'Choose someone other than the delegator',
      })
    }
    const clash = clashingDelegation({ id: '', ...input })
    if (clash) {
      const message = `${ref(input.delegatorId).name} already delegates ${typeLabel(input.requestType)}s to ${ref(clash.delegateeId).name}.`
      return invalid(message, { requestType: message })
    }
    const item = requestDelegations.insert({
      id: createId('dl'),
      ...input,
      description: input.description.trim(),
      active: true,
      createdAt: now(),
    })
    return HttpResponse.json<ApiItem<RequestDelegationRow>>(
      { data: delegationRow(item) },
      { status: 201 },
    )
  }),

  http.post(base('/delegations/status'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, ids.extend({ active: z.boolean() }))
    if (!parsed.success) return invalid('Choose the delegations to change.')
    const { active: next } = parsed.data
    const items = parsed.data.ids
      .map((id) => requestDelegations.find(id))
      .filter((item): item is RequestDelegation => item !== undefined)
    if (next) {
      // Two active delegations of one person and type would leave the approver unclear.
      const clash = items.find(
        (item) =>
          !item.active &&
          (clashingDelegation(item) ??
            items.find(
              (other) =>
                other.id !== item.id &&
                other.delegatorId === item.delegatorId &&
                other.requestType === item.requestType,
            )),
      )
      if (clash) {
        return invalid(
          `${ref(clash.delegatorId).name} can have one active delegation of ${typeLabel(clash.requestType)}s.`,
        )
      }
    }
    const changed = items.filter((item) => item.active !== next)
    for (const item of changed) requestDelegations.update(item.id, { ...item, active: next })
    return HttpResponse.json<ApiItem<{ changed: number }>>({ data: { changed: changed.length } })
  }),

  // --- flows ---

  http.get(base('/flows/:type'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    if (!isFlowType(params.type)) return notFound('request type')
    const flow = flowDefinition(params.type)
    return HttpResponse.json<ApiItem<RequestFlowDefinition & { rows: FlowNodeRow[] }>>({
      data: { ...flow, rows: flowRows(flow.nodes) },
    })
  }),

  http.put(base('/flows/:type'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const type = params.type
    if (!isFlowType(type)) return notFound('request type')
    const parsed = await readBody(request, flowSchema)
    if (!parsed.success) return invalid('Some rows are not valid.')
    const nodes = parsed.data.nodes.map((node) => ({
      ...node,
      expression: node.expression.trim(),
      // Only Employee and Consentee rows name a person.
      employeeId: node.node === 'employee' || node.node === 'consentee' ? node.employeeId : null,
    }))
    const problem = flowProblem(nodes)
    if (problem) return invalid(problem)
    const flow = { id: type, requestType: type, name: flowDefinition(type).name, nodes }
    if (requestFlows.find(type)) requestFlows.update(type, flow)
    else requestFlows.insert(flow)
    return HttpResponse.json<ApiItem<RequestFlowDefinition>>({
      data: { requestType: type, name: flow.name, nodes },
    })
  }),

  // --- flow assignments ---

  http.get(base('/flow-assignments'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const type = url.searchParams.get('requestType')
    if (!isFlowType(type)) return invalid('Choose the request type.')
    const employeeId = url.searchParams.get('employeeId')
    const search = (url.searchParams.get('search') ?? '').trim().toLowerCase()
    const rows = active()
      .filter((employee) => !employeeId || employee.id === employeeId)
      .map((employee): FlowAssignmentRow => {
        const branch = employee.branchId ? branches.find(employee.branchId) : undefined
        return {
          employee: { ...ref(employee.id), department: employee.department },
          branch: branch?.name ?? null,
          designation: employee.jobTitle,
          authorities: authoritiesOf(employee.id, type),
        }
      })
      .filter(
        (row) =>
          !search ||
          [row.employee.name, row.employee.code, row.employee.department, row.designation].some(
            (value) => value.toLowerCase().includes(search),
          ),
      )
      .sort((a, b) => a.employee.name.localeCompare(b.employee.name))
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json<Paginated<FlowAssignmentRow>>(paginate(rows, page, pageSize))
  }),

  http.post(base('/flow-assignments'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, assignmentSchema)
    if (!parsed.success) return invalid('Choose the request type, authority and employees.')
    const { employeeIds, authorities } = parsed.data
    const type = parsed.data.requestType
    if (authorities.includes('general-flow') && authorities.length > 1) {
      const message = 'General Flow cannot be combined with other authorities.'
      return invalid(message, { authorities: message })
    }
    const chain = [...new Set(authorities)]
    const people = employeeIds.filter((id) => findEmployee(id))
    for (const employeeId of people) {
      const id = assignmentId(employeeId, type)
      if (chain[0] === 'general-flow') flowAssignments.remove(id)
      else if (flowAssignments.find(id)) {
        flowAssignments.update(id, { id, employeeId, requestType: type, authorities: chain })
      } else flowAssignments.insert({ id, employeeId, requestType: type, authorities: chain })
    }
    return HttpResponse.json<ApiItem<{ changed: number }>>({ data: { changed: people.length } })
  }),
]
