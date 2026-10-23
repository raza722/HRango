import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  type AttendanceSettings,
  type AudienceCriteria,
  type BreakTypeRecord,
  type GeoFenceSetting,
  type Holiday,
  HOLIDAY_RULE_TYPES,
  IP_MODES,
  type IpRestriction,
  RELIGIONS,
  type RestDayBatch,
  type RestDayRow,
  type SettingsLookups,
} from '@/features/attendance'
import type { GeoFence, ScheduleEntry } from '@/features/scheduling'
import { weekdayOf } from '@/features/scheduling'
import type { ApiItem, Paginated } from '@/types/api'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { rosterGroups } from '../roster/handlers'
import { geoFences, restDayBatches, scheduleEntries } from '../scheduling/handlers'
import { profileOf, PROFILES } from '../scheduling/seed'
import { areas, branches, locations } from '../settings/handlers'
import { CITIES, COUNTRIES, REGIONS } from '../settings/seed'
import {
  apiPath,
  createId,
  errorResponse,
  latency,
  paginate,
  readPageParams,
  requireAuth,
} from '../utils'
import { attendanceEdits } from './db'
import {
  breakTypes,
  currentSettings,
  type GeoFenceSettings,
  geoFenceSettings,
  holidays,
  ipRestrictions,
  nationalityOf,
  settingsStore,
} from './settings-db'

const base = (path: string) => apiPath(`/attendance/settings${path}`)
const invalid = (message: string, fieldErrors?: Record<string, string>) =>
  errorResponse(422, message, {
    code: 'VALIDATION_FAILED',
    ...(fieldErrors ? { fieldErrors } : {}),
  })
const notFound = (what: string) =>
  errorResponse(404, `That ${what} could not be found.`, { code: 'NOT_FOUND' })
const duplicate = (field: string, message: string) =>
  errorResponse(409, message, { code: 'DUPLICATE', fieldErrors: { [field]: message } })
const now = () => new Date().toISOString()

async function readBody<T>(request: Request, schema: z.ZodType<T>) {
  const body: unknown = await request.json().catch(() => null)
  return schema.safeParse(body)
}

/** First issue of a failed parse, with its field, as the API's 422 body. */
function rejected(error: z.ZodError) {
  const issue = error.issues[0]
  const field = issue?.path.join('.') ?? ''
  return invalid(
    issue?.message ?? 'Some fields are not valid.',
    field ? { [field]: issue?.message ?? '' } : undefined,
  )
}

const listOf = <T>(url: URL, items: T[], text: (item: T) => string) => {
  const search = (url.searchParams.get('search') ?? '').trim().toLowerCase()
  const { page, pageSize } = readPageParams(url)
  const matching = search
    ? items.filter((item) => text(item).toLowerCase().includes(search))
    : items
  return HttpResponse.json<Paginated<T>>(paginate(matching, page, pageSize))
}

const ok = <T>(data: T) => HttpResponse.json<ApiItem<T>>({ data })

// --- shared validation ------------------------------------------------------------------

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date')
const strings = z.array(z.string().min(1)).max(200)
const name = z.string().trim().min(1, 'Enter a name').max(80, 'Keep it under 80 characters')

const IPV4 = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/
const ipv4 = z.string().trim().regex(IPV4, 'Enter an IPv4 address such as 192.168.2.33')
const cidr = z
  .string()
  .trim()
  .refine((value) => {
    const [address = '', bits] = value.split('/')
    return IPV4.test(address) && (bits === undefined || (/^\d+$/.test(bits) && Number(bits) <= 32))
  }, 'Enter an IPv4 address such as 192.168.2.38/31')
const ipv6 = z
  .string()
  .trim()
  .refine(
    (value) => /^[0-9a-fA-F:]+(\/\d{1,3})?$/.test(value) && value.includes(':'),
    'Enter an IPv6 address',
  )

const toNumber = (address: string) =>
  address.split('.').reduce((sum, part) => sum * 256 + Number(part), 0)

