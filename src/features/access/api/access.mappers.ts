import {
  type AuditEntry,
  type EffectivePermission,
  type Override,
  OVERRIDE_EFFECTS,
  OVERRIDE_SCOPES,
  type OverrideInput,
  type PermissionDef,
  type Role,
  type RoleDetail,
  type RoleInput,
  type Scope,
  SCOPES,
  type Session,
  type Tick,
  type TickInput,
  type Unit,
  UNIT_TYPES,
  type User,
  type UserDetail,
  type UserInput,
} from '../types/access.types'
import type {
  AuditOutDto,
  EffectivePermissionOutDto,
  IdIn,
  OverrideInDto,
  OverrideOutDto,
  PermissionOutDto,
  RoleDetailOutDto,
  RoleInDto,
  RoleOutDto,
  SessionOutDto,
  TickInDto,
  TickOutDto,
  UnitOutDto,
  UserDetailOutDto,
  UserInDto,
  UserOutDto,
} from './access.dto'

// --- ids, instants, enums ---------------------------------------------------------------------

/**
 * An id as a request body sends it: the API's ids are integers on the way in (strings on the
 * way out). Non-numeric ids (the mock's readable ones, `em_shelley`) go as they are.
 */
export const toApiId = (id: string): IdIn => (/^\d+$/.test(id) ? Number(id) : id)

/** The API writes UTC instants without an offset; read them as UTC. */
export function instant(value: string): string
export function instant(value: string | null | undefined): string | null
export function instant(value: string | null | undefined): string | null {
  if (!value) return null
  return /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`
}

/** A value the screens do not know stays as it came (its label then shows the raw text). */
function oneOf<T extends string>(values: readonly T[], value: string): T {
  return (values.find((known) => known === value) ?? value) as T
}

const scopeOf = (value: string): Scope => oneOf(SCOPES, value)

/** "HR Manager, Line Manager" → the names. */
export const splitNames = (value: string | null): string[] =>
  (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

/** Text the API may send empty or blank: `null` then. */
const textOrNull = (value: string | null | undefined): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

// --- catalogue and roles ----------------------------------------------------------------------

export const toPermissionDef = (dto: PermissionOutDto): PermissionDef => ({
  id: dto.id,
  code: dto.code,
  module: dto.module,
  screen: dto.screen,
  actionCode: dto.actionCode,
  label: dto.label,
  hint: textOrNull(dto.hint),
  isSensitive: dto.isSensitive,
})

const toUnit = (dto: UnitOutDto): Unit => ({
  unitType: oneOf(UNIT_TYPES, dto.unitType),
  unitId: dto.unitId,
  unitName: dto.unitName,
})

const toTick = (dto: TickOutDto): Tick => ({
  code: dto.code,
  module: dto.module,
  screen: dto.screen,
  actionCode: dto.actionCode,
  label: dto.label,
  isSensitive: dto.isSensitive,
  scope: scopeOf(dto.scope),
  units: dto.units.map(toUnit),
})

export const toRole = (dto: RoleOutDto): Role => ({
  id: dto.id,
  code: dto.code,
  name: dto.name,
  description: textOrNull(dto.description),
  isSystem: dto.isSystem,
  isActive: dto.isActive,
  permissionCount: dto.permissionCount,
  userCount: dto.userCount,
  createdAt: instant(dto.createdAt),
  updatedAt: instant(dto.updatedAt),
  rowVersion: dto.rowVersion,
})

export const toRoleDetail = (dto: RoleDetailOutDto): RoleDetail => ({
  ...toRole(dto),
  permissions: dto.permissions.map(toTick),
})

export const toRoleIn = (input: RoleInput, rowVersion?: string): RoleInDto => ({
  name: input.name.trim(),
  description: textOrNull(input.description),
  ...(rowVersion ? { rowVersion } : {}),
})

export const toTickIn = (tick: TickInput): TickInDto => ({
  code: tick.code,
  scope: tick.scope,
  units:
    tick.scope === 'selected_units'
      ? tick.units.map((unit) => ({ unitType: unit.unitType, unitId: toApiId(unit.unitId) }))
      : [],
})

// --- users ------------------------------------------------------------------------------------

export const toUser = (dto: UserOutDto): User => ({
  id: dto.id,
  email: dto.email,
  displayName: textOrNull(dto.displayName),
  name: textOrNull(dto.name) ?? textOrNull(dto.displayName) ?? dto.email,
  employeeId: dto.employeeId,
  employeeCode: dto.employeeCode,
  homeCompanyId: dto.homeCompanyId,
  homeCompanyName: dto.homeCompanyName,
  isActive: dto.isActive,
  isSystemAdmin: dto.isSystemAdmin,
  lastLoginAt: instant(dto.lastLoginAt),
  roleNames: splitNames(dto.roleNames),
  createdAt: instant(dto.createdAt),
  updatedAt: instant(dto.updatedAt),
  rowVersion: dto.rowVersion,
})

export const toUserDetail = (dto: UserDetailOutDto): UserDetail => ({
  ...toUser(dto),
  roles: dto.roles.map((role) => ({ ...role })),
  companies: dto.companies.map((company) => ({ ...company })),
})

export function toUserIn(input: UserInput, rowVersion?: string): UserInDto {
  return {
    email: input.email.trim().toLowerCase(),
    displayName: textOrNull(input.displayName),
    employeeId: input.employeeId ? toApiId(input.employeeId) : null,
    ...(input.password ? { password: input.password } : {}),
    isActive: input.isActive,
    isSystemAdmin: input.isSystemAdmin,
    companyIds: input.companyIds.map(toApiId),
    roleIds: input.roleIds.map(toApiId),
    ...(rowVersion ? { rowVersion } : {}),
  }
}

export const toEffectivePermission = (dto: EffectivePermissionOutDto): EffectivePermission => ({
  code: dto.code,
  module: dto.module,
  label: dto.label,
  isSensitive: dto.isSensitive,
  scopes: dto.scopes.map(scopeOf),
  sources: splitNames(dto.sources),
})

export const toOverride = (dto: OverrideOutDto): Override => ({
  id: dto.id,
  userAccountId: dto.userAccountId,
  code: dto.code,
  module: dto.module,
  label: dto.label,
  isSensitive: dto.isSensitive,
  effect: oneOf(OVERRIDE_EFFECTS, dto.effect),
  scope: dto.scope ? oneOf(OVERRIDE_SCOPES, dto.scope) : null,
  reason: textOrNull(dto.reason),
  createdAt: instant(dto.createdAt),
  updatedAt: instant(dto.updatedAt),
  rowVersion: dto.rowVersion,
})

export const toOverrideIn = (input: OverrideInput): OverrideInDto => ({
  code: input.code,
  effect: input.effect,
  scope: input.effect === 'deny' ? null : input.scope,
  reason: textOrNull(input.reason),
})

export const toSession = (dto: SessionOutDto): Session => ({
  ...dto,
  signedInAt: instant(dto.signedInAt),
  lastSeenAt: instant(dto.lastSeenAt),
  expiresAt: instant(dto.expiresAt),
  revokedAt: instant(dto.revokedAt),
})

export const toAuditEntry = (dto: AuditOutDto): AuditEntry => ({
  ...dto,
  performedAt: instant(dto.performedAt),
})
