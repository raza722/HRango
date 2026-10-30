import { differenceInYears, endOfMonth, format, isValid, parse, subMonths } from 'date-fns'
import { http, HttpResponse } from 'msw'

import { type DayStatus as WireStatus, PRESENT_STATUSES } from '@/features/attendance'
import type {
  AgeBand,
  AttendanceRow,
  CeoDashboard,
  CountItem,
  DashboardAttendance,
  GenderCount,
  HrDashboard,
  JobTitleWomen,
  LeaveApplication,
  MonthAttendance,
  MonthTurnover,
  MyDashboard,
  Notice,
  Workforce,
} from '@/features/dashboard'
import type { Employee } from '@/features/talent-management/types/employees.types'
import type { ApiItem } from '@/types/api'

import { wire, wireStatus } from '../attendance/backend'
import { computeDay, type Snapshot, takeSnapshot } from '../attendance/engine'
import { DIRECTORY, findEmployee } from '../employees/seed'
import { leaveRequestRows } from '../leaves/requests'
import { personOf } from '../leaves/rules'
import { CURRENT_EMPLOYEE_ID } from '../scheduling/seed'
import { employees } from '../talent-management/db'
import { toEmployee } from '../talent-management/handlers'
import { apiPath, latency, requireAuth } from '../utils'

/*
 * `GET /dashboard/hr`, `/dashboard/ceo`, `/dashboard/me` in the API's shapes, worked out from the
 * other mocks on every request, so the figures agree with the modules they summarise:
 *
 * - Workforce: Talent Management's employee records (`toEmployee`). Employed = active,
 *   probation or notice, as the API counts it; a deactivated or left record counts until its
 *   end date. Hires are joining dates in the month, leavers end dates in the month, turnover is
 *   leavers ÷ headcount. Headcount and the breakdowns are as of the month's last day (today for
 *   the current month).
 * - Attendance: the attendance engine (the time sheet Attendance shows), for the people it
 *   covers (the company directory). The day's counts are that day's states; `byMonth` counts
 *   the scheduled days of each month of the year up to today, once per request. Present
 *   includes half and short days, work from home and official visits, as the API does.
 * - Leave applications: the shared leave store (Requests → Leave = Leaves), newest first.
 * - Notice board and upcoming events: samples dated around the day asked for.
 *
 * `?month=` (any day of a month) picks the month of the workforce figures and the year of
 * `byMonth`; `?day=` the attendance day (default today).
 */

const DAY = 'yyyy-MM-dd'
const isDay = (value: string | null): value is string =>
  value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parse(value, DAY, new Date()))
const toDay = (date: Date) => format(date, DAY)
const dateOf = (value: string) => parse(value, DAY, new Date())
const monthKey = (value: string) => value.slice(0, 7)

interface Dates {
  today: string
  /** The attendance day. */
  day: string
  /** First day of the month the workforce figures cover. */
  month: string
  /** The day the workforce is counted on: the month's last day, or today if sooner. */
  asOf: string
}

function readDates(url: URL): Dates {
  const today = toDay(new Date())
  const dayParam = url.searchParams.get('day')
  const monthParam = url.searchParams.get('month')
  const day = isDay(dayParam) ? dayParam : today
  const month = `${monthKey(isDay(monthParam) ? monthParam : day)}-01`
  const last = toDay(endOfMonth(dateOf(month)))
  return { today, day, month, asOf: last < today ? last : today }
}

// --- workforce (Talent Management) ---------------------------------------------------------------

const EMPLOYED = new Set<Employee['status']>(['active', 'probation', 'notice'])

/** On the books that day: joined by then, and still employed (or leaving later). */
function employedOn(person: Employee, date: string): boolean {
  if (person.joiningDate && person.joiningDate > date) return false
  if (EMPLOYED.has(person.status)) return true
  return person.endDate !== null && person.endDate > date
}

/** The day a former employee left (their end date), if they did. */
const leftOn = (person: Employee) => (EMPLOYED.has(person.status) ? null : person.endDate)

const round2 = (value: number) => Math.round(value * 100) / 100
const percent = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : 0)

interface Group {
  id: string | null
  name: string
  people: Employee[]
}

/** People grouped by an id and name; a missing name is "Not set" (id null). Largest first. */
function groupBy(
  people: readonly Employee[],
  pick: (person: Employee) => { id: string | null; name: string | null },
): Group[] {
  const groups = new Map<string, Group>()
  for (const person of people) {
    const { id, name } = pick(person)
    const key = name ? (id ?? `name:${name}`) : 'not-set'
    const group = groups.get(key)
    if (group) group.people.push(person)
    else groups.set(key, { id: name ? id : null, name: name ?? 'Not set', people: [person] })
  }
  return [...groups.values()].sort(
    (a, b) => b.people.length - a.people.length || a.name.localeCompare(b.name),
  )
}

const counted = (groups: readonly Group[]): CountItem[] =>
  groups.map(({ id, name, people }) => ({ id, name, count: people.length }))

