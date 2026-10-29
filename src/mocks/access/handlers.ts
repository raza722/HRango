import { http, type HttpHandler, HttpResponse } from 'msw'

import { passwordIssue } from '@/features/access'
import { DEMO_ACCOUNT } from '@/features/auth'
import type { ApiItem, Paginated } from '@/types/api'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { profileOf } from '../scheduling/seed'
import { branches, locations } from '../settings/handlers'
import { COMPANIES } from '../settings/seed'
import { apiPath, errorResponse, latency, paginate, readPageParams, requireAuth } from '../utils'
import { catalogueEntry, PERMISSION_CATALOGUE } from './catalogue'
import {
  accessAudit,
  accessOverrides,
  accessRoles,
  accessSessions,
  accessUsers,
  COMPANY_ADMIN_ROLE_ID,
  newRowVersion,
  nextId,
  resetAccessTables,
  type StoredAudit,
  type StoredOverride,
  type StoredRole,
  type StoredScope,
  type StoredSession,
  type StoredTick,
  type StoredUnitType,
  type StoredUser,
} from './db'

/*
 * The mock of `/api/access`: system users, roles with their permission ticks, the permission
 * catalogue, per-person overrides, sessions and the audit log, with the API's bodies and
 * answers: `{data, meta}` pages, `{data}` items, 422 `{message, fieldErrors}` (every field at
 * once), 404, 409 on a stale rowVersion, duplicates and refused actions. Every change writes
 * an audit entry. The signed-in demo user is the account with the demo email (Shelley Kannes);
 * its own permissions come from the auth mock (everything), not from these roles.
 */

const base = (path: string) => apiPath(`/access${path}`)
const now = () => new Date().toISOString()

const SCOPES: readonly StoredScope[] = [
  'own',
  'team',
  'department',
  'branch',
  'selected_units',
  'company',
]
const OVERRIDE_SCOPES = SCOPES.filter((scope) => scope !== 'selected_units')
const UNIT_TYPES: readonly StoredUnitType[] = ['branch', 'department', 'location']
const SCOPE_LABELS: Record<StoredScope, string> = {
  own: 'Own',
  team: 'Team',
  department: 'Department',
  branch: 'Branch',
  selected_units: 'Selected units',
  company: 'Company',
}

// --- answers -----------------------------------------------------------------------------------

async function guard(request: Request): Promise<Response | null> {
  await latency()
  return requireAuth(request)
}

const item = <T>(data: T, status = 200) => HttpResponse.json<ApiItem<T>>({ data }, { status })
const noContent = () => new HttpResponse(null, { status: 204 })
const notFound = (what: string) =>
  errorResponse(404, `This ${what} does not exist or was removed.`, { code: 'NOT_FOUND' })
const stale = (what: string) =>
  errorResponse(409, `This ${what} was changed by someone else. Reload it and try again.`, {
    code: 'STALE_ROW',
  })
const refused = (message: string, code = 'REFUSED') => errorResponse(409, message, { code })

type FieldErrors = Record<string, string>

/** 422 when a field is wrong (duplicates included then); 409 when only duplicates are. */
function fieldErrorResponse(invalid: FieldErrors, duplicates: FieldErrors): Response | null {
  if (Object.keys(invalid).length > 0) {
    return errorResponse(422, 'Some fields need your attention.', {
      code: 'VALIDATION',
      fieldErrors: { ...duplicates, ...invalid },
    })
  }
  if (Object.keys(duplicates).length > 0) {
    return errorResponse(409, Object.values(duplicates)[0] ?? 'Already in use.', {
      code: 'DUPLICATE',
      fieldErrors: duplicates,
    })
  }
  return null
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null)
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const optionalText = (value: unknown) => {
  const trimmed = text(value)
  return trimmed === '' ? null : trimmed
}
/** Ids come as integers (or the mock's readable strings). */
const idOf = (value: unknown): string | null =>
  typeof value === 'number' ? String(value) : typeof value === 'string' && value ? value : null
const idList = (value: unknown): string[] | null =>
  Array.isArray(value) ? value.map(idOf).filter((id): id is string => id !== null) : null

/** The rowVersion a body or query string carries, checked against the row. */
function versionMismatch(sent: unknown, row: { rowVersion: string }): boolean {
  return typeof sent === 'string' && sent !== '' && sent !== row.rowVersion
}

// --- people, units, companies ------------------------------------------------------------------

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-')

const departmentName = (id: string) =>
  [...new Set(DIRECTORY.map((employee) => employee.department))].find(
    (name) => `dep_${slug(name)}` === id,
  ) ?? null

function unitName(unitType: StoredUnitType, unitId: string): string | null {
  if (unitType === 'branch') return branches.find(unitId)?.name ?? null
  if (unitType === 'location') return locations.find(unitId)?.name ?? null
  return departmentName(unitId)
}

const companyName = (id: string) => COMPANIES.find((company) => company.id === id)?.name ?? null

const employeeOf = (user: StoredUser) => (user.employeeId ? findEmployee(user.employeeId) : null)
const employeeCode = (user: StoredUser) => {
  const employee = employeeOf(user)
  return employee ? profileOf(employee).code : null
}
const nameOf = (user: StoredUser) => user.displayName ?? employeeOf(user)?.name ?? user.email

/** The signed-in demo user's account. */
const selfAccount = () =>
  accessUsers.all().find((user) => user.email.toLowerCase() === DEMO_ACCOUNT.email) ?? null

