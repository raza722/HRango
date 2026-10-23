import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  type AreaRow,
  type BranchRow,
  DATE_FORMATS,
  type GeneralSettings,
  type JobTitle,
  type JobTitleInput,
  type LocationRow,
  type OrgArea,
  type OrgAreaInput,
  type OrgBranch,
  type OrgBranchInput,
  type OrgLocation,
  type OrgLocationInput,
  WEEK_START_DAYS,
} from '@/features/settings'
import type { ApiItem } from '@/types/api'

import { createMockCollection } from '../collection'
import { apiPath, errorResponse, latency, requireAuth } from '../utils'
import { createCrudHandlers, duplicateName } from './crud'
import {
  CITIES,
  COMPANIES,
  COUNTRIES,
  EMPLOYEES,
  PLACES,
  REGIONS,
  seedAreas,
  seedBranches,
  seedGeneralSettings,
  seedJobTitles,
  seedLocations,
} from './seed'

export const locations = createMockCollection<OrgLocation>({
  storageKey: 'hrms-mock-locations',
  seed: seedLocations,
})
export const areas = createMockCollection<OrgArea>({
  storageKey: 'hrms-mock-areas',
  seed: seedAreas,
})
export const branches = createMockCollection<OrgBranch>({
  storageKey: 'hrms-mock-branches',
  seed: seedBranches,
})
export const jobTitles = createMockCollection<JobTitle>({
  storageKey: 'hrms-mock-job-titles',
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

const name = z.string().trim().min(1).max(80)
const prefix = z.string().trim().max(12)
const description = z.string().max(500)
const coordinate = (limit: number) => z.number().min(-limit).max(limit).nullable()

const locationSchema = z.object({
  name,
  employeePrefix: prefix,
  companyId: z.string().min(1),
  description,
  latitude: coordinate(90),
  longitude: coordinate(180),
}) satisfies z.ZodType<OrgLocationInput>

const areaSchema = z.object({
  name,
  locationId: z.string().min(1),
  description,
}) satisfies z.ZodType<OrgAreaInput>

const branchSchema = z.object({
  name,
  employeePrefix: prefix,
  companyId: z.string().min(1),
  locationId: z.string().min(1),
  areaId: z.string().nullable(),
  managerId: z.string().nullable(),
  description,
  countryCode: z.string().nullable(),
  regionCode: z.string().nullable(),
  cityId: z.string().nullable(),
  latitude: coordinate(90),
  longitude: coordinate(180),
}) satisfies z.ZodType<OrgBranchInput>

const jobTitleSchema = z.object({
  name,
  limitHeadCount: z.boolean(),
  maxHeadCount: z.number().int().min(1).max(100_000).nullable(),
  description,
}) satisfies z.ZodType<JobTitleInput>

const companyName = (id: string) => COMPANIES.find((c) => c.id === id)?.name ?? 'Unknown company'
const unprocessable = (field: string, message: string) =>
  errorResponse(422, message, { code: 'INVALID_REFERENCE', fieldErrors: { [field]: message } })
const inUse = (message: string) => errorResponse(409, message, { code: 'IN_USE' })

const settingsPath = (path: string) => apiPath(`/settings${path}`)

const crudHandlers = [
  ...createCrudHandlers<OrgLocation, OrgLocationInput, LocationRow>({
    path: settingsPath('/locations'),
    label: 'location',
    idPrefix: 'lc',
    collection: locations,
    schema: locationSchema,
    filterKeys: ['companyId'],
    toRow: (record) => ({ ...record, companyName: companyName(record.companyId) }),
    validate: (input, existing) => {
      if (!COMPANIES.some((c) => c.id === input.companyId))
        return unprocessable('companyId', 'Select a company')
      return duplicateName(
        locations.all(),
        input.name,
        existing,
        'location',
        (r) => r.companyId === input.companyId,
      )
    },
    beforeDelete: (record) => {
      const usedBy = branches.all().filter((b) => b.locationId === record.id).length
      const areaCount = areas.all().filter((a) => a.locationId === record.id).length
      if (usedBy || areaCount) {
        return inUse(
          `“${record.name}” still has ${usedBy} branch${usedBy === 1 ? '' : 'es'} and ${areaCount} area${areaCount === 1 ? '' : 's'}. Move or delete them first.`,
        )
      }
      return null
    },
  }),

  ...createCrudHandlers<OrgArea, OrgAreaInput, AreaRow>({
    path: settingsPath('/areas'),
    label: 'area',
    idPrefix: 'ar',
    collection: areas,
    schema: areaSchema,
    filterKeys: ['locationId'],
    toRow: (record) => ({
      ...record,
      locationName: locations.find(record.locationId)?.name ?? 'Unknown location',
    }),
    validate: (input, existing) => {
      if (!locations.find(input.locationId)) return unprocessable('locationId', 'Select a location')
      return duplicateName(
        areas.all(),
        input.name,
        existing,
        'area',
        (r) => r.locationId === input.locationId,
      )
    },
    beforeDelete: (record) => {
      const usedBy = branches.all().filter((b) => b.areaId === record.id).length
      return usedBy
        ? inUse(
            `“${record.name}” is used by ${usedBy} branch${usedBy === 1 ? '' : 'es'}. Change them first.`,
          )
        : null
    },
  }),

  ...createCrudHandlers<OrgBranch, OrgBranchInput, BranchRow>({
    path: settingsPath('/branches'),
    label: 'branch',
    idPrefix: 'br',
    collection: branches,
    schema: branchSchema,
    filterKeys: ['companyId', 'locationId'],
    toRow: (record) => ({
      ...record,
      companyName: companyName(record.companyId),
      locationName: locations.find(record.locationId)?.name ?? 'Unknown location',
      areaName: record.areaId ? (areas.find(record.areaId)?.name ?? null) : null,
      managerName: record.managerId
        ? (EMPLOYEES.find((e) => e.id === record.managerId)?.name ?? null)
        : null,
      cityName: record.cityId ? (CITIES.find((c) => c.id === record.cityId)?.name ?? null) : null,
    }),
    validate: (input, existing) => {
      const location = locations.find(input.locationId)
      if (!location) return unprocessable('locationId', 'Select a location')
      if (location.companyId !== input.companyId) {
        return unprocessable('locationId', 'This location belongs to another company')
      }
      if (input.areaId && areas.find(input.areaId)?.locationId !== input.locationId) {
        return unprocessable('areaId', 'This area is not in the selected location')
      }
      return duplicateName(
        branches.all(),
        input.name,
        existing,
        'branch',
        (r) => r.companyId === input.companyId,
      )
    },
  }),

  ...createCrudHandlers<JobTitle, JobTitleInput, JobTitle>({
    path: settingsPath('/job-titles'),
    label: 'job title',
    idPrefix: 'jt',
    collection: jobTitles,
    schema: jobTitleSchema,
    toRow: (record) => record,
    validate: (input, existing) => {
      if (input.limitHeadCount && input.maxHeadCount === null) {
        return unprocessable('maxHeadCount', 'Enter the maximum head count')
      }
      return duplicateName(jobTitles.all(), input.name, existing, 'job title')
    },
  }),
]

const generalSettingsSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().max(160),
  email: z.union([z.email(), z.literal('')]),
  phone: z.string().trim().max(40),
  website: z.string().trim().max(200),
  address: z.string().max(300),
  timezone: z.string().min(1),
  currency: z.string().length(3),
  dateFormat: z.enum(DATE_FORMATS),
  weekStartsOn: z.enum(WEEK_START_DAYS),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
})

