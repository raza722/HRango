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
  usersDisable: 'access.users.delete',
  usersPassword: 'access.users.edit',
  usersRoles: 'access.roles.assign',
  usersOverrides: 'access.overrides.edit',
  usersSessions: 'access.sessions.end_session',
  rolesView: 'access.roles.view',
  rolesCreate: 'access.roles.create',
  rolesEdit: 'access.roles.edit',
  rolesDelete: 'access.roles.delete',
  rolesPermissions: 'access.roles.edit',
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

/**
 * The catalogue's module codes (the API's `module`, app/core/permissions.py MODULES) and the names
 * the app's menu gives them. The mock already sends the names; they pass through unchanged.
 */
export const MODULE_LABELS: Readonly<Record<string, string>> = {
  organisation: 'Organisation',
  employees: 'Talent Management',
  access: 'Access',
  integrations: 'Integrations',
  dashboard: 'Dashboards',
  inbox: 'Inbox',
  attendance: 'Attendance',
  roster: 'Roster',
  scheduling: 'Scheduling',
  warning: 'Warning',
  requests: 'Requests',
  leaves: 'Leaves',
  loans: 'Loans',
  payroll: 'Payroll',
  assets: 'Assets',
  offboarding: 'Off-boarding',
  manpower: 'Manpower Planning',
  recruitment: 'Recruitment',
  performance: 'Performance',
  training: 'Training',
  benefits: 'Benefits',
  engagement: 'Engagement',
  projects: 'Project Management',
  forms: 'Custom Forms',
}

/** A module's name: its menu name for a code, else the value as sent. */
export function moduleName(module: string): string {
  return MODULE_LABELS[module] ?? module
}

/**
 * A screen's name. The API sends the screen as a code ("access.sessions") and names it only in
 * the label ("Sessions: End sessions"), so the text before ": " is the name; else the value as sent.
 */
export function screenName(screen: string, label: string): string {
  const colon = label.indexOf(': ')
  return colon > 0 ? label.slice(0, colon) : screen
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
 * else the action code made readable (also when the label only repeats the code, "end_session").
 */
export function tickText(definition: { label: string; screen: string; actionCode: string }) {
  const prefix = `${definition.screen}: `
  const label =
    definition.screen && definition.label.startsWith(prefix)
      ? definition.label.slice(prefix.length)
      : definition.label
  if (label && label !== definition.actionCode) return label
  const known = ACTION_LABELS[definition.actionCode]
  if (known) return known
  const words = definition.actionCode.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
