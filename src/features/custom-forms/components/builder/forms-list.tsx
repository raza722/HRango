import { type SyntheticEvent, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus, Search } from 'lucide-react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import {
  type DataTableColumn,
  type PaginatedResult,
  PaginatedTableCard,
  type RowAction,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { CF_CODES, FORM_PAGE_SIZES, STATUS_FILTER_LABELS } from '../../constants'
import {
  useCloseForm,
  useDeleteForm,
  useDuplicateForm,
  usePublishForm,
} from '../../hooks/use-custom-forms'
import type { FormsSearch } from '../../routing'
import { FORM_STATUSES, type FormSummary } from '../../types/custom-forms.types'
import { audienceText, countText, dateText, stampText } from '../../utils/format'
import {
  navyButtonClass,
  outlineButtonClass,
  tableClass,
  toolbarButtonClass,
} from '../../utils/styles'
import { PageHeaderCard, StatusChip } from '../shared/page-parts'

type Confirm = { kind: 'publish' | 'close' | 'delete'; form: FormSummary } | null

const STATUS_TABS = ['all', ...FORM_STATUSES] as const

/** The confirmation's words for each action. */
function confirmCopy({ kind, form }: NonNullable<Confirm>) {
  const responses = countText(form.responseCount, 'response')
  if (kind === 'delete') {
    return {
      title: 'Delete form',
      label: 'Delete',
      description:
        form.responseCount > 0
          ? `Delete “${form.title}” and its ${responses}? This cannot be undone.`
          : `Delete “${form.title}”? This cannot be undone.`,
    }
  }
  if (kind === 'close') {
    return {
      title: 'Close form',
      label: 'Close form',
      description: `Close “${form.title}”? People can no longer answer it; the ${responses} ${form.responseCount === 1 ? 'stays' : 'stay'}.`,
    }
  }
  const verb = form.status === 'closed' ? 'Reopen' : 'Publish'
  return {
    title: `${verb} form`,
    label: verb,
    description: `${verb} “${form.title}”? ${audienceText(form.audience)} will find it in My Forms.`,
  }
}

/**
 * The Forms list (`/custom-form/forms`): every form with its status, audience, questions and
 * responses; search and the status tabs live in the URL. The row menu offers what the status
 * allows: Edit, Publish / Reopen, Close, View responses, Duplicate, Delete.
 */
