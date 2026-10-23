import { addDays, differenceInCalendarDays, format } from 'date-fns'
import { z } from 'zod'

import { DIRECTORY } from '../../../employees/seed'
import { invalid, today } from '../../http'
import { mustFind, requestEmployee } from '../../people'
import {
  defineStandardKind,
  seedRequest,
  type StandardKindServer,
  type StoredStandardRequest,
} from '../engine'

/*
 * Travel: the person asks to travel ("Travel Request Create": Purpose,
 * Extension No, Alternative Phone No, Description, Advance Required with the
 * Advances it needs, and one or more travel Details). Each detail ("Travel
 * Detail Create") is one leg: type, from / to, mode, distance, when it leaves
 * and arrives, and its Hotel and Ticket bookings. Approval changes no other
 * module.
 */

export const TRAVEL_TYPES = [
  { value: 'domestic', label: 'Domestic' },
  { value: 'international', label: 'International' },
] as const

/** The requirements' modes; a ticket is booked for the public ones. */
export const TRAVEL_MODES = [
  { value: 'bus', label: 'Bus', ticketed: true },
  { value: 'train', label: 'Train', ticketed: true },
  { value: 'taxi', label: 'Taxi', ticketed: false },
  { value: 'air', label: 'Air', ticketed: true },
  { value: 'own-car', label: 'Own Car', ticketed: false },
  { value: 'pool-car', label: 'Pool Car', ticketed: false },
] as const

export const STAY_TYPES = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'self', label: 'Self' },
] as const

/** "Dinar - DZD ( Algeria )", as the Currency list writes them, by country. */
const CURRENCIES: readonly (readonly [code: string, name: string, country: string])[] = [
  ['AFN', 'Afghani', 'Afghanistan'],
  ['ALL', 'Lek', 'Albania'],
  ['DZD', 'Dinar', 'Algeria'],
  ['AUD', 'Dollar', 'Australia'],
  ['BHD', 'Dinar', 'Bahrain'],
  ['BDT', 'Taka', 'Bangladesh'],
  ['CAD', 'Dollar', 'Canada'],
  ['CNY', 'Yuan', 'China'],
  ['EGP', 'Pound', 'Egypt'],
  ['EUR', 'Euro', 'European Union'],
  ['INR', 'Rupee', 'India'],
  ['IDR', 'Rupiah', 'Indonesia'],
  ['JPY', 'Yen', 'Japan'],
  ['KWD', 'Dinar', 'Kuwait'],
  ['MYR', 'Ringgit', 'Malaysia'],
  ['OMR', 'Rial', 'Oman'],
  ['PKR', 'Rupee', 'Pakistan'],
  ['QAR', 'Riyal', 'Qatar'],
  ['SAR', 'Riyal', 'Saudi Arabia'],
  ['SGD', 'Dollar', 'Singapore'],
  ['LKR', 'Rupee', 'Sri Lanka'],
  ['CHF', 'Franc', 'Switzerland'],
  ['TRY', 'Lira', 'Turkey'],
  ['AED', 'Dirham', 'United Arab Emirates'],
  ['GBP', 'Pound', 'United Kingdom'],
  ['USD', 'Dollar', 'United States'],
]
const currencyLabel = (code: string) => {
  const entry = CURRENCIES.find(([value]) => value === code)
  return entry ? `${entry[1]} - ${entry[0]} ( ${entry[2]} )` : code
}

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const hm = z.string().regex(/^\d{2}:\d{2}$/)
const id = z.string().min(1).max(40)
const line = (max: number) => z.string().trim().max(max)

const hotelSchema = z.object({
  id,
  stayType: z.enum(['hotel', 'self']),
  address: line(200),
  from: ymd,
  to: ymd,
  city: line(80),
  phone: line(20),
  email: line(120),
})
const ticketSchema = z.object({
  id,
  ticketNo: line(40),
  ticketClass: line(40),
  departureFrom: line(80),
  arrivalAt: line(80),
  date: ymd,
  time: hm,
  attachment: z.string().max(200).nullable(),
  description: line(300),
})
const detailSchema = z.object({
  id,
  travelType: z.enum(['domestic', 'international']),
  departureFrom: line(80),
  arrivalAt: line(80),
  travelMode: z.enum(['bus', 'train', 'taxi', 'air', 'own-car', 'pool-car']),
  distanceKm: z.number().min(0).max(50_000).nullable(),
  fromDate: ymd,
  fromTime: hm,
  toDate: ymd,
  toTime: hm,
  stayRequired: z.boolean(),
  hotels: z.array(hotelSchema).max(10),
  tickets: z.array(ticketSchema).max(10),
})
const schema = z.object({
  purpose: line(500),
  extensionNo: line(10),
  alternativePhone: line(20),
  description: line(1000),
  advanceRequired: z.boolean(),
  advances: z
    .array(z.object({ id, amount: z.number().positive().max(10_000_000), currency: z.string() }))
    .max(10),
  details: z.array(detailSchema).max(10),
  application: z.string().max(20_000),
})
type Input = z.infer<typeof schema>

