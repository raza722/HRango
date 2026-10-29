import type { PageSearch } from '../../routing'
import { MonthlyPayrollView } from '../monthly/monthly-payroll-page'
import { PayrollSettingsLayout } from './settings-menu'

/*
 * The Payroll Settings menu's Pay Runs and Payroll History open their pages beside the menu,
 * like the settings tabs, instead of leaving for the sidebar's Payrolls → Monthly. Their URL
 * state lives under `/payroll/settings/…`; the sidebar's pages keep their own layouts. Loans
 * (Requests → Loan & Advances) and Appraisal (Performance → Appraisals) are put together in
 * their routes, since those features build on this one.
 */

/** Pay Runs: the Monthly payrolls with every action. */
export function PayrollPayRunsPage({
  search,
  onSearch,
}: {
  search: PageSearch
  onSearch: (patch: Partial<PageSearch>) => void
}) {
  return (
    <PayrollSettingsLayout current="pay-runs">
      <MonthlyPayrollView search={search} onSearch={onSearch} variant="pay-runs" />
    </PayrollSettingsLayout>
  )
}

/** Payroll History: the closed Monthly payrolls. */
export function PayrollHistoryPage({
  search,
  onSearch,
}: {
  search: PageSearch
  onSearch: (patch: Partial<PageSearch>) => void
}) {
  return (
    <PayrollSettingsLayout current="history">
      <MonthlyPayrollView search={search} onSearch={onSearch} variant="history" />
    </PayrollSettingsLayout>
  )
}
