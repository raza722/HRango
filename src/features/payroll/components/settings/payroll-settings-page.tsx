import { Link, useSearch } from '@tanstack/react-router'

import { PageContainer } from '@/components/layout'
import { cn } from '@/lib/utils'

import { type PayrollSettingsTab, SETTINGS_TABS } from '../../routing'
import { AccountTypesView } from './account-types'
import { BanksView } from './banks'
import { BenefitsView } from './benefits'
import { FormulasView, RulesView } from './formulas'
import { GeneralView } from './general'
import { IncentivesView } from './incentives'
import { PayItemsView } from './pay-items'
import { PayrollSettingsMenu } from './settings-menu'
import { TAB_LABELS, TAB_PATHS, viewOf } from './settings-nav'
import { TaxRebatesView } from './tax-rebates'
import { TaxStructuresView } from './tax-structures'

/**
 * Payroll Settings as drawn: the Payroll menu card on the left, and on the
 * right the tabs (General, Tax, Rewards, Pay Components, Account Type,
 * Disbursement Banks) above the tab's sub-tabs and their list or form.
 */
export function PayrollSettingsPage({ tab }: { tab: PayrollSettingsTab }) {
  const search: { view?: unknown } = useSearch({ strict: false })
  const view = viewOf(tab, typeof search.view === 'string' ? search.view : undefined)

  return (
    <PageContainer>
      <div className="grid items-start gap-4 sm:gap-5 @4xl/page:grid-cols-[13.75rem_minmax(0,1fr)]">
        <PayrollSettingsMenu />
        <section
          aria-labelledby="payroll-settings-title"
          className="min-w-0 overflow-hidden rounded-[10px] bg-card shadow-xs"
        >
          <h1 id="payroll-settings-title" className="sr-only">
            Payroll Settings
          </h1>
          <nav
            aria-label="Payroll Settings"
            className="flex scrollbar-thin items-end gap-x-8 overflow-x-auto border-b px-4 sm:gap-x-10 sm:px-6"
          >
            {SETTINGS_TABS.map((item) => {
              const selected = item === tab
              return (
                <Link
                  key={item}
                  to={TAB_PATHS[item]}
                  aria-current={selected ? 'page' : undefined}
                  className={cn(
                    'relative flex h-[3.75rem] shrink-0 items-center px-1 text-[0.8125rem] whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset',
                    selected
                      ? 'text-sm font-medium text-[#17263A] dark:text-heading'
                      : 'text-[#5C5C5C] hover:text-heading dark:text-field-foreground',
                  )}
                >
                  {selected && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-[-1.75rem] top-0 h-[3px] rounded-[10px] bg-[#17263A] dark:bg-primary"
                    />
                  )}
                  {TAB_LABELS[item]}
                </Link>
              )
            })}
          </nav>
          <div className="grid gap-6 px-4 py-6 sm:px-7">
            {tab === 'general' && <GeneralView view={view} />}
            {tab === 'tax' && view === 'tax-rebate' && <TaxRebatesView />}
            {tab === 'tax' && view === 'tax-structure' && <TaxStructuresView />}
            {tab === 'rewards' && view === 'benefits' && <BenefitsView />}
            {tab === 'rewards' && view === 'incentives' && <IncentivesView />}
            {tab === 'pay-components' && view === 'pay-items' && <PayItemsView />}
            {tab === 'pay-components' && view === 'formulas' && <FormulasView />}
            {tab === 'pay-components' && view === 'rules' && <RulesView />}
            {tab === 'account-type' && <AccountTypesView />}
            {tab === 'disbursement-banks' && <BanksView />}
          </div>
        </section>
      </div>
    </PageContainer>
  )
}
