import { type SyntheticEvent, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { Search } from 'lucide-react'

import { type DataTableColumn, PageContainer, PaginatedTableCard } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import {
  ASSIGNED_META,
  CF_CODES,
  FORM_PAGE_SIZE,
  FORM_PAGE_SIZES,
  SUBMITTED_LABEL,
} from '../../constants'
import { useAssignedForms, useMyResponses } from '../../hooks/use-custom-forms'
import { MY_FORMS_TABS, type MyFormsSearch } from '../../routing'
import type { AssignedForm, MyResponse } from '../../types/custom-forms.types'
import { countText, dateText, stampText } from '../../utils/format'
import { isUnavailable, pagedResult } from '../../utils/pending'
import {
  cardClass,
  navyButtonClass,
  outlineButtonClass,
  tabClass,
  tableClass,
  toolbarButtonClass,
} from '../../utils/styles'
import { ResponseDialog } from '../fill/response-dialog'
import { Chip, NoAccess, PageHeaderCard, WaitingForServer } from '../shared/page-parts'
import { FillView } from './fill-view'

const routeApi = getRouteApi('/_app/custom-form/my-forms')

const TAB_LABELS = { assigned: 'Assigned to me', submissions: 'My submissions' } as const

/** Where the caller stands with an assigned form: to do, submitted or closed (with its label). */
function AssignedStatus({ form }: { form: AssignedForm }) {
  if (form.myResponseCount > 0) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <Chip meta={{ ...ASSIGNED_META.submitted, label: SUBMITTED_LABEL }} />
        {!form.oneResponsePerPerson && form.myResponseCount > 1 && (
          <span className="text-[0.6875rem] text-grey">{form.myResponseCount} times</span>
        )}
      </span>
    )
  }
  return <Chip meta={form.status === 'closed' ? ASSIGNED_META.closed : ASSIGNED_META.todo} />
}

/**
 * My Forms (`/custom-form/my-forms`), for every employee: the forms meant for them (Assigned to
 * me) with Fill in, and what they sent (My submissions) with View. The tab, search and page are
 * in the URL, as are the form being filled (`fill`) and the submission open (`response`).
 */
