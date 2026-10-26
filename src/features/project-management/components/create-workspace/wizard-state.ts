import { z } from 'zod'

import {
  ORGANIZER_LABELS,
  VIEW_LABELS,
  WORKSPACE_DESCRIPTION_MAX,
  WORKSPACE_NAME_MAX,
} from '../../constants'
import type {
  OrganizerFeature,
  StatusGroup,
  StatusTemplate,
  StatusTemplateId,
  TaskStatus,
  ViewKind,
  Visibility,
  WorkflowTemplate,
  WorkflowTemplateId,
  WorkspaceInput,
  WorkspaceSetup,
} from '../../types/pm.types'

/** The wizard's three steps, in order (the progress header). */
export const WIZARD_STEPS = ['details', 'workflow', 'customize'] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]

export const WIZARD_STEP_LABELS: Record<WizardStep, string> = {
  details: 'Add Workspace Details',
  workflow: 'Define Workflow',
  customize: 'Customize Template',
}

/** The pages Customize Template opens from its three rows. */
export type DetailPage = 'views' | 'statuses' | 'organizer'

/** Everything the wizard collects; `null` while a choice is still to be made. */
export interface WizardValues {
  name: string
  ownerId: string | null
  description: string
  visibility: Visibility | null
  memberIds: string[]
  departmentId: string | null
  template: WorkflowTemplateId | null
  setup: WorkspaceSetup | null
}

/** Every field of the wizard, for watching them all and matching server field errors. */
export const WIZARD_FIELDS = [
  'name',
  'ownerId',
  'description',
  'visibility',
  'memberIds',
  'departmentId',
  'template',
  'setup',
] as const satisfies readonly (keyof WizardValues)[]
export type WizardField = (typeof WIZARD_FIELDS)[number]

export const EMPTY_WIZARD: WizardValues = {
  name: '',
  ownerId: null,
  description: '',
  visibility: null,
  memberIds: [],
  departmentId: null,
  template: null,
  setup: null,
}

/** Step 1: name (3-50, unique), owner and visibility are required; a private workspace needs its members. */
export const detailsSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter the workspace name')
      .min(3, 'Use at least 3 characters')
      .max(WORKSPACE_NAME_MAX, `Keep the name to ${WORKSPACE_NAME_MAX} characters`),
    ownerId: z.string({ error: 'Add the workspace owner' }).min(1, 'Add the workspace owner'),
    description: z
      .string()
      .max(
        WORKSPACE_DESCRIPTION_MAX,
        `Keep the description to ${WORKSPACE_DESCRIPTION_MAX} characters`,
      ),
    visibility: z.enum(['private', 'workspace', 'public'], {
      error: 'Choose who can see the workspace',
    }),
    memberIds: z.array(z.string()),
  })
  .refine((values) => values.visibility !== 'private' || values.memberIds.length > 0, {
    message: 'Add the members who can see this workspace',
    path: ['memberIds'],
  })

/** Step 2: a department and one of the workflow templates. */
export const workflowSchema = z.object({
  departmentId: z.string({ error: 'Select your department' }).min(1, 'Select your department'),
  template: z.string({ error: 'Choose a workflow' }).min(1, 'Choose a workflow'),
})

/** Whether Continue is enabled on a step. */
export function stepComplete(step: WizardStep, values: WizardValues): boolean {
  if (step === 'details') return detailsSchema.safeParse(values).success
  if (step === 'workflow') return workflowSchema.safeParse(values).success
  return values.setup !== null
}

/** The first step whose fields are not complete yet, or null when all are. */
export function firstIncompleteStep(values: WizardValues): WizardStep | null {
  return WIZARD_STEPS.find((step) => !stepComplete(step, values)) ?? null
}

/** A fresh copy of a workflow template's views, statuses and organizer. */
export const templateSetup = (template: WorkflowTemplate | undefined): WorkspaceSetup | null =>
  template ? structuredClone(template.setup) : null

/** The request body for "Create Workspace", or null while a step is incomplete. */
export function toWorkspaceInput(values: WizardValues): WorkspaceInput | null {
  const details = detailsSchema.safeParse(values)
  const workflow = workflowSchema.safeParse(values)
  if (!details.success || !workflow.success || !values.setup) return null
  return {
    name: details.data.name,
    ownerId: details.data.ownerId,
    description: details.data.description.trim(),
    visibility: details.data.visibility,
    memberIds: details.data.visibility === 'private' ? details.data.memberIds : [],
    departmentId: workflow.data.departmentId,
    template: workflow.data.template,
    setup: values.setup,
  }
}