export type TravelHotelStored = z.infer<typeof hotelSchema> & { nights: number }
export type TravelTicketStored = z.infer<typeof ticketSchema>
export type TravelDetailStored = Omit<z.infer<typeof detailSchema>, 'hotels'> & {
  hotels: TravelHotelStored[]
}
export interface TravelStored {
  purpose: string
  extensionNo: string
  alternativePhone: string
  description: string
  advanceRequired: boolean
  advances: { id: string; amount: number; currency: string }[]
  /** In time order. */
  details: TravelDetailStored[]
  /** The Application beside the form (HTML from its editor). */
  application: string
}

const stored = (record: StoredStandardRequest) => record.payload as unknown as TravelStored
const nightsBetween = (from: string, to: string) =>
  differenceInCalendarDays(new Date(`${to}T00:00`), new Date(`${from}T00:00`))
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE = /^[\d+\-\s()]{7,20}$/

/** The trip from the first leg's departure to the last leg's arrival. */
function span(payload: TravelStored): { start: string; end: string } {
  const first = payload.details[0]
  const last = payload.details.at(-1)
  return {
    start: first ? `${first.fromDate}T${first.fromTime}` : '',
    end: last ? `${last.toDate}T${last.toTime}` : '',
  }
}

/** Checks one leg; returns what is wrong with it, or null. */
function legProblem(detail: z.infer<typeof detailSchema>): string | null {
  if (!detail.departureFrom || !detail.arrivalAt) return 'give where it leaves from and arrives at'
  if (detail.fromDate < today()) return 'choose today or a later From Date'
  if (`${detail.toDate}T${detail.toTime}` <= `${detail.fromDate}T${detail.fromTime}`) {
    return 'it arrives before it leaves'
  }
  if (nightsBetween(detail.fromDate, detail.toDate) > 90) return 'keep a trip to 90 days at most'
  if (detail.stayRequired && detail.hotels.length === 0) return 'add the hotel booking'
  for (const hotel of detail.stayRequired ? detail.hotels : []) {
    if (!hotel.address || !hotel.city) return 'give the hotel’s address and city'
    if (!PHONE.test(hotel.phone)) return 'give the hotel’s phone number'
    if (!EMAIL.test(hotel.email)) return 'give the hotel’s email address'
    if (hotel.from < detail.fromDate || hotel.to > detail.toDate) {
      return 'keep the hotel stay within the trip’s dates'
    }
    if (hotel.to <= hotel.from) return 'a hotel stay needs at least one night'
  }
  const mode = TRAVEL_MODES.find((item) => item.value === detail.travelMode)
  if (mode?.ticketed && detail.tickets.length === 0) return `add the ${mode.label} ticket booking`
  for (const ticket of detail.tickets) {
    if (!ticket.ticketNo) return 'give the ticket number'
    if (ticket.date < detail.fromDate || ticket.date > detail.toDate) {
      return 'keep the ticket date within the trip’s dates'
    }
  }
  return null
}

