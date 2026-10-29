import type { PermissionDef, Scope, Tick, TickInput, UnitType } from '../types/access.types'

/** A screen of the catalogue and its ticks, in the catalogue's order. */
export interface ScreenGroup {
  key: string
  module: string
  screen: string
  items: PermissionDef[]
}

/** A module of the catalogue: its screens. */
export interface ModuleGroup {
  module: string
  screens: ScreenGroup[]
}

/** Module → screen → ticks, keeping the order the catalogue gives (screen order). */
export function groupCatalogue(definitions: readonly PermissionDef[]): ModuleGroup[] {
  const modules: ModuleGroup[] = []
  for (const definition of definitions) {
    let group = modules.find((module) => module.module === definition.module)
    if (!group) {
      group = { module: definition.module, screens: [] }
      modules.push(group)
    }
    const key = `${definition.module}\u0000${definition.screen}`
    let screen = group.screens.find((item) => item.key === key)
    if (!screen) {
      screen = { key, module: definition.module, screen: definition.screen, items: [] }
      group.screens.push(screen)
    }
    screen.items.push(definition)
  }
  return modules
}

export const moduleCodes = (group: ModuleGroup) =>
  group.screens.flatMap((screen) => screen.items.map((item) => item.code))

/** Does a tick match the search (its label, code, screen or module)? */
export function matchesSearch(definition: PermissionDef, q: string | undefined): boolean {
  if (!q) return true
  const needle = q.trim().toLowerCase()
  return [definition.label, definition.code, definition.screen, definition.module]
    .join(' ')
    .toLowerCase()
    .includes(needle)
}

/** The modules and screens with only the ticks that pass `keep`. */
export function filterTree(
  modules: readonly ModuleGroup[],
  keep: (definition: PermissionDef) => boolean,
): ModuleGroup[] {
  return modules
    .map((module) => ({
      module: module.module,
      screens: module.screens
        .map((screen) => ({ ...screen, items: screen.items.filter(keep) }))
        .filter((screen) => screen.items.length > 0),
    }))
    .filter((module) => module.screens.length > 0)
}

// --- the editor's draft -----------------------------------------------------------------------

export interface DraftUnit {
  unitType: UnitType
  unitId: string
}

export interface DraftTick {
  scope: Scope
  units: DraftUnit[]
}

/** Ticked codes with their scope; a code that is absent is not ticked. */
export type Draft = ReadonlyMap<string, DraftTick>

export const draftOf = (ticks: readonly Tick[]): Draft =>
  new Map(
    ticks.map((tick) => [
      tick.code,
      {
        scope: tick.scope,
        units: tick.units.map((unit) => ({ unitType: unit.unitType, unitId: unit.unitId })),
      },
    ]),
  )

const unitKey = (units: readonly DraftUnit[]) =>
  units
    .map((unit) => `${unit.unitType}:${unit.unitId}`)
    .sort()
    .join('|')

const sameTick = (a: DraftTick, b: DraftTick) =>
  a.scope === b.scope && (a.scope !== 'selected_units' || unitKey(a.units) === unitKey(b.units))

/** Ticks added, taken off, or given another scope (or other units). */
export function countChanges(saved: Draft, draft: Draft): number {
  let changes = 0
  for (const [code, tick] of draft) {
    const was = saved.get(code)
    if (!was || !sameTick(was, tick)) changes += 1
  }
  for (const code of saved.keys()) if (!draft.has(code)) changes += 1
  return changes
}

/** The draft as `RolePermissionsIn.permissions`, in the catalogue's order. */
export function draftToTicks(draft: Draft, definitions: readonly PermissionDef[]): TickInput[] {
  const order = new Map(definitions.map((definition, index) => [definition.code, index]))
  return [...draft.entries()]
    .sort(
      ([a], [b]) =>
        (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER),
    )
    .map(([code, tick]) => ({
      code,
      scope: tick.scope,
      units: tick.scope === 'selected_units' ? tick.units : [],
    }))
}

/**
 * The scope a new tick on a screen starts with: another tick of the same screen's, else
 * Company (the role editor's usual case: a whole screen for the role).
 */
export function defaultTickFor(screen: ScreenGroup, draft: Draft): DraftTick {
  for (const item of screen.items) {
    const tick = draft.get(item.code)
    if (tick) return { scope: tick.scope, units: [...tick.units] }
  }
  return { scope: 'company', units: [] }
}

/** Ticks or unticks codes, all at once. */
export function setTicked(
  draft: Draft,
  codes: readonly string[],
  ticked: boolean,
  start: DraftTick,
): Map<string, DraftTick> {
  const next = new Map(draft)
  for (const code of codes) {
    if (!ticked) next.delete(code)
    else if (!next.has(code)) next.set(code, { scope: start.scope, units: [...start.units] })
  }
  return next
}

/** How many of `codes` are ticked: none, some or all. */
export function tickState(draft: Draft, codes: readonly string[]): boolean | 'indeterminate' {
  const ticked = codes.filter((code) => draft.has(code)).length
  if (ticked === 0) return false
  return ticked === codes.length ? true : 'indeterminate'
}
