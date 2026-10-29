import type {
  Gender,
  HireStatus,
  InterviewMode,
  InterviewResult,
  InterviewStatus,
  OfferStatus,
  OpeningStatus,
  Recommendation,
  SalaryFrequency,
  Source,
  Stage,
  WorkMode,
} from './types/recruitment.types'

/**
 * Permission codes. The OpenAPI names none for `/recruitment/…`; these follow the
 * module.screen.action pattern of Payroll and Manpower (`payroll.payslips.view`,
 * `manpower.open_positions.close`) and are assumptions until the catalogue confirms them.
 * In mock mode (no permissions list) every code is granted.
 */
export const RC_CODES = {
  dashboard: 'recruitment.dashboard.view',
  openingsView: 'recruitment.openings.view',
  openingsCreate: 'recruitment.openings.create',
  openingsEdit: 'recruitment.openings.edit',
  openingsDelete: 'recruitment.openings.delete',
  openingsPublish: 'recruitment.openings.publish',
  openingsHold: 'recruitment.openings.hold',
  openingsClose: 'recruitment.openings.close',
  openingsReopen: 'recruitment.openings.reopen',
  applicantsView: 'recruitment.applicants.view',
  applicantsCreate: 'recruitment.applicants.create',
  applicantsEdit: 'recruitment.applicants.edit',
  applicantsDelete: 'recruitment.applicants.delete',
  applicationsView: 'recruitment.applications.view',
  applicationsCreate: 'recruitment.applications.create',
  applicationsDelete: 'recruitment.applications.delete',
  applicationsMove: 'recruitment.applications.move',
  applicationsReject: 'recruitment.applications.reject',
  applicationsWithdraw: 'recruitment.applications.withdraw',
  applicationsHire: 'recruitment.applications.hire',
  interviewsView: 'recruitment.interviews.view',
  interviewsCreate: 'recruitment.interviews.create',
  interviewsEdit: 'recruitment.interviews.edit',
  interviewsCancel: 'recruitment.interviews.cancel',
  interviewsComplete: 'recruitment.interviews.complete',
  interviewsEvaluate: 'recruitment.interviews.evaluate',
  offersView: 'recruitment.offers.view',
  offersCreate: 'recruitment.offers.create',
  offersEdit: 'recruitment.offers.edit',
  offersDelete: 'recruitment.offers.delete',
  offersSend: 'recruitment.offers.send',
  offersRespond: 'recruitment.offers.respond',
  offersWithdraw: 'recruitment.offers.withdraw',
  reasonsView: 'recruitment.settings.rejection_reasons.view',
  reasonsCreate: 'recruitment.settings.rejection_reasons.create',
  reasonsEdit: 'recruitment.settings.rejection_reasons.edit',
  reasonsDelete: 'recruitment.settings.rejection_reasons.delete',
  /** The employee picker's people (hiring manager, interviewers, referrer, line manager). */
  people: 'recruitment.applications.view',
} as const

/** Rows per page on the Recruitment lists. */
export const RC_PAGE_SIZE = 10
/** Cards a board column shows at first, and how many more "Show more" adds. */
export const BOARD_COLUMN_SIZE = 20
/** Interviews read per page (grouped by day). */
export const INTERVIEW_PAGE_SIZE = 20

export interface ChipMeta {
  label: string
  className: string
}

/** The status palette of Payroll, Leaves and Talent Management (light and dark). */
export const TONE = {
  green: 'bg-[#E3F8E8] text-[#2E9E48] dark:bg-green-500/15 dark:text-green-400',
  amber: 'bg-[#FFF3D9] text-[#B7791F] dark:bg-amber-500/15 dark:text-amber-300',
  blue: 'bg-[#EBEFF8] text-[#263871] dark:bg-sky-500/15 dark:text-sky-300',
  violet: 'bg-[#EFEAFF] text-[#5B3FD9] dark:bg-violet-500/15 dark:text-violet-300',
  orange: 'bg-[#FFEDE0] text-[#C2560C] dark:bg-orange-500/15 dark:text-orange-300',
  red: 'bg-[#FFE3E3] text-[#D83838] dark:bg-red-500/15 dark:text-red-300',
  grey: 'bg-[#EFEFEF] text-[#5C5C5C] dark:bg-muted dark:text-muted-foreground',
} as const

