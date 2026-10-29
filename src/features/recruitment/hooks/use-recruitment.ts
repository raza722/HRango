import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { type OpeningAction, recruitmentApi } from '../api/recruitment.api'
import type {
  ApplicantInDto,
  ApplicationInDto,
  CompleteInDto,
  EvaluationInDto,
  HireInDto,
  InterviewInDto,
  OfferInDto,
  OpeningInDto,
  RejectInDto,
  RejectionReasonInDto,
  RespondInDto,
  StageInDto,
} from '../api/recruitment.dto'
import { STAGE_META } from '../constants'
import type {
  ApplicantFilters,
  ApplicationFilters,
  InterviewFilters,
  OfferFilters,
  OpeningFilters,
  PageQuery,
  Versioned,
} from '../types/recruitment.types'
import {
  applicantQueryOptions,
  applicantsQueryOptions,
  applicationQueryOptions,
  applicationsQueryOptions,
  dashboardQueryOptions,
  interviewQueryOptions,
  interviewsQueryOptions,
  offerQueryOptions,
  offersQueryOptions,
  openingQueryOptions,
  openingsQueryOptions,
  recruitmentKeys,
  rejectionReasonsQueryOptions,
  stageCountsQueryOptions,
} from './recruitment.keys'

// --- queries ------------------------------------------------------------------------------------

/** The dashboard for a year (and month). */
export const useRecruitmentDashboard = (params: { year: number; month?: number | undefined }) =>
  useQuery(dashboardQueryOptions(params))

/** Applications per stage under the given filters; `enabled` false skips the reads. */
export const useStageCounts = (filters: ApplicationFilters, enabled = true) =>
  useQuery({ ...stageCountsQueryOptions(filters), enabled })

export const useOpenings = (params: OpeningFilters & PageQuery) =>
  useQuery(openingsQueryOptions(params))

/** One opening; `null` skips the request. */
export const useOpening = (id: string | null) =>
  useQuery({ ...openingQueryOptions(id ?? ''), enabled: id !== null })

export const useApplicants = (params: ApplicantFilters & PageQuery, enabled = true) =>
  useQuery({ ...applicantsQueryOptions(params), enabled })

/** One applicant with their applications; `null` skips the request. */
export const useApplicant = (id: string | null) =>
  useQuery({ ...applicantQueryOptions(id ?? ''), enabled: id !== null })

export const useApplications = (params: ApplicationFilters & PageQuery, enabled = true) =>
  useQuery({ ...applicationsQueryOptions(params), enabled })

/** One application with its timeline, interviews and offers; `null` skips the request. */
export const useApplication = (id: string | null) =>
  useQuery({ ...applicationQueryOptions(id ?? ''), enabled: id !== null })

export const useInterviews = (params: InterviewFilters & PageQuery) =>
  useQuery(interviewsQueryOptions(params))

/** One interview with its interviewers and evaluations; `null` skips the request. */
export const useInterview = (id: string | null) =>
  useQuery({ ...interviewQueryOptions(id ?? ''), enabled: id !== null })

export const useOffers = (params: OfferFilters & PageQuery) => useQuery(offersQueryOptions(params))

/** One offer; `null` skips the request. */
export const useOffer = (id: string | null) =>
  useQuery({ ...offerQueryOptions(id ?? ''), enabled: id !== null })

export const useRejectionReasons = (
  params: { q?: string | undefined; activeOnly?: boolean } = {},
  enabled = true,
) => useQuery({ ...rejectionReasonsQueryOptions(params), enabled })

// --- mutations ----------------------------------------------------------------------------------

interface MutationOptions {
  /** Toast the API's message on failure (actions with no form); forms show it on their fields. */
  toastErrors?: boolean
  /** Also refresh Talent Management's employees (a hire adds someone). */
  employees?: boolean
}

/**
 * A Recruitment change: toasts its success, then refetches every Recruitment query (lists,
 * details, the board and the dashboard), as most actions change counts on other screens.
 */
function useRecruitmentMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  successMessage: string | ((variables: TVariables, result: TResult) => string),
  { toastErrors = false, employees = false }: MutationOptions = {},
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { suppressErrorToast: !toastErrors },
    onSuccess: async (result, variables) => {
      toast.success(
        typeof successMessage === 'string' ? successMessage : successMessage(variables, result),
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: recruitmentKeys.all }),
        employees ? queryClient.invalidateQueries({ queryKey: ['employees'] }) : null,
      ])
    },
  })
}

// Openings

/** Create (`POST /openings`) or Edit (`PUT /openings/{id}` with its rowVersion). */
export const useSaveOpening = () =>
  useRecruitmentMutation(
    ({ id, input }: { id?: string | undefined; input: OpeningInDto }) =>
      id ? recruitmentApi.updateOpening(id, input) : recruitmentApi.createOpening(input),
    ({ id }) => (id ? 'Opening updated' : 'Opening created'),
  )

export const useDeleteOpening = () =>
  useRecruitmentMutation(
    (record: Versioned) => recruitmentApi.deleteOpening(record),
    'Opening deleted',
    {
      toastErrors: true,
    },
  )

const ACTION_DONE: Record<OpeningAction, string> = {
  publish: 'published',
  hold: 'put on hold',
  close: 'closed',
  reopen: 'reopened',
}

/** Publish, Hold, Close or Reopen (`POST /openings/{id}/<action> {rowVersion}`). */
export const useOpeningAction = () =>
  useRecruitmentMutation(
    ({ record, action }: { record: Versioned & { title: string }; action: OpeningAction }) =>
      recruitmentApi.openingAction(record, action),
    ({ record, action }) => `${record.title} ${ACTION_DONE[action]}`,
    { toastErrors: true },
  )

// Applicants

