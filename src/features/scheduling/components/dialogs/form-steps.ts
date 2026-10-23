import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import type { z } from 'zod'

/**
 * Checks one wizard step with its own schema and shows the problems on the
 * fields (RHF's resolver checks the whole form, which step 1 cannot pass yet).
 */
export function validateStep<TValues extends FieldValues>(
  form: UseFormReturn<TValues>,
  schema: z.ZodType,
): boolean {
  const result = schema.safeParse(form.getValues())
  if (result.success) return true
  let focused = false
  for (const issue of result.error.issues) {
    const name = issue.path.join('.') as Path<TValues>
    form.setError(name, { type: 'step', message: issue.message }, { shouldFocus: !focused })
    focused = true
  }
  return false
}
