import { format } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  FLOW_AUTHORITIES,
  FLOW_NODE_TYPES,
  FLOW_SCOPES,
  type FlowNode,
  type RequestAuthority,
  type RequestDelegation,
  type RequestFlow,
  type RequestFlowDetail,
  type RequestRestriction,
  SETTINGS_REQUEST_TYPE_LABELS,
  SETTINGS_REQUEST_TYPES,
  type SettingsRequestType,
} from '@/features/requests'
import type { ApiItem, Paginated } from '@/types/api'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { branches } from '../settings/handlers'
import {
  apiPath,
  createId,
  errorResponse,
  latency,
  paginate,
  readPageParams,
  requireAuth,
} from '../utils'
import { fallbackGet } from './fallback'
import {
  COMPANY_NAME,
  requestAuthorities,
  requestDelegations,
  requestFlows,
  requestRestrictions,
  type StoredAuthority,
  type StoredDelegation,
  type StoredFlow,
  type StoredFlowNode,
  type StoredRestriction,
  versionOf,
} from './settings-db'

export { resetRequestSettingsDb } from './settings-db'

/*
 * Request Settings as the API serves them (backend/app/routers/requests.py):
 * /requests/settings/{restrictions, delegations, flows, authorities}.
 */

const base = (path: string) => apiPath(`/requests/settings${path}`)
const invalid = (message: string, field?: string) =>
  errorResponse(422, message, {
    code: 'VALIDATION_FAILED',
    ...(field ? { fieldErrors: { [field]: message } } : {}),
  })
const conflict = (message: string, code: string, field?: string) =>
  errorResponse(409, message, { code, ...(field ? { fieldErrors: { [field]: message } } : {}) })
const notFound = (what: string) => errorResponse(404, `${what} not found`, { code: 'NOT_FOUND' })
const changed = (what: string) =>
  errorResponse(409, `Someone else changed this ${what}. Reload it and try again`, {
    code: 'CONFLICT',
  })
const now = () => new Date().toISOString()
const today = () => format(new Date(), 'yyyy-MM-dd')

const guard = async (request: Request) => {
  await latency()
  return requireAuth(request)
}

async function readBody<T>(request: Request, schema: z.ZodType<T>) {
  const body: unknown = await request.json().catch(() => null)
  return schema.safeParse(body)
}

/** The first issue of a body as the API words a missing field. */
function bodyError(error: z.ZodError) {
  const issue = error.issues[0]
  const field = issue ? issue.path.join('.') : undefined
  return invalid(
    issue ? `${field ?? 'body'}: ${issue.message}` : 'Some fields are not valid.',
    field,
  )
}

const id = z.union([z.string(), z.number()]).transform(String)
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const typeCode = z.enum(SETTINGS_REQUEST_TYPES)
const text = z.string().max(4000).nullish()

const typeName = (type: SettingsRequestType) =>
  SETTINGS_REQUEST_TYPE_LABELS[type].replace(/ Request$/, '')
const nameOf = (employeeId: string | null) =>
  employeeId ? (findEmployee(employeeId)?.name ?? null) : null