const criteriaSchema: z.ZodType<AudienceCriteria> = z.object({
  id: z.string().min(1),
  target: z.enum(['organization', 'employees']),
  departments: strings,
  locations: strings,
  designations: strings,
  grades: strings,
  religions: strings,
  jobTitles: strings,
  nationalities: strings,
  areas: strings,
  branches: strings,
  joiningFrom: day.nullable(),
  joiningTo: day.nullable(),
  employeeIds: strings,
})

function checkAudience(allEmployees: boolean, criteria: AudienceCriteria[]): Response | null {
  if (allEmployees) return null
  if (criteria.length === 0) {
    return invalid('Add criteria, or apply to All Employees.', {
      criteria: 'Add at least one criteria',
    })
  }
  const empty = criteria.findIndex((row) =>
    row.target === 'employees'
      ? row.employeeIds.length === 0
      : [
          row.departments,
          row.locations,
          row.designations,
          row.grades,
          row.religions,
          row.jobTitles,
          row.nationalities,
          row.areas,
          row.branches,
        ].every((list) => list.length === 0) &&
        row.joiningFrom === null &&
        row.joiningTo === null,
  )
  if (empty !== -1) {
    return invalid('Each criteria needs at least one field.', {
      [`criteria.${empty}`]: 'Fill in at least one field',
    })
  }
  return null
}

// --- geo fences: Scheduling's fence plus its Settings details ------------------------------

function fenceSettings(fence: GeoFence): GeoFenceSettings {
  const stored = geoFenceSettings.find(fence.id)
  if (stored) return stored
  const number = Number(fence.id.replace(/\D/g, '')) || 0
  return {
    id: fence.id,
    code: `GF-${String(number).padStart(5, '0')}`,
    forShift: true,
    allEmployees: true,
    criteria: [],
    active: true,
  }
}

function toFenceSetting(fence: GeoFence): GeoFenceSetting {
  const { code, forShift, allEmployees, criteria, active } = fenceSettings(fence)
  return {
    id: fence.id,
    code,
    name: fence.name,
    shape: fence.shape,
    forShift,
    allEmployees,
    criteria,
    active,
    createdAt: fence.createdAt,
  }
}

const shapeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('circle'),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusMeters: z.number().min(10, 'At least 10 m').max(50_000, 'At most 50 km'),
  }),
  z.object({
    type: z.literal('polygon'),
    points: z
      .array(
        z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        }),
      )
      .min(3, 'Place at least three corners')
      .max(50),
  }),
])

const fenceSchema = z.object({
  name,
  shape: shapeSchema,
  forShift: z.boolean(),
  allEmployees: z.boolean(),
  criteria: z.array(criteriaSchema).max(20),
  active: z.boolean(),
})

function nextFenceCode(): string {
  const highest = geoFences
    .all()
    .map((fence) => Number(fenceSettings(fence).code.slice(3)))
    .reduce((max, value) => (Number.isFinite(value) ? Math.max(max, value) : max), 0)
  return `GF-${String(highest + 1).padStart(5, '0')}`
}

// --- rest days ---------------------------------------------------------------------------

const ROSTER_DAY_INDEX = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 } as const

/** Puts the roster's shift back on a day a rest-day batch had taken. */
function restoreDay(entry: ScheduleEntry) {
  const group = entry.rosterGroupId ? rosterGroups.find(entry.rosterGroupId) : undefined
  const pattern = group?.days[ROSTER_DAY_INDEX[weekdayOf(entry.date)]]
  if (!group || !pattern || pattern.isWeekend || !pattern.clockIn || !pattern.clockOut) {
    scheduleEntries.update(entry.id, { ...entry, restDayPayable: false, batchId: 'batch_seed' })
    return
  }
  scheduleEntries.update(entry.id, {
    ...entry,
    kind: 'shift',
    clockIn: pattern.clockIn,
    clockOut: pattern.clockOut,
    restDayPayable: false,
    batchId: 'batch_seed',
    slot: { ...entry.slot, name: group.title, isOvernight: pattern.clockOut < pattern.clockIn },
    updatedAt: now(),
  })
}

