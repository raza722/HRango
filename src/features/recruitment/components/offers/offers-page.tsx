import { useState } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import {
  DataTable,
  type DataTableColumn,
  type RowAction,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  btn,
  ListFooter,
  PayrollCard,
  payrollTableClass,
  SearchSelect,
  StatusChip,
  toolbarButton,
} from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { OFFER_STATUS_META, RC_CODES, RC_PAGE_SIZE, SALARY_FREQUENCY_LABELS } from '../../constants'
import { useOpeningOptions } from '../../hooks/use-lookups'
import {
  useDeleteOffer,
  useOffers,
  useSendOffer,
  useWithdrawOffer,
} from '../../hooks/use-recruitment'
import type { OffersSearch } from '../../routing'
import { type Offer, OFFER_STATUSES } from '../../types/recruitment.types'
import { formatAmount, formatDay, labelOf } from '../../utils/format'
import { CandidateCell } from '../shared/fields'
import {
  FilterBar,
  FilterField,
  ListError,
  SearchBox,
  StatusFilterChips,
} from '../shared/list-parts'
import { RemarksDialog } from '../shared/remarks-dialog'
import { OfferDetailDialog, RespondDialog } from './offer-dialogs'
import { OfferFormDialog } from './offer-form-dialog'

const routeApi = getRouteApi('/_app/recruitment/offers')

type Kind = 'edit' | 'send' | 'respond' | 'withdraw' | 'delete'

/**
 * Offers: every offer with its status chips (Draft, Sent, Accepted, Declined, Withdrawn, Expired)
 * and the search and opening filters. A draft is edited, sent, withdrawn or deleted; a sent one
 * gets the candidate's answer or is withdrawn; an accepted one leads to Hire on its application.
 */
