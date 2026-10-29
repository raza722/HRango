import { type ReactNode, useId, useRef, useState } from 'react'
import {
  type Control,
  Controller,
  type FieldError,
  useFieldArray,
  useForm,
  type UseFormRegister,
  useWatch,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { differenceInCalendarDays, parse } from 'date-fns'
import { Loader2, Paperclip, X } from 'lucide-react'
import { z } from 'zod'

import { CheckboxField, TextField, TimePickerField } from '@/components/form'
import { Input } from '@/components/ui/input'
import {
  DateField,
  DateInput,
  NoRecord,
  PayrollDialog,
  SearchSelect,
  SearchSelectField,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { ACCEPTED_FILE_TYPES, type FileRef, uploadFile } from '@/lib/files'
import { cn } from '@/lib/utils'

import { transferFieldsClass } from '../../../components/transfer/transfer-styles'
import { standardReadOnlyClass } from '../../standard-styles'
import type { TravelDetailValue, TravelLookups } from './travel.types'
import { TravelSection } from './travel-parts'

const PHONE = /^[\d+\-\s()]{7,20}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const chosen = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message })

const hotelRow = z.object({
  id: z.string(),
  stayType: chosen('Choose'),
  address: z.string().trim().min(1, 'Required').max(200),
  from: z.string().min(1, 'Required'),
  to: z.string().min(1, 'Required'),
  city: z.string().trim().min(1, 'Required').max(80),
  phone: z.string().trim().regex(PHONE, 'Give a phone number'),
  email: z.string().trim().regex(EMAIL, 'Give an email address'),
})
const ticketRow = z.object({
  id: z.string(),
  ticketNo: z.string().trim().min(1, 'Required').max(40),
  ticketClass: z.string().trim().max(30, 'Up to 30 characters'),
  departureFrom: z.string().trim().max(80),
  arrivalAt: z.string().trim().max(80),
  date: z.string().min(1, 'Required'),
  time: z.string().min(1, 'Required'),
  file: z.custom<FileRef | null>(),
  description: z.string().trim().max(300),
})

const nightsOf = (from: string, to: string) =>
  from && to
    ? differenceInCalendarDays(
        parse(to, 'yyyy-MM-dd', new Date()),
        parse(from, 'yyyy-MM-dd', new Date()),
      )
    : 0

/** The leg's own checks, with the travel modes a ticket is booked for. */
function makeSchema(ticketedModes: readonly string[]) {
  return z
    .object({
      travelType: chosen('Choose the travel type'),
      departureFrom: z.string().trim().min(1, 'Give where you leave from').max(80),
      arrivalAt: z.string().trim().min(1, 'Give where you arrive').max(80),
      travelMode: chosen('Choose the travel mode'),
      distanceKm: z
        .string()
        .trim()
        .refine(
          (value) => value === '' || (/^\d+(\.\d+)?$/.test(value) && Number(value) <= 50_000),
          {
            message: 'Give the distance in km',
          },
        ),
      fromDate: z.string().min(1, 'Choose the date'),
      fromTime: z.string().min(1, 'Choose the time'),
      toDate: z.string().min(1, 'Choose the date'),
      toTime: z.string().min(1, 'Choose the time'),
      stayRequired: z.boolean(),
      hotels: z.array(hotelRow),
      tickets: z.array(ticketRow),
    })
    .superRefine((values, context) => {
      const issue = (path: (string | number)[], message: string) => {
        context.addIssue({ code: 'custom', path, message })
      }
      const { fromDate, toDate } = values
      const place = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase()
      if (values.departureFrom.trim() && place(values.departureFrom) === place(values.arrivalAt)) {
        issue(['arrivalAt'], 'Arrive somewhere other than where you leave from')
      }
      if (fromDate && toDate && values.fromTime && values.toTime) {
        if (`${toDate}T${values.toTime}` <= `${fromDate}T${values.fromTime}`) {
          issue(['toTime'], 'Choose a time after the departure')
        }
      }
      if (values.stayRequired) {
        if (values.hotels.length === 0) issue(['hotels'], 'Add the hotel booking')
        values.hotels.forEach((hotel, index) => {
          if (hotel.from && fromDate && hotel.from < fromDate) {
            issue(['hotels', index, 'from'], 'Within the trip')
          }
          if (hotel.to && toDate && hotel.to > toDate) {
            issue(['hotels', index, 'to'], 'Within the trip')
          }
          if (hotel.from && hotel.to && hotel.to <= hotel.from) {
            issue(['hotels', index, 'to'], 'After From')
          }
        })
      }
      if (values.travelMode && ticketedModes.includes(values.travelMode)) {
        if (values.tickets.length === 0) issue(['tickets'], 'Add the ticket booking')
      }
      values.tickets.forEach((ticket, index) => {
        if (
          ticket.date &&
          ((fromDate && ticket.date < fromDate) || (toDate && ticket.date > toDate))
        ) {
          issue(['tickets', index, 'date'], 'Within the trip')
        }
      })
    })
}
type Values = z.infer<ReturnType<typeof makeSchema>>

