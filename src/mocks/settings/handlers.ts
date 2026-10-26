import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  DATE_FORMATS,
  type GeneralSettings,
  type GeoPlace,
  type JobTitle,
  type LookupItem,
  type OrgArea,
  type OrgBranch,
  type OrgLocation,
  WEEK_START_DAYS,
} from '@/features/settings'
import type { ApiItem } from '@/types/api'

import { createMockCollection } from '../collection'
import { createEmployeeLookupHandler } from '../employees/lookup'
import { DIRECTORY } from '../employees/seed'
import { mockFileUrl } from '../files/handlers'
import { apiPath, errorResponse, latency, requireAuth } from '../utils'
import {
  checkRowVersion,
  conflict,
  createCrudHandlers,
  duplicateName,
  invalidField,
  validationFailed,
} from './crud'
import {
  CITIES,
  COMPANIES,
  COUNTRIES,
  CURRENT_COMPANY_ID,
  type MockArea,
  type MockBranch,
  type MockGeneralSettings,
  type MockJobTitle,
  type MockLocation,
  newRowVersion,
  PLACES,
  seedAreas,
  seedBranches,
  seedGeneralSettings,
  seedJobTitles,
  seedLocations,
  STATES,
} from './seed'

// Storage keys carry a version: records saved in the old (pre-API) shape are not read back.
export const locations = createMockCollection<MockLocation>({
  storageKey: 'hrms-mock-locations-v2',
  seed: seedLocations,
})
export const areas = createMockCollection<MockArea>({
  storageKey: 'hrms-mock-areas-v2',
  seed: seedAreas,
})
export const branches = createMockCollection<MockBranch>({
  storageKey: 'hrms-mock-branches-v2',
  seed: seedBranches,
})
export const jobTitles = createMockCollection<MockJobTitle>({
  storageKey: 'hrms-mock-job-titles-v2',
  seed: seedJobTitles,
})

let generalSettings = seedGeneralSettings()

export function resetSettingsDb(): void {
  locations.reset()
  areas.reset()
  branches.reset()
  jobTitles.reset()
  generalSettings = seedGeneralSettings()
}

// ---------------------------------------------------------------- answers (names and counts added)

const companyName = (id: string) => COMPANIES.find((c) => c.id === id)?.name ?? 'Unknown company'
const branchName = (id: string | null) => (id ? (branches.find(id)?.name ?? '') : '')

function toLocationOut(record: MockLocation): OrgLocation {
  return {
    ...record,
    companyName: companyName(record.companyId),
    branchCount: branches.all().filter((b) => b.locationId === record.id).length,
  }
}

function toAreaOut(record: MockArea): OrgArea {
  return {
    ...record,
    locationName: locations.find(record.locationId)?.name ?? 'Unknown location',
    branchCount: branches.all().filter((b) => b.areaId === record.id).length,
  }
}

function toBranchOut(record: MockBranch): OrgBranch {
  const country = COUNTRIES.find((c) => c.id === record.countryId)
  const state = STATES.find((s) => s.id === record.stateId)
  return {
    ...record,
    companyName: companyName(record.companyId),
    locationName: locations.find(record.locationId)?.name ?? 'Unknown location',
    areaName: record.areaId ? (areas.find(record.areaId)?.name ?? null) : null,
    managerName: record.managerId
      ? (DIRECTORY.find((e) => e.id === record.managerId)?.name ?? null)
      : null,
    countryCode: country?.code ?? null,
    countryName: country?.name ?? null,
    stateCode: state?.code ?? null,
    stateName: state?.name ?? null,
    cityName: record.cityId ? (CITIES.find((c) => c.id === record.cityId)?.name ?? null) : null,
    employeeCount: DIRECTORY.filter((e) => e.branchId === record.id).length,
  }
}

/**
 * A branch's place with both ids and ISO codes, for other mocks (attendance holiday rules):
 * the stored branch keeps only `countryId` / `stateId` / `cityId`, as the API does.
 */
export function branchGeo(branchId: string | null) {
  const branch = branchId ? branches.find(branchId) : undefined
  const out = branch ? toBranchOut(branch) : undefined
  return {
    countryId: out?.countryId ?? null,
    countryCode: out?.countryCode ?? null,
    stateId: out?.stateId ?? null,
    stateCode: out?.stateCode ?? null,
    /** Same as `stateCode`. */
    regionCode: out?.stateCode ?? null,
    cityId: out?.cityId ?? null,
  }
}

