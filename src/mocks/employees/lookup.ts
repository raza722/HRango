import { http, HttpResponse } from 'msw'

import type { Employee } from '@/features/settings'
import type { Paginated } from '@/types/api'

import { apiPath, latency, paginate, requireAuth } from '../utils'
import { DIRECTORY, type DirectoryEmployee } from './seed'

/** `GET /employees/lookup` row for a directory person; `branchName` comes from the caller. */
export function toEmployeeLookup(
  employee: DirectoryEmployee,
  branchName: (branchId: string | null) => string,
): Employee {
  const index = DIRECTORY.findIndex((person) => person.id === employee.id)
  return {
    id: employee.id,
    code: `EMP-${String(index + 1).padStart(4, '0')}`,
    name: employee.name,
    designationName: employee.jobTitle,
    jobTitleName: employee.jobTitle,
    departmentId: null,
    departmentName: employee.department,
    branchId: employee.branchId,
    branchName: branchName(employee.branchId),
    status: 'active',
    photoUrl: null,
  }
}

/**
 * The paging of `GET /employees/lookup` over rows a mock already filtered by its own rules:
 * `q` matches the name or code; `page` with `pageSize` (1–100), or without `pageSize` a first
 * page of `limit` rows (1–100, default 50), as the API does. Answers `{data, meta}`.
 */
export function lookupPage<T extends { name: string; code?: string | null }>(
  rows: readonly T[],
  url: URL,
): Paginated<T> {
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const size = Number(url.searchParams.get('pageSize') ?? url.searchParams.get('limit') ?? '50')
  const pageSize = Math.min(100, Math.max(1, Number.isFinite(size) && size > 0 ? size : 50))
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
  const matches = q
    ? rows.filter((row) => `${row.name} ${row.code ?? ''}`.toLowerCase().includes(q))
    : rows
  return paginate(matches, page, pageSize)
}

/**
 * `GET /employees/lookup?permission&q&branchId&departmentId&page&pageSize`: the mock user
 * reaches everyone, so `permission` only has to be given. Paged `{data, meta}`.
 */
export function createEmployeeLookupHandler(branchName: (branchId: string | null) => string) {
  return http.get(apiPath('/employees/lookup'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const branchId = url.searchParams.get('branchId')
    const rows = DIRECTORY.filter((employee) => !branchId || employee.branchId === branchId)
      .map((employee) => toEmployeeLookup(employee, branchName))
      .sort((a, b) => a.name.localeCompare(b.name))
    return HttpResponse.json<Paginated<Employee>>(lookupPage(rows, url))
  })
}