let rowCount = 0
const newId = (prefix: string) => {
  rowCount += 1
  return `${prefix}_${Date.now().toString(36)}${String(rowCount)}`
}

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
const today = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function toValues(value: TravelDetailValue | undefined): Values {
  return {
    travelType: value?.travelType ?? null,
    departureFrom: value?.departureFrom ?? '',
    arrivalAt: value?.arrivalAt ?? '',
    travelMode: value?.travelMode ?? null,
    distanceKm: value?.distanceKm === null || value === undefined ? '' : String(value.distanceKm),
    fromDate: value?.fromDate ?? '',
    fromTime: value?.fromTime ?? '',
    toDate: value?.toDate ?? '',
    toTime: value?.toTime ?? '',
    stayRequired: value?.stayRequired ?? false,
    hotels: (value?.hotels ?? []).map((hotel) => ({
      id: hotel.id,
      stayType: hotel.stayType,
      address: hotel.address,
      from: hotel.from,
      to: hotel.to,
      city: hotel.city,
      phone: hotel.phone,
      email: hotel.email,
    })),
    tickets: value?.tickets ?? [],
  }
}

const TITLES = {
  create: 'Travel Detail Create',
  edit: 'Travel Detail Edit',
  view: 'Travel Detail View',
} as const

/** The red round ✕ of the booking rows. */
function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded-full bg-[#E50141] text-white outline-none hover:bg-[#E50141]/85 focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <X aria-hidden="true" className="size-3.5" strokeWidth={3} />
    </button>
  )
}

const required = (
  <span aria-hidden="true" className="ml-1 text-[#E50141]">
    *
  </span>
)

/** "Hotel Bookings *": the section title, the + Add, and the table's column names. */
function BookingTable({
  title,
  columns,
  readOnly,
  onAdd,
  error,
  empty,
  required: needed = true,
  children,
}: {
  title: string
  columns: readonly { label: string; required?: boolean }[]
  readOnly: boolean
  onAdd: () => void
  error: string | undefined
  empty: boolean
  /** The section's star: only when a booking is needed (tickets: for a ticketed mode). */
  required?: boolean
  children: ReactNode
}) {
  return (
    <TravelSection
      title={title}
      required={needed}
      {...(readOnly ? {} : { addLabel: `Add ${title.replace(/s$/, '').toLowerCase()}`, onAdd })}
      error={error}
    >
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[66rem] gap-2.5">
          <div aria-hidden="true" className={cn(rowGrid, 'font-inter text-base text-heading')}>
            {columns.map((column) => (
              <span key={column.label}>
                {column.label}
                {column.required && required}
              </span>
            ))}
            <span className="text-center">Action</span>
          </div>
          {empty ? <NoRecord /> : children}
        </div>
      </div>
    </TravelSection>
  )
}

