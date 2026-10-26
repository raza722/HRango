import { differenceInCalendarDays, eachDayOfInterval, format, getISODay, parseISO } from 'date-fns'
import { http, HttpResponse, type PathParams } from 'msw'
import { z } from 'zod'

import {
  type AttendanceSettings,
  type BasicSettings,
  type BreakTypeRecord,
  type GeoFenceSetting,
  type Holiday,
  HOLIDAY_RULE_TYPES,
  HOLIDAY_TYPES,
  type HolidayRule,
  type IpRestriction,
  type RestDayRule,
  type SchedulingSettings,
  TARGET_TYPES,
} from '@/features/attendance'
import type { GeoFence } from '@/features/scheduling'
import type { ApiItem, Paginated } from '@/types/api'

import { findEmployee } from '../employees/seed'
import { geoFences } from '../scheduling/handlers'
import { branches, locations } from '../settings/handlers'
import { CITIES, COUNTRIES, STATES } from '../settings/seed'
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
  nextRowVersion,
  restDayRules,
  ruleEmployees,
  settingsStore,
} from './settings-db'

const attendancePath = (path: string) => apiPath(`/attendance/settings${path}`)
const schedulingPath = (path: string) => apiPath(`/scheduling/settings${path}`)
const invalid = (message: string, fieldErrors?: Record<string, string>) =>
  errorResponse(422, message, {
    code: 'VALIDATION_FAILED',
    ...(fieldErrors ? { fieldErrors } : {}),
  })
const notFound = (what: string) => errorResponse(404, `${what} not found`, { code: 'NOT_FOUND' })
const duplicate = (field: string, code: string, message: string) =>
  errorResponse(409, message, { code, fieldErrors: { [field]: message } })
const conflict = (what: string) =>
  errorResponse(409, `Someone else changed this ${what}. Reload it and try again`, {
    code: 'CONFLICT',
  })
const now = () => new Date().toISOString().slice(0, 19)
const noContent = () => new HttpResponse(null, { status: 204 })

async function readBody<T>(request: Request, schema: z.ZodType<T>) {
  const body: unknown = await request.json().catch(() => null)
  return schema.safeParse(body)
}

/** First issue of a failed parse, with its field, as the API's 422 body. */
function rejected(error: z.ZodError) {
  const issue = error.issues[0]
  const field = issue?.path[0] === undefined ? '' : String(issue.path[0])
  return invalid(
    issue?.message ?? 'Some fields need your attention.',
    field ? { [field]: issue?.message ?? '' } : undefined,
  )
}

/** The API refuses an edit without the rowVersion last read, and a stale one. */
function checkVersion(
  sent: string | null | undefined,
  stored: string,
  what: string,
): Response | null {
  if (!sent) return invalid('rowVersion is required.', { rowVersion: 'Required.' })
  return sent === stored ? null : conflict(what)
}

/** `?rowVersion=` of a delete, when sent, must match. */
function checkDeleteVersion(request: Request, stored: string, what: string): Response | null {
  const sent = new URL(request.url).searchParams.get('rowVersion')
  return sent && sent !== stored ? conflict(what) : null
}

const listOf = <T>(url: URL, items: T[], text: (item: T) => string) => {
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const { page, pageSize } = readPageParams(url)
  const matching = q ? items.filter((item) => text(item).toLowerCase().includes(q)) : items
  return HttpResponse.json<Paginated<T>>(paginate(matching, page, pageSize))
}

const ok = <T>(data: T, status = 200) => HttpResponse.json<ApiItem<T>>({ data }, { status })

/** Runs a handler after the latency and the sign-in check. */
const guarded =
  (handler: (info: { request: Request; params: PathParams }) => Promise<Response> | Response) =>
  async (info: { request: Request; params: PathParams }) => {
    await latency()
    return requireAuth(info.request) ?? handler(info)
  }

const flag = (url: URL, name: string): boolean | null => {
  const value = url.searchParams.get(name)
  return value === null ? null : value === 'true'
}

// --- shared validation ------------------------------------------------------------------

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date')
const id = z.union([z.string(), z.number()]).transform(String)
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value === undefined || value === null || value === '' ? null : value))
const rowVersion = z.string().nullish()

const targetSchema = z.object({
  targetType: z.enum(TARGET_TYPES),
  targetId: id.nullish().transform((value) => value ?? null),
  targetValue: optionalText(200),
})
const targetsSchema = z
  .array(targetSchema)
  .max(1000)
  .superRefine((targets, ctx) => {
    if (
      targets.some((target) =>
        target.targetType === 'religion' || target.targetType === 'nationality'
          ? !target.targetValue
          : !target.targetId,
      )
    ) {
      ctx.addIssue({ code: 'custom', message: 'Each target needs a value.' })
    }
  })

// --- settings forms ---------------------------------------------------------------------

