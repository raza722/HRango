import { z } from 'zod'

import {
  OVERRIDE_EFFECTS,
  OVERRIDE_SCOPES,
  type OverrideInput,
  type Role,
  type RoleInput,
  SCOPES,
  type TickInput,
  UNIT_TYPES,
  type UserDetail,
  type UserInput,
} from '../types/access.types'
import { newPasswordSchema } from './password.schema'

/** The API's email rule (`UserIn.email`). */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// --- user ---------------------------------------------------------------------------------------

const userFields = {
  email: z
    .string()
    .trim()
    .min(1, 'Enter an email address.')
    .max(254, 'Keep it to 254 characters.')
    .regex(EMAIL, 'Enter a valid email address, like name@company.com.'),
  displayName: z.string().trim().max(200, 'Keep it to 200 characters.'),
  employeeId: z.string().nullable(),
  isActive: z.boolean(),
  isSystemAdmin: z.boolean(),
  companyIds: z.array(z.string()).min(1, 'Choose at least one company.'),
  roleIds: z.array(z.string()),
}

/** Add User: everything, with an initial password typed twice. */
export const createUserFormSchema = z
  .object({ ...userFields, password: newPasswordSchema, confirm: z.string() })
  .superRefine((values, context) => {
    if (values.confirm === '') {
      context.addIssue({ code: 'custom', path: ['confirm'], message: 'Type the password again.' })
    } else if (values.confirm !== values.password) {
      context.addIssue({ code: 'custom', path: ['confirm'], message: 'The passwords don’t match.' })
    }
  })

/** Edit User: no password (Set Password does that). */
export const editUserFormSchema = z.object({
  ...userFields,
  password: z.string(),
  confirm: z.string(),
})

export type UserFormValues = z.infer<typeof createUserFormSchema>

/** The form's start: a new account (active, the current company) or the one being edited. */
export function userToForm(
  user: UserDetail | null,
  defaultCompanyId: string | null,
): UserFormValues {
  return {
    email: user?.email ?? '',
    displayName: user?.displayName ?? '',
    employeeId: user?.employeeId ?? null,
    password: '',
    confirm: '',
    isActive: user?.isActive ?? true,
    isSystemAdmin: user?.isSystemAdmin ?? false,
    companyIds: user
      ? user.companies.map((company) => company.id)
      : defaultCompanyId
        ? [defaultCompanyId]
        : [],
    roleIds: user?.roles.map((role) => role.id) ?? [],
  }
}

export function userFormToInput(values: UserFormValues, creating: boolean): UserInput {
  return {
    email: values.email.trim().toLowerCase(),
    displayName: values.displayName.trim() || null,
    employeeId: values.employeeId,
    password: creating ? values.password : null,
    isActive: values.isActive,
    isSystemAdmin: values.isSystemAdmin,
    companyIds: values.companyIds,
    roleIds: values.roleIds,
  }
}

// --- role ---------------------------------------------------------------------------------------

export const roleFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(200, 'Keep it to 200 characters.'),
  description: z.string().trim().max(2000, 'Keep it to 2,000 characters.'),
})
export type RoleFormValues = z.infer<typeof roleFormSchema>

export const roleToForm = (role: Pick<Role, 'name' | 'description'> | null): RoleFormValues => ({
  name: role?.name ?? '',
  description: role?.description ?? '',
})

export const roleFormToInput = (values: RoleFormValues): RoleInput => ({
  name: values.name.trim(),
  description: values.description.trim() || null,
})

/** Copy Role: the copy's name (unique, which the API checks). */
export const copyRoleFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name for the copy.')
    .max(200, 'Keep it to 200 characters.'),
})
export type CopyRoleFormValues = z.infer<typeof copyRoleFormSchema>

// --- override -----------------------------------------------------------------------------------

/** Add Override: a grant needs a scope; both need a reason, for the audit history. */
export const overrideFormSchema = z
  .object({
    code: z.string().min(1, 'Choose a permission.'),
    effect: z.enum(OVERRIDE_EFFECTS),
    /** '' while none is chosen (a denial has none). */
    scope: z.union([z.enum(OVERRIDE_SCOPES), z.literal('')]),
    reason: z
      .string()
      .trim()
      .min(1, 'Say why, for the history.')
      .max(1000, 'Keep it to 1,000 characters.'),
  })
  .superRefine((values, context) => {
    if (values.effect === 'grant' && values.scope === '') {
      context.addIssue({
        code: 'custom',
        path: ['scope'],
        message: 'Choose how far the grant reaches.',
      })
    }
  })
export type OverrideFormValues = z.infer<typeof overrideFormSchema>

export const OVERRIDE_FORM_DEFAULTS: OverrideFormValues = {
  code: '',
  effect: 'grant',
  scope: 'own',
  reason: '',
}

export const overrideFormToInput = (values: OverrideFormValues): OverrideInput => ({
  code: values.code,
  effect: values.effect,
  scope: values.effect === 'grant' && values.scope !== '' ? values.scope : null,
  reason: values.reason.trim(),
})

// --- role permissions ---------------------------------------------------------------------------

/**
 * The editor's ticks before Save: a Selected units tick names at least one unit. Issues sit on
 * `<index>.units`, which the editor turns back into the tick's code.
 */
export const ticksSchema = z.array(
  z
    .object({
      code: z.string().min(1),
      scope: z.enum(SCOPES),
      units: z.array(z.object({ unitType: z.enum(UNIT_TYPES), unitId: z.string().min(1) })),
    })
    .superRefine((tick, context) => {
      if (tick.scope === 'selected_units' && tick.units.length === 0) {
        context.addIssue({
          code: 'custom',
          path: ['units'],
          message: 'Choose at least one branch, department or location.',
        })
      }
    }),
)

/** The tick codes whose units are missing, with the message: `{ code: message }`. */
export function tickErrors(ticks: readonly TickInput[]): Record<string, string> {
  const result = ticksSchema.safeParse(ticks)
  if (result.success) return {}
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const index = issue.path[0]
    const tick = typeof index === 'number' ? ticks[index] : undefined
    if (tick && !errors[tick.code]) errors[tick.code] = issue.message
  }
  return errors
}
