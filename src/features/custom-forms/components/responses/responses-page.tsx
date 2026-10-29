import { type SyntheticEvent, useState } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Download, Inbox, Search } from 'lucide-react'
import { toast } from 'sonner'

import { FormField } from '@/components/form'
import { type DataTableColumn, PageContainer, PaginatedTableCard } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { downloadText, SearchSelect } from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { customFormsApi } from '../../api/custom-forms.api'
import { CF_CODES, FORM_PAGE_SIZES, STATUS_META } from '../../constants'
import {
  useCustomForm,
  useFormList,
  useResponses,
  useResponseSummary,
} from '../../hooks/use-custom-forms'
import type { ResponsesSearch } from '../../routing'
import type { CustomForm, FormResponse } from '../../types/custom-forms.types'
import { responsesCsv, responsesFileName } from '../../utils/csv'
import { answerText, audienceText, countText, dateText, stampText } from '../../utils/format'
import { isUnavailable } from '../../utils/pending'
import {
  cardClass,
  fieldsClass,
  navyButtonClass,
  outlineButtonClass,
  tableClass,
  toolbarButtonClass,
} from '../../utils/styles'
import { ResponseDialog } from '../fill/response-dialog'
import {
  EmptyBox,
  LoadError,
  LoadingBlock,
  NoAccess,
  PageHeaderCard,
  SectionCard,
  StatusChip,
  WaitingForServer,
} from '../shared/page-parts'
import { ResponsesSummary } from './responses-summary'

const routeApi = getRouteApi('/_app/custom-form/responses')

/** Forms offered in the picker (the first page of the newest; drafts have no answers). */
const PICKER_PAGE_SIZE = 100

