import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { compact, recruitmentApi } from '../api/recruitment.api'
import type {
  ApplicantFilters,
  ApplicationFilters,
  InterviewFilters,
  OfferFilters,
  OpeningFilters,
  PageQuery,
} from '../types/recruitment.types'

/** Query keys: everything under `['recruitment']`, so one invalidation refreshes the module. */
export const recruitmentKeys = {
  all: ['recruitment'] as const,
  dashboard: (params: object) => [...recruitmentKeys.all, 'dashboard', compact(params)] as const,
  stageCounts: (params: object) =>
    [...recruitmentKeys.all, 'stage-counts', compact(params)] as const,
  list: (name: string, params: object) => [...recruitmentKeys.all, name, compact(params)] as const,
  detail: (name: string, id: string) => [...recruitmentKeys.all, name, 'detail', id] as const,
  lookup: (name: string) => [...recruitmentKeys.all, 'lookup', name] as const,
}

export const dashboardQueryOptions = (params: { year: number; month?: number | undefined }) =>
  queryOptions({
    queryKey: recruitmentKeys.dashboard(params),
    queryFn: ({ signal }) => recruitmentApi.dashboard(params, signal),
    placeholderData: keepPreviousData,
  })

export const stageCountsQueryOptions = (filters: ApplicationFilters) =>
  queryOptions({
    queryKey: recruitmentKeys.stageCounts(filters),
    queryFn: ({ signal }) => recruitmentApi.stageCounts(filters, signal),
    placeholderData: keepPreviousData,
  })

export const openingsQueryOptions = (params: OpeningFilters & PageQuery) =>
  queryOptions({
    queryKey: recruitmentKeys.list('openings', params),
    queryFn: ({ signal }) => recruitmentApi.openings(params, signal),
    placeholderData: keepPreviousData,
  })

export const openingQueryOptions = (id: string) =>
  queryOptions({
    queryKey: recruitmentKeys.detail('openings', id),
    queryFn: ({ signal }) => recruitmentApi.opening(id, signal),
  })

export const applicantsQueryOptions = (params: ApplicantFilters & PageQuery) =>
  queryOptions({
    queryKey: recruitmentKeys.list('applicants', params),
    queryFn: ({ signal }) => recruitmentApi.applicants(params, signal),
    placeholderData: keepPreviousData,
  })

export const applicantQueryOptions = (id: string) =>
  queryOptions({
    queryKey: recruitmentKeys.detail('applicants', id),
    queryFn: ({ signal }) => recruitmentApi.applicant(id, signal),
  })

export const applicationsQueryOptions = (params: ApplicationFilters & PageQuery) =>
  queryOptions({
    queryKey: recruitmentKeys.list('applications', params),
    queryFn: ({ signal }) => recruitmentApi.applications(params, signal),
    placeholderData: keepPreviousData,
  })

export const applicationQueryOptions = (id: string) =>
  queryOptions({
    queryKey: recruitmentKeys.detail('applications', id),
    queryFn: ({ signal }) => recruitmentApi.application(id, signal),
  })

export const interviewsQueryOptions = (params: InterviewFilters & PageQuery) =>
  queryOptions({
    queryKey: recruitmentKeys.list('interviews', params),
    queryFn: ({ signal }) => recruitmentApi.interviews(params, signal),
    placeholderData: keepPreviousData,
  })

export const interviewQueryOptions = (id: string) =>
  queryOptions({
    queryKey: recruitmentKeys.detail('interviews', id),
    queryFn: ({ signal }) => recruitmentApi.interview(id, signal),
  })

export const offersQueryOptions = (params: OfferFilters & PageQuery) =>
  queryOptions({
    queryKey: recruitmentKeys.list('offers', params),
    queryFn: ({ signal }) => recruitmentApi.offers(params, signal),
    placeholderData: keepPreviousData,
  })

export const offerQueryOptions = (id: string) =>
  queryOptions({
    queryKey: recruitmentKeys.detail('offers', id),
    queryFn: ({ signal }) => recruitmentApi.offer(id, signal),
  })

export const rejectionReasonsQueryOptions = (params: {
  q?: string | undefined
  activeOnly?: boolean
}) =>
  queryOptions({
    queryKey: recruitmentKeys.list('rejection-reasons', params),
    queryFn: ({ signal }) => recruitmentApi.rejectionReasons(params, signal),
    placeholderData: keepPreviousData,
  })
