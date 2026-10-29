/*
 * The `/api/access` schemas as the OpenAPI of 26 Oct 2026 gives them. Ids come out as strings
 * and go in as integers (`IdIn`); instants are UTC.
 */

/** An id in a request body: an integer for the API (the mock's readable ids stay strings). */
export type IdIn = number | string

export interface PermissionOutDto {
  id: string
  code: string
  module: string
  screen: string
  actionCode: string
  label: string
  hint: string | null
  isSensitive: boolean
}

export interface UnitOutDto {
  unitType: string
  unitId: string
  unitName: string | null
}

export interface TickOutDto {
  code: string
  module: string
  screen: string
  actionCode: string
  label: string
  isSensitive: boolean
  scope: string
  units: UnitOutDto[]
}

export interface RoleOutDto {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
  isActive: boolean
  permissionCount: number
  userCount: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface RoleDetailOutDto extends RoleOutDto {
  permissions: TickOutDto[]
}

export interface RoleRefDto {
  id: string
  code: string
  name: string
  isActive: boolean
}

export interface RefOutDto {
  id: string
  name: string
}

export interface UserOutDto {
  id: string
  email: string
  displayName: string | null
  name: string
  employeeId: string | null
  employeeCode: string | null
  homeCompanyId: string
  homeCompanyName: string | null
  isActive: boolean
  isSystemAdmin: boolean
  lastLoginAt: string | null
  /** Comma-separated role names. */
  roleNames: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface UserDetailOutDto extends UserOutDto {
  roles: RoleRefDto[]
  companies: RefOutDto[]
}

export interface EffectivePermissionOutDto {
  code: string
  module: string
  label: string
  isSensitive: boolean
  scopes: string[]
  /** Comma-separated: role names, "Grant". */
  sources: string | null
}

export interface OverrideOutDto {
  id: string
  userAccountId: string
  code: string
  module: string
  label: string
  isSensitive: boolean
  effect: string
  scope: string | null
  reason: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface SessionOutDto {
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

export interface AuditOutDto {
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

export interface EndedOutDto {
  ended: number
}

// --- bodies -----------------------------------------------------------------------------------

export interface UserInDto {
  email: string
  displayName: string | null
  employeeId: IdIn | null
  password?: string
  isActive: boolean
  isSystemAdmin: boolean
  companyIds: IdIn[]
  roleIds: IdIn[]
  rowVersion?: string
}

export interface UserRolesInDto {
  roleIds: IdIn[]
  rowVersion: string
}

export interface PasswordInDto {
  password: string
}

export interface OwnPasswordInDto {
  currentPassword: string
  newPassword: string
}

export interface OverrideInDto {
  code: string
  effect: 'grant' | 'deny'
  scope: string | null
  reason: string | null
}

export interface RoleInDto {
  name: string
  description: string | null
  rowVersion?: string
}

export interface UnitInDto {
  unitType: 'branch' | 'department' | 'location'
  unitId: IdIn
}

export interface TickInDto {
  code: string
  scope: string
  units: UnitInDto[]
}

export interface RolePermissionsInDto {
  permissions: TickInDto[]
  rowVersion: string
}

export interface RoleCopyInDto {
  name: string
}

export interface RowVersionInDto {
  rowVersion: string
}
