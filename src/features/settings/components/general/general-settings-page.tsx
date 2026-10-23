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

import {
  generalSettingsApi,
  generalSettingsKeys,
  generalSettingsQueryOptions,
} from '../../api/lookups.api'
import { MONTH_NAMES } from '../../constants'
import {
  generalSettingsFormSchema,
  type GeneralSettingsFormValues,
} from '../../schemas/general-settings.schema'
import {
  DATE_FORMATS,
  type GeneralSettings,
  type GeneralSettingsInput,
  WEEK_START_DAYS,
} from '../../types/settings.types'
import { capitalize } from '../../utils/text'
import { SettingsFormCard } from '../shared/settings-form-card'

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
  timezone: '',
  currency: '',
  dateFormat: 'dd/MM/yyyy',
  weekStartsOn: 'monday',
  fiscalYearStartMonth: '1',
}

function toFormValues({
  updatedAt: _updatedAt,
  ...settings
}: GeneralSettings): GeneralSettingsFormValues {
  return { ...settings, fiscalYearStartMonth: String(settings.fiscalYearStartMonth) }
}

function toInput(values: GeneralSettingsFormValues): GeneralSettingsInput {
  return {
    ...values,
    organizationName: values.organizationName.trim(),
    legalName: values.legalName.trim(),
    phone: values.phone.trim(),
    website: values.website.trim(),
    address: values.address.trim(),
    fiscalYearStartMonth: Number(values.fiscalYearStartMonth),
  }
}

const SERVER_FIELDS = new Set<string>(Object.keys(EMPTY_VALUES))
const isFormField = (field: string): field is keyof GeneralSettingsFormValues =>
  SERVER_FIELDS.has(field)

/**
 * Settings → Control Panel → General Settings: company profile and regional
 * defaults. Not in the designs; built with the same form card.
 */
export function GeneralSettingsPage() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery(generalSettingsQueryOptions())
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
      const saved = await saveMutation.mutateAsync(toInput(formValues))
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
      <SettingsFormCard
        title="General Settings"
        description={
          settingsQuery.data
            ? `Last saved ${formatDateTime(settingsQuery.data.updatedAt)}`
            : 'Company profile and regional defaults used across the portal.'
        }
        onSubmit={submit}
        onCancel={() => {
          form.reset(values ?? EMPTY_VALUES)
        }}
        isSaving={saveMutation.isPending}
        isLoading={settingsQuery.isPending}
        loadError={settingsQuery.data ? null : settingsQuery.error}
        onRetry={() => {
          void settingsQuery.refetch()
        }}
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
        <TextareaField control={control} name="address" label="Address" maxLength={300} />
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
