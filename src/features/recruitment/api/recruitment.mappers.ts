import type { FileRef } from '@/lib/files'

import {
  type Applicant,
  type ApplicantDetail,
  type Application,
  type ApplicationDetail,
  type Evaluation,
  GENDERS,
  type Interview,
  INTERVIEW_MODES,
  INTERVIEW_RESULTS,
  type InterviewDetail,
  type InterviewStatus,
  type Offer,
  type OfferStatus,
  type Opening,
  type OpeningStatus,
  RECOMMENDATIONS,
  type RecruitmentDashboard,
  type RejectionReason,
  SALARY_FREQUENCIES,
  SOURCES,
  type Stage,
  STAGES,
  WORK_MODES,
} from '../types/recruitment.types'
import type {
  ApiId,
  ApplicantDetailOutDto,
  ApplicantOutDto,
  ApplicationDetailOutDto,
  ApplicationOutDto,
  DashboardOutDto,
  InterviewDetailOutDto,
  InterviewOutDto,
  OfferOutDto,
  OpeningOutDto,
  RejectionReasonOutDto,
} from './recruitment.dto'

/** Numeric ids go out as numbers (the API's integers); anything else (a mock id) as it is. */
export const toApiId = (id: string): ApiId => (/^\d+$/.test(id) ? Number(id) : id)

/** `toApiId` for an optional picker value ('' or null: nothing chosen). */
export const toOptionalId = (id: string | null | undefined): ApiId | null =>
  id ? toApiId(id) : null

