import { z } from 'zod'

import {
  descriptionSchema,
  employeePrefixSchema,
  latitudeSchema,
  longitudeSchema,
  nameSchema,
  refineCoordinatePair,
  requiredIdSchema,
} from './shared'

/**
 * Form schemas for Settings → Control Panel → Organization. Values are kept as
 * strings (what the inputs hold); `utils/form-mappers.ts` turns them into API input.
 */

export const branchFormSchema = z
  .object({
    name: nameSchema('branch'),
    employeePrefix: employeePrefixSchema,
    companyId: requiredIdSchema('Select a company'),
    locationId: requiredIdSchema('Select a location'),
    areaId: z.string(),
    managerId: z.string(),
    description: descriptionSchema,
    countryCode: z.string(),
    regionCode: z.string(),
    cityId: z.string(),
    latitude: latitudeSchema,
    longitude: longitudeSchema,
  })
  .superRefine(refineCoordinatePair)

export type BranchFormValues = z.infer<typeof branchFormSchema>

export const locationFormSchema = z
  .object({
    name: nameSchema('location'),
    employeePrefix: employeePrefixSchema,
    companyId: requiredIdSchema('Select a company'),
    description: descriptionSchema,
    latitude: latitudeSchema,
    longitude: longitudeSchema,
  })
  .superRefine(refineCoordinatePair)

export type LocationFormValues = z.infer<typeof locationFormSchema>

export const areaFormSchema = z.object({
  name: nameSchema('area'),
  locationId: requiredIdSchema('Select a location'),
  description: descriptionSchema,
})

export type AreaFormValues = z.infer<typeof areaFormSchema>

export const MAX_HEAD_COUNT = 100_000

export const jobTitleFormSchema = z
  .object({
    name: nameSchema('job title'),
    limitHeadCount: z.boolean(),
    maxHeadCount: z.string().trim(),
    description: descriptionSchema,
  })
  .superRefine((values, ctx) => {
    if (!values.limitHeadCount) return
    const raw = values.maxHeadCount
    if (raw === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['maxHeadCount'],
        message: 'Enter the maximum head count',
      })
      return
    }
    const count = Number(raw)
    if (!/^\d+$/.test(raw) || count < 1 || count > MAX_HEAD_COUNT) {
      ctx.addIssue({
        code: 'custom',
        path: ['maxHeadCount'],
        message: `Enter a whole number from 1 to ${MAX_HEAD_COUNT.toLocaleString('en-US')}`,
      })
    }
  })

export type JobTitleFormValues = z.infer<typeof jobTitleFormSchema>
