import { FormProvider, useWatch } from 'react-hook-form'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'

import { UnsavedChangesDialog } from '@/components/feedback/unsaved-changes-dialog'
import { CheckboxField, TextareaField, TextField } from '@/components/form'
import type { DataTableColumn } from '@/components/layout'
import { Badge } from '@/components/ui/badge'

import { jobTitleResource } from '../../api/org-resource'
import { useOrgPermissions } from '../../hooks/use-org-permissions'
import { useOrgRecordForm } from '../../hooks/use-org-record-form'
import { jobTitleFormSchema } from '../../schemas/org-forms.schema'
import { DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH } from '../../schemas/shared'
import type { JobTitleRow } from '../../types/settings.types'
import { jobTitleMapper } from '../../utils/form-mappers'
import { OrgListPage } from '../shared/org-list-page'
import { SettingsFormCard } from '../shared/settings-form-card'

const listRoute = getRouteApi('/_app/settings/control-panel/job-titles/')
const LIST_PATH = '/settings/control-panel/job-titles'

/** Settings → Control Panel → Organization → Job Title (list). */
export function JobTitleListPage() {
  const search = listRoute.useSearch()
  const navigate = listRoute.useNavigate()
  const { canEdit } = useOrgPermissions(jobTitleResource)

  const columns: DataTableColumn<JobTitleRow>[] = [
    {
      id: 'name',
      header: 'Name',
      mobile: 'heading',
      cell: (row) =>
        canEdit ? (
          <Link
            to="/settings/control-panel/job-titles/$jobTitleId"
            params={{ jobTitleId: row.id }}
            className="text-foreground underline-offset-4 hover:underline"
          >
            {row.name}
          </Link>
        ) : (
          row.name
        ),
    },
    {
      id: 'headCount',
      header: 'Head Count',
      cell: (row) =>
        row.limitHeadCount && row.maxHeadCount !== null ? (
          <span className="tabular-nums">
            {row.headCount.toLocaleString('en-US')} of {row.maxHeadCount.toLocaleString('en-US')}
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-2">
            <span className="tabular-nums">{row.headCount.toLocaleString('en-US')}</span>
            <Badge variant="outline" className="font-normal text-muted-foreground">
              No limit
            </Badge>
          </span>
        ),
    },
    {
      id: 'description',
      header: 'Description',
      cell: (row) => (
        <span className="line-clamp-2 text-muted-foreground">{row.description ?? '—'}</span>
      ),
      className: 'hidden max-w-md @3xl:table-cell',
    },
  ]

  return (
    <OrgListPage
      resource={jobTitleResource}
      title="Job Titles"
      search={search}
      onSearchChange={(patch) => {
        void navigate({
          search: (prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }),
          replace: true,
        })
      }}
      columns={columns}
      addLink={{ to: '/settings/control-panel/job-titles/new' }}
      onEdit={(row) => {
        void navigate({
          to: '/settings/control-panel/job-titles/$jobTitleId',
          params: { jobTitleId: row.id },
        })
      }}
      deleteHint="A job title that employees still hold cannot be deleted."
    />
  )
}

/**
 * "Job Title": Name, Limit Head Count and, while that is ticked, a required
 * Max Head Count. The design also repeats the Location map here; a job title
 * has no place, so it is left out.
 */
export function JobTitleFormPage({ jobTitleId }: { jobTitleId?: string }) {
  const navigate = useNavigate()
  const goToList = () => navigate({ to: LIST_PATH })
  const jobTitleForm = useOrgRecordForm({
    resource: jobTitleResource,
    id: jobTitleId,
    schema: jobTitleFormSchema,
    mapper: jobTitleMapper,
    onSaved: goToList,
  })
  const { form } = jobTitleForm
  const { control } = form
  const limitHeadCount = useWatch({ control, name: 'limitHeadCount' })

  return (
    <FormProvider {...form}>
      <SettingsFormCard
        title={jobTitleId ? 'Job Title Edit' : 'Job Title'}
        back={{ label: 'Back to job titles', link: { to: LIST_PATH } }}
        onSubmit={jobTitleForm.submit}
        onCancel={() => {
          void goToList()
        }}
        isSaving={jobTitleForm.isSaving}
        isLoading={jobTitleForm.isLoadingRecord}
        loadError={jobTitleForm.loadError}
        onRetry={jobTitleForm.retryLoad}
        readOnly={jobTitleForm.readOnly}
      >
        <TextField
          control={control}
          name="name"
          label="Name"
          required
          autoComplete="off"
          maxLength={NAME_MAX_LENGTH}
        />
        <CheckboxField
          control={control}
          name="limitHeadCount"
          label="Limit Head Count"
          tone="navy"
          onCheckedChange={(checked) => {
            if (checked) {
              // Wait for the field to render before focusing it.
              window.setTimeout(() => {
                form.setFocus('maxHeadCount')
              }, 0)
            } else {
              form.setValue('maxHeadCount', '', { shouldDirty: true })
              form.clearErrors('maxHeadCount')
            }
          }}
        />
        {limitHeadCount && (
          <TextField
            control={control}
            name="maxHeadCount"
            label="Max Head Count"
            required
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 25"
            description="New hires into this title stop once the count is reached."
            inputClassName="@xl:max-w-xs"
          />
        )}
        <TextareaField
          control={control}
          name="description"
          label="Description"
          maxLength={DESCRIPTION_MAX_LENGTH}
          showCount
          textareaClassName="min-h-36"
        />
      </SettingsFormCard>
      <UnsavedChangesDialog guard={jobTitleForm.guard} />
    </FormProvider>
  )
}