const basicSchema = z.object({
  ignorePunchType: z.boolean().default(false),
  useCheckInOutForBreaks: z.boolean().default(false),
  shortDurationOnNonFlexible: z.boolean().default(false),
  dashboardPunch: z.boolean().default(false),
  allowMultiShift: z.boolean().default(false),
  pictureOnDashboardPunch: z.boolean().default(false),
  minimumWorkableMinutes: z
    .number()
    .int()
    .min(0)
    .max(1440, 'Input should be less than or equal to 1440')
    .default(0),
  lateGraceMinutes: z
    .number()
    .int()
    .min(0)
    .max(240, 'Input should be less than or equal to 240')
    .default(0),
  rowVersion,
})

const schedulingSchema = z.object({
  geoFenceRequiredOnShift: z.boolean(),
  ignoreRestDaysForLeaves: z.boolean(),
})

function storeSettings(next: AttendanceSettings) {
  const record = { id: 'settings', ...next }
  if (settingsStore.find('settings')) settingsStore.update('settings', record)
  else settingsStore.insert(record)
}

// --- break types ------------------------------------------------------------------------

const breakTypeSchema = z
  .object({
    name: z.string().trim().min(1, 'Break type name is required.').max(200),
    startIdentifier: z.string().trim().min(1, 'Start identifier is required.').max(50),
    endIdentifier: z.string().trim().min(1, 'End identifier is required.').max(50),
    rowVersion,
  })
  .refine((input) => input.startIdentifier !== input.endIdentifier, {
    path: ['endIdentifier'],
    message: 'The end identifier must differ from the start identifier.',
  })

function breakTypeClash(
  input: { name: string; startIdentifier: string; endIdentifier: string },
  ownId: string | null,
): Response | null {
  const others = breakTypes.all().filter((item) => item.id !== ownId)
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  if (others.some((item) => same(item.name, input.name))) {
    return duplicate('name', 'BREAK_TYPE_DUPLICATE', 'A break type with this name already exists.')
  }
  const identifiers = others.flatMap((item) => [item.startIdentifier, item.endIdentifier])
  for (const field of ['startIdentifier', 'endIdentifier'] as const) {
    if (identifiers.some((value) => same(value, input[field]))) {
      return duplicate(
        field,
        'IDENTIFIER_DUPLICATE',
        'Another break type already uses this identifier.',
      )
    }
  }
  return null
}

// --- IP restrictions ----------------------------------------------------------------------

const IPV4 = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/
const ipNumber = (address: string) =>
  address.split('.').reduce((sum, part) => sum * 256 + Number(part), 0)

const ipSchema = z.object({
  ipv4: optionalText(45),
  ipv6: optionalText(45),
  netmask: optionalText(45),
  rangeStart: optionalText(45),
  rangeEnd: optionalText(45),
  appliesToAll: z.boolean().default(true),
  isActive: z.boolean().default(true),
  targets: targetsSchema.default([]),
  rowVersion,
})
type IpInput = z.infer<typeof ipSchema>

/** The API's address checks, and the "Count" it computes. */
function checkAddresses(input: IpInput): Response | number | null {
  if (!input.ipv4 && !input.ipv6 && !(input.rangeStart && input.rangeEnd)) {
    return invalid('Give an IPv4 or IPv6 address, or a range.', {
      ipv4: 'Give an IPv4 or IPv6 address, or a range.',
    })
  }
  let count = 0
  if (input.ipv4) {
    const [address = '', bits] = input.ipv4.split('/')
    const maskOk = !input.netmask || IPV4.test(input.netmask)
    if (!IPV4.test(address) || (bits !== undefined && !(Number(bits) <= 32)) || !maskOk) {
      const field = input.netmask ? 'netmask' : 'ipv4'
      return invalid('Not a valid IPv4 address, network or subnet mask.', {
        [field]: 'Not a valid IPv4 address, network or subnet mask.',
      })
    }
    const prefix =
      bits !== undefined
        ? Number(bits)
        : input.netmask
          ? input.netmask
              .split('.')
              .reduce((sum, part) => sum + Number(part).toString(2).split('1').length - 1, 0)
          : 32
    count += 2 ** (32 - prefix)
  } else if (input.netmask) {
    return invalid('A subnet mask goes with an IPv4 address.', {
      netmask: 'A subnet mask goes with an IPv4 address.',
    })
  }
  if (input.ipv6 && !input.ipv6.includes(':')) {
    return invalid('Not a valid IPv6 address or network.', {
      ipv6: 'Not a valid IPv6 address or network.',
    })
  }
  if (Boolean(input.rangeStart) !== Boolean(input.rangeEnd)) {
    const field = input.rangeStart ? 'rangeEnd' : 'rangeStart'
    return invalid('Give both ends of the range.', { [field]: 'Give both ends of the range.' })
  }
  if (input.rangeStart && input.rangeEnd) {
    if (IPV4.test(input.rangeStart) && IPV4.test(input.rangeEnd)) {
      const span = ipNumber(input.rangeEnd) - ipNumber(input.rangeStart)
      if (span < 0) {
        return invalid('The range ends before it starts.', {
          rangeEnd: 'The range ends before it starts.',
        })
      }
      count += span + 1
    } else if (!input.rangeStart.includes(':') || !input.rangeEnd.includes(':')) {
      return invalid('Not a valid IP address.', { rangeStart: 'Not a valid IP address.' })
    } else {
      return input.ipv6 ? null : -1
    }
  }
  return input.ipv6 ? null : count
}

