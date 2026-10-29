import { addDays, format, setHours, setMinutes, startOfDay } from 'date-fns'

import { departmentId } from '../payroll/lookup-handlers'
import { designationIdOf } from '../talent-management/seed'
import { randomHex } from '../utils'

/*
 * Seed of the Recruitment mock: six openings in every status, fourteen candidates and sixteen
 * applications spread over the pipeline, past and upcoming interviews with evaluations, offers
 * (draft, sent, accepted) and the rejection reasons. Dates are relative to today, so the board
 * and the dashboard always have something current. People (hiring managers, interviewers,
 * referrers) are the shared directory's (`mocks/employees/seed.ts`); organisation ids are the
 * ones the app's pickers hand out (Settings branches and job titles, Payroll's departments).
 * Ids are numeric strings, as the API's are.
 */

export interface OpeningRec {
  id: string
  code: string
  title: string
  status: 'draft' | 'open' | 'on_hold' | 'closed'
  openPositionId: string | null
  jobTitleId: string | null
  designationId: string | null
  departmentId: string | null
  branchId: string | null
  employmentTypeId: string | null
  hiringManagerId: string | null
  cityId: string | null
  workMode: 'on_site' | 'remote' | 'hybrid' | null
  experienceFromYears: number | null
  experienceToYears: number | null
  vacancies: number
  postedOn: string | null
  applyBy: string | null
  closeOn: string | null
  salaryFrom: number | null
  salaryTo: number | null
  isSalaryVisible: boolean
  description: string | null
  requirements: string | null
  publishedAt: string | null
  closedAt: string | null
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface ApplicantRec {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  gender: 'male' | 'female' | 'other' | null
  dateOfBirth: string | null
  cityId: string | null
  address: string | null
  currentEmployer: string | null
  currentJobTitle: string | null
  experienceYears: number | null
  currentSalary: number | null
  expectedSalary: number | null
  noticePeriodDays: number | null
  highestEducation: string | null
  linkedinUrl: string | null
  source: string | null
  referredByEmployeeId: string | null
  cvFileId: string | null
  /** The seeded CV's name (uploads are named by the files mock). */
  cvName: string | null
  notes: string | null
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export type StageValue =
  | 'applied'
  | 'screening'
  | 'shortlisted'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'rejected'
  | 'withdrawn'

export interface ApplicationRec {
  id: string
  jobOpeningId: string
  applicantId: string
  appliedOn: string
  source: string | null
  coverLetter: string | null
  stage: StageValue
  stageChangedAt: string
  rejectionReasonId: string | null
  rejectedStage: StageValue | null
  remarks: string | null
  employeeId: string | null
  hiredAt: string | null
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface HistoryRec {
  id: string
  applicationId: string
  fromStage: StageValue | null
  toStage: StageValue
  changedAt: string
  changedByName: string | null
  remarks: string | null
}

export interface InterviewRec {
  id: string
  applicationId: string
  roundNo: number
  title: string
  mode: 'in_person' | 'phone' | 'video'
  scheduledAt: string
  durationMinutes: number
  venue: string | null
  status: 'scheduled' | 'completed' | 'no_show' | 'cancelled'
  result: 'passed' | 'failed' | 'on_hold' | null
  remarks: string | null
  interviewerIds: string[]
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface EvaluationRec {
  id: string
  interviewId: string
  employeeId: string
  rating: number
  recommendation: 'strong_hire' | 'hire' | 'no_hire' | 'strong_no_hire'
  strengths: string | null
  concerns: string | null
  comments: string | null
  evaluatedAt: string
  evaluatedByName: string | null
  rowVersion: string
}

export interface OfferRec {
  id: string
  applicationId: string
  jobTitleId: string | null
  designationId: string | null
  departmentId: string | null
  branchId: string | null
  employmentTypeId: string | null
  offeredSalary: number
  salaryFrequency: 'monthly' | 'daily' | 'hourly'
  joiningDate: string
  probationMonths: number | null
  expiresOn: string | null
  offerLetterFileId: string | null
  offerLetterName: string | null
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'withdrawn' | 'expired'
  sentAt: string | null
  respondedAt: string | null
  responseRemarks: string | null
  remarks: string | null
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface ReasonRec {
  id: string
  name: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** A fresh row version (hex, as the API's). */
export const nextRowVersion = () => randomHex(8)

/** Who the mock says did things: the demo user. */
export const ACTOR = 'Shelley Kannes'
export const ACTOR_EMPLOYEE_ID = 'em_shelley'

const DAY = 'yyyy-MM-dd'
const today = () => startOfDay(new Date())
/** `yyyy-MM-dd`, `offset` days from today. */
export const dayFrom = (offset: number) => format(addDays(today(), offset), DAY)
/** An ISO instant `offset` days from today at `hour:minute` local time. */
export const at = (offset: number, hour = 9, minute = 0) =>
  setMinutes(setHours(addDays(today(), offset), hour), minute).toISOString()

// --- rejection reasons --------------------------------------------------------------------------

export function seedReasons(): ReasonRec[] {
  const reason = (id: number, name: string, isActive = true): ReasonRec => ({
    id: String(id),
    name,
    isActive,
    sortOrder: id,
    createdAt: at(-120),
    updatedAt: null,
    rowVersion: nextRowVersion(),
  })
  return [
    reason(1, 'Not enough experience'),
    reason(2, 'Skills do not match the role'),
    reason(3, 'Salary expectation too high'),
    reason(4, 'Did not clear the interview'),
    reason(5, 'Position filled'),
    reason(6, 'Could not be reached', false),
  ]
}

// --- openings -----------------------------------------------------------------------------------

const SOFTWARE = departmentId('Software')
const MARKETING = departmentId('Marketing')
const FINANCE = departmentId('Finance')
const HR = departmentId('Human Resource Management')

export function seedOpenings(): OpeningRec[] {
  const opening = (
    id: number,
    fields: Partial<OpeningRec> & Pick<OpeningRec, 'title' | 'status' | 'vacancies'>,
  ): OpeningRec => ({
    id: String(id),
    code: `RC-${String(id).padStart(4, '0')}`,
    openPositionId: null,
    jobTitleId: null,
    designationId: null,
    departmentId: null,
    branchId: null,
    employmentTypeId: null,
    hiringManagerId: null,
    cityId: null,
    workMode: 'on_site',
    experienceFromYears: null,
    experienceToYears: null,
    postedOn: null,
    applyBy: null,
    closeOn: null,
    salaryFrom: null,
    salaryTo: null,
    isSalaryVisible: false,
    description: null,
    requirements: null,
    publishedAt: null,
    closedAt: null,
    createdAt: at(-100 + id),
    createdByName: ACTOR,
    updatedAt: null,
    rowVersion: nextRowVersion(),
    ...fields,
  })
  return [
    opening(1, {
      title: 'Senior Software Engineer',
      status: 'open',
      jobTitleId: 'jt_sse',
      designationId: 'jt_sse',
      departmentId: SOFTWARE,
      branchId: 'br_lhr_jt',
      hiringManagerId: 'em_bilal',
      cityId: 'ct_lhr',
      workMode: 'hybrid',
      experienceFromYears: 4,
      experienceToYears: 8,
      vacancies: 2,
      postedOn: dayFrom(-30),
      applyBy: dayFrom(15),
      closeOn: dayFrom(45),
      salaryFrom: 350_000,
      salaryTo: 500_000,
      isSalaryVisible: true,
      description: 'Design, build and run the services behind hRango, with a small product team.',
      requirements:
        'TypeScript or Python in production\nSQL and API design\nCode reviews and mentoring',
      publishedAt: at(-30, 10),
      createdAt: at(-32),
    }),
    opening(2, {
      title: 'QA Engineer',
      status: 'open',
      jobTitleId: 'jt_qa',
      designationId: 'jt_qa',
      departmentId: SOFTWARE,
      branchId: 'br_lhr_jt',
      hiringManagerId: 'em_bilal',
      cityId: 'ct_lhr',
      experienceFromYears: 2,
      experienceToYears: 4,
      vacancies: 1,
      postedOn: dayFrom(-20),
      applyBy: dayFrom(10),
      salaryFrom: 150_000,
      salaryTo: 220_000,
      description: 'Own test plans, automation and release checks for the web and mobile apps.',
      requirements: 'Playwright or Cypress\nAPI testing\nClear bug reports',
      publishedAt: at(-20, 10),
      createdAt: at(-21),
    }),
    opening(3, {
      title: 'Marketing Executive',
      status: 'on_hold',
      jobTitleId: 'jt_exec',
      designationId: 'jt_exec',
      departmentId: MARKETING,
      branchId: 'br_khi',
      hiringManagerId: 'em_areeba',
      cityId: 'ct_khi',
      experienceFromYears: 1,
      experienceToYears: 3,
      vacancies: 2,
      postedOn: dayFrom(-45),
      applyBy: dayFrom(-5),
      salaryFrom: 90_000,
      salaryTo: 130_000,
      description: 'Plan and run campaigns across digital and print channels.',
      publishedAt: at(-45, 10),
      createdAt: at(-46),
    }),
    opening(4, {
      title: 'Accountant',
      status: 'closed',
      jobTitleId: 'jt_acc',
      designationId: 'jt_acc',
      departmentId: FINANCE,
      branchId: 'br_lhr_ho',
      hiringManagerId: 'em_hina',
      cityId: 'ct_lhr',
      experienceFromYears: 2,
      experienceToYears: 5,
      vacancies: 1,
      postedOn: dayFrom(-95),
      applyBy: dayFrom(-70),
      closeOn: dayFrom(-50),
      salaryFrom: 120_000,
      salaryTo: 160_000,
      description: 'Ledgers, reconciliations and month-end close for the head office.',
      publishedAt: at(-95, 10),
      closedAt: at(-50, 16),
      createdAt: at(-96),
    }),
    opening(5, {
      title: 'HR Executive',
      status: 'draft',
      departmentId: HR,
      branchId: 'br_isb',
      hiringManagerId: 'em_kaleem',
      cityId: 'ct_isb',
      experienceFromYears: 1,
      experienceToYears: 3,
      vacancies: 1,
      description: 'Onboarding, records and employee queries for the Islamabad office.',
      createdAt: at(-3),
    }),
    opening(6, {
      title: 'UI/UX Designer',
      status: 'open',
      openPositionId: 'op_apps_uiux',
      designationId: designationIdOf('UI/UX Designer'),
      departmentId: SOFTWARE,
      branchId: 'br_lhr_jt',
      hiringManagerId: 'em_bilal',
      cityId: 'ct_lhr',
      workMode: 'remote',
      experienceFromYears: 2,
      experienceToYears: 6,
      vacancies: 1,
      postedOn: dayFrom(-25),
      applyBy: dayFrom(5),
      salaryFrom: 180_000,
      salaryTo: 260_000,
      isSalaryVisible: true,
      description: 'Research, flows and high-fidelity screens for the HR apps.',
      publishedAt: at(-25, 10),
      createdAt: at(-26),
    }),
  ]
}

// --- candidates ---------------------------------------------------------------------------------

export function seedApplicants(): ApplicantRec[] {
  const applicant = (
    id: number,
    first: string,
    last: string,
    fields: Partial<ApplicantRec> = {},
  ): ApplicantRec => ({
    id: String(id),
    firstName: first,
    lastName: last,
    email: `${first}.${last}@example.pk`.toLowerCase(),
    phone: `0321-${String(4_100_000 + id * 7_331).slice(0, 7)}`,
    gender: null,
    dateOfBirth: null,
    cityId: 'ct_lhr',
    address: null,
    currentEmployer: null,
    currentJobTitle: null,
    experienceYears: null,
    currentSalary: null,
    expectedSalary: null,
    noticePeriodDays: 30,
    highestEducation: null,
    linkedinUrl: null,
    source: 'career_site',
    referredByEmployeeId: null,
    cvFileId: `file_cv_${String(id)}`,
    cvName: `${first} ${last} CV.pdf`,
    notes: null,
    createdAt: at(-60 + (id % 50)),
    createdByName: ACTOR,
    updatedAt: null,
    rowVersion: nextRowVersion(),
    ...fields,
  })
  return [
    applicant(101, 'Ahmed', 'Raza', {
      gender: 'male',
      currentEmployer: 'Systems Ltd',
      currentJobTitle: 'Software Engineer',
      experienceYears: 5,
      currentSalary: 320_000,
      expectedSalary: 420_000,
      highestEducation: 'BS Computer Science, FAST',
      linkedinUrl: 'https://www.linkedin.com/in/ahmed-raza',
      source: 'linkedin',
      createdAt: at(-26),
    }),
    applicant(102, 'Fatima', 'Noor', {
      gender: 'female',
      currentEmployer: 'Arbisoft',
      currentJobTitle: 'Senior Software Engineer',
      experienceYears: 7,
      currentSalary: 380_000,
      expectedSalary: 450_000,
      highestEducation: 'MS Software Engineering, NUST',
      source: 'referral',
      referredByEmployeeId: 'em_haroon',
      createdAt: at(-28),
    }),
    applicant(103, 'Bilal', 'Hussain', {
      gender: 'male',
      currentJobTitle: 'Backend Developer',
      experienceYears: 4,
      expectedSalary: 360_000,
      source: 'job_board',
      createdAt: at(-6),
    }),
    applicant(104, 'Sana', 'Javed', {
      gender: 'female',
      cityId: 'ct_isb',
      currentJobTitle: 'Junior Developer',
      experienceYears: 1.5,
      expectedSalary: 300_000,
      createdAt: at(-22),
    }),
    applicant(105, 'Hassan', 'Ali', {
      gender: 'male',
      currentEmployer: 'Netsol',
      currentJobTitle: 'Software Engineer',
      experienceYears: 4,
      expectedSalary: 390_000,
      source: 'linkedin',
      createdAt: at(-14),
    }),
    applicant(106, 'Ayesha', 'Siddiqui', {
      gender: 'female',
      currentJobTitle: 'SQA Engineer',
      experienceYears: 3,
      expectedSalary: 200_000,
      source: 'career_site',
      createdAt: at(-17),
    }),
    applicant(107, 'Zain', 'Abbas', {
      gender: 'male',
      cityId: 'ct_rwp',
      currentJobTitle: 'QA Analyst',
      experienceYears: 2,
      expectedSalary: 170_000,
      createdAt: at(-4),
    }),
    applicant(108, 'Mehwish', 'Iqbal', {
      gender: 'female',
      currentJobTitle: 'Test Automation Engineer',
      experienceYears: 3,
      expectedSalary: 210_000,
      source: 'job_board',
      createdAt: at(-15),
    }),
    applicant(109, 'Kamran', 'Shah', {
      gender: 'male',
      cityId: 'ct_khi',
      currentJobTitle: 'QA Engineer',
      experienceYears: 2,
      source: 'walk_in',
      createdAt: at(-18),
    }),
    applicant(110, 'Hira', 'Baig', {
      gender: 'female',
      cityId: 'ct_khi',
      currentJobTitle: 'Marketing Associate',
      experienceYears: 2,
      expectedSalary: 110_000,
      source: 'agency',
      createdAt: at(-40),
    }),
    applicant(111, 'Danish', 'Malik', {
      gender: 'male',
      cityId: 'ct_khi',
      currentJobTitle: 'Digital Marketer',
      experienceYears: 1,
      createdAt: at(-38),
    }),
    applicant(112, 'Omer', 'Farooq', {
      gender: 'male',
      currentEmployer: 'A. F. Ferguson',
      currentJobTitle: 'Audit Associate',
      experienceYears: 3,
      expectedSalary: 140_000,
      highestEducation: 'ACCA',
      source: 'referral',
      referredByEmployeeId: 'em_hina',
      createdAt: at(-90),
    }),
    applicant(113, 'Nimra', 'Aslam', {
      gender: 'female',
      currentJobTitle: 'Accounts Officer',
      experienceYears: 2,
      createdAt: at(-88),
    }),
    applicant(114, 'Usama', 'Khalid', {
      gender: 'male',
      currentEmployer: 'Tkxel',
      currentJobTitle: 'Product Designer',
      experienceYears: 4,
      currentSalary: 190_000,
      expectedSalary: 240_000,
      linkedinUrl: 'https://www.linkedin.com/in/usama-khalid',
      source: 'linkedin',
      createdAt: at(-20),
    }),
  ]
}

// --- applications, history ----------------------------------------------------------------------

interface Track {
  id: number
  opening: number
  applicant: number
  appliedDaysAgo: number
  /** The stages it went through after Applied, with days ago. */
  path: [StageValue, number][]
  source?: string
  rejectionReasonId?: string
  employeeId?: string
}

const TRACKS: Track[] = [
  {
    id: 501,
    opening: 1,
    applicant: 101,
    appliedDaysAgo: 25,
    path: [
      ['screening', 22],
      ['shortlisted', 18],
      ['interview', 9],
    ],
  },
  {
    id: 502,
    opening: 1,
    applicant: 102,
    appliedDaysAgo: 27,
    source: 'referral',
    path: [
      ['screening', 24],
      ['shortlisted', 20],
      ['interview', 14],
      ['offer', 3],
    ],
  },
  { id: 503, opening: 1, applicant: 103, appliedDaysAgo: 5, path: [] },
  {
    id: 504,
    opening: 1,
    applicant: 104,
    appliedDaysAgo: 21,
    path: [
      ['screening', 19],
      ['rejected', 17],
    ],
    rejectionReasonId: '1',
  },
  { id: 505, opening: 1, applicant: 105, appliedDaysAgo: 12, path: [['screening', 8]] },
  {
    id: 506,
    opening: 2,
    applicant: 106,
    appliedDaysAgo: 16,
    path: [
      ['screening', 13],
      ['shortlisted', 6],
      ['interview', 5],
    ],
  },
  { id: 507, opening: 2, applicant: 107, appliedDaysAgo: 3, path: [] },
  {
    id: 508,
    opening: 2,
    applicant: 108,
    appliedDaysAgo: 14,
    path: [
      ['screening', 11],
      ['shortlisted', 8],
      ['interview', 4],
    ],
  },
  {
    id: 509,
    opening: 2,
    applicant: 109,
    appliedDaysAgo: 17,
    path: [
      ['screening', 15],
      ['withdrawn', 9],
    ],
  },
  { id: 510, opening: 3, applicant: 110, appliedDaysAgo: 39, path: [['screening', 33]] },
  { id: 511, opening: 3, applicant: 111, appliedDaysAgo: 37, path: [] },
  {
    id: 512,
    opening: 4,
    applicant: 112,
    appliedDaysAgo: 88,
    source: 'referral',
    path: [
      ['screening', 85],
      ['shortlisted', 80],
      ['interview', 75],
      ['offer', 66],
      ['hired', 55],
    ],
    employeeId: 'em_omer',
  },
  {
    id: 513,
    opening: 4,
    applicant: 113,
    appliedDaysAgo: 86,
    path: [
      ['screening', 84],
      ['shortlisted', 80],
      ['interview', 76],
      ['rejected', 70],
    ],
    rejectionReasonId: '4',
  },
  {
    id: 514,
    opening: 6,
    applicant: 114,
    appliedDaysAgo: 19,
    source: 'linkedin',
    path: [
      ['screening', 17],
      ['shortlisted', 14],
      ['interview', 10],
      ['offer', 5],
    ],
  },
  {
    id: 515,
    opening: 6,
    applicant: 101,
    appliedDaysAgo: 24,
    source: 'linkedin',
    path: [['screening', 21]],
  },
  { id: 516, opening: 1, applicant: 106, appliedDaysAgo: 2, path: [] },
]

const COVER =
  'I am applying for this role after following your products for a while. My CV is attached; I am available to start after my notice period.'

export function seedApplications(): ApplicationRec[] {
  return TRACKS.map((track) => {
    const last = track.path.at(-1)
    const stage = last?.[0] ?? 'applied'
    const changed = last?.[1] ?? track.appliedDaysAgo
    const beforeLast = track.path.at(-2)?.[0] ?? 'applied'
    return {
      id: String(track.id),
      jobOpeningId: String(track.opening),
      applicantId: String(track.applicant),
      appliedOn: dayFrom(-track.appliedDaysAgo),
      source: track.source ?? 'career_site',
      coverLetter: track.id % 3 === 0 ? null : COVER,
      stage,
      stageChangedAt: at(-changed, 11),
      rejectionReasonId: track.rejectionReasonId ?? null,
      rejectedStage: stage === 'rejected' ? beforeLast : null,
      remarks: null,
      employeeId: track.employeeId ?? null,
      hiredAt: stage === 'hired' ? at(-changed, 12) : null,
      createdAt: at(-track.appliedDaysAgo, 9),
      createdByName: ACTOR,
      updatedAt: track.path.length > 0 ? at(-changed, 11) : null,
      rowVersion: nextRowVersion(),
    }
  })
}

const STAGE_NOTES: Partial<Record<StageValue, string>> = {
  screening: 'CV reviewed',
  shortlisted: 'Good fit for the role',
  interview: 'Interview scheduled',
  offer: 'Offer prepared',
  hired: 'Joined',
  rejected: 'Not taken forward',
  withdrawn: 'Candidate withdrew',
}

export function seedHistory(): HistoryRec[] {
  return TRACKS.flatMap((track) => {
    const rows: HistoryRec[] = [
      {
        id: `${String(track.id)}-0`,
        applicationId: String(track.id),
        fromStage: null,
        toStage: 'applied',
        changedAt: at(-track.appliedDaysAgo, 9),
        changedByName: ACTOR,
        remarks: null,
      },
    ]
    let from: StageValue = 'applied'
    track.path.forEach(([stage, daysAgo], index) => {
      rows.push({
        id: `${String(track.id)}-${String(index + 1)}`,
        applicationId: String(track.id),
        fromStage: from,
        toStage: stage,
        changedAt: at(-daysAgo, 11),
        changedByName: ACTOR,
        remarks: STAGE_NOTES[stage] ?? null,
      })
      from = stage
    })
    return rows
  })
}

// --- interviews, evaluations --------------------------------------------------------------------

export function seedInterviews(): InterviewRec[] {
  const interview = (
    id: number,
    application: number,
    fields: Partial<InterviewRec> & Pick<InterviewRec, 'scheduledAt' | 'interviewerIds'>,
  ): InterviewRec => ({
    id: String(id),
    applicationId: String(application),
    roundNo: 1,
    title: 'Technical interview',
    mode: 'in_person',
    durationMinutes: 60,
    venue: 'Johar Town Delivery Centre, Meeting Room 2',
    status: 'scheduled',
    result: null,
    remarks: null,
    createdAt: at(-30),
    createdByName: ACTOR,
    updatedAt: null,
    rowVersion: nextRowVersion(),
    ...fields,
  })
  return [
    interview(801, 501, {
      scheduledAt: at(-9, 11),
      status: 'completed',
      result: 'passed',
      interviewerIds: ['em_bilal', 'em_shelley'],
      createdAt: at(-12),
    }),
    interview(802, 501, {
      roundNo: 2,
      title: 'System design',
      mode: 'video',
      venue: 'Google Meet',
      scheduledAt: at(2, 11),
      interviewerIds: ['em_bilal', 'em_haroon'],
      createdAt: at(-2),
    }),
    interview(803, 508, {
      title: 'QA interview',
      scheduledAt: at(1, 15),
      interviewerIds: ['em_mahnoor', 'em_shelley'],
      createdAt: at(-4),
    }),
    interview(804, 502, {
      scheduledAt: at(-14, 10),
      status: 'completed',
      result: 'passed',
      interviewerIds: ['em_bilal', 'em_rehan'],
      createdAt: at(-18),
    }),
    interview(805, 513, {
      title: 'Finance interview',
      venue: 'Lahore Head Office, Board Room',
      scheduledAt: at(-76, 12),
      status: 'completed',
      result: 'failed',
      interviewerIds: ['em_hina'],
      createdAt: at(-79),
    }),
    interview(806, 512, {
      title: 'Finance interview',
      venue: 'Lahore Head Office, Board Room',
      scheduledAt: at(-75, 12),
      status: 'completed',
      result: 'passed',
      interviewerIds: ['em_hina', 'em_shelley'],
      createdAt: at(-78),
    }),
    interview(807, 514, {
      title: 'Portfolio review',
      mode: 'video',
      venue: 'Google Meet',
      scheduledAt: at(-10, 14),
      status: 'completed',
      result: 'passed',
      interviewerIds: ['em_maryam', 'em_bilal'],
      createdAt: at(-13),
    }),
    interview(808, 506, {
      title: 'QA interview',
      mode: 'phone',
      venue: null,
      scheduledAt: at(5, 12, 30),
      durationMinutes: 45,
      interviewerIds: ['em_shelley'],
      createdAt: at(-5),
    }),
    interview(809, 510, {
      title: 'HR interview',
      venue: 'Karachi Sales Office',
      scheduledAt: at(-3, 16),
      status: 'cancelled',
      remarks: 'Opening put on hold',
      interviewerIds: ['em_areeba'],
      createdAt: at(-8),
    }),
  ]
}

export function seedEvaluations(): EvaluationRec[] {
  const evaluation = (
    id: number,
    interview: number,
    employeeId: string,
    rating: number,
    recommendation: EvaluationRec['recommendation'],
    strengths: string,
    concerns: string | null,
    daysAgo: number,
  ): EvaluationRec => ({
    id: String(id),
    interviewId: String(interview),
    employeeId,
    rating,
    recommendation,
    strengths,
    concerns,
    comments: null,
    evaluatedAt: at(-daysAgo, 17),
    evaluatedByName: ACTOR,
    rowVersion: nextRowVersion(),
  })
  return [
    evaluation(
      1,
      801,
      'em_bilal',
      4,
      'hire',
      'Clean code, good API design',
      'Little cloud experience',
      9,
    ),
    evaluation(2, 801, 'em_shelley', 4, 'hire', 'Clear communicator', null, 9),
    evaluation(
      3,
      804,
      'em_bilal',
      5,
      'strong_hire',
      'Deep backend knowledge, mentors well',
      null,
      14,
    ),
    evaluation(
      4,
      804,
      'em_rehan',
      4,
      'hire',
      'Strong on testing',
      'Salary at the top of the band',
      14,
    ),
    evaluation(5, 805, 'em_hina', 2, 'no_hire', 'Knows the basics', 'Weak on reconciliations', 76),
    evaluation(6, 806, 'em_hina', 4, 'hire', 'Audit background, careful', null, 75),
    evaluation(7, 806, 'em_shelley', 4, 'hire', 'Good culture fit', null, 75),
    evaluation(8, 807, 'em_maryam', 5, 'strong_hire', 'Excellent portfolio and research', null, 10),
  ]
}

// --- offers -------------------------------------------------------------------------------------

export function seedOffers(): OfferRec[] {
  const offer = (
    id: number,
    application: number,
    fields: Partial<OfferRec> &
      Pick<OfferRec, 'offeredSalary' | 'joiningDate' | 'status' | 'createdAt'>,
  ): OfferRec => ({
    id: String(id),
    applicationId: String(application),
    jobTitleId: null,
    designationId: null,
    departmentId: null,
    branchId: null,
    employmentTypeId: null,
    salaryFrequency: 'monthly',
    probationMonths: 3,
    expiresOn: null,
    offerLetterFileId: null,
    offerLetterName: null,
    sentAt: null,
    respondedAt: null,
    responseRemarks: null,
    remarks: null,
    createdByName: ACTOR,
    updatedAt: null,
    rowVersion: nextRowVersion(),
    ...fields,
  })
  return [
    offer(901, 502, {
      jobTitleId: 'jt_sse',
      designationId: 'jt_sse',
      departmentId: SOFTWARE,
      branchId: 'br_lhr_jt',
      offeredSalary: 440_000,
      joiningDate: dayFrom(30),
      expiresOn: dayFrom(7),
      status: 'sent',
      sentAt: at(-3, 15),
      offerLetterFileId: 'file_offer_901',
      offerLetterName: 'Offer letter - Fatima Noor.pdf',
      createdAt: at(-4),
    }),
    offer(902, 512, {
      jobTitleId: 'jt_acc',
      designationId: 'jt_acc',
      departmentId: FINANCE,
      branchId: 'br_lhr_ho',
      offeredSalary: 145_000,
      joiningDate: dayFrom(-55),
      expiresOn: dayFrom(-60),
      status: 'accepted',
      sentAt: at(-66, 15),
      respondedAt: at(-63, 10),
      responseRemarks: 'Happy to join',
      createdAt: at(-67),
    }),
    offer(903, 514, {
      designationId: designationIdOf('UI/UX Designer'),
      departmentId: SOFTWARE,
      branchId: 'br_lhr_jt',
      offeredSalary: 235_000,
      joiningDate: dayFrom(21),
      expiresOn: dayFrom(2),
      status: 'accepted',
      sentAt: at(-5, 12),
      respondedAt: at(-2, 18),
      responseRemarks: 'Accepted by email',
      createdAt: at(-6),
    }),
    offer(904, 501, {
      jobTitleId: 'jt_sse',
      designationId: 'jt_sse',
      departmentId: SOFTWARE,
      branchId: 'br_lhr_jt',
      offeredSalary: 400_000,
      joiningDate: dayFrom(40),
      expiresOn: dayFrom(14),
      status: 'draft',
      remarks: 'Hold until the system design round',
      createdAt: at(-1),
    }),
  ]
}
