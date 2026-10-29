import { z } from 'zod'

import { ACCESS_PAGE_SIZE, ACCESS_PAGE_SIZES } from './constants'

/*
 * The Access pages' URL state: search, filters, page, tab and the open form. Bad values fall
 * back; the defaults are left out of the URL (`stripSearchParams` in the routes).
 */

const text = z.string().trim().min(1).max(100).optional().catch(undefined)
const id = z
  .union([z.string(), z.number()])
  .transform(String)
  .pipe(z.string().min(1))
  .optional()
  .catch(undefined)
const flag = z.boolean().optional().catch(undefined)
const page = z.number().int().min(1).default(1).catch(1)
const pageSize = z
  .number()
  .int()
  .refine((value) => ACCESS_PAGE_SIZES.some((size) => size === value))
  .default(ACCESS_PAGE_SIZE)
  .catch(ACCESS_PAGE_SIZE)
const create = z.enum(['create']).optional().catch(undefined)

export const LIST_SEARCH_DEFAULTS = { page: 1, pageSize: ACCESS_PAGE_SIZE } as const

/**
 * `/settings/system-users?q=&status=active|disabled&roleId=&employee=left|none&page=&pageSize=
 * &dialog=create&edit=<id>`.
 */
export const usersSearchSchema = z.object({
  q: text,
  status: z.enum(['active', 'disabled']).optional().catch(undefined),
  roleId: id,
  employee: z.enum(['left', 'none']).optional().catch(undefined),
  page,
  pageSize,
  dialog: create,
  edit: id,
})
export type UsersSearch = z.infer<typeof usersSearchSchema>

export const USER_TABS = ['roles', 'permissions', 'overrides', 'sessions', 'history'] as const
export type UserTab = (typeof USER_TABS)[number]

export const USER_SEARCH_DEFAULTS = { tab: 'roles', sessionsPage: 1, historyPage: 1 } as const

/**
 * `/settings/system-users/<id>?tab=&q=` (the effective permissions' search)
 * `&ended=true` (ended sessions too) `&sessionsPage=&historyPage=`.
 */
export const userSearchSchema = z.object({
  tab: z.enum(USER_TABS).default('roles').catch('roles'),
  q: text,
  ended: flag,
  sessionsPage: page,
  historyPage: page,
})
export type UserSearch = z.infer<typeof userSearchSchema>

/** `/settings/user-group-permissions?q=&retired=true&page=&pageSize=&dialog=create&edit=<id>`. */
export const rolesSearchSchema = z.object({
  q: text,
  retired: flag,
  page,
  pageSize,
  dialog: create,
  edit: id,
})
export type RolesSearch = z.infer<typeof rolesSearchSchema>

export const ROLE_TABS = ['permissions', 'users', 'history'] as const
export type RoleTab = (typeof ROLE_TABS)[number]

export const ROLE_SEARCH_DEFAULTS = { tab: 'permissions', usersPage: 1, historyPage: 1 } as const

/**
 * `/settings/user-group-permissions/<id>?tab=&q=` (the catalogue's search) `&ticked=true`
 * (ticked only) `&usersPage=&historyPage=`.
 */
export const roleSearchSchema = z.object({
  tab: z.enum(ROLE_TABS).default('permissions').catch('permissions'),
  q: text,
  ticked: flag,
  usersPage: page,
  historyPage: page,
})
export type RoleSearch = z.infer<typeof roleSearchSchema>