export function FormsList({
  search,
  result,
  onSearchChange,
  onOpen,
}: {
  search: FormsSearch
  result: PaginatedResult<FormSummary>
  onSearchChange: (patch: Partial<FormsSearch>) => void
  /** Open the builder on a form, or `new`. */
  onOpen: (id: string) => void
}) {
  const [text, setText] = useState(search.q ?? '')
  const [confirm, setConfirm] = useState<Confirm>(null)
  const can = {
    create: useCan(CF_CODES.formsCreate),
    edit: useCan(CF_CODES.formsEdit),
    publish: useCan(CF_CODES.formsPublish),
    remove: useCan(CF_CODES.formsDelete),
    responses: useCan(CF_CODES.responsesView),
  }
  const publish = usePublishForm()
  const close = useCloseForm()
  const duplicate = useDuplicateForm()
  const remove = useDeleteForm()

  const onSearch = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSearchChange({ q: text.trim() || undefined, page: 1 })
  }

  const actions = (row: FormSummary): RowAction[] => {
    const items: (RowAction | false)[] = [
      can.edit && {
        label: row.status === 'draft' ? 'Edit' : 'Open in builder',
        onSelect: () => {
          onOpen(row.id)
        },
      },
      can.publish &&
        row.status !== 'published' && {
          label: row.status === 'closed' ? 'Reopen' : 'Publish',
          onSelect: () => {
            setConfirm({ kind: 'publish', form: row })
          },
        },
      can.publish &&
        row.status === 'published' && {
          label: 'Close',
          onSelect: () => {
            setConfirm({ kind: 'close', form: row })
          },
        },
      can.create && {
        label: 'Duplicate',
        onSelect: () => {
          duplicate.mutate(row)
        },
      },
      can.remove &&
        !(row.status === 'published' && row.responseCount > 0) && {
          label: 'Delete',
          variant: 'destructive',
          onSelect: () => {
            setConfirm({ kind: 'delete', form: row })
          },
        },
    ]
    return items.filter((item): item is RowAction => item !== false)
  }

  const columns: DataTableColumn<FormSummary>[] = [
    {
      id: 'form',
      header: 'Form',
      mobile: 'heading',
      className: 'min-w-56 whitespace-normal',
      cell: (row) => (
        <span className="grid min-w-0 gap-0.5">
          {can.edit ? (
            <button
              type="button"
              onClick={() => {
                onOpen(row.id)
              }}
              className="w-fit text-left text-[0.8125rem] font-medium text-sidebar underline-offset-2 outline-none hover:underline focus-visible:underline dark:text-heading"
            >
              {row.title}
            </button>
          ) : (
            <span className="text-[0.8125rem] font-medium text-sidebar dark:text-heading">
              {row.title}
            </span>
          )}
          <span className="text-[0.6875rem] text-grey">
            {[row.category, row.anonymous ? 'Anonymous' : null].filter(Boolean).join(' · ') ||
              'No category'}
          </span>
        </span>
      ),
    },
    { id: 'status', header: 'Status', cell: (row) => <StatusChip status={row.status} /> },
    {
      id: 'audience',
      header: 'Audience',
      className: 'min-w-40 whitespace-normal',
      cell: (row) => audienceText(row.audience),
    },
    { id: 'questions', header: 'Questions', align: 'center', cell: (row) => row.fieldCount },
    {
      id: 'responses',
      header: 'Responses',
      align: 'center',
      cell: (row) =>
        can.responses && row.status !== 'draft' ? (
          <Link
            to="/custom-form/responses"
            search={{ formId: row.id }}
            aria-label={`${countText(row.responseCount, 'response')} to ${row.title}`}
            className="font-medium text-[#263871] underline-offset-2 hover:underline dark:text-sky-300"
          >
            {row.responseCount}
          </Link>
        ) : (
          row.responseCount
        ),
    },
    { id: 'closes', header: 'Closes', cell: (row) => dateText(row.closesOn) },
    { id: 'updated', header: 'Last change', cell: (row) => stampText(row.updatedAt) },
    {
      id: 'action',
      header: 'Action',
      align: 'center',
      className: 'w-16',
      cell: (row) => {
        const menu = actions(row)
        return menu.length > 0 ? (
          <RowActionsMenu
            label={`Actions for ${row.title}`}
            itemClassName={rowMenuItemClass.poppins}
            actions={menu}
          />
        ) : null
      },
    },
  ]

  const copy = confirm ? confirmCopy(confirm) : null
  const filtered = Boolean(search.q) || search.status !== undefined

  return (
    <>
      <PageHeaderCard
        title="Forms"
        actions={
          can.create && (
            <Button
              onClick={() => {
                onOpen('new')
              }}
              className={cn(toolbarButtonClass, navyButtonClass, 'gap-1.5 px-5 text-xs')}
            >
              <Plus aria-hidden="true" className="size-4" />
              New Form
            </Button>
          )
        }
      >
        <p className="text-xs text-grey">
          Build surveys and requests, send them to everyone, departments, branches or people, and
          read the answers under Responses.
        </p>
      </PageHeaderCard>

      <PaginatedTableCard
        title="All forms"
        titleAs="h2"
        caption="Forms"
        className={tableClass}
        toolbar={
          <>
            <div role="group" aria-label="Status" className="flex w-full flex-wrap gap-1.5">
              {STATUS_TABS.map((status) => {
                const active = (search.status ?? 'all') === status
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      onSearchChange({ status: status === 'all' ? undefined : status, page: 1 })
                    }}
                    className={cn(
                      'h-8 rounded-full border px-3.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 pointer-coarse:h-10',
                      active
                        ? 'border-sidebar bg-sidebar font-medium text-white dark:border-primary dark:bg-primary'
                        : 'border-[#CFCFCF] bg-card text-tab hover:text-heading dark:border-input',
                    )}
                  >
                    {STATUS_FILTER_LABELS[status]}
                  </button>
                )
              })}
            </div>
            <form
              role="search"
              onSubmit={onSearch}
              className="flex min-w-0 flex-1 gap-2 sm:max-w-md"
            >
              <Input
                aria-label="Search forms"
                placeholder="Search title or category…"
                value={text}
                onChange={(event) => {
                  setText(event.target.value)
                }}
                className="h-9 min-w-0 flex-1"
              />
              <Button
                type="submit"
                className={cn(toolbarButtonClass, navyButtonClass, 'gap-2 px-4 text-xs')}
              >
                <Search aria-hidden="true" className="size-4" />
                Search
              </Button>
            </form>
            {filtered && (
              <Button
                variant="outline"
                onClick={() => {
                  setText('')
                  onSearchChange({ q: undefined, status: undefined, page: 1 })
                }}
                className={cn(toolbarButtonClass, outlineButtonClass, 'px-4 text-xs')}
              >
                Clear
              </Button>
            )}
          </>
        }
        columns={columns}
        result={result}
        page={search.page}
        pageSize={search.pageSize}
        pageSizeOptions={FORM_PAGE_SIZES}
        onPageChange={(page) => {
          onSearchChange({ page })
        }}
        onPageSizeChange={(pageSize) => {
          onSearchChange({ pageSize, page: 1 })
        }}
        getRowId={(row) => row.id}
        emptyState={
          filtered
            ? 'No forms match the search or status.'
            : 'No forms yet. New Form starts the first one.'
        }
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title={copy?.title ?? ''}
        description={copy?.description ?? ''}
        confirmLabel={copy?.label ?? 'Confirm'}
        variant={confirm?.kind === 'delete' ? 'destructive' : 'default'}
        onConfirm={() => {
          if (!confirm) return
          const { kind, form } = confirm
          if (kind === 'publish')
            publish.mutate({ id: form.id, rowVersion: form.rowVersion, title: form.title })
          else if (kind === 'close') close.mutate(form)
          else remove.mutate(form)
          setConfirm(null)
        }}
      />
    </>
  )
}
