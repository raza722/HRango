import { getRouteApi } from '@tanstack/react-router'

import { StandardPill } from '../../standard-parts'
import type { StandardSearch } from '../../standard-search'
import { SETTINGS_SECTIONS } from './loan-advances.constants'
import type { LoanSettingsSection } from './loan-advances.types'
import {
  LoanCategoriesSection,
  LoanRepaymentSection,
  LoanTypesSection,
} from './loan-advances-settings-lists'

const route = getRouteApi('/_app/requests/$type')

const sectionOf = (value: string | undefined): LoanSettingsSection =>
  SETTINGS_SECTIONS.find((item) => item.value === value)?.value ?? 'types'

/**
 * Loan & Advances → Settings: Types, Categories and Repayment in the pill, as
 * drawn (frames 4190:100688, 4195:106914, 4195:108102). The sub page is the
 * URL's `section` (Types is the default and is left out).
 */
export function LoanAdvancesSettings() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const section = sectionOf(search.section)
  const go = (patch: Partial<StandardSearch>) => {
    void navigate({ search: (previous) => ({ ...previous, ...patch }) })
  }
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
