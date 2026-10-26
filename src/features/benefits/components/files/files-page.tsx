import { type SyntheticEvent, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'

import { DataTable, type DataTableColumn } from '@/components/layout'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { ATTACHMENT_ACCEPT, ATTACHMENT_MAX_BYTES, BEN_CODES, categoryMeta } from '../../constants'
import {
  useAddPlanFile,
  useBenefitFiles,
  useBenefitsLookups,
  useDeleteFile,
} from '../../hooks/use-benefits'
import type { BenefitFile } from '../../types/benefits.types'
import { formatDay, formatSize } from '../../utils/format'
import { AddIcon, PlanDeleteIcon } from '../shared/benefit-icons'
import {
  accent,
  boxClass,
  buttonClass,
  placeholderColor,
  ruledRows,
  tableClass,
} from '../shared/benefit-styles'
import { BxSelect, FieldRow } from '../shared/controls'
import { BxDialog, DeleteConfirm } from '../shared/dialogs'
import { EmptyList, ListError } from '../shared/list-parts'
import { BenefitsPage } from '../shared/page-frame'

const routeApi = getRouteApi('/_app/benefits/files')

const COLUMNS = '@lg:grid-cols-[6rem_minmax(0,18rem)]'

/** Add File (not drawn): a plan and the file to attach to it. */
function AddFileDialog({ onClose }: { onClose: () => void }) {
  const lookups = useBenefitsLookups()
  const add = useAddPlanFile()
  const [planId, setPlanId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<{ plan?: string; file?: string; root?: string }>({})

  const submit = (event: SyntheticEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    if (!planId) next.plan = 'Choose the plan'
    if (!file) next.file = 'Choose a file'
    else if (file.size > ATTACHMENT_MAX_BYTES) next.file = 'The file must be 5 MB or smaller'
    setErrors(next)
    if (next.plan ?? next.file) return
    if (!file) return
    add.mutate(
      { planId, file },
      {
        onSuccess: onClose,
        onError: (error) => {
          setErrors({
            root: error instanceof ApiError ? error.message : 'Could not add the file.',
          })
        },
      },
    )
  }

  return (
    <BxDialog
      title="Add File"
      description="A file for one of the plans."
      onClose={onClose}
      className="max-w-[34rem]"
    >
      <form
        noValidate
        onSubmit={submit}
        className="@container grid gap-5 px-4 pt-4 pb-5 sm:px-[1.375rem]"
      >
        <FieldRow label="Plan" required columns={COLUMNS} error={errors.plan}>
          {(a11y) => (
            <BxSelect
              {...a11y}
              value={planId}
              onChange={setPlanId}
              placeholder="Select Plan"
              options={(lookups.data?.plans ?? []).map((plan) => ({
                value: plan.id,
                label: plan.name,
              }))}
            />
          )}
        </FieldRow>
        <FieldRow label="File" required columns={COLUMNS} error={errors.file}>
          {(a11y) => (
            <div className="flex min-w-0 gap-2.5">
              <input
                {...a11y}
                type="file"
                accept={ATTACHMENT_ACCEPT}
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null)
                }}
                className="peer sr-only"
              />
              <span
                className={cn(
                  boxClass,
                  'flex min-w-0 flex-1 items-center truncate',
                  !file && placeholderColor,
                )}
              >
                {file?.name ?? 'No File Chosen'}
              </span>
              <label
                htmlFor={a11y.id}
                className={cn(
                  buttonClass,
                  accent.outline,
                  'h-[2.4375rem] shrink-0 cursor-pointer px-3 text-xs font-normal peer-focus-visible:ring-[3px] peer-focus-visible:ring-[#7469E8]/35',
                )}
              >
                Choose File
              </label>
            </div>
          )}
        </FieldRow>
        {errors.root && (
          <p role="alert" className="text-sm text-destructive">
            {errors.root}
          </p>
        )}
        <div className="flex justify-end gap-3.5">
          <button
            type="button"
            onClick={onClose}
            className={cn(buttonClass, accent.outline, 'min-w-[8rem]')}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={add.isPending}
            className={cn(buttonClass, accent.bg, 'min-w-[8rem]')}
          >
            {add.isPending ? 'Uploading…' : 'Add File'}
          </button>
        </div>
      </form>
    </BxDialog>
  )
}