export const useSaveApplicant = () =>
  useRecruitmentMutation(
    ({ id, input }: { id?: string | undefined; input: ApplicantInDto }) =>
      id ? recruitmentApi.updateApplicant(id, input) : recruitmentApi.createApplicant(input),
    ({ id }) => (id ? 'Candidate updated' : 'Candidate added'),
  )

export const useDeleteApplicant = () =>
  useRecruitmentMutation(
    (record: Versioned) => recruitmentApi.deleteApplicant(record),
    'Candidate deleted',
    { toastErrors: true },
  )

// Applications

export const useCreateApplication = () =>
  useRecruitmentMutation(
    (input: ApplicationInDto) => recruitmentApi.createApplication(input),
    'Application added',
  )

export const useDeleteApplication = () =>
  useRecruitmentMutation(
    (record: Versioned) => recruitmentApi.deleteApplication(record),
    'Application deleted',
    { toastErrors: true },
  )

/** Move to another stage (`PATCH …/stage`); errors toast (the board has no form). */
export const useMoveApplication = () =>
  useRecruitmentMutation(
    ({ record, body }: { record: Versioned; body: Omit<StageInDto, 'rowVersion'> }) =>
      recruitmentApi.moveApplication(record, body),
    (_variables, result) => `${result.applicantName} moved to ${STAGE_META[result.stage].label}`,
    { toastErrors: true },
  )

export const useRejectApplication = () =>
  useRecruitmentMutation(
    ({ record, body }: { record: Versioned; body: Omit<RejectInDto, 'rowVersion'> }) =>
      recruitmentApi.rejectApplication(record, body),
    (_variables, result) => `${result.applicantName} rejected`,
  )

export const useWithdrawApplication = () =>
  useRecruitmentMutation(
    ({ record, remarks }: { record: Versioned; remarks: string | null }) =>
      recruitmentApi.withdrawApplication(record, remarks),
    (_variables, result) => `${result.applicantName}'s application withdrawn`,
  )

/** Hire: creates the employee (Talent Management) from the application. */
export const useHireApplication = () =>
  useRecruitmentMutation(
    ({ record, body }: { record: Versioned; body: Omit<HireInDto, 'rowVersion'> }) =>
      recruitmentApi.hireApplication(record, body),
    (_variables, result) =>
      `${result.applicantName} hired${result.employeeCode ? ` as ${result.employeeCode}` : ''}`,
    { employees: true },
  )

// Interviews

export const useSaveInterview = () =>
  useRecruitmentMutation(
    ({ id, input }: { id?: string | undefined; input: InterviewInDto }) =>
      id ? recruitmentApi.updateInterview(id, input) : recruitmentApi.createInterview(input),
    ({ id }) => (id ? 'Interview updated' : 'Interview scheduled'),
  )

export const useCancelInterview = () =>
  useRecruitmentMutation(
    ({ record, remarks }: { record: Versioned; remarks: string | null }) =>
      recruitmentApi.cancelInterview(record, remarks),
    'Interview cancelled',
  )

export const useCompleteInterview = () =>
  useRecruitmentMutation(
    ({ record, body }: { record: Versioned; body: Omit<CompleteInDto, 'rowVersion'> }) =>
      recruitmentApi.completeInterview(record, body),
    (variables) =>
      variables.body.status === 'no_show' ? 'Marked as no show' : 'Interview completed',
  )

/** An interviewer's rating and recommendation (saving again replaces it). */
export const useEvaluateInterview = () =>
  useRecruitmentMutation(
    ({ id, body }: { id: string; body: EvaluationInDto }) =>
      recruitmentApi.evaluateInterview(id, body),
    'Evaluation saved',
  )

// Offers

export const useSaveOffer = () =>
  useRecruitmentMutation(
    ({ id, input }: { id?: string | undefined; input: OfferInDto }) =>
      id ? recruitmentApi.updateOffer(id, input) : recruitmentApi.createOffer(input),
    ({ id }) => (id ? 'Offer updated' : 'Offer created'),
  )

export const useDeleteOffer = () =>
  useRecruitmentMutation(
    (record: Versioned) => recruitmentApi.deleteOffer(record),
    'Offer deleted',
    {
      toastErrors: true,
    },
  )

export const useSendOffer = () =>
  useRecruitmentMutation(
    ({ record, remarks }: { record: Versioned; remarks: string | null }) =>
      recruitmentApi.sendOffer(record, remarks),
    (_variables, result) => `Offer sent to ${result.applicantName}`,
  )

export const useRespondOffer = () =>
  useRecruitmentMutation(
    ({ record, body }: { record: Versioned; body: Omit<RespondInDto, 'rowVersion'> }) =>
      recruitmentApi.respondOffer(record, body),
    (variables) => (variables.body.decision === 'accepted' ? 'Offer accepted' : 'Offer declined'),
  )

export const useWithdrawOffer = () =>
  useRecruitmentMutation(
    ({ record, remarks }: { record: Versioned; remarks: string | null }) =>
      recruitmentApi.withdrawOffer(record, remarks),
    'Offer withdrawn',
  )

// Settings → Rejection Reasons

export const useSaveRejectionReason = () =>
  useRecruitmentMutation(
    ({ id, input }: { id?: string | undefined; input: RejectionReasonInDto }) =>
      id
        ? recruitmentApi.updateRejectionReason(id, input)
        : recruitmentApi.createRejectionReason(input),
    ({ id }) => (id ? 'Rejection reason updated' : 'Rejection reason added'),
  )

export const useDeleteRejectionReason = () =>
  useRecruitmentMutation(
    (record: Versioned) => recruitmentApi.deleteRejectionReason(record),
    'Rejection reason deleted',
    { toastErrors: true },
  )
