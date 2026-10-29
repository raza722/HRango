import { addDays, format, subDays } from 'date-fns'
import { z } from 'zod'

import { GRADES, JOB_LEVELS } from '../../../manpower-planning/org-lookups'
import { payItems, salaryRevisions, type StoredSalaryRevision } from '../../../payroll/db'
import { salaryOn } from '../../../payroll/engine'
import { nextCode } from '../../../payroll/http'
import { jobTitles } from '../../../settings/handlers'
import { createId } from '../../../utils'
import type { RequestBodyIn } from '../../backend'
import { invalid, today } from '../../http'
import {
  defineStandardKind,
  seedRequest,
  type StandardKindServer,
  type StoredStandardRequest,
} from '../engine'

/*
 * Promotion (`/requests/promotion`, details = PromotionDetails): HR asks to
 * promote (or, with Demotion, to demote) a person: Grade, Level (optional),
 * Designation, Job Title, new salary, Effective Date, benefit pay items and a
 * description. Promotion is admin only (never for oneself). The previous salary
 * is the person's salary when the request is saved. Approving needs remarks
 * (FRD). Approval records the new salary as a Payroll salary revision from the
 * effective date (the backend's hr.usp_request_apply_promotion changes the
 * employee); an approved cancellation removes it again.
 */

/** The organisation pickers the mock knows (`/organisation/lookups/grades|job-levels|designations`). */
export const PROMOTION_GRADES = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'].map((name) => ({
  id: `gr_${name.toLowerCase()}`,
  name,
}))
export const PROMOTION_LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5'].map((name) => ({
  id: `jl_${name.toLowerCase()}`,
  name,
}))
export const PROMOTION_DESIGNATIONS = [
  'Associate',
  'Senior Associate',
  'Team Lead',
  'Assistant Manager',
  'Manager',
  'Senior Manager',
  'Head of Department',
].map((name) => ({ id: `ds_${name.toLowerCase().replace(/[^a-z]+/g, '_')}`, name }))

const nameIn = (list: readonly { id: string; name: string }[], id: string | null) =>
  id ? (list.find((item) => item.id === id)?.name ?? null) : null

/*
 * The pickers show the shared organisation lists (`/organisation/lookups/grades|job-levels|
 * designations`: the Manpower Planning sample grades and levels, the Settings job titles as
 * designations); the seed's own G1–G6 grades and designations still read for its requests.
 */
const gradeName = (id: string | null) => nameIn(GRADES, id) ?? nameIn(PROMOTION_GRADES, id)
const levelName = (id: string | null) => nameIn(JOB_LEVELS, id) ?? nameIn(PROMOTION_LEVELS, id)
const designationName = (id: string | null) =>
  nameIn(PROMOTION_DESIGNATIONS, id) ?? (id ? (jobTitles.find(id)?.name ?? null) : null)

const ymd = /^\d{4}-\d{2}-\d{2}$/
const id = z.union([z.string(), z.number()]).transform(String)
const schema = z.object({
  isDemotion: z.boolean().default(false),
  gradeId: id,
  jobLevelId: id.nullish(),
  designationId: id,
  jobTitleId: id,
  newSalary: z.number().positive(),
  effectiveDate: z.string().regex(ymd).nullish(),
  benefitPayItemIds: z.array(id).default([]),
  description: z.string().nullish(),
})
type Input = z.infer<typeof schema>

export interface PromotionStored {
  isDemotion: boolean
  gradeId: string
  jobLevelId: string | null
  designationId: string
  jobTitleId: string
  newSalary: number
  effectiveDate: string
  benefitPayItemIds: string[]
  /** The salary when the request was saved ("Previous Salary (RS)"). */
  previousSalary: number | null
  description: string | null
}

const stored = (record: StoredStandardRequest) => record.payload as unknown as PromotionStored