const codeOf = (employeeId: string) => {
  const index = DIRECTORY.findIndex((person) => person.id === employeeId)
  return index === -1 ? employeeId : `EMP-${String(index + 1).padStart(4, '0')}`
}
const departmentIdOf = (name: string) => `dep_${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
const departmentName = (departmentId: string | null) =>
  departmentId
    ? (DIRECTORY.find((person) => departmentIdOf(person.department) === departmentId)?.department ??
      null)
    : null
const branchName = (branchId: string | null) =>
  branchId ? (branches.find(branchId)?.name ?? null) : null

const flag = (url: URL, name: string) => {
  const value = url.searchParams.get(name)
  return value === 'true' ? true : value === 'false' ? false : null
}

function page<T, R>(url: URL, rows: readonly T[], map: (row: T) => R) {
  const { page: number, pageSize } = readPageParams(url)
  const result = paginate(rows, number, pageSize)
  return HttpResponse.json<Paginated<R>>({ ...result, data: result.data.map(map) })
}

// --- Request Restriction -----------------------------------------------------------------------

const restrictionOut = (row: StoredRestriction): RequestRestriction => ({
  id: row.id,
  companyName: COMPANY_NAME,
  requestType: row.requestType,
  requestTypeName: typeName(row.requestType),
  startDate: row.startDate,
  endDate: row.endDate,
  description: row.description,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  rowVersion: versionOf(row),
})

const restrictionSchema = z.object({
  requestType: typeCode,
  startDate: day,
  endDate: day,
  description: text,
})

const restrictionHandlers = [
  http.get(base('/restrictions'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const url = new URL(request.url)
    const get = (name: string) => url.searchParams.get(name)
    const within = (value: string, from: string | null, to: string | null) =>
      (!from || value >= from) && (!to || value <= to)
    const rows = requestRestrictions
      .all()
      .filter(
        (row) =>
          (!get('requestType') || row.requestType === get('requestType')) &&
          within(row.startDate, get('startFrom'), get('startTo')) &&
          within(row.endDate, get('endFrom'), get('endTo')),
      )
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
    return page(url, rows, restrictionOut)
  }),

  http.get(base('/restrictions/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const row = requestRestrictions.find(String(params.id))
    if (!row) return notFound('Restriction')
    return HttpResponse.json<ApiItem<RequestRestriction>>({ data: restrictionOut(row) })
  }),

  http.post(base('/restrictions'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const body = await readBody(request, restrictionSchema)
    if (!body.success) return bodyError(body.error)
    const { requestType, startDate, endDate } = body.data
    if (startDate <= today()) return invalid('Start date must be in the future.', 'startDate')
    if (endDate < startDate)
      return invalid('End date must be on or after the start date.', 'endDate')
    const overlap = requestRestrictions
      .all()
      .some(
        (row) =>
          row.requestType === requestType && row.startDate <= endDate && row.endDate >= startDate,
      )
    if (overlap) {
      return conflict(
        'Another restriction of this type covers some of these dates.',
        'RESTRICTION_OVERLAP',
        'startDate',
      )
    }
    const row: StoredRestriction = {
      id: createId('rr'),
      requestType,
      startDate,
      endDate,
      description: body.data.description?.trim() ?? null,
      createdAt: now(),
      updatedAt: null,
    }
    requestRestrictions.insert(row)
    return HttpResponse.json<ApiItem<RequestRestriction>>(
      { data: restrictionOut(row) },
      { status: 201 },
    )
  }),

  http.put(base('/restrictions/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const row = requestRestrictions.find(String(params.id))
    if (!row) return notFound('Restriction')
    const body = await readBody(request, restrictionSchema.extend({ rowVersion: z.string() }))
    if (!body.success) return bodyError(body.error)
    if (body.data.rowVersion !== versionOf(row)) return changed('restriction')
    const { requestType, startDate, endDate } = body.data
    if (endDate < startDate)
      return invalid('End date must be on or after the start date.', 'endDate')
    const overlap = requestRestrictions
      .all()
      .some(
        (other) =>
          other.id !== row.id &&
          other.requestType === requestType &&
          other.startDate <= endDate &&
          other.endDate >= startDate,
      )
    if (overlap) {
      return conflict(
        'Another restriction of this type covers some of these dates.',
        'RESTRICTION_OVERLAP',
        'startDate',
      )
    }
    const next: StoredRestriction = {
      ...row,
      requestType,
      startDate,
      endDate,
      description: body.data.description?.trim() ?? null,
      updatedAt: now(),
    }
    requestRestrictions.update(row.id, next)
    return HttpResponse.json<ApiItem<RequestRestriction>>({ data: restrictionOut(next) })
  }),

  http.delete(base('/restrictions/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const row = requestRestrictions.find(String(params.id))
    if (!row) return notFound('Restriction')
    const version = new URL(request.url).searchParams.get('rowVersion')
    if (version && version !== versionOf(row)) return changed('restriction')
    requestRestrictions.remove(row.id)
    return new HttpResponse(null, { status: 204 })
  }),
]

// --- Delegation --------------------------------------------------------------------------------

const delegationOut = (row: StoredDelegation): RequestDelegation => ({
  id: row.id,
  delegatorId: row.delegatorId,
  delegatorName: nameOf(row.delegatorId),
  delegateeId: row.delegateeId,
  delegateeName: nameOf(row.delegateeId),
  requestType: row.requestType,
  requestTypeName: typeName(row.requestType),
  description: row.description,
  isActive: row.isActive,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  rowVersion: versionOf(row),
})

/** One active delegation per delegator and request type. */
const duplicateDelegation = (
  row: Pick<StoredDelegation, 'delegatorId' | 'requestType'>,
  except?: string,
) =>
  requestDelegations
    .all()
    .some(
      (item) =>
        item.id !== except &&
        item.isActive &&
        item.delegatorId === row.delegatorId &&
        item.requestType === row.requestType,
    )

const DUPLICATE_DELEGATION = 'This person already has an active delegation for this request type.'

const delegationSchema = z.object({
  delegatorId: id,
  delegateeId: id,
  requestType: typeCode,
  description: text,
  isActive: z.boolean().default(true),
})

const delegationPatchSchema = z.object({
  isActive: z.boolean(),
  description: text,
  rowVersion: z.string().min(1),
})

const delegationHandlers = [
  http.get(base('/delegations'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const url = new URL(request.url)
    const get = (name: string) => url.searchParams.get(name)
    const active = flag(url, 'isActive')
    const q = (get('q') ?? '').trim().toLowerCase()
    const rows = requestDelegations
      .all()
      .filter(
        (row) =>
          (!get('delegatorId') || row.delegatorId === get('delegatorId')) &&
          (!get('delegateeId') || row.delegateeId === get('delegateeId')) &&
          (!get('requestType') || row.requestType === get('requestType')) &&
          (active === null || row.isActive === active) &&
          (!q ||
            `${nameOf(row.delegatorId) ?? ''} ${nameOf(row.delegateeId) ?? ''}`
              .toLowerCase()
              .includes(q)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return page(url, rows, delegationOut)
  }),

  http.get(base('/delegations/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const row = requestDelegations.find(String(params.id))
    if (!row) return notFound('Delegation')
    return HttpResponse.json<ApiItem<RequestDelegation>>({ data: delegationOut(row) })
  }),

  http.post(base('/delegations'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const body = await readBody(request, delegationSchema)
    if (!body.success) return bodyError(body.error)
    const input = body.data
    if (!findEmployee(input.delegatorId)) return invalid('Delegator is required.', 'delegatorId')
    if (!findEmployee(input.delegateeId)) return invalid('Delegatee is required.', 'delegateeId')
    if (input.delegatorId === input.delegateeId) {
      return invalid('The delegator and the delegatee cannot be the same person.', 'delegateeId')
    }
    if (input.isActive && duplicateDelegation(input)) {
      return conflict(DUPLICATE_DELEGATION, 'DELEGATION_DUPLICATE', 'requestType')
    }
    const row: StoredDelegation = {
      id: createId('dl'),
      delegatorId: input.delegatorId,
      delegateeId: input.delegateeId,
      requestType: input.requestType,
      description: input.description?.trim() ?? null,
      isActive: input.isActive,
      createdAt: now(),
      updatedAt: null,
    }
    requestDelegations.insert(row)
    return HttpResponse.json<ApiItem<RequestDelegation>>(
      { data: delegationOut(row) },
      { status: 201 },
    )
  }),

  http.patch(base('/delegations/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const row = requestDelegations.find(String(params.id))
    if (!row) return notFound('Delegation')
    const body = await readBody(request, delegationPatchSchema)
    if (!body.success) return bodyError(body.error)
    if (body.data.rowVersion !== versionOf(row)) return changed('delegation')
    if (body.data.isActive && duplicateDelegation(row, row.id)) {
      return conflict(DUPLICATE_DELEGATION, 'DELEGATION_DUPLICATE', 'requestType')
    }
    const next: StoredDelegation = {
      ...row,
      isActive: body.data.isActive,
      description: body.data.description?.trim() ?? null,
      updatedAt: now(),
    }
    requestDelegations.update(row.id, next)
    return HttpResponse.json<ApiItem<RequestDelegation>>({ data: delegationOut(next) })
  }),

  http.delete(base('/delegations/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const row = requestDelegations.find(String(params.id))
    if (!row) return notFound('Delegation')
    const version = new URL(request.url).searchParams.get('rowVersion')
    if (version && version !== versionOf(row)) return changed('delegation')
    requestDelegations.remove(row.id)
    return new HttpResponse(null, { status: 204 })
  }),
]

// --- Request Flows -----------------------------------------------------------------------------

/** Roles for Role nodes (`GET /access/roles` is the Access module's; see the fallback below). */
const ROLES = [
  { id: '1', name: 'Company Administrator' },
  { id: '6', name: 'HR Manager' },
  { id: '7', name: 'HR Officer' },
  { id: '8', name: 'Line Manager' },
]

const scopeName = (flow: StoredFlow) => {
  if (!flow.scopeId) return null
  if (flow.scopeType === 'employee') return nameOf(flow.scopeId)
  if (flow.scopeType === 'branch') return branchName(flow.scopeId)
  return departmentName(flow.scopeId)
}

const flowOut = (flow: StoredFlow): RequestFlow => ({
  id: flow.id,
  requestType: flow.requestType,
  requestTypeName: typeName(flow.requestType),
  purpose: flow.purpose,
  name: flow.name,
  scopeType: flow.scopeType,
  scopeId: flow.scopeId,
  scopeName: scopeName(flow),
  description: flow.description,
  isActive: flow.isActive,
  nodeCount: flow.nodes.length,
  createdAt: flow.createdAt,
  updatedAt: flow.updatedAt,
  rowVersion: versionOf(flow),
})

const flowDetail = (flow: StoredFlow): RequestFlowDetail => ({
  ...flowOut(flow),
  nodes: [...flow.nodes]
    .sort((a, b) => a.stepNo - b.stepNo)
    .map((node) => ({
      ...node,
      employeeName: nameOf(node.employeeId),
      roleName: node.roleId ? (ROLES.find((role) => role.id === node.roleId)?.name ?? null) : null,
    })),
})

const nodeSchema = z.object({
  stepNo: z.number().int().min(1).max(999),
  approverKind: z.string().nullish(),
  employeeId: id.nullish(),
  roleId: id.nullish(),
  isCondition: z.boolean().default(false),
  expression: z.string().max(200).nullish(),
  next: z.number().int().nullish(),
  ifTrue: z.number().int().nullish(),
  ifFalse: z.number().int().nullish(),
  canEdit: z.boolean().default(false),
  canDisagree: z.boolean().default(false),
  isObserver: z.boolean().default(false),
})

const flowSchema = z.object({
  requestType: typeCode,
  purpose: z.enum(['request', 'cancellation']).default('request'),
  name: z.string().trim().min(1).max(200),
  scopeType: z.enum(FLOW_SCOPES).default('company'),
  scopeId: id.nullish(),
  description: text,
  isActive: z.boolean().default(true),
  nodes: z.array(nodeSchema).min(1).max(100),
  rowVersion: z.string().nullish(),
})

const EXPRESSION =
  /^\s*(days|amount|minutes|department_id|branch_id|location_id|grade_id|designation_id|employment_type_id)\s*(==|=|!=|<>|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)\s*$/i

/** The node editor's rules, as `check_flow_nodes` in the API's requests service. */
function checkNodes(nodes: z.infer<typeof nodeSchema>[]): Response | FlowNode[] {
  const steps = nodes.map((node) => node.stepNo).sort((a, b) => a - b)
  if (new Set(steps).size !== steps.length)
    return invalid('Each node needs its own number.', 'nodes')
  const following = (stepNo: number) => steps.find((value) => value > stepNo) ?? null
  const edges = new Map<number, number[]>()
  const out: FlowNode[] = []
  for (const [index, node] of nodes.entries()) {
    const where = `nodes[${String(index)}]`
    if (node.isCondition) {
      if (!EXPRESSION.test(node.expression ?? '')) {
        return invalid(
          'A condition is written as <field> <operator> <number>, for example: days > 3.',
          `${where}.expression`,
        )
      }
    } else {
      const kind = node.approverKind ?? ''
      if (!(FLOW_NODE_TYPES as readonly string[]).includes(kind)) {
        return invalid('Choose who decides at this node.', `${where}.approverKind`)
      }
      if (kind === 'employee' && !node.employeeId) {
        return invalid('Choose the employee.', `${where}.employeeId`)
      }
      if (kind === 'employee' && node.employeeId && !findEmployee(node.employeeId)) {
        return invalid('An approver employee was not found.', 'nodes')
      }
      if (kind === 'role' && !node.roleId) return invalid('Choose the role.', `${where}.roleId`)
    }
    for (const link of ['next', 'ifTrue', 'ifFalse'] as const) {
      const target = node[link]
      if (target !== null && target !== undefined && !steps.includes(target)) {
        return invalid(
          `Node ${String(node.stepNo)} points at node ${String(target)}, which does not exist.`,
          `${where}.${link}`,
        )
      }
    }
    edges.set(
      node.stepNo,
      (node.isCondition
        ? [node.ifTrue ?? following(node.stepNo), node.ifFalse ?? following(node.stepNo)]
        : [node.next ?? following(node.stepNo)]
      ).filter((value): value is number => value !== null),
    )
    out.push({
      stepNo: node.stepNo,
      approverKind: node.isCondition ? null : (node.approverKind as FlowNode['approverKind']),
      employeeId: node.employeeId ?? null,
      roleId: node.roleId ?? null,
      isCondition: node.isCondition,
      expression: node.expression?.trim() ? node.expression.trim() : null,
      next: node.next ?? null,
      ifTrue: node.ifTrue ?? null,
      ifFalse: node.ifFalse ?? null,
      canEdit: node.canEdit,
      canDisagree: node.canDisagree,
      isObserver: node.isObserver,
    })
  }
  if (!nodes.some((node) => !node.isCondition && !node.isObserver)) {
    return invalid('A flow needs at least one node where someone decides.', 'nodes')
  }
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
    if (loop !== null)
      return invalid(`The flow goes round in a loop through node ${String(loop)}.`, 'nodes')
  }
  return out
}

/** Reads and checks a flow body; `except` is the flow being saved over. */
async function readFlow(request: Request, except: StoredFlow | null) {
  const body = await readBody(request, flowSchema)
  if (!body.success) return bodyError(body.error)
  const input = body.data
  const nodes = checkNodes(input.nodes)
  if (nodes instanceof Response) return nodes
  if (input.scopeType !== 'company' && !input.scopeId) {
    return invalid('Choose the branch, department or employee this flow is for.', 'scopeId')
  }
  const scopeId = input.scopeType === 'company' ? null : (input.scopeId ?? null)
  const duplicate = requestFlows
    .all()
    .some(
      (flow) =>
        flow.isCurrent &&
        flow.id !== except?.id &&
        flow.requestType === input.requestType &&
        flow.purpose === input.purpose &&
        flow.scopeType === input.scopeType &&
        flow.scopeId === scopeId,
    )
  if (duplicate) {
    return conflict(
      'This request type already has a flow for this purpose and scope. Edit that one.',
      'FLOW_DUPLICATE',
      'scopeType',
    )
  }
  return { input, nodes, scopeId }
}

function storeFlow(
  input: z.infer<typeof flowSchema>,
  nodes: FlowNode[],
  scopeId: string | null,
): StoredFlow {
  const flowId = createId('fl')
  const flow: StoredFlow = {
    id: flowId,
    requestType: input.requestType,
    purpose: input.purpose,
    name: input.name,
    scopeType: input.scopeType,
    scopeId,
    description: input.description?.trim() ?? null,
    isActive: input.isActive,
    isCurrent: true,
    nodes: nodes.map((node): StoredFlowNode => ({
      ...node,
      id: `${flowId}_n${String(node.stepNo)}`,
    })),
    createdAt: now(),
    updatedAt: null,
  }
  requestFlows.insert(flow)
  return flow
}

const flowHandlers = [
  http.get(base('/flows'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const url = new URL(request.url)
    const get = (name: string) => url.searchParams.get(name)
    const order = ['company', 'branch', 'department', 'employee']
    const rows = requestFlows
      .all()
      .filter(
        (flow) =>
          flow.isCurrent &&
          (!get('requestType') || flow.requestType === get('requestType')) &&
          (!get('purpose') || flow.purpose === get('purpose')) &&
          (!get('scopeType') || flow.scopeType === get('scopeType')),
      )
      .sort(
        (a, b) =>
          a.requestType.localeCompare(b.requestType) ||
          order.indexOf(a.scopeType) - order.indexOf(b.scopeType) ||
          a.name.localeCompare(b.name),
      )
    return page(url, rows, flowOut)
  }),

  http.get(base('/flows/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const flow = requestFlows.find(String(params.id))
    if (!flow) return notFound('Approval flow')
    return HttpResponse.json<ApiItem<RequestFlowDetail>>({ data: flowDetail(flow) })
  }),

  http.post(base('/flows'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const read = await readFlow(request, null)
    if (read instanceof Response) return read
    const flow = storeFlow(read.input, read.nodes, read.scopeId)
    return HttpResponse.json<ApiItem<RequestFlowDetail>>(
      { data: flowDetail(flow) },
      { status: 201 },
    )
  }),

  // A new version: the old one stays for the requests already on their way.
  http.put(base('/flows/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const old = requestFlows.find(String(params.id))
    if (!old?.isCurrent) return notFound('Approval flow')
    const read = await readFlow(request, old)
    if (read instanceof Response) return read
    if (read.input.rowVersion && read.input.rowVersion !== versionOf(old)) return changed('flow')
    requestFlows.update(old.id, { ...old, isCurrent: false, updatedAt: now() })
    const flow = storeFlow(read.input, read.nodes, read.scopeId)
    return HttpResponse.json<ApiItem<RequestFlowDetail>>({ data: flowDetail(flow) })
  }),

  http.delete(base('/flows/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const flow = requestFlows.find(String(params.id))
    if (!flow?.isCurrent) return notFound('Approval flow')
    const version = new URL(request.url).searchParams.get('rowVersion')
    if (version && version !== versionOf(flow)) return changed('flow')
    requestFlows.remove(flow.id)
    return new HttpResponse(null, { status: 204 })
  }),
]

// --- Authorities -------------------------------------------------------------------------------

const authorityOut = (row: StoredAuthority): RequestAuthority => {
  const holder = findEmployee(row.employeeId)
  return {
    id: row.id,
    authority: row.authority,
    employeeId: row.employeeId,
    employeeName: holder?.name ?? null,
    employeeCode: codeOf(row.employeeId),
    designationName: holder?.jobTitle ?? null,
    employeeBranchName: branchName(holder?.branchId ?? null),
    requestType: row.requestType,
    requestTypeName: row.requestType ? typeName(row.requestType) : null,
    branchId: row.branchId,
    branchName: branchName(row.branchId),
    departmentId: row.departmentId,
    departmentName: departmentName(row.departmentId),
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    rowVersion: versionOf(row),
  }
}

const authoritySchema = z.object({
  authority: z.enum(FLOW_AUTHORITIES),
  employeeId: id,
  requestType: typeCode.nullish(),
  branchId: id.nullish(),
  departmentId: id.nullish(),
  description: text,
  isActive: z.boolean().default(true),
  rowVersion: z.string().nullish(),
})

async function readAuthority(request: Request, except: string | null) {
  const body = await readBody(request, authoritySchema)
  if (!body.success) return bodyError(body.error)
  const input = body.data
  if (!findEmployee(input.employeeId)) return invalid('Employee is required.', 'employeeId')
  if (input.branchId && !branches.find(input.branchId)) {
    return invalid('Branch not found.', 'branchId')
  }
  if (input.departmentId && !departmentName(input.departmentId)) {
    return invalid('Department not found.', 'departmentId')
  }
  const fields = {
    authority: input.authority,
    employeeId: input.employeeId,
    requestType: input.requestType ?? null,
    branchId: input.branchId ?? null,
    departmentId: input.departmentId ?? null,
    description: input.description?.trim() ?? null,
    isActive: input.isActive,
  }
  const duplicate =
    fields.isActive &&
    requestAuthorities
      .all()
      .some(
        (row) =>
          row.id !== except &&
          row.isActive &&
          row.authority === fields.authority &&
          row.requestType === fields.requestType &&
          row.branchId === fields.branchId &&
          row.departmentId === fields.departmentId,
      )
  if (duplicate) {
    return conflict(
      'Someone already holds this authority for this request type and unit. Change or disable that one first.',
      'AUTHORITY_DUPLICATE',
      'authority',
    )
  }
  return { fields, rowVersion: input.rowVersion ?? null }
}

const authorityHandlers = [
  http.get(base('/authorities'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const url = new URL(request.url)
    const get = (name: string) => url.searchParams.get(name)
    const rows = requestAuthorities
      .all()
      .filter(
        (row) =>
          (!get('authority') || row.authority === get('authority')) &&
          (!get('requestType') || row.requestType === get('requestType')) &&
          (!get('employeeId') || row.employeeId === get('employeeId')),
      )
      .sort((a, b) => a.authority.localeCompare(b.authority))
    return page(url, rows, authorityOut)
  }),

  http.post(base('/authorities'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const read = await readAuthority(request, null)
    if (read instanceof Response) return read
    const row: StoredAuthority = {
      id: createId('au'),
      ...read.fields,
      createdAt: now(),
      updatedAt: null,
    }
    requestAuthorities.insert(row)
    return HttpResponse.json<ApiItem<RequestAuthority>>(
      { data: authorityOut(row) },
      { status: 201 },
    )
  }),

  http.put(base('/authorities/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const row = requestAuthorities.find(String(params.id))
    if (!row) return notFound('Authority')
    const read = await readAuthority(request, row.id)
    if (read instanceof Response) return read
    if (read.rowVersion && read.rowVersion !== versionOf(row)) return changed('authority')
    const next: StoredAuthority = { ...row, ...read.fields, updatedAt: now() }
    requestAuthorities.update(row.id, next)
    return HttpResponse.json<ApiItem<RequestAuthority>>({ data: authorityOut(next) })
  }),

  http.delete(base('/authorities/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const row = requestAuthorities.find(String(params.id))
    if (!row) return notFound('Authority')
    const version = new URL(request.url).searchParams.get('rowVersion')
    if (version && version !== versionOf(row)) return changed('authority')
    requestAuthorities.remove(row.id)
    return new HttpResponse(null, { status: 204 })
  }),
]

// --- roles for Role nodes (owned by Access; answered only when its mock does not) ----------------

const rolesFallback = fallbackGet('/access/roles', () =>
  HttpResponse.json<Paginated<{ id: string; name: string }>>(paginate(ROLES, 1, 100)),
)

export const requestSettingsHandlers = [
  ...restrictionHandlers,
  ...delegationHandlers,
  ...flowHandlers,
  ...authorityHandlers,
  rolesFallback,
]