function toJobTitleOut(record: MockJobTitle): JobTitle {
  return {
    ...record,
    headCount: DIRECTORY.filter((e) => e.jobTitle.toLowerCase() === record.name.toLowerCase())
      .length,
  }
}

// ---------------------------------------------------------------- request bodies (as the API validates)

const name = z.string().trim().min(1, 'String should have at least 1 character').max(200)
const prefix = z.string().trim().max(10).nullable().default(null)
const description = z.string().max(4000).nullable().default(null)
const id = z.string().min(1)
const optionalId = id.nullable().default(null)
const coordinate = (limit: number) => z.number().min(-limit).max(limit).nullable().default(null)

const locationSchema = z.object({
  name,
  employeePrefix: prefix,
  description,
  latitude: coordinate(90),
  longitude: coordinate(180),
})

const areaSchema = z.object({ name, locationId: id, description })

const branchSchema = z.object({
  name,
  employeePrefix: prefix,
  locationId: id,
  areaId: optionalId,
  managerId: optionalId,
  description,
  countryId: optionalId,
  stateId: optionalId,
  cityId: optionalId,
  latitude: coordinate(90),
  longitude: coordinate(180),
})

const jobTitleSchema = z.object({
  name,
  limitHeadCount: z.boolean().default(false),
  maxHeadCount: z.number().int().min(1).nullable().default(null),
  description,
})

function bothOrNeither(input: { latitude: number | null; longitude: number | null }) {
  return (input.latitude === null) !== (input.longitude === null)
    ? invalidField('longitude', 'Give both latitude and longitude, or neither.')
    : null
}

const orgPath = (path: string) => apiPath(`/organisation${path}`)
const inCompany = () => ({ companyId: CURRENT_COMPANY_ID })

const crudHandlers = [
  ...createCrudHandlers({
    path: orgPath('/locations'),
    label: 'location',
    idPrefix: 'lc',
    collection: locations,
    schema: locationSchema,
    toOut: toLocationOut,
    extra: inCompany,
    validate: (input, existing) =>
      bothOrNeither(input) ?? duplicateName(locations.all(), input.name, existing, 'location'),
    beforeDelete: (record) => {
      if (branches.all().some((b) => b.locationId === record.id))
        return conflict('This location has branches. Move or delete them first')
      if (areas.all().some((a) => a.locationId === record.id))
        return conflict('This location has areas. Move or delete them first')
      return null
    },
  }),

  ...createCrudHandlers({
    path: orgPath('/areas'),
    label: 'area',
    idPrefix: 'ar',
    collection: areas,
    schema: areaSchema,
    toOut: toAreaOut,
    filterKeys: ['locationId'],
    validate: (input, existing) => {
      if (!locations.find(input.locationId))
        return invalidField('locationId', 'Location not found.')
      const duplicate = duplicateName(
        areas.all(),
        input.name,
        existing,
        'area',
        (r) => r.locationId === input.locationId,
      )
      return duplicate
        ? errorResponse(409, 'This location already has an area with this name.', {
            code: 'AREA_DUPLICATE',
            fieldErrors: { name: 'This location already has an area with this name.' },
          })
        : null
    },
    beforeDelete: (record) =>
      branches.all().some((b) => b.areaId === record.id)
        ? conflict('Branches sit in this area. Move or delete them first')
        : null,
  }),

  ...createCrudHandlers({
    path: orgPath('/branches'),
    label: 'branch',
    idPrefix: 'br',
    collection: branches,
    schema: branchSchema,
    toOut: toBranchOut,
    extra: inCompany,
    filterKeys: ['locationId', 'areaId'],
    validate: (input, existing) => {
      if (!locations.find(input.locationId))
        return invalidField('locationId', 'Location not found.')
      if (input.areaId && areas.find(input.areaId)?.locationId !== input.locationId)
        return invalidField('areaId', 'This area is not in the chosen location.')
      // Any picked person is accepted: the employee picker may come from another module's mock.
      if (input.countryId && !COUNTRIES.some((c) => c.id === input.countryId))
        return invalidField('countryId', 'Country not found.')
      if (
        input.stateId &&
        STATES.find((s) => s.id === input.stateId)?.countryId !== input.countryId
      )
        return invalidField('stateId', 'This state is not in the chosen country.')
      if (input.cityId && CITIES.find((c) => c.id === input.cityId)?.stateId !== input.stateId)
        return invalidField('cityId', 'This city is not in the chosen state.')
      return bothOrNeither(input) ?? duplicateName(branches.all(), input.name, existing, 'branch')
    },
    beforeDelete: (record) =>
      DIRECTORY.some((e) => e.branchId === record.id)
        ? conflict('Employees are assigned to this branch. Move them first')
        : null,
  }),

  ...createCrudHandlers({
    path: orgPath('/job-titles'),
    label: 'job title',
    idPrefix: 'jt',
    collection: jobTitles,
    schema: jobTitleSchema,
    toOut: toJobTitleOut,
    validate: (input, existing) => {
      if (input.limitHeadCount && input.maxHeadCount === null) {
        return invalidField('maxHeadCount', 'Enter the maximum head count (1 or more).')
      }
      return duplicateName(jobTitles.all(), input.name, existing, 'job title')
    },
    beforeDelete: (record) =>
      toJobTitleOut(record).headCount > 0
        ? conflict('Employees hold this job title. Change their job title first')
        : null,
  }),
]

