import { useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import { VIEW_LABELS, WORKFLOW_TEMPLATES_BY_ID } from '../../constants'
import type { WorkflowTemplateId, WorkspaceSetup } from '../../types/pm.types'
import { DetailLayout } from './detail-layout'
import { Toggle } from './wizard-controls'
import { VIEW_ICONS } from './wizard-icon-maps'
import { DotsIcon } from './wizard-icons'
import { listedViews, toggleView } from './wizard-state'
import { wz } from './wizard-styles'

type ViewsDraft = Pick<WorkspaceSetup, 'views' | 'defaultView'>

interface ViewsPageProps {
  template: WorkflowTemplateId
  setup: ViewsDraft
  onSave: (draft: ViewsDraft) => void
  onDiscard: () => void
  onClose: () => void
}

/** "Default Settings for Views" (610:201097 and its copies per template). */
export function ViewsPage({ template, setup, onSave, onDiscard, onClose }: ViewsPageProps) {
  const [draft, setDraft] = useState<ViewsDraft>(() => ({
    views: [...setup.views],
    defaultView: setup.defaultView,
  }))
  const views = listedViews([...WORKFLOW_TEMPLATES_BY_ID[template].setup.views, ...setup.views])

  return (
    <DetailLayout
      title="Default Settings for Views"
      onDiscard={onDiscard}
      onClose={onClose}
      onDone={() => {
        onSave(draft)
      }}
    >
      <h3 className={wz.title}>Required Views</h3>
      <p className={cn(wz.intro, 'mt-3')}>
        When navigating to the Workspaces, Folders, and List in HRango, so you can set which views
        are automatically created and required, without having to create them manually. These views
        cannot be deleted.
      </p>
      <hr className="mt-10 border-0 border-t-[2.5px] border-black/8" />
      <ul className="mt-[0.4375rem] grid gap-x-[1.6875rem] gap-y-[1.5625rem] pt-[1.625rem] pb-4 md:grid-cols-2">
        {views.map((view) => {
          const Icon = VIEW_ICONS[view]
          const on = draft.views.includes(view)
          const isDefault = draft.defaultView === view
          const label = VIEW_LABELS[view]
          return (
            <li
              key={view}
              className={cn(
                wz.row,
                'relative pr-5',
                view === 'list' && 'border-2 border-[#7127EA] pl-3',
              )}
            >
              {view === 'list' && (
                <span className="absolute bottom-full left-1/2 flex h-[1.625rem] w-[13rem] -translate-x-1/2 justify-center rounded-t-[1.125rem] bg-[#7127EA] pt-[0.1875rem] text-[0.875rem] leading-[1.3125rem] font-medium text-white">
                  Always Required
                </span>
              )}
              <span aria-hidden="true" className={wz.rowTile}>
                <Icon className="max-h-[1.75rem] max-w-[1.75rem]" />
              </span>
              <span className={cn(wz.rowName, 'ml-[0.8rem]')}>{label}</span>
              {isDefault && (
                <span className="hidden h-[1.875rem] shrink-0 items-center rounded bg-white bg-[linear-gradient(rgba(132,78,255,0.1),rgba(132,78,255,0.1))] px-3 text-[0.789rem] leading-[1.1875rem] font-medium text-[#3D3D3D] shadow-[0_4px_4px_rgba(0,0,0,0.25)] sm:inline-flex">
                  Default View Selected
                </span>
              )}
              {isDefault && <span className="sr-only">, default view</span>}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${label} view options`}
                    className={wz.dotsButton}
                  >
                    <DotsIcon className="h-[0.33rem] w-[1.3125rem]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[13rem] rounded bg-white p-0 shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
                >
                  <DropdownMenuItem
                    disabled={isDefault}
                    onSelect={() => {
                      setDraft((previous) => ({
                        views: previous.views.includes(view)
                          ? previous.views
                          : [...previous.views, view],
                        defaultView: view,
                      }))
                    }}
                    className="justify-center px-4 py-2 text-[0.875rem] leading-[1.3125rem] font-medium text-[#3D3D3D]"
                  >
                    Select Default View
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Toggle
                checked={on}
                disabled={view === 'list'}
                label={`${label} view`}
                onCheckedChange={(checked) => {
                  setDraft((previous) => ({ ...previous, ...toggleView(previous, view, checked) }))
                }}
                className="ml-3"
              />
            </li>
          )
        })}
      </ul>
    </DetailLayout>
  )
}
