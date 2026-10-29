import { compact } from '../api/access.api'
import type {
  AuditListParams,
  EmployeeFilter,
  RoleListParams,
  SessionListParams,
  UserListParams,
} from '../types/access.types'

/** Query keys of the Access screens; every mutation invalidates `all`. */
export const accessKeys = {
  all: ['access'] as const,
  /** The catalogue (outside `all`: no access change alters it). */
  catalogue: () => ['access-catalogue'] as const,
  users: () => [...accessKeys.all, 'users'] as const,
  userList: (params: UserListParams & { employee?: EmployeeFilter | undefined }) =>
    [...accessKeys.users(), 'list', compact(params)] as const,
  user: (id: string) => [...accessKeys.users(), 'detail', id] as const,
  effective: (id: string) => [...accessKeys.users(), 'detail', id, 'permissions'] as const,
  overrides: (id: string) => [...accessKeys.users(), 'detail', id, 'overrides'] as const,
  sessions: (params: SessionListParams) =>
    [...accessKeys.all, 'sessions', compact(params)] as const,
  roles: () => [...accessKeys.all, 'roles'] as const,
  roleList: (params: RoleListParams) => [...accessKeys.roles(), 'list', compact(params)] as const,
  role: (id: string) => [...accessKeys.roles(), 'detail', id] as const,
  audit: (params: AuditListParams) => [...accessKeys.all, 'audit', compact(params)] as const,
  /** Former employees (outside `all`: an access change does not change who has left). */
  formerEmployees: () => ['access-former-employees'] as const,
}
