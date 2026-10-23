import { useEffect } from 'react'
import type { Map as LeafletMap } from 'leaflet'

import type { MapStyle } from './types'

/**
 * Shared by the lazy map modules (`location-map`, `geo-fence-map`). Only
 * those import this file, so Leaflet stays out of the main bundle.
 */

/** Free tile sources standing in for the Google map in the designs. */
export const TILES: Record<MapStyle, { url: string; attribution: string }> = {
  map: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
  },
}

/**
 * The wheel only zooms once the map has focus (no scroll trap in forms), and
 * tiles keep filling the box when the container changes size.
 */
export function useMapHousekeeping(map: LeafletMap) {
  useEffect(() => {
    const container = map.getContainer()
    const enableWheel = () => map.scrollWheelZoom.enable()
    const disableWheel = () => map.scrollWheelZoom.disable()
    container.addEventListener('focus', enableWheel)
    container.addEventListener('blur', disableWheel)
    const observer = new ResizeObserver(() => {
      map.invalidateSize()
    })
    observer.observe(container)
    return () => {
      container.removeEventListener('focus', enableWheel)
      container.removeEventListener('blur', disableWheel)
      observer.disconnect()
    }
  }, [map])
}
