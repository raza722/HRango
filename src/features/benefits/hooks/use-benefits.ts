import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  benefitKeys,
  benefitListQueryOptions,
  benefitsApi,
  benefitsLookupsQueryOptions,
  benefitsSummaryQueryOptions,
  type EmployeeFilter,
  type YearFilter,
} from '../api/benefits.api'
import { categoryMeta } from '../constants'
import type {
  BenefitProfileInput,
  EnrollmentWindowInput,
  PlanInput,
  PlanYearInput,
} from '../types/benefits.types'

// --- queries ------------------------------------------------------------------------------------

/** The stats row's counts (and the Employees tab's). */
export const useBenefitsSummary = () => useQuery(benefitsSummaryQueryOptions())

/** Plan years, plans, people and carriers for the pickers. */
export const useBenefitsLookups = () => useQuery(benefitsLookupsQueryOptions())

export const usePlanYears = (filter: YearFilter) =>
  useQuery(benefitListQueryOptions('plan-years', filter, benefitsApi.planYears))

export const usePlanYear = (id: string | null) =>
  useQuery({
    queryKey: benefitKeys.detail('plan-year', id ?? ''),
    queryFn: ({ signal }) => benefitsApi.planYear(id ?? '', signal),
    enabled: id !== null,
  })

export const usePlans = (filter: YearFilter) =>
  useQuery(benefitListQueryOptions('plans', filter, benefitsApi.plans))

export const useEnrollmentWindows = (filter: YearFilter) =>
  useQuery(benefitListQueryOptions('enrollment-windows', filter, benefitsApi.enrollmentWindows))

export const useBenefitEmployees = (filter: EmployeeFilter) =>
  useQuery(benefitListQueryOptions('employees', filter, benefitsApi.employees))

export const useBenefitFiles = (filter: YearFilter) =>
  useQuery(benefitListQueryOptions('files', filter, benefitsApi.files))

// --- mutations ----------------------------------------------------------------------------------

/**
 * A Benefits change: toasts its message and refetches every Benefits list (the counts in the
 * stats row and the plan year rows depend on one another). Errors are left to the caller.
 */
export function useBenefitsMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  message: (variables: TVariables, result: TResult) => string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { suppressErrorToast: true },
    onSuccess: async (result, variables) => {
      toast.success(message(variables, result))
      await queryClient.invalidateQueries({ queryKey: benefitKeys.all })
    },
  })
}

export const useSavePlanYear = () =>
  useBenefitsMutation(
    ({ id, input }: { id?: string | undefined; input: PlanYearInput }) =>
      id ? benefitsApi.updatePlanYear(id, input) : benefitsApi.createPlanYear(input),
    ({ id }) => (id ? 'Plan year updated' : 'Plan year created'),
  )

export const useDeletePlanYear = () =>
  useBenefitsMutation(
    (id: string) => benefitsApi.deletePlanYear(id),
    () => 'Plan year deleted',
  )

export const useCreatePlan = () =>
  useBenefitsMutation(
    (input: PlanInput) => benefitsApi.createPlan(input),
    (input) => `${categoryMeta(input.category).title} plan added`,
  )

export const useDuplicatePlan = () =>
  useBenefitsMutation(
    (id: string) => benefitsApi.duplicatePlan(id),
    (_id, result) => `${result.name} added`,
  )

export const useDeletePlan = () =>
  useBenefitsMutation(
    (id: string) => benefitsApi.deletePlan(id),
    () => 'Plan deleted',
  )

export const useCreateEnrollmentWindow = () =>
  useBenefitsMutation(
    (input: EnrollmentWindowInput) => benefitsApi.createEnrollmentWindow(input),
    () => 'Enrollment window created',
  )

export const useDeleteEnrollmentWindow = () =>
  useBenefitsMutation(
    (id: string) => benefitsApi.deleteEnrollmentWindow(id),
    () => 'Enrollment window deleted',
  )

export const useUpdateProfile = () =>
  useBenefitsMutation(
    ({ id, input }: { id: string; input: BenefitProfileInput }) =>
      benefitsApi.updateProfile(id, input),
    () => 'Information updated',
  )