function audit(
  entityType: 'role' | 'user',
  entityId: string,
  entityName: string,
  actionName: string,
  change: { field?: string; from?: string | null; to?: string | null } = {},
): void {
  const by = selfAccount()
  const entry: StoredAudit = {
    id: nextId(accessAudit.all()),
    entityType,
    entityId,
    entityName,
    fieldName: change.field ?? null,
    oldValue: change.from ?? null,
    newValue: change.to ?? null,
    actionName,
    performedAt: now(),
    performedByUserId: by?.id ?? null,
    performedByName: by ? nameOf(by) : null,
  }
  accessAudit.insert(entry)
}

// --- output shapes -----------------------------------------------------------------------------

const userCountOf = (roleId: string) =>
  accessUsers.all().filter((user) => user.roleIds.includes(roleId)).length

function roleOut(role: StoredRole) {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isActive: role.isActive,
    permissionCount: role.permissions.length,
    userCount: userCountOf(role.id),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    rowVersion: role.rowVersion,
  }
}

function tickOut(tick: StoredTick) {
  const entry = catalogueEntry(tick.code)
  return {
    code: tick.code,
    module: entry?.module ?? tick.code.split('.')[0] ?? '',
    screen: entry?.screen ?? '',
    actionCode: entry?.actionCode ?? tick.code.split('.').at(-1) ?? '',
    label: entry?.label ?? tick.code,
    isSensitive: entry?.isSensitive ?? false,
    scope: tick.scope,
    units: tick.units.map((unit) => ({
      unitType: unit.unitType,
      unitId: unit.unitId,
      unitName: unitName(unit.unitType, unit.unitId),
    })),
  }
}

const roleDetailOut = (role: StoredRole) => ({
  ...roleOut(role),
  permissions: role.permissions.map(tickOut),
})

const rolesOf = (user: StoredUser) =>
  user.roleIds.map((id) => accessRoles.find(id)).filter((role): role is StoredRole => !!role)

function userOut(user: StoredUser) {
  const home = user.companyIds[0] ?? ''
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    name: nameOf(user),
    employeeId: user.employeeId,
    employeeCode: employeeCode(user),
    homeCompanyId: home,
    homeCompanyName: companyName(home),
    isActive: user.isActive,
    isSystemAdmin: user.isSystemAdmin,
    lastLoginAt: user.lastLoginAt,
    roleNames:
      rolesOf(user)
        .map((role) => role.name)
        .join(', ') || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    rowVersion: user.rowVersion,
  }
}

const userDetailOut = (user: StoredUser) => ({
  ...userOut(user),
  roles: rolesOf(user).map((role) => ({
    id: role.id,
    code: role.code,
    name: role.name,
    isActive: role.isActive,
  })),
  companies: user.companyIds.map((id) => ({ id, name: companyName(id) ?? id })),
})

function overrideOut(override: StoredOverride) {
  const entry = catalogueEntry(override.code)
  return {
    id: override.id,
    userAccountId: override.userAccountId,
    code: override.code,
    module: entry?.module ?? '',
    label: entry?.label ?? override.code,
    isSensitive: entry?.isSensitive ?? false,
    effect: override.effect,
    scope: override.scope,
    reason: override.reason,
    createdAt: override.createdAt,
    updatedAt: override.updatedAt,
    rowVersion: override.rowVersion,
  }
}

const isLive = (session: StoredSession) =>
  session.revokedAt === null && (session.expiresAt === null || session.expiresAt > now())

function sessionOut(session: StoredSession) {
  const user = accessUsers.find(session.userAccountId)
  return {
    id: session.id,
    userAccountId: session.userAccountId,
    email: user?.email ?? '',
    userName: user ? nameOf(user) : '',
    device: session.device,
    ipAddress: session.ipAddress,
    signedInAt: session.signedInAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
    isActive: isLive(session),
  }
}

/** Ends every live session of an account (all but `keep`); how many ended. */
function endSessions(userAccountId: string, keep: string | null = null): number {
  let ended = 0
  for (const session of accessSessions.all()) {
    if (session.userAccountId !== userAccountId || session.id === keep || !isLive(session)) continue
    accessSessions.update(session.id, { ...session, revokedAt: now() })
    ended += 1
  }
  return ended
}

const sessionsWord = (count: number) => `${String(count)} session${count === 1 ? '' : 's'}`

// --- effective permissions ---------------------------------------------------------------------

/** Holds a role that may assign roles (what the "last admin role" rule protects). */
const isAdminRole = (role: StoredRole) =>
  role.isActive &&
  (role.id === COMPANY_ADMIN_ROLE_ID ||
    role.permissions.some((tick) => tick.code === 'access.users.roles'))

