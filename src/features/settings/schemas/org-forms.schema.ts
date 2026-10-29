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
 * Records belong to the active company, so no form picks a company.
 */

export const branchFormSchema = z
  .object({
    name: nameSchema('branch'),
    employeePrefix: employeePrefixSchema,
    locationId: requiredIdSchema('Select a location'),
    areaId: z.string(),
    managerId: z.string(),
    description: descriptionSchema,
    countryId: z.string(),
    stateId: z.string(),
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

const jobTitleObject = z
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

export const jobTitleFormSchema = jobTitleObject

/** Job Title with the people who hold it now (`held`): the maximum cannot go below them. */
export const makeJobTitleFormSchema = (held: number) =>
  jobTitleObject.superRefine((values, ctx) => {
    const count = Number(values.maxHeadCount)
    if (!values.limitHeadCount || !/^\d+$/.test(values.maxHeadCount) || count >= held) return
    ctx.addIssue({
      code: 'custom',
      path: ['maxHeadCount'],
      message: `${held.toLocaleString('en-US')} ${held === 1 ? 'employee holds' : 'employees hold'} this job title now: enter ${held.toLocaleString('en-US')} or more`,
    })
  })

export type JobTitleFormValues = z.infer<typeof jobTitleObject>
