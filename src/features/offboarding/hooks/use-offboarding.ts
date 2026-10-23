import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  type ChecklistFilters,
  type EoeFilters,
  type ImportResult,
  offboardingApi,
  offboardingKeys,
  offboardingListQueryOptions,
  offboardingLookupsQueryOptions,
  type PageQuery,
} from '../api/offboarding.api'
import type { ChecklistInput, EndOfEmploymentInput, EoeImportRow } from '../types/offboarding.types'

// --- queries ------------------------------------------------------------------------------------

export const useOffboardingLookups = () => useQuery(offboardingLookupsQueryOptions())

export const useEmployeeCard = (employeeId: string | null) =>
  useQuery({
    queryKey: offboardingKeys.detail('card', employeeId ?? ''),
    queryFn: ({ signal }) => offboardingApi.employeeCard(employeeId ?? '', signal),
    enabled: employeeId !== null,
  })

export const useEndOfEmployments = (params: PageQuery<EoeFilters>) =>
  useQuery(
    offboardingListQueryOptions('end-of-employment', params, offboardingApi.endOfEmployments),
  )

export const useEndOfEmployment = (id: string | null) =>
  useQuery({
    queryKey: offboardingKeys.detail('end-of-employment', id ?? ''),
    queryFn: ({ signal }) => offboardingApi.endOfEmployment(id ?? '', signal),
    enabled: id !== null,
  })

export const useChecklists = (params: PageQuery<ChecklistFilters>) =>
  useQuery(offboardingListQueryOptions('checklists', params, offboardingApi.checklists))

export const useChecklist = (id: string | null) =>
  useQuery({
    queryKey: offboardingKeys.detail('checklist', id ?? ''),
    queryFn: ({ signal }) => offboardingApi.checklist(id ?? '', signal),
    enabled: id !== null,
  })

// --- mutations ----------------------------------------------------------------------------------

/**
 * An Off Boarding change. End of Employment makes Final Settlements (Payroll)
 * and clearance forms (Assets), so those refetch too.
 */
export function useOffboardingMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  message: ((variables: TVariables, result: TResult) => string) | null,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { suppressErrorToast: true },
    onSuccess: async (result, variables) => {
      if (message) toast.success(message(variables, result))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: offboardingKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['assets'] }),
        queryClient.invalidateQueries({ queryKey: ['payroll'] }),
      ])
    },
  })
}

export const useSaveEndOfEmployment = () =>
  useOffboardingMutation(
    ({ id, input }: { id?: string | undefined; input: EndOfEmploymentInput }) =>
      id
        ? offboardingApi.updateEndOfEmployment(id, input)
        : offboardingApi.createEndOfEmployment(input),
    ({ id }) => (id ? 'End of employment updated' : 'End of employment created'),
  )

export const useDeleteEndOfEmployment = () =>
  useOffboardingMutation(
    (id: string) => offboardingApi.deleteEndOfEmployment(id),
    () => 'End of employment deleted',
  )

export const useRehire = () =>
  useOffboardingMutation(
    ({ id, joiningDate }: { id: string; joiningDate: string }) =>
      offboardingApi.rehire(id, joiningDate),
    (_variables, result) => `${result.card.name} rehired`,
  )

export const useImportEndOfEmployments = () =>
  useOffboardingMutation(
    (rows: EoeImportRow[]) => offboardingApi.importEndOfEmployments(rows),
    (_variables, result: ImportResult) =>
      result.errors.length > 0
        ? `${String(result.created)} imported, ${String(result.errors.length)} with errors`
        : `${String(result.created)} imported`,
  )

export const useSaveChecklist = () =>
  useOffboardingMutation(
    ({ id, input }: { id?: string | undefined; input: ChecklistInput }) =>
      id ? offboardingApi.updateChecklist(id, input) : offboardingApi.createChecklist(input),
    ({ id }) => (id ? 'Checklist updated' : 'Checklist created'),
  )
