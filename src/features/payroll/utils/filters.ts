import { useState } from 'react'

import type { EmployeeLookupFilters } from '@/hooks/use-employee-lookup'

import type { SearchOption } from '../components/shared/search-select'

export type FilterValues = Record<string, string | undefined>

export type FilterField =
  | {
      kind: 'select'
      key: string
      label: string
      placeholder: string
      options: readonly SearchOption[]
    }
  | {
      /** A person from `GET /employees/lookup` (searched on the server, paged). */
      kind: 'employee'
      key: string
      label: string
      placeholder: string
      /** Whom the list holds (the screen's permission code …). */
      filters: EmployeeLookupFilters
      /** Names for ids the lookup has not read yet. */
      known?: readonly SearchOption[]
    }
  | { kind: 'text'; key: string; label: string; placeholder?: string }
  | { kind: 'range'; key: string; label: string; from: string; to: string }
  | { kind: 'date'; key: string; label: string }
  | { kind: 'month'; key: string; label: string }

export const presetKey = (name: string) => `hrms-payroll-filters-${name}`

function readPreset(name: string): FilterValues {
  try {
    const raw = localStorage.getItem(presetKey(name))
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as FilterValues) : {}
  } catch {
    return {}
  }
}

/** A page's filters, starting from its saved preset (Filters → Save Preset). */
export function useFilters(name: string) {
  return useState<FilterValues>(() => readPreset(name))
}

/** Turns "From / To" text into numbers for the API. */
export const numberOf = (value: string | undefined) => {
  if (value === undefined || value.trim() === '') return undefined
  const number = Number(value.replace(/,/g, ''))
  return Number.isFinite(number) ? number : undefined
}

/** How many filters are set (shown on the Filters button). */
export const activeCount = (values: FilterValues) =>
  Object.values(values).filter((value) => value).length
