import { http, HttpResponse } from 'msw'

import type {
  CeoDashboard,
  DashboardAttendance,
  HrDashboard,
  LeaveApplication,
  MyDashboard,
  Notice,
  Workforce,
} from '@/features/dashboard'
import type { ApiItem } from '@/types/api'

import { DIRECTORY } from '../employees/seed'
import { apiPath, latency, requireAuth } from '../utils'

// `GET /dashboard/hr`, `/dashboard/ceo`, `/dashboard/me` in the API's shapes, with fixed
// figures for the demo company (?month= and ?day= move the dates only).

const isoDay = (date: Date) => date.toISOString().slice(0, 10)
const monthStart = (date: Date) => new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1))

function readDates(url: URL) {
  const day = url.searchParams.get('day') ?? isoDay(new Date())
  const month = isoDay(monthStart(new Date(url.searchParams.get('month') ?? day)))
  return { day, month }
}

function workforce(month: string): Workforce {
  const start = new Date(month)
  const turnoverByMonth = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 11 + index, 1))
    return { month: isoDay(date), hired: 3 + (index % 4), left: 1 + (index % 3) }
  })
  const departments = [...new Set(DIRECTORY.map((employee) => employee.department))].sort()
  return {
    month,
    headcount: 248,
    women: 102,
    men: 146,
    womenPercent: 41.13,
    hired: 6,
    left: 2,
    turnoverPercent: 0.81,
    byDepartment: departments.map((name, index) => ({
      id: `dep_${String(index + 1)}`,
      name,
      count: 12 + index * 7,
    })),
    byEmploymentType: [
      { id: 'et_1', name: 'Permanent', count: 201 },
      { id: 'et_2', name: 'Contractual', count: 31 },
      { id: 'et_3', name: 'Management Trainee', count: 16 },
    ],
    byGender: [
      { gender: 'male', count: 146 },
      { gender: 'female', count: 102 },
    ],
    byAge: [
      { band: '18-25', male: 30, female: 24, other: 0 },
      { band: '26-35', male: 71, female: 52, other: 0 },
      { band: '36-45', male: 33, female: 20, other: 0 },
      { band: '46+', male: 12, female: 6, other: 0 },
    ],
    turnoverByMonth,
    byDepartmentGender: departments.map((name, index) => ({
      id: `dep_${String(index + 1)}`,
      name,
      men: 7 + index * 4,
      women: 5 + index * 3,
    })),
    womenByJobTitle: [
      { id: 'jt_hrm', name: 'HR Manager', total: 2, women: 1, womenPercent: 50 },
      { id: 'jt_swe', name: 'Software Engineer', total: 40, women: 14, womenPercent: 35 },
    ],
  }
}

function attendance(day: string): DashboardAttendance {
  return {
    day,
    present: 221,
    absent: 13,
    onLeave: 14,
    absenteeismPercent: 5.24,
    byMonth: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      present: 4_700 + index * 20,
      absent: 210 - index * 5,
      onLeave: 180 + index * 3,
    })),
    rows: DIRECTORY.slice(0, 5).map((employee, index) => ({
      employeeId: employee.id,
      employeeName: employee.name,
      designationName: employee.jobTitle,
      firstIn: `${day}T0${String(8 + (index % 2))}:0${String(index)}:00`,
      lastOut: null,
      status: 'present',
    })),
  }
}

function leaveApplications(day: string): LeaveApplication[] {
  return DIRECTORY.slice(5, 8).map((employee, index) => ({
    id: `lv_${String(index + 1)}`,
    employeeId: employee.id,
    employeeName: employee.name,
    designationName: employee.jobTitle,
    appliedAt: `${day}T09:30:00`,
    fromDate: day,
    toDate: day,
    days: 1,
    reason: 'Personal work',
    status: index === 0 ? 'approved' : 'pending',
  }))
}

function notices(day: string): { noticeBoard: Notice[]; upcomingEvents: Notice[] } {
  return {
    noticeBoard: [
      {
        id: 'an_1',
        kind: 'notice',
        title: 'Office closed on Friday',
        body: 'The office stays closed for maintenance.',
        eventDate: null,
        publishFrom: day,
        createdAt: `${day}T08:00:00`,
      },
    ],
    upcomingEvents: [
      {
        id: 'an_2',
        kind: 'event',
        title: 'Annual dinner',
        body: null,
        eventDate: day,
        publishFrom: day,
        createdAt: `${day}T08:00:00`,
      },
    ],
  }
}

export const dashboardHandlers = [
  http.get(apiPath('/dashboard/hr'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const { day, month } = readDates(new URL(request.url))
    return HttpResponse.json<ApiItem<HrDashboard>>({
      data: {
        workforce: workforce(month),
        attendance: attendance(day),
        leaveApplications: leaveApplications(day),
        ...notices(day),
      },
    })
  }),

  http.get(apiPath('/dashboard/ceo'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const { day, month } = readDates(new URL(request.url))
    return HttpResponse.json<ApiItem<CeoDashboard>>({
      data: {
        workforce: workforce(month),
        attendance: attendance(day),
        leaveApplications: leaveApplications(day),
      },
    })
  }),

  http.get(apiPath('/dashboard/me'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const { day } = readDates(new URL(request.url))
    const mine = attendance(day)
    return HttpResponse.json<ApiItem<MyDashboard>>({
      data: {
        employeeId: 'em_shelley',
        attendance: { ...mine, present: 1, absent: 0, onLeave: 0, absenteeismPercent: 0 },
        leaveApplications: leaveApplications(day).slice(0, 1),
        ...notices(day),
      },
    })
  }),
]
