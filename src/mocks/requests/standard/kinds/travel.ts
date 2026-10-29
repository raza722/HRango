import { addDays, differenceInCalendarDays, format } from 'date-fns'
import { z } from 'zod'

import { mockFileUrl } from '../../../files/handlers'
import { errorResponse } from '../../../utils'
import type { RequestBodyIn } from '../../backend'
import { invalid } from '../../http'
import { mustFind } from '../../people'
import {
  defineStandardKind,
  type PayloadContext,
  seedRequest,
  type StandardKindServer,
  type StoredStandardRequest,
} from '../engine'

/*
 * Travel on the API's request engine (`POST /requests/travel`): the header
 * carries the description and the Application, `details` the purpose,
 * extension, alternative phone, advances, legs, stays and tickets (three
 * lists of the request; the screens show stays and tickets under the leg they
 * fall in). The checks are the API's: purpose required, an advance when
 * Advance Required, at least one leg, each leg arriving after it leaves, legs
 * not overlapping, a stay when a leg needs one, stays inside the trip, and no
 * other live travel request over the same days. Approval changes no other module.
 */

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const stamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/)
const text = (max: number) => z.string().trim().min(1).max(max)
const optional = (max: number) => z.string().trim().max(max).nullish()

const legSchema = z.object({
  travelType: z.enum(['domestic', 'international']),
  fromPlace: text(200),
  toPlace: text(200),
  travelMode: z.enum(['bus', 'train', 'taxi', 'air', 'own_car', 'pool_car']),
  distanceKm: z.number().min(0).nullish(),
  departAt: stamp,
  arriveAt: stamp,
  stayRequired: z.boolean().default(false),
})
const staySchema = z.object({
  stayType: z.enum(['hotel', 'self']),
  address: text(500),
  city: text(200),
  fromDate: ymd,
  toDate: ymd,
  nights: z.number().int().min(0).nullish(),
  phone: text(30),
  email: z.string().regex(/^[^@\s]+@[^@\s]+$/, 'Give an email address'),
})
const ticketSchema = z.object({
  ticketNo: text(50),
  travelClass: optional(30),
  fromPlace: optional(200),
  toPlace: optional(200),
  travelAt: stamp,
  description: z.string().nullish(),
  fileId: z.union([z.string(), z.number()]).transform(String).nullish(),
})
const schema = z.object({
  purpose: z.string().trim().max(500),
  extensionNo: optional(20),
  altPhone: optional(30),
  advanceRequired: z.boolean().default(false),
  advances: z
    .array(z.object({ amount: z.number().positive(), currency: z.string().length(3) }))
    .default([]),
  legs: z.array(legSchema),
  stays: z.array(staySchema).default([]),
  tickets: z.array(ticketSchema).default([]),
  description: z.string().max(4000),
  application: z.string(),
})
type Input = z.infer<typeof schema>

/** What the mock keeps: the API's details with their row ids, plus the header's texts. */
export interface TravelStored {
  purpose: string
  extensionNo: string | null
  altPhone: string | null
  advanceRequired: boolean
  advances: { id: string; amount: number; currency: string }[]
  legs: (z.infer<typeof legSchema> & { id: string; distanceKm: number | null })[]
  stays: (Omit<z.infer<typeof staySchema>, 'nights'> & { id: string; nights: number })[]
  tickets: {
    id: string
    ticketNo: string
    travelClass: string | null
    fromPlace: string | null
    toPlace: string | null
    travelAt: string
    description: string | null
    fileId: string | null
  }[]
  description: string
  application: string
}

const stored = (record: StoredStandardRequest) => record.payload as unknown as TravelStored
const withSeconds = (value: string) => (value.length === 16 ? `${value}:00` : value)
const nightsBetween = (from: string, to: string) =>
  differenceInCalendarDays(new Date(`${to}T00:00`), new Date(`${from}T00:00`))

/** The trip's first and last day. */
function tripOf(payload: { legs: readonly { departAt: string; arriveAt: string }[] }): {
  from: string
  to: string
} {
  const from = payload.legs.reduce(
    (min, leg) => (min === '' || leg.departAt < min ? leg.departAt : min),
    '',
  )
  const to = payload.legs.reduce((max, leg) => (leg.arriveAt > max ? leg.arriveAt : max), '')
  return { from: from.slice(0, 10), to: to.slice(0, 10) }
}