function toPayload(
  input: Input,
  context: {
    employeeId: string
    ignoreId: string | null
    records: readonly StoredStandardRequest[]
  },
): Response | Record<string, unknown> {
  if (!gradeName(input.gradeId)) {
    return invalid('Grade not found.', { gradeId: 'Grade not found.' })
  }
  if (input.jobLevelId && !levelName(input.jobLevelId)) {
    return invalid('Job level not found.', { jobLevelId: 'Job level not found.' })
  }
  if (!designationName(input.designationId)) {
    return invalid('Designation not found.', { designationId: 'Designation not found.' })
  }
  if (!jobTitles.find(input.jobTitleId)) {
    return invalid('Job title not found.', { jobTitleId: 'Job title not found.' })
  }
  if (input.benefitPayItemIds.some((item) => !payItems.find(item))) {
    return invalid('Benefit pay item not found.', {
      benefitPayItemIds: 'Benefit pay item not found.',
    })
  }
  const effectiveDate = input.effectiveDate ?? today()
  const previousSalary = salaryOn(context.employeeId, today())
  if (!input.isDemotion && input.newSalary < previousSalary) {
    return invalid('A promotion cannot lower the salary.', {
      newSalary: 'A promotion cannot lower the salary.',
    })
  }
  if (input.isDemotion && input.newSalary > previousSalary) {
    return invalid('A demotion cannot raise the salary.', {
      newSalary: 'A demotion cannot raise the salary.',
    })
  }
  const open = context.records.find(
    (record) =>
      record.id !== context.ignoreId &&
      record.employeeId === context.employeeId &&
      ['pending', 'cancelling'].includes(record.status),
  )
  if (open) {
    return invalid(`${open.code} for this person is still waiting for approval.`, {
      employeeId: `${open.code} is still waiting`,
    })
  }
  return {
    isDemotion: input.isDemotion,
    gradeId: input.gradeId,
    jobLevelId: input.jobLevelId ?? null,
    designationId: input.designationId,
    jobTitleId: input.jobTitleId,
    newSalary: input.newSalary,
    effectiveDate,
    benefitPayItemIds: [...new Set(input.benefitPayItemIds)],
    previousSalary,
    description: input.description?.trim() ?? null,
  } satisfies PromotionStored
}

/** What approval recorded: the salary revision it added, if any. */
interface Effect {
  revisionId: string | null
}

function recordRevision(record: StoredStandardRequest): Effect {
  const payload = stored(record)
  const clash = salaryRevisions
    .all()
    .find(
      (item) =>
        item.employeeId === record.employeeId && item.effectiveDate === payload.effectiveDate,
    )
  // Payroll keeps one revision per person and day; one already there stays as it is.
  if (clash) return { revisionId: null }
  const dayBefore = format(subDays(new Date(`${payload.effectiveDate}T00:00`), 1), 'yyyy-MM-dd')
  const revision: StoredSalaryRevision = {
    id: createId('sr'),
    code: nextCode(
      'SR-',
      salaryRevisions.all().map((item) => item.code),
    ),
    employeeId: record.employeeId,
    effectiveDate: payload.effectiveDate,
    type: 'flat',
    percentage: null,
    previousSalary: salaryOn(record.employeeId, dayBefore),
    salary: payload.newSalary,
    // Payroll's Salary Revision shows it but leaves it to the promotion (cancel that to undo).
    source: 'promotion',
    sourceCode: record.code,
  }
  salaryRevisions.insert(revision)
  return { revisionId: revision.id }
}

function removeRevision(record: StoredStandardRequest): void {
  const effect = record.effect as Effect | undefined
  if (effect?.revisionId) salaryRevisions.remove(effect.revisionId)
}