/** The API's field names (`POST /projects/workspaces`) as the wizard's. */
const API_FIELDS: Record<string, WizardField> = {
  name: 'name',
  ownerId: 'ownerId',
  description: 'description',
  privacy: 'visibility',
  members: 'memberIds',
  departmentId: 'departmentId',
  workflowTemplate: 'template',
  statuses: 'setup',
  views: 'setup',
  features: 'setup',
  statusTemplate: 'setup',
}

/** The wizard field a server field error is about (`members.0.employeeId` → memberIds). */
export const fieldOfApiField = (field: string): WizardField | null =>
  API_FIELDS[field.split('.')[0] ?? ''] ?? null

/** Which step a field belongs to, so the wizard can go back to it. */
export function stepOfField(field: string): WizardStep {
  const key = field.split('.')[0] ?? ''
  if (['name', 'ownerId', 'description', 'visibility', 'memberIds'].includes(key)) return 'details'
  if (key === 'departmentId' || key === 'template') return 'workflow'
  return 'customize'
}

// --- views ---------------------------------------------------------------------------------------

/** The views drawn on "Default Settings for Views" (610:201097), in its two-column order. */
export const DRAWN_VIEWS: readonly ViewKind[] = [
  'list',
  'board',
  'calendar',
  'activity',
  'team',
  'timeline',
  'table',
]

/** Views a page lists: the drawn ones, plus any other view the template starts with. */
export function listedViews(templateViews: readonly ViewKind[]): ViewKind[] {
  return [...DRAWN_VIEWS, ...templateViews.filter((view) => !DRAWN_VIEWS.includes(view))]
}

/** Switches a view on or off; List stays on and the default falls back to List. */
export function toggleView(
  setup: Pick<WorkspaceSetup, 'views' | 'defaultView'>,
  view: ViewKind,
  on: boolean,
): Pick<WorkspaceSetup, 'views' | 'defaultView'> {
  if (view === 'list') return setup
  const views = on
    ? [...new Set([...setup.views, view])]
    : setup.views.filter((other) => other !== view)
  return { views, defaultView: views.includes(setup.defaultView) ? setup.defaultView : 'list' }
}

// --- organizer -----------------------------------------------------------------------------------

/** The organizer rows of 992:375830 (left column, right column, row by row). */
export const DRAWN_ORGANIZER: readonly OrganizerFeature[] = [
  'priority',
  'add-fields',
  'remap-subtask-due-dates',
  'multiple-assignees',
  'story-points',
  'tags',
  'time-estimate',
  'time-tracking',
  'incomplete-warnings',
  'dependencies-warnings',
  'reschedule-dependencies',
  'show-status-progress',
]

export function listedOrganizer(templateFeatures: readonly OrganizerFeature[]): OrganizerFeature[] {
  return [
    ...DRAWN_ORGANIZER,
    ...templateFeatures.filter((feature) => !DRAWN_ORGANIZER.includes(feature)),
  ]
}

// --- statuses ------------------------------------------------------------------------------------

/** The status groups in the order Edit Statuses draws them (Closed above Done, 702:210425). */
export const DRAWN_STATUS_GROUPS: readonly StatusGroup[] = [
  'not-started',
  'active',
  'closed',
  'done',
]

export const statusesIn = (statuses: readonly TaskStatus[], group: StatusGroup) =>
  statuses.filter((status) => status.group === group)

/**
 * Moves a status up or down among the statuses of its own group (the drag handle and its
 * keyboard arrows). Returns the list unchanged at either end.
 */
export function moveStatus(
  statuses: readonly TaskStatus[],
  id: string,
  offset: -1 | 1,
): TaskStatus[] {
  const status = statuses.find((entry) => entry.id === id)
  if (!status) return [...statuses]
  const group = statusesIn(statuses, status.group)
  const index = group.findIndex((entry) => entry.id === id)
  const target = group[index + offset]
  if (!target) return [...statuses]
  return reorderStatus(statuses, id, target.id)
}

