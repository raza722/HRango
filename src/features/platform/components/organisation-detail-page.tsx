import { type ReactNode, useState } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowLeft, Pencil } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { PageSpinner } from '@/components/feedback/spinner'
import { DataTable, PageContainer, PageHeader, RowActionsMenu } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Widget } from '@/features/dashboard/components/widget'
import { usePlatformStore } from '@/stores/platform-store'

import type { Invoice, Organisation, OrganisationCompany, Ticket } from '../api/platform.api'
import { formatDate, formatMoney } from '../format'
import { usePlatformGet, usePlatformList } from '../hooks/use-platform'
import { statusActions,type StatusChange } from '../organisation-status'
import { canOpenPlatform, canRegister, isAdmin } from '../platform-nav'
import { EditOrganisationDialog, StatusConfirm } from './organisations-page'
import { StatusChip } from './shared'

const routeApi = getRouteApi('/platform/_shell/organisations/$id')

function Facts({ rows }: { rows: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="break-words text-title">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function OrganisationDetailPage() {
  const { id } = routeApi.useParams()
  const role = usePlatformStore((state) => state.staff?.role)
  const seesBilling = canOpenPlatform(role, '/platform/invoices')
  const seesSupport = canOpenPlatform(role, '/platform/support')

  const organisation = usePlatformGet<Organisation>(`organisations/${id}`)
  const companies = usePlatformGet<OrganisationCompany[]>(`organisations/${id}/companies`)
  const invoices = usePlatformList<Invoice>(
    'invoices',
    { customerId: id, pageSize: 10 },
    seesBilling,
  )
  const tickets = usePlatformList<Ticket>('tickets', { customerId: id, pageSize: 10 }, seesSupport)
  const [editing, setEditing] = useState(false)
  const [changing, setChanging] = useState<StatusChange | null>(null)

  if (organisation.isError) {
    return (
      <ErrorState
        message={organisation.error.message}
        onRetry={() => {
          void organisation.refetch()
        }}
      />
    )
  }
  if (organisation.isPending) return <PageSpinner />
  const row = organisation.data

  return (
    <PageContainer>
      <Link
        to="/platform/organisations"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-title"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> All organisations
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {row.name} <StatusChip value={row.status} />
          </span>
        }
        description={`Registered ${formatDate(row.createdAt)}`}
        actionsLayout="inline"
        actions={
          canRegister(role) && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(true)
                }}
              >
                <Pencil /> Edit
              </Button>
              {isAdmin(role) && (
                <RowActionsMenu
                  label={`More actions for ${row.name}`}
                  actions={statusActions(row, setChanging)}
                />
              )}
            </>
          )
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:gap-5 @4xl/page:grid-cols-2">
        <Widget title="Contact">
          <Facts
            rows={[
              ['Name', row.contactName ?? '—'],
              ['Email', row.contactEmail],
              ['Phone', row.contactPhone ?? '—'],
              ['Country', row.country ?? '—'],
              ['Notes', row.notes ?? '—'],
            ]}
          />
        </Widget>
        <Widget title="Subscription">
          <Facts
            rows={[
              ['Plan', row.planName ?? 'No subscription'],
              ['Status', <StatusChip key="status" value={row.subscriptionStatus} />],
              ['Renews', formatDate(row.renewsOn)],
              ['Employees', row.employeeCount],
            ]}
          />
        </Widget>
      </div>

      <Widget title="Companies">
        <DataTable
          caption="Companies"
          data={companies.data ?? []}
          isLoading={companies.isPending}
          getRowId={(company) => company.id}
          columns={[
            { id: 'name', header: 'Company', mobile: 'heading', cell: (company) => company.name },
            { id: 'employees', header: 'Employees', cell: (company) => company.employeeCount },
            {
              id: 'active',
              header: 'Status',
              cell: (company) => <StatusChip value={company.isActive ? 'active' : 'inactive'} />,
            },
          ]}
        />
      </Widget>

      {seesBilling && (
        <Widget title="Invoices" description="The latest ten">
          <DataTable
            caption="Invoices"
            data={invoices.data?.data ?? []}
            isLoading={invoices.isPending}
            getRowId={(invoice) => invoice.id}
            emptyState={<p className="py-6 text-center text-sm text-muted-foreground">None yet.</p>}
            columns={[
              { id: 'number', header: 'Invoice', mobile: 'heading', cell: (i) => i.number },
              { id: 'issued', header: 'Issued', cell: (i) => formatDate(i.issueDate) },
              { id: 'due', header: 'Due', cell: (i) => formatDate(i.dueDate) },
              { id: 'amount', header: 'Amount', cell: (i) => formatMoney(i.amount) },
              { id: 'status', header: 'Status', cell: (i) => <StatusChip value={i.status} /> },
            ]}
          />
        </Widget>
      )}

      {seesSupport && (
        <Widget title="Support tickets" description="The latest ten">
          <DataTable
            caption="Support tickets"
            data={tickets.data?.data ?? []}
            isLoading={tickets.isPending}
            getRowId={(ticket) => ticket.id}
            emptyState={<p className="py-6 text-center text-sm text-muted-foreground">None yet.</p>}
            columns={[
              { id: 'subject', header: 'Subject', mobile: 'heading', cell: (t) => t.subject },
              {
                id: 'priority',
                header: 'Priority',
                cell: (t) => <StatusChip value={t.priority} />,
              },
              { id: 'status', header: 'Status', cell: (t) => <StatusChip value={t.status} /> },
            ]}
          />
        </Widget>
      )}

      {editing && (
        <EditOrganisationDialog
          row={row}
          onClose={() => {
            setEditing(false)
          }}
        />
      )}
      {changing && (
        <StatusConfirm
          {...changing}
          onClose={() => {
            setChanging(null)
          }}
        />
      )}
    </PageContainer>
  )
}