function toPayload(
  input: Input,
  context: {
    employeeId: string
    ignoreId: string | null
    records: readonly StoredStandardRequest[]
  },
): Response | Record<string, unknown> {
  if (!input.purpose) return invalid('Give the purpose of the travel.', { purpose: 'Required' })
  if (input.extensionNo && !/^\d{1,6}$/.test(input.extensionNo)) {
    return invalid('The extension is up to 6 digits.', { extensionNo: 'Up to 6 digits' })
  }
  if (input.alternativePhone && !PHONE.test(input.alternativePhone)) {
    return invalid('Give a phone number.', { alternativePhone: 'Give a phone number' })
  }
  if (input.advanceRequired && input.advances.length === 0) {
    return invalid('Add the advance you need.', { advances: 'Add the advance you need' })
  }
  const unknown = input.advances.find(
    (item) => !CURRENCIES.some(([code]) => code === item.currency),
  )
  if (unknown) return invalid('Choose the currency.', { advances: 'Choose the currency' })
  if (input.details.length === 0) {
    return invalid('Add at least one travel detail.', { details: 'Add at least one travel detail' })
  }
  const details = [...input.details].sort((a, b) =>
    `${a.fromDate}T${a.fromTime}`.localeCompare(`${b.fromDate}T${b.fromTime}`),
  )
  for (const [index, detail] of details.entries()) {
    const problem = legProblem(detail)
    if (problem) {
      const message = `Detail ${String(index + 1)} (${detail.departureFrom || '…'} to ${detail.arrivalAt || '…'}): ${problem}.`
      return invalid(message, { details: message })
    }
    const previous = details[index - 1]
    if (
      previous &&
      `${detail.fromDate}T${detail.fromTime}` < `${previous.toDate}T${previous.toTime}`
    ) {
      const message = `Detail ${String(index + 1)} leaves before detail ${String(index)} arrives.`
      return invalid(message, { details: message })
    }
  }
  const payload: TravelStored = {
    purpose: input.purpose,
    extensionNo: input.extensionNo,
    alternativePhone: input.alternativePhone,
    description: input.description,
    advanceRequired: input.advanceRequired,
    advances: input.advanceRequired ? input.advances : [],
    details: details.map((detail) => ({
      ...detail,
      hotels: detail.stayRequired
        ? detail.hotels.map((hotel) => ({ ...hotel, nights: nightsBetween(hotel.from, hotel.to) }))
        : [],
    })),
    application: input.application,
  }
  const trip = span(payload)
  const clash = context.records.find((record) => {
    if (record.id === context.ignoreId || record.employeeId !== context.employeeId) return false
    if (!['pending', 'completed', 'cancelling'].includes(record.status)) return false
    const other = span(stored(record))
    return other.start < trip.end && other.end > trip.start
  })
  if (clash) {
    const message = `${clash.code} already covers travel at these times.`
    return invalid(message, { details: message })
  }
  return payload as unknown as Record<string, unknown>
}

const label = (list: readonly { value: string; label: string }[], value: string) =>
  list.find((item) => item.value === value)?.label ?? value

const profileOf = (employeeId: string) => requestEmployee(mustFind(employeeId))
const uniqueSorted = (values: (string | null)[]) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort()

// --- seeds ------------------------------------------------------------------------------------------

const iso = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd')

interface LegSeed {
  from: string
  to: string
  mode: TravelDetailStored['travelMode']
  distance: number | null
  start: number
  days: number
  type?: TravelDetailStored['travelType']
  hotel?: { name: string; city: string; phone: string; email: string }
  ticket?: { no: string; ticketClass: string }
}

function leg(key: string, seed: LegSeed): TravelDetailStored {
  const fromDate = iso(seed.start)
  const toDate = iso(seed.start + seed.days)
  return {
    id: `${key}_leg`,
    travelType: seed.type ?? 'domestic',
    departureFrom: seed.from,
    arrivalAt: seed.to,
    travelMode: seed.mode,
    distanceKm: seed.distance,
    fromDate,
    fromTime: '09:00',
    toDate,
    toTime: '18:00',
    stayRequired: Boolean(seed.hotel),
    hotels: seed.hotel
      ? [
          {
            id: `${key}_hotel`,
            stayType: 'hotel',
            address: seed.hotel.name,
            from: fromDate,
            to: toDate,
            nights: seed.days,
            city: seed.hotel.city,
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
            ticketClass: seed.ticket.ticketClass,
            departureFrom: seed.from,
            arrivalAt: seed.to,
            date: fromDate,
            time: '07:30',
            attachment: null,
            description: '',
          },
        ]
      : [],
  }
}

