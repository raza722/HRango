/** How far a permission reaches: the holder's own records up to the whole company. */
export const SCOPES = ['own', 'team', 'department', 'branch', 'selected_units', 'company'] as const
export type Scope = (typeof SCOPES)[number]

/** Overrides take every scope but Selected units (`OverrideIn.scope`). */
export const OVERRIDE_SCOPES = ['own', 'team', 'department', 'branch', 'company'] as const
export type OverrideScope = (typeof OVERRIDE_SCOPES)[number]

export const UNIT_TYPES = ['branch', 'department', 'location'] as const
export type UnitType = (typeof UNIT_TYPES)[number]

export const OVERRIDE_EFFECTS = ['grant', 'deny'] as const
export type OverrideEffect = (typeof OVERRIDE_EFFECTS)[number]

/** One tick of the catalogue (`GET /access/permissions`), in screen order. */
export interface PermissionDef {
  id: string
  code: string
  module: string
  screen: string
  actionCode: string
  label: string
  hint: string | null
  isSensitive: boolean
}

/** A branch, department or location a Selected units tick reaches. */
export interface Unit {
  unitType: UnitType
  unitId: string
  unitName: string | null
}

/** A role's tick: the permission and its scope. */
export interface Tick {
  code: string
  module: string
  screen: string
  actionCode: string
  label: string
  isSensitive: boolean
  scope: Scope
  units: Unit[]
}

export interface Role {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
  /** `false` once retired. */
  isActive: boolean
  permissionCount: number
  userCount: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface RoleDetail extends Role {
  permissions: Tick[]
}

export interface RoleRef {
  id: string
  code: string
  name: string
  isActive: boolean
}

export interface CompanyRef {
  id: string
  name: string
}

/** A system user (an account that can sign in). */
export interface User {
  id: string
  email: string
  displayName: string | null
  /** The display name, else the employee's name, else the email. */
  name: string
  employeeId: string | null
  employeeCode: string | null
  homeCompanyId: string
  homeCompanyName: string | null
  isActive: boolean
  isSystemAdmin: boolean
  lastLoginAt: string | null
  roleNames: string[]
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface UserDetail extends User {
  roles: RoleRef[]
  companies: CompanyRef[]
}

/** What a user holds: roles plus grants minus denials. */
export interface EffectivePermission {
  code: string
  module: string
  label: string
  isSensitive: boolean
  scopes: Scope[]
  /** Role names, "Grant", "System admin". */
  sources: string[]
}

export interface Override {
  id: string
  userAccountId: string
  code: string
  module: string
  label: string
  isSensitive: boolean
  effect: OverrideEffect
  scope: OverrideScope | null
  reason: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface Session {
  id: string
  userAccountId: string
  email: string
  userName: string
  device: string | null
  ipAddress: string | null
  signedInAt: string
  lastSeenAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  isActive: boolean
}

export interface AuditEntry {
  id: string
  entityType: string
  entityId: string
  entityName: string | null
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  actionName: string | null
  performedAt: string | null
  performedByUserId: string | null
  performedByName: string | null
}

// --- inputs -----------------------------------------------------------------------------------

export interface UserInput {
  email: string
  displayName: string | null
  employeeId: string | null
  /** Only on create. */
  password: string | null
  isActive: boolean
  isSystemAdmin: boolean
  companyIds: string[]
  roleIds: string[]
}

export interface RoleInput {
  name: string
  description: string | null
}

export interface TickInput {
  code: string
  scope: Scope
  units: { unitType: UnitType; unitId: string }[]
}

export interface OverrideInput {
  code: string
  effect: OverrideEffect
  scope: OverrideScope | null
  reason: string | null
}

export type UserStatusFilter = 'active' | 'disabled'
/** Filters the API has no parameter for: read every account and narrow in the browser. */
export type EmployeeFilter = 'left' | 'none'

export interface UserListParams {
  q?: string | undefined
  isActive?: boolean | undefined
  roleId?: string | undefined
  page: number
  pageSize: number
}

export interface RoleListParams {
  q?: string | undefined
  includeRetired?: boolean | undefined
  page: number
  pageSize: number
}

export interface SessionListParams {
  userId?: string | undefined
  activeOnly: boolean
  page: number
  pageSize: number
}

export interface AuditListParams {
  entity: 'role' | 'user'
  entityId: string
  page: number
  pageSize: number
}
