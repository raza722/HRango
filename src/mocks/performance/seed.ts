import { addDays, format, subDays } from 'date-fns'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { profileOf } from '../scheduling/seed'
import { randomHex } from '../utils'
import { goalsScore, type Level, ratingLabel, reviewScore, suggestedFinal } from './scoring'

/*
 * The Performance mock's sample data, built from the company directory
 * (`mocks/employees/seed.ts`) and dated from today, so statuses stay right whenever it runs:
 * - Shelley Kannes (the signed-in person) has her own goals, a team (the people who report to
 *   her in the directory) and KPIs in her area;
 * - "Annual Review <last year>" is closed with finalised appraisals;
 * - "Annual Review <this year>" is running: Shelley's self review is pending, her team are at
 *   self review, manager review (waiting for her) or reviewed (ready to finalise);
 * - "Probation Reviews <this year>" is a draft without self review.
 */

export const CALLER_ID = 'em_shelley'

export const newRowVersion = () => randomHex(8)

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/** The department id the organisation lookup gives a department name. */
export const departmentIdOf = (name: string) => `dep_${slug(name)}`

export const DEPARTMENTS = new Map(
  [...new Set(DIRECTORY.map((person) => person.department))].map((name) => [
    departmentIdOf(name),
    name,
  ]),
)

/** Who reviews whom: the directory's line manager, else the department head. */
const HEADS: Record<string, string> = {
  Software: 'em_bilal',
  'Mobile App': 'em_saad',
  Sales: 'em_sara',
  Marketing: 'em_jack',
  Physiotherapy: 'em_hamda',
  Surgery: 'em_kamal',
  Operations: 'em_ayesha',
  Finance: 'em_hina',
  'Human Resource Management': CALLER_ID,
}
const REVIEWER_OVERRIDES: Record<string, string | null> = {
  em_shelley: 'em_daniel',
  em_bilal: 'em_ayesha',
  em_sara: 'em_daniel',
  em_daniel: null,
  em_saad: 'em_bilal',
}

export function reviewerOf(employeeId: string): string | null {
  if (employeeId in REVIEWER_OVERRIDES) return REVIEWER_OVERRIDES[employeeId] ?? null
  const employee = findEmployee(employeeId)
  if (!employee) return null
  const manager = profileOf(employee).managerId
  if (manager && manager !== employeeId) return manager
  const head = HEADS[employee.department]
  return head && head !== employeeId ? head : CALLER_ID
}

/** The person fields the API puts on goals and appraisals. */
export function personOf(employeeId: string) {
  const employee = findEmployee(employeeId)
  return {
    employeeId,
    employeeCode: employee ? profileOf(employee).code : null,
    employeeName: employee?.name ?? 'Unknown',
    departmentId: employee ? departmentIdOf(employee.department) : null,
    departmentName: employee?.department ?? null,
    jobTitleName: employee?.jobTitle ?? null,
  }
}

export const isWorking = (employeeId: string) => {
  const employee = findEmployee(employeeId)
  return employee ? profileOf(employee).status === 'active' : false
}

// --- records ----------------------------------------------------------------------------------