export function MyFormsPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const canView = useCan(CF_CODES.myFormsView)
  const canSubmit = useCan(CF_CODES.myFormsSubmit)
  const [text, setText] = useState(search.q ?? '')
  const params = { q: search.q, page: search.page, pageSize: search.pageSize }
  // Always read: it also tells whether the backend has the endpoints at all.
  const assigned = useAssignedForms(
    search.tab === 'assigned' ? params : { page: 1, pageSize: FORM_PAGE_SIZE },
    canView,
  )
  const mine = useMyResponses(params, canView && search.tab === 'submissions')
  const update = (patch: Partial<MyFormsSearch>) => {
    void navigate({ search: (current) => ({ ...current, ...patch }) })
  }

  if (!canView) {
    return (
      <PageContainer>
        <PageHeaderCard title="My Forms" badge={false} />
        <NoAccess what="My Forms" />
      </PageContainer>
    )
  }
  if (isUnavailable(assigned) || isUnavailable(mine)) {
    return (
      <PageContainer>
        <PageHeaderCard title="My Forms" badge={false} />
        <WaitingForServer what="The forms assigned to you and your submissions" />
      </PageContainer>
    )
  }

  const responseDialog = search.response ? (
    <ResponseDialog
      responseId={search.response}
      onClose={() => {
        update({ response: undefined })
      }}
    />
  ) : null

  if (search.fill) {
    return (
      <PageContainer>
        <FillView
          formId={search.fill}
          onBack={() => {
            update({ fill: undefined })
          }}
          onSubmitted={() => {
            setText('')
            update({ fill: undefined, tab: 'submissions', q: undefined, page: 1 })
          }}
          onViewResponse={(id) => {
            update({ response: id })
          }}
        />
        {responseDialog}
      </PageContainer>
    )
  }

  const assignedColumns: DataTableColumn<AssignedForm>[] = [
    {
      id: 'form',
      header: 'Form',
      mobile: 'heading',
      className: 'min-w-56 whitespace-normal',
      cell: (row) => (
        <span className="grid gap-0.5">
          <span className="text-[0.8125rem] font-medium text-sidebar dark:text-heading">
            {row.title}
          </span>
          {row.description && (
            <span className="line-clamp-2 text-[0.6875rem] text-grey">{row.description}</span>
          )}
        </span>
      ),
    },
    { id: 'category', header: 'Category', cell: (row) => row.category ?? '—' },
    { id: 'questions', header: 'Questions', align: 'center', cell: (row) => row.fieldCount },
    { id: 'closes', header: 'Closes', cell: (row) => dateText(row.closesOn) },
    { id: 'status', header: 'Status', cell: (row) => <AssignedStatus form={row} /> },
    {
      id: 'action',
      header: 'Action',
      align: 'center',
      cell: (row) =>
        row.canRespond && canSubmit ? (
          <Button
            onClick={() => {
              update({ fill: row.id })
            }}
            aria-label={`${row.myResponseCount > 0 ? 'Fill in again' : 'Fill in'}: ${row.title}`}
            className={cn(toolbarButtonClass, navyButtonClass, 'h-8 px-3.5 text-xs')}
          >
            {row.myResponseCount > 0 ? 'Fill in again' : 'Fill in'}
          </Button>
        ) : row.lastResponseId ? (
          <Button
            variant="outline"
            onClick={() => {
              if (row.lastResponseId) update({ response: row.lastResponseId })
            }}
            aria-label={`View my answers: ${row.title}`}
            className={cn(toolbarButtonClass, outlineButtonClass, 'h-8 px-3.5 text-xs')}
          >
            View
          </Button>
        ) : (
          <span className="text-[0.6875rem] text-grey">—</span>
        ),
    },
  ]

  const submissionColumns: DataTableColumn<MyResponse>[] = [
    {
      id: 'form',
      header: 'Form',
      mobile: 'heading',
      className: 'min-w-48 whitespace-normal',
      cell: (row) => (
        <span className="text-[0.8125rem] font-medium text-sidebar dark:text-heading">
          {row.formTitle}
        </span>
      ),
    },
    { id: 'category', header: 'Category', cell: (row) => row.category ?? '—' },
    { id: 'submitted', header: 'Submitted', cell: (row) => stampText(row.submittedAt) },
    {
      id: 'name',
      header: 'Your name',
      cell: (row) => (row.anonymous ? 'Hidden (anonymous)' : 'Shown to HR'),
    },
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
          aria-label={`View my answers: ${row.formTitle}, ${stampText(row.submittedAt)}`}
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
  const toolbar = (
    <form role="search" onSubmit={onSearch} className="flex min-w-0 flex-1 gap-2 sm:max-w-md">
      <Input
        aria-label="Search my forms"
        placeholder="Search forms…"
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
  const todo = assigned.data?.available
    ? assigned.data.data.data.filter((form) => form.canRespond && form.myResponseCount === 0).length
    : 0

  return (
    <PageContainer>
      <PageHeaderCard title="My Forms">
        <p className="text-xs text-grey">
          Surveys and requests HR has sent you, and the answers you have given.
          {search.tab === 'assigned' &&
            todo > 0 &&
            ` ${countText(todo, 'form')} to fill in on this page.`}
        </p>
      </PageHeaderCard>
      <Tabs
        value={search.tab}
        onValueChange={(next) => {
          const tab = MY_FORMS_TABS.find((item) => item === next)
          if (!tab) return
          setText('')
          update({ tab, q: undefined, page: 1 })
        }}
        className="gap-4 sm:gap-5"
      >
        <div className={cn(cardClass, 'px-4 sm:px-6')}>
          <TabsList
            aria-label="My Forms"
            className="relative flex h-auto w-full max-w-none justify-start gap-6 overflow-x-auto rounded-none bg-transparent p-0"
          >
            {MY_FORMS_TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab} className={tabClass}>
                {TAB_LABELS[tab]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="assigned">
          <PaginatedTableCard
            title="Assigned to me"
            titleAs="h2"
            caption="Forms assigned to me"
            className={tableClass}
            toolbar={toolbar}
            columns={assignedColumns}
            result={pagedResult(assigned)}
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
            emptyState={
              search.q
                ? 'No assigned forms match the search.'
                : 'Nothing to fill in. HR has not sent you any forms.'
            }
          />
        </TabsContent>
        <TabsContent value="submissions">
          <PaginatedTableCard
            title="My submissions"
            titleAs="h2"
            caption="My submissions"
            className={tableClass}
            toolbar={toolbar}
            columns={submissionColumns}
            result={pagedResult(mine)}
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
            emptyState={
              search.q ? 'No submissions match the search.' : 'You have not sent any answers yet.'
            }
          />
        </TabsContent>
      </Tabs>
      {responseDialog}
    </PageContainer>
  )
}
