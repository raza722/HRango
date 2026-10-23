import { cn } from '@/lib/utils'

import { TILES } from './map-tiles'
import type { MapStyle } from './types'

const MAP_STYLE_LABELS: Record<MapStyle, string> = { map: 'Map', satellite: 'Satellite' }

/** The white "Map | Satellite" switch in the top-left corner. */
export function MapStyleToggle({
  value,
  onChange,
}: {
  value: MapStyle
  onChange: (style: MapStyle) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Map style"
      className="absolute top-3 left-3 z-[1000] flex overflow-hidden rounded-sm bg-white text-sm text-neutral-700 shadow-md"
    >
      {(Object.keys(TILES) as MapStyle[]).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => {
            onChange(option)
          }}
          className={cn(
            'h-9 px-3.5 transition-colors outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:h-10 sm:px-4',
            value === option && 'font-medium text-neutral-950',
          )}
        >
          {MAP_STYLE_LABELS[option]}
        </button>
      ))}
    </div>
  )
}
