import type { FileRef } from '@/lib/files'

/*
 * What the Recruitment screens work with: the API's records (`api/recruitment.dto.ts`) after
 * `api/recruitment.mappers.ts`, with the open string fields narrowed to the values the screens
 * know and every instant read as UTC. Ids stay strings; the API calls send them back as numbers.
 */

// --- enumerations ----------------------------------------------------------------------------

/** A job opening's life: drafted, published (open), put on hold, closed. */
export const OPENING_STATUSES = ['draft', 'open', 'on_hold', 'closed'] as const
export type OpeningStatus = (typeof OPENING_STATUSES)[number]

/** Every stage an application can be in, in pipeline order. */
export const STAGES = [
  'applied',
  'screening',
  'shortlisted',
  'interview',
  'offer',
  'hired',
  'rejected',
  'withdrawn',
] as const
export type Stage = (typeof STAGES)[number]

/** The stages a Move takes an application to (`StageIn.stage`). */
export const MOVE_STAGES = ['applied', 'screening', 'shortlisted', 'interview', 'offer'] as const
export type MoveStage = (typeof MOVE_STAGES)[number]

/** Where an application ends: nothing moves it any more. */
export const CLOSED_STAGES = ['hired', 'rejected', 'withdrawn'] as const

export const INTERVIEW_STATUSES = ['scheduled', 'completed', 'no_show', 'cancelled'] as const
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number]

export const INTERVIEW_MODES = ['in_person', 'phone', 'video'] as const
export type InterviewMode = (typeof INTERVIEW_MODES)[number]

export const INTERVIEW_RESULTS = ['passed', 'failed', 'on_hold'] as const
export type InterviewResult = (typeof INTERVIEW_RESULTS)[number]

export const RECOMMENDATIONS = ['strong_hire', 'hire', 'no_hire', 'strong_no_hire'] as const
export type Recommendation = (typeof RECOMMENDATIONS)[number]

export const OFFER_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'declined',
  'withdrawn',
  'expired',
] as const
export type OfferStatus = (typeof OFFER_STATUSES)[number]

export const SALARY_FREQUENCIES = ['monthly', 'daily', 'hourly'] as const
export type SalaryFrequency = (typeof SALARY_FREQUENCIES)[number]

export const WORK_MODES = ['on_site', 'remote', 'hybrid'] as const
export type WorkMode = (typeof WORK_MODES)[number]

export const SOURCES = [
  'career_site',
  'referral',
  'job_board',
  'linkedin',
  'walk_in',
  'agency',
  'other',
] as const
export type Source = (typeof SOURCES)[number]

export const GENDERS = ['male', 'female', 'other'] as const
export type Gender = (typeof GENDERS)[number]

/** Hire: the new employee starts active or on probation. */
export const HIRE_STATUSES = ['probation', 'active'] as const
export type HireStatus = (typeof HIRE_STATUSES)[number]

// --- records ---------------------------------------------------------------------------------