/** Wraps a static list so each lookup has the same auth and latency as the API. */
function lookup<T>(path: string, read: (url: URL) => T[]) {
  return http.get(apiPath(path), async ({ request }) => {
    await latency()
    return (
      requireAuth(request) ?? HttpResponse.json<ApiItem<T[]>>({ data: read(new URL(request.url)) })
    )
  })
}

export const settingsHandlers = [
  ...crudHandlers,

  lookup('/companies', () => COMPANIES),
  lookup('/employees', () => EMPLOYEES),
  lookup('/geo/countries', () => COUNTRIES),
  lookup('/geo/regions', (url) =>
    REGIONS.filter((r) => r.countryCode === url.searchParams.get('country')),
  ),
  lookup('/geo/cities', (url) =>
    CITIES.filter((c) => c.regionCode === url.searchParams.get('region')),
  ),
  lookup('/geo/search', (url) => {
    const words = (url.searchParams.get('q') ?? '').toLowerCase().split(/\s+/).filter(Boolean)
    if (words.length === 0) return []
    return PLACES.filter((place) =>
      words.every((word) => place.label.toLowerCase().includes(word)),
    ).slice(0, 8)
  }),

  http.get(settingsPath('/general'), async ({ request }) => {
    await latency()
    return (
      requireAuth(request) ?? HttpResponse.json<ApiItem<GeneralSettings>>({ data: generalSettings })
    )
  }),

  http.put(settingsPath('/general'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const body: unknown = await request.json().catch(() => null)
    const parsed = generalSettingsSchema.safeParse(body)
    if (!parsed.success)
      return errorResponse(422, 'Some fields are not valid.', { code: 'VALIDATION_FAILED' })
    generalSettings = { ...parsed.data, updatedAt: new Date().toISOString() }
    return HttpResponse.json<ApiItem<GeneralSettings>>({ data: generalSettings })
  }),
]