function audienceProblem(appliesToAll: boolean, targetCount: number, what: string) {
  return !appliesToAll && targetCount === 0
    ? invalid(`Choose who the ${what} applies to, or apply it to all employees.`, {
        targets: `Choose who the ${what} applies to, or apply it to all employees.`,
      })
    : null
}

function saveIp(input: IpInput, existing: IpRestriction | null): Response {
  const addresses = checkAddresses(input)
  if (addresses instanceof Response) return addresses
  const targets = input.appliesToAll ? [] : input.targets
  const audience = audienceProblem(input.appliesToAll, targets.length, 'restriction')
  if (audience) return audience
  const highest = ipRestrictions
    .all()
    .reduce((max, item) => Math.max(max, Number(item.code.slice(4)) || 0), 0)
  const record: IpRestriction = {
    id: existing?.id ?? createId('ipr'),
    code: existing?.code ?? `IPR-${String(highest + 1).padStart(5, '0')}`,
    ipv4: input.ipv4,
    ipv6: input.ipv6,
    netmask: input.netmask,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    appliesToAll: input.appliesToAll,
    isActive: input.isActive,
    addressCount: addresses === null || addresses < 0 ? null : addresses,
    targetCount: targets.length,
    targets,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: existing ? now() : null,
    rowVersion: nextRowVersion(),
  }
  if (existing) ipRestrictions.update(existing.id, record)
  else ipRestrictions.insert(record)
  return ok(record, existing ? 200 : 201)
}

// --- geo fences: Scheduling's fence plus its Settings details ------------------------------

function fenceDetails(fence: GeoFence): GeoFenceSettings {
  const stored = geoFenceSettings.find(fence.id)
  if (stored) return stored
  const number = Number(fence.id.replace(/\D/g, '')) || 0
  return {
    id: fence.id,
    code: `GF-${String(number).padStart(5, '0')}`,
    forShift: true,
    allEmployees: true,
    targets: [],
    joiningFromDate: null,
    joiningToDate: null,
    active: true,
    updatedAt: null,
    rowVersion: '0x0000000000000000',
  }
}

/** A fence as the API sends it; the list leaves `targets` out (null). */
function toFenceSetting(fence: GeoFence, withTargets: boolean): GeoFenceSetting {
  const details = fenceDetails(fence)
  const circle = fence.shape.type === 'circle' ? fence.shape : null
  return {
    id: fence.id,
    code: details.code,
    name: fence.name,
    shape: fence.shape.type,
    centerLat: circle ? circle.latitude : null,
    centerLng: circle ? circle.longitude : null,
    radiusM: circle ? circle.radiusMeters : null,
    polygonPoints:
      fence.shape.type === 'polygon'
        ? fence.shape.points.map((point) => ({ lat: point.latitude, lng: point.longitude }))
        : null,
    appliesToAll: details.allEmployees,
    joiningFromDate: details.joiningFromDate,
    joiningToDate: details.joiningToDate,
    isForShift: details.forShift,
    isActive: details.active,
    targetCount: details.targets.length,
    targets: withTargets ? details.targets : null,
    createdAt: fence.createdAt.slice(0, 19),
    updatedAt: details.updatedAt,
    rowVersion: details.rowVersion,
  }
}

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})
const fenceSchema = z.object({
  name: z.string().trim().min(1, 'Geo fence name is required.').max(200),
  shape: z.enum(['circle', 'polygon']),
  centerLat: z.coerce.number().min(-90).max(90).nullish(),
  centerLng: z.coerce.number().min(-180).max(180).nullish(),
  radiusM: z.number().int().positive().max(100_000).nullish(),
  polygonPoints: z.array(pointSchema).max(500).nullish(),
  appliesToAll: z.boolean().default(true),
  joiningFromDate: day.nullish(),
  joiningToDate: day.nullish(),
  isForShift: z.boolean().default(false),
  isActive: z.boolean().default(true),
  targets: targetsSchema.default([]),
  rowVersion,
})

