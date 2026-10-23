import { FormProvider, useWatch } from 'react-hook-form'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'

import { UnsavedChangesDialog } from '@/components/feedback/unsaved-changes-dialog'
import { SelectField, TextareaField, TextField } from '@/components/form'
import type { DataTableColumn } from '@/components/layout'

import { branchResource } from '../../api/org-resource'
import {
  useAreaOptions,
  useCityOptions,
  useCompanyOptions,
  useCountryOptions,
  useLocationOptions,
  useManagerOptions,
  useRegionOptions,
} from '../../hooks/use-lookups'
import { useOrgRecordForm } from '../../hooks/use-org-record-form'
import { branchFormSchema } from '../../schemas/org-forms.schema'
import { DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH, PREFIX_MAX_LENGTH } from '../../schemas/shared'
import type { BranchRow } from '../../types/settings.types'
import { branchMapper } from '../../utils/form-mappers'
import { FilterSelect } from '../shared/filter-select'
import { GeoLocationFields } from '../shared/geo-location-fields'
import { OrgListPage } from '../shared/org-list-page'
import { SettingsFormCard } from '../shared/settings-form-card'

const listRoute = getRouteApi('/_app/settings/control-panel/branches/')
const LIST_PATH = '/settings/control-panel/branches'

const dash = (value: string | null) => (value === null || value === '' ? '—' : value)

/** Settings → Control Panel → Organization → Branch (list). */
export function BranchListPage() {
  const search = listRoute.useSearch()
  const navigate = listRoute.useNavigate()
  const companies = useCompanyOptions()

  const columns: DataTableColumn<BranchRow>[] = [
    {
      id: 'name',
      header: 'Name',
      mobile: 'heading',
      cell: (row) => (
        <Link
          to="/settings/control-panel/branches/$branchId"
          params={{ branchId: row.id }}
          className="text-foreground underline-offset-4 hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      id: 'company',
      header: 'Company',
      cell: (row) => row.companyName,
      className: 'hidden @5xl:table-cell',
    },
    { id: 'location', header: 'Location', cell: (row) => row.locationName },
    {
      id: 'area',
      header: 'Area',
      cell: (row) => dash(row.areaName),
      className: 'hidden @3xl:table-cell',
    },
    {
      id: 'manager',
      header: 'Manager',
      cell: (row) => dash(row.managerName),
      className: 'hidden @4xl:table-cell',
    },
    { id: 'prefix', header: 'Prefix', cell: (row) => dash(row.employeePrefix) },
  ]

  return (
    <OrgListPage
      resource={branchResource}
      title="Branches"
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
      addLink={{ to: '/settings/control-panel/branches/new' }}
      onEdit={(row) => {
        void navigate({
          to: '/settings/control-panel/branches/$branchId',
          params: { branchId: row.id },
        })
      }}
    />
  )
}

/** "Branch Create" / "Branch Edit". */
export function BranchFormPage({ branchId }: { branchId?: string }) {
  const navigate = useNavigate()
  const goToList = () => navigate({ to: LIST_PATH })
  const branchForm = useOrgRecordForm({
    resource: branchResource,
    id: branchId,
    schema: branchFormSchema,
    mapper: branchMapper,
    onSaved: goToList,
  })
  const { form } = branchForm
  const { control, setValue, getValues } = form
  const [companyId, locationId, countryCode, regionCode] = useWatch({
    control,
    name: ['companyId', 'locationId', 'countryCode', 'regionCode'],
  })

  const companies = useCompanyOptions()
  const locations = useLocationOptions(companyId)
  const areas = useAreaOptions(locationId)
  const managers = useManagerOptions()
  const countries = useCountryOptions()
  const regions = useRegionOptions(countryCode)
  const cities = useCityOptions(regionCode)

  const reset = (...fields: ('locationId' | 'areaId' | 'regionCode' | 'cityId')[]) => {
    fields.forEach((field) => {
      setValue(field, '', { shouldDirty: true })
    })
  }

  return (
    <FormProvider {...form}>
      <SettingsFormCard
        title={branchId ? 'Branch Edit' : 'Branch Create'}
        back={{ label: 'Back to branches', link: { to: LIST_PATH } }}
        onSubmit={branchForm.submit}
        onCancel={() => {
          void goToList()
        }}
        isSaving={branchForm.isSaving}
        isLoading={branchForm.isLoadingRecord}
        loadError={branchForm.loadError}
        onRetry={branchForm.retryLoad}
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
          description="Starts the employee numbers issued here, e.g. TE-LHR-0001."
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
          onValueChange={() => {
            reset('locationId', 'areaId')
          }}
        />
        <SelectField
          control={control}
          name="locationId"
          label="Location"
          required
          placeholder={companyId ? 'Select Location' : 'Select a company first'}
          options={locations.options}
          disabled={!companyId}
          onValueChange={(id) => {
            reset('areaId')
            // A new branch starts at its location's pin until it is placed exactly.
            const location = locations.locations.find((item) => item.id === id)
            const pinLatitude = location?.latitude ?? null
            const pinLongitude = location?.longitude ?? null
            const { latitude, longitude } = getValues()
            if (pinLatitude === null || pinLongitude === null || latitude || longitude) return
            setValue('latitude', String(pinLatitude), { shouldDirty: true })
            setValue('longitude', String(pinLongitude), { shouldDirty: true })
          }}
        />
        <SelectField
          control={control}
          name="areaId"
          label="Area"
          placeholder={locationId ? 'Select Area' : 'Select a location first'}
          options={areas.options}
          disabled={!locationId}
          clearable="No area"
        />
        <SelectField
          control={control}
          name="managerId"
          label="Manager"
          placeholder="Select Manager"
          options={managers.options}
          clearable="No manager"
        />
        <TextareaField
          control={control}
          name="description"
          label="Description"
          maxLength={DESCRIPTION_MAX_LENGTH}
          showCount
        />
        <SelectField
          control={control}
          name="countryCode"
          label="Country"
          placeholder="Select Country"
          options={countries.options}
          clearable
          onValueChange={() => {
            reset('regionCode', 'cityId')
          }}
        />
        <SelectField
          control={control}
          name="regionCode"
          label="State"
          placeholder={countryCode ? 'Select State' : 'Select a country first'}
          options={regions.options}
          disabled={!countryCode}
          clearable
          onValueChange={() => {
            reset('cityId')
          }}
        />
        <SelectField
          control={control}
          name="cityId"
          label="City"
          placeholder={regionCode ? 'Select City' : 'Select a state first'}
          options={cities.options}
          disabled={!regionCode}
          clearable
        />
        <GeoLocationFields mapLabel="Branch location on the map" disabled={branchForm.isSaving} />
      </SettingsFormCard>
      <UnsavedChangesDialog guard={branchForm.guard} />
    </FormProvider>
  )
}
