import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import { useAuthStore } from '@/stores/auth-store'
import type { Paginated } from '@/types/api'

import { accessApi } from '../api/access.api'
import type {
  AuditListParams,
  EmployeeFilter,
  OverrideInput,
  RoleInput,
  RoleListParams,
  SessionListParams,
  TickInput,
  UserInput,
  UserListParams,
} from '../types/access.types'
import { accessKeys } from './access-keys'

/** A page cut in the browser, in the API's `{data, meta}` shape. */
function paginate<T>(rows: readonly T[], page: number, pageSize: number): Paginated<T> {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  return {
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    meta: { page, pageSize, total: rows.length, totalPages },
  }
}

// --- queries ------------------------------------------------------------------------------------

/** The permission catalogue: changes only with a release, so it is kept for the session. */
export const useCatalogue = (enabled = true) =>
  useQuery({
    queryKey: accessKeys.catalogue(),
    queryFn: ({ signal }) => accessApi.permissions(signal),
    staleTime: Number.POSITIVE_INFINITY,
    enabled,
  })

const formerEmployeesOptions = () =>
  queryOptions({
    queryKey: accessKeys.formerEmployees(),
    queryFn: ({ signal }) => accessApi.formerEmployees(signal),
    staleTime: 5 * 60_000,
  })

/** Employees who have left (by id), to mark and find their accounts. */
export const useFormerEmployees = (enabled = true) =>
  useQuery({ ...formerEmployeesOptions(), enabled })

/**
 * One page of accounts. `employee` (has left / none linked) has no API parameter, so with it
 * every matching account is read and the page is cut in the browser.
 */
export function useUserList(params: UserListParams & { employee?: EmployeeFilter | undefined }) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: accessKeys.userList(params),
    queryFn: async ({ signal }) => {
      const { employee, page, pageSize, ...filters } = params
      if (!employee) return accessApi.users({ ...filters, page, pageSize }, signal)
      const rows = await accessApi.allUsers(filters, signal)
      const former = employee === 'left' ? await queryClient.query(formerEmployeesOptions()) : null
      const kept = rows.filter((row) =>
        employee === 'none'
          ? !row.employeeId
          : row.employeeId !== null && (former?.has(row.employeeId) ?? false),
      )
      return paginate(kept, page, pageSize)
    },
    placeholderData: keepPreviousData,
  })
}

/** One account; `null` skips the request. */
export const useUser = (id: string | null) =>
  useQuery({
    queryKey: accessKeys.user(id ?? ''),
    queryFn: ({ signal }) => accessApi.user(id ?? '', signal),
    enabled: id !== null,
  })

export const useEffectivePermissions = (id: string) =>
  useQuery({
    queryKey: accessKeys.effective(id),
    queryFn: ({ signal }) => accessApi.effectivePermissions(id, signal),
  })

export const useOverrides = (id: string) =>
  useQuery({
    queryKey: accessKeys.overrides(id),
    queryFn: ({ signal }) => accessApi.overrides(id, signal),
  })

export const useSessions = (params: SessionListParams) =>
  useQuery({
    queryKey: accessKeys.sessions(params),
    queryFn: ({ signal }) => accessApi.sessions(params, signal),
    placeholderData: keepPreviousData,
  })

export const useRoleList = (params: RoleListParams, enabled = true) =>
  useQuery({
    queryKey: accessKeys.roleList(params),
    queryFn: ({ signal }) => accessApi.roles(params, signal),
    placeholderData: keepPreviousData,
    enabled,
  })

/** Every role (up to 100), retired ones too: the role pickers and filters. */
export const useRoleOptions = (enabled = true) =>
  useRoleList({ includeRetired: true, page: 1, pageSize: 100 }, enabled)

export const useRole = (id: string | null) =>
  useQuery({
    queryKey: accessKeys.role(id ?? ''),
    queryFn: ({ signal }) => accessApi.role(id ?? '', signal),
    enabled: id !== null,
  })

export const useAudit = (params: AuditListParams) =>
  useQuery({
    queryKey: accessKeys.audit(params),
    queryFn: ({ signal }) => accessApi.audit(params, signal),
    placeholderData: keepPreviousData,
  })

/** The signed-in person's email, to tell their own account (no Disable, own password). */
export const useMyEmail = () => useAuthStore((state) => state.user?.email.toLowerCase() ?? null)

// --- mutations ----------------------------------------------------------------------------------

/**
 * An Access change: toasts on success and refetches every Access query afterwards, failed or
 * not (a 409 means the row changed, so the screens need its new version). Form saves
 * (`showErrors: false`) leave their errors to the form, which puts them on its fields; actions
 * toast them through the app's mutation cache.
 */
function useAccessMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  successMessage: string | ((variables: TVariables, result: TResult) => string),
  showErrors = false,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { suppressErrorToast: !showErrors },
    onSuccess: (result, variables) => {
      toast.success(
        typeof successMessage === 'string' ? successMessage : successMessage(variables, result),
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: accessKeys.all }),
  })
}

