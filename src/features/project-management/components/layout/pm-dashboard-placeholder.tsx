import { ProjectManagementIcon } from '@/components/icons/project-management-icon'
import { ModulePlaceholder } from '@/components/layout'

/**
 * The four Project Management dashboards are in the side menu of both Project Management
 * files, but neither file draws them, so each page says so until a design exists.
 */
export function PmDashboardPlaceholder({ title }: { title: string }) {
  return (
    <ModulePlaceholder
      title={title}
      description="This dashboard is in the Project Management menu but has no screen in the Figma files yet."
      icon={ProjectManagementIcon}
      plannedScreens={[]}
    />
  )
}
