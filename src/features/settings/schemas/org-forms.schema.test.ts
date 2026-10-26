import { describe, expect, it } from 'vitest'
import type { z } from 'zod'

import { branchMapper, jobTitleMapper } from '../utils/form-mappers'
import { branchFormSchema, jobTitleFormSchema } from './org-forms.schema'

function issuePaths(schema: z.ZodType, values: unknown): string[] {
  const result = schema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

describe('branchFormSchema', () => {
  const valid = {
    ...branchMapper.empty(),
    name: 'Gulberg Annex',
    locationId: 'lc_lhr',
  }

  it('needs a name and a location; the rest is optional', () => {
    expect(issuePaths(branchFormSchema, valid)).toEqual([])
    expect(issuePaths(branchFormSchema, branchMapper.empty())).toEqual(['name', 'locationId'])
  })

  it('checks coordinate ranges and wants latitude and longitude together', () => {
    expect(issuePaths(branchFormSchema, { ...valid, latitude: '91', longitude: '10' })).toEqual([
      'latitude',
    ])
    expect(issuePaths(branchFormSchema, { ...valid, latitude: '31.5' })).toEqual(['longitude'])
    expect(issuePaths(branchFormSchema, { ...valid, latitude: '31.5', longitude: 'abc' })).toEqual([
      'longitude',
    ])
  })

  it('only allows letters, numbers and dashes in the employee prefix', () => {
    expect(issuePaths(branchFormSchema, { ...valid, employeePrefix: 'TE LHR' })).toEqual([
      'employeePrefix',
    ])
  })

  it('maps empty selects and text to null and upper-cases the prefix', () => {
    const input = branchMapper.toInput({
      ...valid,
      employeePrefix: 'te-lhr',
      latitude: '31.5',
      longitude: '74.3',
    })
    expect(input).toMatchObject({
      employeePrefix: 'TE-LHR',
      areaId: null,
      managerId: null,
      description: null,
      countryId: null,
      stateId: null,
      cityId: null,
      latitude: 31.5,
      longitude: 74.3,
    })
  })
})

describe('jobTitleFormSchema', () => {
  const valid = { ...jobTitleMapper.empty(), name: 'Designer' }

  it('needs Max Head Count only while Limit Head Count is ticked', () => {
    expect(issuePaths(jobTitleFormSchema, valid)).toEqual([])
    expect(issuePaths(jobTitleFormSchema, { ...valid, limitHeadCount: true })).toEqual([
      'maxHeadCount',
    ])
    expect(
      issuePaths(jobTitleFormSchema, { ...valid, limitHeadCount: true, maxHeadCount: '2.5' }),
    ).toEqual(['maxHeadCount'])
    expect(
      issuePaths(jobTitleFormSchema, { ...valid, limitHeadCount: true, maxHeadCount: '12' }),
    ).toEqual([])
  })

  it('drops a leftover cap when the limit is off', () => {
    expect(jobTitleMapper.toInput({ ...valid, maxHeadCount: '12' }).maxHeadCount).toBeNull()
    expect(
      jobTitleMapper.toInput({ ...valid, limitHeadCount: true, maxHeadCount: '12' }).maxHeadCount,
    ).toBe(12)
  })
})
