import { accessHandlers, resetAccessDb } from './access/handlers'
import { resetAssetsDb } from './assets/db'
import { assetHandlers } from './assets/handlers'
import { attendanceHandlers, resetAttendanceDb } from './attendance/handlers'
import { attendanceLogHandlers } from './attendance/logs-handlers'
import {
  attendanceOvertimeHandlers,
  resetAttendanceOvertimeDb,
} from './attendance/overtime-handlers'
import { resetAttendanceSettingsDb } from './attendance/settings-db'
import { attendanceSettingsHandlers } from './attendance/settings-handlers'
import { authHandlers } from './auth/handlers'
import { benefitsHandlers, resetBenefitsDb } from './benefits/handlers'
import { customFormHandlers, resetCustomFormsDb } from './custom-forms/handlers'
import { dashboardHandlers } from './dashboard/handlers'
import { deviceHandlers, resetDevicesDb } from './devices/handlers'
import { filesHandlers } from './files/handlers'
import { inboxHandlers, resetInbox } from './inbox/handlers'
import { leavesHandlers, resetLeavesDb } from './leaves/handlers'
import { manpowerPlanningHandlers, resetManpowerPlanningDb } from './manpower-planning/handlers'
import { resetOffboardingDb } from './offboarding/db'
import { offboardingHandlers } from './offboarding/handlers'
import { resetPayrollDb } from './payroll/db'
import { payrollEncashmentHandlers } from './payroll/encashment-handlers'
import { payrollRecordHandlers } from './payroll/records-handlers'
import { payrollRunHandlers } from './payroll/run-handlers'
import { payrollSettingsHandlers } from './payroll/settings-handlers'
import { performanceHandlers, resetPerformanceDb } from './performance/handlers'
import { pmDashboardHandlers, resetPmDashboardMocks } from './project-management/dashboard-handlers'
import { resetProjectManagementDb } from './project-management/db'
import { projectManagementHandlers } from './project-management/handlers'
import { recruitmentHandlers, resetRecruitmentDb } from './recruitment/handlers'
import { requestHandlers, resetRequestsDb } from './requests/handlers'
import { requestSettingsHandlers, resetRequestSettingsDb } from './requests/settings-handlers'
import { resetStandardRequestsDb, standardRequestHandlers } from './requests/standard'
import { resetRosterDb, rosterHandlers } from './roster/handlers'
import { resetSchedulingDb, schedulingHandlers } from './scheduling/handlers'
import { resetSettingsDb, settingsHandlers } from './settings/handlers'
import { resetTalentManagementDb } from './talent-management/db'
import { talentManagementHandlers } from './talent-management/handlers'
import { warningHistory, warningHistoryHandlers } from './warning-history/handlers'
import { warningPenalties, warningPenaltyHandlers } from './warning-penalties/handlers'
import { warningPolicies, warningPolicyHandlers } from './warning-policies/handlers'

/** Every mock endpoint. Add a feature's handlers here after creating `src/mocks/<feature>/`. */
export const handlers = [
  ...authHandlers,
  ...accessHandlers,
  ...filesHandlers,
  ...dashboardHandlers,
  ...inboxHandlers,
  ...warningPolicyHandlers,
  ...warningPenaltyHandlers,
  ...warningHistoryHandlers,
  ...settingsHandlers,
  ...rosterHandlers,
  ...schedulingHandlers,
  ...attendanceHandlers,
  ...attendanceSettingsHandlers,
  ...attendanceLogHandlers,
  ...attendanceOvertimeHandlers,
  ...deviceHandlers,
  // Before the request kinds, so /requests/settings/… never reads as a kind's path.
  ...requestSettingsHandlers,
  ...standardRequestHandlers,
  ...requestHandlers,
  ...payrollSettingsHandlers,
  ...payrollRunHandlers,
  ...payrollRecordHandlers,
  ...payrollEncashmentHandlers,
  ...assetHandlers,
  ...offboardingHandlers,
  ...projectManagementHandlers,
  ...pmDashboardHandlers,
  ...manpowerPlanningHandlers,
  ...benefitsHandlers,
  ...leavesHandlers,
  ...recruitmentHandlers,
  ...performanceHandlers,
  ...customFormHandlers,
  // Last: `/employees/lookup` and `/organisation/lookups/*` stay with the modules above.
  ...talentManagementHandlers,
]

/** Restores every mock table to its seed data (used between tests). */
export function resetMockDb(): void {
  warningPolicies.reset()
  warningPenalties.reset()
  warningHistory.reset()
  resetSettingsDb()
  resetRosterDb()
  resetSchedulingDb()
  resetAttendanceDb()
  resetAttendanceSettingsDb()
  resetAttendanceOvertimeDb()
  resetDevicesDb()
  // Settings first: the seeded requests take their approvers from the flows.
  resetRequestSettingsDb()
  resetRequestsDb()
  resetStandardRequestsDb()
  resetPayrollDb()
  resetAssetsDb()
  resetOffboardingDb()
  resetProjectManagementDb()
  resetPmDashboardMocks()
  resetManpowerPlanningDb()
  resetBenefitsDb()
  resetLeavesDb()
  resetTalentManagementDb()
  resetRecruitmentDb()
  resetPerformanceDb()
  resetCustomFormsDb()
  resetAccessDb()
  resetInbox()
}
