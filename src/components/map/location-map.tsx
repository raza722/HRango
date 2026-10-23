import 'leaflet/dist/leaflet.css'

import { useEffect, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents, ZoomControl } from 'react-leaflet'
import { divIcon, type LeafletMouseEvent, type Marker as LeafletMarker } from 'leaflet'

import { cn } from '@/lib/utils'

import { MapStyleToggle } from './map-style-toggle'
import { TILES, useMapHousekeeping } from './map-tiles'
import { type Coordinates, DEFAULT_MAP_CENTER, type LocationMapProps, type MapStyle } from './types'

/** Red map pin drawn as SVG, so no marker image files are needed. */
const pinIcon = divIcon({
  className: 'location-map-pin',
  html: `<svg width="30" height="40" viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M15 39C15 39 28 24.8 28 14.5C28 7.04 22.18 1 15 1C7.82 1 2 7.04 2 14.5C2 24.8 15 39 15 39Z" fill="#E5294B" stroke="#ffffff" stroke-width="2"/>
    <circle cx="15" cy="14.5" r="5" fill="#ffffff"/>
  </svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 39],
})

const toLatLng = (value: Coordinates): [number, number] => [value.latitude, value.longitude]
const round = (value: number) => Math.round(value * 1e6) / 1e6

/** Clicks set the pin; the wheel only zooms once the map has focus (no scroll trap). */
function MapBehaviour({
  disabled,
  onPick,
}: {
  disabled: boolean
  onPick: (value: Coordinates) => void
}) {
  const map = useMapEvents({
    click: (event: LeafletMouseEvent) => {
      if (!disabled)
        onPick({ latitude: round(event.latlng.lat), longitude: round(event.latlng.lng) })
    },
  })

  useMapHousekeeping(map)

  return null
}

/** Brings the pin into view when it is moved from outside (search, typed coordinates). */
function FollowPin({ value }: { value: Coordinates | null }) {
  const map = useMap()
  const latitude = value?.latitude
  const longitude = value?.longitude

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return
    const target: [number, number] = [latitude, longitude]
    if (map.getZoom() < 13 || !map.getBounds().pad(-0.1).contains(target)) {
      map.flyTo(target, Math.max(map.getZoom(), 15), { duration: 0.6 })
    }
  }, [map, latitude, longitude])

  return null
}

/**
 * Interactive map (Leaflet) with a draggable pin and a Map / Satellite switch.
 * Loaded lazily through `LocationMap` in `./index`, so Leaflet is only
 * downloaded on pages that show a map.
 */
export default function LocationMapImpl({
  value,
  onChange,
  fallbackCenter = DEFAULT_MAP_CENTER,
  disabled = false,
  label = 'Map',
  className,
}: LocationMapProps) {
  const [style, setStyle] = useState<MapStyle>('map')
  const tiles = TILES[style]
  // Only read on mount; later changes are handled by `FollowPin`.
  const [initialCenter] = useState(() => toLatLng(value ?? fallbackCenter))

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        // `isolate` keeps Leaflet's z-indexed panes below menus and dialogs.
        'relative isolate h-64 overflow-hidden rounded-md border border-input bg-muted sm:h-80 @3xl:h-[21.5rem]',
        disabled && 'opacity-60',
        className,
      )}
    >
      <MapContainer
        center={initialCenter}
        zoom={value ? 15 : 11}
        zoomControl={false}
        scrollWheelZoom={false}
        className="size-full"
      >
        <TileLayer key={style} url={tiles.url} attribution={tiles.attribution} maxZoom={19} />
        <ZoomControl position="bottomright" />
        <MapBehaviour disabled={disabled} onPick={onChange} />
        <FollowPin value={value} />
        {value && (
          <Marker
            position={toLatLng(value)}
            icon={pinIcon}
            draggable={!disabled}
            keyboard={false}
            eventHandlers={{
              dragend: (event) => {
                const { lat, lng } = (event.target as LeafletMarker).getLatLng()
                onChange({ latitude: round(lat), longitude: round(lng) })
              },
            }}
          />
        )}
      </MapContainer>

      <MapStyleToggle value={style} onChange={setStyle} />
    </div>
  )
}
