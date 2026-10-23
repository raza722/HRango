import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { ErrorState } from '@/components/feedback/error-state'
import { DataTable, type DataTableColumn } from '@/components/layout'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { cn } from '@/lib/utils'

import { ACTIVE_META, DEFAULT_PAGE_SIZE } from '../../constants'
import {
  useDeletePositionTitle,
  usePositionTitles,
  useSavePositionTitle,
  useSetPositionTitleActive,
} from '../../hooks/use-manpower'
import {
  positionTitleFormSchema,
  type PositionTitleFormValues,
} from '../../schemas/dialog-forms.schema'
import type { PositionTitle } from '../../types/manpower.types'
import { showSaveError, toastError } from '../../utils/errors'
import { Chip, StampCell } from '../shared/cells'
import { MpField, MpListFooter, MpSelect, SearchBox, ShowEntries } from '../shared/controls'
import {
  AddIcon,
  CheckIcon,
  CloseIcon,
  DeleteIcon,
  EditIcon,
  RefreshIcon,
  SearchIcon,
} from '../shared/mp-icons'
import {
  accent,
  boxClass,
  dialogBoxClass,
  dialogButton,
  headerButton,
  mpTableClass,
  smallButton,
} from '../shared/mp-styles'
import { CardBody, MpCard } from '../shared/page-shell'
import { ConfirmPopup, MpDialog } from '../shared/popups'
import { RowMenu } from '../shared/row-menu'
import { SettingsTabs } from './settings-tabs'

/** Add Position Title (and Edit, laid out the same). */
function PositionTitleDialog({
  title,
  onClose,
}: {
  title: PositionTitle | null
  onClose: () => void
}) {
  const save = useSavePositionTitle()
  const form = useForm<PositionTitleFormValues>({
    resolver: zodResolver(positionTitleFormSchema),
    defaultValues: { title: title?.title ?? '' },
  })
  const { register, handleSubmit, formState, setError } = form
  const submit = handleSubmit((values) => {
    save.mutate(
      { id: title?.id, input: { title: values.title.trim() } },
      {
        onSuccess: onClose,
        onError: (error) => {
          showSaveError(error, setError, ['title'], 'The position title could not be saved.')
        },
      },
    )
  })
  return (
    <MpDialog
      title={title ? 'Edit Position Title' : 'Add Position Title'}
      onClose={onClose}
      className="max-w-[25.5625rem]"
    >
      <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-8">
        <MpField
          label="Position Title"
          required
          error={formState.errors.title?.message}
          className="@xs:grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] @xs:items-center @xs:gap-x-4"
        >
          {(a11y) => (
            <input
              {...a11y}
              {...register('title')}
              placeholder="Marketing"
              className={cn(dialogBoxClass, 'w-full')}
            />
          )}
        </MpField>
        <button
          type="submit"
          disabled={save.isPending}
          className={cn(dialogButton, accent.bg, 'w-[11.5625rem] justify-self-center')}
        >
          {title ? 'Save Position' : 'Add Position'}
        </button>
      </form>
    </MpDialog>
  )
}

interface Filters {
  title: string
  status: string
}
const NO_FILTERS: Filters = { title: '', status: '' }

