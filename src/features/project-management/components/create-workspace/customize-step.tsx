import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import type { WorkflowTemplateId, WorkspaceSetup } from '../../types/pm.types'
import { useWorkflowTemplate } from './templates-context'
import { useFocusOnMount } from './use-focus-on-mount'
import { HelpTip, IconTile, StatusRing } from './wizard-controls'
import { SUMMARY_HELP } from './wizard-icon-maps'
import { DefaultViewsIcon, OrganizerIcon, RowChevronIcon, StatusArrowIcon } from './wizard-icons'
import { type DetailPage, orderedStatuses, organizerSummary, viewsSummary } from './wizard-state'
import { wz } from './wizard-styles'

interface CustomizeStepProps {
  template: WorkflowTemplateId
  setup: WorkspaceSetup
  onOpenPage: (page: DetailPage) => void
  /** Focus the heading on mount (false when coming back from a detail page, which focuses its row). */
  focusHeading: boolean
  /** The row whose chevron to focus when coming back from its page. */
  returnTo: DetailPage | null
}

/** Step 3 "Customize Template" (576:191345, 605:195114, 610:194677, 651:206246). */
export function CustomizeStep({
  template,
  setup,
  onOpenPage,
  focusHeading,
  returnTo,
}: CustomizeStepProps) {
  const { name } = useWorkflowTemplate(template)
  const headingRef = useFocusOnMount<HTMLHeadingElement>(focusHeading)
  const statuses = orderedStatuses(setup.statuses)

  return (
    <div className="pb-4">
      <h2 ref={headingRef} tabIndex={-1} className={cn(wz.title, 'outline-none')}>
        Customize Default for <span className="font-semibold">{name}</span>
      </h2>
      <p className={cn(wz.intro, 'mt-3')}>
        Customize the required views, task statuses, and organizer relevant to your task, and
        project.
      </p>

      <h3 className="mt-[2.1875rem] text-[1.25rem] leading-[2.0625rem] font-medium text-[#262626] sm:text-[1.375rem]">
        Workflow Name
      </h3>
      <p className="mt-3.5 inline-flex min-h-[2.7rem] items-center rounded-[0.635rem] bg-[#E0D9FF] px-6 py-2.5 text-[0.952rem] leading-[1.4375rem] font-medium text-[#262626]">
        {name}
      </p>

      <hr className="mt-[2.5rem] mb-[1.5625rem] border-0 border-t-[2.5px] border-black/8" />

      <div className="flex flex-col gap-[1.5625rem]">
        <SummaryRow
          page="views"
          title="Default Views"
          icon={<DefaultViewsIcon className="size-5" />}
          help={SUMMARY_HELP.views}
          onOpen={onOpenPage}
          focus={returnTo === 'views'}
        >
          <p className={cn(wz.cardText, 'truncate')}>{viewsSummary(setup.views)}</p>
        </SummaryRow>
        <SummaryRow
          page="statuses"
          title="Task Statuses"
          icon={<StatusRing color="#2E64E2" />}
          help={SUMMARY_HELP.statuses}
          onOpen={onOpenPage}
          focus={returnTo === 'statuses'}
        >
          <p className="sr-only">{statuses.map((status) => status.name).join(', ')}</p>
          <div
            aria-hidden="true"
            className="flex min-w-0 items-center gap-4 overflow-hidden whitespace-nowrap"
          >
            {statuses.map((status, index) => (
              <span key={status.id} className="flex shrink-0 items-center gap-4">
                {index > 0 && (
                  <StatusArrowIcon className="h-[0.9325rem] w-[3.25rem] text-[#979797]" />
                )}
                <span className="flex items-center gap-2.5">
                  <StatusRing color={status.color} />
                  <span className={wz.cardText}>{status.name}</span>
                </span>
              </span>
            ))}
          </div>
        </SummaryRow>
        <SummaryRow
          page="organizer"
          title="Organizer"
          icon={<OrganizerIcon className="size-5" />}
          help={SUMMARY_HELP.organizer}
          onOpen={onOpenPage}
          focus={returnTo === 'organizer'}
        >
          <p className={cn(wz.cardText, 'truncate')}>
            {organizerSummary(setup.organizer) || 'No organizer features'}
          </p>
        </SummaryRow>
      </div>
    </div>
  )
}

/** One 120px row: icon, purple title, summary, "?" and the chevron that opens its page. */
function SummaryRow({
  page,
  title,
  icon,
  help,
  onOpen,
  focus,
  children,
}: {
  page: DetailPage
  title: string
  icon: ReactNode
  help: string
  onOpen: (page: DetailPage) => void
  focus: boolean
  children: ReactNode
}) {
  const chevronRef = useFocusOnMount<HTMLButtonElement>(focus)
  return (
    <section
      aria-label={title}
      className="flex min-h-[7.5rem] items-center gap-4 rounded-[1.125rem] bg-white py-4 pr-5 pl-5"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center gap-[1.0625rem]">
          <IconTile>{icon}</IconTile>
          <h3 className={wz.cardTitle}>{title}</h3>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
      <div className="flex shrink-0 items-center gap-[1.875rem]">
        <HelpTip label={title} text={help} />
        <button
          ref={chevronRef}
          type="button"
          aria-label={`Customize ${title}`}
          onClick={() => {
            onOpen(page)
          }}
          className="inline-flex size-[2.375rem] items-center justify-center rounded-[0.633rem] bg-[#844EFF]/10 text-[#7127EA] transition-colors hover:bg-[#844EFF]/20 focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none"
        >
          <RowChevronIcon className="h-[1.1rem] w-[0.63rem]" />
        </button>
      </div>
    </section>
  )
}