/** The API writes UTC instants without an offset; read them as UTC. */
export function instant(value: string): string
export function instant(value: string | null | undefined): string | null
export function instant(value: string | null | undefined): string | null {
  if (!value) return null
  if (!/T\d{2}:\d{2}/.test(value)) return value
  return /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`
}

/** A value from a known list, or `null` for nothing / something the screens do not know. */
function oneOf<T extends string>(list: readonly T[], value: string | null | undefined): T | null {
  return value && (list as readonly string[]).includes(value) ? (value as T) : null
}

const stageOf = (value: string): Stage => oneOf(STAGES, value) ?? 'applied'

/**
 * Opening statuses are open strings in the spec: `open` is the published state; a few names the
 * backend might use for the same states are read as these four.
 */
export function openingStatusOf(value: string): OpeningStatus {
  switch (value) {
    case 'open':
    case 'published':
    case 'active':
      return 'open'
    case 'on_hold':
    case 'hold':
    case 'held':
    case 'paused':
      return 'on_hold'
    case 'closed':
    case 'filled':
    case 'cancelled':
      return 'closed'
    default:
      return 'draft'
  }
}

export function interviewStatusOf(value: string): InterviewStatus {
  if (value === 'completed' || value === 'no_show') return value
  if (value === 'cancelled' || value === 'canceled') return 'cancelled'
  return 'scheduled'
}

export function offerStatusOf(value: string | null): OfferStatus | null {
  if (!value) return null
  if (value === 'canceled' || value === 'cancelled') return 'withdrawn'
  if (value === 'rejected') return 'declined'
  return oneOf(['draft', 'sent', 'accepted', 'declined', 'withdrawn', 'expired'] as const, value)
}

const fileOf = (file: FileRef | null | undefined): FileRef | null => file ?? null

export const toOpening = (dto: OpeningOutDto): Opening => ({
  ...dto,
  status: openingStatusOf(dto.status),
  workMode: oneOf(WORK_MODES, dto.workMode),
  publishedAt: instant(dto.publishedAt),
  closedAt: instant(dto.closedAt),
  createdAt: instant(dto.createdAt),
  updatedAt: instant(dto.updatedAt),
})

export const toApplicant = (dto: ApplicantOutDto): Applicant => ({
  ...dto,
  gender: oneOf(GENDERS, dto.gender),
  source: oneOf(SOURCES, dto.source),
  cv: fileOf(dto.cv),
  createdAt: instant(dto.createdAt),
  updatedAt: instant(dto.updatedAt),
})

export const toApplication = (dto: ApplicationOutDto): Application => ({
  ...dto,
  cv: fileOf(dto.cv),
  source: oneOf(SOURCES, dto.source),
  stage: stageOf(dto.stage),
  rejectedStage: oneOf(STAGES, dto.rejectedStage),
  stageChangedAt: instant(dto.stageChangedAt),
  hiredAt: instant(dto.hiredAt),
  nextInterviewAt: instant(dto.nextInterviewAt),
  evaluationCount: dto.evaluationCount ?? 0,
  latestOfferStatus: offerStatusOf(dto.latestOfferStatus),
  createdAt: instant(dto.createdAt),
  updatedAt: instant(dto.updatedAt),
})

export const toApplicantDetail = (dto: ApplicantDetailOutDto): ApplicantDetail => ({
  ...toApplicant(dto),
  applications: dto.applications.map(toApplication),
})

export const toInterview = (dto: InterviewOutDto): Interview => ({
  ...dto,
  cv: fileOf(dto.cv),
  applicationStage: stageOf(dto.applicationStage),
  mode: oneOf(INTERVIEW_MODES, dto.mode),
  status: interviewStatusOf(dto.status),
  result: oneOf(INTERVIEW_RESULTS, dto.result),
  scheduledAt: instant(dto.scheduledAt),
  endsAt: instant(dto.endsAt),
  createdAt: instant(dto.createdAt),
  updatedAt: instant(dto.updatedAt),
})

export const toInterviewDetail = (dto: InterviewDetailOutDto): InterviewDetail => ({
  ...toInterview(dto),
  interviewers: dto.interviewers,
  evaluations: dto.evaluations.map((row): Evaluation => ({
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    rating: row.rating,
    recommendation: oneOf(RECOMMENDATIONS, row.recommendation) ?? 'hire',
    strengths: row.strengths,
    concerns: row.concerns,
    comments: row.comments,
    evaluatedAt: instant(row.evaluatedAt),
    evaluatedByName: row.evaluatedByName,
  })),
})

/** Today as `yyyy-MM-dd` (local). */
function localToday(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** A draft or sent offer whose expiry day has passed is expired, whatever the record says. */
export function liveOfferStatus(status: OfferStatus, expiresOn: string | null): OfferStatus {
  return (status === 'draft' || status === 'sent') && expiresOn && expiresOn < localToday()
    ? 'expired'
    : status
}

export const toOffer = (dto: OfferOutDto): Offer => ({
  ...dto,
  offerLetter: fileOf(dto.offerLetter),
  applicationStage: stageOf(dto.applicationStage),
  salaryFrequency: oneOf(SALARY_FREQUENCIES, dto.salaryFrequency),
  status: liveOfferStatus(offerStatusOf(dto.status) ?? 'draft', dto.expiresOn),
  sentAt: instant(dto.sentAt),
  respondedAt: instant(dto.respondedAt),
  createdAt: instant(dto.createdAt),
  updatedAt: instant(dto.updatedAt),
})

export const toApplicationDetail = (dto: ApplicationDetailOutDto): ApplicationDetail => ({
  ...toApplication(dto),
  history: dto.history.map((row) => ({
    id: row.id,
    fromStage: oneOf(STAGES, row.fromStage),
    toStage: stageOf(row.toStage),
    changedAt: instant(row.changedAt),
    changedByName: row.changedByName,
    remarks: row.remarks,
  })),
  interviews: dto.interviews.map(toInterview),
  offers: dto.offers.map(toOffer),
})

export const toRejectionReason = (dto: RejectionReasonOutDto): RejectionReason => ({
  ...dto,
  createdAt: instant(dto.createdAt),
  updatedAt: instant(dto.updatedAt),
})

export const toDashboard = (dto: DashboardOutDto): RecruitmentDashboard => ({
  year: dto.year,
  month: dto.month,
  tiles: dto.tiles,
  jobStatistics: dto.jobStatistics,
  upcomingInterviews: dto.upcomingInterviews.map((row) => ({
    ...row,
    mode: oneOf(INTERVIEW_MODES, row.mode),
    scheduledAt: instant(row.scheduledAt),
  })),
  recentActivity: dto.recentActivity.map((row) => ({
    ...row,
    fromStage: oneOf(STAGES, row.fromStage),
    toStage: stageOf(row.toStage),
    changedAt: instant(row.changedAt),
  })),
})
