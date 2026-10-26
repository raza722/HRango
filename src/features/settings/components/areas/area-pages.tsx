import { FormProvider } from 'react-hook-form'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'

import { UnsavedChangesDialog } from '@/components/feedback/unsaved-changes-dialog'
import { SelectField, TextareaField, TextField } from '@/components/form'
import type { DataTableColumn } from '@/components/layout'

import { areaResource } from '../../api/org-resource'
import { useLocationOptions } from '../../hooks/use-lookups'
import { useOrgPermissions } from '../../hooks/use-org-permissions'
import { useOrgRecordForm } from '../../hooks/use-org-record-form'
import { areaFormSchema } from '../../schemas/org-forms.schema'
import { DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH } from '../../schemas/shared'
import type { AreaRow } from '../../types/settings.types'
import { areaMapper } from '../../utils/form-mappers'
import { FilterSelect } from '../shared/filter-select'
import { OrgListPage } from '../shared/org-list-page'
import { SettingsFormCard } from '../shared/settings-form-card'

const listRoute = getRouteApi('/_app/settings/control-panel/areas/')
const LIST_PATH = '/settings/control-panel/areas'

/** Settings → Control Panel → Organization → Area (list). Not in the designs. */
export function AreaListPage() {
  const search = listRoute.useSearch()
  const navigate = listRoute.useNavigate()
  const locations = useLocationOptions()
  const { canEdit } = useOrgPermissions(areaResource)

  const columns: DataTableColumn<AreaRow>[] = [
    {
      id: 'name',
      header: 'Name',
      mobile: 'heading',
      cell: (row) =>
        canEdit ? (
          <Link
            to="/settings/control-panel/areas/$areaId"
            params={{ areaId: row.id }}
            className="text-foreground underline-offset-4 hover:underline"
          >
            {row.name}
          </Link>
        ) : (
          row.name
        ),
    },
    { id: 'location', header: 'Location', cell: (row) => row.locationName },
    {
      id: 'branches',
      header: 'Branches',
      cell: (row) => <span className="tabular-nums">{row.branchCount}</span>,
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
      resource={areaResource}
      title="Areas"
      search={search}
      onSearchChange={(patch) => {
        void navigate({
          search: (prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }),
          replace: true,
        })
      }}
      filterParams={{ locationId: search.locationId }}
      filters={
        <FilterSelect
          label="Filter by location"
          allLabel="All locations"
          options={locations.options}
          value={search.locationId}
          onChange={(locationId) => {
            void navigate({ search: (prev) => ({ ...prev, locationId, page: 1 }), replace: true })
          }}
        />
      }
      columns={columns}
      addLink={{ to: '/settings/control-panel/areas/new' }}
      onEdit={(row) => {
        void navigate({ to: '/settings/control-panel/areas/$areaId', params: { areaId: row.id } })
      }}
      deleteHint="An area that branches still use cannot be deleted."
    />
  )
}

/** "Area Create" / "Area Edit": Name, Location, Description (the design has no Area form). */
export function AreaFormPage({ areaId }: { areaId?: string }) {
  const navigate = useNavigate()
  const goToList = () => navigate({ to: LIST_PATH })
  const areaForm = useOrgRecordForm({
    resource: areaResource,
    id: areaId,
    schema: areaFormSchema,
    mapper: areaMapper,
    onSaved: goToList,
  })
  const { control } = areaForm.form
  const locations = useLocationOptions()

  return (
    <FormProvider {...areaForm.form}>
      <SettingsFormCard
        title={areaId ? 'Area Edit' : 'Area Create'}
        back={{ label: 'Back to areas', link: { to: LIST_PATH } }}
        onSubmit={areaForm.submit}
        onCancel={() => {
          void goToList()
        }}
        isSaving={areaForm.isSaving}
        isLoading={areaForm.isLoadingRecord}
        loadError={areaForm.loadError}
        onRetry={areaForm.retryLoad}
        readOnly={areaForm.readOnly}
      >
        <TextField
          control={control}
          name="name"
          label="Name"
          required
          autoComplete="off"
          maxLength={NAME_MAX_LENGTH}
        />
        <SelectField
          control={control}
          name="locationId"
          label="Location"
          required
          placeholder="Select Location"
          options={locations.options}
        />
        <TextareaField
          control={control}
          name="description"
          label="Description"
          maxLength={DESCRIPTION_MAX_LENGTH}
          showCount
        />
      </SettingsFormCard>
      <UnsavedChangesDialog guard={areaForm.guard} />
    </FormProvider>
  )
}
