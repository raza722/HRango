import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { uploadFile } from '@/lib/files'

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
  EnrollmentWindowInput,
  PlanInput,
  PlanYearInput,
  ProfileChanges,
} from '../types/benefits.types'

interface Versioned {
  id: string
  rowVersion: string
}

// --- queries ------------------------------------------------------------------------------------

/** The stats row's counts (and the Employees tab's). */
export const useBenefitsSummary = () => useQuery(benefitsSummaryQueryOptions())

/** Plan years, plans and people for the pickers. */
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
    (year: Versioned) => benefitsApi.deletePlanYear(year),
    () => 'Plan year deleted',
  )

/**
 * Add Plan: the plan, then its attachment (uploaded and attached). A failed attachment leaves
 * the plan saved and says so.
 */
export const useCreatePlan = () =>
  useBenefitsMutation(
    async ({ input, attachment }: { input: PlanInput; attachment: File | null }) => {
      const plan = await benefitsApi.createPlan(input)
      if (!attachment) return { plan, attached: true }
      try {
        const uploaded = await uploadFile(attachment, 'benefits')
        await benefitsApi.addPlanFile(plan.id, uploaded.id)
        return { plan, attached: true }
      } catch {
        return { plan, attached: false }
      }
    },
    ({ input }, result) =>
      result.attached
        ? `${categoryMeta(input.category).title} plan added`
        : `${categoryMeta(input.category).title} plan added, but its attachment could not be uploaded`,
  )

export const useDuplicatePlan = () =>
  useBenefitsMutation(
    (id: string) => benefitsApi.duplicatePlan(id),
    (_id, result) => `${result.name} added`,
  )

export const useDeletePlan = () =>
  useBenefitsMutation(
    (plan: Versioned) => benefitsApi.deletePlan(plan),
    () => 'Plan deleted',
  )

export const useAddPlanFile = () =>
  useBenefitsMutation(
    async ({ planId, file }: { planId: string; file: File }) => {
      const uploaded = await uploadFile(file, 'benefits')
      return benefitsApi.addPlanFile(planId, uploaded.id)
    },
    () => 'File added',
  )

export const useDeleteFile = () =>
  useBenefitsMutation(
    (file: Versioned) => benefitsApi.deleteFile(file),
    () => 'File removed',
  )

export const useCreateEnrollmentWindow = () =>
  useBenefitsMutation(
    (input: EnrollmentWindowInput) => benefitsApi.createEnrollmentWindow(input),
    () => 'Enrollment window created',
  )

export const useDeleteEnrollmentWindow = () =>
  useBenefitsMutation(
    (window: Versioned) => benefitsApi.deleteEnrollmentWindow(window),
    () => 'Enrollment window deleted',
  )

export const useRequestProfileUpdate = () =>
  useBenefitsMutation(
    ({ id, changes }: { id: string; changes: ProfileChanges }) =>
      benefitsApi.requestProfileUpdate(id, changes),
    () => 'Update sent to HR for approval',
  )
