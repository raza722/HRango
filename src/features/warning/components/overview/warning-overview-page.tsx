import { useState } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import { History, Plus, Settings } from 'lucide-react'

import { PageContainer, PageHeader, splitPageClassName } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { HistoryDialog } from '../history/history-dialog'
import { PenaltyTable } from '../penalty/penalty-table'
import { PolicyTable } from '../policy-table'
import { warningType } from '../type-styles'
import { ColumnPreferencesSheet } from './column-preferences-sheet'

const routeApi = getRouteApi('/_app/warning/')

/**
 * Warning module home: the Warning Policy and Penalty lists (collapsible,
 * each with "+ Add Form"), the History log and Column Preferences.
 * Each list keeps its own page in the URL (`?policyPage=2&penaltyPage=1`).
 */
export function WarningOverviewPage() {
  const { policyPage, penaltyPage } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const canSeeHistory = useCan('warning.settings.history.view')
  const canCreatePolicy = useCan('warning.settings.policies.create')
  const canEditPenalties = useCan('warning.settings.penalties.edit')

  return (
    <PageContainer>
      <div className={splitPageClassName}>
        <PageHeader
          className={cn('@[90rem]/page:col-span-2', warningType.pageHeader)}
          title="Policy"
          description="Warning policies and the penalties they lead to."
          actionsLayout="inline"
          actions={
            <>
              {canSeeHistory && (
                <Button
                  variant="secondary"
                  size="icon-lg"
                  aria-label="History"
                  title="History"
                  aria-haspopup="dialog"
                  onClick={() => {
                    setHistoryOpen(true)
                  }}
                >
                  <History className="size-5" strokeWidth={1.75} />
                </Button>
              )}
              <Button
                variant="secondary"
                size="icon-lg"
                aria-label="Column preferences"
                title="Column preferences"
                aria-expanded={columnsOpen}
                onClick={() => {
                  setColumnsOpen((value) => !value)
                }}
              >
                <Settings className="size-5" strokeWidth={1.75} />
              </Button>
            </>
          }
        />

        <PolicyTable
          collapsible
          page={policyPage}
          onPageChange={(next) => {
            void navigate({ search: (prev) => ({ ...prev, policyPage: next }) })
          }}
          onEdit={(policy) => {
            void navigate({ to: '/warning/policy', search: { edit: policy.id } })
          }}
          actions={
            canCreatePolicy ? (
              <Button variant="outline" asChild>
                <Link to="/warning/policy">
                  <Plus /> Add Form
                </Link>
              </Button>
            ) : undefined
          }
        />

        <PenaltyTable
          collapsible
          page={penaltyPage}
          onPageChange={(next) => {
            void navigate({ search: (prev) => ({ ...prev, penaltyPage: next }) })
          }}
          onEdit={(penalty) => {
            void navigate({ to: '/warning/penalty', search: { edit: penalty.warningPolicyId } })
          }}
          actions={
            canEditPenalties ? (
              <Button variant="outline" asChild>
                <Link to="/warning/penalty">
                  <Plus /> Add Form
                </Link>
              </Button>
            ) : undefined
          }
        />
      </div>

      {canSeeHistory && <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />}
      <ColumnPreferencesSheet open={columnsOpen} onOpenChange={setColumnsOpen} />
    </PageContainer>
  )
}
