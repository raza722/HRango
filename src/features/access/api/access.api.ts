import { fetchEmployeeLookup } from '@/hooks/use-employee-lookup'
import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  AuditEntry,
  AuditListParams,
  OverrideInput,
  Role,
  RoleInput,
  RoleListParams,
  Session,
  SessionListParams,
  TickInput,
  User,
  UserInput,
  UserListParams,
} from '../types/access.types'
import type {
  AuditOutDto,
  EffectivePermissionOutDto,
  EndedOutDto,
  OverrideOutDto,
  PermissionOutDto,
  RoleDetailOutDto,
  RoleOutDto,
  SessionOutDto,
  UserDetailOutDto,
  UserOutDto,
} from './access.dto'
import {
  toApiId,
  toAuditEntry,
  toEffectivePermission,
  toOverride,
  toOverrideIn,
  toPermissionDef,
  toRole,
  toRoleDetail,
  toRoleIn,
  toSession,
  toTickIn,
  toUser,
  toUserDetail,
  toUserIn,
} from './access.mappers'

/** Query values: only what is set, so keys and URLs stay short. */
export function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  ) as Partial<T>
}

/** Ids in a query string go as the API reads them (numbers when numeric). */
function withIds<T extends object>(params: T, keys: readonly (keyof T)[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...compact(params) }
  for (const key of keys) {
    const value = out[key as string]
    if (typeof value === 'string') out[key as string] = toApiId(value)
  }
  return out
}

const BASE = '/access'
const at = (resource: string, id: string, rest = '') =>
  `${BASE}/${resource}/${encodeURIComponent(id)}${rest}`

