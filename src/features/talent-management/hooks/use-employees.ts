import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { uploadFile } from '@/lib/files'

import {
  employeeChildrenQueryOptions,
  employeeKeys,
  employeeListQueryOptions,
  employeeQueryOptions,
  employeesApi,
  employeeStatsQueryOptions,
  orgLookupQueryOptions,
} from '../api/employees.api'
import type {
  ChildInput,
  Employee,
  EmployeeChildKind,
  EmployeeInput,
  EmployeeListParams,
  OrgLookupItem,
  OrgLookupKind,
} from '../types/employees.types'

// --- queries ------------------------------------------------------------------------------------

/** One page of the Employees table. */
export const useEmployeeList = (params: EmployeeListParams) =>
  useQuery(employeeListQueryOptions(params))

/** Total Employees, Male, Female and On Probation. */
export const useEmployeeStats = () => useQuery(employeeStatsQueryOptions())

/** One person's record (`GET /employees/{id}`); `null` skips the request. */
export const useEmployee = (id: string | null) =>
  useQuery({ ...employeeQueryOptions(id ?? ''), enabled: id !== null })

/** One child table of a person (dependents, skills, education …). */
export const useEmployeeChildren = <K extends EmployeeChildKind>(
  id: string,
  kind: K,
  enabled = true,
) => useQuery({ ...employeeChildrenQueryOptions(id, kind), enabled })

/**
 * Organisation pickers by kind, read once `enabled` (e.g. while a dialog or the filter panel is
 * open). A list the user may not read comes back empty rather than failing the form.
 */
export function useOrgLookups<K extends OrgLookupKind>(kinds: readonly K[], enabled = true) {
  const results = useQueries({
    queries: kinds.map((kind) => ({ ...orgLookupQueryOptions(kind), enabled })),
  })
  const lists = Object.fromEntries(
    kinds.map((kind, index) => [kind, results[index]?.data ?? []]),
  ) as Record<K, OrgLookupItem[]>
  return { lists, isPending: enabled && results.some((result) => result.isPending) }
}

// --- mutations ----------------------------------------------------------------------------------

/**
 * An employee change: refetches every employee query (lists, tiles, the record, pickers) and
 * leaves errors to the caller, which shows them on the form's fields.
 */
function useEmployeeMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  successMessage: string | ((variables: TVariables) => string),
  showErrors = false,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { suppressErrorToast: !showErrors },
    onSuccess: async (_result, variables) => {
      toast.success(typeof successMessage === 'string' ? successMessage : successMessage(variables))
      await queryClient.invalidateQueries({ queryKey: employeeKeys.all })
    },
  })
}

/** Add New / Edit: `POST /employees` or `PUT /employees/{id}`. */
export const useSaveEmployee = () =>
  useEmployeeMutation(
    ({ id, input }: { id?: string | undefined; input: EmployeeInput }) =>
      id ? employeesApi.update(id, input) : employeesApi.create(input),
    ({ id }) => (id ? 'Employee updated' : 'Employee added'),
  )

/**
 * Update Profile: the record (`PUT /employees/{id}`), then the CNIC through `PUT …/identity`
 * when it changed (identity holders only).
 */
export const useUpdateProfile = () =>
  useEmployeeMutation(
    async ({
      employee,
      input,
      cnic,
    }: {
      employee: Employee
      input: EmployeeInput
      cnic: string | null | undefined
    }) => {
      const saved = await employeesApi.update(employee.id, input)
      if (cnic === undefined || cnic === (employee.cnic ?? null)) return saved
      return employeesApi.saveIdentity(employee.id, cnic, saved.rowVersion)
    },
    'Profile updated',
  )

/** The camera badge: uploads the photo (`POST /files`, module employees), then `PUT …/photo`. */
export const useSavePhoto = () =>
  useEmployeeMutation(
    async ({ employee, file }: { employee: Employee; file: File }) => {
      const uploaded = await uploadFile(file, 'employees')
      return employeesApi.savePhoto(employee.id, uploaded.id, employee.rowVersion)
    },
    'Photo updated',
    true,
  )

/** Deactivate / Reactivate (`PATCH …/deactivate|reactivate {rowVersion}`). */
export const useSetEmployeeActive = () =>
  useEmployeeMutation(
    ({ employee, active }: { employee: Employee; active: boolean }) =>
      active
        ? employeesApi.reactivate(employee.id, employee.rowVersion)
        : employeesApi.deactivate(employee.id, employee.rowVersion),
    ({ employee, active }) => `${employee.name} ${active ? 'reactivated' : 'deactivated'}`,
    true,
  )

/** Adds or edits a row of a child table. */
export const useSaveChild = <K extends EmployeeChildKind>(kind: K, label: string) =>
  useEmployeeMutation(
    ({
      employeeId,
      rowId,
      input,
    }: {
      employeeId: string
      rowId?: string | undefined
      input: ChildInput<K>
    }) =>
      rowId
        ? employeesApi.updateChild(employeeId, kind, rowId, input)
        : employeesApi.createChild(employeeId, kind, input),
    ({ rowId }) => `${label} ${rowId ? 'updated' : 'added'}`,
  )

/** Deletes a row of a child table (`DELETE …?rowVersion=`); errors toast. */
export const useDeleteChild = (kind: EmployeeChildKind, label: string) =>
  useEmployeeMutation(
    ({
      employeeId,
      rowId,
      rowVersion,
    }: {
      employeeId: string
      rowId: string
      rowVersion: string
    }) => employeesApi.removeChild(employeeId, kind, rowId, rowVersion),
    `${label} deleted`,
    true,
  )