const def: StandardKindServer<Input> = {
  kind: 'promotion',
  typeCode: 'promotion',
  typeName: 'Promotion',
  settingsType: 'promotion',
  codePrefix: 'RQ-PRM-',
  codeDigits: 4,
  fromBody: (body: RequestBodyIn) => ({
    ...body.details,
    description: body.description ?? null,
  }),
  schema,
  toPayload,
  dateOf: (payload) => String(payload.effectiveDate),
  header: (payload) => {
    const value = payload as unknown as PromotionStored
    return {
      fromDate: value.effectiveDate,
      toDate: value.effectiveDate,
      days: null,
      reason: null,
      description: value.description,
      application: null,
    }
  },
  toDetails: (payload) => {
    const value = payload as unknown as PromotionStored
    return {
      isDemotion: value.isDemotion,
      gradeId: value.gradeId,
      gradeName: gradeName(value.gradeId),
      jobLevelId: value.jobLevelId,
      jobLevelName: levelName(value.jobLevelId),
      designationId: value.designationId,
      designationName: designationName(value.designationId),
      jobTitleId: value.jobTitleId,
      jobTitleName: jobTitles.find(value.jobTitleId)?.name ?? null,
      previousSalary: value.previousSalary,
      newSalary: value.newSalary,
      effectiveDate: value.effectiveDate,
      benefits: value.benefitPayItemIds.map((payItemId) => ({
        payItemId,
        payItemName: payItems.find(payItemId)?.name ?? null,
      })),
    }
  },
  approveNeedsRemarks: true,
  onCompleted: recordRevision,
  onCancelled: removeRevision,
  seed: () => {
    const day = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd')
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
    const titles = jobTitles.all()
    const make = (
      key: string,
      employeeId: string,
      change: {
        grade: string
        level: string | null
        designation: string
        raise: number
        effectiveIn: number
        demotion?: boolean
        benefits?: string[]
        description?: string
      },
      status: StoredStandardRequest['status'],
      options: { approvedSteps?: number; daysAgo?: number; cancelReason?: string } = {},
    ) => {
      const previousSalary = salaryOn(employeeId, today())
      const payload: PromotionStored = {
        isDemotion: change.demotion ?? false,
        gradeId: `gr_${change.grade.toLowerCase()}`,
        jobLevelId: change.level ? `jl_${change.level.toLowerCase()}` : null,
        designationId:
          PROMOTION_DESIGNATIONS.find((item) => item.name === change.designation)?.id ?? '',
        jobTitleId: titles[Number(key) % Math.max(1, titles.length)]?.id ?? '',
        previousSalary,
        newSalary: previousSalary + change.raise,
        benefitPayItemIds: change.benefits ?? ['pi_medical'],
        effectiveDate: day(change.effectiveIn),
        description: change.description ?? 'Strong results over the last two reviews.',
      }
      return seedRequest(def, {
        id: `pr_${key}`,
        code: `RQ-PRM-${key}`,
        employeeId,
        payload: payload as unknown as Record<string, unknown>,
        at: at(options.daysAgo ?? 3),
        status,
        remarks: 'Well deserved.',
        ...(options.approvedSteps !== undefined ? { approvedSteps: options.approvedSteps } : {}),
        ...(options.cancelReason ? { cancelReason: options.cancelReason } : {}),
      })
    }
    return [
      make(
        '0001',
        'em_sadia',
        {
          grade: 'G3',
          level: 'L2',
          designation: 'Senior Associate',
          raise: 25_000,
          effectiveIn: 20,
        },
        'pending',
        { daysAgo: 1 },
      ),
      make(
        '0002',
        'em_haroon',
        { grade: 'G4', level: 'L3', designation: 'Team Lead', raise: 40_000, effectiveIn: 25 },
        'pending',
        { daysAgo: 2 },
      ),
      make(
        '0003',
        'em_rehan',
        { grade: 'G4', level: 'L2', designation: 'Team Lead', raise: 30_000, effectiveIn: 30 },
        'pending',
        { approvedSteps: 1, daysAgo: 2 },
      ),
      make(
        '0004',
        'em_omer',
        {
          grade: 'G3',
          level: 'L3',
          designation: 'Senior Associate',
          raise: 20_000,
          effectiveIn: 8,
        },
        'completed',
        { daysAgo: 12 },
      ),
      make(
        '0005',
        'em_laiba',
        { grade: 'G2', level: 'L3', designation: 'Associate', raise: 15_000, effectiveIn: 18 },
        'cancelling',
        { daysAgo: 6, cancelReason: 'Held until the yearly review.' },
      ),
      make(
        '0006',
        'em_shelley',
        {
          grade: 'G6',
          level: 'L4',
          designation: 'Senior Manager',
          raise: 60_000,
          effectiveIn: 35,
          description: 'Takes on the regional HR team.',
        },
        'pending',
        { daysAgo: 1 },
      ),
      make(
        '0007',
        'em_mahnoor',
        {
          grade: 'G2',
          level: null,
          designation: 'Associate',
          raise: -10_000,
          effectiveIn: 14,
          demotion: true,
          benefits: [],
          description: 'Back to the associate role at her request.',
        },
        'rejected',
        { daysAgo: 4 },
      ),
      make(
        '0008',
        'em_zainab',
        {
          grade: 'G3',
          level: 'L2',
          designation: 'Senior Associate',
          raise: 18_000,
          effectiveIn: 5,
        },
        'cancelled',
        { daysAgo: 16, cancelReason: 'Moved to another team instead.' },
      ),
    ]
  },
}

export const promotionServer = defineStandardKind(def)
