import type { FileRef } from '@/lib/files'

/*
 * The `/api/recruitment/…` schemas as the backend's OpenAPI gives them (components.schemas,
 * 26 Oct 2026). Out records carry every field (nullable where the API says so); In bodies list
 * what a call may send. Status and stage fields are open strings in the spec; the mappers narrow
 * them. Ids come back as strings and go out as numbers (`ApiId`: a mock id stays a string).
 */

export type ApiId = number | string

// --- out --------------------------------------------------------------------------------------

export interface OpeningOutDto {
  id: string
  code: string
  title: string
  status: string
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
  workMode: string | null
  experienceFromYears: number | null
  experienceToYears: number | null
  vacancies: number
  hiredCount: number
  remainingVacancies: number
  applicationCount: number
  activeApplicationCount: number
  /** `yyyy-MM-dd`. */
  postedOn: string | null
  applyBy: string | null
  closeOn: string | null
  salaryFrom: number | null
  salaryTo: number | null
  isSalaryVisible: boolean
  description: string | null
  requirements: string | null
  /** Date-times (UTC; the API may leave out the offset). */
  publishedAt: string | null
  closedAt: string | null
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface ApplicantOutDto {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string | null
  gender: string | null
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
  source: string | null
  referredByEmployeeId: string | null
  referredByName: string | null
  cvFileId: string | null
  cv?: FileRef | null
  notes: string | null
  applicationCount: number
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface ApplicantDetailOutDto extends ApplicantOutDto {
  applications: ApplicationOutDto[]
}

export interface ApplicationOutDto {
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
  cv?: FileRef | null
  appliedOn: string
  source: string | null
  coverLetter: string | null
  stage: string
  stageChangedAt: string | null
  rejectionReasonId: string | null
  rejectionReasonName: string | null
  rejectedStage: string | null
  remarks: string | null
  employeeId: string | null
  employeeCode: string | null
  hiredAt: string | null
  interviewCount: number
  nextInterviewAt: string | null
  averageRating: number | null
  evaluationCount: number | null
  latestOfferId: string | null
  latestOfferStatus: string | null
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface StageHistoryOutDto {
  id: string
  fromStage: string | null
  toStage: string
  changedAt: string
  changedByUserId: string | null
  changedByName: string | null
  remarks: string | null
}

export interface ApplicationDetailOutDto extends ApplicationOutDto {
  history: StageHistoryOutDto[]
  interviews: InterviewOutDto[]
  offers: OfferOutDto[]
}

export interface InterviewOutDto {
  id: string
  applicationId: string
  applicationStage: string
  jobOpeningId: string
  jobOpeningTitle: string
  applicantId: string
  applicantName: string
  applicantEmail: string
  applicantPhone: string | null
  applicantCityName: string | null
  cvFileId: string | null
  cv?: FileRef | null
  roundNo: number
  title: string
  mode: string | null
  scheduledAt: string
  durationMinutes: number
  endsAt: string
  venue: string | null
  status: string
  result: string | null
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

export interface InterviewerOutDto {
  employeeId: string
  employeeCode: string | null
  employeeName: string
  jobTitleName: string | null
  email: string | null
  hasEvaluated: boolean
}

export interface EvaluationOutDto {
  id: string
  interviewId: string
  employeeId: string
  employeeName: string
  rating: number
  recommendation: string
  strengths: string | null
  concerns: string | null
  comments: string | null
  evaluatedAt: string
  evaluatedByUserId: string | null
  evaluatedByName: string | null
  rowVersion: string
}

export interface InterviewDetailOutDto extends InterviewOutDto {
  interviewers: InterviewerOutDto[]
  evaluations: EvaluationOutDto[]
}

export interface OfferOutDto {
  id: string
  applicationId: string
  applicationStage: string
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
  salaryFrequency: string | null
  joiningDate: string
  probationMonths: number | null
  expiresOn: string | null
  offerLetterFileId: string | null
  offerLetter?: FileRef | null
  status: string
  sentAt: string | null
  respondedAt: string | null
  responseRemarks: string | null
  remarks: string | null
  createdAt: string
  createdByName: string | null
  updatedAt: string | null
  rowVersion: string
}

export interface RejectionReasonOutDto {
  id: string
  name: string
  isActive: boolean
  sortOrder: number
  usageCount: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface DashboardTilesOutDto {
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

export interface DashboardMonthOutDto {
  monthNo: number
  applications: number
  shortlisted: number
  rejected: number
  hired: number
}

export interface DashboardInterviewOutDto {
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
  mode: string | null
  scheduledAt: string
  durationMinutes: number
  venue: string | null
  interviewerNames: string | null
  firstInterviewerName: string | null
  firstInterviewerTitle: string | null
}

export interface DashboardActivityOutDto {
  id: string
  applicationId: string
  applicantName: string
  jobOpeningTitle: string
  fromStage: string | null
  toStage: string
  changedAt: string
  changedByName: string | null
}

export interface DashboardOutDto {
  year: number
  month: number | null
  tiles: DashboardTilesOutDto
  jobStatistics: DashboardMonthOutDto[]
  upcomingInterviews: DashboardInterviewOutDto[]
  recentActivity: DashboardActivityOutDto[]
}

// --- in ---------------------------------------------------------------------------------------

/** `RowVersionIn`: publish, hold, close, reopen. */
export interface RowVersionInDto {
  rowVersion: string
}

/** `RemarksIn`: withdraw an application, cancel an interview, send or withdraw an offer. */
export interface RemarksInDto {
  remarks?: string | null
  rowVersion: string
}

export interface OpeningInDto {
  code?: string | null
  title?: string | null
  openPositionId?: ApiId | null
  jobTitleId?: ApiId | null
  designationId?: ApiId | null
  departmentId?: ApiId | null
  branchId?: ApiId | null
  employmentTypeId?: ApiId | null
  hiringManagerId?: ApiId | null
  cityId?: ApiId | null
  workMode?: 'on_site' | 'remote' | 'hybrid' | null
  experienceFromYears?: number | null
  experienceToYears?: number | null
  vacancies?: number | null
  postedOn?: string | null
  applyBy?: string | null
  closeOn?: string | null
  salaryFrom?: number | null
  salaryTo?: number | null
  isSalaryVisible?: boolean
  description?: string | null
  requirements?: string | null
  rowVersion?: string | null
}

export interface ApplicantInDto {
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  gender?: 'male' | 'female' | 'other' | null
  dateOfBirth?: string | null
  cityId?: ApiId | null
  address?: string | null
  currentEmployer?: string | null
  currentJobTitle?: string | null
  experienceYears?: number | null
  currentSalary?: number | null
  expectedSalary?: number | null
  noticePeriodDays?: number | null
  highestEducation?: string | null
  linkedinUrl?: string | null
  source?: string | null
  referredByEmployeeId?: ApiId | null
  cvFileId?: ApiId | null
  notes?: string | null
  rowVersion?: string | null
}

/** Apply an existing applicant (`applicantId`) or add a new one in the same call (`applicant`). */
export interface ApplicationInDto {
  jobOpeningId: ApiId
  applicantId?: ApiId | null
  applicant?: ApplicantInDto | null
  appliedOn?: string | null
  source?: string | null
  coverLetter?: string | null
  remarks?: string | null
}

export interface StageInDto {
  stage: 'applied' | 'screening' | 'shortlisted' | 'interview' | 'offer'
  remarks?: string | null
  rowVersion: string
}

export interface RejectInDto {
  rejectionReasonId?: ApiId | null
  remarks?: string | null
  rowVersion: string
}

/** Blank fields take the accepted offer's values, then the opening's. */
export interface HireInDto {
  rowVersion: string
  code?: string | null
  joiningDate?: string | null
  branchId?: ApiId | null
  departmentId?: ApiId | null
  designationId?: ApiId | null
  jobTitleId?: ApiId | null
  employmentTypeId?: ApiId | null
  lineManagerId?: ApiId | null
  salary?: number | null
  status?: 'active' | 'probation' | null
  probationEndDate?: string | null
  cnic?: string | null
  remarks?: string | null
}

export interface InterviewInDto {
  applicationId?: ApiId | null
  title?: string | null
  mode?: 'in_person' | 'phone' | 'video'
  /** ISO date-time with offset. */
  scheduledAt: string
  durationMinutes?: number
  venue?: string | null
  remarks?: string | null
  interviewerIds: ApiId[]
  rowVersion?: string | null
}

export interface CompleteInDto {
  status?: 'completed' | 'no_show'
  result?: 'passed' | 'failed' | 'on_hold' | null
  remarks?: string | null
  rowVersion: string
}

/** An interviewer's rating; saving again replaces it. No row version. */
export interface EvaluationInDto {
  employeeId?: ApiId | null
  rating: number
  recommendation: 'strong_hire' | 'hire' | 'no_hire' | 'strong_no_hire'
  strengths?: string | null
  concerns?: string | null
  comments?: string | null
}

export interface OfferInDto {
  applicationId?: ApiId | null
  jobTitleId?: ApiId | null
  designationId?: ApiId | null
  departmentId?: ApiId | null
  branchId?: ApiId | null
  employmentTypeId?: ApiId | null
  offeredSalary: number
  salaryFrequency?: 'monthly' | 'daily' | 'hourly'
  joiningDate: string
  probationMonths?: number | null
  expiresOn?: string | null
  offerLetterFileId?: ApiId | null
  remarks?: string | null
  rowVersion?: string | null
}

export interface RespondInDto {
  decision: 'accepted' | 'declined'
  remarks?: string | null
  rowVersion: string
}

export interface RejectionReasonInDto {
  name: string
  isActive?: boolean
  sortOrder?: number | null
  rowVersion?: string | null
}
