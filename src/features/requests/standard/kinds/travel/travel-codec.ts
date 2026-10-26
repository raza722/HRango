import { differenceInCalendarDays, parse } from 'date-fns'

import type {
  StayType,
  TravelDetailsInput,
  TravelDetailValue,
  TravelLegOut,
  TravelMode,
  TravelPayload,
  TravelType,
} from './travel.types'

/*
 * The form shows each leg with its hotel and ticket bookings ("Travel Detail
 * Create"); the API keeps legs, stays and tickets as three lists of the
 * request. Sending flattens the legs' bookings; reading puts each stay under
 * the leg whose dates it falls in and each ticket under the leg it is for
 * (same from / to, else the leg running on its date), so a request made here
 * reads back as it was entered.
 */

const dateOf = (stamp: string) => stamp.slice(0, 10)
const timeOf = (stamp: string) => stamp.slice(11, 16)
const nightsBetween = (from: string, to: string) =>
  from && to
    ? differenceInCalendarDays(
        parse(to, 'yyyy-MM-dd', new Date()),
        parse(from, 'yyyy-MM-dd', new Date()),
      )
    : 0

/** The leg a booking on `date` (and from / to) belongs to. */
function legFor(
  legs: readonly TravelLegOut[],
  date: string,
  route?: { from: string | null; to: string | null },
): number {
  if (route?.from && route.to) {
    const same = legs.findIndex((leg) => leg.fromPlace === route.from && leg.toPlace === route.to)
    if (same !== -1) return same
  }
  const running = legs.findIndex(
    (leg) => dateOf(leg.departAt) <= date && date <= dateOf(leg.arriveAt),
  )
  if (running !== -1) return running
  let last = 0
  legs.forEach((leg, index) => {
    if (dateOf(leg.departAt) <= date) last = index
  })
  return last
}

/** The API's details → the form's legs with their bookings. */
export function legsOf(details: TravelPayload): TravelDetailValue[] {
  const legs = [...details.legs].sort((a, b) => a.departAt.localeCompare(b.departAt))
  const out: TravelDetailValue[] = legs.map((leg) => ({
    id: leg.id,
    travelType: leg.travelType,
    departureFrom: leg.fromPlace,
    arrivalAt: leg.toPlace,
    travelMode: leg.travelMode,
    distanceKm: leg.distanceKm ?? null,
    fromDate: dateOf(leg.departAt),
    fromTime: timeOf(leg.departAt),
    toDate: dateOf(leg.arriveAt),
    toTime: timeOf(leg.arriveAt),
    stayRequired: leg.stayRequired,
    hotels: [],
    tickets: [],
  }))
  if (out.length === 0) return out
  for (const stay of details.stays) {
    const leg = out[legFor(legs, stay.fromDate)]
    leg?.hotels.push({
      id: stay.id,
      stayType: stay.stayType,
      address: stay.address,
      from: stay.fromDate,
      to: stay.toDate,
      nights: stay.nights ?? nightsBetween(stay.fromDate, stay.toDate),
      city: stay.city,
      phone: stay.phone,
      email: stay.email,
    })
  }
  for (const ticket of details.tickets) {
    const leg =
      out[
        legFor(legs, dateOf(ticket.travelAt), {
          from: ticket.fromPlace ?? null,
          to: ticket.toPlace ?? null,
        })
      ]
    leg?.tickets.push({
      id: ticket.id,
      ticketNo: ticket.ticketNo,
      ticketClass: ticket.travelClass ?? '',
      departureFrom: ticket.fromPlace ?? '',
      arrivalAt: ticket.toPlace ?? '',
      date: dateOf(ticket.travelAt),
      time: timeOf(ticket.travelAt),
      file: ticket.fileId
        ? { id: ticket.fileId, name: ticket.fileName ?? 'Ticket', url: ticket.fileUrl ?? '' }
        : null,
      description: ticket.description ?? '',
    })
  }
  return out
}

const stamp = (date: string, time: string) => `${date}T${time}:00`
const orNull = (text: string) => (text.trim() === '' ? null : text.trim())

/** The form → the API's `details`. */
export function detailsOf(values: {
  purpose: string
  extensionNo: string
  alternativePhone: string
  advanceRequired: boolean
  advances: { amount: number; currency: string }[]
  details: readonly TravelDetailValue[]
}): TravelDetailsInput {
  const legs = [...values.details].sort((a, b) =>
    `${a.fromDate}T${a.fromTime}`.localeCompare(`${b.fromDate}T${b.fromTime}`),
  )
  return {
    purpose: values.purpose.trim(),
    extensionNo: orNull(values.extensionNo),
    altPhone: orNull(values.alternativePhone),
    advanceRequired: values.advanceRequired,
    advances: values.advanceRequired ? values.advances : [],
    legs: legs.map((leg) => ({
      travelType: leg.travelType as TravelType,
      fromPlace: leg.departureFrom.trim(),
      toPlace: leg.arrivalAt.trim(),
      travelMode: leg.travelMode as TravelMode,
      distanceKm: leg.distanceKm,
      departAt: stamp(leg.fromDate, leg.fromTime),
      arriveAt: stamp(leg.toDate, leg.toTime),
      stayRequired: leg.stayRequired,
    })),
    stays: legs.flatMap((leg) =>
      leg.stayRequired
        ? leg.hotels.map((hotel) => ({
            stayType: hotel.stayType as StayType,
            address: hotel.address.trim(),
            city: hotel.city.trim(),
            fromDate: hotel.from,
            toDate: hotel.to,
            nights: nightsBetween(hotel.from, hotel.to),
            phone: hotel.phone.trim(),
            email: hotel.email.trim(),
          }))
        : [],
    ),
    tickets: legs.flatMap((leg) =>
      leg.tickets.map((ticket) => ({
        ticketNo: ticket.ticketNo.trim(),
        travelClass: orNull(ticket.ticketClass),
        fromPlace: orNull(ticket.departureFrom),
        toPlace: orNull(ticket.arrivalAt),
        travelAt: stamp(ticket.date, ticket.time),
        description: orNull(ticket.description),
        fileId: ticket.file?.id ?? null,
      })),
    ),
  }
}

/** The trip from the first departure to the last arrival (`yyyy-MM-dd`). */
export function tripDates(details: readonly TravelDetailValue[]): { from: string; to: string } {
  const sorted = [...details].sort((a, b) =>
    `${a.fromDate}T${a.fromTime}`.localeCompare(`${b.fromDate}T${b.fromTime}`),
  )
  const to = sorted.reduce((max, leg) => (leg.toDate > max ? leg.toDate : max), '')
  return { from: sorted[0]?.fromDate ?? '', to }
}
