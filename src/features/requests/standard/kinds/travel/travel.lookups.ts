import { lookupsApi } from '../../../api/lookups.api'
import { CURRENCY_OPTIONS, STAY_TYPES, TRAVEL_MODES, TRAVEL_TYPES } from './travel.constants'
import type { TravelLookups } from './travel.types'

/**
 * The travel form's choices: the API's fixed travel types, modes and stay
 * types, the currencies, and locations and branches for the Filters
 * (`GET /organisation/lookups/{locations,branches}`).
 */
export async function loadTravelLookups(signal?: AbortSignal): Promise<TravelLookups> {
  const [locations, branches] = await Promise.all([
    lookupsApi.org('locations', undefined, signal).catch(() => []),
    lookupsApi.org('branches', undefined, signal).catch(() => []),
  ])
  return {
    travelTypes: [...TRAVEL_TYPES],
    travelModes: [...TRAVEL_MODES],
    stayTypes: [...STAY_TYPES],
    currencies: [...CURRENCY_OPTIONS],
    locations: locations.map(({ id, name }) => ({ id, name })),
    branches: branches.map(({ id, name }) => ({ id, name })),
  }
}
