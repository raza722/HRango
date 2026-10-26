import type { FileRef } from '@/lib/files'

import type { NamedRef } from '../../../types/requests.types'

// --- the API's `details` --------------------------------------------------------------------------

export type TravelType = 'domestic' | 'international'
export type TravelMode = 'bus' | 'train' | 'taxi' | 'air' | 'own_car' | 'pool_car'
export type StayType = 'hotel' | 'self'

/** One leg: from, to, mode and when it leaves and arrives (`yyyy-MM-ddTHH:mm:ss`). */
export interface TravelLegOut {
  id: string
  travelType: TravelType
  fromPlace: string
  toPlace: string
  travelMode: TravelMode
  /** Left out when empty (the API omits nulls inside these lists). */
  distanceKm?: number | null
  departAt: string
  arriveAt: string
  stayRequired: boolean
}

/** "Hotel Bookings": a stay inside the trip (the API keeps stays per request, not per leg). */
export interface TravelStayOut {
  id: string
  stayType: StayType
  address: string
  city: string
  fromDate: string
  toDate: string
  nights?: number | null
  phone: string
  email: string
}

/**
 * "Ticket Bookings": a ticket with its uploaded file. The API leaves empty
 * fields out of these lists, hence the optional keys.
 */
export interface TravelTicketOut {
  id: string
  ticketNo: string
  travelClass?: string | null
  fromPlace?: string | null
  toPlace?: string | null
  travelAt: string
  description?: string | null
  fileId?: string | null
  fileName?: string | null
  /** A signed link that expires. */
  fileUrl?: string | null
}

/** A Travel request's `details` as the API sends them (the payload of the screens). */
export interface TravelPayload {
  purpose: string
  extensionNo: string | null
  altPhone: string | null
  advanceRequired: boolean
  advances: { id: string; amount: number; currency: string }[]
  /** In time order. */
  legs: TravelLegOut[]
  stays: TravelStayOut[]
  tickets: TravelTicketOut[]
}

/** The `details` sent with POST / PUT (`TravelDetails`). */
export interface TravelDetailsInput {
  purpose: string
  extensionNo: string | null
  altPhone: string | null
  advanceRequired: boolean
  advances: { amount: number; currency: string }[]
  legs: (Omit<TravelLegOut, 'id' | 'distanceKm'> & { distanceKm: number | null })[]
  stays: (Omit<TravelStayOut, 'id' | 'nights'> & { nights: number })[]
  tickets: {
    ticketNo: string
    travelClass: string | null
    fromPlace: string | null
    toPlace: string | null
    travelAt: string
    description: string | null
    fileId: string | null
  }[]
}

// --- the form's model -----------------------------------------------------------------------------

/** "Hotel Bookings" of one leg in the Travel Detail popup. */
export interface TravelHotel {
  id: string
  stayType: string
  address: string
  from: string
  to: string
  /** The nights between From and To. */
  nights: number
  city: string
  phone: string
  email: string
}

/** "Ticket Bookings" of one leg. */
export interface TravelTicket {
  id: string
  ticketNo: string
  ticketClass: string
  departureFrom: string
  arrivalAt: string
  date: string
  /** "HH:mm". */
  time: string
  /** The uploaded ticket (`fileId` in the API). */
  file: FileRef | null
  description: string
}

/**
 * One leg of the travel ("Travel Detail Create"), with the stays and tickets
 * shown under it. The API keeps stays and tickets per request; the form puts
 * each under the leg it falls in (see `travel-codec.ts`).
 */
export interface TravelDetailValue {
  id: string
  travelType: string
  departureFrom: string
  arrivalAt: string
  travelMode: string
  distanceKm: number | null
  fromDate: string
  fromTime: string
  toDate: string
  toTime: string
  stayRequired: boolean
  hotels: TravelHotel[]
  tickets: TravelTicket[]
}

export interface TravelOption {
  value: string
  label: string
}

export interface TravelLookups {
  travelTypes: TravelOption[]
  /** `ticketed`: a ticket is booked for this mode (Ticket Bookings is required). */
  travelModes: (TravelOption & { ticketed: boolean })[]
  stayTypes: TravelOption[]
  currencies: TravelOption[]
  /** For the Filters' Location and Branch (`GET /organisation/lookups/…`). */
  locations: NamedRef[]
  branches: NamedRef[]
}