function effectivePermissions(user: StoredUser) {
  const held = new Map<string, { scopes: Set<string>; sources: string[] }>()
  const hold = (code: string, scope: string, source: string) => {
    const row = held.get(code) ?? { scopes: new Set<string>(), sources: [] }
    row.scopes.add(scope)
    if (!row.sources.includes(source)) row.sources.push(source)
    held.set(code, row)
  }
  if (user.isSystemAdmin) {
    for (const entry of PERMISSION_CATALOGUE) hold(entry.code, 'company', 'System admin')
  }
  for (const role of rolesOf(user)) {
    // A retired role grants nothing until it is restored.
    if (!role.isActive) continue
    for (const tick of role.permissions) hold(tick.code, tick.scope, role.name)
  }
  const overrides = accessOverrides.all().filter((row) => row.userAccountId === user.id)
  for (const grant of overrides.filter((row) => row.effect === 'grant')) {
    hold(grant.code, grant.scope ?? 'company', 'Grant')
  }
  for (const denial of overrides.filter((row) => row.effect === 'deny')) held.delete(denial.code)

  return PERMISSION_CATALOGUE.filter((entry) => held.has(entry.code)).map((entry) => {
    const row = held.get(entry.code)
    return {
      code: entry.code,
      module: entry.module,
      label: entry.label,
      isSensitive: entry.isSensitive,
      scopes: SCOPES.filter((scope) => row?.scopes.has(scope)),
      sources: row?.sources.join(', ') ?? null,
    }
  })
}

// --- users -------------------------------------------------------------------------------------

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

interface UserFields {
  email: string
  displayName: string | null
  employeeId: string | null
  password: string | null
  isActive: boolean
  isSystemAdmin: boolean
  companyIds: string[]
  roleIds: string[]
}

/** Checks a `UserIn` body; `current` is the account being edited. */
function readUser(
  body: Record<string, unknown>,
  current: StoredUser | null,
): UserFields | Response {
  const invalid: FieldErrors = {}
  const duplicates: FieldErrors = {}
  const others = accessUsers.all().filter((user) => user.id !== current?.id)

  const email = text(body.email).toLowerCase()
  if (!email) invalid.email = 'Enter an email address.'
  else if (email.length < 3 || email.length > 254 || !EMAIL.test(email))
    invalid.email = 'Enter a valid email address, like name@company.com.'
  else if (others.some((user) => user.email.toLowerCase() === email))
    duplicates.email = 'Another account uses this email.'

  const displayName = optionalText(body.displayName)
  if (displayName && displayName.length > 200) invalid.displayName = 'Keep it to 200 characters.'

  const employeeId = 'employeeId' in body ? idOf(body.employeeId) : (current?.employeeId ?? null)
  if (employeeId) {
    const employee = findEmployee(employeeId)
    const holder = others.find((user) => user.employeeId === employeeId)
    if (!employee) invalid.employeeId = 'No such employee.'
    else if (holder)
      duplicates.employeeId = `${employee.name} already has an account (${holder.email}).`
  }

  const password = typeof body.password === 'string' && body.password !== '' ? body.password : null
  if (!current && password === null) invalid.password = 'Set an initial password.'
  else if (password !== null) {
    const issue = passwordIssue(password)
    if (issue) invalid.password = issue
  }

  const isActive = typeof body.isActive === 'boolean' ? body.isActive : (current?.isActive ?? true)
  const isSystemAdmin =
    typeof body.isSystemAdmin === 'boolean' ? body.isSystemAdmin : (current?.isSystemAdmin ?? false)

  const companyIds = idList(body.companyIds) ?? current?.companyIds ?? [COMPANIES[0]?.id ?? '']
  if (companyIds.length === 0) invalid.companyIds = 'Choose at least one company.'
  else if (companyIds.some((id) => !companyName(id))) invalid.companyIds = 'Unknown company.'

  const roleIds = idList(body.roleIds) ?? current?.roleIds ?? []
  const unknownRole = roleIds.find((id) => !accessRoles.find(id))
  const newlyRetired = roleIds
    .map((id) => accessRoles.find(id))
    .find((role) => role && !role.isActive && !current?.roleIds.includes(role.id))
  if (unknownRole) invalid.roleIds = 'Unknown role.'
  else if (newlyRetired) invalid.roleIds = `${newlyRetired.name} is retired: restore it first.`

  if (current && current.id === selfAccount()?.id) {
    if (!isActive) invalid.isActive = 'You can’t disable your own account.'
    const keepsAdmin =
      isSystemAdmin ||
      roleIds.some((id) => {
        const role = accessRoles.find(id)
        return role ? isAdminRole(role) : false
      })
    if (!keepsAdmin && !invalid.roleIds) {
      invalid.isSystemAdmin =
        'You can’t remove your own administrator access: keep a role that assigns roles, or stay a system admin.'
    }
    const lastAdminRole = lostLastAdminRole(current, roleIds)
    if (lastAdminRole && !invalid.roleIds) invalid.roleIds = lastAdminRole
  }

  const errors = fieldErrorResponse(invalid, duplicates)
  if (errors) return errors
  return {
    email,
    displayName,
    employeeId,
    password,
    isActive,
    isSystemAdmin,
    companyIds: [...new Set(companyIds)],
    roleIds: [...new Set(roleIds)],
  }
}

/** On your own account: the message when the new roles drop your last admin role. */
function lostLastAdminRole(user: StoredUser, roleIds: readonly string[]): string | null {
  const adminRoles = rolesOf(user).filter(isAdminRole)
  if (adminRoles.length === 0) return null
  const kept = roleIds.some((id) => {
    const role = accessRoles.find(id)
    return role ? isAdminRole(role) : false
  })
  if (kept) return null
  const names = adminRoles.map((role) => role.name).join(', ')
  return `${names} is your last role that can assign roles: you can’t remove it from yourself.`
}

const roleNamesOf = (ids: readonly string[]) =>
  ids
    .map((id) => accessRoles.find(id)?.name)
    .filter(Boolean)
    .join(', ') || 'None'

