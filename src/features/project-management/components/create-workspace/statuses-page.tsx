import { useId, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

import type {
  StatusGroup,
  StatusMode,
  StatusTemplateId,
  TaskStatus,
  WorkflowTemplateId,
} from '../../types/pm.types'
import { DetailLayout } from './detail-layout'
import { ConfirmDialog } from './small-popups'
import { StatusGroupSection } from './status-group'
import { StatusTemplateSelect } from './status-template-select'
import { useWizardTemplates, useWorkflowTemplate } from './templates-context'
import { RadioMark } from './wizard-controls'
import {
  addStatus,
  addTemplate,
  checkStatusName,
  copyStatuses,
  DRAWN_STATUS_GROUPS,
  libraryTemplates,
  moveStatus,
  NEW_STATUS_COLOR,
  newStatusId,
  removeTemplate,
  renameTemplate,
  reorderStatus,
  type StatusEditing,
  statusesIn,
  type StatusLibrary,
  templateIdFor,
} from './wizard-state'
import { wz } from './wizard-styles'

export interface StatusesResult {
  statusMode: StatusMode
  statusTemplate: StatusTemplateId | null
  statuses: TaskStatus[]
}

interface StatusesPageProps {
  template: WorkflowTemplateId
  statusMode: StatusMode
  statuses: readonly TaskStatus[]
  library: StatusLibrary
  onSave: (result: StatusesResult, library: StatusLibrary) => void
  onDiscard: () => void
  onClose: () => void
}

interface Draft {
  mode: StatusMode
  /** The custom statuses (kept while "Default statuses" is chosen, so switching back keeps them). */
  statuses: TaskStatus[]
  library: StatusLibrary
}

const MODES: { value: StatusMode; label: string }[] = [
  { value: 'default', label: 'Default statuses for workspace' },
  { value: 'custom', label: 'Use custom statuses for workspace' },
]

/**
 * "Edit Statuses for <template>" (651:209727 default, 702:210425 custom, the status template pages
 * 916:141537 … 965:238253). Default statuses are read-only; custom ones can be added, renamed,
 * recoloured, reordered (drag, or the handle's arrow keys) and deleted.
 */
export function StatusesPage({
  template,
  statusMode,
  statuses,
  library,
  onSave,
  onDiscard,
  onClose,
}: StatusesPageProps) {
  const workflow = useWorkflowTemplate(template)
  const { statusTemplates } = useWizardTemplates()
  const defaults = workflow.setup.statuses
  const [draft, setDraft] = useState<Draft>(() => ({
    mode: statusMode,
    statuses: copyStatuses(statusMode === 'custom' ? statuses : defaults),
    library,
  }))
  const [editing, setEditing] = useState<StatusEditing | null>(null)
  const [deleting, setDeleting] = useState<TaskStatus | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [error, setError] = useState<string | undefined>()
  const typeLabelId = useId()
  const templatesLabelId = useId()
  const handleHintId = useId()
  const columnRef = useRef<HTMLDivElement>(null)

  const custom = draft.mode === 'custom'
  const shown = custom ? draft.statuses : defaults
  const templates = libraryTemplates(draft.library, statusTemplates)
  const groups = DRAWN_STATUS_GROUPS.filter(
    (group) => custom || statusesIn(shown, group).length > 0,
  )

  const update = (statusesNext: TaskStatus[]) => {
    setDraft((previous) => ({ ...previous, statuses: statusesNext }))
    setError(undefined)
  }

  const submitEdit = (name: string): string | null => {
    if (!editing) return null
    if (editing.kind === 'add') {
      const checked = checkStatusName(draft.statuses, editing.group, name)
      if ('error' in checked) return checked.error
      update(
        addStatus(draft.statuses, {
          id: newStatusId(),
          name: checked.name,
          color: editing.color,
          group: editing.group,
        }),
      )
      setAnnouncement(`${checked.name} added`)
    } else {
      const current = draft.statuses.find((status) => status.id === editing.id)
      if (!current) return null
      const checked = checkStatusName(draft.statuses, current.group, name, current.id)
      if ('error' in checked) return checked.error
      update(
        draft.statuses.map((status) =>
          status.id === current.id
            ? { ...status, name: checked.name, color: editing.color }
            : status,
        ),
      )
      setAnnouncement(`${current.name} renamed to ${checked.name}`)
    }
    setEditing(null)
    return null
  }

  const announceMove = (next: TaskStatus[], id: string) => {
    const moved = next.find((status) => status.id === id)
    if (!moved) return
    const group = statusesIn(next, moved.group)
    setAnnouncement(
      `${moved.name} moved to position ${group.findIndex((status) => status.id === id) + 1} of ${group.length}`,
    )
  }

  const chooseTemplate = (id: string, statusesNext: readonly TaskStatus[]) => {
    setDraft((previous) => ({
      mode: 'custom',
      statuses: copyStatuses(statusesNext),
      library: { ...previous.library, selectedId: id },
    }))
    setEditing(null)
    setError(undefined)
  }

  return (
    <DetailLayout
      title={`Edit Statuses for ${workflow.name}`}
      onDiscard={onDiscard}
      onClose={onClose}
      error={error}
      bodyClassName="sm:pt-[1.875rem] lg:overflow-y-hidden"
      onDone={() => {
        if (custom && draft.statuses.length === 0) {
          setError('Keep at least one status')
          return
        }
        onSave(
          {
            statusMode: draft.mode,
            statusTemplate: custom ? templateIdFor(draft.library.selectedId) : null,
            statuses: copyStatuses(shown),
          },
          draft.library,
        )
      }}
    >
      <p id={handleHintId} className="sr-only">
        Use the up and down arrow keys to move the status within its group.
      </p>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="grid gap-8 pb-4 lg:h-full lg:grid-cols-[minmax(0,28.8125rem)_auto_minmax(0,1fr)] lg:gap-x-[1.5625rem] lg:pb-0">
        <div className="min-w-0">
          <h3 id={typeLabelId} className={wz.title}>
            Status Type
          </h3>
          <div
            role="radiogroup"
            aria-labelledby={typeLabelId}
            className="mt-3 rounded-[1.125rem] bg-white px-5"
          >
            {MODES.map((mode, index) => (
              <div key={mode.value}>
                {index > 0 && <div className="border-t-[2.5px] border-black/8" />}
                <button
                  type="button"
                  role="radio"
                  aria-checked={draft.mode === mode.value}
                  onClick={() => {
                    setDraft((previous) => ({
                      ...previous,
                      mode: mode.value,
                      library: previous.library,
                    }))
                    setEditing(null)
                    setError(undefined)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-4 rounded-xl text-left text-base leading-[1.6875rem] text-[#262626] outline-none focus-visible:ring-2 focus-visible:ring-[#A181FF] sm:text-[1.125rem]',
                    index === 0 ? 'pt-[1.125rem] pb-[1.875rem]' : 'pt-[1.875rem] pb-[1.125rem]',
                  )}
                >
                  {mode.label}
                  <RadioMark checked={draft.mode === mode.value} />
                </button>
              </div>
            ))}
          </div>

          <h3 id={templatesLabelId} className={cn(wz.title, 'mt-[2.1875rem]')}>
            Status Templates
          </h3>
          <StatusTemplateSelect
            labelId={templatesLabelId}
            templates={templates}
            value={custom ? draft.library.selectedId : null}
            onSelect={(entry) => {
              chooseTemplate(entry.id, entry.statuses)
            }}
            onRename={(id, name) => {
              setDraft((previous) => ({
                ...previous,
                library: renameTemplate(previous.library, id, name),
              }))
            }}
            onDelete={(id) => {
              setDraft((previous) => ({
                ...previous,
                library: removeTemplate(previous.library, id),
              }))
            }}
            onAdd={(name) => {
              const added = addTemplate(draft.library, name, shown)
              setDraft({
                mode: 'custom',
                statuses: copyStatuses(shown),
                library: { ...added.library, selectedId: added.id },
              })
              setEditing(null)
            }}
          />
        </div>

        <div aria-hidden="true" className="hidden w-[2.5px] self-stretch bg-black/8 lg:block" />

        <div
          ref={columnRef}
          tabIndex={-1}
          aria-label="Statuses"
          role="region"
          className={cn(
            wz.scrollbarDark,
            'min-w-0 outline-none lg:h-full lg:overflow-y-auto lg:pr-4 lg:pb-6',
          )}
        >
          <div className="flex max-w-[30.35rem] flex-col gap-5 lg:pl-[0.5625rem]">
            {groups.map((group: StatusGroup) => (
              <StatusGroupSection
                key={group}
                group={group}
                statuses={statusesIn(shown, group)}
                editable={custom}
                editing={editing}
                dragId={dragId}
                handleHintId={handleHintId}
                onStartAdd={(target, color) => {
                  setEditing({ kind: 'add', group: target, color: color ?? NEW_STATUS_COLOR })
                }}
                onStartRename={(status) => {
                  setEditing({ kind: 'rename', id: status.id, color: status.color })
                }}
                onEditColor={(color) => {
                  setEditing((previous) => (previous ? { ...previous, color } : previous))
                }}
                onSubmitEdit={submitEdit}
                onCancelEdit={() => {
                  setEditing(null)
                }}
                onRecolor={(id, color) => {
                  update(
                    draft.statuses.map((status) =>
                      status.id === id ? { ...status, color } : status,
                    ),
                  )
                }}
                onDelete={setDeleting}
                onMove={(id, offset) => {
                  const next = moveStatus(draft.statuses, id, offset)
                  update(next)
                  announceMove(next, id)
                }}
                onDragStart={setDragId}
                onDrop={(overId) => {
                  if (dragId === null) return
                  const next = reorderStatus(draft.statuses, dragId, overId)
                  update(next)
                  announceMove(next, dragId)
                  setDragId(null)
                }}
                onDragEnd={() => {
                  setDragId(null)
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete Status"
        message={`Are you sure you want to delete the “${deleting?.name ?? ''}” status?`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (!deleting) return
          update(draft.statuses.filter((status) => status.id !== deleting.id))
          setAnnouncement(`${deleting.name} deleted`)
        }}
        returnFocus={() => columnRef.current}
      />
    </DetailLayout>
  )
}