/** Drops status `id` where status `overId` is (same group only), shifting the rest. */
export function reorderStatus(
  statuses: readonly TaskStatus[],
  id: string,
  overId: string,
): TaskStatus[] {
  const from = statuses.findIndex((entry) => entry.id === id)
  const to = statuses.findIndex((entry) => entry.id === overId)
  const moving = statuses[from]
  const over = statuses[to]
  if (!moving || !over || from === to || moving.group !== over.group) return [...statuses]
  const next = statuses.filter((entry) => entry.id !== id)
  const at = next.findIndex((entry) => entry.id === overId)
  next.splice(from < to ? at + 1 : at, 0, moving)
  return next
}

export const STATUS_NAME_MAX = 40

/**
 * A trimmed status name, or an error message when it cannot be used. Names are unique within a
 * group (Scrum has a "Completed" in Active and another in Closed).
 */
export function checkStatusName(
  statuses: readonly TaskStatus[],
  group: StatusGroup,
  name: string,
  exceptId?: string,
): { name: string } | { error: string } {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Name the status' }
  if (trimmed.length > STATUS_NAME_MAX) {
    return { error: `Keep the status under ${STATUS_NAME_MAX} characters` }
  }
  const taken = statusesIn(statuses, group).some(
    (status) => status.id !== exceptId && status.name.toLowerCase() === trimmed.toLowerCase(),
  )
  if (taken) return { error: 'This group already has a status with this name' }
  return { name: trimmed }
}

let statusSequence = 0

/** A new status id, unique within the session. */
export function newStatusId(): string {
  statusSequence += 1
  return `st_new_${Date.now().toString(36)}_${statusSequence}`
}

/** Appends a status to the end of its group. */
export function addStatus(statuses: readonly TaskStatus[], status: TaskStatus): TaskStatus[] {
  const lastInGroup = statuses.findLastIndex((entry) => entry.group === status.group)
  if (lastInGroup === -1) return [...statuses, status]
  const next = [...statuses]
  next.splice(lastInGroup + 1, 0, status)
  return next
}

/** The "Add Status Color" swatches (1087:486644), row by row. */
export const STATUS_SWATCHES: readonly (readonly string[])[] = [
  ['#EC4899', '#F43F5E', '#D946EF', '#9751F2', '#0EA5E9', '#10B981', '#84CC16'],
  ['#979797', '#2F639A', '#762AFD', '#DC3545', '#E9540D', '#2E64E2'],
]

/** The ring colour a new status starts with ("Add status" draws it grey). */
export const NEW_STATUS_COLOR = '#979797'

/** The status being typed on Edit Statuses: a new one in a group, or a rename. */
export type StatusEditing =
  { kind: 'add'; group: StatusGroup; color: string } | { kind: 'rename'; id: string; color: string }

// --- status templates (the "Status Templates" dropdown) ------------------------------------

/** The dropdown's order (702:206158). */
export const STATUS_TEMPLATE_ORDER: readonly StatusTemplateId[] = [
  'content',
  'kanban',
  'marketing',
  'custom',
  'scrum',
]

export const STATUS_TEMPLATE_NAME_MAX = 40

/**
 * The templates the dropdown offers, as edited in this wizard: built-ins can be renamed or
 * removed and new ones added ("Add New Template"). There is no API for status templates, so
 * the library lives with the wizard.
 */
export interface StatusLibrary {
  names: Partial<Record<StatusTemplateId, string>>
  removed: StatusTemplateId[]
  added: { id: string; name: string; statuses: TaskStatus[] }[]
  /** The template the custom statuses came from; null shows "Select a status template". */
  selectedId: string | null
}

export const EMPTY_LIBRARY: StatusLibrary = { names: {}, removed: [], added: [], selectedId: null }

export interface StatusTemplateEntry {
  id: string
  name: string
  /** The built-in template it is, or null for one added here. */
  builtIn: StatusTemplateId | null
  statuses: readonly TaskStatus[]
}

/** Ids made here start with `tpl_`; every other id is one of the API's templates. */
const isBuiltIn = (id: string): id is StatusTemplateId => !id.startsWith('tpl_')

