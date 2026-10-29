import { useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'

import { UnsavedChangesDialog } from '@/components/feedback/unsaved-changes-dialog'
import { SelectField, type SelectOption, TextareaField, TextField } from '@/components/form'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import { ApiError } from '@/lib/api-error'
import { formatDateTime } from '@/lib/date'
import { useCan } from '@/lib/permissions'

import {
  generalSettingsApi,
  generalSettingsKeys,
  generalSettingsQueryOptions,
} from '../../api/lookups.api'
import { MONTH_NAMES } from '../../constants'
import { useCountryOptions } from '../../hooks/use-lookups'
import {
  generalSettingsFormSchema,
  type GeneralSettingsFormValues,
} from '../../schemas/general-settings.schema'
import { toOptionalId, toOptionalText } from '../../schemas/shared'
import {
  DATE_FORMATS,
  type DateFormat,
  type GeneralSettings,
  type GeneralSettingsInput,
  WEEK_START_DAYS,
  type WeekStartDay,
} from '../../types/settings.types'
import { capitalize } from '../../utils/text'
import { SettingsFormCard } from '../shared/settings-form-card'
import { CompanyLogoCard } from './company-logo-card'

const TIMEZONE_OPTIONS: SelectOption[] = [
  { value: 'Asia/Karachi', label: '(UTC+05:00) Pakistan, Karachi' },
  { value: 'Asia/Dubai', label: '(UTC+04:00) Dubai, Abu Dhabi' },
  { value: 'Asia/Riyadh', label: '(UTC+03:00) Riyadh' },
  { value: 'Europe/London', label: '(UTC+00:00) London' },
  { value: 'America/New_York', label: '(UTC−05:00) New York' },
  { value: 'America/Los_Angeles', label: '(UTC−08:00) Los Angeles' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
]

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'PKR', label: 'PKR · Pakistani Rupee' },
  { value: 'AED', label: 'AED · UAE Dirham' },
  { value: 'SAR', label: 'SAR · Saudi Riyal' },
  { value: 'USD', label: 'USD · US Dollar' },
  { value: 'GBP', label: 'GBP · Pound Sterling' },
  { value: 'EUR', label: 'EUR · Euro' },
]

/** A fixed sample date shows what each format looks like. */
const SAMPLE_DATE = new Date(2026, 9, 20)
const DATE_FORMAT_OPTIONS: SelectOption[] = DATE_FORMATS.map((pattern) => ({
  value: pattern,
  label: `${format(SAMPLE_DATE, pattern)}  (${pattern})`,
}))

const WEEK_START_OPTIONS: SelectOption[] = WEEK_START_DAYS.map((day) => ({
  value: day,
  label: capitalize(day),
}))

const MONTH_OPTIONS: SelectOption[] = MONTH_NAMES.map((month, index) => ({
  value: String(index + 1),
  label: month,
}))

const EMPTY_VALUES: GeneralSettingsFormValues = {
  organizationName: '',
  legalName: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  countryId: '',
  timezone: '',
  currency: '',
  dateFormat: 'dd/MM/yyyy',
  weekStartsOn: 'monday',
  fiscalYearStartMonth: '1',
}

const isDateFormat = (value: string | null): value is DateFormat =>
  DATE_FORMATS.some((pattern) => pattern === value)
const isWeekStart = (value: string | null): value is WeekStartDay =>
  WEEK_START_DAYS.some((day) => day === value)

/** The company record → form strings (empty for anything not set yet). */
function toFormValues(settings: GeneralSettings): GeneralSettingsFormValues {
  return {
    organizationName: settings.organizationName,
    legalName: settings.legalName ?? '',
    email: settings.email ?? '',
    phone: settings.phone ?? '',
    website: settings.website ?? '',
    address: settings.address ?? '',
    countryId: settings.countryId ?? '',
    timezone: settings.timezone ?? '',
    currency: settings.currency ?? '',
    dateFormat: isDateFormat(settings.dateFormat) ? settings.dateFormat : EMPTY_VALUES.dateFormat,
    weekStartsOn: isWeekStart(settings.weekStartsOn)
      ? settings.weekStartsOn
      : EMPTY_VALUES.weekStartsOn,
    fiscalYearStartMonth: String(settings.fiscalYearStartMonth ?? 1),
  }
}

function toInput(values: GeneralSettingsFormValues, rowVersion: string): GeneralSettingsInput {
  return {
    organizationName: values.organizationName.trim(),
    legalName: toOptionalText(values.legalName),
    email: toOptionalText(values.email),
    phone: toOptionalText(values.phone),
    website: toOptionalText(values.website),
    address: toOptionalText(values.address),
    countryId: toOptionalId(values.countryId),
    timezone: values.timezone,
    currency: values.currency,
    dateFormat: values.dateFormat,
    weekStartsOn: values.weekStartsOn,
    fiscalYearStartMonth: Number(values.fiscalYearStartMonth),
    rowVersion,
  }
}

