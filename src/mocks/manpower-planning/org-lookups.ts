import { http, HttpResponse } from 'msw'

import type { ApiItem } from '@/types/api'

import { lookupPage } from '../employees/lookup'
import { apiPath, latency, requireAuth } from '../utils'

// The Organisation pickers and the employee picker as the API serves them
// (`GET /organisation/lookups/{kind}`, `GET /employees/lookup`), with the sample company the
// Manpower Planning and Benefits mocks use. Kept here, not borrowed from other features' mocks,
// so these two modules' mock data stay consistent whatever the others change.

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

export const BRANCHES: OrgItem[] = [
  { id: 'br_lhr_ho', name: 'Lahore Head Office' },
  { id: 'br_lhr_jt', name: 'Lahore Johar Town' },
  { id: 'br_khi', name: 'Karachi Sales Office' },
  { id: 'br_isb', name: 'Islamabad Office' },
]

/** Departments; a sub-department is a department with a parent. */
export const DEPARTMENTS: OrgItem[] = [
  { id: 'dp_hrm', name: 'Human Resource Management', parentId: null },
  { id: 'dp_finance', name: 'Finance', parentId: null },
  { id: 'dp_mobile', name: 'Mobile App', parentId: null },
  { id: 'dp_marketing', name: 'Marketing', parentId: null },
  { id: 'sd_accounts', name: 'Accounts', parentId: 'dp_finance' },
  { id: 'sd_audit', name: 'Audit', parentId: 'dp_finance' },
  { id: 'sd_design', name: 'Design', parentId: 'dp_mobile' },
  { id: 'sd_digital', name: 'Digital', parentId: 'dp_marketing' },
  { id: 'sd_brand', name: 'Brand', parentId: 'dp_marketing' },
]

export const EMPLOYEE_GROUPS: OrgItem[] = ['A', 'B', 'C'].map((name) => ({
  id: `eg_${name.toLowerCase()}`,
  name,
}))

export const GRADES: OrgItem[] = Array.from({ length: 5 }, (_, index) => ({
  id: `gr_${String(index + 1)}`,
  name: `Grade ${String(index + 1)}`,
}))

export const COST_CENTERS: OrgItem[] = [
  { id: 'cc_100', name: 'Head Office', code: 'CC-100' },
  { id: 'cc_200', name: 'Technology', code: 'CC-200' },
]

/** Organisation's job titles: Manpower Planning's position titles. */
export const JOB_TITLES: (OrgItem & { createdAt: string })[] = [
  { id: 'jt_accounts', name: 'Accounts', createdAt: '2023-12-16T12:30:00' },
  { id: 'jt_uiux', name: 'UI/UX Designer', createdAt: '2023-12-10T22:30:00' },
  { id: 'jt_marketing', name: 'Marketing', createdAt: '2023-12-08T10:00:00' },
  { id: 'jt_accountant', name: 'Accountant', createdAt: '2024-01-10T22:00:00' },
  { id: 'jt_hr', name: 'HR Manager', createdAt: '2023-12-01T09:00:00' },
]

export interface MockPerson {
  id: string
  code: string
  name: string
  jobTitleId: string | null
  departmentId: string | null
  branchId: string
  /** Monthly gross today (what a plan line with a blank salary takes). */
  salary: number
  dateOfBirth: string | null
  maritalStatus: string | null
}

