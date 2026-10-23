import { addDays, format, subDays } from 'date-fns'
import { z } from 'zod'

import type { SalaryRevision } from '@/features/payroll'

import { DIRECTORY } from '../../../employees/seed'
import { payItems, salaryRevisions } from '../../../payroll/db'
import { salaryOn } from '../../../payroll/engine'
import { nextCode } from '../../../payroll/http'
import { profileOf } from '../../../scheduling/seed'
import { jobTitles } from '../../../settings/handlers'
import { createId } from '../../../utils'
import { invalid, today } from '../../http'
import { mustFind } from '../../people'
import {
  defineStandardKind,
  seedRequest,
  type StandardKindServer,
  type StoredStandardRequest,
} from '../engine'

/*
 * Promotion: HR asks to promote (or, with Demotion, to demote) a person
 * ("Create Promotion Request": Employee, Type, Grade, Level, Designation, Job
 * Title, Previous Salary (RS), Salary, Benefits, Effective Date, Attachment,
 * Description). Previous Salary is the person's current salary from Payroll.
 * Approval records the new salary as a Payroll salary revision from the
 * effective date; an approved cancellation removes it again.
 */

const GRADES = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'] as const
const LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5'] as const
const DESIGNATIONS = [
  'Associate',
  'Senior Associate',
  'Team Lead',
  'Assistant Manager',
  'Manager',
  'Senior Manager',
  'Head of Department',
] as const
/** "Benefits (EOBI, Medical)": the pay items they are paid through. */
const BENEFIT_ITEMS = ['pi_eobi', 'pi_medical'] as const

const ymd = /^\d{4}-\d{2}-\d{2}$/
const schema = z.object({
  demotion: z.boolean(),
  grade: z.string().min(1),
  level: z.string().min(1),
  designation: z.string().min(1),
  jobTitle: z.string().trim().min(1).max(80),
  salary: z.number().positive().max(10_000_000),
  benefits: z.array(z.string()).max(BENEFIT_ITEMS.length),
  effectiveDate: z.string().regex(ymd),
  attachment: z.string().max(200).nullable(),
  description: z.string().trim().max(500),
})
type Input = z.infer<typeof schema>

export interface PromotionStored extends Input {
  /** The salary when the request was made ("Previous Salary (RS)"). */
  previousSalary: number
}

const stored = (record: StoredStandardRequest) => record.payload as unknown as PromotionStored

const benefitName = (id: string) => payItems.find(id)?.name ?? id

/** The job titles on the forms: Settings → Job Title and the ones people hold now. */
const jobTitleNames = () =>
  [
    ...new Set([
      ...jobTitles.all().map((item) => item.name),
      ...DIRECTORY.map((employee) => employee.jobTitle),
    ]),
  ].sort((a, b) => a.localeCompare(b))

/** What the person is paid and holds now. */
function currentOf(employeeId: string) {
  const employee = mustFind(employeeId)
  return {
    salary: salaryOn(employeeId, today()),
    grade: profileOf(employee).grade,
    jobTitle: employee.jobTitle,
  }
}

