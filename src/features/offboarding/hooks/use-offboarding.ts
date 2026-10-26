import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  type ChecklistFilters,
  type EoeFilters,
  offboardingApi,
  offboardingKeys,
  offboardingListQueryOptions,
  type PageQuery,
  type Versioned,
} from '../api/offboarding.api'
import type {
  ChecklistAnswersInput,
  ChecklistInput,
  EndOfEmployment,
  EndOfEmploymentInput,
} from '../types/offboarding.types'

// --- queries ------------------------------------------------------------------------------------

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

export const useChecklistFields = () =>
  useQuery({
    queryKey: offboardingKeys.checklistFields(),
    queryFn: ({ signal }) => offboardingApi.checklistFields(signal),
    staleTime: 30_000,
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

export interface SaveEndOfEmploymentVariables {
  id?: string | undefined
  input: EndOfEmploymentInput
  /** Checklist tab answers; saved after the record (they need its id and rowVersion). */
  answers: ChecklistAnswersInput['answers'] | null
}

/**
 * Saves the record, then its Checklist tab answers. If the answers fail after the record was
 * made, the error carries the saved record so the dialog can switch to editing it.
 */
export class AnswersNotSavedError extends Error {
  readonly record: EndOfEmployment
  readonly failure: unknown

  constructor(record: EndOfEmployment, failure: unknown) {
    super('The record was saved, but its checklist answers were not.')
    this.record = record
    this.failure = failure
  }
}

export const useSaveEndOfEmployment = () =>
  useOffboardingMutation(
    async ({ id, input, answers }: SaveEndOfEmploymentVariables) => {
      const record = id
        ? await offboardingApi.updateEndOfEmployment(id, input)
        : await offboardingApi.createEndOfEmployment(input)
      if (!answers || answers.length === 0) return record
      try {
        return await offboardingApi.saveChecklistAnswers(record.id, {
          answers,
          rowVersion: record.rowVersion,
        })
      } catch (failure) {
        throw new AnswersNotSavedError(record, failure)
      }
    },
    ({ id }) => (id ? 'End of employment updated' : 'End of employment created'),
  )

export const useDeleteEndOfEmployment = () =>
  useOffboardingMutation(
    (record: Versioned) => offboardingApi.deleteEndOfEmployment(record),
    () => 'End of employment deleted',
  )

export const useCompleteEndOfEmployment = () =>
  useOffboardingMutation(
    (record: Versioned) => offboardingApi.completeEndOfEmployment(record),
    () => 'End of employment completed',
  )

export const useRehire = () =>
  useOffboardingMutation(
    ({ record, joiningDate }: { record: Versioned; joiningDate: string }) =>
      offboardingApi.rehire(record, joiningDate),
    (_variables, result) => `${result.employeeName ?? 'The employee'} rehired`,
  )

export const useSaveChecklist = () =>
  useOffboardingMutation(
    ({ id, input }: { id?: string | undefined; input: ChecklistInput }) =>
      id ? offboardingApi.updateChecklist(id, input) : offboardingApi.createChecklist(input),
    ({ id }) => (id ? 'Checklist updated' : 'Checklist created'),
  )

export const useDeleteChecklist = () =>
  useOffboardingMutation(
    (record: Versioned) => offboardingApi.deleteChecklist(record),
    () => 'Checklist deleted',
  )