/** The API sends UTC times without a zone (`2026-10-26T05:14:37`); mark them as UTC. */
const asUtc = (iso: string) => (/(?:[zZ]|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`)

const SERVER_FIELDS = new Set<string>(Object.keys(EMPTY_VALUES))
const isFormField = (field: string): field is keyof GeneralSettingsFormValues =>
  SERVER_FIELDS.has(field)

/**
 * Settings → Control Panel → General Settings: the active company's profile and regional
 * defaults (`GET/PUT /organisation/general`). Not in the designs; built with the same form card.
 */
export function GeneralSettingsPage() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery(generalSettingsQueryOptions())
  const canEdit = useCan('organisation.general.edit')
  const countries = useCountryOptions()
  const values = useMemo(
    () => (settingsQuery.data ? toFormValues(settingsQuery.data) : undefined),
    [settingsQuery.data],
  )

  const form = useForm<GeneralSettingsFormValues>({
    resolver: zodResolver(generalSettingsFormSchema),
    defaultValues: EMPTY_VALUES,
    values,
    resetOptions: { keepDirtyValues: true },
    mode: 'onTouched',
  })
  const { control } = form
  const guard = useUnsavedChangesGuard(form.formState.isDirty)
  const dateFormat = useWatch({ control, name: 'dateFormat' })

  const saveMutation = useMutation({
    mutationFn: (input: GeneralSettingsInput) => generalSettingsApi.update(input),
    meta: { successMessage: 'General settings saved' },
    onSuccess: (saved) => {
      queryClient.setQueryData(generalSettingsKeys.all, saved)
    },
  })

  const submit = form.handleSubmit(async (formValues) => {
    try {
      // A stale rowVersion (someone saved first) is refused with 409, shown as a toast.
      const saved = await saveMutation.mutateAsync(
        toInput(formValues, settingsQuery.data?.rowVersion ?? ''),
      )
      form.reset(toFormValues(saved))
    } catch (error) {
      if (error instanceof ApiError) {
        Object.entries(error.fieldErrors).forEach(([field, message]) => {
          if (isFormField(field)) form.setError(field, { type: 'server', message })
        })
      }
    }
  })

  return (
    <>
      <CompanyLogoCard settings={settingsQuery.data} canEdit={canEdit} />
      <SettingsFormCard
        title="General Settings"
        description={
          settingsQuery.data?.updatedAt
            ? `Last saved ${formatDateTime(asUtc(settingsQuery.data.updatedAt))}`
            : 'Company profile and regional defaults used across the portal.'
        }
        onSubmit={submit}
        onCancel={() => {
          // Not the form's keepDirtyValues (meant for refetches): Cancel drops every edit.
          form.reset(values ?? EMPTY_VALUES, { keepDirtyValues: false })
        }}
        isSaving={saveMutation.isPending}
        isLoading={settingsQuery.isPending}
        loadError={settingsQuery.data ? null : settingsQuery.error}
        onRetry={() => {
          void settingsQuery.refetch()
        }}
        readOnly={!canEdit}
      >
        <TextField control={control} name="organizationName" label="Organization Name" required />
        <TextField control={control} name="legalName" label="Legal Name" />
        <TextField
          control={control}
          name="email"
          label="HR Email"
          type="email"
          autoComplete="email"
          placeholder="hr@company.com"
        />
        <TextField
          control={control}
          name="phone"
          label="Phone"
          type="tel"
          autoComplete="tel"
          placeholder="+92 42 0000 0000"
        />
        <TextField
          control={control}
          name="website"
          label="Website"
          type="url"
          autoComplete="url"
          placeholder="https://"
        />
        <TextareaField control={control} name="address" label="Address" maxLength={500} />
        <SelectField
          control={control}
          name="countryId"
          label="Country"
          placeholder="Select Country"
          options={countries.options}
          clearable
        />
        <SelectField
          control={control}
          name="timezone"
          label="Time Zone"
          required
          placeholder="Select Time Zone"
          options={TIMEZONE_OPTIONS}
        />
        <SelectField
          control={control}
          name="currency"
          label="Currency"
          required
          placeholder="Select Currency"
          options={CURRENCY_OPTIONS}
        />
        <SelectField
          control={control}
          name="dateFormat"
          label="Date Format"
          options={DATE_FORMAT_OPTIONS}
          description={`Dates will look like ${format(new Date(), dateFormat)}.`}
        />
        <SelectField
          control={control}
          name="weekStartsOn"
          label="Week Starts On"
          options={WEEK_START_OPTIONS}
        />
        <SelectField
          control={control}
          name="fiscalYearStartMonth"
          label="Fiscal Year Starts"
          options={MONTH_OPTIONS}
          description="Used for leave balances and payroll year-end."
        />
      </SettingsFormCard>
      <UnsavedChangesDialog guard={guard} />
    </>
  )
}