function saveFence(input: z.infer<typeof fenceSchema>, existing: GeoFence | null): Response {
  if (input.shape === 'circle') {
    if (input.centerLat == null || input.centerLng == null) {
      return invalid('A circle needs a centre.', { centerLat: 'A circle needs a centre.' })
    }
    if (!input.radiusM) {
      return invalid('A circle needs a radius above zero.', {
        radiusM: 'A circle needs a radius above zero.',
      })
    }
  } else if ((input.polygonPoints ?? []).length < 3) {
    return invalid('A polygon needs at least three points.', {
      polygonPoints: 'A polygon needs at least three points.',
    })
  }
  if (input.joiningFromDate && input.joiningToDate && input.joiningToDate < input.joiningFromDate) {
    return invalid('The joining end date is before the start date.', {
      joiningToDate: 'The joining end date is before the start date.',
    })
  }
  const name = input.name.toLowerCase()
  if (
    geoFences.all().some((fence) => fence.id !== existing?.id && fence.name.toLowerCase() === name)
  ) {
    return duplicate('name', 'GEO_FENCE_DUPLICATE', 'A geo fence with this name already exists.')
  }
  const targets = input.appliesToAll ? [] : input.targets
  const narrowed =
    targets.length > 0 || Boolean(input.joiningFromDate) || Boolean(input.joiningToDate)
  if (!input.appliesToAll && !narrowed) {
    return audienceProblem(false, 0, 'fence') ?? invalid('Choose who the fence applies to.')
  }
  const fence: GeoFence = {
    id: existing?.id ?? createId('gf'),
    name: input.name,
    shape:
      input.shape === 'circle'
        ? {
            type: 'circle',
            latitude: input.centerLat ?? 0,
            longitude: input.centerLng ?? 0,
            radiusMeters: input.radiusM ?? 0,
          }
        : {
            type: 'polygon',
            points: (input.polygonPoints ?? []).map((point) => ({
              latitude: point.lat,
              longitude: point.lng,
            })),
          },
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  }
  const highest = geoFences
    .all()
    .map((item) => Number(fenceDetails(item).code.slice(3)))
    .reduce((max, value) => (Number.isFinite(value) ? Math.max(max, value) : max), 0)
  const details: GeoFenceSettings = {
    id: fence.id,
    code: existing ? fenceDetails(existing).code : `GF-${String(highest + 1).padStart(5, '0')}`,
    forShift: input.isForShift,
    allEmployees: input.appliesToAll,
    targets,
    joiningFromDate: input.appliesToAll ? null : (input.joiningFromDate ?? null),
    joiningToDate: input.appliesToAll ? null : (input.joiningToDate ?? null),
    active: input.isActive,
    updatedAt: existing ? now() : null,
    rowVersion: nextRowVersion(),
  }
  if (existing) geoFences.update(fence.id, fence)
  else geoFences.insert(fence)
  if (geoFenceSettings.find(fence.id)) geoFenceSettings.update(fence.id, details)
  else geoFenceSettings.insert(details)
  return ok(toFenceSetting(fence, true), existing ? 200 : 201)
}

// --- holidays ------------------------------------------------------------------------------

const holidayRuleSchema = z.object({
  ruleType: z.enum(HOLIDAY_RULE_TYPES),
  employeeId: id.nullish(),
  locationId: id.nullish(),
  branchId: id.nullish(),
  countryId: id.nullish(),
  stateId: id.nullish(),
  cityId: id.nullish(),
  religion: optionalText(50),
})

const holidaySchema = z.object({
  name: z.string().trim().min(1, 'Holiday name is required.').max(200),
  holidayType: z.enum(HOLIDAY_TYPES, { message: 'Type is public or local.' }),
  startDate: day,
  endDate: day,
  description: optionalText(4000),
  attendanceExempt: z.boolean().default(false),
  rules: z.array(holidayRuleSchema).max(500).default([]),
  rowVersion,
})

/** A rule with the names the API adds; a refusal when its fields do not fit together. */
function toHolidayRule(input: z.infer<typeof holidayRuleSchema>): HolidayRule | string {
  const rule: HolidayRule = {
    id: createId('hr'),
    ruleType: input.ruleType,
    employeeId: null,
    employeeName: null,
    locationId: null,
    locationName: null,
    branchId: null,
    branchName: null,
    countryId: null,
    countryName: null,
    stateId: null,
    stateName: null,
    cityId: null,
    cityName: null,
    religion: null,
  }
  switch (input.ruleType) {
    case 'employee': {
      const employee = input.employeeId ? findEmployee(input.employeeId) : undefined
      if (!employee) return 'Employee not found.'
      return { ...rule, employeeId: employee.id, employeeName: employee.name }
    }
    case 'org_structure': {
      const location = input.locationId ? locations.find(input.locationId) : undefined
      const branch = input.branchId ? branches.find(input.branchId) : undefined
      if (!location || branch?.locationId !== location.id) {
        return 'Pick a location and a branch in that location.'
      }
      return {
        ...rule,
        locationId: location.id,
        locationName: location.name,
        branchId: branch.id,
        branchName: branch.name,
      }
    }
    case 'geo_location': {
      const country = COUNTRIES.find((item) => item.id === input.countryId)
      const state = STATES.find(
        (item) => item.id === input.stateId && item.countryId === input.countryId,
      )
      const city = CITIES.find((item) => item.id === input.cityId && item.stateId === input.stateId)
      if (!country || !state || !city)
        return 'Pick a country, a state in it and a city in that state.'
      return {
        ...rule,
        countryId: country.id,
        countryName: country.name,
        stateId: state.id,
        stateName: state.name,
        cityId: city.id,
        cityName: city.name,
      }
    }
    case 'religion':
      return input.religion ? { ...rule, religion: input.religion } : 'Pick a religion.'
  }
}