export const PEOPLE: MockPerson[] = [
  {
    id: 'em_hamza',
    code: 'TE-0001',
    name: 'Hamza Ashraf',
    jobTitleId: 'jt_hr',
    departmentId: 'dp_hrm',
    branchId: 'br_lhr_ho',
    salary: 250000,
    dateOfBirth: '1986-04-12',
    maritalStatus: 'married',
  },
  {
    id: 'em_hina',
    code: 'TE-0002',
    name: 'Hina Raza',
    jobTitleId: 'jt_accountant',
    departmentId: 'dp_finance',
    branchId: 'br_lhr_ho',
    salary: 120000,
    dateOfBirth: '1990-08-21',
    maritalStatus: 'single',
  },
  {
    id: 'em_omer',
    code: 'TE-0003',
    name: 'Omer Farooq',
    jobTitleId: 'jt_accounts',
    departmentId: 'dp_finance',
    branchId: 'br_lhr_ho',
    salary: 90000,
    dateOfBirth: null,
    maritalStatus: null,
  },
  {
    id: 'em_maryam',
    code: 'TE-0004',
    name: 'Maryam Javed',
    jobTitleId: 'jt_uiux',
    departmentId: 'dp_mobile',
    branchId: 'br_lhr_jt',
    salary: 80000,
    dateOfBirth: '1995-02-03',
    maritalStatus: null,
  },
  {
    id: 'em_saad',
    code: 'TE-0005',
    name: 'Saad Khan',
    jobTitleId: null,
    departmentId: 'dp_mobile',
    branchId: 'br_lhr_jt',
    salary: 150000,
    dateOfBirth: '1988-11-30',
    maritalStatus: 'married',
  },
  {
    id: 'em_ayesha',
    code: 'TE-0006',
    name: 'Ayesha Malik',
    jobTitleId: 'jt_marketing',
    departmentId: 'dp_marketing',
    branchId: 'br_khi',
    salary: 70000,
    dateOfBirth: '1993-06-15',
    maritalStatus: 'single',
  },
]

const nameOf = (list: readonly OrgItem[], id: string | null | undefined) =>
  id ? (list.find((item) => item.id === id)?.name ?? null) : null

export const orgName = {
  division: (id: string | null | undefined) => nameOf(DIVISIONS, id),
  branch: (id: string | null | undefined) => nameOf(BRANCHES, id),
  department: (id: string | null | undefined) => nameOf(DEPARTMENTS, id),
  group: (id: string | null | undefined) => nameOf(EMPLOYEE_GROUPS, id),
  grade: (id: string | null | undefined) => nameOf(GRADES, id),
  costCenter: (id: string | null | undefined) => nameOf(COST_CENTERS, id),
  jobTitle: (id: string | null | undefined) => nameOf(JOB_TITLES, id),
}

export const findPerson = (id: string | null | undefined) =>
  PEOPLE.find((person) => person.id === id)

/** A person as `GET /employees/lookup` returns them. */
export function personLookup(person: MockPerson) {
  return {
    id: person.id,
    code: person.code,
    name: person.name,
    designationName: null,
    jobTitleName: orgName.jobTitle(person.jobTitleId),
    departmentId: person.departmentId,
    departmentName: orgName.department(person.departmentId),
    branchId: person.branchId,
    branchName: orgName.branch(person.branchId) ?? '',
    status: 'active',
    photoUrl: null,
  }
}

const KINDS: Record<string, readonly OrgItem[]> = {
  divisions: DIVISIONS,
  branches: BRANCHES,
  departments: DEPARTMENTS,
  'employee-groups': EMPLOYEE_GROUPS,
  grades: GRADES,
  'cost-centers': COST_CENTERS,
  'job-titles': JOB_TITLES,
}

/** `GET /organisation/lookups/{kind}` and `GET /employees/lookup` for this sample company. */
export const orgLookupHandlers = [
  http.get(apiPath('/organisation/lookups/:kind'), async ({ request, params }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const kind = String(params.kind)
    if (kind === 'companies') return undefined
    const url = new URL(request.url)
    const parentId = url.searchParams.get('parentId')
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const rows = (KINDS[kind] ?? [])
      .filter((item) => !parentId || item.parentId === parentId)
      .filter((item) => !q || item.name.toLowerCase().includes(q))
      .map((item) => ({
        id: item.id,
        name: item.name,
        code: item.code ?? null,
        parentId: item.parentId ?? null,
      }))
    return HttpResponse.json<ApiItem<typeof rows>>({ data: rows })
  }),

  http.get(apiPath('/employees/lookup'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const url = new URL(request.url)
    const departmentId = url.searchParams.get('departmentId')
    const branchId = url.searchParams.get('branchId')
    const rows = PEOPLE.filter(
      (person) =>
        (!departmentId || person.departmentId === departmentId) &&
        (!branchId || person.branchId === branchId),
    ).map(personLookup)
    return HttpResponse.json(lookupPage(rows, url))
  }),
]