function toPayload(
  input: Input,
  context: {
    employeeId: string
    ignoreId: string | null
    records: readonly StoredStandardRequest[]
  },
): Response | Record<string, unknown> {
  if (!(GRADES as readonly string[]).includes(input.grade)) {
    return invalid('Choose the grade.', { grade: 'Choose the grade' })
  }
  if (!(LEVELS as readonly string[]).includes(input.level)) {
    return invalid('Choose the level.', { level: 'Choose the level' })
  }
  if (!(DESIGNATIONS as readonly string[]).includes(input.designation)) {
    return invalid('Choose the designation.', { designation: 'Choose the designation' })
  }
  if (!jobTitleNames().includes(input.jobTitle)) {
    return invalid('Choose the job title.', { jobTitle: 'Choose the job title' })
  }
  if (input.benefits.some((id) => !(BENEFIT_ITEMS as readonly string[]).includes(id))) {
    return invalid('Choose the benefits from the list.', { benefits: 'Choose from the list' })
  }
  if (input.effectiveDate < today()) {
    return invalid('Choose today or a later day.', {
      effectiveDate: 'Choose today or a later day',
    })
  }
  const previousSalary = currentOf(context.employeeId).salary
  if (!input.demotion && input.salary < previousSalary) {
    return invalid('A promotion does not lower the salary.', {
      salary: `At least ${previousSalary.toLocaleString('en-US')}`,
    })
  }
  if (input.demotion && input.salary > previousSalary) {
    return invalid('A demotion does not raise the salary.', {
      salary: `At most ${previousSalary.toLocaleString('en-US')}`,
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
    ...input,
    benefits: BENEFIT_ITEMS.filter((id) => input.benefits.includes(id)),
    previousSalary,
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
  const revision: SalaryRevision = {
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
    salary: payload.salary,
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
  settingsType: 'promotion',
  codePrefix: 'PR-',
  codeDigits: 4,
  schema,
  toPayload,
  dateOf: (payload) => String(payload.effectiveDate),
  present: (payload) => {
    const value = payload as unknown as PromotionStored
    return {
      ...value,
      benefitNames: value.benefits.map(benefitName),
    }
  },
  filters: {
    designation: (record, value) => stored(record).designation === value,
    grade: (record, value) => stored(record).grade === value,
  },
  lookups: () => ({
    grades: GRADES,
    levels: LEVELS,
    designations: DESIGNATIONS,
    jobTitles: jobTitleNames(),
    benefits: BENEFIT_ITEMS.map((id) => ({ value: id, label: benefitName(id) })),
    /** Each person's salary, grade and job title now ("Previous Salary (RS)"). */
    current: Object.fromEntries(DIRECTORY.map((employee) => [employee.id, currentOf(employee.id)])),
  }),
  cancellationsView: false,
  onCompleted: recordRevision,
  onCancelled: removeRevision,
  seed: () => {
    const day = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd')
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
    const make = (
      key: string,
      employeeId: string,
      change: {
        grade: string
        level: string
        designation: string
        jobTitle?: string
        raise: number
        effectiveIn: number
        demotion?: boolean
        benefits?: string[]
        description?: string
      },
      status: StoredStandardRequest['status'],
      options: { approvedSteps?: number; daysAgo?: number; cancelReason?: string } = {},
    ) => {
      const current = currentOf(employeeId)
      const payload: PromotionStored = {
        demotion: change.demotion ?? false,
        grade: change.grade,
        level: change.level,
        designation: change.designation,
        jobTitle: change.jobTitle ?? current.jobTitle,
        previousSalary: current.salary,
        salary: current.salary + change.raise,
        benefits: change.benefits ?? ['pi_eobi', 'pi_medical'],
        effectiveDate: day(change.effectiveIn),
        attachment: null,
        description: change.description ?? 'Strong results over the last two reviews.',
      }
      return seedRequest(def, {
        id: `pr_${key}`,
        code: `PR-${key.padStart(4, '0')}`,
        employeeId,
        payload: payload as unknown as Record<string, unknown>,
        at: at(options.daysAgo ?? 3),
        status,
        ...(options.approvedSteps !== undefined ? { approvedSteps: options.approvedSteps } : {}),
        ...(options.cancelReason ? { cancelReason: options.cancelReason } : {}),
      })
    }
    return [
      make(
        '001',
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
        '002',
        'em_haroon',
        {
          grade: 'G4',
          level: 'L3',
          designation: 'Team Lead',
          jobTitle: 'Senior Software Engineer',
          raise: 40_000,
          effectiveIn: 25,
        },
        'pending',
        { daysAgo: 2 },
      ),
      make(
        '003',
        'em_rehan',
        { grade: 'G4', level: 'L2', designation: 'Team Lead', raise: 30_000, effectiveIn: 30 },
        'pending',
        { approvedSteps: 1, daysAgo: 2 },
      ),
      make(
        '004',
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
        '005',
        'em_laiba',
        { grade: 'G2', level: 'L3', designation: 'Associate', raise: 15_000, effectiveIn: 18 },
        'cancelling',
        { daysAgo: 6, cancelReason: 'Held until the yearly review.' },
      ),
      make(
        '006',
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
        '007',
        'em_shelley',
        { grade: 'G5', level: 'L3', designation: 'Manager', raise: 0, effectiveIn: 2 },
        'rejected',
        { daysAgo: 30 },
      ),
      make(
        '008',
        'em_mahnoor',
        {
          grade: 'G2',
          level: 'L1',
          designation: 'Associate',
          raise: -10_000,
          effectiveIn: 14,
          demotion: true,
          benefits: ['pi_eobi'],
          description: 'Back to the associate role at her request.',
        },
        'rejected',
        { daysAgo: 4 },
      ),
      make(
        '009',
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