function saveHoliday(input: z.infer<typeof holidaySchema>, existing: Holiday | null): Response {
  if (input.endDate < input.startDate) {
    return invalid('End date cannot be before the start date.', {
      endDate: 'End date cannot be before the start date.',
    })
  }
  const days = differenceInCalendarDays(parseISO(input.endDate), parseISO(input.startDate)) + 1
  if (days > 366) {
    return invalid('A holiday lasts at most a year.', {
      endDate: 'A holiday lasts at most a year.',
    })
  }
  const name = input.name.toLowerCase()
  if (
    holidays
      .all()
      .some(
        (item) =>
          item.id !== existing?.id &&
          item.name.toLowerCase() === name &&
          item.startDate === input.startDate,
      )
  ) {
    return duplicate(
      'name',
      'HOLIDAY_DUPLICATE',
      'A holiday with this name already starts on this date.',
    )
  }
  const rules: HolidayRule[] = []
  for (const entry of input.rules) {
    const result = toHolidayRule(entry)
    if (typeof result === 'string') return invalid(result, { rules: result })
    rules.push(result)
  }
  const record: Holiday = {
    id: existing?.id ?? createId('hol'),
    name: input.name,
    holidayType: input.holidayType,
    startDate: input.startDate,
    endDate: input.endDate,
    description: input.description,
    attendanceExempt: input.attendanceExempt,
    dayCount: days,
    ruleCount: null,
    rules,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: existing ? now() : null,
    rowVersion: nextRowVersion(),
  }
  if (existing) holidays.update(existing.id, record)
  else holidays.insert(record)
  return ok(record, existing ? 200 : 201)
}

// --- rest days -------------------------------------------------------------------------------

const restDaySchema = z.object({
  fromDate: day,
  toDate: day,
  weekdays: z.array(z.number().int()).min(1, 'Pick at least one day.').max(7),
  repeatEveryWeeks: z.number().int().min(0).max(8).default(0),
  step: z.number().int().min(1).max(8).default(1),
  isPayable: z.boolean().default(false),
  employeeIds: z.array(id).min(1, 'Select at least one employee.').max(5000),
  rowVersion,
})

/** The dates a rule gives (per person): weekdays in range, `step` weeks on in each cycle. */
function ruleDates(input: z.infer<typeof restDaySchema>): string[] {
  const start = parseISO(input.fromDate)
  return eachDayOfInterval({ start, end: parseISO(input.toDate) })
    .filter((date) => {
      if (!input.weekdays.includes(getISODay(date))) return false
      if (input.repeatEveryWeeks === 0) return true
      const week = Math.floor(differenceInCalendarDays(date, start) / 7)
      return week % input.repeatEveryWeeks < input.step
    })
    .map((date) => format(date, 'yyyy-MM-dd'))
}

function saveRestDayRule(input: z.infer<typeof restDaySchema>, existing: RestDayRule | null) {
  if (input.toDate < input.fromDate) {
    return invalid('To date cannot be before the from date.', {
      toDate: 'To date cannot be before the from date.',
    })
  }
  if (differenceInCalendarDays(parseISO(input.toDate), parseISO(input.fromDate)) > 366) {
    return invalid('A rule covers at most a year.', { toDate: 'A rule covers at most a year.' })
  }
  if (input.weekdays.some((value) => value < 1 || value > 7)) {
    return invalid('Weekdays are 1 (Monday) to 7 (Sunday).', {
      weekdays: 'Weekdays are 1 (Monday) to 7 (Sunday).',
    })
  }
  if (input.repeatEveryWeeks > 0 && input.step > input.repeatEveryWeeks) {
    return invalid('Step is between 1 and the number of weeks in the repeat.', {
      step: 'Step is between 1 and the number of weeks in the repeat.',
    })
  }
  const employees = ruleEmployees([...new Set(input.employeeIds)])
  if (employees.length !== new Set(input.employeeIds).size) {
    return invalid('Employee not found.', { employeeIds: 'Employee not found.' })
  }
  const dates = ruleDates(input)
  if (dates.length === 0) {
    return invalid('These dates and days give no rest day.', {
      weekdays: 'These dates and days give no rest day.',
    })
  }
  const record: RestDayRule = {
    id: existing?.id ?? createId('rdr'),
    fromDate: input.fromDate,
    toDate: input.toDate,
    weekdays: [...new Set(input.weekdays)].sort((a, b) => a - b),
    repeatEveryWeeks: input.repeatEveryWeeks,
    step: input.repeatEveryWeeks === 0 ? 1 : input.step,
    isPayable: input.isPayable,
    employeeCount: employees.length,
    restDayCount: dates.length * employees.length,
    employees,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: existing ? now() : null,
    rowVersion: nextRowVersion(),
  }
  if (existing) restDayRules.update(existing.id, record)
  else restDayRules.insert(record)
  return ok(record, existing ? 200 : 201)
}