async function getPage<TDto>(
  url: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Paginated<TDto>> {
  const { data } = await apiClient.get<Paginated<TDto>>(url, { params, signal })
  return data
}

const mapPage = <TDto, T>(page: Paginated<TDto>, map: (dto: TDto) => T): Paginated<T> => ({
  data: page.data.map(map),
  meta: page.meta,
})

async function getItem<TDto>(url: string, signal?: AbortSignal): Promise<TDto> {
  const { data } = await apiClient.get<ApiItem<TDto>>(url, { signal })
  return data.data
}

async function send<TDto>(
  method: 'post' | 'put' | 'patch',
  url: string,
  body: unknown,
): Promise<TDto> {
  const { data } = await apiClient[method]<ApiItem<TDto>>(url, body)
  return data.data
}

/** Pages read when a filter has no API parameter (100 a page, so up to 2,000 rows). */
const MAX_PAGES = 20

/** REST calls of `/access…` (Settings → System Users and User Group Permissions). */
export const accessApi = {
  // --- catalogue ------------------------------------------------------------------------------

  /** `GET /access/permissions`: every tick, in screen order. */
  async permissions(signal?: AbortSignal) {
    return (await getItem<PermissionOutDto[]>(`${BASE}/permissions`, signal)).map(toPermissionDef)
  },

  // --- users ----------------------------------------------------------------------------------

  /** `GET /access/users?q&isActive&roleId&page&pageSize`. */
  async users(params: UserListParams, signal?: AbortSignal): Promise<Paginated<User>> {
    const page = await getPage<UserOutDto>(`${BASE}/users`, withIds(params, ['roleId']), signal)
    return mapPage(page, toUser)
  },

  /** Every account matching the API's filters (for the filters it has no parameter for). */
  async allUsers(params: Omit<UserListParams, 'page' | 'pageSize'>, signal?: AbortSignal) {
    const rows: User[] = []
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await accessApi.users({ ...params, page, pageSize: 100 }, signal)
      rows.push(...result.data)
      if (page >= result.meta.totalPages || result.data.length === 0) break
    }
    return rows
  },

  /**
   * Employees who are no longer working (`GET /employees/lookup?includeInactive=true`, every
   * page): the lookup has no status filter, so the inactive ones are kept from all of them.
   */
  async formerEmployees(signal?: AbortSignal) {
    const former = new Map<string, { id: string; code: string; name: string; status: string }>()
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await fetchEmployeeLookup(
        { permission: 'access.users.view', includeInactive: true, page, pageSize: 100 },
        signal,
      )
      for (const row of result.data) {
        if (row.status !== 'active' && row.status !== 'probation' && row.status !== 'notice') {
          former.set(row.id, { id: row.id, code: row.code, name: row.name, status: row.status })
        }
      }
      if (page >= result.meta.totalPages || result.data.length === 0) break
    }
    return former
  },

  async user(id: string, signal?: AbortSignal) {
    return toUserDetail(await getItem<UserDetailOutDto>(at('users', id), signal))
  },

  async createUser(input: UserInput) {
    return toUserDetail(await send<UserDetailOutDto>('post', `${BASE}/users`, toUserIn(input)))
  },

  async updateUser(id: string, input: UserInput, rowVersion: string) {
    return toUserDetail(
      await send<UserDetailOutDto>('put', at('users', id), toUserIn(input, rowVersion)),
    )
  },

  async setUserActive(id: string, active: boolean, rowVersion: string) {
    return toUserDetail(
      await send<UserDetailOutDto>('patch', at('users', id, active ? '/enable' : '/disable'), {
        rowVersion,
      }),
    )
  },

  /** `PUT /access/users/{id}/password`: signs the user out everywhere. */
  async setPassword(id: string, password: string) {
    await apiClient.put(at('users', id, '/password'), { password })
  },

  /** `PUT /access/users/{id}/roles`: the roles all at once. */
  async setUserRoles(id: string, roleIds: readonly string[], rowVersion: string) {
    return toUserDetail(
      await send<UserDetailOutDto>('put', at('users', id, '/roles'), {
        roleIds: roleIds.map(toApiId),
        rowVersion,
      }),
    )
  },

  async effectivePermissions(id: string, signal?: AbortSignal) {
    return (
      await getItem<EffectivePermissionOutDto[]>(at('users', id, '/permissions'), signal)
    ).map(toEffectivePermission)
  },

  async overrides(id: string, signal?: AbortSignal) {
    return (await getItem<OverrideOutDto[]>(at('users', id, '/overrides'), signal)).map(toOverride)
  },

  /** `PUT /access/users/{id}/overrides`: adds or replaces the override of that code. */
  async saveOverride(id: string, input: OverrideInput) {
    return toOverride(
      await send<OverrideOutDto>('put', at('users', id, '/overrides'), toOverrideIn(input)),
    )
  },

  async deleteOverride(userId: string, overrideId: string, rowVersion: string) {
    await apiClient.delete(at('users', userId, `/overrides/${encodeURIComponent(overrideId)}`), {
      params: { rowVersion },
    })
  },

  /** `PATCH /access/users/{id}/sessions/end`: how many ended. */
  async endUserSessions(id: string) {
    return (await send<EndedOutDto>('patch', at('users', id, '/sessions/end'), {})).ended
  },

  /** `POST /access/me/password`: the user's other sessions end. */
  async changeOwnPassword(currentPassword: string, newPassword: string) {
    await apiClient.post(`${BASE}/me/password`, { currentPassword, newPassword })
  },

  // --- sessions -------------------------------------------------------------------------------

  async sessions(params: SessionListParams, signal?: AbortSignal): Promise<Paginated<Session>> {
    const page = await getPage<SessionOutDto>(
      `${BASE}/sessions`,
      withIds(params, ['userId']),
      signal,
    )
    return mapPage(page, toSession)
  },

  async endSession(id: string) {
    return (await send<EndedOutDto>('patch', at('sessions', id, '/end'), {})).ended
  },

  // --- roles ----------------------------------------------------------------------------------

  /** `GET /access/roles?q&includeRetired&page&pageSize`. */
  async roles(params: RoleListParams, signal?: AbortSignal): Promise<Paginated<Role>> {
    return mapPage(await getPage<RoleOutDto>(`${BASE}/roles`, compact(params), signal), toRole)
  },

  async role(id: string, signal?: AbortSignal) {
    return toRoleDetail(await getItem<RoleDetailOutDto>(at('roles', id), signal))
  },

  async createRole(input: RoleInput) {
    return toRoleDetail(await send<RoleDetailOutDto>('post', `${BASE}/roles`, toRoleIn(input)))
  },

  async updateRole(id: string, input: RoleInput, rowVersion: string) {
    return toRoleDetail(
      await send<RoleDetailOutDto>('put', at('roles', id), toRoleIn(input, rowVersion)),
    )
  },

  async deleteRole(id: string, rowVersion: string) {
    await apiClient.delete(at('roles', id), { params: { rowVersion } })
  },

  /** `PUT /access/roles/{id}/permissions`: replaces every tick. */
  async saveRolePermissions(id: string, ticks: readonly TickInput[], rowVersion: string) {
    return toRoleDetail(
      await send<RoleDetailOutDto>('put', at('roles', id, '/permissions'), {
        permissions: ticks.map(toTickIn),
        rowVersion,
      }),
    )
  },

  async copyRole(id: string, name: string) {
    return toRoleDetail(
      await send<RoleDetailOutDto>('post', at('roles', id, '/copy'), { name: name.trim() }),
    )
  },

  async setRoleRetired(id: string, retired: boolean, rowVersion: string) {
    return toRoleDetail(
      await send<RoleDetailOutDto>('patch', at('roles', id, retired ? '/retire' : '/restore'), {
        rowVersion,
      }),
    )
  },

  // --- audit ----------------------------------------------------------------------------------

  /** `GET /access/audit?entity=role|user&entityId&page&pageSize`, newest first. */
  async audit(params: AuditListParams, signal?: AbortSignal): Promise<Paginated<AuditEntry>> {
    const page = await getPage<AuditOutDto>(`${BASE}/audit`, withIds(params, ['entityId']), signal)
    return mapPage(page, toAuditEntry)
  },
}