/** Add / Edit user: `POST /access/users` or `PUT /access/users/{id}`. */
export const useSaveUser = () =>
  useAccessMutation(
    ({
      id,
      input,
      rowVersion,
    }: {
      id?: string | undefined
      input: UserInput
      rowVersion?: string
    }) => (id ? accessApi.updateUser(id, input, rowVersion ?? '') : accessApi.createUser(input)),
    ({ id }, user) => (id ? `${user.name} saved` : `${user.name} can now sign in`),
  )

/** Enable / Disable (disabling ends the account's sessions). */
export const useSetUserActive = () =>
  useAccessMutation(
    ({
      id,
      active,
      rowVersion,
    }: {
      id: string
      active: boolean
      rowVersion: string
      name: string
    }) => accessApi.setUserActive(id, active, rowVersion),
    ({ active, name }) =>
      active ? `${name}’s account is enabled` : `${name}’s account is disabled`,
    true,
  )

export const useSetPassword = () =>
  useAccessMutation(
    ({ id, password }: { id: string; password: string; name: string }) =>
      accessApi.setPassword(id, password),
    ({ name }) => `New password set for ${name}`,
  )

export const useChangeOwnPassword = () =>
  useAccessMutation(
    ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      accessApi.changeOwnPassword(currentPassword, newPassword),
    'Your password is changed',
  )

/** The roles all at once (`PUT /access/users/{id}/roles`). */
export const useSetUserRoles = () =>
  useAccessMutation(
    ({ id, roleIds, rowVersion }: { id: string; roleIds: string[]; rowVersion: string }) =>
      accessApi.setUserRoles(id, roleIds, rowVersion),
    (_variables, user) => `${user.name}’s roles saved`,
  )

export const useSaveOverride = () =>
  useAccessMutation(
    ({ userId, input }: { userId: string; input: OverrideInput }) =>
      accessApi.saveOverride(userId, input),
    (_variables, override) =>
      `${override.effect === 'grant' ? 'Granted' : 'Denied'}: ${override.label}`,
  )

export const useDeleteOverride = () =>
  useAccessMutation(
    ({
      userId,
      id,
      rowVersion,
    }: {
      userId: string
      id: string
      rowVersion: string
      label: string
    }) => accessApi.deleteOverride(userId, id, rowVersion),
    ({ label }) => `Override removed: ${label}`,
    true,
  )

/** End All: every session of one account. */
export const useEndUserSessions = () =>
  useAccessMutation(
    ({ id }: { id: string; name: string }) => accessApi.endUserSessions(id),
    ({ name }, ended) =>
      ended === 0
        ? `${name} had no open sessions`
        : `${String(ended)} session${ended === 1 ? '' : 's'} of ${name} ended`,
    true,
  )

export const useEndSession = () =>
  useAccessMutation(
    ({ id }: { id: string; device: string }) => accessApi.endSession(id),
    ({ device }, ended) =>
      ended === 0 ? 'That session had already ended' : `Signed out: ${device}`,
    true,
  )

export const useSaveRole = () =>
  useAccessMutation(
    ({
      id,
      input,
      rowVersion,
    }: {
      id?: string | undefined
      input: RoleInput
      rowVersion?: string
    }) => (id ? accessApi.updateRole(id, input, rowVersion ?? '') : accessApi.createRole(input)),
    ({ id }, role) => (id ? `${role.name} saved` : `${role.name} added`),
  )

export const useDeleteRole = () =>
  useAccessMutation(
    ({ id, rowVersion }: { id: string; rowVersion: string; name: string }) =>
      accessApi.deleteRole(id, rowVersion),
    ({ name }) => `${name} deleted`,
    true,
  )

export const useCopyRole = () =>
  useAccessMutation(
    ({ id, name }: { id: string; name: string }) => accessApi.copyRole(id, name),
    (_variables, role) => `${role.name} added as a copy`,
  )

export const useSetRoleRetired = () =>
  useAccessMutation(
    ({
      id,
      retired,
      rowVersion,
    }: {
      id: string
      retired: boolean
      rowVersion: string
      name: string
    }) => accessApi.setRoleRetired(id, retired, rowVersion),
    ({ retired, name }) => (retired ? `${name} retired` : `${name} restored`),
    true,
  )

/** Save all ticks at once (`PUT /access/roles/{id}/permissions`). */
export const useSaveRolePermissions = () =>
  useAccessMutation(
    ({ id, ticks, rowVersion }: { id: string; ticks: TickInput[]; rowVersion: string }) =>
      accessApi.saveRolePermissions(id, ticks, rowVersion),
    (_variables, role) =>
      `${role.name}: ${String(role.permissionCount)} permission${role.permissionCount === 1 ? '' : 's'} saved`,
  )
