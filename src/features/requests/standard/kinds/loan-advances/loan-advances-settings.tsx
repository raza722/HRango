import type { StandardSettingsProps } from '../../standard.types'
import { StandardPill } from '../../standard-parts'
import { SETTINGS_SECTIONS } from './loan-advances.constants'
import type { LoanSettingsSection } from './loan-advances.types'
import {
  LoanCategoriesSection,
  LoanRepaymentSection,
  LoanTypesSection,
} from './loan-advances-settings-lists'

const sectionOf = (value: string | undefined): LoanSettingsSection =>
  SETTINGS_SECTIONS.find((item) => item.value === value)?.value ?? 'types'

/**
 * Loan & Advances → Settings: Types, Categories and Repayment in the pill, as
 * drawn (frames 4190:100688, 4195:106914, 4195:108102). The sub page is the
 * URL's `section` (Types is the default and is left out); the route showing the
 * page (Requests, or Payroll Settings → Loans) owns the URL.
 */
export function LoanAdvancesSettings({ search, onSearch: go }: StandardSettingsProps) {
  const section = sectionOf(search.section)
  const pill = (
    <StandardPill
      label="Settings"
      items={SETTINGS_SECTIONS}
      value={section}
      onChange={(next) => {
        go({ section: next === 'types' ? undefined : next, page: 1 })
      }}
    />
  )
  const props = {
    pill,
    page: search.page,
    onPage: (page: number) => {
      go({ page })
    },
  }
  if (section === 'categories') return <LoanCategoriesSection key={section} {...props} />
  if (section === 'repayment') return <LoanRepaymentSection key={section} {...props} />
  return <LoanTypesSection key={section} {...props} />
}