export const OPENING_STATUS_META: Record<OpeningStatus, ChipMeta> = {
  draft: { label: 'Draft', className: TONE.grey },
  open: { label: 'Open', className: TONE.green },
  on_hold: { label: 'On Hold', className: TONE.amber },
  closed: { label: 'Closed', className: TONE.red },
}

export const STAGE_META: Record<Stage, ChipMeta> = {
  applied: { label: 'Applied', className: TONE.blue },
  screening: { label: 'Screening', className: TONE.amber },
  shortlisted: { label: 'Shortlisted', className: TONE.violet },
  interview: { label: 'Interview', className: TONE.orange },
  offer: { label: 'Offer', className: TONE.violet },
  hired: { label: 'Hired', className: TONE.green },
  rejected: { label: 'Rejected', className: TONE.red },
  withdrawn: { label: 'Withdrawn', className: TONE.grey },
}

/** The stage colours as plain swatches (board column bars, the pipeline chart). */
export const STAGE_COLOUR: Record<Stage, string> = {
  applied: '#4F6BED',
  screening: '#F5A035',
  shortlisted: '#8B5CF6',
  interview: '#F2683B',
  offer: '#6D4AFF',
  hired: '#2CBD4D',
  rejected: '#E25563',
  withdrawn: '#9AA4B0',
}

export const INTERVIEW_STATUS_META: Record<InterviewStatus, ChipMeta> = {
  scheduled: { label: 'Scheduled', className: TONE.blue },
  completed: { label: 'Completed', className: TONE.green },
  no_show: { label: 'No Show', className: TONE.orange },
  cancelled: { label: 'Cancelled', className: TONE.red },
}

export const INTERVIEW_RESULT_META: Record<InterviewResult, ChipMeta> = {
  passed: { label: 'Passed', className: TONE.green },
  failed: { label: 'Failed', className: TONE.red },
  on_hold: { label: 'On Hold', className: TONE.amber },
}

export const OFFER_STATUS_META: Record<OfferStatus, ChipMeta> = {
  draft: { label: 'Draft', className: TONE.grey },
  sent: { label: 'Sent', className: TONE.blue },
  accepted: { label: 'Accepted', className: TONE.green },
  declined: { label: 'Declined', className: TONE.red },
  withdrawn: { label: 'Withdrawn', className: TONE.grey },
  expired: { label: 'Expired', className: TONE.amber },
}

export const INTERVIEW_MODE_LABELS: Record<InterviewMode, string> = {
  in_person: 'In Person',
  phone: 'Phone',
  video: 'Video Call',
}

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  strong_hire: 'Strong Hire',
  hire: 'Hire',
  no_hire: 'No Hire',
  strong_no_hire: 'Strong No Hire',
}

export const RECOMMENDATION_META: Record<Recommendation, ChipMeta> = {
  strong_hire: { label: 'Strong Hire', className: TONE.green },
  hire: { label: 'Hire', className: TONE.green },
  no_hire: { label: 'No Hire', className: TONE.red },
  strong_no_hire: { label: 'Strong No Hire', className: TONE.red },
}

export const SOURCE_LABELS: Record<Source, string> = {
  career_site: 'Career Site',
  referral: 'Referral',
  job_board: 'Job Board',
  linkedin: 'LinkedIn',
  walk_in: 'Walk-in',
  agency: 'Agency',
  other: 'Other',
}

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  on_site: 'On-site',
  remote: 'Remote',
  hybrid: 'Hybrid',
}

export const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
}

export const SALARY_FREQUENCY_LABELS: Record<SalaryFrequency, string> = {
  monthly: 'Monthly',
  daily: 'Daily',
  hourly: 'Hourly',
}

export const HIRE_STATUS_LABELS: Record<HireStatus, string> = {
  probation: 'On Probation',
  active: 'Active',
}