/** The dropdown's rows: the API's status templates (in the design's order), then any added here. */
export function libraryTemplates(
  library: StatusLibrary,
  statusTemplates: readonly StatusTemplate[],
): StatusTemplateEntry[] {
  const rank = (id: string) => {
    const index = STATUS_TEMPLATE_ORDER.indexOf(id)
    return index === -1 ? STATUS_TEMPLATE_ORDER.length : index
  }
  const builtIns = statusTemplates
    .filter((entry) => !library.removed.includes(entry.id))
    .toSorted((a, b) => rank(a.id) - rank(b.id))
    .map((entry): StatusTemplateEntry => ({
      id: entry.id,
      name: library.names[entry.id] ?? entry.name,
      builtIn: entry.id,
      statuses: entry.statuses,
    }))
  return [...builtIns, ...library.added.map((entry) => ({ ...entry, builtIn: null }))]
}

export function renameTemplate(library: StatusLibrary, id: string, name: string): StatusLibrary {
  if (isBuiltIn(id)) return { ...library, names: { ...library.names, [id]: name } }
  return {
    ...library,
    added: library.added.map((entry) => (entry.id === id ? { ...entry, name } : entry)),
  }
}

export function removeTemplate(library: StatusLibrary, id: string): StatusLibrary {
  const selectedId = library.selectedId === id ? null : library.selectedId
  if (isBuiltIn(id)) return { ...library, removed: [...library.removed, id], selectedId }
  return { ...library, added: library.added.filter((entry) => entry.id !== id), selectedId }
}

let templateSequence = 0

export function addTemplate(
  library: StatusLibrary,
  name: string,
  statuses: readonly TaskStatus[],
): { library: StatusLibrary; id: string } {
  templateSequence += 1
  const id = `tpl_${Date.now().toString(36)}_${templateSequence}`
  return {
    id,
    library: { ...library, added: [...library.added, { id, name, statuses: [...statuses] }] },
  }
}

/** A template name trimmed, or why it cannot be used. */
export function checkTemplateName(
  templates: readonly StatusTemplateEntry[],
  name: string,
  exceptId?: string,
): { name: string } | { error: string } {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Enter the template name' }
  if (trimmed.length > STATUS_TEMPLATE_NAME_MAX) {
    return { error: `Keep the name to ${STATUS_TEMPLATE_NAME_MAX} characters` }
  }
  const taken = templates.some(
    (entry) => entry.id !== exceptId && entry.name.toLowerCase() === trimmed.toLowerCase(),
  )
  if (taken) return { error: 'A status template with this name already exists' }
  return { name: trimmed }
}

/** What the workspace records for the chosen template: the API's code, or none for one added here. */
export function templateIdFor(selectedId: string | null): StatusTemplateId | null {
  return selectedId !== null && isBuiltIn(selectedId) ? selectedId : null
}

/** Fresh copies, so editing a template's statuses never touches the template. */
export const copyStatuses = (statuses: readonly TaskStatus[]): TaskStatus[] =>
  statuses.map((status) => ({ ...status }))

// --- summaries (Customize Template rows) ----------------------------------------------------

/** "List, Board": the views switched on, in their order. */
export const viewsSummary = (views: readonly ViewKind[]) =>
  views.map((view) => VIEW_LABELS[view]).join(', ')

/** The order the Organizer summary lists features in (576:191345: "Tags, Time Estimate, …"). */
const ORGANIZER_SUMMARY_ORDER: readonly OrganizerFeature[] = [
  'tags',
  'time-estimate',
  'priority',
  'time-tracking',
  'incomplete-warnings',
  'dependencies-warnings',
  'story-points',
  'add-fields',
  'remap-subtask-due-dates',
  'multiple-assignees',
  'reschedule-dependencies',
  'show-status-progress',
  'email',
  'sprint-points',
  'wip-limits',
]

export const organizerSummary = (features: readonly OrganizerFeature[]) =>
  ORGANIZER_SUMMARY_ORDER.filter((feature) => features.includes(feature))
    .map((feature) => ORGANIZER_LABELS[feature])
    .join(', ')

/** Statuses in the order the pages draw them: by group (Not Started, Active, Closed, Done). */
export const orderedStatuses = (statuses: readonly TaskStatus[]) =>
  DRAWN_STATUS_GROUPS.flatMap((group) => statusesIn(statuses, group))