// ---------------------------------------------------------------- general settings

const generalSettingsSchema = z.object({
  organizationName: z.string().trim().min(2).max(200),
  legalName: z.string().trim().max(200).nullable().default(null),
  email: z
    .string()
    .max(254)
    .regex(/^$|^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Enter a valid email address')
    .nullable()
    .default(null),
  phone: z
    .string()
    .max(30)
    .regex(/^[+\d\s()-]*$/)
    .nullable()
    .default(null),
  website: z
    .string()
    .max(200)
    .regex(/^$|^https?:\/\/\S+$/)
    .nullable()
    .default(null),
  address: z.string().max(500).nullable().default(null),
  countryId: z.string().nullable().default(null),
  timezone: z.string().regex(/^(UTC|[A-Z][A-Za-z]+(\/[A-Za-z0-9_+-]+){1,2})$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  dateFormat: z.enum(DATE_FORMATS).default('dd/MM/yyyy'),
  weekStartsOn: z.enum(WEEK_START_DAYS).default('monday'),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
})

const toGeneralOut = (settings: MockGeneralSettings): GeneralSettings => ({
  ...settings,
  countryName: COUNTRIES.find((c) => c.id === settings.countryId)?.name ?? null,
})

// ---------------------------------------------------------------- pickers

/** Wraps a list so each lookup has the same auth and latency as the API. */
function lookup(path: string, read: (url: URL) => readonly unknown[] | Response) {
  return http.get(apiPath(path), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const result = read(new URL(request.url))
    return result instanceof Response
      ? result
      : HttpResponse.json<ApiItem<readonly unknown[]>>({ data: result })
  })
}

const item = (
  record: { id: string; name: string },
  parentId: string | null = null,
): LookupItem => ({
  id: record.id,
  name: record.name,
  code: null,
  parentId,
})

/**
 * `GET /organisation/lookups/{kind}?parentId&q` for the lists this mock owns: locations, and
 * areas of a location. Other kinds (branches, departments, job titles…) are answered by the
 * mocks registered after this one (payroll, manpower, leaves…), so those modules keep their
 * own sample data; see `settingsLookupFallbackHandlers` for a fallback of every kind.
 */
function ownLookup(kind: string, parentId: string, q: string): LookupItem[] | null {
  const rows =
    kind === 'locations'
      ? locations.all().map((l) => item(l))
      : kind === 'areas'
        ? areas
            .all()
            .filter((a) => !parentId || a.locationId === parentId)
            .map((a) => item(a, a.locationId))
        : null
  return (
    rows
      ?.filter((row) => !q || row.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name)) ?? null
  )
}

const LOOKUP_KINDS = new Set([
  'locations',
  'areas',
  'branches',
  'departments',
  'divisions',
  'cost-centers',
  'designations',
  'job-titles',
  'grades',
  'job-levels',
  'employee-groups',
  'employment-types',
])