function restDayRows(): RestDayRow[] {
  const entries = scheduleEntries.all()
  const live = new Set(
    entries
      .filter((entry) => entry.kind === 'rest')
      .map((entry) => `${entry.employeeId}:${entry.date}:${entry.batchId}`),
  )
  return restDayBatches
    .all()
    .flatMap((batch) =>
      batch.employeeIds.flatMap((employeeId) => {
        const employee = findEmployee(employeeId)
        if (!employee) return []
        return batch.dates
          .filter((date) => live.has(`${employeeId}:${date}:${batch.id}`))
          .map((date) => ({
            id: `${batch.id}:${employeeId}:${date}`,
            batchId: batch.id,
            employee: { id: employee.id, name: employee.name, code: profileOf(employee).code },
            date,
            payable: batch.payable,
          }))
      }),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.employee.name.localeCompare(b.employee.name))
}

// --- holidays ------------------------------------------------------------------------------

const ruleSchema = z
  .object({
    id: z.string().min(1),
    name,
    type: z.enum(HOLIDAY_RULE_TYPES),
    religion: z.string().nullable(),
    countryCode: z.string().nullable(),
    regionCode: z.string().nullable(),
    cityId: z.string().nullable(),
    locationId: z.string().nullable(),
    branchId: z.string().nullable(),
    employeeIds: strings,
  })
  .superRefine((rule, ctx) => {
    const need = (field: string, message: string) => {
      ctx.addIssue({ code: 'custom', path: [field], message })
    }
    if (rule.type === 'religion' && !rule.religion) need('religion', 'Choose a religion')
    if (rule.type === 'geo-location') {
      if (!rule.countryCode) need('countryCode', 'Choose a country')
      if (!rule.regionCode) need('regionCode', 'Choose a state')
      if (!rule.cityId) need('cityId', 'Choose a city')
    }
    if (rule.type === 'organization') {
      if (!rule.locationId) need('locationId', 'Choose a location')
      if (!rule.branchId) need('branchId', 'Choose a branch')
    }
    if (rule.type === 'employee' && rule.employeeIds.length === 0)
      need('employeeIds', 'Choose employees')
  })

const holidaySchema = z
  .object({
    name,
    startDate: day,
    endDate: day,
    description: z.string().trim().max(500),
    attendanceExempt: z.boolean(),
    rules: z.array(ruleSchema).max(30),
  })
  .refine((holiday) => holiday.endDate >= holiday.startDate, {
    message: 'End Date must be on or after Start Date',
    path: ['endDate'],
  })

// --- handlers ----------------------------------------------------------------------------------

const settingsSchema = z.object({
  basic: z.object({
    ignorePunchType: z.boolean(),
    useCheckInOutForBreaks: z.boolean(),
    shortDurationOnNonFlexible: z.boolean(),
    dashboardPunch: z.boolean(),
    multiShiftPerDay: z.boolean(),
    pictureOnDashboardPunch: z.boolean(),
    minimumWorkableMinutes: z
      .number()
      .int('Whole minutes only')
      .min(0, 'At least 0')
      .max(1440, 'At most 1,440 minutes (a day)')
      .nullable(),
  }),
  scheduling: z.object({
    geoFenceRequiredOnShift: z.boolean(),
    ignoreRestDaysForLeaves: z.boolean(),
  }),
})

const breakTypeSchema = z.object({
  name,
  startIdentifier: name,
  endIdentifier: name,
})

const ipSchema = z
  .object({
    name: z.string().trim().max(80),
    mode: z.enum(IP_MODES),
    ipv4: cidr,
    ipv6: ipv6.nullable(),
    subnetMask: ipv4.nullable(),
    rangeStart: ipv4.nullable(),
    rangeEnd: ipv4.nullable(),
    count: z.number().int().min(1).max(65_536).nullable(),
    allEmployees: z.boolean(),
    criteria: z.array(criteriaSchema).max(20),
    active: z.boolean(),
  })
  .superRefine((input, ctx) => {
    if (input.mode === 'range') {
      if (!input.rangeStart)
        ctx.addIssue({ code: 'custom', path: ['rangeStart'], message: 'Enter the first address' })
      if (!input.rangeEnd)
        ctx.addIssue({ code: 'custom', path: ['rangeEnd'], message: 'Enter the last address' })
      if (
        input.rangeStart &&
        input.rangeEnd &&
        toNumber(input.rangeEnd) < toNumber(input.rangeStart)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['rangeEnd'],
          message: 'Range End must not be before Range Start',
        })
      }
    }
  })