function toPayload(input: Input, context: PayloadContext): Response | Record<string, unknown> {
  if (!input.purpose) return invalid('Purpose is required.', { purpose: 'Purpose is required.' })
  if (input.advanceRequired && input.advances.length === 0) {
    return invalid('Add the advance amount, or untick Advance Required.', {
      advances: 'Add the advance amount, or untick Advance Required.',
    })
  }
  if (input.legs.length === 0) {
    return invalid('Add at least one travel detail.', { legs: 'Add at least one travel detail.' })
  }
  const legs = input.legs
    .map((leg) => ({
      ...leg,
      departAt: withSeconds(leg.departAt),
      arriveAt: withSeconds(leg.arriveAt),
    }))
    .sort((a, b) => a.departAt.localeCompare(b.departAt))
  // A leg goes somewhere: Lahore → Lahore is refused.
  const place = (text: string | null | undefined) =>
    (text ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  if (
    legs.some((leg) => place(leg.fromPlace) !== '' && place(leg.fromPlace) === place(leg.toPlace))
  ) {
    const message =
      'A travel detail arrives where it leaves from. Change Departure From or Arrival at.'
    return invalid(message, { legs: message })
  }
  if (legs.some((leg) => leg.arriveAt <= leg.departAt)) {
    const message = 'Each travel detail needs a departure before its arrival.'
    return invalid(message, { legs: message })
  }
  if (legs.some((leg, index) => index > 0 && leg.departAt < (legs[index - 1]?.arriveAt ?? ''))) {
    return invalid('Travel details overlap each other.', {
      legs: 'Travel details overlap each other.',
    })
  }
  if (legs.some((leg) => leg.stayRequired) && input.stays.length === 0) {
    const message = 'A stay is required: add the hotel booking.'
    return invalid(message, { stays: message })
  }
  const trip = tripOf({ legs })
  if (
    input.stays.some(
      (stay) => stay.toDate < stay.fromDate || stay.fromDate < trip.from || stay.toDate > trip.to,
    )
  ) {
    return invalid('Each stay must fall inside the trip.', {
      stays: 'Each stay must fall inside the trip.',
    })
  }
  const clash = context.records.find((record) => {
    if (record.id === context.ignoreId || record.employeeId !== context.employeeId) return false
    if (!['pending', 'completed', 'cancelling'].includes(record.status)) return false
    const other = tripOf(stored(record))
    return other.from <= trip.to && other.to >= trip.from
  })
  if (clash) {
    const message = 'Another travel request already covers these dates.'
    return errorResponse(409, message, { code: 'TRAVEL_OVERLAP', fieldErrors: { legs: message } })
  }
  const key = Date.now().toString(36)
  const payload: TravelStored = {
    purpose: input.purpose,
    extensionNo: input.extensionNo ?? null,
    altPhone: input.altPhone ?? null,
    advanceRequired: input.advanceRequired,
    advances: input.advanceRequired
      ? input.advances.map((item, index) => ({ id: `adv_${key}${String(index)}`, ...item }))
      : [],
    legs: legs.map((leg, index) => ({
      ...leg,
      id: `leg_${key}${String(index)}`,
      distanceKm: leg.distanceKm ?? null,
    })),
    stays: input.stays.map((stay, index) => ({
      ...stay,
      id: `stay_${key}${String(index)}`,
      nights: stay.nights ?? nightsBetween(stay.fromDate, stay.toDate),
    })),
    tickets: input.tickets.map((ticket, index) => ({
      id: `tkt_${key}${String(index)}`,
      ticketNo: ticket.ticketNo,
      travelClass: ticket.travelClass ?? null,
      fromPlace: ticket.fromPlace ?? null,
      toPlace: ticket.toPlace ?? null,
      travelAt: withSeconds(ticket.travelAt),
      description: ticket.description ?? null,
      fileId: ticket.fileId ?? null,
    })),
    description: input.description,
    application: input.application,
  }
  return payload as unknown as Record<string, unknown>
}

/** A `RequestIn` body → the input: the details plus the header's description and application. */
const fromBody = (body: RequestBodyIn) => ({
  ...body.details,
  description: body.description ?? '',
  application: body.application ?? '',
})

// --- seeds ------------------------------------------------------------------------------------------

const day = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd')

interface LegSeed {
  from: string
  to: string
  mode: TravelStored['legs'][number]['travelMode']
  distance: number | null
  start: number
  days: number
  type?: TravelStored['legs'][number]['travelType']
  hotel?: { name: string; city: string; phone: string; email: string }
  ticket?: { no: string; ticketClass: string }
}

/** A short application in the editor's layout, as Regenerate would write it. */
function seedLetter(employeeId: string, purpose: string, leg: LegSeed): string {
  const name = mustFind(employeeId).name
  return [
    `<p>Subject: Travel Request from ${leg.from} to ${leg.to}</p>`,
    '<p>Dear Sir/Madam,</p>',
    `<p>I would like to request approval to travel from ${leg.from} to ${leg.to} from ${day(leg.start)} to ${day(leg.start + leg.days)}. ${purpose}</p>`,
    '<p>Thank you for your consideration.</p>',
    `<p>Sincerely,<br>${name}</p>`,
  ].join('')
}

const HOTELS = {
  lahore: {
    name: 'Lahore Grand Hotel, Mall Road',
    city: 'Lahore',
    phone: '042-3630-0000',
    email: 'reservations@lahoregrand.example',
  },
  karachi: {
    name: 'Harbour View Hotel, Clifton',
    city: 'Karachi',
    phone: '021-3583-0000',
    email: 'frontdesk@harbourview.example',
  },
  dubai: {
    name: 'Creekside Suites, Deira',
    city: 'Dubai',
    phone: '+971 4 000 0000',
    email: 'stay@creekside.example',
  },
} as const

const def: StandardKindServer<Input> = {
  kind: 'travel',
  typeCode: 'travel',
  typeName: 'Travel',
  settingsType: 'travel',
  codePrefix: 'TR-',
  codeDigits: 4,
  fromBody,
  schema,
  toPayload,
  dateOf: (payload) => tripOf(payload as unknown as TravelStored).from,
  header: (payload) => {
    const value = payload as unknown as TravelStored
    const trip = tripOf(value)
    return {
      fromDate: trip.from || null,
      toDate: trip.to || null,
      days: trip.from ? nightsBetween(trip.from, trip.to) + 1 : null,
      reason: null,
      description: value.description || null,
      application: value.application || null,
    }
  },
  toDetails: (payload) => {
    const {
      description: _description,
      application: _application,
      ...details
    } = payload as unknown as TravelStored
    return {
      ...details,
      tickets: details.tickets.map((ticket) => ({
        ...ticket,
        fileName: ticket.fileId ? `Ticket ${ticket.ticketNo}` : null,
        fileUrl: ticket.fileId ? mockFileUrl(ticket.fileId) : null,
      })),
    }
  },
  seed: () => {
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
    const make = (
      key: string,
      employeeId: string,
      purpose: string,
      seed: LegSeed,
      status: StoredStandardRequest['status'],
      options: {
        approvedSteps?: number
        daysAgo?: number
        advance?: number
        cancelReason?: string
      } = {},
    ) => {
      const fromDate = day(seed.start)
      const toDate = day(seed.start + seed.days)
      const payload: TravelStored = {
        purpose,
        extensionNo: String(100 + Number(key.slice(-1))).padStart(3, '0'),
        altPhone: '0300-1234567',
        advanceRequired: options.advance !== undefined,
        advances:
          options.advance !== undefined
            ? [{ id: `${key}_adv`, amount: options.advance, currency: 'PKR' }]
            : [],
        legs: [
          {
            id: `${key}_leg`,
            travelType: seed.type ?? 'domestic',
            fromPlace: seed.from,
            toPlace: seed.to,
            travelMode: seed.mode,
            distanceKm: seed.distance,
            departAt: `${fromDate}T09:00:00`,
            arriveAt: `${toDate}T18:00:00`,
            stayRequired: Boolean(seed.hotel),
          },
        ],
        stays: seed.hotel
          ? [
              {
                id: `${key}_hotel`,
                stayType: 'hotel',
                address: seed.hotel.name,
                city: seed.hotel.city,
                fromDate,
                toDate,
                nights: seed.days,
                phone: seed.hotel.phone,
                email: seed.hotel.email,
              },
            ]
          : [],
        tickets: seed.ticket
          ? [
              {
                id: `${key}_ticket`,
                ticketNo: seed.ticket.no,
                travelClass: seed.ticket.ticketClass,
                fromPlace: seed.from,
                toPlace: seed.to,
                travelAt: `${fromDate}T07:30:00`,
                description: null,
                fileId: null,
              },
            ]
          : [],
        description: '',
        application: seedLetter(employeeId, purpose, seed),
      }
      return seedRequest(def, {
        id: `tr_${key}`,
        code: `TR-${key.padStart(4, '0')}`,
        employeeId,
        payload: payload as unknown as Record<string, unknown>,
        at: at(options.daysAgo ?? 3),
        status,
        ...(options.approvedSteps !== undefined ? { approvedSteps: options.approvedSteps } : {}),
        ...(options.cancelReason ? { cancelReason: options.cancelReason } : {}),
      })
    }
    const toLahore = (start: number, days: number): LegSeed => ({
      from: 'Multan',
      to: 'Lahore',
      mode: 'own_car',
      distance: 340,
      start,
      days,
      hotel: HOTELS.lahore,
    })
    return [
      make(
        '001',
        'em_sadia',
        'Campus hiring drive at the university job fair.',
        toLahore(8, 2),
        'pending',
        { daysAgo: 1, advance: 25_000 },
      ),
      make(
        '002',
        'em_haroon',
        'Client workshop on the new release.',
        {
          from: 'Lahore',
          to: 'Karachi',
          mode: 'air',
          distance: 1_030,
          start: 10,
          days: 3,
          hotel: HOTELS.karachi,
          ticket: { no: 'PK-302', ticketClass: 'Economy' },
        },
        'pending',
        { daysAgo: 2, advance: 60_000 },
      ),
      make(
        '003',
        'em_rehan',
        'Mobile app launch with the partner bank.',
        {
          from: 'Lahore',
          to: 'Islamabad',
          mode: 'train',
          distance: 375,
          start: 12,
          days: 1,
          ticket: { no: 'GR-7781', ticketClass: 'Business' },
        },
        'pending',
        { approvedSteps: 1, daysAgo: 2 },
      ),
      make(
        '004',
        'em_omer',
        'Quarterly audit at the Lahore office.',
        toLahore(-12, 2),
        'completed',
        {
          daysAgo: 20,
          advance: 15_000,
        },
      ),
      make('005', 'em_laiba', 'Training on the new payroll rules.', toLahore(15, 1), 'cancelling', {
        daysAgo: 6,
        cancelReason: 'The training moved online.',
      }),
      make(
        '006',
        'em_shelley',
        'HR leadership summit.',
        {
          from: 'Lahore',
          to: 'Dubai',
          type: 'international',
          mode: 'air',
          distance: 2_150,
          start: 20,
          days: 3,
          hotel: HOTELS.dubai,
          ticket: { no: 'EK-623', ticketClass: 'Economy' },
        },
        'pending',
        { daysAgo: 1, advance: 1_500 },
      ),
      make(
        '007',
        'em_shelley',
        'Branch visit for the annual reviews.',
        { from: 'Lahore', to: 'Islamabad', mode: 'pool_car', distance: 375, start: -30, days: 1 },
        'completed',
        { daysAgo: 40 },
      ),
      make(
        '008',
        'em_mahnoor',
        'Design conference.',
        {
          from: 'Lahore',
          to: 'Karachi',
          mode: 'bus',
          distance: 1_210,
          start: 9,
          days: 2,
          hotel: HOTELS.karachi,
          ticket: { no: 'DW-4410', ticketClass: 'Executive' },
        },
        'rejected',
        { daysAgo: 4 },
      ),
      make(
        '009',
        'em_zainab',
        'Vendor meeting.',
        { from: 'Lahore', to: 'Sialkot', mode: 'taxi', distance: 130, start: -5, days: 0 },
        'cancelled',
        { daysAgo: 15, cancelReason: 'The vendor came to us.' },
      ),
    ]
  },
}

export const travelServer = defineStandardKind(def)
