import 'leaflet/dist/leaflet.css'

import { useEffect, useState } from 'react'
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polygon,
  TileLayer,
  useMap,
  useMapEvents,
  ZoomControl,
} from 'react-leaflet'
import type { LeafletMouseEvent } from 'leaflet'

import { cn } from '@/lib/utils'

import { MapStyleToggle } from './map-style-toggle'
import { TILES, useMapHousekeeping } from './map-tiles'
import { type Coordinates, DEFAULT_MAP_CENTER, type GeoFenceMapProps, type MapStyle } from './types'

const round = (value: number) => Math.round(value * 1e6) / 1e6
const toLatLng = (value: Coordinates): [number, number] => [value.latitude, value.longitude]

function Behaviour({ onPick }: { onPick: (point: Coordinates) => void }) {
  const map = useMapEvents({
    click: (event: LeafletMouseEvent) => {
      onPick({ latitude: round(event.latlng.lat), longitude: round(event.latlng.lng) })
    },
  })
  useMapHousekeeping(map)
  return null
}

/** Flies to a searched place. */
function FlyTo({ target }: { target: Coordinates | null | undefined }) {
  const map = useMap()
  const latitude = target?.latitude
  const longitude = target?.longitude
  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return
    map.flyTo([latitude, longitude], Math.max(map.getZoom(), 16), { duration: 0.6 })
  }, [map, latitude, longitude])
  return null
}

/**
 * "Select Geo Fence" map: a click places the circle's centre or adds a
 * polygon corner. The circle is drawn green and the polygon red, as designed.
 */
export default function GeoFenceMapImpl({
  shape,
  center,
  radiusMeters,
  points,
  onPick,
  focus,
  label = 'Geo fence map',
  className,
}: GeoFenceMapProps) {
  const [style, setStyle] = useState<MapStyle>('map')
  const tiles = TILES[style]
  const [initialCenter] = useState(() =>
    toLatLng(center ?? points[0] ?? focus ?? DEFAULT_MAP_CENTER),
  )

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'relative isolate h-72 overflow-hidden rounded-md border border-input bg-muted sm:h-80',
        className,
      )}
    >
      <MapContainer
        center={initialCenter}
        zoom={center || points.length > 0 ? 16 : 12}
        zoomControl={false}
        scrollWheelZoom={false}
        className="size-full cursor-crosshair"
      >
        <TileLayer key={style} url={tiles.url} attribution={tiles.attribution} maxZoom={19} />
        <ZoomControl position="bottomright" />
        <Behaviour onPick={onPick} />
        <FlyTo target={focus} />
        {shape === 'circle' && center && (
          <>
            <Circle
              center={toLatLng(center)}
              radius={radiusMeters}
              pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.45, weight: 2 }}
            />
            <CircleMarker
              center={toLatLng(center)}
              radius={5}
              pathOptions={{ color: '#14532d', fillColor: '#ffffff', fillOpacity: 1, weight: 2 }}
            />
          </>
        )}
        {shape === 'polygon' && points.length > 0 && (
          <>
            {points.length >= 3 && (
              <Polygon
                positions={points.map(toLatLng)}
                pathOptions={{
                  color: '#dc2626',
                  fillColor: '#ef4444',
                  fillOpacity: 0.45,
                  weight: 2,
                }}
              />
            )}
            {points.map((point, index) => (
              <CircleMarker
                key={`${point.latitude}-${point.longitude}-${index}`}
                center={toLatLng(point)}
                radius={5}
                pathOptions={{ color: '#7f1d1d', fillColor: '#ffffff', fillOpacity: 1, weight: 2 }}
              />
            ))}
          </>
        )}
      </MapContainer>
      <MapStyleToggle value={style} onChange={setStyle} />
    </div>
  )
}
