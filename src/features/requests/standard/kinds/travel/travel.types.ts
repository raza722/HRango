/** "Hotel Bookings": where the person stays on one leg. */
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

/** "Ticket Bookings": a ticket for one leg. */
export interface TravelTicket {
  id: string
  ticketNo: string
  ticketClass: string
  departureFrom: string
  arrivalAt: string
  date: string
  /** "HH:mm". */
  time: string
  /** The file's name (the mock keeps no files). */
  attachment: string | null
  description: string
}

/** One leg of the travel ("Travel Detail Create"). */
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

export interface TravelAdvance {
  id: string
  amount: number
  /** ISO code ("PKR"). */
  currency: string
}

/** A Travel request as the client sees it. */
export interface TravelPayload {
  purpose: string
  extensionNo: string
  alternativePhone: string
  description: string
  advanceRequired: boolean
  advances: (TravelAdvance & { currencyLabel: string })[]
  /** In time order. */
  details: (TravelDetailValue & {
    travelTypeLabel: string
    travelModeLabel: string
    hotels: (TravelHotel & { stayTypeLabel: string })[]
  })[]
  /** The Application (HTML). */
  application: string
  /** "yyyy-MM-ddTHH:mm": the first leg leaves, the last one arrives. */
  departure: string
  arrival: string
}

export interface TravelInput {
  employeeId?: string
  purpose: string
  extensionNo: string
  alternativePhone: string
  description: string
  advanceRequired: boolean
  advances: TravelAdvance[]
  /** The server works the hotels' nights out again from their dates. */
  details: TravelDetailValue[]
  application: string
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
  /** For the Filters' Location and Branch. */
  locations: string[]
  branches: string[]
}
