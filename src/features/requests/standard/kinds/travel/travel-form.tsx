import { useId, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { z } from 'zod'

import { CheckboxField, TextareaField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { btn, footerButton, NoRecord, SearchSelect, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { ApplicationEditor } from '../../../components/transfer/application-editor'
import { TransferDialogShell } from '../../../components/transfer/transfer-dialog-shell'
import { sanitizeApplication } from '../../../utils/transfer-letter'
import type { StandardFormProps } from '../../standard.types'
import { standardReadOnlyClass } from '../../standard-styles'
import { useCreateStandard, useStandardLookups, useUpdateStandard } from '../../use-standard'
import type { TravelDetailValue, TravelInput, TravelLookups, TravelPayload } from './travel.types'
import { TravelDetailDialog } from './travel-detail-dialog'
import { travelLetter } from './travel-letter'
import { TravelDetailsTable, TravelSection } from './travel-parts'

const PHONE = /^[\d+\-\s()]{7,20}$/
const AMOUNT = /^\d+(\.\d{1,2})?$/

const schema = z
  .object({
    employeeId: z.string().nullable(),
    purpose: z.string().trim().min(1, 'Give the purpose of the travel').max(500),
    extensionNo: z
      .string()
      .trim()
      .regex(/^\d{0,6}$/, 'Up to 6 digits'),
    alternativePhone: z
      .string()
      .trim()
      .refine((value) => value === '' || PHONE.test(value), { message: 'Give a phone number' }),
    description: z.string().trim().max(1000, 'Keep it under 1000 characters'),
    advanceRequired: z.boolean(),
    advances: z.array(
      z.object({
        id: z.string(),
        amount: z
          .string()
          .trim()
          .refine(
            (value) => {
              const plain = value.replace(/,/g, '')
              return AMOUNT.test(plain) && Number(plain) > 0 && Number(plain) <= 10_000_000
            },
            { message: 'Give the amount' },
          ),
        currency: z
          .string()
          .nullable()
          .refine((value) => Boolean(value), { message: 'Choose the currency' }),
      }),
    ),
    details: z.array(z.custom<TravelDetailValue>()),
    application: z.string(),
  })
  .superRefine((values, context) => {
    if (values.advanceRequired && values.advances.length === 0) {
      context.addIssue({ code: 'custom', path: ['advances'], message: 'Add the advance you need' })
    }
    if (values.details.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['details'],
        message: 'Add at least one travel detail',
      })
    }
  })
type Values = z.infer<typeof schema>

const FIELDS = [
  'employeeId',
  'purpose',
  'extensionNo',
  'alternativePhone',
  'description',
  'advances',
  'details',
] as const

let advanceCount = 0
const newAdvanceId = () => {
  advanceCount += 1
  return `adv_${Date.now().toString(36)}${String(advanceCount)}`
}

function toValues(request: StandardFormProps<TravelPayload>['request']): Values {
  const payload = request?.payload
  return {
    employeeId: request?.employee.id ?? null,
    purpose: payload?.purpose ?? '',
    extensionNo: payload?.extensionNo ?? '',
    alternativePhone: payload?.alternativePhone ?? '',
    description: payload?.description ?? '',
    advanceRequired: payload?.advanceRequired ?? false,
    advances: (payload?.advances ?? []).map((item) => ({
      id: item.id,
      amount: String(item.amount),
      currency: item.currency,
    })),
    details: (payload?.details ?? []).map((detail) => ({
      id: detail.id,
      travelType: detail.travelType,
      departureFrom: detail.departureFrom,
      arrivalAt: detail.arrivalAt,
      travelMode: detail.travelMode,
      distanceKm: detail.distanceKm,
      fromDate: detail.fromDate,
      fromTime: detail.fromTime,
      toDate: detail.toDate,
      toTime: detail.toTime,
      stayRequired: detail.stayRequired,
      hotels: detail.hotels.map((hotel) => ({
        id: hotel.id,
        stayType: hotel.stayType,
        address: hotel.address,
        from: hotel.from,
        to: hotel.to,
        nights: hotel.nights,
        city: hotel.city,
        phone: hotel.phone,
        email: hotel.email,
      })),
      tickets: detail.tickets,
    })),
    application: payload?.application ?? '',
  }
}

const TITLES = {
  create: 'Travel Request Create',
  edit: 'Travel Request Edit',
  view: 'Travel Request View',
} as const

/** Where a leg opens: a new one, or the row's Edit / View. */
type LegDialog = { mode: 'create' } | { mode: 'edit' | 'view'; index: number } | null

/**
 * "Travel Request Create" / Edit / View (frames 4163:56010, 4173:56334,
 * 4173:60818, 4173:61358; with Employee on All, 4179:67488, 4179:69876):
 * Purpose, Extension No, Alternative Phone No, Description, Advance Required,
 * the Advances (Amount, Currency), the travel Details (each opens "Travel
 * Detail Create"), and the Application beside the form with Regenerate.
 */
export function TravelForm({ mode, scope, request, onClose }: StandardFormProps<TravelPayload>) {
  const formId = useId()
  const lookups = useStandardLookups<TravelLookups>('travel')
  const create = useCreateStandard('travel')
  const update = useUpdateStandard('travel')
  const readOnly = mode === 'view'
  const pickPerson = scope === 'all' && mode === 'create'
  const [leg, setLeg] = useState<LegDialog>(null)
  const [letterError, setLetterError] = useState<string | null>(null)

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(request) })
  const { control, formState } = form
  const advances = useFieldArray({ control, name: 'advances' })
  const details = useFieldArray({ control, name: 'details', keyName: 'key' })
  const [application, detailValues, advanceRequired] = useWatch({
    control,
    name: ['application', 'details', 'advanceRequired'],
  })
  const extra = lookups.data?.extra
  const people = lookups.data?.employees ?? []
  const currencies = extra?.currencies ?? []

  const addAdvance = () => {
    form.setValue('advanceRequired', true)
    advances.append({ id: newAdvanceId(), amount: '', currency: 'PKR' })
  }

  const regenerate = () => {
    const values = form.getValues()
    if (!values.purpose.trim() || values.details.length === 0) {
      setLetterError('Give the purpose and add a travel detail first.')
      return
    }
    setLetterError(null)
    const person =
      request?.employee.name ??
      (pickPerson
        ? people.find((item) => item.id === values.employeeId)?.name
        : lookups.data?.me.name) ??
      ''
    const modeLabel = (value: string) =>
      extra?.travelModes.find((item) => item.value === value)?.label ?? value
    form.setValue(
      'application',
      travelLetter({
        employee: person,
        purpose: values.purpose,
        description: values.description,
        extensionNo: values.extensionNo,
        alternativePhone: values.alternativePhone,
        advances: values.advanceRequired
          ? values.advances
              .filter((item) => item.currency && AMOUNT.test(item.amount.replace(/,/g, '')))
              .map((item) => ({
                amount: Number(item.amount.replace(/,/g, '')),
                currency: item.currency ?? 'PKR',
              }))
          : [],
        details: values.details.map((detail) => ({
          ...detail,
          travelModeLabel: modeLabel(detail.travelMode),
        })),
      }),
      { shouldDirty: true },
    )
  }

  const submit = form.handleSubmit(async (values) => {
    if (pickPerson && !values.employeeId) {
      form.setError('employeeId', { message: 'Choose the employee' })
      return
    }
    const input: TravelInput = {
      ...(pickPerson && values.employeeId ? { employeeId: values.employeeId } : {}),
      purpose: values.purpose,
      extensionNo: values.extensionNo,
      alternativePhone: values.alternativePhone,
      description: values.description,
      advanceRequired: values.advanceRequired,
      advances: values.advanceRequired
        ? values.advances.map((item) => ({
            id: item.id,
            amount: Number(item.amount.replace(/,/g, '')),
            currency: item.currency ?? '',
          }))
        : [],
      details: values.details,
      application: sanitizeApplication(values.application),
    }
    try {
      if (mode === 'edit' && request) await update.mutateAsync({ id: request.id, input })
      else await create.mutateAsync(input)
    } catch (failure) {
      if (failure instanceof ApiError) {
        const field = FIELDS.find((name) => failure.fieldErrors[name])
        if (field) form.setError(field, { message: failure.fieldErrors[field] })
        else form.setError('root', { message: failure.message })
      } else {
        form.setError('root', { message: 'Could not save the travel request.' })
      }
      return
    }
    onClose()
  })

  const errors = formState.errors
  const arrayError = (error: { message?: string; root?: { message?: string } } | undefined) =>
    error?.root?.message ?? error?.message
  const pending = create.isPending || update.isPending
  const openLeg = leg && (leg.mode === 'create' ? undefined : detailValues[leg.index])

  return (
    <TransferDialogShell
      title={TITLES[mode]}
      onClose={onClose}
      aside={
        <ApplicationEditor
          value={application}
          readOnly={readOnly}
          message={letterError}
          onChange={(html) => {
            form.setValue('application', html, { shouldDirty: true })
          }}
          onRegenerate={regenerate}
        />
      }
      footer={
        <>
          {errors.root?.message && (
            <p role="alert" className="mr-auto self-center text-sm text-destructive">
              {errors.root.message}
            </p>
          )}
          {!readOnly && (
            <Button
              type="submit"
              form={formId}
              disabled={pending}
              className={cn(footerButton, btn.green)}
            >
              Save
            </Button>
          )}
          <Button type="button" onClick={onClose} className={cn(footerButton, btn.red)}>
            Cancel
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className={cn('grid gap-6', readOnly && standardReadOnlyClass)}
      >
        {scope === 'all' && (
          <SearchSelectField
            control={control}
            name="employeeId"
            label="Employee"
            placeholder="Select Employee"
            disabled={!pickPerson}
            options={people
              .filter((person) => person.active || person.id === request?.employee.id)
              .map((person) => ({ value: person.id, label: person.name, hint: person.code }))}
          />
        )}
        <TextareaField
          control={control}
          name="purpose"
          label="Purpose"
          required
          rows={3}
          maxLength={500}
          disabled={readOnly}
        />
        <TextField
          control={control}
          name="extensionNo"
          label="Extension No"
          inputMode="numeric"
          maxLength={6}
          disabled={readOnly}
        />
        <TextField
          control={control}
          name="alternativePhone"
          label="Alternative Phone No"
          type="tel"
          maxLength={20}
          disabled={readOnly}
        />
        <TextareaField
          control={control}
          name="description"
          label="Description"
          rows={5}
          maxLength={1000}
          disabled={readOnly}
        />
        <CheckboxField
          control={control}
          name="advanceRequired"
          label="Advance Required"
          tone="navy"
          disabled={readOnly}
          onCheckedChange={(checked) => {
            if (checked && advances.fields.length === 0) addAdvance()
            if (!checked) advances.remove()
          }}
        />

        {/* View draws no Advances; they show there when the person asked for one. */}
        {(!readOnly || advances.fields.length > 0) && (
          <TravelSection
            title="Advances"
            required={advanceRequired}
            {...(readOnly ? {} : { addLabel: 'Add advance', onAdd: addAdvance })}
            error={arrayError(errors.advances)}
          >
            {advances.fields.length === 0 ? (
              <NoRecord />
            ) : (
              <div className="grid gap-3">
                <div
                  aria-hidden="true"
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3rem] gap-x-4 font-inter text-base text-heading"
                >
                  <span>Amount</span>
                  <span>Currency</span>
                  <span className="text-center">Action</span>
                </div>
                {advances.fields.map((row, index) => {
                  const rowErrors = errors.advances?.[index]
                  const n = String(index + 1)
                  return (
                    <div
                      key={row.id}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3rem] items-start gap-x-4"
                    >
                      <div className="min-w-0">
                        <Input
                          aria-label={`Advance ${n} Amount`}
                          aria-invalid={Boolean(rowErrors?.amount)}
                          inputMode="decimal"
                          disabled={readOnly}
                          {...form.register(`advances.${index}.amount`)}
                        />
                        {rowErrors?.amount?.message && (
                          <span className="mt-1 block text-xs text-destructive">
                            {rowErrors.amount.message}
                          </span>
                        )}
                      </div>
                      <Controller
                        control={control}
                        name={`advances.${index}.currency`}
                        render={({ field, fieldState }) => (
                          <div className="min-w-0">
                            <SearchSelect
                              aria-label={`Advance ${n} Currency`}
                              aria-invalid={Boolean(fieldState.error)}
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Select Currency"
                              disabled={readOnly}
                              options={currencies}
                            />
                            {fieldState.error?.message && (
                              <span className="mt-1 block text-xs text-destructive">
                                {fieldState.error.message}
                              </span>
                            )}
                          </div>
                        )}
                      />
                      <div className="flex h-10 items-center justify-center">
                        {!readOnly && (
                          <button
                            type="button"
                            aria-label={`Remove advance ${n}`}
                            onClick={() => {
                              advances.remove(index)
                            }}
                            className="flex size-6 items-center justify-center rounded-full bg-[#E50141] text-white outline-none hover:bg-[#E50141]/85 focus-visible:ring-2 focus-visible:ring-ring/60"
                          >
                            <X aria-hidden="true" className="size-3.5" strokeWidth={3} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TravelSection>
        )}

        <TravelSection
          title="Details"
          required
          {...(readOnly
            ? {}
            : {
                addLabel: 'Add travel detail',
                onAdd: () => {
                  setLeg({ mode: 'create' })
                },
              })}
          error={arrayError(errors.details)}
        >
          <TravelDetailsTable
            details={detailValues}
            onView={(index) => {
              setLeg({ mode: 'view', index })
            }}
            onEdit={
              readOnly
                ? undefined
                : (index) => {
                    setLeg({ mode: 'edit', index })
                  }
            }
            onRemove={
              readOnly
                ? undefined
                : (index) => {
                    details.remove(index)
                  }
            }
          />
        </TravelSection>
      </form>
      {leg && (
        <TravelDetailDialog
          mode={leg.mode}
          value={openLeg ?? undefined}
          lookups={extra}
          onSave={(value) => {
            if (leg.mode === 'edit') details.update(leg.index, value)
            else details.append(value)
            form.clearErrors('details')
          }}
          onClose={() => {
            setLeg(null)
          }}
        />
      )}
    </TransferDialogShell>
  )
}
