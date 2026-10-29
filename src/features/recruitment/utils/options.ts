import type { SearchOption } from '@/features/payroll'

/** Adds the record's own choice when the list has not got it (an old or another country's value). */
export function withKnown(
  options: readonly SearchOption[],
  id: string | null | undefined,
  name: string | null | undefined,
): SearchOption[] {
  if (!id || options.some((option) => option.value === id)) return [...options]
  return [{ value: id, label: name ?? `#${id}` }, ...options]
}

/** Picker options from a labels record (stages, statuses, sources …). */
export function optionsOf<T extends string>(
  values: readonly T[],
  labelFor: (value: T) => string,
): { value: T; label: string }[] {
  return values.map((value) => ({ value, label: labelFor(value) }))
}
