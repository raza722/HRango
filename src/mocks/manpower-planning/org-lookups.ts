import { http, HttpResponse } from 'msw'

import type { ApiItem } from '@/types/api'

import { findEmployee } from '../employees/seed'
import { organisationDepartments } from '../payroll/lookup-handlers'
import { lookupRow, salaryOn, today } from '../payroll/people'
import { branches, jobTitles } from '../settings/handlers'
import { apiPath, latency, requireAuth } from '../utils'

// The Organisation lists the Manpower Planning mock works with. Departments (with their
// sub-departments), branches, job titles and people are the app's shared ones (the shared
// Organisation lookup, Settings' branches and job titles, the company directory), so names and
// titles agree on every screen; the lists no other mock serves (divisions, employee groups,
// grades, job levels, cost centres) are kept here and answered by `orgLookupHandlers`.

export interface OrgItem {
  id: string
  name: string
  code?: string | null
  parentId?: string | null
}

export const DIVISIONS: OrgItem[] = [
  { id: 'dv_corporate', name: 'Corporate' },
  { id: 'dv_technology', name: 'Technology' },
  { id: 'dv_commercial', name: 'Commercial' },
]

export const EMPLOYEE_GROUPS: OrgItem[] = ['A', 'B', 'C'].map((name) => ({
  id: `eg_${name.toLowerCase()}`,
  name,
}))

export const GRADES: OrgItem[] = Array.from({ length: 5 }, (_, index) => ({
  id: `gr_${String(index + 1)}`,
  name: `Grade ${String(index + 1)}`,
}))

/** Job levels (Requests → Promotion's Level picker); ids as the promotion seed uses them. */
export const JOB_LEVELS: OrgItem[] = ['L1', 'L2', 'L3', 'L4', 'L5'].map((name) => ({
  id: `jl_${name.toLowerCase()}`,
  name,
}))

export const COST_CENTERS: OrgItem[] = [
  { id: 'cc_100', name: 'Head Office', code: 'CC-100' },
  { id: 'cc_200', name: 'Technology', code: 'CC-200' },
]

/** Stations: Settings' branches. */
export const stationList = (): OrgItem[] =>
  branches.all().map((branch) => ({ id: branch.id, name: branch.name }))

/** Departments, a sub-department being a department with a parent (the shared lookup's). */
export const departmentList = (): OrgItem[] => organisationDepartments()

/** Position titles: Organisation's job titles (Settings → Job Titles). */
export const jobTitleList = () => jobTitles.all()

export interface MockPerson {
  id: string
  code: string
  name: string
  /** Settings' job title of that name, if there is one (budgets are made per job title). */
  jobTitleId: string | null
  jobTitleName: string
  departmentId: string | null
  branchId: string | null
  /** Monthly gross today, Payroll's (what a plan line with a blank salary takes). */
  salary: number
}

const nameOf = (list: readonly OrgItem[], id: string | null | undefined) =>
  id ? (list.find((item) => item.id === id)?.name ?? null) : null

export const orgName = {
  division: (id: string | null | undefined) => nameOf(DIVISIONS, id),
  branch: (id: string | null | undefined) => nameOf(stationList(), id),
  department: (id: string | null | undefined) => nameOf(departmentList(), id),
  group: (id: string | null | undefined) => nameOf(EMPLOYEE_GROUPS, id),
  grade: (id: string | null | undefined) => nameOf(GRADES, id),
  costCenter: (id: string | null | undefined) => nameOf(COST_CENTERS, id),
  jobTitle: (id: string | null | undefined) => nameOf(jobTitleList(), id),
}

/** A person of the company directory, as the shared employee lookup gives them. */
export function findPerson(id: string | null | undefined): MockPerson | undefined {
  const employee = id ? findEmployee(id) : undefined
  if (!employee) return undefined
  const row = lookupRow(employee)
  return {
    id: employee.id,
    code: row.code,
    name: employee.name,
    jobTitleId: jobTitleList().find((title) => title.name === employee.jobTitle)?.id ?? null,
    jobTitleName: employee.jobTitle,
    departmentId: row.departmentId ?? null,
    branchId: employee.branchId,
    salary: salaryOn(employee.id, today()),
  }
}

const KINDS: Record<string, readonly OrgItem[]> = {
  divisions: DIVISIONS,
  'employee-groups': EMPLOYEE_GROUPS,
  grades: GRADES,
  'job-levels': JOB_LEVELS,
  'cost-centers': COST_CENTERS,
}

/** The kinds the shared Organisation mocks answer (Payroll's lookup, Settings). */
const SHARED_KINDS = new Set(['departments', 'branches', 'job-titles', 'companies'])

/**
 * `GET /organisation/lookups/{kind}` for the lists kept here, and an empty list for a kind no
 * mock holds; departments, branches and job titles pass on to the shared Organisation mocks.
 */
export const orgLookupHandlers = [
  http.get(apiPath('/organisation/lookups/:kind'), async ({ request, params }) => {
    const kind = String(params.kind)
    if (SHARED_KINDS.has(kind)) return undefined
    const list = KINDS[kind] ?? []
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const q = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase()
    const rows = list
      .filter((item) => !q || item.name.toLowerCase().includes(q))
      .map((item) => ({ id: item.id, name: item.name, code: item.code ?? null, parentId: null }))
    return HttpResponse.json<ApiItem<typeof rows>>({ data: rows })
  }),
]