function recordUserChanges(before: StoredUser, after: StoredUser): void {
  const name = nameOf(after)
  const changed = (field: string, from: string | null, to: string | null) => {
    if (from !== to) audit('user', after.id, name, 'Updated', { field, from, to })
  }
  changed('email', before.email, after.email)
  changed('displayName', before.displayName, after.displayName)
  changed(
    'employee',
    before.employeeId ? (findEmployee(before.employeeId)?.name ?? before.employeeId) : null,
    after.employeeId ? (findEmployee(after.employeeId)?.name ?? after.employeeId) : null,
  )
  changed('isSystemAdmin', before.isSystemAdmin ? 'Yes' : 'No', after.isSystemAdmin ? 'Yes' : 'No')
  changed(
    'companies',
    before.companyIds.map((id) => companyName(id) ?? id).join(', '),
    after.companyIds.map((id) => companyName(id) ?? id).join(', '),
  )
  if (before.roleIds.join() !== after.roleIds.join()) {
    audit('user', after.id, name, 'Roles changed', {
      field: 'roles',
      from: roleNamesOf(before.roleIds),
      to: roleNamesOf(after.roleIds),
    })
  }
  if (before.isActive !== after.isActive) {
    audit('user', after.id, name, after.isActive ? 'Enabled' : 'Disabled', {
      field: 'isActive',
      from: before.isActive ? 'Active' : 'Disabled',
      to: after.isActive ? 'Active' : 'Disabled',
    })
  }
}