const womenIn = (people: readonly Employee[]) =>
  people.filter((person) => person.gender === 'female').length
const menIn = (people: readonly Employee[]) =>
  people.filter((person) => person.gender === 'male').length

const department = (person: Employee) => ({
  id: person.departmentId,
  name: person.departmentName,
})
const jobTitle = (person: Employee) => ({
  id: person.jobTitleId ?? person.designationId,
  name: person.jobTitleName ?? person.designationName,
})

const AGE_BANDS: readonly { band: string; max: number }[] = [
  { band: '18-25', max: 25 },
  { band: '26-35', max: 35 },
  { band: '36-45', max: 45 },
  { band: '46+', max: Number.POSITIVE_INFINITY },
]

function workforce(dates: Dates): Workforce {
  const everyone = employees.all().map(toEmployee)
  const people = everyone.filter((person) => employedOn(person, dates.asOf))
  const women = womenIn(people)
  const men = menIn(people)
  const inMonth = (value: string | null, month: string) => (value ?? '').startsWith(month)
  const hiredIn = (month: string) =>
    everyone.filter((person) => inMonth(person.joiningDate, month)).length
  const leftIn = (month: string) =>
    everyone.filter((person) => inMonth(leftOn(person), month)).length
  const month = monthKey(dates.month)
  const hired = hiredIn(month)
  const left = leftIn(month)

  const genders = new Map<string, number>()
  for (const person of people) {
    const key = person.gender ?? 'not_set'
    genders.set(key, (genders.get(key) ?? 0) + 1)
  }
  const byGender: GenderCount[] = [
    { gender: 'male', count: men },
    { gender: 'female', count: women },
    ...[...genders.entries()]
      .filter(([gender]) => gender !== 'male' && gender !== 'female')
      .map(([gender, count]) => ({ gender, count })),
  ]

  const byAge: AgeBand[] = AGE_BANDS.map(({ band }) => ({ band, male: 0, female: 0, other: 0 }))
  for (const person of people) {
    if (!person.dateOfBirth) continue
    const age = differenceInYears(dateOf(dates.asOf), dateOf(person.dateOfBirth))
    const index = AGE_BANDS.findIndex(({ max }) => age <= max)
    const row = byAge[index]
    if (!row) continue
    if (person.gender === 'male') row.male += 1
    else if (person.gender === 'female') row.female += 1
    else row.other += 1
  }

  const turnoverByMonth: MonthTurnover[] = Array.from({ length: 12 }, (_, index) => {
    const first = toDay(subMonths(dateOf(dates.month), 11 - index))
    return { month: first, hired: hiredIn(monthKey(first)), left: leftIn(monthKey(first)) }
  })

  const departments = groupBy(people, department)
  const womenByJobTitle: JobTitleWomen[] = groupBy(people, jobTitle)
    .map(({ id, name, people: holders }) => ({
      id,
      name,
      total: holders.length,
      women: womenIn(holders),
      womenPercent: percent(womenIn(holders), holders.length),
    }))
    .sort(
      (a, b) =>
        b.women - a.women || b.womenPercent - a.womenPercent || a.name.localeCompare(b.name),
    )

  return {
    month: dates.month,
    headcount: people.length,
    women,
    men,
    womenPercent: percent(women, people.length),
    hired,
    left,
    turnoverPercent: percent(left, people.length),
    byDepartment: counted(departments),
    byEmploymentType: counted(
      groupBy(people, (person) => ({
        id: person.employmentTypeId,
        name: person.employmentTypeName,
      })),
    ),
    byGender,
    byAge,
    turnoverByMonth,
    byDepartmentGender: departments.map(({ id, name, people: members }) => ({
      id,
      name,
      men: menIn(members),
      women: womenIn(members),
    })),
    womenByJobTitle,
  }
}

// --- attendance (the attendance engine) ----------------------------------------------------------

type Bucket = 'present' | 'absent' | 'onLeave'

/** Which count a day goes into; days off, holidays and days not started go into none. */
function bucketOf(status: WireStatus): Bucket | null {
  if (PRESENT_STATUSES.has(status)) return 'present'
  if (status === 'absent') return 'absent'
  if (status === 'leave') return 'onLeave'
  return null
}

/** Who came in first leads; people not in yet follow, by name. */
function byFirstIn(a: AttendanceRow, b: AttendanceRow): number {
  if (a.firstIn && b.firstIn && a.firstIn !== b.firstIn) return a.firstIn < b.firstIn ? -1 : 1
  if (a.firstIn && !b.firstIn) return -1
  if (!a.firstIn && b.firstIn) return 1
  return a.employeeName.localeCompare(b.employeeName)
}

