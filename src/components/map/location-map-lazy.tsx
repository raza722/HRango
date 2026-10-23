import { lazy, Suspense } from 'react'
import { MapPin } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { GeoFenceMapProps, LocationMapProps } from './types'

const LocationMapImpl = lazy(() => import('./location-map'))
const GeoFenceMapImpl = lazy(() => import('./geo-fence-map'))

function MapFallback({ className }: { className?: string | undefined }) {
  return (
    <div
      role="status"
      className={cn(
        'flex h-64 animate-pulse items-center justify-center gap-2 rounded-md border border-input bg-muted text-sm text-muted-foreground sm:h-80 @3xl:h-[21.5rem]',
        className,
      )}
    >
      <MapPin className="size-4" aria-hidden="true" /> Loading map…
    </div>
  )
}

/** The interactive map, code-split so Leaflet loads only where a map is shown. */
export function LocationMap(props: LocationMapProps) {
  return (
    <Suspense fallback={<MapFallback className={props.className} />}>
      <LocationMapImpl {...props} />
    </Suspense>
  )
}

/** Circle / polygon geo fence drawing map, code-split like `LocationMap`. */
export function GeoFenceMap(props: GeoFenceMapProps) {
  return (
    <Suspense fallback={<MapFallback className={props.className} />}>
      <GeoFenceMapImpl {...props} />
    </Suspense>
  )
}