/** One form's overview, counts, answers table and Export CSV. */
function FormResponses({
  form,
  search,
  update,
}: {
  form: CustomForm
  search: ResponsesSearch
  update: (patch: Partial<ResponsesSearch>) => void
}) {
  const canExport = useCan(CF_CODES.responsesExport)
  const canEdit = useCan(CF_CODES.formsEdit)
  const [text, setText] = useState(search.q ?? '')
  const [exporting, setExporting] = useState(false)
  const responses = useResponses(form.id, {
    q: search.q,
    page: search.page,
    pageSize: search.pageSize,
  })
  const summary = useResponseSummary(form.id)

  const exportCsv = async () => {
    setExporting(true)
    try {
      const rows = await customFormsApi.allResponses(form.id, search.q)
      downloadText(responsesCsv(form, rows), responsesFileName(form.title, new Date()))
      toast.success(`Exported ${countText(rows.length, 'response')}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The export failed.')
    } finally {
      setExporting(false)
    }
  }

  const columns: DataTableColumn<FormResponse>[] = [
    {
      id: 'respondent',
      header: 'Respondent',
      mobile: 'heading',
      className: 'min-w-40',
      cell: (row) =>
        row.respondent ? (
          <span className="grid">
            <span className="text-[0.75rem] font-medium text-person dark:text-heading">
              {row.respondent.name}
            </span>
            <span className="text-[0.625rem] text-grey">
              {[row.respondent.code, row.respondent.departmentName].filter(Boolean).join(' · ')}
            </span>
          </span>
        ) : (
          <span className="text-grey italic">Anonymous</span>
        ),
    },
    {
      id: 'submitted',
      header: 'Submitted',
      className: 'min-w-32',
      cell: (row) => stampText(row.submittedAt),
    },
    ...form.fields.map((field): DataTableColumn<FormResponse> => ({
      id: `field-${field.id}`,
      header: field.label,
      className: cn('whitespace-normal', field.type === 'long_text' ? 'min-w-56' : 'min-w-32'),
      cell: (row) => {
        const answer = row.answers.find((item) => item.fieldId === field.id)
        const shown = answerText(field, answer)
        if (!shown) return <span className="text-grey">—</span>
        if (field.type === 'file' && answer?.file) {
          return (
            <a
              href={answer.file.url}
              target="_blank"
              rel="noreferrer"
              className="text-[#263871] underline-offset-2 hover:underline dark:text-sky-300"
            >
              {shown}
            </a>
          )
        }
        return (
          <span className={field.type === 'long_text' ? 'line-clamp-3' : undefined}>{shown}</span>
        )
      },
    })),
    {
      id: 'action',
      header: 'Action',
      align: 'center',
      cell: (row) => (
        <Button
          variant="outline"
          onClick={() => {
            update({ response: row.id })
          }}
          aria-label={`View the response of ${row.respondent?.name ?? 'an anonymous person'}, ${stampText(row.submittedAt)}`}
          className={cn(toolbarButtonClass, outlineButtonClass, 'h-8 px-3.5 text-xs')}
        >
          View
        </Button>
      ),
    },
  ]

  const onSearch = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    update({ q: text.trim() || undefined, page: 1 })
  }

  return (
    <>
      <SectionCard
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            {form.title}
            <StatusChip status={form.status} />
          </span>
        }
        actions={
          <>
            {canEdit && (
              <Button
                asChild
                variant="outline"
                className={cn(toolbarButtonClass, outlineButtonClass, 'px-4 text-xs')}
              >
                <Link to="/custom-form/forms" search={{ edit: form.id }}>
                  Open in builder
                </Link>
              </Button>
            )}
            {canExport && (
              <Button
                disabled={exporting || form.responseCount === 0}
                onClick={() => {
                  void exportCsv()
                }}
                className={cn(toolbarButtonClass, navyButtonClass, 'gap-1.5 px-4 text-xs')}
              >
                <Download aria-hidden="true" className="size-4" />
                {exporting ? 'Exporting…' : 'Export CSV'}
              </Button>
            )}
          </>
        }
      >
        <dl className="grid gap-x-6 gap-y-2 text-xs @md:grid-cols-2 @3xl:grid-cols-4">
          {[
            ['Responses', String(form.responseCount)],
            ['Audience', audienceText(form.audience)],
            ['Closes', dateText(form.closesOn)],
            ['Answers', form.anonymous ? 'Anonymous' : 'With names'],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-0.5">
              <dt className="text-grey">{label}</dt>
              <dd className="font-medium break-words text-title dark:text-heading">{value}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      <SectionCard title="Summary">
        {summary.isPending ? (
          <LoadingBlock label="the summary" rows={3} />
        ) : summary.error ? (
          <LoadError
            error={summary.error}
            onRetry={() => {
              void summary.refetch()
            }}
          />
        ) : summary.data.total === 0 ? (
          <p className="text-sm text-grey">No responses yet, so there is nothing to count.</p>
        ) : (
          <ResponsesSummary fields={form.fields} summary={summary.data} />
        )}
      </SectionCard>

      <PaginatedTableCard
        title="Answers"
        titleAs="h2"
        caption={`Responses to ${form.title}`}
        className={tableClass}
        toolbar={
          !form.anonymous && (
            <form
              role="search"
              onSubmit={onSearch}
              className="flex min-w-0 flex-1 gap-2 sm:max-w-md"
            >
              <Input
                aria-label="Search respondents"
                placeholder="Search name or code…"
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
          )
        }
        columns={columns}
        result={responses}
        page={search.page}
        pageSize={search.pageSize}
        pageSizeOptions={FORM_PAGE_SIZES}
        onPageChange={(page) => {
          update({ page })
        }}
        onPageSizeChange={(pageSize) => {
          update({ pageSize, page: 1 })
        }}
        getRowId={(row) => row.id}
        emptyState={search.q ? 'No responses match the search.' : 'No responses yet.'}
      />
    </>
  )
}

/** The chosen form: its definition first, then everything else. */
function ChosenForm({
  formId,
  search,
  update,
}: {
  formId: string
  search: ResponsesSearch
  update: (patch: Partial<ResponsesSearch>) => void
}) {
  const form = useCustomForm(formId)
  if (form.isPending) {
    return (
      <div className={cn(cardClass, 'p-4 sm:p-6')}>
        <LoadingBlock label="the form" />
      </div>
    )
  }
  if (form.error) {
    return form.error.isNotFound ? (
      <div className={cn(cardClass, 'p-4 sm:p-6')}>
        <EmptyBox icon={<Inbox />} title="This form no longer exists">
          Pick another form above.
        </EmptyBox>
      </div>
    ) : (
      <LoadError
        error={form.error}
        onRetry={() => {
          void form.refetch()
        }}
      />
    )
  }
  return <FormResponses key={form.data.id} form={form.data} search={search} update={update} />
}

/**
 * Form Responses (`/custom-form/responses?formId=`): pick a form, see its overview, the counts of
 * its choice questions as bars, and the answers with one column per question; View opens one
 * response; Export CSV downloads them all. HR and admins only.
 */
export function ResponsesPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const canView = useCan(CF_CODES.responsesView)
  const forms = useFormList({ page: 1, pageSize: PICKER_PAGE_SIZE }, canView)
  const update = (patch: Partial<ResponsesSearch>) => {
    void navigate({ search: (current) => ({ ...current, ...patch }) })
  }

  if (!canView) {
    return (
      <PageContainer>
        <PageHeaderCard title="Form Responses" badge={false} />
        <NoAccess what="form responses" />
      </PageContainer>
    )
  }
  if (isUnavailable(forms)) {
    return (
      <PageContainer>
        <PageHeaderCard title="Form Responses" badge={false} />
        <WaitingForServer what="Form responses" />
      </PageContainer>
    )
  }

  const rows = forms.data?.available ? forms.data.data.data : []
  const options = rows
    .filter((form) => form.status !== 'draft' || form.id === search.formId)
    .map((form) => ({
      value: form.id,
      label: form.title,
      hint: `${STATUS_META[form.status].label} · ${countText(form.responseCount, 'response')}`,
    }))

  return (
    <PageContainer>
      <PageHeaderCard title="Form Responses">
        <div className={cn('grid max-w-xl gap-1', fieldsClass)}>
          <FormField label="Form">
            {(a11y) => (
              <SearchSelect
                {...a11y}
                value={search.formId ?? null}
                onChange={(next) => {
                  update({ formId: next ?? undefined, q: undefined, page: 1, response: undefined })
                }}
                options={options}
                placeholder={forms.isPending ? 'Loading forms…' : 'Select a form'}
                disabled={forms.isPending}
              />
            )}
          </FormField>
        </div>
      </PageHeaderCard>

      {forms.error ? (
        <LoadError
          error={forms.error}
          onRetry={() => {
            void forms.refetch()
          }}
        />
      ) : search.formId ? (
        <ChosenForm formId={search.formId} search={search} update={update} />
      ) : (
        <div className={cn(cardClass, 'p-4 sm:p-6')}>
          <EmptyBox icon={<Inbox />} title="Pick a form to see its responses">
            {forms.isPending
              ? 'Loading the forms…'
              : options.length === 0
                ? 'No form has been published yet. Publish one under Forms.'
                : `${countText(options.length, 'form')} to choose from.`}
          </EmptyBox>
        </div>
      )}

      {search.response && (
        <ResponseDialog
          responseId={search.response}
          onClose={() => {
            update({ response: undefined })
          }}
        />
      )}
    </PageContainer>
  )
}