/**
 * Files (no frame draws this tab): the plans' attachments, each opening through its signed
 * link; Add File attaches another, and the bin removes one.
 */
export function BenefitFilesPage() {
  const { year } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const list = useBenefitFiles({ year })
  const remove = useDeleteFile()
  const canAdd = useCan(BEN_CODES.fileCreate)
  const canDelete = useCan(BEN_CODES.fileDelete)
  const canDownload = useCan(BEN_CODES.fileDownload)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<BenefitFile | null>(null)

  const columns: DataTableColumn<BenefitFile>[] = [
    {
      id: 'file',
      header: 'File Name',
      mobile: 'heading',
      className: 'whitespace-normal',
      cell: (row) =>
        row.file && canDownload ? (
          <a
            href={row.file.url}
            target="_blank"
            rel="noreferrer"
            className={cn('font-medium break-all hover:underline', accent.text)}
          >
            {row.fileName}
          </a>
        ) : (
          <span className="font-medium break-all">{row.fileName}</span>
        ),
    },
    { id: 'plan', header: 'Plan', cell: (row) => row.planName },
    { id: 'category', header: 'Category', cell: (row) => categoryMeta(row.category).label },
    {
      id: 'size',
      header: 'Size',
      cell: (row) => (row.sizeBytes === null ? '—' : formatSize(row.sizeBytes)),
    },
    { id: 'added', header: 'Added On', cell: (row) => formatDay(row.createdAt.slice(0, 10)) },
  ]

  return (
    <BenefitsPage
      tab="files"
      title="Files"
      year={year}
      onYearChange={(next) => {
        void navigate({ search: { year: next } })
      }}
      actions={
        canAdd ? (
          <button
            type="button"
            onClick={() => {
              setAdding(true)
            }}
            className={cn(buttonClass, accent.bg, 'px-3')}
          >
            <AddIcon className="size-[0.8125rem]" />
            Add File
          </button>
        ) : undefined
      }
    >
      {list.isError ? (
        <ListError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={list.data ?? []}
          getRowId={(row) => row.id}
          caption="Plan files"
          isLoading={list.isPending}
          isFetching={list.isFetching}
          loadingRowCount={3}
          className={cn(tableClass, ruledRows)}
          emptyState={
            <EmptyList>
              There are no files yet. A plan’s attachment shows here once it is added.
            </EmptyList>
          }
          rowActionsHeader="Action"
          rowActions={
            canDelete
              ? (row) => (
                  <button
                    type="button"
                    aria-label={`Remove ${row.fileName}`}
                    onClick={() => {
                      setDeleting(row)
                    }}
                    className="flex size-8 items-center justify-center rounded-md text-[#C2420B] outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 sm:-my-1"
                  >
                    <PlanDeleteIcon className="h-[1.05rem] w-[0.94rem]" />
                  </button>
                )
              : undefined
          }
        />
      )}
      {adding && (
        <AddFileDialog
          onClose={() => {
            setAdding(false)
          }}
        />
      )}
      <DeleteConfirm
        open={deleting !== null}
        title="Remove File"
        question={deleting ? `Are you sure you want to remove “${deleting.fileName}”?` : ''}
        confirmLabel="Remove File"
        pending={remove.isPending}
        onClose={() => {
          setDeleting(null)
        }}
        onConfirm={() => {
          if (!deleting) return
          remove.mutate(deleting, {
            onSuccess: () => {
              setDeleting(null)
            },
            onError: (error) => {
              setDeleting(null)
              toast.error(error instanceof ApiError ? error.message : 'Could not remove the file.')
            },
          })
        }}
      />
    </BenefitsPage>
  )
}
