import { z } from 'zod'

/** The API's limits (`PasswordIn`, `OwnPasswordIn`, `UserIn.password`). */
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 200

/**
 * The strength rules, shown as a checklist under every new-password field and checked by the
 * schemas (and by the mock, as the API would).
 */
export const PASSWORD_RULES = [
  {
    id: 'length',
    label: `At least ${PASSWORD_MIN} characters`,
    need: `at least ${PASSWORD_MIN} characters`,
    test: (value: string) => value.length >= PASSWORD_MIN,
  },
  {
    id: 'case',
    label: 'An uppercase and a lowercase letter',
    need: 'an uppercase and a lowercase letter',
    test: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value),
  },
  {
    id: 'number',
    label: 'A number',
    need: 'a number',
    test: (value: string) => /\d/.test(value),
  },
  {
    id: 'symbol',
    label: 'A symbol, such as ! @ # or $',
    need: 'a symbol',
    test: (value: string) => /[^A-Za-z0-9\s]/.test(value),
  },
] as const

/** "a, b and c". */
export function listOf(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`
}

/** What a password still lacks, as one sentence; `null` when it passes every rule. */
export function passwordIssue(value: string): string | null {
  if (value.length > PASSWORD_MAX) return `Keep it to ${PASSWORD_MAX} characters or fewer.`
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.need)
  return missing.length === 0 ? null : `The password needs ${listOf(missing)}.`
}

/** A new password: required, then the rules. */
export const newPasswordSchema = z.string().superRefine((value, context) => {
  if (value === '') {
    context.addIssue({ code: 'custom', message: 'Enter a password.' })
    return
  }
  const issue = passwordIssue(value)
  if (issue) context.addIssue({ code: 'custom', message: issue })
})

/** Set Password (someone else's): the new password twice. */
export const setPasswordFormSchema = z
  .object({ password: newPasswordSchema, confirm: z.string() })
  .superRefine((values, context) => {
    if (values.confirm === '') {
      context.addIssue({ code: 'custom', path: ['confirm'], message: 'Type the password again.' })
    } else if (values.confirm !== values.password) {
      context.addIssue({ code: 'custom', path: ['confirm'], message: 'The passwords don’t match.' })
    }
  })
export type SetPasswordFormValues = z.infer<typeof setPasswordFormSchema>

/** Change Password (your own): the current one, then the new one twice. */
export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.').max(PASSWORD_MAX),
    newPassword: newPasswordSchema,
    confirm: z.string(),
  })
  .superRefine((values, context) => {
    if (values.confirm === '') {
      context.addIssue({
        code: 'custom',
        path: ['confirm'],
        message: 'Type the new password again.',
      })
    } else if (values.confirm !== values.newPassword) {
      context.addIssue({ code: 'custom', path: ['confirm'], message: 'The passwords don’t match.' })
    }
    if (values.currentPassword !== '' && values.newPassword === values.currentPassword) {
      context.addIssue({
        code: 'custom',
        path: ['newPassword'],
        message: 'Choose a password you aren’t using now.',
      })
    }
  })
export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>