export interface Opening {
  id: string
  code: string
  title: string
  status: OpeningStatus
  openPositionId: string | null
  openPositionTitle: string | null
  openPositionSeats: number | null
  jobTitleId: string | null
  jobTitleName: string | null
  designationId: string | null
  designationName: string | null
  departmentId: string | null
  departmentName: string | null
  branchId: string | null
  branchName: string | null
  employmentTypeId: string | null
  employmentTypeName: string | null
  hiringManagerId: string | null
  hiringManagerName: string | null
  cityId: string | null
  cityName: string | null
  stateId: string | null
  stateName: string | null
  workMode: WorkMode | null
  experienceFromYears: number | null
  experienceToYears: number | null
  vacancies: number
  hiredCount: number
  remainingVacancies: number
  applicationCount: number
  activeApplicationCount: number
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

export interface Applicant {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string | null
  gender: Gender | null
  dateOfBirth: string | null
  cityId: string | null
  cityName: string | null
  stateName: string | null
  countryName: string | null
  address: string | null
  currentEmployer: string | null
  currentJobTitle: string | null
  experienceYears: number | null
  currentSalary: number | null
  expectedSalary: number | null
  noticePeriodDays: number | null
  highestEducation: string | null
  linkedinUrl: string | null
  source: Source | null
  referredByEmployeeId: string | null
  referredByName: string | null
  cvFileId: string | null
  cv: FileRef | null
  notes: string | null
  applicationCount: number
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface ApplicantDetail extends Applicant {
  applications: Application[]
}

export interface Application {
  id: string
  jobOpeningId: string
  jobOpeningCode: string
  jobOpeningTitle: string
  departmentId: string | null
  departmentName: string | null
  branchId: string | null
  branchName: string | null
  applicantId: string
  applicantName: string
  applicantEmail: string
  applicantPhone: string | null
  applicantCurrentJobTitle: string | null
  applicantCityName: string | null
  cvFileId: string | null
  cv: FileRef | null
  appliedOn: string
  source: Source | null
  coverLetter: string | null
  stage: Stage
  stageChangedAt: string | null
  rejectionReasonId: string | null
  rejectionReasonName: string | null
  rejectedStage: Stage | null
  remarks: string | null
  employeeId: string | null
  employeeCode: string | null
  hiredAt: string | null
  interviewCount: number
  nextInterviewAt: string | null
  averageRating: number | null
  evaluationCount: number
  latestOfferId: string | null
  latestOfferStatus: OfferStatus | null
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface StageHistory {
  id: string
  fromStage: Stage | null
  toStage: Stage
  changedAt: string
  changedByName: string | null
  remarks: string | null
}

export interface ApplicationDetail extends Application {
  history: StageHistory[]
  interviews: Interview[]
  offers: Offer[]
}

export interface Interview {
  id: string
  applicationId: string
  applicationStage: Stage
  jobOpeningId: string
  jobOpeningTitle: string
  applicantId: string
  applicantName: string
  applicantEmail: string
  applicantPhone: string | null
  applicantCityName: string | null
  cvFileId: string | null
  cv: FileRef | null
  roundNo: number
  title: string
  mode: InterviewMode | null
  scheduledAt: string
  durationMinutes: number
  endsAt: string
  venue: string | null
  status: InterviewStatus
  result: InterviewResult | null
  remarks: string | null
  interviewerNames: string | null
  interviewerCount: number
  evaluationCount: number
  averageRating: number | null
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface Interviewer {
  employeeId: string
  employeeCode: string | null
  employeeName: string
  jobTitleName: string | null
  email: string | null
  hasEvaluated: boolean
}

export interface Evaluation {
  id: string
  employeeId: string
  employeeName: string
  rating: number
  recommendation: Recommendation
  strengths: string | null
  concerns: string | null
  comments: string | null
  evaluatedAt: string
  evaluatedByName: string | null
}

export interface InterviewDetail extends Interview {
  interviewers: Interviewer[]
  evaluations: Evaluation[]
}

export interface Offer {
  id: string
  applicationId: string
  applicationStage: Stage
  jobOpeningId: string
  jobOpeningTitle: string
  applicantId: string
  applicantName: string
  applicantEmail: string
  jobTitleId: string | null
  jobTitleName: string | null
  designationId: string | null
  designationName: string | null
  departmentId: string | null
  departmentName: string | null
  branchId: string | null
  branchName: string | null
  employmentTypeId: string | null
  employmentTypeName: string | null
  offeredSalary: number
  salaryFrequency: SalaryFrequency | null
  joiningDate: string
  probationMonths: number | null
  expiresOn: string | null
  offerLetterFileId: string | null
  offerLetter: FileRef | null
  status: OfferStatus
  sentAt: string | null
  respondedAt: string | null
  responseRemarks: string | null
  remarks: string | null
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface RejectionReason {
  id: string
  name: string
  isActive: boolean
  sortOrder: number
  usageCount: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

// --- dashboard -------------------------------------------------------------------------------

export interface DashboardTiles {
  openOpenings: number
  totalOpenings: number
  openVacancies: number
  applications: number
  interviews: number
  upcomingInterviews: number
  offersAccepted: number
  hired: number
  rejected: number
}

export interface DashboardMonth {
  monthNo: number
  applications: number
  shortlisted: number
  rejected: number
  hired: number
}

export interface DashboardInterview {
  interviewId: string
  applicationId: string
  applicantId: string
  applicantName: string
  applicantEmail: string
  applicantPhone: string | null
  applicantCityName: string | null
  jobOpeningId: string
  jobOpeningTitle: string
  title: string
  roundNo: number
  mode: InterviewMode | null
  scheduledAt: string
  durationMinutes: number
  venue: string | null
  interviewerNames: string | null
  firstInterviewerName: string | null
  firstInterviewerTitle: string | null
}

export interface DashboardActivity {
  id: string
  applicationId: string
  applicantName: string
  jobOpeningTitle: string
  fromStage: Stage | null
  toStage: Stage
  changedAt: string
  changedByName: string | null
}

export interface RecruitmentDashboard {
  year: number
  month: number | null
  tiles: DashboardTiles
  jobStatistics: DashboardMonth[]
  upcomingInterviews: DashboardInterview[]
  recentActivity: DashboardActivity[]
}

// --- list parameters -------------------------------------------------------------------------

export interface PageQuery {
  page: number
  pageSize: number
}

export interface OpeningFilters {
  q?: string | undefined
  status?: OpeningStatus | undefined
  departmentId?: string | undefined
  branchId?: string | undefined
  jobTitleId?: string | undefined
  openPositionId?: string | undefined
}

export interface ApplicantFilters {
  q?: string | undefined
  source?: Source | undefined
  cityId?: string | undefined
}

export interface ApplicationFilters {
  q?: string | undefined
  jobOpeningId?: string | undefined
  applicantId?: string | undefined
  stage?: Stage | undefined
  activeOnly?: boolean | undefined
  fromDate?: string | undefined
  toDate?: string | undefined
}

export interface InterviewFilters {
  q?: string | undefined
  jobOpeningId?: string | undefined
  applicationId?: string | undefined
  interviewerId?: string | undefined
  status?: InterviewStatus | undefined
  fromDate?: string | undefined
  toDate?: string | undefined
  mine?: boolean | undefined
}

export interface OfferFilters {
  q?: string | undefined
  jobOpeningId?: string | undefined
  applicationId?: string | undefined
  status?: OfferStatus | undefined
}

/** A record an edit, delete or action sends back: its id and the row version last read. */
export interface Versioned {
  id: string
  rowVersion: string
}

/** A picker's choice: id and name (organisation lists, open positions …). */
export interface NamedOption {
  id: string
  name: string
}
