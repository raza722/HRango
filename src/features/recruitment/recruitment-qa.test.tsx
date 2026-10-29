import { screen, within } from '@testing-library/react'
import { addDays, format, subDays } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api-error'
import { applications, offers } from '@/mocks/recruitment/db'
import { renderApp, signIn } from '@/test/test-utils'

import { recruitmentApi } from './api/recruitment.api'
import { liveOfferStatus } from './api/recruitment.mappers'
import {
  applicantFormSchema,
  interviewFormSchema,
  makeHireFormSchema,
  offerFormSchema,
} from './schemas/recruitment-forms.schema'
import { applicantValues, interviewValues, offerValues } from './utils/inputs'

const day = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd')

/** The first message per field of a failed parse. */
function errorsOf(result: {
  success: boolean
  error?: { issues: readonly { path: PropertyKey[]; message: string }[] }
}) {
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [issue.path.join('.'), issue.message]),
  )
}

/** The field errors of a refused call. */
async function refusal(call: Promise<unknown>) {
  try {
    await call
  } catch (error) {
    if (error instanceof ApiError) return { status: error.status, fields: error.fieldErrors }
    throw error
  }
  throw new Error('The call was not refused')
}

describe('Recruitment checks', { timeout: 60_000 }, () => {
  it('names Move Stage’s box and does not offer the current stage', async () => {
    const { user } = renderApp('/recruitment/applications?view=%22503%22')
    const detail = await screen.findByRole(
      'dialog',
      { name: /Bilal Hussain · Senior Software Engineer/ },
      { timeout: 15_000 },
    )
    await user.click(await within(detail).findByRole('button', { name: 'Move Stage' }))
    const move = await screen.findByRole('dialog', { name: 'Move Stage' })
    await user.click(within(move).getByRole('combobox', { name: /^Move to/ }))
    const options = (await screen.findAllByRole('option')).map((option) => option.textContent)
    expect(options).not.toContain('Applied')
    expect(options).toContain('Screening')
  })

  it('refuses offers that join or expire in the past, or expire after joining', () => {
    const base = { ...offerValues(undefined, null), applicationId: '505', offeredSalary: '380000' }
    expect(errorsOf(offerFormSchema.safeParse({ ...base, joiningDate: day(-1) }))).toMatchObject({
      joiningDate: 'Choose today or a later date',
    })
    expect(
      errorsOf(offerFormSchema.safeParse({ ...base, joiningDate: day(20), expiresOn: day(-2) })),
    ).toMatchObject({ expiresOn: 'Choose today or a later date' })
    expect(
      errorsOf(offerFormSchema.safeParse({ ...base, joiningDate: day(20), expiresOn: day(25) })),
    ).toMatchObject({ expiresOn: 'Must be on or before the joining date' })
    expect(
      offerFormSchema.safeParse({ ...base, joiningDate: day(20), expiresOn: day(5) }).success,
    ).toBe(true)
  })

  it('reads a draft or sent offer past its expiry as expired', () => {
    expect(liveOfferStatus('sent', day(-1))).toBe('expired')
    expect(liveOfferStatus('draft', day(-3))).toBe('expired')
    expect(liveOfferStatus('sent', day(0))).toBe('sent')
    expect(liveOfferStatus('accepted', day(-30))).toBe('accepted')
  })

  it('refuses an interview in the past', () => {
    const base = {
      ...interviewValues(undefined, null),
      applicationId: '505',
      time: '10:00',
      durationMinutes: '60',
      interviewerIds: ['em_shelley'],
    }
    expect(errorsOf(interviewFormSchema.safeParse({ ...base, date: day(-1) }))).toMatchObject({
      date: 'Choose today or a later date',
    })
    expect(interviewFormSchema.safeParse({ ...base, date: day(1) }).success).toBe(true)
  })

  it('checks a candidate’s phone and the length of their name', () => {
    const base = {
      ...applicantValues(undefined),
      firstName: 'Sara',
      lastName: 'Khan',
      email: 'sara@example.com',
    }
    expect(errorsOf(applicantFormSchema.safeParse({ ...base, phone: 'abc' }))).toMatchObject({
      phone: 'Enter a valid phone number',
    })
    expect(
      errorsOf(applicantFormSchema.safeParse({ ...base, firstName: 'a'.repeat(150) })),
    ).toMatchObject({ firstName: 'Keep it under 100 characters' })
    expect(applicantFormSchema.safeParse({ ...base, phone: '+92 300 1234567' }).success).toBe(true)
  })

  it('needs a Branch on Hire only when the opening has none', () => {
    const values = {
      code: '',
      joiningDate: day(1),
      branchId: null,
      departmentId: null,
      designationId: null,
      jobTitleId: null,
      employmentTypeId: null,
      lineManagerId: null,
      salary: '',
      status: 'probation' as const,
      probationEndDate: '',
      cnic: '',
      remarks: '',
    }
    expect(errorsOf(makeHireFormSchema({ branchRequired: true }).safeParse(values))).toMatchObject({
      branchId: 'Choose the branch: the opening has none',
    })
    expect(makeHireFormSchema({ branchRequired: false }).safeParse(values).success).toBe(true)
  })

  it('refuses an employee code another employee has (the mock as the API)', async () => {
    signIn()
    // Application 514 has an accepted offer; "Id-001" is Shelley's code on the attendance screens.
    const record = applications.find('514')
    if (!record) throw new Error('No application 514')
    const refused = await refusal(
      recruitmentApi.hireApplication(record, { code: 'id-001', status: 'probation' }),
    )
    expect(refused.status).toBe(422)
    expect(refused.fields.code).toBe('Another employee already has this code.')
    // The directory's own code too.
    const again = await refusal(
      recruitmentApi.hireApplication(record, { code: 'EMP-0001', status: 'probation' }),
    )
    expect(again.fields.code).toBe('Another employee already has this code.')
    expect(applications.find('514')?.stage).not.toBe('hired')
  })

  it('refuses past offer dates and does not send an expired offer (the mock)', async () => {
    signIn()
    const past = await refusal(
      recruitmentApi.createOffer({
        applicationId: '505',
        offeredSalary: 380_000,
        salaryFrequency: 'monthly',
        joiningDate: day(-2),
        expiresOn: day(-5),
      }),
    )
    expect(past.status).toBe(422)
    expect(past.fields).toMatchObject({
      joiningDate: 'Choose today or a later date.',
      expiresOn: 'Choose today or a later date.',
    })

    // Draft 904 past its expiry: listed as expired and not sent.
    const draft = offers.find('904')
    if (!draft) throw new Error('No offer 904')
    offers.update(draft.id, { ...draft, expiresOn: format(subDays(new Date(), 1), 'yyyy-MM-dd') })
    const shown = await recruitmentApi.offer('904')
    expect(shown.status).toBe('expired')
    const send = await refusal(recruitmentApi.sendOffer(shown, null))
    expect(send.status).toBe(409)
  })
})