const rowGrid = 'grid grid-cols-[repeat(8,minmax(7rem,1fr))_3.5rem] items-start gap-x-2'
const cellInput = 'h-10 px-2.5 sm:px-2.5'

/** One cell's error under its box. */
function CellError({ error }: { error: FieldError | undefined }) {
  return error?.message ? (
    <span className="mt-1 block text-xs text-destructive">{error.message}</span>
  ) : null
}

function TextCell({
  register,
  name,
  label,
  error,
  disabled,
  type = 'text',
}: {
  register: UseFormRegister<Values>
  name:
    | `hotels.${number}.${'address' | 'city' | 'phone' | 'email'}`
    | `tickets.${number}.${'ticketNo' | 'ticketClass' | 'departureFrom' | 'arrivalAt' | 'description'}`
  label: string
  error: FieldError | undefined
  disabled: boolean
  type?: 'text' | 'tel' | 'email'
}) {
  return (
    <div className="min-w-0">
      <Input
        type={type}
        aria-label={label}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        className={cellInput}
        {...register(name)}
      />
      <CellError error={error} />
    </div>
  )
}

function DateCell({
  control,
  name,
  label,
  disabled,
  minDate,
  maxDate,
}: {
  control: Control<Values>
  name: `hotels.${number}.${'from' | 'to'}` | `tickets.${number}.date`
  label: string
  disabled: boolean
  minDate?: Date | undefined
  maxDate?: Date | undefined
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="min-w-0">
          <DateInput
            aria-label={label}
            aria-invalid={Boolean(fieldState.error)}
            value={field.value}
            onChange={field.onChange}
            disabled={disabled}
            placeholder=" "
            display="MMMM d, yyyy"
            minDate={minDate}
            maxDate={maxDate}
            className="px-2 text-xs sm:px-2 sm:text-xs"
          />
          <CellError error={fieldState.error} />
        </div>
      )}
    />
  )
}

/**
 * "Attachment" in a ticket row: the file's name (a link once uploaded) and a
 * small Attach button. Picking a file uploads it (`POST /files`, module
 * `requests`); the request sends its id as the ticket's `fileId`.
 */
function AttachCell({
  control,
  name,
  label,
  disabled,
}: {
  control: Control<Values>
  name: `tickets.${number}.file`
  label: string
  disabled: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const value = field.value
        const pick = async (file: File) => {
          setUploading(true)
          setFailure(null)
          try {
            const uploaded = await uploadFile(file, 'requests')
            field.onChange({ id: uploaded.id, name: uploaded.name, url: uploaded.url })
          } catch (problem) {
            setFailure(problem instanceof ApiError ? problem.message : 'Could not upload')
          } finally {
            setUploading(false)
          }
        }
        return (
          <div className="min-w-0">
            <div className="flex h-10 min-w-0 overflow-hidden rounded-md border border-input bg-card">
              <span className="flex min-w-0 flex-1 items-center truncate px-2 font-inter text-xs text-field-value">
                {uploading ? (
                  'Uploading…'
                ) : value?.url ? (
                  <a
                    href={value.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-primary underline-offset-2 hover:underline"
                  >
                    {value.name ?? 'Ticket'}
                  </a>
                ) : (
                  (value?.name ?? '')
                )}
              </span>
              {value && !disabled && !uploading && (
                <button
                  type="button"
                  aria-label={`Remove ${value.name ?? 'the file'}`}
                  onClick={() => {
                    field.onChange(null)
                  }}
                  className="px-1 text-muted-foreground hover:text-destructive"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              )}
              <button
                type="button"
                disabled={disabled || uploading}
                aria-label={
                  value
                    ? `${label}: replace ${value.name ?? 'the file'}`
                    : `${label}: attach a file`
                }
                onClick={() => input.current?.click()}
                className="flex shrink-0 items-center bg-[#707070] px-2.5 text-white outline-none hover:bg-[#5c5c5c] focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                ) : (
                  <Paperclip aria-hidden="true" className="size-3.5" />
                )}
              </button>
              <input
                ref={input}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void pick(file)
                  event.target.value = ''
                }}
              />
            </div>
            {failure && <span className="mt-1 block text-xs text-destructive">{failure}</span>}
          </div>
        )
      }}
    />
  )
}

