import { type Control, FormProvider, useController, useWatch } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'

import { UnsavedChangesDialog } from '@/components/feedback/unsaved-changes-dialog'
import { FormField, SelectField, TextareaField, TextField } from '@/components/form'
import type { DataTableColumn } from '@/components/layout'
import { EmployeeSearchSelect } from '@/features/payroll'

import { branchResource, locationResource } from '../../api/org-resource'
import {
  useAreaOptions,
  useCityOptions,
  useCountryOptions,
  useLocationOptions,
  useStateOptions,
} from '../../hooks/use-lookups'
import { useOrgPermissions } from '../../hooks/use-org-permissions'
import { useOrgRecordForm } from '../../hooks/use-org-record-form'
import { branchFormSchema, type BranchFormValues } from '../../schemas/org-forms.schema'
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

/** Settings → Control Panel → Organization → Branch (list), of the active company. */
export function BranchListPage() {
  const search = listRoute.useSearch()
  const navigate = listRoute.useNavigate()
  const locations = useLocationOptions()
  const { canEdit } = useOrgPermissions(branchResource)

  const columns: DataTableColumn<BranchRow>[] = [
    {
      id: 'name',
      header: 'Name',
      mobile: 'heading',
      cell: (row) =>
        canEdit ? (
          <Link
            to="/settings/control-panel/branches/$branchId"
            params={{ branchId: row.id }}
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
    {
      id: 'employees',
      header: 'Employees',
      cell: (row) => <span className="tabular-nums">{row.employeeCount}</span>,
      className: 'hidden @5xl:table-cell',
    },
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
      addLink={{ to: '/settings/control-panel/branches/new' }}
      onEdit={(row) => {
        void navigate({
          to: '/settings/control-panel/branches/$branchId',
          params: { branchId: row.id },
        })
      }}
      deleteHint="A branch that still has employees cannot be deleted."
    />
  )
}

/** "Branch Create" / "Branch Edit". The branch belongs to the active company. */
export function BranchFormPage({ branchId }: { branchId?: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const goToList = () => navigate({ to: LIST_PATH })
  const branchForm = useOrgRecordForm({
    resource: branchResource,
    id: branchId,
    schema: branchFormSchema,
    mapper: branchMapper,
    onSaved: goToList,
  })
  const { form, record } = branchForm
  const { control, setValue, getValues } = form
  const [locationId, countryId, stateId] = useWatch({
    control,
    name: ['locationId', 'countryId', 'stateId'],
  })

  const locations = useLocationOptions()
  const areas = useAreaOptions(locationId)
  const countries = useCountryOptions()
  const states = useStateOptions(countryId)
  const cities = useCityOptions(stateId)

  const reset = (...fields: ('areaId' | 'stateId' | 'cityId')[]) => {
    fields.forEach((field) => {
      setValue(field, '', { shouldDirty: true })
    })
  }

  /** A new branch starts at its location's pin until it is placed exactly. */
  const copyLocationPin = async (id: string) => {
    const location = await queryClient
      .query(locationResource.detailQuery(id))
      .catch(() => undefined)
    const pinLatitude = location?.latitude ?? null
    const pinLongitude = location?.longitude ?? null
    const { latitude, longitude } = getValues()
    if (pinLatitude === null || pinLongitude === null || latitude || longitude) return
    setValue('latitude', String(pinLatitude), { shouldDirty: true })
    setValue('longitude', String(pinLongitude), { shouldDirty: true })
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
        readOnly={branchForm.readOnly}
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
          name="locationId"
          label="Location"
          required
          placeholder="Select Location"
          options={locations.options}
          onValueChange={(id) => {
            reset('areaId')
            void copyLocationPin(id)
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
        <ManagerField
          control={control}
          // People the user may name as manager, through the code this form needs.
          permission={branchId ? 'organisation.branches.edit' : 'organisation.branches.create'}
          current={
            record?.managerId && record.managerName
              ? { value: record.managerId, label: record.managerName }
              : null
          }
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
          name="countryId"
          label="Country"
          placeholder="Select Country"
          options={countries.options}
          clearable
          onValueChange={() => {
            reset('stateId', 'cityId')
          }}
        />
        <SelectField
          control={control}
          name="stateId"
          label="State"
          placeholder={countryId ? 'Select State' : 'Select a country first'}
          options={states.options}
          disabled={!countryId}
          clearable
          onValueChange={() => {
            reset('cityId')
          }}
        />
        <SelectField
          control={control}
          name="cityId"
          label="City"
          placeholder={stateId ? 'Select City' : 'Select a state first'}
          options={cities.options}
          disabled={!stateId}
          clearable
        />
        <GeoLocationFields mapLabel="Branch location on the map" disabled={branchForm.isSaving} />
      </SettingsFormCard>
      <UnsavedChangesDialog guard={branchForm.guard} />
    </FormProvider>
  )
}

/**
 * "Manager": anyone `GET /employees/lookup` gives through the form's permission, searched on
 * the server as you type and paged ("Load more"); "" means no manager.
 */
function ManagerField({
  control,
  permission,
  current,
}: {
  control: Control<BranchFormValues>
  permission: string
  current: { value: string; label: string } | null
}) {
  const { field, fieldState } = useController({ control, name: 'managerId' })
  return (
    <FormField label="Manager" error={fieldState.error?.message}>
      {(a11y) => (
        <EmployeeSearchSelect
          {...a11y}
          value={field.value || null}
          onChange={(id) => {
            field.onChange(id ?? '')
          }}
          filters={{ permission }}
          known={current ? [current] : undefined}
          hint={(row) => row.jobTitleName ?? row.designationName ?? row.code}
          placeholder="Select Manager"
          clearable
        />
      )}
    </FormField>
  )
}