/** E-Budget Settings → Position Title: the job titles, with their filter row. */
export function PositionTitlesTab({
  page,
  goTo,
  filtersOpen,
}: {
  page: number
  goTo: (page: number) => void
  filtersOpen: boolean
}) {
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim())
  const [draft, setDraft] = useState<Filters>(NO_FILTERS)
  const [applied, setApplied] = useState<Filters>(NO_FILTERS)
  const [dialog, setDialog] = useState<{ title: PositionTitle | null } | null>(null)
  const [deleting, setDeleting] = useState<PositionTitle | null>(null)
  const remove = useDeletePositionTitle()
  const setActive = useSetPositionTitleActive()
  const list = usePositionTitles({ page, pageSize, search: debounced, ...applied })
  const offset = (page - 1) * pageSize

  const columns: DataTableColumn<PositionTitle>[] = [
    { id: 'sr', header: 'Sr#', cell: (_row, index) => offset + index + 1 },
    {
      id: 'title',
      header: 'Position Title',
      mobile: 'heading',
      className: 'min-w-[11rem]',
      cell: (row) => row.title,
    },
    { id: 'added', header: 'Added On', cell: (row) => <StampCell stamp={row.added} /> },
    { id: 'modified', header: 'Modified On', cell: (row) => <StampCell stamp={row.modified} /> },
    {
      id: 'status',
      header: <span className="sr-only">Status</span>,
      align: 'right',
      cell: (row) => <Chip {...ACTIVE_META[row.active ? 'true' : 'false']} />,
    },
  ]

  const addButton = (
    <button
      type="button"
      onClick={() => {
        setDialog({ title: null })
      }}
      className={cn(headerButton, accent.bg, 'min-w-[12.75rem]')}
    >
      <AddIcon aria-hidden="true" className="size-[0.8125rem]" />
      Add New Position Title
    </button>
  )

  return (
    <MpCard title="Employee Budget Settings" actions={filtersOpen ? undefined : addButton}>
      {filtersOpen && (
        <>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <ShowEntries
              value={pageSize}
              onChange={(size) => {
                setPageSize(size)
                goTo(1)
              }}
            />
            <div className="flex flex-wrap items-center gap-3.5">
              {addButton}
              <SearchBox
                label="Search position titles"
                value={search}
                onChange={(value) => {
                  setSearch(value)
                  goTo(1)
                }}
              />
            </div>
          </CardBody>
          <form
            aria-label="Position title filters"
            className="grid grid-cols-1 gap-3 px-4 sm:px-6 @md:grid-cols-2 @3xl:grid-cols-[repeat(2,minmax(0,11.875rem))_auto] @3xl:items-end"
            onSubmit={(event) => {
              event.preventDefault()
              setApplied(draft)
              goTo(1)
            }}
          >
            <MpField label="Position Title">
              {(a11y) => (
                <input
                  {...a11y}
                  value={draft.title}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, title: event.target.value }))
                  }}
                  className={cn(boxClass, 'w-full')}
                />
              )}
            </MpField>
            <MpField label="Status">
              {(a11y) => (
                <MpSelect
                  {...a11y}
                  value={draft.status}
                  onChange={(value) => {
                    setDraft((current) => ({ ...current, status: value }))
                  }}
                  noneLabel="Any"
                  placeholder=""
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                  ]}
                />
              )}
            </MpField>
            <div className="flex gap-3 @md:col-span-2 @3xl:col-span-1">
              <button type="submit" className={cn(smallButton, accent.bg, 'w-[7.4375rem]')}>
                <SearchIcon aria-hidden="true" className="size-[1.055rem]" />
                Search
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(NO_FILTERS)
                  setApplied(NO_FILTERS)
                  setSearch('')
                  goTo(1)
                  void list.refetch()
                }}
                className={cn(smallButton, accent.bg, 'w-[7.4375rem]')}
              >
                <RefreshIcon aria-hidden="true" className="h-[1.13rem] w-[0.85rem]" />
                Refresh
              </button>
            </div>
          </form>
        </>
      )}
      <div>
        <SettingsTabs current="position-title" />
        {list.isError ? (
          <ErrorState
            message="The position titles could not be loaded."
            onRetry={() => void list.refetch()}
            className="mx-4 shadow-none sm:mx-6"
          />
        ) : (
          <DataTable
            columns={columns}
            data={list.data?.data ?? []}
            getRowId={(row) => row.id}
            caption="Position titles"
            isLoading={list.isPending}
            isFetching={list.isFetching}
            className={mpTableClass}
            emptyState="No position titles match."
            rowActionsHeader="Action"
            rowActions={(row) => (
              <RowMenu
                label={`Actions for ${row.title}`}
                items={[
                  {
                    label: 'Edit',
                    icon: EditIcon,
                    onSelect: () => {
                      setDialog({ title: row })
                    },
                  },
                  {
                    label: row.active ? 'Deactivate' : 'Activate',
                    icon: row.active ? CloseIcon : CheckIcon,
                    onSelect: () => {
                      setActive.mutate(
                        { id: row.id, active: !row.active },
                        { onError: toastError('The position title could not be changed.') },
                      )
                    },
                  },
                  {
                    label: 'Delete',
                    icon: DeleteIcon,
                    onSelect: () => {
                      setDeleting(row)
                    },
                  },
                ]}
              />
            )}
          />
        )}
      </div>
      <MpListFooter meta={list.data?.meta} disabled={list.isFetching} onPageChange={goTo} />

      {dialog && (
        <PositionTitleDialog
          title={dialog.title}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      <ConfirmPopup
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete Position Title"
        icon={DeleteIcon}
        message="Are you sure you want to Delete this position title?"
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleting) {
            remove.mutate(deleting.id, {
              onError: toastError('The position title could not be deleted.'),
            })
          }
        }}
      />
    </MpCard>
  )
}
