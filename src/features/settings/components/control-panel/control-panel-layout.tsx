import { Outlet } from '@tanstack/react-router'

import { PageContainer } from '@/components/layout'

import { ControlPanelNav } from './control-panel-nav'

/**
 * Settings → Control Panel: the menu card on the left and the selected
 * screen (list or form) on the right. Below 56rem of content width the menu
 * sits on top and folds away.
 */
export function ControlPanelLayout() {
  return (
    <PageContainer>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 sm:gap-5 @[56rem]/page:grid-cols-[13.5rem_minmax(0,1fr)] @[90rem]/page:grid-cols-[15rem_minmax(0,1fr)]">
        <ControlPanelNav />
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </PageContainer>
  )
}