export const attendanceSettingsHandlers = [
  // Basic --------------------------------------------------------------------------------------
  http.get(
    attendancePath('/basic'),
    guarded(() => ok<BasicSettings>(currentSettings().basic)),
  ),

  http.put(
    attendancePath('/basic'),
    guarded(async ({ request }) => {
      const parsed = await readBody(request, basicSchema)
      if (!parsed.success) return rejected(parsed.error)
      const settings = currentSettings()
      const sent = parsed.data.rowVersion ?? null
      if (
        sent !== null &&
        settings.basic.rowVersion !== null &&
        sent !== settings.basic.rowVersion
      ) {
        return conflict('setting')
      }
      const basic: BasicSettings = { ...parsed.data, rowVersion: nextRowVersion() }
      storeSettings({ ...settings, basic })
      return ok(basic)
    }),
  ),

  // Scheduling switches: mock only (the API has no endpoint for them yet).
  http.get(
    attendancePath('/scheduling'),
    guarded(() => ok<SchedulingSettings>(currentSettings().scheduling)),
  ),

  http.put(
    attendancePath('/scheduling'),
    guarded(async ({ request }) => {
      const parsed = await readBody(request, schedulingSchema)
      if (!parsed.success) return rejected(parsed.error)
      storeSettings({ ...currentSettings(), scheduling: parsed.data })
      return ok<SchedulingSettings>(parsed.data)
    }),
  ),

  // Break types ----------------------------------------------------------------------------------
  http.get(
    schedulingPath('/break-types'),
    guarded(({ request }) =>
      listOf(
        new URL(request.url),
        breakTypes.all().sort((a, b) => a.name.localeCompare(b.name)),
        (item) => `${item.name} ${item.startIdentifier} ${item.endIdentifier}`,
      ),
    ),
  ),

  http.get(
    schedulingPath('/break-types/:id'),
    guarded(({ params }) => {
      const record = breakTypes.find(String(params.id))
      return record ? ok(record) : notFound('Break type')
    }),
  ),

  http.post(
    schedulingPath('/break-types'),
    guarded(async ({ request }) => {
      const parsed = await readBody(request, breakTypeSchema)
      if (!parsed.success) return rejected(parsed.error)
      const { name, startIdentifier, endIdentifier } = parsed.data
      const clash = breakTypeClash(parsed.data, null)
      if (clash) return clash
      const record: BreakTypeRecord = {
        id: createId('bt'),
        name,
        startIdentifier,
        endIdentifier,
        createdAt: now(),
        updatedAt: null,
        rowVersion: nextRowVersion(),
      }
      breakTypes.insert(record)
      return ok(record, 201)
    }),
  ),

  http.put(
    schedulingPath('/break-types/:id'),
    guarded(async ({ request, params }) => {
      const existing = breakTypes.find(String(params.id))
      if (!existing) return notFound('Break type')
      const parsed = await readBody(request, breakTypeSchema)
      if (!parsed.success) return rejected(parsed.error)
      const stale = checkVersion(parsed.data.rowVersion, existing.rowVersion, 'break type')
      if (stale) return stale
      const clash = breakTypeClash(parsed.data, existing.id)
      if (clash) return clash
      const next: BreakTypeRecord = {
        ...existing,
        name: parsed.data.name,
        startIdentifier: parsed.data.startIdentifier,
        endIdentifier: parsed.data.endIdentifier,
        updatedAt: now(),
        rowVersion: nextRowVersion(),
      }
      breakTypes.update(existing.id, next)
      return ok(next)
    }),
  ),

  http.delete(
    schedulingPath('/break-types/:id'),
    guarded(({ request, params }) => {
      const existing = breakTypes.find(String(params.id))
      if (!existing) return notFound('Break type')
      const stale = checkDeleteVersion(request, existing.rowVersion, 'break type')
      if (stale) return stale
      const used = attendanceEdits
        .all()
        .some((edit) => edit.breaks?.some((item) => item.type === existing.id))
      if (used) {
        return errorResponse(409, 'Scheduled shifts use this break type', { code: 'IN_USE' })
      }
      breakTypes.remove(existing.id)
      return noContent()
    }),
  ),

  // IP restrictions --------------------------------------------------------------------------
  http.get(
    attendancePath('/ip-restrictions'),
    guarded(({ request }) => {
      const url = new URL(request.url)
      const active = flag(url, 'isActive')
      const items = ipRestrictions
        .all()
        .filter((item) => active === null || item.isActive === active)
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((item) => ({ ...item, targets: null }))
      return listOf(
        url,
        items,
        (item) => `${item.code} ${item.ipv4 ?? ''} ${item.ipv6 ?? ''} ${item.rangeStart ?? ''}`,
      )
    }),
  ),

  http.get(
    attendancePath('/ip-restrictions/:id'),
    guarded(({ params }) => {
      const record = ipRestrictions.find(String(params.id))
      return record ? ok(record) : notFound('IP restriction')
    }),
  ),

  http.post(
    attendancePath('/ip-restrictions'),
    guarded(async ({ request }) => {
      const parsed = await readBody(request, ipSchema)
      if (!parsed.success) return rejected(parsed.error)
      return saveIp(parsed.data, null)
    }),
  ),

  http.put(
    attendancePath('/ip-restrictions/:id'),
    guarded(async ({ request, params }) => {
      const existing = ipRestrictions.find(String(params.id))
      if (!existing) return notFound('IP restriction')
      const parsed = await readBody(request, ipSchema)
      if (!parsed.success) return rejected(parsed.error)
      const stale = checkVersion(parsed.data.rowVersion, existing.rowVersion, 'IP restriction')
      return stale ?? saveIp(parsed.data, existing)
    }),
  ),

  http.delete(
    attendancePath('/ip-restrictions/:id'),
    guarded(({ request, params }) => {
      const existing = ipRestrictions.find(String(params.id))
      if (!existing) return notFound('IP restriction')
      const stale = checkDeleteVersion(request, existing.rowVersion, 'IP restriction')
      if (stale) return stale
      ipRestrictions.remove(existing.id)
      return noContent()
    }),
  ),

  // Geo fencing ---------------------------------------------------------------------------------
  http.get(
    attendancePath('/geo-fences'),
    guarded(({ request }) => {
      const url = new URL(request.url)
      const active = flag(url, 'isActive')
      const forShift = flag(url, 'isForShift')
      const items = geoFences
        .all()
        .map((fence) => toFenceSetting(fence, false))
        .filter(
          (item) =>
            (active === null || item.isActive === active) &&
            (forShift === null || item.isForShift === forShift),
        )
        .sort((a, b) => a.code.localeCompare(b.code))
      return listOf(url, items, (item) => `${item.code} ${item.name}`)
    }),
  ),

  http.get(
    attendancePath('/geo-fences/:id'),
    guarded(({ params }) => {
      const fence = geoFences.find(String(params.id))
      return fence ? ok(toFenceSetting(fence, true)) : notFound('Geo fence')
    }),
  ),

  http.post(
    attendancePath('/geo-fences'),
    guarded(async ({ request }) => {
      const parsed = await readBody(request, fenceSchema)
      if (!parsed.success) return rejected(parsed.error)
      return saveFence(parsed.data, null)
    }),
  ),

  http.put(
    attendancePath('/geo-fences/:id'),
    guarded(async ({ request, params }) => {
      const fence = geoFences.find(String(params.id))
      if (!fence) return notFound('Geo fence')
      const parsed = await readBody(request, fenceSchema)
      if (!parsed.success) return rejected(parsed.error)
      const stale = checkVersion(
        parsed.data.rowVersion,
        fenceDetails(fence).rowVersion,
        'geo fence',
      )
      return stale ?? saveFence(parsed.data, fence)
    }),
  ),

  http.delete(
    attendancePath('/geo-fences/:id'),
    guarded(({ request, params }) => {
      const fence = geoFences.find(String(params.id))
      if (!fence) return notFound('Geo fence')
      const stale = checkDeleteVersion(request, fenceDetails(fence).rowVersion, 'geo fence')
      if (stale) return stale
      geoFences.remove(fence.id)
      geoFenceSettings.remove(fence.id)
      return noContent()
    }),
  ),

  // Holidays -------------------------------------------------------------------------------------
  http.get(
    schedulingPath('/holidays'),
    guarded(({ request }) => {
      const url = new URL(request.url)
      const year = url.searchParams.get('year')
      const type = url.searchParams.get('holidayType')
      const items = holidays
        .all()
        .filter(
          (item) =>
            (!year || item.startDate.startsWith(year) || item.endDate.startsWith(year)) &&
            (!type || item.holidayType === type),
        )
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .map((item) => ({ ...item, ruleCount: item.rules.length, rules: [] }))
      return listOf(url, items, (item) => `${item.name} ${item.description ?? ''}`)
    }),
  ),

  http.get(
    schedulingPath('/holidays/:id'),
    guarded(({ params }) => {
      const record = holidays.find(String(params.id))
      return record ? ok({ ...record, ruleCount: null }) : notFound('Holiday')
    }),
  ),

  http.post(
    schedulingPath('/holidays'),
    guarded(async ({ request }) => {
      const parsed = await readBody(request, holidaySchema)
      if (!parsed.success) return rejected(parsed.error)
      return saveHoliday(parsed.data, null)
    }),
  ),

  http.put(
    schedulingPath('/holidays/:id'),
    guarded(async ({ request, params }) => {
      const existing = holidays.find(String(params.id))
      if (!existing) return notFound('Holiday')
      const parsed = await readBody(request, holidaySchema)
      if (!parsed.success) return rejected(parsed.error)
      const stale = checkVersion(parsed.data.rowVersion, existing.rowVersion, 'holiday')
      return stale ?? saveHoliday(parsed.data, existing)
    }),
  ),

  http.delete(
    schedulingPath('/holidays/:id'),
    guarded(({ request, params }) => {
      const existing = holidays.find(String(params.id))
      if (!existing) return notFound('Holiday')
      const stale = checkDeleteVersion(request, existing.rowVersion, 'holiday')
      if (stale) return stale
      holidays.remove(existing.id)
      return noContent()
    }),
  ),

  // Rest days -----------------------------------------------------------------------------------
  // Static path before `/rest-days/:id`.
  http.post(
    schedulingPath('/rest-days/delete-range'),
    guarded(async ({ request }) => {
      const parsed = await readBody(
        request,
        z.object({
          startDate: day,
          endDate: day,
          employeeIds: z.array(id).max(5000).default([]),
          allEmployees: z.boolean().default(false),
        }),
      )
      if (!parsed.success) return rejected(parsed.error)
      const { startDate, endDate, employeeIds, allEmployees } = parsed.data
      if (endDate < startDate) {
        return invalid('The end date is before the start date.', {
          endDate: 'The end date is before the start date.',
        })
      }
      if (!allEmployees && employeeIds.length === 0) {
        return invalid('Select employees, or all employees.', {
          employeeIds: 'Select employees, or all employees.',
        })
      }
      let deleted = 0
      for (const rule of restDayRules.all()) {
        const people = rule.employees.filter(
          (person) => allEmployees || employeeIds.includes(person.employeeId),
        )
        if (people.length === 0) continue
        const inRange = ruleDates({ ...rule, employeeIds: [] }).filter(
          (date) => date >= startDate && date <= endDate,
        ).length
        const removed = Math.min(inRange * people.length, rule.restDayCount)
        if (removed === 0) continue
        deleted += removed
        restDayRules.update(rule.id, { ...rule, restDayCount: rule.restDayCount - removed })
      }
      return ok({ deletedSchedules: 0, deletedRestDays: deleted })
    }),
  ),

  http.get(
    schedulingPath('/rest-days'),
    guarded(({ request }) => {
      const url = new URL(request.url)
      const employeeId = url.searchParams.get('employeeId')
      const from = url.searchParams.get('from')
      const to = url.searchParams.get('to')
      const items = restDayRules
        .all()
        .filter(
          (rule) =>
            (!employeeId || rule.employees.some((person) => person.employeeId === employeeId)) &&
            (!from || rule.toDate >= from) &&
            (!to || rule.fromDate <= to),
        )
        .sort((a, b) => b.fromDate.localeCompare(a.fromDate))
        .map((rule) => ({ ...rule, employees: [] }))
      const { page, pageSize } = readPageParams(url)
      return HttpResponse.json<Paginated<RestDayRule>>(paginate(items, page, pageSize))
    }),
  ),

  http.get(
    schedulingPath('/rest-days/:id'),
    guarded(({ params }) => {
      const record = restDayRules.find(String(params.id))
      return record ? ok(record) : notFound('Rest day rule')
    }),
  ),

  http.post(
    schedulingPath('/rest-days'),
    guarded(async ({ request }) => {
      const parsed = await readBody(request, restDaySchema)
      if (!parsed.success) return rejected(parsed.error)
      return saveRestDayRule(parsed.data, null)
    }),
  ),

  http.put(
    schedulingPath('/rest-days/:id'),
    guarded(async ({ request, params }) => {
      const existing = restDayRules.find(String(params.id))
      if (!existing) return notFound('Rest day rule')
      const parsed = await readBody(request, restDaySchema)
      if (!parsed.success) return rejected(parsed.error)
      const stale = checkVersion(parsed.data.rowVersion, existing.rowVersion, 'rest day rule')
      return stale ?? saveRestDayRule(parsed.data, existing)
    }),
  ),

  http.delete(
    schedulingPath('/rest-days/:id'),
    guarded(({ request, params }) => {
      const existing = restDayRules.find(String(params.id))
      if (!existing) return notFound('Rest day rule')
      const stale = checkDeleteVersion(request, existing.rowVersion, 'rest day rule')
      if (stale) return stale
      restDayRules.remove(existing.id)
      return noContent()
    }),
  ),
]