/** A short application in the editor's layout, as Regenerate would write it. */
function seedLetter(employeeId: string, purpose: string, detail: TravelDetailStored): string {
  const name = mustFind(employeeId).name
  return [
    `<p>Subject: Travel Request from ${detail.departureFrom} to ${detail.arrivalAt}</p>`,
    '<p>Dear Sir/Madam,</p>',
    `<p>I would like to request approval to travel from ${detail.departureFrom} to ${detail.arrivalAt} from ${detail.fromDate} to ${detail.toDate}. ${purpose}</p>`,
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
  settingsType: 'travel',
  codePrefix: 'TR-',
  codeDigits: 4,
  schema,
  toPayload,
  dateOf: (payload) => (payload as unknown as TravelStored).details[0]?.fromDate ?? '',
  present: (payload) => {
    const value = payload as unknown as TravelStored
    const trip = span(value)
    return {
      ...value,
      advances: value.advances.map((item) => ({
        ...item,
        currencyLabel: currencyLabel(item.currency),
      })),
      details: value.details.map((detail) => ({
        ...detail,
        travelTypeLabel: label(TRAVEL_TYPES, detail.travelType),
        travelModeLabel: label(TRAVEL_MODES, detail.travelMode),
        hotels: detail.hotels.map((hotel) => ({
          ...hotel,
          stayTypeLabel: label(STAY_TYPES, hotel.stayType),
        })),
      })),
      departure: trip.start,
      arrival: trip.end,
    }
  },
  filters: {
    code: (record, value) => record.code.toLowerCase().includes(value.trim().toLowerCase()),
    location: (record, value) => profileOf(record.employeeId).location === value,
    branch: (record, value) => profileOf(record.employeeId).branch === value,
  },
  lookups: () => ({
    travelTypes: TRAVEL_TYPES,
    travelModes: TRAVEL_MODES,
    stayTypes: STAY_TYPES,
    currencies: CURRENCIES.map(([code]) => ({ value: code, label: currencyLabel(code) })),
    locations: uniqueSorted(DIRECTORY.map((employee) => profileOf(employee.id).location)),
    branches: uniqueSorted(DIRECTORY.map((employee) => profileOf(employee.id).branch)),
  }),
  seed: () => {
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
    const make = (
      key: string,
      employeeId: string,
      purpose: string,
      legs: LegSeed[],
      status: StoredStandardRequest['status'],
      options: {
        approvedSteps?: number
        daysAgo?: number
        advance?: number
        cancelReason?: string
      } = {},
    ) => {
      const details = legs.map((item, index) => leg(`${key}_${String(index)}`, item))
      const first = details[0]
      const payload: TravelStored = {
        purpose,
        extensionNo: String(100 + Number(key.slice(-1))).padStart(3, '0'),
        alternativePhone: '0300-1234567',
        description: '',
        advanceRequired: options.advance !== undefined,
        advances:
          options.advance !== undefined
            ? [{ id: `${key}_adv`, amount: options.advance, currency: 'PKR' }]
            : [],
        details,
        application: first ? seedLetter(employeeId, purpose, first) : '',
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
      mode: 'own-car',
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
        [toLahore(8, 2)],
        'pending',
        {
          daysAgo: 1,
          advance: 25_000,
        },
      ),
      make(
        '002',
        'em_haroon',
        'Client workshop on the new release.',
        [
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
        ],
        'pending',
        { daysAgo: 2, advance: 60_000 },
      ),
      make(
        '003',
        'em_rehan',
        'Mobile app launch with the partner bank.',
        [
          {
            from: 'Lahore',
            to: 'Islamabad',
            mode: 'train',
            distance: 375,
            start: 12,
            days: 1,
            ticket: { no: 'GR-7781', ticketClass: 'Business' },
          },
        ],
        'pending',
        { approvedSteps: 1, daysAgo: 2 },
      ),
      make(
        '004',
        'em_omer',
        'Quarterly audit at the Lahore office.',
        [toLahore(-12, 2)],
        'completed',
        {
          daysAgo: 20,
          advance: 15_000,
        },
      ),
      make(
        '005',
        'em_laiba',
        'Training on the new payroll rules.',
        [toLahore(15, 1)],
        'cancelling',
        {
          daysAgo: 6,
          cancelReason: 'The training moved online.',
        },
      ),
      make(
        '006',
        'em_shelley',
        'HR leadership summit.',
        [
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
        ],
        'pending',
        { daysAgo: 1, advance: 1_500 },
      ),
      make(
        '007',
        'em_shelley',
        'Branch visit for the annual reviews.',
        [{ from: 'Lahore', to: 'Islamabad', mode: 'pool-car', distance: 375, start: -30, days: 1 }],
        'completed',
        { daysAgo: 40 },
      ),
      make(
        '008',
        'em_mahnoor',
        'Design conference.',
        [
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
        ],
        'rejected',
        { daysAgo: 4 },
      ),
      make(
        '009',
        'em_zainab',
        'Vendor meeting.',
        [{ from: 'Lahore', to: 'Sialkot', mode: 'taxi', distance: 130, start: -5, days: 0 }],
        'cancelled',
        { daysAgo: 15, cancelReason: 'The vendor came to us.' },
      ),
    ]
  },
}

export const travelServer = defineStandardKind(def)
