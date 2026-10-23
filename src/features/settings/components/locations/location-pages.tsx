import { FormProvider } from 'react-hook-form'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'

import { UnsavedChangesDialog } from '@/components/feedback/unsaved-changes-dialog'
import { SelectField, TextareaField, TextField } from '@/components/form'
import type { DataTableColumn } from '@/components/layout'

import { locationResource } from '../../api/org-resource'
import { useCompanyOptions } from '../../hooks/use-lookups'
import { useOrgRecordForm } from '../../hooks/use-org-record-form'
import { locationFormSchema } from '../../schemas/org-forms.schema'
import { DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH, PREFIX_MAX_LENGTH } from '../../schemas/shared'
import type { LocationRow } from '../../types/settings.types'
import { locationMapper } from '../../utils/form-mappers'
import { FilterSelect } from '../shared/filter-select'
import { GeoLocationFields } from '../shared/geo-location-fields'
import { OrgListPage } from '../shared/org-list-page'
import { SettingsFormCard } from '../shared/settings-form-card'

const listRoute = getRouteApi('/_app/settings/control-panel/locations/')
const LIST_PATH = '/settings/control-panel/locations'

function formatCoordinates(row: LocationRow) {
  if (row.latitude === null || row.longitude === null) return '—'
  return (
    <span className="tabular-nums">
      {row.latitude.toFixed(4)}, {row.longitude.toFixed(4)}
    </span>
  )
}

/** Settings → Control Panel → Organization → Location (list). */
export function LocationListPage() {
  const search = listRoute.useSearch()
  const navigate = listRoute.useNavigate()
  const companies = useCompanyOptions()

  const columns: DataTableColumn<LocationRow>[] = [
    {
      id: 'name',
      header: 'Name',
      mobile: 'heading',
      cell: (row) => (
        <Link
          to="/settings/control-panel/locations/$locationId"
          params={{ locationId: row.id }}
          className="text-foreground underline-offset-4 hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    { id: 'company', header: 'Company', cell: (row) => row.companyName },
    { id: 'prefix', header: 'Prefix', cell: (row) => row.employeePrefix || '—' },
    {
      id: 'coordinates',
      header: 'Coordinates',
      cell: formatCoordinates,
      className: 'hidden @3xl:table-cell',
    },
  ]

  return (
    <OrgListPage
      resource={locationResource}
      title="Locations"
      search={search}
      onSearchChange={(patch) => {
        void navigate({
          search: (prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }),
          replace: true,
        })
      }}
      filterParams={{ companyId: search.companyId }}
      filters={
        <FilterSelect
          label="Filter by company"
          allLabel="All companies"
          options={companies.options}
          value={search.companyId}
          onChange={(companyId) => {
            void navigate({ search: (prev) => ({ ...prev, companyId, page: 1 }), replace: true })
          }}
        />
      }
      columns={columns}
      addLink={{ to: '/settings/control-panel/locations/new' }}
      onEdit={(row) => {
        void navigate({
          to: '/settings/control-panel/locations/$locationId',
          params: { locationId: row.id },
        })
      }}
      deleteHint="A location that still has areas or branches cannot be deleted."
    />
  )
}

/** "Location Create" / "Location Edit". */
export function LocationFormPage({ locationId }: { locationId?: string }) {
  const navigate = useNavigate()
  const goToList = () => navigate({ to: LIST_PATH })
  const locationForm = useOrgRecordForm({
    resource: locationResource,
    id: locationId,
    schema: locationFormSchema,
    mapper: locationMapper,
    onSaved: goToList,
  })
  const { control } = locationForm.form
  const companies = useCompanyOptions()

  return (
    <FormProvider {...locationForm.form}>
      <SettingsFormCard
        title={locationId ? 'Location Edit' : 'Location Create'}
        back={{ label: 'Back to locations', link: { to: LIST_PATH } }}
        onSubmit={locationForm.submit}
        onCancel={() => {
          void goToList()
        }}
        isSaving={locationForm.isSaving}
        isLoading={locationForm.isLoadingRecord}
        loadError={locationForm.loadError}
        onRetry={locationForm.retryLoad}
      >
        <TextField
          control={control}
          name="name"
          label="Name"
          required
          autoComplete="off"
          maxLength={NAME_MAX_LENGTH}
        />
        <TextField
          control={control}
          name="employeePrefix"
          label="Employee Prefix"
          placeholder="Employee Prefix"
          autoComplete="off"
          maxLength={PREFIX_MAX_LENGTH}
          inputClassName="uppercase placeholder:normal-case"
        />
        <SelectField
          control={control}
          name="companyId"
          label="Company"
          required
          placeholder="Select Company"
          options={companies.options}
        />
        <TextareaField
          control={control}
          name="description"
          label="Description"
          maxLength={DESCRIPTION_MAX_LENGTH}
          showCount
        />
        <GeoLocationFields mapLabel="Location on the map" disabled={locationForm.isSaving} />
      </SettingsFormCard>
      <UnsavedChangesDialog guard={locationForm.guard} />
    </FormProvider>
  )
}
