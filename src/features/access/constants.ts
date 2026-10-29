import type { OverrideEffect, Scope, UnitType } from './types/access.types'

/**
 * Permission codes of the two screens (the sidebar shows them under the `access.users` and
 * `access.roles` prefixes). In mock mode (no permissions list) every code is granted; the
 * server checks every call anyway.
 */
export const ACCESS_CODES = {
  usersView: 'access.users.view',
  usersCreate: 'access.users.create',
  usersEdit: 'access.users.edit',
  usersDisable: 'access.users.disable',
  usersPassword: 'access.users.password',
  usersRoles: 'access.users.roles',
  usersOverrides: 'access.users.overrides',
  usersSessions: 'access.users.sessions',
  rolesView: 'access.roles.view',
  rolesCreate: 'access.roles.create',
  rolesEdit: 'access.roles.edit',
  rolesDelete: 'access.roles.delete',
  rolesPermissions: 'access.roles.permissions',
} as const

/** Rows per page of the lists, and the choices. */
export const ACCESS_PAGE_SIZE = 10
export const ACCESS_PAGE_SIZES = [10, 20, 50] as const

/** The scope picker: short names, and what each reaches. */
export const SCOPE_LABELS: Record<Scope, string> = {
  own: 'Own',
  team: 'Team',
  department: 'Department',
  branch: 'Branch',
  selected_units: 'Selected units',
  company: 'Company',
}

export const SCOPE_HINTS: Record<Scope, string> = {
  own: 'Their own records only',
  team: 'Them and the people who report to them',
  department: 'Everyone in their department',
  branch: 'Everyone in their branch',
  selected_units: 'The branches, departments or locations chosen',
  company: 'Everyone in the company',
}

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  branch: 'Branch',
  department: 'Department',
  location: 'Location',
}

export const EFFECT_LABELS: Record<OverrideEffect, string> = {
  grant: 'Grant',
  deny: 'Deny',
}

/** A label for a value the API sent that the screens do not know. */
export function labelOf<T extends string>(labels: Record<T, string>, value: string): string {
  return (labels as Record<string, string | undefined>)[value] ?? value.replaceAll('_', ' ')
}

/** Short names of the actions, for the ticks (the catalogue's `label` names the screen too). */
export const ACTION_LABELS: Readonly<Record<string, string>> = {
  view: 'View',
  view_team: 'View team',
  view_all: 'View everyone',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
}

/**
 * What a tick says: the catalogue's label without its screen ("Pay Slips: Print" → "Print"),
 * else the action code made readable.
 */
export function tickText(definition: { label: string; screen: string; actionCode: string }) {
  const prefix = `${definition.screen}: `
  if (definition.screen && definition.label.startsWith(prefix)) {
    return definition.label.slice(prefix.length)
  }
  if (definition.label) return definition.label
  const known = ACTION_LABELS[definition.actionCode]
  if (known) return known
  const words = definition.actionCode.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