export const attendanceSettingsHandlers = [
  http.get(base('/config'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    return ok<AttendanceSettings>(currentSettings())
  }),

  http.put(base('/config'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, settingsSchema)
    if (!parsed.success) return rejected(parsed.error)
    const next = { id: 'settings', ...parsed.data }
    if (settingsStore.find('settings')) settingsStore.update('settings', next)
    else settingsStore.insert(next)
    return ok<AttendanceSettings>(parsed.data)
  }),

  http.get(base('/lookups'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const sorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b))
    return ok<SettingsLookups>({
      departments: sorted(DIRECTORY.map((employee) => employee.department)),
      locations: locations.all().map((item) => ({ id: item.id, name: item.name })),
      designations: sorted(DIRECTORY.map((employee) => employee.jobTitle)),
      grades: sorted(Object.values(PROFILES).map((profile) => profile.grade)),
      religions: [...RELIGIONS],
      jobTitles: sorted(DIRECTORY.map((employee) => employee.jobTitle)),
      nationalities: sorted(DIRECTORY.map(nationalityOf)),
      areas: areas.all().map((item) => ({ id: item.id, name: item.name })),
      branches: branches.all().map((item) => ({ id: item.id, name: item.name })),
      employees: DIRECTORY.filter((employee) => profileOf(employee).status === 'active')
        .map((employee) => ({
          id: employee.id,
          name: employee.name,
          code: profileOf(employee).code,
          designation: employee.jobTitle,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      countries: COUNTRIES,
      regions: REGIONS,
      cities: CITIES,
    })
  }),

  // Break types --------------------------------------------------------------------------
  http.get(base('/break-types'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const items = breakTypes.all().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return listOf(
      new URL(request.url),
      items,
      (item) => `${item.name} ${item.startIdentifier} ${item.endIdentifier}`,
    )
  }),

  http.post(base('/break-types'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, breakTypeSchema)
    if (!parsed.success) return rejected(parsed.error)
    const input = parsed.data
    if (breakTypes.all().some((item) => item.name.toLowerCase() === input.name.toLowerCase())) {
      return duplicate('name', 'A break type with this name already exists')
    }
    const record: BreakTypeRecord = {
      id: createId('bt'),
      ...input,
      createdAt: now(),
      updatedAt: now(),
    }
    breakTypes.insert(record)
    return ok(record)
  }),

  http.put(base('/break-types/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const existing = breakTypes.find(String(params.id))
    if (!existing) return notFound('break type')
    const parsed = await readBody(request, breakTypeSchema)
    if (!parsed.success) return rejected(parsed.error)
    const input = parsed.data
    if (
      breakTypes
        .all()
        .some(
          (item) => item.id !== existing.id && item.name.toLowerCase() === input.name.toLowerCase(),
        )
    ) {
      return duplicate('name', 'A break type with this name already exists')
    }
    const next = { ...existing, ...input, updatedAt: now() }
    breakTypes.update(existing.id, next)
    return ok(next)
  }),

  http.delete(base('/break-types/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const existing = breakTypes.find(String(params.id))
    if (!existing) return notFound('break type')
    const used = attendanceEdits
      .all()
      .filter((edit) => edit.breaks?.some((item) => item.type === existing.id)).length
    if (used > 0) {
      return errorResponse(
        409,
        `${existing.name} is used on ${used} time sheet${used === 1 ? '' : 's'}.`,
        { code: 'IN_USE' },
      )
    }
    breakTypes.remove(existing.id)
    return new HttpResponse(null, { status: 204 })
  }),

  // IP restrictions -----------------------------------------------------------------------
  http.get(base('/ip-restrictions'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const items = ipRestrictions.all().sort((a, b) => a.code.localeCompare(b.code))
    return listOf(new URL(request.url), items, (item) => `${item.code} ${item.name} ${item.ipv4}`)
  }),

  http.post(base('/ip-restrictions'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, ipSchema)
    if (!parsed.success) return rejected(parsed.error)
    const audience = checkAudience(parsed.data.allEmployees, parsed.data.criteria)
    if (audience) return audience
    const highest = ipRestrictions
      .all()
      .reduce((max, item) => Math.max(max, Number(item.code.slice(4)) || 0), 0)
    const record: IpRestriction = {
      id: createId('ipr'),
      code: `IPR-${String(highest + 1).padStart(5, '0')}`,
      ...parsed.data,
      name: parsed.data.name || 'IP Address',
      createdAt: now(),
      updatedAt: now(),
    }
    ipRestrictions.insert(record)
    return ok(record)
  }),

  http.put(base('/ip-restrictions/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const existing = ipRestrictions.find(String(params.id))
    if (!existing) return notFound('IP restriction')
    const parsed = await readBody(request, ipSchema)
    if (!parsed.success) return rejected(parsed.error)
    const audience = checkAudience(parsed.data.allEmployees, parsed.data.criteria)
    if (audience) return audience
    const next = {
      ...existing,
      ...parsed.data,
      name: parsed.data.name || 'IP Address',
      updatedAt: now(),
    }
    ipRestrictions.update(existing.id, next)
    return ok(next)
  }),

  http.patch(base('/ip-restrictions/:id/status'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const existing = ipRestrictions.find(String(params.id))
    if (!existing) return notFound('IP restriction')
    const parsed = await readBody(request, z.object({ active: z.boolean() }))
    if (!parsed.success) return rejected(parsed.error)
    const next = { ...existing, active: parsed.data.active, updatedAt: now() }
    ipRestrictions.update(existing.id, next)
    return ok(next)
  }),

  http.delete(base('/ip-restrictions/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    if (!ipRestrictions.remove(String(params.id))) return notFound('IP restriction')
    return new HttpResponse(null, { status: 204 })
  }),

  // Geo fencing -------------------------------------------------------------------------------
  http.get(base('/geo-fences'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const items = geoFences
      .all()
      .map(toFenceSetting)
      .sort((a, b) => a.code.localeCompare(b.code))
    return listOf(new URL(request.url), items, (item) => `${item.code} ${item.name}`)
  }),

  http.post(base('/geo-fences'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, fenceSchema)
    if (!parsed.success) return rejected(parsed.error)
    const input = parsed.data
    if (geoFences.all().some((fence) => fence.name.toLowerCase() === input.name.toLowerCase())) {
      return duplicate('name', 'A geo fence with this name already exists')
    }
    const audience = checkAudience(input.allEmployees, input.criteria)
    if (audience) return audience
    const fence: GeoFence = {
      id: createId('gf'),
      name: input.name,
      shape: input.shape,
      createdAt: now(),
    }
    geoFences.insert(fence)
    geoFenceSettings.insert({
      id: fence.id,
      code: nextFenceCode(),
      forShift: input.forShift,
      allEmployees: input.allEmployees,
      criteria: input.criteria,
      active: input.active,
    })
    return ok(toFenceSetting(fence))
  }),

  http.put(base('/geo-fences/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const fence = geoFences.find(String(params.id))
    if (!fence) return notFound('geo fence')
    const parsed = await readBody(request, fenceSchema)
    if (!parsed.success) return rejected(parsed.error)
    const input = parsed.data
    if (
      geoFences
        .all()
        .some(
          (item) => item.id !== fence.id && item.name.toLowerCase() === input.name.toLowerCase(),
        )
    ) {
      return duplicate('name', 'A geo fence with this name already exists')
    }
    const audience = checkAudience(input.allEmployees, input.criteria)
    if (audience) return audience
    const next = { ...fence, name: input.name, shape: input.shape }
    geoFences.update(fence.id, next)
    const details = {
      ...fenceSettings(fence),
      forShift: input.forShift,
      allEmployees: input.allEmployees,
      criteria: input.criteria,
      active: input.active,
    }
    if (geoFenceSettings.find(fence.id)) geoFenceSettings.update(fence.id, details)
    else geoFenceSettings.insert(details)
    return ok(toFenceSetting(next))
  }),

  http.patch(base('/geo-fences/:id/status'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const fence = geoFences.find(String(params.id))
    if (!fence) return notFound('geo fence')
    const parsed = await readBody(request, z.object({ active: z.boolean() }))
    if (!parsed.success) return rejected(parsed.error)
    const details = { ...fenceSettings(fence), active: parsed.data.active }
    if (geoFenceSettings.find(fence.id)) geoFenceSettings.update(fence.id, details)
    else geoFenceSettings.insert(details)
    return ok(toFenceSetting(fence))
  }),

  http.delete(base('/geo-fences/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const id = String(params.id)
    if (!geoFences.remove(id)) return notFound('geo fence')
    geoFenceSettings.remove(id)
    // Shifts no longer point at a fence that is gone.
    for (const entry of scheduleEntries.all()) {
      if (entry.geoFenceIds.includes(id)) {
        scheduleEntries.update(entry.id, {
          ...entry,
          geoFenceIds: entry.geoFenceIds.filter((item) => item !== id),
        })
      }
    }
    return new HttpResponse(null, { status: 204 })
  }),

  // Holidays ------------------------------------------------------------------------------------
  http.get(base('/holidays'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const year = url.searchParams.get('year')
    const items = holidays
      .all()
      .filter((item) => !year || item.startDate.startsWith(year) || item.endDate.startsWith(year))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
    return listOf(url, items, (item) => `${item.name} ${item.description}`)
  }),

  http.post(base('/holidays'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, holidaySchema)
    if (!parsed.success) return rejected(parsed.error)
    const record: Holiday = {
      id: createId('hol'),
      ...parsed.data,
      createdAt: now(),
      updatedAt: now(),
    }
    holidays.insert(record)
    return ok(record)
  }),

  http.put(base('/holidays/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const existing = holidays.find(String(params.id))
    if (!existing) return notFound('holiday')
    const parsed = await readBody(request, holidaySchema)
    if (!parsed.success) return rejected(parsed.error)
    const next = { ...existing, ...parsed.data, updatedAt: now() }
    holidays.update(existing.id, next)
    return ok(next)
  }),

  http.delete(base('/holidays/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    if (!holidays.remove(String(params.id))) return notFound('holiday')
    return new HttpResponse(null, { status: 204 })
  }),

  // Rest days -------------------------------------------------------------------------------------
  http.get(base('/rest-days'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    return listOf(
      new URL(request.url),
      restDayRows(),
      (row) => `${row.employee.name} ${row.employee.code}`,
    )
  }),

  http.get(base('/rest-days/batches/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const batch = restDayBatches.find(String(params.id))
    if (!batch) return notFound('rest day')
    return ok<RestDayBatch>({
      id: batch.id,
      startDate: batch.startDate,
      repeat: batch.repeat,
      payable: batch.payable,
      dates: batch.dates,
      createdAt: batch.createdAt,
      employees: batch.employeeIds.flatMap((id) => {
        const employee = findEmployee(id)
        return employee
          ? [
              {
                id,
                name: employee.name,
                code: profileOf(employee).code,
                designation: employee.jobTitle,
              },
            ]
          : []
      }),
    })
  }),

  http.delete(base('/rest-days/batches/:id'), async ({ request, params }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const batch = restDayBatches.find(String(params.id))
    if (!batch) return notFound('rest day')
    for (const entry of scheduleEntries.all()) {
      if (entry.batchId === batch.id && entry.kind === 'rest') restoreDay(entry)
    }
    restDayBatches.remove(batch.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(base('/rest-days/delete-range'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(
      request,
      z.object({ from: day, to: day }).refine((value) => value.to >= value.from, {
        message: 'To must be on or after From',
        path: ['to'],
      }),
    )
    if (!parsed.success) return rejected(parsed.error)
    const { from, to } = parsed.data
    const batchIds = new Set(restDayBatches.all().map((batch) => batch.id))
    let deleted = 0
    for (const entry of scheduleEntries.all()) {
      if (
        entry.kind === 'rest' &&
        batchIds.has(entry.batchId) &&
        entry.date >= from &&
        entry.date <= to
      ) {
        restoreDay(entry)
        deleted += 1
      }
    }
    for (const batch of restDayBatches.all()) {
      const dates = batch.dates.filter((date) => date < from || date > to)
      if (dates.length === 0) restDayBatches.remove(batch.id)
      else if (dates.length !== batch.dates.length)
        restDayBatches.update(batch.id, { ...batch, dates })
    }
    return ok({ deleted })
  }),
]