function attendance(snap: Snapshot, people: readonly string[], dates: Dates): DashboardAttendance {
  const counts: Record<Bucket, number> = { present: 0, absent: 0, onLeave: 0 }
  const rows: AttendanceRow[] = []
  for (const employeeId of people) {
    const { day } = computeDay(snap, employeeId, dates.day)
    if (day.status === null) continue
    const status = wireStatus(day.status)
    const bucket = bucketOf(status)
    if (bucket) counts[bucket] += 1
    const person = findEmployee(employeeId)
    rows.push({
      employeeId,
      employeeName: person?.name ?? employeeId,
      designationName: person?.jobTitle ?? null,
      firstIn: wire(day.checkIn),
      lastOut: wire(day.checkOut),
      status,
    })
  }

  // Each month of the year so far: only scheduled days can count, so read those, up to today.
  const year = dates.month.slice(0, 4)
  const reached = new Set(people)
  const byMonth: MonthAttendance[] = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    present: 0,
    absent: 0,
    onLeave: 0,
  }))
  for (const entry of snap.schedule.values()) {
    if (!entry.date.startsWith(year) || entry.date > dates.today) continue
    if (!reached.has(entry.employeeId)) continue
    const { day } = computeDay(snap, entry.employeeId, entry.date)
    const bucket = day.status === null ? null : bucketOf(wireStatus(day.status))
    const row = byMonth[Number(entry.date.slice(5, 7)) - 1]
    if (bucket && row) row[bucket] += 1
  }

  const expected = counts.present + counts.absent + counts.onLeave
  return {
    day: dates.day,
    ...counts,
    absenteeismPercent: percent(counts.absent, expected),
    byMonth,
    rows: rows.sort(byFirstIn),
  }
}

// --- leave applications (the shared leave store) --------------------------------------------------

const LEAVE_ROWS = 10

function leaveApplications(employeeId?: string): LeaveApplication[] {
  return leaveRequestRows()
    .filter((row) => !employeeId || row.employeeId === employeeId)
    .slice(0, LEAVE_ROWS)
    .map((row) => {
      const person = personOf(row.employeeId)
      return {
        id: row.id,
        employeeId: row.employeeId,
        employeeName: person?.name ?? '—',
        designationName: person?.designationName ?? null,
        appliedAt: row.submittedAt,
        fromDate: row.fromDate,
        toDate: row.toDate,
        days: row.days,
        reason: row.reason,
        status: row.status,
      }
    })
}

// --- notice board and events (samples) ----------------------------------------------------------

function notices(day: string): { noticeBoard: Notice[]; upcomingEvents: Notice[] } {
  const on = (offset: number) => toDay(new Date(dateOf(day).getTime() + offset * 86_400_000))
  const notice = (
    id: string,
    kind: 'notice' | 'event',
    title: string,
    body: string | null,
    published: number,
    eventDate: number | null = null,
  ): Notice => ({
    id,
    kind,
    title,
    body,
    eventDate: eventDate === null ? null : on(eventDate),
    publishFrom: on(published),
    createdAt: `${on(published)}T08:00:00`,
  })
  return {
    noticeBoard: [
      notice(
        'an_1',
        'notice',
        'Updated leave policy',
        'Casual leave can now be taken in half days. See Leaves → Settings for the details.',
        0,
      ),
      notice(
        'an_2',
        'notice',
        'Payslips for last month are out',
        'Download yours from Payroll → Pay Slips.',
        -2,
      ),
      notice(
        'an_3',
        'notice',
        'Head office parking',
        'Level B2 is closed for maintenance until the end of the week.',
        -5,
      ),
    ],
    upcomingEvents: [
      notice('ev_1', 'event', 'Quarterly town hall', 'Main hall, 4 pm.', -3, 2),
      notice('ev_2', 'event', 'Health and safety training', 'For the clinical teams.', -1, 6),
      notice('ev_3', 'event', 'Annual dinner', null, -7, 16),
    ],
  }
}

// --- handlers -------------------------------------------------------------------------------------

const everyone = () => DIRECTORY.map((person) => person.id)

export const dashboardHandlers = [
  http.get(apiPath('/dashboard/hr'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const dates = readDates(new URL(request.url))
    return HttpResponse.json<ApiItem<HrDashboard>>({
      data: {
        workforce: workforce(dates),
        attendance: attendance(takeSnapshot(), everyone(), dates),
        leaveApplications: leaveApplications(),
        ...notices(dates.day),
      },
    })
  }),

  http.get(apiPath('/dashboard/ceo'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const dates = readDates(new URL(request.url))
    return HttpResponse.json<ApiItem<CeoDashboard>>({
      data: {
        workforce: workforce(dates),
        attendance: attendance(takeSnapshot(), everyone(), dates),
        leaveApplications: leaveApplications(),
      },
    })
  }),

  http.get(apiPath('/dashboard/me'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const dates = readDates(new URL(request.url))
    return HttpResponse.json<ApiItem<MyDashboard>>({
      data: {
        employeeId: CURRENT_EMPLOYEE_ID,
        attendance: attendance(takeSnapshot(), [CURRENT_EMPLOYEE_ID], dates),
        leaveApplications: leaveApplications(CURRENT_EMPLOYEE_ID),
        ...notices(dates.day),
      },
    })
  }),
]
