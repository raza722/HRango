import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { orgLookupQueryOptions } from '@/features/settings'

import { customFormsApi } from '../api/custom-forms.api'
import type {
  AnswerInput,
  CustomForm,
  FormDefinition,
  FormInput,
  FormListParams,
  FormSummary,
  PageParams,
} from '../types/custom-forms.types'
import {
  assignedFormQueryOptions,
  assignedFormsQueryOptions,
  customFormKeys,
  formListQueryOptions,
  formQueryOptions,
  myResponsesQueryOptions,
  responseQueryOptions,
  responsesQueryOptions,
  summaryQueryOptions,
} from './custom-forms.keys'

// --- queries ------------------------------------------------------------------------------------

/** One page of the Forms list, or "not available" while the backend lacks the endpoint. */
export const useFormList = (params: FormListParams, enabled = true) =>
  useQuery({ ...formListQueryOptions(params), enabled })

/** One form for the builder; `null` skips the request (a new form). */
export const useCustomForm = (id: string | null) =>
  useQuery({ ...formQueryOptions(id ?? ''), enabled: id !== null })

/** The caller's assigned forms (My Forms). */
export const useAssignedForms = (params: PageParams, enabled = true) =>
  useQuery({ ...assignedFormsQueryOptions(params), enabled })

/** One assigned form with its questions; `null` skips it. */
export const useAssignedForm = (id: string | null) =>
  useQuery({ ...assignedFormQueryOptions(id ?? ''), enabled: id !== null })

/** The caller's own submissions. */
export const useMyResponses = (params: PageParams, enabled = true) =>
  useQuery({ ...myResponsesQueryOptions(params), enabled })

/** One page of a form's responses; `null` skips it. */
export const useResponses = (formId: string | null, params: PageParams) =>
  useQuery({ ...responsesQueryOptions(formId ?? '', params), enabled: formId !== null })

/** Counts per answer of a form's choice fields; `null` skips it. */
export const useResponseSummary = (formId: string | null) =>
  useQuery({ ...summaryQueryOptions(formId ?? ''), enabled: formId !== null })

/** One response with its questions; `null` skips it. */
export const useResponse = (id: string | null) =>
  useQuery({ ...responseQueryOptions(id ?? ''), enabled: id !== null })

/**
 * Departments or branches for the audience pickers (`GET /organisation/lookups/{kind}`), as
 * `{value, label}`. A list the user may not read comes back empty.
 */
export function useOrgOptions(kind: 'departments' | 'branches', enabled = true) {
  const query = useQuery({ ...orgLookupQueryOptions(kind), enabled })
  return {
    options: (query.data ?? []).map((item) => ({ value: item.id, label: item.name })),
    isPending: enabled && query.isPending,
  }
}

// --- mutations ----------------------------------------------------------------------------------

/** After any change: every Custom Form query refetches (lists, counts, My Forms, responses). */
function useInvalidateForms() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: customFormKeys.all })
}

/**
 * Save in the builder: `POST /forms` for a new form, `PUT /forms/{id}` with its `rowVersion`
 * otherwise. Errors stay with the caller, which puts them on the builder's fields.
 */
export function useSaveForm() {
  const invalidate = useInvalidateForms()
  return useMutation({
    mutationFn: ({ form, input }: { form: CustomForm | null; input: FormInput }) =>
      form
        ? customFormsApi.updateForm(form.id, input, form.rowVersion)
        : customFormsApi.createForm(input),
    meta: { suppressErrorToast: true },
    onSettled: invalidate,
  })
}

/**
 * Publish (or Reopen) a form: `POST /forms/{id}/publish`. `quiet` leaves errors to the caller
 * (the builder puts them on its fields).
 */
export function usePublishForm({ quiet = false }: { quiet?: boolean } = {}) {
  const invalidate = useInvalidateForms()
  return useMutation({
    mutationFn: ({ id, rowVersion }: { id: string; rowVersion: string; title: string }) =>
      customFormsApi.publishForm(id, rowVersion),
    meta: { suppressErrorToast: quiet },
    onSuccess: (_form, { title }) => {
      toast.success(`“${title}” is published`)
    },
    onSettled: invalidate,
  })
}

/** Close a form: `POST /forms/{id}/close`. */
export function useCloseForm() {
  const invalidate = useInvalidateForms()
  return useMutation({
    mutationFn: (form: Pick<FormSummary, 'id' | 'rowVersion' | 'title'>) =>
      customFormsApi.closeForm(form.id, form.rowVersion),
    onSuccess: (_form, { title }) => {
      toast.success(`“${title}” is closed`)
    },
    onSettled: invalidate,
  })
}

/** Duplicate a form as a new draft: `POST /forms/{id}/duplicate`. */
export function useDuplicateForm() {
  const invalidate = useInvalidateForms()
  return useMutation({
    mutationFn: (form: Pick<FormSummary, 'id' | 'title'>) => customFormsApi.duplicateForm(form.id),
    onSuccess: (copy) => {
      toast.success(`Draft “${copy.title}” created`)
    },
    onSettled: invalidate,
  })
}

/** Delete a form (and a closed form's responses): `DELETE /forms/{id}?rowVersion=`. */
export function useDeleteForm() {
  const invalidate = useInvalidateForms()
  return useMutation({
    mutationFn: (form: Pick<FormSummary, 'id' | 'rowVersion' | 'title'>) =>
      customFormsApi.deleteForm(form.id, form.rowVersion),
    onSuccess: (_result, { title }) => {
      toast.success(`“${title}” deleted`)
    },
    onSettled: invalidate,
  })
}

/**
 * Submit the caller's answers: `POST /forms/{id}/responses`. Errors stay with the caller (the
 * fill form shows them on the questions); everything refetches either way, so a refused
 * second answer also updates My Forms.
 */
export function useSubmitResponse() {
  const invalidate = useInvalidateForms()
  return useMutation({
    mutationFn: ({
      formId,
      answers,
      definition,
    }: {
      formId: string
      answers: AnswerInput[]
      definition: Pick<FormDefinition, 'fields'>
    }) => customFormsApi.submitResponse(formId, answers, definition),
    meta: { suppressErrorToast: true },
    onSettled: invalidate,
  })
}
