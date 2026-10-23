import { createFileRoute } from '@tanstack/react-router'

import { ControlPanelLayout } from '@/features/settings'

/** Layout for every Control Panel screen: the menu card plus the selected screen. */
export const Route = createFileRoute('/_app/settings/control-panel')({
  component: ControlPanelLayout,
})
