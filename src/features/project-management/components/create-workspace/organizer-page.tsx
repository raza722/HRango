import { useState } from 'react'

import { cn } from '@/lib/utils'

import { ORGANIZER_LABELS } from '../../constants'
import type { OrganizerFeature, WorkflowTemplateId } from '../../types/pm.types'
import { DetailLayout } from './detail-layout'
import { useWorkflowTemplate } from './templates-context'
import { InfoTip, Toggle } from './wizard-controls'
import { ORGANIZER_HELP, ORGANIZER_ICONS } from './wizard-icon-maps'
import { listedOrganizer } from './wizard-state'
import { wz } from './wizard-styles'

interface OrganizerPageProps {
  template: WorkflowTemplateId
  organizer: readonly OrganizerFeature[]
  onSave: (organizer: OrganizerFeature[]) => void
  onDiscard: () => void
  onClose: () => void
}

/**
 * "Default Settings for Organizer" (992:375830). The design hides each row's Toggle Button, which
 * leaves no way to switch a feature; the toggle is shown, before the info button.
 */
export function OrganizerPage({
  template,
  organizer,
  onSave,
  onDiscard,
  onClose,
}: OrganizerPageProps) {
  const [draft, setDraft] = useState<OrganizerFeature[]>(() => [...organizer])
  const workflow = useWorkflowTemplate(template)
  const features = listedOrganizer([...workflow.setup.organizer, ...organizer])

  return (
    <DetailLayout
      title="Default Settings for Organizer"
      onDiscard={onDiscard}
      onClose={onClose}
      onDone={() => {
        onSave(features.filter((feature) => draft.includes(feature)))
      }}
    >
      <h3 className={wz.title}>Required Organizers</h3>
      <p className={cn(wz.intro, 'mt-3')}>
        Choose to enable these organizer features to create the perfect workflow for your use case
        according to your workflow in HRango.
      </p>
      <hr className="mt-10 border-0 border-t-[2.5px] border-black/8" />
      <ul
        className={cn(
          wz.scrollbarDark,
          'mt-[2.0625rem] grid gap-x-[1.6875rem] gap-y-[1.5625rem] pb-4 md:grid-cols-2 lg:max-h-[32.75rem] lg:overflow-y-auto lg:pr-3',
        )}
      >
        {features.map((feature) => {
          const Icon = ORGANIZER_ICONS[feature]
          const label = ORGANIZER_LABELS[feature]
          return (
            <li key={feature} className={cn(wz.row, 'pr-5')}>
              <span aria-hidden="true" className={wz.rowTile}>
                <Icon className="max-h-[1.75rem] max-w-[2.3rem]" />
              </span>
              <span className={cn(wz.rowName, 'ml-[0.8rem]')}>{label}</span>
              <Toggle
                checked={draft.includes(feature)}
                label={label}
                onCheckedChange={(checked) => {
                  setDraft((previous) =>
                    checked
                      ? [...new Set([...previous, feature])]
                      : previous.filter((other) => other !== feature),
                  )
                }}
              />
              <InfoTip label={label} text={ORGANIZER_HELP[feature]} />
            </li>
          )
        })}
      </ul>
    </DetailLayout>
  )
}