/**
 * "Travel Detail Create" / View: one leg of the travel. Travel Type,
 * Departure From, Arrival at, Travel Mode, Distance, From and To date and
 * time, Stay Required with its Hotel Bookings, and the Ticket Bookings, as
 * drawn (frames 4173:57937, 4173:62080). Save hands the leg back to the
 * request form.
 */
export function TravelDetailDialog({
  mode,
  value,
  lookups,
  onSave,
  onClose,
}: {
  mode: 'create' | 'edit' | 'view'
  value?: TravelDetailValue | undefined
  lookups: TravelLookups | undefined
  onSave?: (value: TravelDetailValue) => void
  onClose: () => void
}) {
  const formId = useId()
  const readOnly = mode === 'view'
  const [resolver] = useState(() =>
    zodResolver(
      makeSchema(
        (lookups?.travelModes ?? []).filter((item) => item.ticketed).map((item) => item.value),
      ),
    ),
  )
  const form = useForm<Values>({ resolver, defaultValues: toValues(value) })
  const { control, register, formState } = form
  const errors = formState.errors
  const hotels = useFieldArray({ control, name: 'hotels' })
  const tickets = useFieldArray({ control, name: 'tickets' })
  const [fromDate, toDate, stayRequired, departureFrom, arrivalAt, hotelDates, travelMode] =
    useWatch({
      control,
      name: [
        'fromDate',
        'toDate',
        'stayRequired',
        'departureFrom',
        'arrivalAt',
        'hotels',
        'travelMode',
      ],
    })
  // A ticket is needed only for a ticketed travel mode (flight, train …).
  const ticketNeeded = (lookups?.travelModes ?? []).some(
    (item) => item.ticketed && item.value === travelMode,
  )
  const tripStart = fromDate ? day(fromDate) : undefined
  const tripEnd = toDate ? day(toDate) : undefined
  const options = (list: readonly { value: string; label: string }[] | undefined) =>
    (list ?? []).map((item) => ({ value: item.value, label: item.label }))

  const addHotel = () => {
    hotels.append({
      id: newId('hotel'),
      stayType: 'hotel',
      address: '',
      from: fromDate,
      to: toDate,
      city: arrivalAt,
      phone: '',
      email: '',
    })
  }
  const addTicket = () => {
    tickets.append({
      id: newId('ticket'),
      ticketNo: '',
      ticketClass: '',
      departureFrom,
      arrivalAt,
      date: fromDate,
      time: '',
      file: null,
      description: '',
    })
  }

  const submit = form.handleSubmit((values) => {
    onSave?.({
      id: value?.id ?? newId('leg'),
      travelType: values.travelType ?? '',
      departureFrom: values.departureFrom,
      arrivalAt: values.arrivalAt,
      travelMode: values.travelMode ?? '',
      distanceKm: values.distanceKm === '' ? null : Number(values.distanceKm),
      fromDate: values.fromDate,
      fromTime: values.fromTime,
      toDate: values.toDate,
      toTime: values.toTime,
      stayRequired: values.stayRequired,
      hotels: values.stayRequired
        ? values.hotels.map((hotel) => ({
            ...hotel,
            stayType: hotel.stayType ?? 'hotel',
            nights: nightsOf(hotel.from, hotel.to),
          }))
        : [],
      tickets: values.tickets,
    })
    onClose()
  })

  const arrayError = (error: { message?: string; root?: { message?: string } } | undefined) =>
    error?.root?.message ?? error?.message

  return (
    <PayrollDialog
      title={TITLES[mode]}
      onClose={onClose}
      formId={formId}
      readOnly={readOnly}
      className="max-w-7xl"
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          // The leg's form sits in a portal inside the request's form: keep its submit to itself.
          event.stopPropagation()
          void submit(event)
        }}
        className={cn('grid gap-5', transferFieldsClass, readOnly && standardReadOnlyClass)}
      >
        <div className="grid gap-5 @5xl:max-w-[68rem]">
          <SearchSelectField
            control={control}
            name="travelType"
            label="Travel Type"
            required
            placeholder="Select Travel Type"
            disabled={readOnly}
            options={options(lookups?.travelTypes)}
          />
          <TextField
            control={control}
            name="departureFrom"
            label="Departure From"
            required
            maxLength={80}
            disabled={readOnly}
          />
          <TextField
            control={control}
            name="arrivalAt"
            label="Arrival at"
            required
            maxLength={80}
            disabled={readOnly}
          />
          <SearchSelectField
            control={control}
            name="travelMode"
            label="Travel Mode"
            required
            placeholder="Select Travel Mode"
            disabled={readOnly}
            options={options(lookups?.travelModes)}
          />
          <TextField
            control={control}
            name="distanceKm"
            label="Distance (in Km)"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            disabled={readOnly}
          />
          <DateField
            control={control}
            name="fromDate"
            label="From Date"
            required
            display="MMMM d, yyyy"
            disabled={readOnly}
            minDate={readOnly ? undefined : today()}
          />
          <TimePickerField
            control={control}
            name="fromTime"
            label="From Time"
            required
            disabled={readOnly}
          />
          <DateField
            control={control}
            name="toDate"
            label="To Date"
            required
            display="MMMM d, yyyy"
            disabled={readOnly}
            minDate={readOnly ? undefined : (tripStart ?? today())}
          />
          <TimePickerField
            control={control}
            name="toTime"
            label="To Time"
            required
            disabled={readOnly}
          />
          <CheckboxField
            control={control}
            name="stayRequired"
            tone="navy"
            disabled={readOnly}
            label={<span>Stay Required</span>}
            onCheckedChange={(checked) => {
              if (checked && hotels.fields.length === 0) addHotel()
            }}
          />
        </div>

        {stayRequired && (
          <BookingTable
            title="Hotel Bookings"
            readOnly={readOnly}
            onAdd={addHotel}
            error={arrayError(errors.hotels)}
            empty={hotels.fields.length === 0}
            columns={[
              { label: 'Stay Type', required: true },
              { label: 'Address', required: true },
              { label: 'From', required: true },
              { label: 'To', required: true },
              { label: 'Night', required: true },
              { label: 'City', required: true },
              { label: 'Phone No', required: true },
              { label: 'Email', required: true },
            ]}
          >
            {hotels.fields.map((row, index) => {
              const rowErrors = errors.hotels?.[index]
              const n = String(index + 1)
              const dates = hotelDates[index]
              return (
                <div key={row.id} className={rowGrid}>
                  <Controller
                    control={control}
                    name={`hotels.${index}.stayType`}
                    render={({ field, fieldState }) => (
                      <div className="min-w-0">
                        <SearchSelect
                          aria-label={`Hotel ${n} Stay Type`}
                          aria-invalid={Boolean(fieldState.error)}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select Stay Type"
                          disabled={readOnly}
                          options={options(lookups?.stayTypes)}
                          className="px-2.5 sm:px-2.5"
                        />
                        <CellError error={fieldState.error} />
                      </div>
                    )}
                  />
                  <TextCell
                    register={register}
                    name={`hotels.${index}.address`}
                    label={`Hotel ${n} Address`}
                    error={rowErrors?.address}
                    disabled={readOnly}
                  />
                  <DateCell
                    control={control}
                    name={`hotels.${index}.from`}
                    label={`Hotel ${n} From`}
                    disabled={readOnly}
                    minDate={tripStart}
                    maxDate={tripEnd}
                  />
                  <DateCell
                    control={control}
                    name={`hotels.${index}.to`}
                    label={`Hotel ${n} To`}
                    disabled={readOnly}
                    minDate={tripStart}
                    maxDate={tripEnd}
                  />
                  <Input
                    aria-label={`Hotel ${n} Night`}
                    readOnly
                    disabled
                    value={dates ? String(Math.max(0, nightsOf(dates.from, dates.to))) : '0'}
                    className={cellInput}
                  />
                  <TextCell
                    register={register}
                    name={`hotels.${index}.city`}
                    label={`Hotel ${n} City`}
                    error={rowErrors?.city}
                    disabled={readOnly}
                  />
                  <TextCell
                    register={register}
                    name={`hotels.${index}.phone`}
                    label={`Hotel ${n} Phone No`}
                    type="tel"
                    error={rowErrors?.phone}
                    disabled={readOnly}
                  />
                  <TextCell
                    register={register}
                    name={`hotels.${index}.email`}
                    label={`Hotel ${n} Email`}
                    type="email"
                    error={rowErrors?.email}
                    disabled={readOnly}
                  />
                  <div className="flex h-10 items-center justify-center">
                    {!readOnly && (
                      <RemoveButton
                        label={`Remove hotel ${n}`}
                        onClick={() => {
                          hotels.remove(index)
                        }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </BookingTable>
        )}

        <BookingTable
          title="Ticket Bookings"
          required={ticketNeeded}
          readOnly={readOnly}
          onAdd={addTicket}
          error={arrayError(errors.tickets)}
          empty={tickets.fields.length === 0}
          columns={[
            { label: 'Ticket No', required: true },
            { label: 'Class' },
            { label: 'Departure From' },
            { label: 'Arrival at' },
            { label: 'Date', required: true },
            { label: 'Time', required: true },
            { label: 'Attachment' },
            { label: 'Description' },
          ]}
        >
          {tickets.fields.map((row, index) => {
            const rowErrors = errors.tickets?.[index]
            const n = String(index + 1)
            return (
              <div key={row.id} className={rowGrid}>
                <TextCell
                  register={register}
                  name={`tickets.${index}.ticketNo`}
                  label={`Ticket ${n} Ticket No`}
                  error={rowErrors?.ticketNo}
                  disabled={readOnly}
                />
                <TextCell
                  register={register}
                  name={`tickets.${index}.ticketClass`}
                  label={`Ticket ${n} Class`}
                  error={rowErrors?.ticketClass}
                  disabled={readOnly}
                />
                <TextCell
                  register={register}
                  name={`tickets.${index}.departureFrom`}
                  label={`Ticket ${n} Departure From`}
                  error={rowErrors?.departureFrom}
                  disabled={readOnly}
                />
                <TextCell
                  register={register}
                  name={`tickets.${index}.arrivalAt`}
                  label={`Ticket ${n} Arrival at`}
                  error={rowErrors?.arrivalAt}
                  disabled={readOnly}
                />
                <DateCell
                  control={control}
                  name={`tickets.${index}.date`}
                  label={`Ticket ${n} Date`}
                  disabled={readOnly}
                  minDate={tripStart}
                  maxDate={tripEnd}
                />
                <div className="min-w-0">
                  <Input
                    type="time"
                    aria-label={`Ticket ${n} Time`}
                    aria-invalid={Boolean(rowErrors?.time)}
                    disabled={readOnly}
                    className={cn(cellInput, '[color-scheme:light] dark:[color-scheme:dark]')}
                    {...register(`tickets.${index}.time`)}
                  />
                  <CellError error={rowErrors?.time} />
                </div>
                <AttachCell
                  control={control}
                  name={`tickets.${index}.file`}
                  label={`Ticket ${n} Attachment`}
                  disabled={readOnly}
                />
                <TextCell
                  register={register}
                  name={`tickets.${index}.description`}
                  label={`Ticket ${n} Description`}
                  error={rowErrors?.description}
                  disabled={readOnly}
                />
                <div className="flex h-10 items-center justify-center">
                  {!readOnly && (
                    <RemoveButton
                      label={`Remove ticket ${n}`}
                      onClick={() => {
                        tickets.remove(index)
                      }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </BookingTable>
      </form>
    </PayrollDialog>
  )
}