function matchesUser(user: StoredUser, q: string): boolean {
  if (!q) return true
  const haystack = [user.email, user.displayName, nameOf(user), employeeCode(user)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

const userHandlers: HttpHandler[] = [
  http.get(base('/users'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const isActive = url.searchParams.get('isActive')
    const roleId = url.searchParams.get('roleId')
    const rows = accessUsers
      .all()
      .filter((user) => matchesUser(user, q))
      .filter((user) => isActive === null || String(user.isActive) === isActive)
      .filter((user) => !roleId || user.roleIds.includes(roleId))
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
    const { page, pageSize } = readPageParams(url)
    const result = paginate(rows, page, pageSize)
    return HttpResponse.json<Paginated<ReturnType<typeof userOut>>>({
      data: result.data.map(userOut),
      meta: result.meta,
    })
  }),

  http.post(base('/users'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const read = readUser(await readBody(request), null)
    if (read instanceof Response) return read
    const user: StoredUser = {
      id: nextId(accessUsers.all()),
      email: read.email,
      displayName: read.displayName,
      employeeId: read.employeeId,
      companyIds: read.companyIds,
      isActive: read.isActive,
      isSystemAdmin: read.isSystemAdmin,
      lastLoginAt: null,
      roleIds: read.roleIds,
      password: read.password,
      createdAt: now(),
      updatedAt: null,
      rowVersion: newRowVersion(),
    }
    accessUsers.insert(user)
    audit('user', user.id, nameOf(user), 'Created', {
      field: 'roles',
      to: roleNamesOf(user.roleIds),
    })
    if (user.isSystemAdmin) {
      audit('user', user.id, nameOf(user), 'Made system admin', {
        field: 'isSystemAdmin',
        to: 'Yes',
      })
    }
    return item(userDetailOut(user), 201)
  }),

  http.get(base('/users/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const user = accessUsers.find(String(params.id))
    return user ? item(userDetailOut(user)) : notFound('account')
  }),

  http.put(base('/users/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const current = accessUsers.find(String(params.id))
    if (!current) return notFound('account')
    const body = await readBody(request)
    if (versionMismatch(body.rowVersion, current)) return stale('account')
    const read = readUser(body, current)
    if (read instanceof Response) return read
    const next: StoredUser = {
      ...current,
      email: read.email,
      displayName: read.displayName,
      employeeId: read.employeeId,
      companyIds: read.companyIds,
      isActive: read.isActive,
      isSystemAdmin: read.isSystemAdmin,
      roleIds: read.roleIds,
      password: read.password ?? current.password,
      updatedAt: now(),
      rowVersion: newRowVersion(),
    }
    accessUsers.update(current.id, next)
    if (current.isActive && !next.isActive) endSessions(next.id)
    recordUserChanges(current, next)
    if (read.password) audit('user', next.id, nameOf(next), 'Password set')
    return item(userDetailOut(next))
  }),

  ...(['disable', 'enable'] as const).map((action) =>
    http.patch(base(`/users/:id/${action}`), async ({ request, params }) => {
      const denied = await guard(request)
      if (denied) return denied
      const user = accessUsers.find(String(params.id))
      if (!user) return notFound('account')
      const body = await readBody(request)
      if (typeof body.rowVersion !== 'string' || body.rowVersion === '') {
        return errorResponse(422, 'Some fields need your attention.', {
          code: 'VALIDATION',
          fieldErrors: { rowVersion: 'Send the rowVersion you read.' },
        })
      }
      if (versionMismatch(body.rowVersion, user)) return stale('account')
      const disabling = action === 'disable'
      if (disabling && user.id === selfAccount()?.id) {
        return refused('You can’t disable your own account.', 'SELF')
      }
      if (user.isActive === !disabling) {
        return refused(`This account is already ${disabling ? 'disabled' : 'enabled'}.`)
      }
      const next: StoredUser = {
        ...user,
        isActive: !disabling,
        updatedAt: now(),
        rowVersion: newRowVersion(),
      }
      accessUsers.update(user.id, next)
      const ended = disabling ? endSessions(user.id) : 0
      audit('user', user.id, nameOf(user), disabling ? 'Disabled' : 'Enabled', {
        field: 'isActive',
        from: disabling ? 'Active' : 'Disabled',
        to: disabling ? `Disabled${ended > 0 ? ` (${sessionsWord(ended)} ended)` : ''}` : 'Active',
      })
      return item(userDetailOut(next))
    }),
  ),

  http.put(base('/users/:id/password'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const user = accessUsers.find(String(params.id))
    if (!user) return notFound('account')
    const body = await readBody(request)
    const password = typeof body.password === 'string' ? body.password : ''
    const issue = password === '' ? 'Enter a password.' : passwordIssue(password)
    if (issue) {
      return errorResponse(422, 'Some fields need your attention.', {
        code: 'VALIDATION',
        fieldErrors: { password: issue },
      })
    }
    accessUsers.update(user.id, {
      ...user,
      password,
      updatedAt: now(),
      rowVersion: newRowVersion(),
    })
    const ended = endSessions(user.id)
    audit('user', user.id, nameOf(user), 'Password set', {
      to: ended > 0 ? `${sessionsWord(ended)} ended` : null,
    })
    return noContent()
  }),

  http.put(base('/users/:id/roles'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const user = accessUsers.find(String(params.id))
    if (!user) return notFound('account')
    const body = await readBody(request)
    if (typeof body.rowVersion !== 'string' || body.rowVersion === '') {
      return errorResponse(422, 'Some fields need your attention.', {
        code: 'VALIDATION',
        fieldErrors: { rowVersion: 'Send the rowVersion you read.' },
      })
    }
    if (versionMismatch(body.rowVersion, user)) return stale('account')
    const roleIds = idList(body.roleIds)
    const invalid: FieldErrors = {}
    if (roleIds === null) invalid.roleIds = 'Send the list of roles.'
    else {
      const unknown = roleIds.find((id) => !accessRoles.find(id))
      const retired = roleIds
        .map((id) => accessRoles.find(id))
        .find((role) => role && !role.isActive && !user.roleIds.includes(role.id))
      if (unknown) invalid.roleIds = 'Unknown role.'
      else if (retired) invalid.roleIds = `${retired.name} is retired: restore it first.`
      else if (user.id === selfAccount()?.id) {
        const lost = lostLastAdminRole(user, roleIds)
        if (lost) invalid.roleIds = lost
      }
    }
    const errors = fieldErrorResponse(invalid, {})
    if (errors) return errors
    if (roleIds === null) return errorResponse(422, 'Send the list of roles.')
    const next: StoredUser = {
      ...user,
      roleIds: [...new Set(roleIds)],
      updatedAt: now(),
      rowVersion: newRowVersion(),
    }
    accessUsers.update(user.id, next)
    if (user.roleIds.join() !== next.roleIds.join()) {
      audit('user', user.id, nameOf(user), 'Roles changed', {
        field: 'roles',
        from: roleNamesOf(user.roleIds),
        to: roleNamesOf(next.roleIds),
      })
    }
    return item(userDetailOut(next))
  }),

  http.get(base('/users/:id/permissions'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const user = accessUsers.find(String(params.id))
    return user ? item(effectivePermissions(user)) : notFound('account')
  }),

  http.get(base('/users/:id/overrides'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const user = accessUsers.find(String(params.id))
    if (!user) return notFound('account')
    const rows = accessOverrides
      .all()
      .filter((row) => row.userAccountId === user.id)
      .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
    return item(rows.map(overrideOut))
  }),

  http.put(base('/users/:id/overrides'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const user = accessUsers.find(String(params.id))
    if (!user) return notFound('account')
    const body = await readBody(request)
    const invalid: FieldErrors = {}
    const code = text(body.code)
    const entry = catalogueEntry(code)
    if (!code) invalid.code = 'Choose a permission.'
    else if (!entry) invalid.code = 'Unknown permission.'
    const effect = body.effect === 'grant' || body.effect === 'deny' ? body.effect : null
    if (!effect) invalid.effect = 'Choose Grant or Deny.'
    const scope = OVERRIDE_SCOPES.find((value) => value === body.scope) ?? null
    if (body.scope !== null && body.scope !== undefined && !scope) invalid.scope = 'Choose a scope.'
    else if (effect === 'grant' && !scope) invalid.scope = 'Choose how far the grant reaches.'
    const reason = optionalText(body.reason)
    if (reason && reason.length > 1000) invalid.reason = 'Keep it to 1,000 characters.'
    const errors = fieldErrorResponse(invalid, {})
    if (errors) return errors
    if (!effect || !entry) return errorResponse(422, 'Some fields need your attention.')

    const existing = accessOverrides
      .all()
      .find((row) => row.userAccountId === user.id && row.code === code)
    const saved: StoredOverride = {
      id: existing?.id ?? nextId(accessOverrides.all()),
      userAccountId: user.id,
      code,
      effect,
      scope: effect === 'deny' ? null : scope,
      reason,
      createdAt: existing?.createdAt ?? now(),
      updatedAt: existing ? now() : null,
      rowVersion: newRowVersion(),
    }
    if (existing) accessOverrides.update(existing.id, saved)
    else accessOverrides.insert(saved)
    audit('user', user.id, nameOf(user), existing ? 'Override changed' : 'Override added', {
      field: code,
      from: existing ? (existing.effect === 'grant' ? 'Granted' : 'Denied') : null,
      to: effect === 'grant' ? `Granted (${SCOPE_LABELS[saved.scope ?? 'company']})` : 'Denied',
    })
    return item(overrideOut(saved))
  }),

  http.delete(base('/users/:id/overrides/:overrideId'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const user = accessUsers.find(String(params.id))
    const override = accessOverrides.find(String(params.overrideId))
    if (!user || override?.userAccountId !== user.id) return notFound('override')
    const version = new URL(request.url).searchParams.get('rowVersion')
    if (versionMismatch(version, override)) return stale('override')
    accessOverrides.remove(override.id)
    audit('user', user.id, nameOf(user), 'Override removed', {
      field: override.code,
      from: override.effect === 'grant' ? 'Granted' : 'Denied',
    })
    return noContent()
  }),

  http.patch(base('/users/:id/sessions/end'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const user = accessUsers.find(String(params.id))
    if (!user) return notFound('account')
    const ended = endSessions(user.id)
    if (ended > 0)
      audit('user', user.id, nameOf(user), 'Sessions ended', { to: sessionsWord(ended) })
    return item({ ended })
  }),

  http.post(base('/me/password'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const me = selfAccount()
    if (!me) return notFound('account')
    const body = await readBody(request)
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
    const invalid: FieldErrors = {}
    if (!currentPassword) invalid.currentPassword = 'Enter your current password.'
    else if (currentPassword !== (me.password ?? DEMO_ACCOUNT.password))
      invalid.currentPassword = 'That isn’t your current password.'
    const issue = newPassword === '' ? 'Enter a new password.' : passwordIssue(newPassword)
    if (issue) invalid.newPassword = issue
    else if (newPassword === currentPassword)
      invalid.newPassword = 'Choose a password you aren’t using now.'
    const errors = fieldErrorResponse(invalid, {})
    if (errors) return errors
    // "This" device is the newest live session; the others end.
    const current = accessSessions
      .all()
      .filter((session) => session.userAccountId === me.id && isLive(session))
      .sort((a, b) => b.signedInAt.localeCompare(a.signedInAt))[0]
    accessUsers.update(me.id, {
      ...me,
      password: newPassword,
      updatedAt: now(),
      rowVersion: newRowVersion(),
    })
    const ended = endSessions(me.id, current?.id ?? null)
    audit('user', me.id, nameOf(me), 'Password changed', {
      to: ended > 0 ? `${sessionsWord(ended)} ended` : null,
    })
    return noContent()
  }),
]

// --- sessions ----------------------------------------------------------------------------------

const sessionHandlers: HttpHandler[] = [
  http.get(base('/sessions'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const activeOnly = url.searchParams.get('activeOnly') !== 'false'
    const rows = accessSessions
      .all()
      .filter((session) => !userId || session.userAccountId === userId)
      .filter((session) => !activeOnly || isLive(session))
      .sort((a, b) => b.signedInAt.localeCompare(a.signedInAt))
    const { page, pageSize } = readPageParams(url)
    const result = paginate(rows, page, pageSize)
    return HttpResponse.json({ data: result.data.map(sessionOut), meta: result.meta })
  }),

  http.patch(base('/sessions/:id/end'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const session = accessSessions.find(String(params.id))
    if (!session) return notFound('session')
    if (!isLive(session)) return item({ ended: 0 })
    accessSessions.update(session.id, { ...session, revokedAt: now() })
    const user = accessUsers.find(session.userAccountId)
    if (user) {
      audit('user', user.id, nameOf(user), 'Session ended', {
        to: [session.device, session.ipAddress].filter(Boolean).join(', ') || null,
      })
    }
    return item({ ended: 1 })
  }),
]

// --- roles -------------------------------------------------------------------------------------

const roleCode = (name: string) => {
  const stem =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'role'
  const taken = new Set(accessRoles.all().map((role) => role.code))
  let code = stem
  for (let index = 2; taken.has(code); index += 1) code = `${stem}_${String(index)}`
  return code
}

const nameTaken = (name: string, exceptId: string | null) =>
  accessRoles
    .all()
    .some((role) => role.id !== exceptId && role.name.toLowerCase() === name.toLowerCase())

function readRole(
  body: Record<string, unknown>,
  current: StoredRole | null,
): { name: string; description: string | null } | Response {
  const invalid: FieldErrors = {}
  const duplicates: FieldErrors = {}
  const name = text(body.name)
  if (!name) invalid.name = 'Enter a name.'
  else if (name.length > 200) invalid.name = 'Keep it to 200 characters.'
  else if (current?.isSystem && name !== current.name)
    invalid.name = 'A system role keeps its name.'
  else if (nameTaken(name, current?.id ?? null)) duplicates.name = 'Another role has this name.'
  const description = optionalText(body.description)
  if (description && description.length > 2000) invalid.description = 'Keep it to 2,000 characters.'
  return fieldErrorResponse(invalid, duplicates) ?? { name, description }
}

/** Checks `RolePermissionsIn.permissions`; the error keys name the row (`permissions.3.units`). */
function readTicks(value: unknown): StoredTick[] | Response {
  if (!Array.isArray(value)) {
    return errorResponse(422, 'Some fields need your attention.', {
      code: 'VALIDATION',
      fieldErrors: { permissions: 'Send the list of ticks.' },
    })
  }
  const invalid: FieldErrors = {}
  const seen = new Set<string>()
  const ticks: StoredTick[] = []
  value.forEach((raw: unknown, index) => {
    const row = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    const at = `permissions.${String(index)}`
    const code = text(row.code)
    if (!catalogueEntry(code)) invalid[`${at}.code`] = 'Unknown permission.'
    else if (seen.has(code)) invalid[`${at}.code`] = 'Ticked twice.'
    seen.add(code)
    const scope = SCOPES.find((item) => item === row.scope)
    if (!scope) invalid[`${at}.scope`] = 'Choose a scope.'
    const units: StoredTick['units'] = []
    const rawUnits: unknown[] = Array.isArray(row.units) ? row.units : []
    for (const rawUnit of rawUnits) {
      const unit =
        typeof rawUnit === 'object' && rawUnit !== null ? (rawUnit as Record<string, unknown>) : {}
      const unitType = UNIT_TYPES.find((type) => type === unit.unitType)
      const unitId = idOf(unit.unitId)
      if (!unitType || !unitId || !unitName(unitType, unitId)) {
        invalid[`${at}.units`] = 'Unknown branch, department or location.'
      } else units.push({ unitType, unitId })
    }
    if (scope === 'selected_units' && units.length === 0 && !invalid[`${at}.units`]) {
      invalid[`${at}.units`] = 'Choose at least one branch, department or location.'
    }
    if (scope) ticks.push({ code, scope, units: scope === 'selected_units' ? units : [] })
  })
  return fieldErrorResponse(invalid, {}) ?? ticks
}

const scopeText = (tick: StoredTick) =>
  tick.scope === 'selected_units'
    ? `Selected units: ${tick.units.map((unit) => unitName(unit.unitType, unit.unitId) ?? unit.unitId).join(', ')}`
    : SCOPE_LABELS[tick.scope]

/** "3 added, 1 removed, 2 scopes changed". */
function permissionChanges(before: readonly StoredTick[], after: readonly StoredTick[]): string {
  const old = new Map(before.map((tick) => [tick.code, tick]))
  const next = new Map(after.map((tick) => [tick.code, tick]))
  const added = after.filter((tick) => !old.has(tick.code)).length
  const removed = before.filter((tick) => !next.has(tick.code)).length
  const rescoped = after.filter((tick) => {
    const was = old.get(tick.code)
    return was !== undefined && scopeText(was) !== scopeText(tick)
  }).length
  const parts = [
    added > 0 ? `${String(added)} added` : '',
    removed > 0 ? `${String(removed)} removed` : '',
    rescoped > 0 ? `${String(rescoped)} scope${rescoped === 1 ? '' : 's'} changed` : '',
  ].filter(Boolean)
  return parts.join(', ') || 'No change'
}

const permissionsWord = (count: number) => `${String(count)} permission${count === 1 ? '' : 's'}`

const roleHandlers: HttpHandler[] = [
  http.get(base('/permissions'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    return item(PERMISSION_CATALOGUE)
  }),

  http.get(base('/roles'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const includeRetired = url.searchParams.get('includeRetired') === 'true'
    const rows = accessRoles
      .all()
      .filter((role) => includeRetired || role.isActive)
      .filter(
        (role) =>
          !q || `${role.name} ${role.code} ${role.description ?? ''}`.toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
    const { page, pageSize } = readPageParams(url)
    const result = paginate(rows, page, pageSize)
    return HttpResponse.json({ data: result.data.map(roleOut), meta: result.meta })
  }),

  http.post(base('/roles'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const read = readRole(await readBody(request), null)
    if (read instanceof Response) return read
    const role: StoredRole = {
      id: nextId(accessRoles.all()),
      code: roleCode(read.name),
      name: read.name,
      description: read.description,
      isSystem: false,
      isActive: true,
      createdAt: now(),
      updatedAt: null,
      rowVersion: newRowVersion(),
      permissions: [],
    }
    accessRoles.insert(role)
    audit('role', role.id, role.name, 'Created')
    return item(roleDetailOut(role), 201)
  }),

  http.get(base('/roles/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const role = accessRoles.find(String(params.id))
    return role ? item(roleDetailOut(role)) : notFound('role')
  }),

  http.put(base('/roles/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const role = accessRoles.find(String(params.id))
    if (!role) return notFound('role')
    const body = await readBody(request)
    if (versionMismatch(body.rowVersion, role)) return stale('role')
    const read = readRole(body, role)
    if (read instanceof Response) return read
    const next: StoredRole = { ...role, ...read, updatedAt: now(), rowVersion: newRowVersion() }
    accessRoles.update(role.id, next)
    if (role.name !== next.name) {
      audit('role', role.id, next.name, 'Renamed', {
        field: 'name',
        from: role.name,
        to: next.name,
      })
    }
    if (role.description !== next.description) {
      audit('role', role.id, next.name, 'Updated', {
        field: 'description',
        from: role.description,
        to: next.description,
      })
    }
    return item(roleDetailOut(next))
  }),

  http.delete(base('/roles/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const role = accessRoles.find(String(params.id))
    if (!role) return notFound('role')
    const version = new URL(request.url).searchParams.get('rowVersion')
    if (versionMismatch(version, role)) return stale('role')
    if (role.isSystem) return refused('System roles can’t be deleted.', 'SYSTEM_ROLE')
    const users = userCountOf(role.id)
    if (users > 0) {
      return refused(
        `${String(users)} ${users === 1 ? 'person has' : 'people have'} ${role.name}, so it can’t be deleted. Take it away from them or retire it.`,
        'ROLE_IN_USE',
      )
    }
    accessRoles.remove(role.id)
    audit('role', role.id, role.name, 'Deleted')
    return noContent()
  }),

  http.put(base('/roles/:id/permissions'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const role = accessRoles.find(String(params.id))
    if (!role) return notFound('role')
    const body = await readBody(request)
    if (typeof body.rowVersion !== 'string' || body.rowVersion === '') {
      return errorResponse(422, 'Some fields need your attention.', {
        code: 'VALIDATION',
        fieldErrors: { rowVersion: 'Send the rowVersion you read.' },
      })
    }
    if (versionMismatch(body.rowVersion, role)) return stale('role')
    if (role.id === COMPANY_ADMIN_ROLE_ID) {
      return refused(
        'Company Administrator always holds every permission. Copy it to make a role you can change.',
        'SYSTEM_ROLE',
      )
    }
    const ticks = readTicks(body.permissions)
    if (ticks instanceof Response) return ticks
    // Catalogue order, as the API keeps them.
    const order = new Map(PERMISSION_CATALOGUE.map((entry, index) => [entry.code, index]))
    ticks.sort((a, b) => (order.get(a.code) ?? 0) - (order.get(b.code) ?? 0))
    const summary = permissionChanges(role.permissions, ticks)
    const next: StoredRole = {
      ...role,
      permissions: ticks,
      updatedAt: now(),
      rowVersion: newRowVersion(),
    }
    accessRoles.update(role.id, next)
    audit('role', role.id, role.name, 'Permissions changed', {
      field: 'permissions',
      from: permissionsWord(role.permissions.length),
      to: `${permissionsWord(ticks.length)} (${summary})`,
    })
    return item(roleDetailOut(next))
  }),

  http.post(base('/roles/:id/copy'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const source = accessRoles.find(String(params.id))
    if (!source) return notFound('role')
    const body = await readBody(request)
    const name = text(body.name)
    const invalid: FieldErrors = {}
    const duplicates: FieldErrors = {}
    if (!name) invalid.name = 'Enter a name for the copy.'
    else if (name.length > 200) invalid.name = 'Keep it to 200 characters.'
    else if (nameTaken(name, null)) duplicates.name = 'Another role has this name.'
    const errors = fieldErrorResponse(invalid, duplicates)
    if (errors) return errors
    const role: StoredRole = {
      id: nextId(accessRoles.all()),
      code: roleCode(name),
      name,
      description: source.description,
      isSystem: false,
      isActive: true,
      createdAt: now(),
      updatedAt: null,
      rowVersion: newRowVersion(),
      permissions: source.permissions.map((tick) => ({ ...tick, units: [...tick.units] })),
    }
    accessRoles.insert(role)
    audit('role', role.id, role.name, 'Created', { field: 'copiedFrom', to: source.name })
    return item(roleDetailOut(role), 201)
  }),

  ...(['retire', 'restore'] as const).map((action) =>
    http.patch(base(`/roles/:id/${action}`), async ({ request, params }) => {
      const denied = await guard(request)
      if (denied) return denied
      const role = accessRoles.find(String(params.id))
      if (!role) return notFound('role')
      const body = await readBody(request)
      if (typeof body.rowVersion !== 'string' || body.rowVersion === '') {
        return errorResponse(422, 'Some fields need your attention.', {
          code: 'VALIDATION',
          fieldErrors: { rowVersion: 'Send the rowVersion you read.' },
        })
      }
      if (versionMismatch(body.rowVersion, role)) return stale('role')
      const retiring = action === 'retire'
      if (retiring && role.isSystem) {
        return refused('System roles can’t be retired.', 'SYSTEM_ROLE')
      }
      if (role.isActive !== retiring) {
        return refused(`${role.name} is already ${retiring ? 'retired' : 'in use'}.`)
      }
      const next: StoredRole = {
        ...role,
        isActive: !retiring,
        updatedAt: now(),
        rowVersion: newRowVersion(),
      }
      accessRoles.update(role.id, next)
      audit('role', role.id, role.name, retiring ? 'Retired' : 'Restored', {
        field: 'isActive',
        from: retiring ? 'In use' : 'Retired',
        to: retiring ? 'Retired' : 'In use',
      })
      return item(roleDetailOut(next))
    }),
  ),
]

// --- audit -------------------------------------------------------------------------------------

const auditHandlers: HttpHandler[] = [
  http.get(base('/audit'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const url = new URL(request.url)
    const entity = url.searchParams.get('entity')
    const entityId = url.searchParams.get('entityId')
    if (entity && entity !== 'role' && entity !== 'user') {
      return errorResponse(422, 'Some fields need your attention.', {
        code: 'VALIDATION',
        fieldErrors: { entity: 'Use role or user.' },
      })
    }
    const rows = accessAudit
      .all()
      .filter((row) => !entity || row.entityType === entity)
      .filter((row) => !entityId || row.entityId === entityId)
      .sort((a, b) => b.performedAt.localeCompare(a.performedAt) || Number(b.id) - Number(a.id))
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json(paginate(rows, page, pageSize))
  }),
]

/** The mock of `/api/access` (users, roles, permissions, overrides, sessions, audit). */
export const accessHandlers: HttpHandler[] = [
  ...userHandlers,
  ...sessionHandlers,
  ...roleHandlers,
  ...auditHandlers,
]

/** Restores the module's mock tables to their seed data (used between tests). */
export function resetAccessDb(): void {
  resetAccessTables()
}
