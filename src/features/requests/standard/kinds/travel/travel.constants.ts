import type { TravelOption } from './travel.types'

/** The API's travel types (`TravelType`). */
export const TRAVEL_TYPES: readonly TravelOption[] = [
  { value: 'domestic', label: 'Domestic' },
  { value: 'international', label: 'International' },
]

/** The API's travel modes (`TravelMode`); a ticket is booked for the public ones. */
export const TRAVEL_MODES: readonly (TravelOption & { ticketed: boolean })[] = [
  { value: 'bus', label: 'Bus', ticketed: true },
  { value: 'train', label: 'Train', ticketed: true },
  { value: 'taxi', label: 'Taxi', ticketed: false },
  { value: 'air', label: 'Air', ticketed: true },
  { value: 'own_car', label: 'Own Car', ticketed: false },
  { value: 'pool_car', label: 'Pool Car', ticketed: false },
]

export const STAY_TYPES: readonly TravelOption[] = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'self', label: 'Self' },
]

/**
 * "Dinar - DZD ( Algeria )", as the Currency list writes them. The API takes
 * any three-letter code and has no currency list, so the screens keep this one.
 */
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

export const currencyLabel = (code: string) => {
  const entry = CURRENCIES.find(([value]) => value === code)
  return entry ? `${entry[1]} - ${entry[0]} ( ${entry[2]} )` : code
}

export const CURRENCY_OPTIONS: readonly TravelOption[] = CURRENCIES.map(([code]) => ({
  value: code,
  label: currencyLabel(code),
}))

export const optionLabel = (list: readonly TravelOption[], value: string) =>
  list.find((item) => item.value === value)?.label ?? value
