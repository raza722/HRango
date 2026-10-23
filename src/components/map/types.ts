export interface Coordinates {
  latitude: number
  longitude: number
}

export type MapStyle = 'map' | 'satellite'

export interface LocationMapProps {
  /** Pin position; `null` shows the map without a pin. */
  value: Coordinates | null
  /** Called when the user clicks the map or drags the pin. */
  onChange: (value: Coordinates) => void
  /** Where the map opens when there is no pin yet. */
  fallbackCenter?: Coordinates
  disabled?: boolean
  /** Accessible name of the map region. */
  label?: string
  className?: string
}

export interface GeoFenceMapProps {
  shape: 'circle' | 'polygon'
  /** Circle centre. */
  center: Coordinates | null
  radiusMeters: number
  /** Polygon corners, in order. */
  points: readonly Coordinates[]
  /** A click on the map: the circle centre, or the next polygon corner. */
  onPick: (point: Coordinates) => void
  /** Fly here (a searched place). */
  focus?: Coordinates | null
  label?: string
  className?: string
}

/** Lahore: the company's head office, used when a record has no coordinates yet. */
export const DEFAULT_MAP_CENTER: Coordinates = { latitude: 31.5204, longitude: 74.3587 }