export function OffersPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const goTo = useNavigate()
  const canCreate = useCan(RC_CODES.offersCreate)
  const canEdit = useCan(RC_CODES.offersEdit)
  const canDelete = useCan(RC_CODES.offersDelete)
  const canSend = useCan(RC_CODES.offersSend)
  const canRespond = useCan(RC_CODES.offersRespond)
  const canWithdraw = useCan(RC_CODES.offersWithdraw)
  const canHire = useCan(RC_CODES.applicationsHire)
  const openings = useOpeningOptions()
  const send = useSendOffer()
  const withdraw = useWithdrawOffer()
  const remove = useDeleteOffer()
  const [current, setCurrent] = useState<{ kind: Kind; offer: Offer } | null>(null)

  const list = useOffers({
    q: search.q,
    status: search.status,
    jobOpeningId: search.jobOpeningId,
    page: search.page,
    pageSize: RC_PAGE_SIZE,
  })
  const update = (patch: Partial<OffersSearch>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }
  const filter = (patch: Partial<OffersSearch>) => {
    update({ ...patch, page: 1 })
  }
  const active = [search.q, search.jobOpeningId].filter(Boolean).length
  const close = () => {
    setCurrent(null)
  }

  const actionsFor = (offer: Offer): RowAction[] => {
    const open = (kind: Kind) => () => {
      setCurrent({ kind, offer })
    }
    const items: RowAction[] = []
    if (offer.status === 'draft') {
      if (canEdit) items.push({ label: 'Edit', onSelect: open('edit') })
      if (canSend) items.push({ label: 'Send', onSelect: open('send') })
    }
    if (offer.status === 'sent' && canRespond) {
      items.push({ label: 'Record Response', onSelect: open('respond') })
    }
    if (offer.status === 'accepted' && canHire && offer.applicationStage !== 'hired') {
      items.push({
        label: 'Go to Hire',
        onSelect: () => {
          void goTo({ to: '/recruitment/applications', search: { view: offer.applicationId } })
        },
      })
    }
    if ((offer.status === 'draft' || offer.status === 'sent') && canWithdraw) {
      items.push({ label: 'Withdraw', variant: 'destructive', onSelect: open('withdraw') })
    }
    if (offer.status === 'draft' && canDelete) {
      items.push({ label: 'Delete', variant: 'destructive', onSelect: open('delete') })
    }
    return items
  }

  const columns: DataTableColumn<Offer>[] = [
    {
      id: 'candidate',
      header: 'Candidate',
      mobile: 'heading',
      className: 'min-w-48',
      cell: (row) => (
        <button
          type="button"
          aria-label={`Open the offer for ${row.applicantName}`}
          onClick={() => {
            update({ view: row.id })
          }}
          className="w-full rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <CandidateCell name={row.applicantName} detail={row.applicantEmail} />
        </button>
      ),
    },
    {
      id: 'opening',
      header: 'Opening',
      className: 'min-w-36 whitespace-normal',
      cell: (row) => row.jobOpeningTitle,
    },
    {
      id: 'salary',
      header: 'Salary',
      align: 'right',
      cell: (row) => (
        <span className="tabular-nums">
          Rs {formatAmount(row.offeredSalary)}
          <span className="block text-xs text-muted-foreground">
            {labelOf(SALARY_FREQUENCY_LABELS, row.salaryFrequency)}
          </span>
        </span>
      ),
    },
    { id: 'joining', header: 'Joining', cell: (row) => formatDay(row.joiningDate) },
    { id: 'expires', header: 'Expires', cell: (row) => formatDay(row.expiresOn) },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusChip {...OFFER_STATUS_META[row.status]} />,
    },
    {
      id: 'dates',
      header: 'Sent / Answered',
      cell: (row) => `${formatDay(row.sentAt)} / ${formatDay(row.respondedAt)}`,
    },
  ]

  const offer = current?.offer
  return (
    <PayrollCard
      title="Offers"
      actions={
        canCreate && (
          <Button
            onClick={() => {
              update({ dialog: 'create', view: undefined })
            }}
            className={cn(toolbarButton, btn.navy)}
          >
            + New Offer
          </Button>
        )
      }
    >
      <StatusFilterChips
        label="Offer status"
        options={OFFER_STATUSES.map((value) => ({ value, label: OFFER_STATUS_META[value].label }))}
        value={search.status}
        onChange={(status) => {
          filter({ status })
        }}
      />
      <FilterBar
        label="Filter offers"
        active={active}
        onClear={() => {
          filter({ q: undefined, jobOpeningId: undefined })
        }}
      >
        <FilterField label="Search" className="@4xl:col-span-2">
          {(id) => (
            <SearchBox
              key={search.q ?? ''}
              id={id}
              value={search.q}
              label="Search offers"
              placeholder="Candidate or opening"
              onSearch={(q) => {
                filter({ q })
              }}
            />
          )}
        </FilterField>
        <FilterField label="Job Opening" className="@4xl:col-span-2">
          {(id) => (
            <SearchSelect
              id={id}
              value={search.jobOpeningId ?? null}
              onChange={(value) => {
                filter({ jobOpeningId: value ?? undefined })
              }}
              options={openings.options}
              placeholder="All openings"
              clearable
            />
          )}
        </FilterField>
      </FilterBar>

      {list.isError ? (
        <ListError error={list.error} what="offers" onRetry={() => void list.refetch()} />
      ) : (
        <div className="relative min-w-0 overflow-x-auto">
          <DataTable
            columns={columns}
            data={list.data?.data ?? []}
            getRowId={(row) => row.id}
            caption="Offers"
            isLoading={list.isPending}
            isFetching={list.isFetching}
            className={payrollTableClass}
            emptyState={
              active > 0 || search.status
                ? 'No offers match the filters.'
                : 'No offers yet. Make one from an application.'
            }
            rowActionsHeader="Actions"
            rowActions={(row) => (
              <RowActionsMenu
                label={`Actions for the offer to ${row.applicantName}`}
                itemClassName={rowMenuItemClass.inter}
                actions={[
                  {
                    label: 'View',
                    onSelect: () => {
                      update({ view: row.id })
                    },
                  },
                  ...actionsFor(row),
                ]}
              />
            )}
          />
        </div>
      )}
      <ListFooter
        meta={list.data?.meta}
        noun="offers"
        disabled={list.isFetching}
        onPageChange={(page) => {
          update({ page })
        }}
      />

      {search.view && (
        <OfferDetailDialog
          id={search.view}
          onClose={() => {
            update({ view: undefined })
          }}
          actionsFor={actionsFor}
        />
      )}
      {search.dialog === 'create' && (
        <OfferFormDialog
          id={null}
          onClose={() => {
            update({ dialog: undefined })
          }}
          onSaved={(saved) => {
            update({ dialog: undefined, view: saved.id })
          }}
        />
      )}
      {current?.kind === 'edit' && <OfferFormDialog id={current.offer.id} onClose={close} />}
      {current?.kind === 'respond' && <RespondDialog offer={current.offer} onClose={close} />}
      {offer && current.kind === 'send' && (
        <RemarksDialog
          title="Send Offer"
          intro={`Send the offer of Rs ${formatAmount(offer.offeredSalary)} to ${offer.applicantName}? It can no longer be edited, and the application moves to Offer.`}
          saveLabel="Send"
          saving={send.isPending}
          onSubmit={(remarks) => send.mutateAsync({ record: offer, remarks })}
          onClose={close}
        />
      )}
      {offer && current.kind === 'withdraw' && (
        <RemarksDialog
          title="Withdraw Offer"
          intro={`Withdraw the offer to ${offer.applicantName}? A new offer can be made afterwards.`}
          saveLabel="Withdraw"
          saving={withdraw.isPending}
          onSubmit={(remarks) => withdraw.mutateAsync({ record: offer, remarks })}
          onClose={close}
        />
      )}
      <ConfirmDialog
        open={current?.kind === 'delete'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title="Delete offer"
        description={`Delete the draft offer to ${offer?.applicantName ?? 'this candidate'}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (offer) {
            remove.mutate(offer, {
              onSuccess: () => {
                if (search.view === offer.id) update({ view: undefined })
              },
            })
          }
          close()
        }}
      />
    </PayrollCard>
  )
}
