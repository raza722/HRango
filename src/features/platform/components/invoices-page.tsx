import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CircleCheck, Plus, X } from 'lucide-react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { type DataTableColumn, RowActionsMenu } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { toDateValue } from '@/lib/date'

import { type Invoice, platformApi } from '../api/platform.api'
import { blank, formatDate, formatMoney, optionsOf } from '../format'
import {
  useListState,
  useOrganisationOptions,
  usePlatformList,
  usePlatformMutation,
} from '../hooks/use-platform'
import { ListPage, RecordDialog, StatusChip } from './shared'

function AddInvoiceDialog({ onClose }: { onClose: () => void }) {
  const organisations = useOrganisationOptions()
  const add = usePlatformMutation(
    (body: object) => platformApi.create('invoices', body),
    'Invoice issued',
  )
  return (
    <RecordDialog
      title="Issue invoice"
      submitLabel="Issue"
      values={{ issueDate: toDateValue(new Date()) }}
      fields={[
        {
          name: 'customerId',
          label: 'Organisation',
          kind: 'select',
          options: organisations,
          required: true,
        },
        { name: 'amount', label: 'Amount (PKR)', kind: 'number', required: true },
        { name: 'issueDate', label: 'Issue date', kind: 'date', required: true },
        { name: 'dueDate', label: 'Due date', kind: 'date', required: true },
      ]}
      onSubmit={(form) =>
        add.mutateAsync({
          customerId: Number(form.customerId),
          amount: Number(form.amount),
          issueDate: form.issueDate,
          dueDate: form.dueDate,
        })
      }
      onClose={onClose}
    />
  )
}

function PaidDialog({ row, onClose }: { row: Invoice; onClose: () => void }) {
  const paid = usePlatformMutation(
    (body: object) => platformApi.patch(`invoices/${row.id}/status`, body),
    `${row.number} marked paid`,
  )
  return (
    <RecordDialog
      title={`Mark ${row.number} paid`}
      description={`${row.customerName}, ${formatMoney(row.amount)}. This records a payment; it does not take one.`}
      submitLabel="Mark paid"
      values={{ paidOn: toDateValue(new Date()) }}
      fields={[
        { name: 'paidOn', label: 'Paid on', kind: 'date', required: true },
        { name: 'paymentReference', label: 'Payment reference' },
      ]}
      onSubmit={(form) =>
        paid.mutateAsync({
          status: 'paid',
          paidOn: form.paidOn,
          paymentReference: blank(form.paymentReference),
          rowVersion: row.rowVersion,
        })
      }
      onClose={onClose}
    />
  )
}

export function PlatformInvoicesPage() {
  const list = useListState()
  const result = usePlatformList<Invoice>('invoices', {
    page: list.page,
    pageSize: list.pageSize,
    q: list.q || undefined,
    status: list.filter,
  })
  const [adding, setAdding] = useState(false)
  const [paying, setPaying] = useState<Invoice | null>(null)
  const [voiding, setVoiding] = useState<Invoice | null>(null)
  const voidInvoice = usePlatformMutation(
    (row: Invoice) =>
      platformApi.patch(`invoices/${row.id}/status`, {
        status: 'void',
        rowVersion: row.rowVersion,
      }),
    'Invoice voided',
  )

  const columns: DataTableColumn<Invoice>[] = [
    { id: 'number', header: 'Invoice', mobile: 'heading', cell: (row) => row.number },
    {
      id: 'organisation',
      header: 'Organisation',
      cell: (row) => (
        <Link
          to="/platform/organisations/$id"
          params={{ id: row.customerId }}
          className="font-medium text-title hover:underline"
        >
          {row.customerName}
        </Link>
      ),
    },
    { id: 'issued', header: 'Issued', cell: (row) => formatDate(row.issueDate) },
    { id: 'due', header: 'Due', cell: (row) => formatDate(row.dueDate) },
    { id: 'amount', header: 'Amount', cell: (row) => formatMoney(row.amount) },
    { id: 'status', header: 'Status', cell: (row) => <StatusChip value={row.status} /> },
    { id: 'paid', header: 'Paid on', cell: (row) => formatDate(row.paidOn) },
  ]

  return (
    <>
      <ListPage
        title="Invoices"
        description="What organisations are billed. No payment gateway is connected: payments are recorded by hand."
        actions={
          <Button
            onClick={() => {
              setAdding(true)
            }}
          >
            <Plus /> Issue invoice
          </Button>
        }
        caption="All invoices"
        columns={columns}
        result={result}
        list={list}
        search="Organisation or number"
        filter={{ label: 'Status', options: optionsOf(['issued', 'overdue', 'paid', 'void']) }}
        getRowId={(row) => row.id}
        rowActions={(row) =>
          row.status === 'issued' || row.status === 'overdue' ? (
            <RowActionsMenu
              label={`Actions for ${row.number}`}
              actions={[
                {
                  label: 'Mark paid',
                  icon: CircleCheck,
                  onSelect: () => {
                    setPaying(row)
                  },
                },
                {
                  label: 'Void',
                  icon: X,
                  variant: 'destructive',
                  onSelect: () => {
                    setVoiding(row)
                  },
                },
              ]}
            />
          ) : null
        }
        emptyText="No invoices found."
      />
      {adding && (
        <AddInvoiceDialog
          onClose={() => {
            setAdding(false)
          }}
        />
      )}
      {paying && (
        <PaidDialog
          row={paying}
          onClose={() => {
            setPaying(null)
          }}
        />
      )}
      {voiding && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setVoiding(null)
          }}
          title={`Void ${voiding.number}?`}
          description="It stays on record but is no longer owed. This cannot be undone."
          confirmLabel="Void"
          variant="destructive"
          onConfirm={() => {
            voidInvoice.mutate(voiding)
            setVoiding(null)
          }}
        />
      )}
    </>
  )
}