interface Stamped {
  id: string
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface ScaleRec extends Stamped {
  name: string
  isDefault: boolean
  isActive: boolean
  levels: Level[]
}

export interface CriterionRec {
  id: string
  kpiId: string | null
  name: string
  description: string | null
  weight: number
  sortOrder: number
}

export interface FormRec extends Stamped {
  name: string
  description: string | null
  ratingScaleId: string
  goalsWeight: number
  hasSelfReview: boolean
  isActive: boolean
  criteria: CriterionRec[]
}

export interface KpiRec extends Stamped {
  name: string
  keyResultArea: string | null
  description: string | null
  measureType: string
  targetValue: number | null
  unit: string | null
  defaultWeight: number | null
  departmentId: string | null
  jobTitleId: string | null
  isActive: boolean
}

export interface CycleRec extends Stamped {
  name: string
  appraisalFormId: string
  startDate: string
  endDate: string
  selfReviewDueDate: string | null
  managerReviewDueDate: string | null
  status: 'draft' | 'active' | 'closed'
  launchedAt: string | null
  closedAt: string | null
}

export interface RatingRec {
  criterionId: string
  selfRating: number | null
  selfComment: string | null
  managerRating: number | null
  managerComment: string | null
}

export interface IncrementRec {
  id: string
  changeType: 'flat' | 'percent'
  changeValue: number
  effectiveDate: string
  status: 'proposed' | 'applied' | 'rejected'
}

export interface AppraisalRec extends Stamped {
  cycleId: string
  employeeId: string
  reviewerEmployeeId: string | null
  status: 'draft' | 'self_review' | 'manager_review' | 'reviewed' | 'finalised'
  ratings: RatingRec[]
  selfComments: string | null
  managerComments: string | null
  finalComments: string | null
  developmentNeeds: string | null
  finalScore: number | null
  finalRatingLabel: string | null
  outcome: 'no_change' | 'increment' | 'promotion' | 'improvement_plan' | null
  selfSubmittedAt: string | null
  managerSubmittedAt: string | null
  finalisedAt: string | null
  increment: IncrementRec | null
}

export interface CheckInRec {
  id: string
  progress: number
  actualValue: number | null
  status: string
  comments: string | null
  createdAt: string
  createdByName: string | null
}

export interface GoalRec extends Stamped {
  employeeId: string
  appraisalCycleId: string | null
  kpiId: string | null
  title: string
  description: string | null
  startDate: string | null
  dueDate: string
  weight: number
  targetValue: number | null
  actualValue: number | null
  progress: number
  status: 'not_started' | 'in_progress' | 'completed' | 'cancelled'
  completedAt: string | null
  checkIns: CheckInRec[]
}

// --- dates ------------------------------------------------------------------------------------

const day = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd')
const stamp = (offset: number, hour = 10) => {
  const date = subDays(new Date(), -offset)
  date.setUTCHours(hour, 0, 0, 0)
  return date.toISOString()
}
const year = () => new Date().getFullYear()
const stamped = (createdOffset: number): Stamped & { id: '' } => ({
  id: '',
  createdAt: stamp(createdOffset),
  updatedAt: null,
  rowVersion: newRowVersion(),
})

// --- scales and forms -------------------------------------------------------------------------

export const FIVE_POINT: Level[] = [
  { score: 1, label: 'Unsatisfactory', description: 'Falls well short of what the role needs.' },
  { score: 2, label: 'Needs Improvement', description: 'Meets some expectations; must improve.' },
  { score: 3, label: 'Meets Expectations', description: 'Does what the role needs, reliably.' },
  { score: 4, label: 'Exceeds Expectations', description: 'Often goes beyond the role.' },
  { score: 5, label: 'Outstanding', description: 'A model for others in every respect.' },
]

export function seedScales(): ScaleRec[] {
  return [
    {
      ...stamped(-700),
      id: 'ps_five',
      name: 'Five-Point Scale',
      isDefault: true,
      isActive: true,
      levels: FIVE_POINT,
    },
  ]
}

const criterion = (
  id: string,
  name: string,
  weight: number,
  sortOrder: number,
  description: string,
  kpiId: string | null = null,
): CriterionRec => ({ id, kpiId, name, description, weight, sortOrder })

export const ANNUAL_CRITERIA = [
  criterion('cr_an_knowledge', 'Job Knowledge', 25, 1, 'Knows the role, its tools and rules.'),
  criterion(
    'cr_an_quality',
    'Quality of Work',
    25,
    2,
    'Accurate, thorough, done right first time.',
  ),
  criterion('cr_an_comm', 'Communication', 20, 3, 'Clear in writing and in person; listens.'),
  criterion(
    'cr_an_team',
    'Teamwork',
    15,
    4,
    'Helps colleagues and shares what they know.',
    'pk_engagement',
  ),
  criterion('cr_an_initiative', 'Initiative', 15, 5, 'Spots what needs doing and does it.'),
]

const PROBATION_CRITERIA = [
  criterion('cr_pr_punctuality', 'Attendance and Punctuality', 30, 1, 'On time, rarely absent.'),
  criterion('cr_pr_learning', 'Learning the Role', 40, 2, 'Picks up the work and the tools.'),
  criterion('cr_pr_conduct', 'Conduct', 30, 3, 'Follows the code of conduct and policies.'),
]

export function seedForms(): FormRec[] {
  return [
    {
      ...stamped(-700),
      id: 'pf_annual',
      name: 'Annual Performance Review',
      description: 'The yearly review: criteria ratings by the employee and the line manager.',
      ratingScaleId: 'ps_five',
      goalsWeight: 40,
      hasSelfReview: true,
      isActive: true,
      criteria: ANNUAL_CRITERIA,
    },
    {
      ...stamped(-400),
      id: 'pf_probation',
      name: 'Probation Review',
      description: 'End-of-probation check by the line manager only.',
      ratingScaleId: 'ps_five',
      goalsWeight: 0,
      hasSelfReview: false,
      isActive: true,
      criteria: PROBATION_CRITERIA,
    },
  ]
}

// --- KPIs -------------------------------------------------------------------------------------

const kpi = (
  id: string,
  name: string,
  keyResultArea: string,
  description: string,
  measureType: string,
  targetValue: number | null,
  unit: string | null,
  defaultWeight: number,
  department: string | null,
  jobTitleId: string | null = null,
  isActive = true,
): KpiRec => ({
  ...stamped(-300),
  id,
  name,
  keyResultArea,
  description,
  measureType,
  targetValue,
  unit,
  defaultWeight,
  departmentId: department ? departmentIdOf(department) : null,
  jobTitleId,
  isActive,
})

const HR = 'Human Resource Management'

export function seedKpis(): KpiRec[] {
  return [
    kpi(
      'pk_time_to_hire',
      'Time to Hire',
      'Recruitment',
      'Average days from opening a position to an accepted offer.',
      'number',
      30,
      'days',
      20,
      HR,
      'jt_hrm',
    ),
    kpi(
      'pk_retention',
      'Employee Retention Rate',
      'People',
      'Share of staff still employed twelve months later.',
      'percentage',
      92,
      '%',
      25,
      HR,
      'jt_hrm',
    ),
    kpi(
      'pk_training',
      'Training Hours per Employee',
      'Learning',
      'Hours of training each employee completes in the year.',
      'number',
      24,
      'hours',
      15,
      HR,
    ),
    kpi(
      'pk_engagement',
      'Engagement Survey Score',
      'People',
      'Average score of the yearly engagement survey.',
      'rating',
      4,
      '/ 5',
      15,
      null,
    ),
    kpi(
      'pk_payroll_on_time',
      'On-time Payroll',
      'Payroll',
      'Payroll closed and paid by the 1st of every month.',
      'yes_no',
      1,
      null,
      20,
      'Finance',
      'jt_acc',
    ),
    kpi(
      'pk_revenue',
      'Sales Revenue',
      'Revenue',
      'Booked revenue against the yearly target.',
      'amount',
      25_000_000,
      'PKR',
      40,
      'Sales',
    ),
    kpi(
      'pk_csat',
      'Customer Satisfaction',
      'Customers',
      'Average rating customers give after a sale or a support call.',
      'rating',
      4.5,
      '/ 5',
      20,
      'Sales',
    ),
    kpi(
      'pk_defects',
      'Release Defect Rate',
      'Quality',
      'Defects found after release per 100 tickets delivered.',
      'percentage',
      2,
      '%',
      25,
      'Software',
      'jt_swe',
    ),
    kpi(
      'pk_sprint',
      'Sprint Commitment Met',
      'Delivery',
      'Share of committed sprint work delivered.',
      'percentage',
      90,
      '%',
      25,
      'Software',
      'jt_sse',
    ),
    kpi(
      'pk_audit',
      'Policy Audit Findings',
      'Compliance',
      'Open findings from the quarterly policy audit.',
      'number',
      0,
      'findings',
      10,
      'Operations',
      null,
      false,
    ),
  ]
}

// --- cycles -----------------------------------------------------------------------------------

export const PREVIOUS_CYCLE = 'pc_previous'
export const CURRENT_CYCLE = 'pc_current'
export const PROBATION_CYCLE = 'pc_probation'

export function seedCycles(): CycleRec[] {
  const y = year()
  return [
    {
      ...stamped(-330),
      id: PREVIOUS_CYCLE,
      name: `Annual Review ${String(y - 1)}`,
      appraisalFormId: 'pf_annual',
      startDate: `${String(y - 1)}-01-01`,
      endDate: `${String(y - 1)}-12-31`,
      selfReviewDueDate: `${String(y)}-01-15`,
      managerReviewDueDate: `${String(y)}-01-31`,
      status: 'closed',
      launchedAt: `${String(y - 1)}-12-01T09:00:00Z`,
      closedAt: `${String(y)}-02-10T09:00:00Z`,
    },
    {
      ...stamped(-40),
      id: CURRENT_CYCLE,
      name: `Annual Review ${String(y)}`,
      appraisalFormId: 'pf_annual',
      startDate: `${String(y)}-01-01`,
      endDate: `${String(y)}-12-31`,
      selfReviewDueDate: day(10),
      managerReviewDueDate: day(24),
      status: 'active',
      launchedAt: stamp(-14),
      closedAt: null,
    },
    {
      ...stamped(-5),
      id: PROBATION_CYCLE,
      name: `Probation Reviews ${String(y)}`,
      appraisalFormId: 'pf_probation',
      startDate: day(-30),
      endDate: day(60),
      selfReviewDueDate: null,
      managerReviewDueDate: day(45),
      status: 'draft',
      launchedAt: null,
      closedAt: null,
    },
  ]
}

// --- goals ------------------------------------------------------------------------------------

let goalCount = 0
const checkIn = (
  offset: number,
  progress: number,
  comments: string,
  by: string,
  status = progress >= 100 ? 'completed' : 'in_progress',
  actualValue: number | null = null,
): CheckInRec => ({
  id: `ci_${String((goalCount += 1))}`,
  progress,
  actualValue,
  status,
  comments,
  createdAt: stamp(offset, 11),
  createdByName: findEmployee(by)?.name ?? null,
})

interface GoalSeed {
  id: string
  employeeId: string
  cycle?: string | null
  kpiId?: string | null
  title: string
  description?: string
  start?: string | null
  due: string
  weight: number
  target?: number | null
  actual?: number | null
  progress: number
  status: GoalRec['status']
  completed?: number
  checkIns?: CheckInRec[]
}

const goal = (seed: GoalSeed): GoalRec => ({
  ...stamped(-120),
  id: seed.id,
  employeeId: seed.employeeId,
  appraisalCycleId: seed.cycle === undefined ? CURRENT_CYCLE : seed.cycle,
  kpiId: seed.kpiId ?? null,
  title: seed.title,
  description: seed.description ?? null,
  startDate: seed.start === undefined ? `${String(year())}-01-15` : seed.start,
  dueDate: seed.due,
  weight: seed.weight,
  targetValue: seed.target ?? null,
  actualValue: seed.actual ?? null,
  progress: seed.progress,
  status: seed.status,
  completedAt: seed.completed === undefined ? null : stamp(seed.completed),
  checkIns: seed.checkIns ?? [],
})

export function seedGoals(): GoalRec[] {
  goalCount = 0
  const y = year()
  const last = String(y - 1)
  const me = CALLER_ID
  return [
    // Shelley Kannes, this year.
    goal({
      id: 'pg_time_to_hire',
      employeeId: me,
      kpiId: 'pk_time_to_hire',
      title: 'Cut time to hire to 30 days',
      description: 'Shorter screening, interview slots booked in the first week.',
      due: day(48),
      weight: 30,
      target: 30,
      actual: 34,
      progress: 70,
      status: 'in_progress',
      checkIns: [
        checkIn(-60, 40, 'Two recruiters onboarded; average is 41 days.', me, 'in_progress', 41),
        checkIn(-20, 70, 'Screening templates live; down to 34 days.', me, 'in_progress', 34),
      ],
    }),
    goal({
      id: 'pg_appraisal_process',
      employeeId: me,
      title: 'Roll out the new appraisal process',
      description: 'Forms, rating scale and the yearly cycle in hRango.',
      due: day(-30),
      weight: 20,
      progress: 100,
      status: 'completed',
      completed: -35,
      checkIns: [
        checkIn(-90, 50, 'Forms and rating scale agreed with the leadership team.', me),
        checkIn(-35, 100, 'Annual cycle launched for every department.', me),
      ],
    }),
    goal({
      id: 'pg_retention',
      employeeId: me,
      kpiId: 'pk_retention',
      title: 'Raise staff retention to 92%',
      due: day(64),
      weight: 25,
      target: 92,
      actual: 89,
      progress: 60,
      status: 'in_progress',
      checkIns: [
        checkIn(-30, 60, 'Stay interviews done in three departments.', me, 'in_progress', 89),
      ],
    }),
    goal({
      id: 'pg_training_hours',
      employeeId: me,
      kpiId: 'pk_training',
      title: 'Deliver 24 training hours per employee',
      due: day(-13),
      weight: 15,
      target: 24,
      actual: 10,
      progress: 42,
      status: 'in_progress',
      checkIns: [
        checkIn(-40, 42, 'Q3 workshops done; Q4 calendar pending.', me, 'in_progress', 10),
      ],
    }),
    goal({
      id: 'pg_handbook',
      employeeId: me,
      title: 'Publish the HR policy handbook',
      due: day(53),
      weight: 10,
      progress: 0,
      status: 'not_started',
    }),
    goal({
      id: 'pg_chatbot',
      employeeId: me,
      cycle: null,
      title: 'Launch the HR helpdesk chatbot',
      description: 'Dropped: the vendor contract was not renewed.',
      due: day(90),
      weight: 5,
      progress: 20,
      status: 'cancelled',
      checkIns: [checkIn(-50, 20, 'Cancelled with the vendor contract.', me, 'cancelled')],
    }),
    // Shelley Kannes, last year (closed cycle: locked).
    goal({
      id: 'pg_digitise_files',
      employeeId: me,
      cycle: PREVIOUS_CYCLE,
      title: 'Digitise the employee files',
      start: `${last}-02-01`,
      due: `${last}-11-30`,
      weight: 50,
      progress: 100,
      status: 'completed',
      completed: -340,
    }),
    goal({
      id: 'pg_engagement_survey',
      employeeId: me,
      cycle: PREVIOUS_CYCLE,
      kpiId: 'pk_engagement',
      title: 'Run the engagement survey',
      start: `${last}-03-01`,
      due: `${last}-09-30`,
      weight: 50,
      target: 4,
      actual: 4.1,
      progress: 100,
      status: 'completed',
      completed: -400,
    }),
    // Her team.
    goal({
      id: 'pg_kaleem_tickets',
      employeeId: 'em_kaleem',
      title: 'Close HR tickets within 3 days',
      due: day(20),
      weight: 40,
      progress: 55,
      status: 'in_progress',
      checkIns: [checkIn(-15, 55, 'Average is 4.1 days, down from 6.', 'em_kaleem')],
    }),
    goal({
      id: 'pg_kaleem_cleanup',
      employeeId: 'em_kaleem',
      title: 'Complete the HRMS data clean-up',
      due: day(-10),
      weight: 30,
      progress: 100,
      status: 'completed',
      completed: -12,
    }),
    goal({
      id: 'pg_kaleem_sports',
      employeeId: 'em_kaleem',
      title: 'Organise the annual sports day',
      due: day(-5),
      weight: 30,
      progress: 0,
      status: 'not_started',
    }),
    goal({
      id: 'pg_kaleem_leave_policy',
      employeeId: 'em_kaleem',
      cycle: PREVIOUS_CYCLE,
      title: 'Update the leave policy',
      start: `${last}-01-15`,
      due: `${last}-10-31`,
      weight: 100,
      progress: 80,
      status: 'in_progress',
    }),
    goal({
      id: 'pg_sadia_onboarding',
      employeeId: 'em_sadia',
      title: 'Run monthly onboarding sessions',
      due: day(40),
      weight: 50,
      progress: 75,
      status: 'in_progress',
    }),
    goal({
      id: 'pg_sadia_payroll_queries',
      employeeId: 'em_sadia',
      title: 'Reduce payroll queries by 20%',
      due: day(15),
      weight: 50,
      target: 20,
      actual: 6,
      progress: 30,
      status: 'in_progress',
      checkIns: [
        checkIn(-25, 30, 'FAQ page published; queries down 6%.', 'em_sadia', 'in_progress', 6),
      ],
    }),
    goal({
      id: 'pg_laiba_engineers',
      employeeId: 'em_laiba',
      kpiId: 'pk_time_to_hire',
      title: 'Fill 12 engineering roles',
      due: day(60),
      weight: 60,
      target: 12,
      actual: 6,
      progress: 50,
      status: 'in_progress',
    }),
    goal({
      id: 'pg_laiba_campus',
      employeeId: 'em_laiba',
      title: 'Build a campus hiring pipeline',
      due: day(30),
      weight: 40,
      progress: 0,
      status: 'not_started',
    }),
    goal({
      id: 'pg_ayesha_costs',
      employeeId: 'em_ayesha',
      title: 'Cut branch operating costs by 5%',
      due: day(-20),
      weight: 50,
      progress: 100,
      status: 'completed',
      completed: -22,
    }),
    goal({
      id: 'pg_ayesha_branch',
      employeeId: 'em_ayesha',
      title: 'Open the Rawalpindi branch',
      due: day(25),
      weight: 50,
      progress: 85,
      status: 'in_progress',
    }),
    goal({
      id: 'pg_hina_close',
      employeeId: 'em_hina',
      kpiId: 'pk_payroll_on_time',
      title: 'Close the books by the 5th each month',
      due: day(60),
      weight: 100,
      progress: 90,
      status: 'in_progress',
    }),
    // Other teams.
    goal({
      id: 'pg_bilal_defects',
      employeeId: 'em_bilal',
      kpiId: 'pk_defects',
      title: 'Lower release defects below 2%',
      due: day(60),
      weight: 50,
      target: 2,
      actual: 2.6,
      progress: 65,
      status: 'in_progress',
    }),
    goal({
      id: 'pg_bilal_sprints',
      employeeId: 'em_bilal',
      kpiId: 'pk_sprint',
      title: 'Meet 90% of sprint commitments',
      due: day(45),
      weight: 50,
      target: 90,
      actual: 86,
      progress: 80,
      status: 'in_progress',
    }),
    goal({
      id: 'pg_haroon_app',
      employeeId: 'em_haroon',
      title: 'Ship the attendance mobile app',
      due: day(35),
      weight: 100,
      progress: 70,
      status: 'in_progress',
    }),
  ]
}

// --- appraisals -------------------------------------------------------------------------------

const ratings = (
  self: readonly (number | null)[],
  manager: readonly (number | null)[],
  selfNote?: string,
  managerNote?: string,
): RatingRec[] =>
  ANNUAL_CRITERIA.map((item, index) => ({
    criterionId: item.id,
    selfRating: self[index] ?? null,
    selfComment: index === 0 && selfNote ? selfNote : null,
    managerRating: manager[index] ?? null,
    managerComment: index === 0 && managerNote ? managerNote : null,
  }))

interface AppraisalSeed {
  id: string
  cycleId: string
  employeeId: string
  status: AppraisalRec['status']
  ratings?: RatingRec[]
  selfComments?: string
  managerComments?: string
  developmentNeeds?: string
  selfSubmitted?: number
  managerSubmitted?: number
  outcome?: AppraisalRec['outcome']
  finalComments?: string
  increment?: IncrementRec
}

/** Builds an appraisal; finalised ones get the final score the rules give. */
function appraisal(seed: AppraisalSeed, goals: readonly GoalRec[]): AppraisalRec {
  const rows = seed.ratings ?? []
  let finalScore: number | null = null
  if (seed.status === 'finalised') {
    const manager = reviewScore(
      rows.map((row) => ({
        weight: ANNUAL_CRITERIA.find((item) => item.id === row.criterionId)?.weight ?? 0,
        rating: row.managerRating,
      })),
    )
    const own = goals.filter(
      (item) => item.employeeId === seed.employeeId && item.appraisalCycleId === seed.cycleId,
    )
    finalScore = suggestedFinal(40, goalsScore(own, FIVE_POINT), manager)
  }
  const y = year()
  return {
    ...stamped(seed.cycleId === PREVIOUS_CYCLE ? -330 : -14),
    id: seed.id,
    cycleId: seed.cycleId,
    employeeId: seed.employeeId,
    reviewerEmployeeId: reviewerOf(seed.employeeId),
    status: seed.status,
    ratings: rows,
    selfComments: seed.selfComments ?? null,
    managerComments: seed.managerComments ?? null,
    finalComments: seed.finalComments ?? null,
    developmentNeeds: seed.developmentNeeds ?? null,
    finalScore,
    finalRatingLabel: ratingLabel(FIVE_POINT, finalScore),
    outcome: seed.status === 'finalised' ? (seed.outcome ?? 'no_change') : null,
    selfSubmittedAt: seed.selfSubmitted === undefined ? null : stamp(seed.selfSubmitted),
    managerSubmittedAt: seed.managerSubmitted === undefined ? null : stamp(seed.managerSubmitted),
    finalisedAt: seed.status === 'finalised' ? `${String(y)}-02-05T09:00:00Z` : null,
    increment: seed.increment ?? null,
  }
}

export function seedAppraisals(goals: readonly GoalRec[] = seedGoals()): AppraisalRec[] {
  const y = String(year())
  const past = (seed: Omit<AppraisalSeed, 'cycleId' | 'status'>) =>
    appraisal({ ...seed, cycleId: PREVIOUS_CYCLE, status: 'finalised', selfSubmitted: -290 }, goals)
  const now = (seed: Omit<AppraisalSeed, 'cycleId'>) =>
    appraisal({ ...seed, cycleId: CURRENT_CYCLE }, goals)
  return [
    // Last year: every appraisal finalised.
    past({
      id: 'pa_prev_shelley',
      employeeId: CALLER_ID,
      ratings: ratings([4, 5, 4, 4, 4], [4, 5, 4, 4, 5]),
      selfComments: 'A big year for HR: files digitised and the first engagement survey run.',
      managerComments: 'Delivered both goals early and set up the survey well.',
      managerSubmitted: -280,
      outcome: 'increment',
      finalComments: 'Increment of 12% from March.',
      increment: {
        id: 'pi_prev_shelley',
        changeType: 'percent',
        changeValue: 12,
        effectiveDate: `${y}-03-01`,
        status: 'applied',
      },
    }),
    past({
      id: 'pa_prev_kaleem',
      employeeId: 'em_kaleem',
      ratings: ratings([4, 3, 3, 4, 3], [3, 3, 3, 4, 3]),
      managerComments: 'Solid year; the leave policy slipped.',
      managerSubmitted: -282,
    }),
    past({
      id: 'pa_prev_sadia',
      employeeId: 'em_sadia',
      ratings: ratings([4, 4, 3, 4, 3], [4, 3, 3, 4, 3]),
      managerComments: 'Reliable and well liked by new joiners.',
      managerSubmitted: -283,
      outcome: 'increment',
      increment: {
        id: 'pi_prev_sadia',
        changeType: 'percent',
        changeValue: 8,
        effectiveDate: `${y}-03-01`,
        status: 'applied',
      },
    }),
    past({
      id: 'pa_prev_ayesha',
      employeeId: 'em_ayesha',
      ratings: ratings([5, 4, 5, 4, 5], [5, 4, 5, 5, 5]),
      managerComments: 'Ran operations across three branches without a gap.',
      managerSubmitted: -284,
      outcome: 'promotion',
      finalComments: 'Promoted to Operations Manager.',
    }),
    past({
      id: 'pa_prev_bilal',
      employeeId: 'em_bilal',
      ratings: ratings([3, 3, 4, 4, 3], [3, 4, 4, 4, 3]),
      managerSubmitted: -285,
    }),
    // This year.
    now({ id: 'pa_shelley', employeeId: CALLER_ID, status: 'self_review' }),
    now({
      id: 'pa_kaleem',
      employeeId: 'em_kaleem',
      status: 'manager_review',
      ratings: ratings([4, 4, 3, 4, 3], [], 'Cleaned up the HRMS data on my own.'),
      selfComments: 'The data clean-up took longer than planned but is done.',
      selfSubmitted: -3,
    }),
    now({
      id: 'pa_sadia',
      employeeId: 'em_sadia',
      status: 'manager_review',
      ratings: ratings([4, 4, 4, 5, 3], [], 'Ran every onboarding session this year.'),
      selfComments: 'Onboarding feedback averaged 4.6 out of 5.',
      selfSubmitted: -2,
    }),
    now({ id: 'pa_laiba', employeeId: 'em_laiba', status: 'self_review' }),
    now({
      id: 'pa_ayesha',
      employeeId: 'em_ayesha',
      status: 'reviewed',
      ratings: ratings(
        [5, 4, 4, 5, 5],
        [5, 4, 5, 5, 4],
        undefined,
        'Opened the new branch on time.',
      ),
      selfComments: 'Costs are down 5% and the Rawalpindi branch is nearly ready.',
      managerComments: 'Another excellent year.',
      developmentNeeds: 'A finance course before she takes on the budget.',
      selfSubmitted: -8,
      managerSubmitted: -1,
    }),
    now({
      id: 'pa_hina',
      employeeId: 'em_hina',
      status: 'manager_review',
      ratings: ratings([4, 4, 3, 3, 4], []),
      selfSubmitted: -4,
    }),
    now({ id: 'pa_bilal', employeeId: 'em_bilal', status: 'self_review' }),
    now({
      id: 'pa_haroon',
      employeeId: 'em_haroon',
      status: 'manager_review',
      ratings: ratings([3, 4, 3, 4, 4], []),
      selfSubmitted: -6,
    }),
    now({ id: 'pa_maryam', employeeId: 'em_maryam', status: 'self_review' }),
    // The draft probation cycle: one participant, not launched.
    appraisal(
      {
        id: 'pa_probation_rabia',
        cycleId: PROBATION_CYCLE,
        employeeId: 'em_rabia',
        status: 'draft',
      },
      goals,
    ),
  ]
}
