import { useId, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { labelOf, SCOPE_HINTS, SCOPE_LABELS, tickText } from '../../constants'
import { type PermissionDef, type Scope, SCOPES } from '../../types/access.types'
import { plural } from '../../utils/format'
import {
  defaultTickFor,
  type Draft,
  type DraftTick,
  filterTree,
  groupCatalogue,
  matchesSearch,
  moduleCodes,
  type ModuleGroup,
  type ScreenGroup,
  setTicked,
  tickState,
} from '../../utils/permission-tree'
import { nativeSelectClass } from '../../utils/styles'
import { ChipToggle, EmptyNote, SearchBox, SensitiveChip } from '../shared/parts'
import { TickBox } from '../shared/tick-box'
import { UnitsPicker } from './units-picker'

interface EditorProps {
  catalogue: readonly PermissionDef[]
  draft: Draft
  onChange: (next: Draft) => void
  readOnly: boolean
  /** The catalogue's search and "ticked only", from the URL. */
  q: string | undefined
  tickedOnly: boolean
  onFilter: (patch: { q?: string | undefined; ticked?: true | undefined }) => void
  /** Ticks that cannot be saved as they are: `{ code: message }`. */
  errors: Readonly<Record<string, string>>
  /** Unit names the role's saved ticks give (`branch:<id>` → name). */
  unitNames: ReadonlyMap<string, string>
}

/** One action of a screen: the tick, its scope and, for Selected units, the units. */
function TickRow({
  definition,
  tick,
  screen,
  draft,
  onChange,
  readOnly,
  error,
  unitNames,
}: {
  definition: PermissionDef
  tick: DraftTick | undefined
  screen: ScreenGroup
  draft: Draft
  onChange: (next: Draft) => void
  readOnly: boolean
  error: string | undefined
  unitNames: ReadonlyMap<string, string>
}) {
  const hintId = useId()
  const errorId = useId()
  const setTick = (next: DraftTick) => {
    const map = new Map(draft)
    map.set(definition.code, next)
    onChange(map)
  }
  return (
    <li
      className={cn(
        'grid gap-2 rounded-md px-2 py-2 @2xl:grid-cols-[minmax(0,1fr)_minmax(10rem,13rem)] @2xl:items-start',
        tick && 'bg-sidebar/[0.035] dark:bg-white/[0.03]',
        error && 'ring-1 ring-destructive/50',
      )}
    >
      <div className="grid min-w-0 gap-0.5">
        <label className="flex min-w-0 cursor-pointer items-center gap-2.5 text-xs text-title">
          <TickBox
            checked={tick !== undefined}
            disabled={readOnly}
            aria-label={definition.label}
            aria-describedby={definition.hint ? hintId : undefined}
            onCheckedChange={(checked) => {
              onChange(
                setTicked(
                  draft,
                  [definition.code],
                  checked === true,
                  defaultTickFor(screen, draft),
                ),
              )
            }}
          />
          <span className="min-w-0 break-words">{tickText(definition)}</span>
          {definition.isSensitive && <SensitiveChip />}
        </label>
        {definition.hint && (
          <p id={hintId} className="pl-7 text-[0.6875rem] text-grey">
            {definition.hint}
          </p>
        )}
      </div>
      {tick && (
        <div className="grid min-w-0 gap-1.5 pl-7 @2xl:pl-0">
          <select
            aria-label={`Scope of ${definition.label}`}
            value={tick.scope}
            disabled={readOnly}
            title={SCOPE_HINTS[tick.scope]}
            onChange={(event) => {
              const scope = SCOPES.find((value) => value === event.target.value) ?? 'company'
              setTick({ scope, units: scope === 'selected_units' ? tick.units : [] })
            }}
            className={nativeSelectClass}
          >
            {SCOPES.map((scope: Scope) => (
              <option key={scope} value={scope}>
                {labelOf(SCOPE_LABELS, scope)}
              </option>
            ))}
          </select>
          {tick.scope === 'selected_units' && (
            <UnitsPicker
              label={`Units of ${definition.label}`}
              value={tick.units}
              invalid={Boolean(error)}
              describedBy={error ? errorId : undefined}
              known={unitNames}
              disabled={readOnly}
              onChange={(units) => {
                setTick({ scope: 'selected_units', units })
              }}
            />
          )}
          {error && (
            <p id={errorId} className="text-[0.6875rem] text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  )
}

/** A screen: its name, Select all, and one row per action. */
function ScreenBlock({
  screen,
  draft,
  onChange,
  readOnly,
  errors,
  unitNames,
}: {
  screen: ScreenGroup
  draft: Draft
  onChange: (next: Draft) => void
  readOnly: boolean
  errors: Readonly<Record<string, string>>
  unitNames: ReadonlyMap<string, string>
}) {
  const codes = screen.items.map((item) => item.code)
  const state = tickState(draft, codes)
  const ticked = codes.filter((code) => draft.has(code)).length
  return (
    <fieldset className="grid min-w-0 gap-1 rounded-lg border border-border p-2 sm:p-3">
      <legend className="sr-only">{screen.screen}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1">
        <span aria-hidden="true" className="text-xs font-medium text-title">
          {screen.screen}
        </span>
        <label className="flex cursor-pointer items-center gap-2 text-[0.6875rem] text-grey">
          <span>
            {ticked} of {codes.length}
          </span>
          <TickBox
            checked={state}
            disabled={readOnly}
            aria-label={`Select all: ${screen.screen}`}
            onCheckedChange={() => {
              onChange(setTicked(draft, codes, state !== true, defaultTickFor(screen, draft)))
            }}
          />
          <span aria-hidden="true">All</span>
        </label>
      </div>
      <ul className="grid gap-0.5">
        {screen.items.map((definition) => (
          <TickRow
            key={definition.code}
            definition={definition}
            tick={draft.get(definition.code)}
            screen={screen}
            draft={draft}
            onChange={onChange}
            readOnly={readOnly}
            error={errors[definition.code]}
            unitNames={unitNames}
          />
        ))}
      </ul>
    </fieldset>
  )
}

/** A module: a button that opens it, its count and Select all; then its screens. */
function ModuleSection({
  group,
  open,
  onToggle,
  draft,
  onChange,
  readOnly,
  errors,
  unitNames,
}: {
  group: ModuleGroup
  open: boolean
  onToggle: () => void
  draft: Draft
  onChange: (next: Draft) => void
  readOnly: boolean
  errors: Readonly<Record<string, string>>
  unitNames: ReadonlyMap<string, string>
}) {
  const panelId = useId()
  const codes = moduleCodes(group)
  const state = tickState(draft, codes)
  const ticked = codes.filter((code) => draft.has(code)).length
  const broken = codes.some((code) => errors[code])
  return (
    <section
      aria-label={group.module}
      className={cn(
        '@container rounded-[10px] border bg-card',
        broken ? 'border-destructive/60' : 'border-[#E0E0E0] dark:border-border',
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {open ? (
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-grey" />
          ) : (
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-grey" />
          )}
          <span className="min-w-0 truncate text-sm font-medium text-title">{group.module}</span>
          <span className="shrink-0 text-[0.6875rem] text-grey">
            {ticked} of {codes.length}
          </span>
        </button>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[0.6875rem] text-grey">
          <TickBox
            checked={state}
            disabled={readOnly}
            aria-label={`Select all in ${group.module}`}
            onCheckedChange={() => {
              let next: Draft = draft
              for (const screen of group.screens) {
                next = setTicked(
                  next,
                  screen.items.map((item) => item.code),
                  state !== true,
                  defaultTickFor(screen, next),
                )
              }
              onChange(next)
            }}
          />
          <span aria-hidden="true">All</span>
        </label>
      </div>
      {open && (
        <div id={panelId} className="grid gap-2 border-t border-border p-2 sm:p-3 @3xl:grid-cols-2">
          {group.screens.map((screen) => (
            <ScreenBlock
              key={screen.key}
              screen={screen}
              draft={draft}
              onChange={onChange}
              readOnly={readOnly}
              errors={errors}
              unitNames={unitNames}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * The role's permission ticks: the catalogue grouped by module → screen, an action per tick,
 * a scope per tick (with branches, departments or locations for Selected units), Select all
 * per screen and module, a search over the catalogue and "Ticked only". Sensitive ticks are
 * marked and their hint is written under them. The parent keeps the draft and saves it.
 */
export function PermissionEditor({
  catalogue,
  draft,
  onChange,
  readOnly,
  q,
  tickedOnly,
  onFilter,
  errors,
  unitNames,
}: EditorProps) {
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set())
  const tree = groupCatalogue(catalogue)
  const filtering = Boolean(q) || tickedOnly
  const shown = filtering
    ? filterTree(
        tree,
        (definition) => matchesSearch(definition, q) && (!tickedOnly || draft.has(definition.code)),
      )
    : tree
  const broken = new Set(
    catalogue.filter((definition) => errors[definition.code]).map((item) => item.module),
  )
  const isOpen = (module: string) => filtering || opened.has(module) || broken.has(module)
  const allOpen = shown.every((group) => isOpen(group.module))

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          key={q ?? ''}
          value={q}
          label="Search permissions"
          placeholder="Module, screen or action"
          onSearch={(next) => {
            onFilter({ q: next })
          }}
        />
        <ChipToggle
          label="Permissions shown"
          options={[
            { value: undefined, label: 'All' },
            { value: 'ticked', label: 'Ticked only' },
          ]}
          value={tickedOnly ? 'ticked' : undefined}
          onChange={(value) => {
            onFilter({ ticked: value ? true : undefined })
          }}
        />
        {!filtering && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOpened(allOpen ? new Set() : new Set(tree.map((group) => group.module)))
            }}
            className="h-9 px-2 text-xs text-sidebar dark:text-heading"
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </Button>
        )}
      </div>
      <p className="text-[0.6875rem] text-grey">
        Scope: Own is the holder’s own records; Team adds the people who report to them; Department,
        Branch and Company reach everyone there; Selected units reaches the branches, departments or
        locations chosen.
      </p>
      {shown.length === 0 ? (
        <EmptyNote>
          {tickedOnly && !q ? 'Nothing is ticked yet.' : 'No permission matches the search.'}
        </EmptyNote>
      ) : (
        <div className="grid gap-2">
          {shown.map((group) => (
            <ModuleSection
              key={group.module}
              group={group}
              open={isOpen(group.module)}
              onToggle={() => {
                setOpened((current) => {
                  const next = new Set(current)
                  if (next.has(group.module)) next.delete(group.module)
                  else next.add(group.module)
                  return next
                })
              }}
              draft={draft}
              onChange={onChange}
              readOnly={readOnly}
              errors={errors}
              unitNames={unitNames}
            />
          ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {filtering
          ? plural(
              shown.reduce((sum, group) => sum + moduleCodes(group).length, 0),
              'permission',
            ) + ' shown'
          : ''}
      </p>
    </div>
  )
}