/** Every lookup kind from this mock's tables (branches and job titles included, the rest empty). */
function anyLookup(kind: string, parentId: string, q: string): LookupItem[] {
  const own = ownLookup(kind, parentId, q)
  if (own) return own
  const rows =
    kind === 'branches'
      ? branches
          .all()
          .filter((b) => !parentId || b.locationId === parentId)
          .map((b) => item(b, b.locationId))
      : kind === 'job-titles'
        ? jobTitles.all().map((j) => item(j))
        : []
  return rows
    .filter((row) => !q || row.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const readLookup = (url: URL) => ({
  kind: url.pathname.split('/').pop() ?? '',
  parentId: url.searchParams.get('parentId') ?? '',
  q: (url.searchParams.get('q') ?? '').trim().toLowerCase(),
})

/**
 * Fallbacks for the shared pickers (`/organisation/lookups/{kind}`, `/employees/lookup`), from
 * the Settings tables and the directory. Not in `settingsHandlers`: several modules' mocks
 * answer these with their own sample data, so register these last (after every module).
 */
export const settingsLookupFallbackHandlers = [
  lookup('/organisation/lookups/:kind', (url) => {
    const { kind, parentId, q } = readLookup(url)
    if (!LOOKUP_KINDS.has(kind)) return errorResponse(404, 'No such list.', { code: 'NOT_FOUND' })
    return anyLookup(kind, parentId, q)
  }),
  createEmployeeLookupHandler(branchName),
]

export const settingsHandlers = [
  ...crudHandlers,

  // Static paths before `/lookups/:kind`.
  lookup('/organisation/lookups/companies', () => COMPANIES),
  // Locations and areas only; other kinds fall through to the modules' own mocks.
  http.get(orgPath('/lookups/:kind'), async ({ request }) => {
    const { kind, parentId, q } = readLookup(new URL(request.url))
    const rows = ownLookup(kind, parentId, q)
    if (!rows) return undefined
    await latency()
    return requireAuth(request) ?? HttpResponse.json<ApiItem<LookupItem[]>>({ data: rows })
  }),

  lookup('/organisation/geo/countries', (url) => {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    return COUNTRIES.filter((c) => !q || c.name.toLowerCase().includes(q))
  }),
  lookup('/organisation/geo/states', (url) => {
    const countryId = url.searchParams.get('countryId')
    const code = url.searchParams.get('country')?.toUpperCase()
    if (!countryId && !code) return invalidField('country', 'Give countryId or country.')
    return STATES.filter((s) => (countryId ? s.countryId === countryId : s.countryCode === code))
  }),
  lookup('/organisation/geo/cities', (url) => {
    const stateId = url.searchParams.get('stateId')
    const code = url.searchParams.get('state')?.toUpperCase()
    if (!stateId && !code) return invalidField('state', 'Give stateId or state.')
    return CITIES.filter((c) => (stateId ? c.stateId === stateId : c.stateCode === code)).map(
      ({ regionCode: _regionCode, ...city }) => city,
    )
  }),
  // "Search Location": a stand-in geocoder (the API has none).
  lookup('/geo/search', (url): GeoPlace[] => {
    const words = (url.searchParams.get('q') ?? '').toLowerCase().split(/\s+/).filter(Boolean)
    if (words.length === 0) return []
    return PLACES.filter((place) =>
      words.every((word) => place.label.toLowerCase().includes(word)),
    ).slice(0, 8)
  }),

  http.get(orgPath('/general'), async ({ request }) => {
    await latency()
    return (
      requireAuth(request) ??
      HttpResponse.json<ApiItem<GeneralSettings>>({ data: toGeneralOut(generalSettings) })
    )
  }),

  http.put(orgPath('/general'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const body: unknown = await request.json().catch(() => null)
    const parsed = generalSettingsSchema.safeParse(body)
    if (!parsed.success) return validationFailed(parsed.error.issues)
    const stale = checkRowVersion(
      (body as { rowVersion?: unknown }).rowVersion,
      generalSettings,
      'company',
    )
    if (stale) return stale
    generalSettings = {
      ...generalSettings,
      ...parsed.data,
      updatedAt: new Date().toISOString(),
      rowVersion: newRowVersion(),
    }
    return HttpResponse.json<ApiItem<GeneralSettings>>({ data: toGeneralOut(generalSettings) })
  }),

  http.put(orgPath('/general/logo'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const body = (await request.json().catch(() => null)) as { fileId?: string | null } | null
    const fileId = body?.fileId ?? null
    generalSettings = {
      ...generalSettings,
      logoFileId: fileId,
      logoUrl: fileId ? mockFileUrl(fileId) : null,
      updatedAt: new Date().toISOString(),
      rowVersion: newRowVersion(),
    }
    return HttpResponse.json<ApiItem<GeneralSettings>>({ data: toGeneralOut(generalSettings) })
  }),
]
