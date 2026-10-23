import { type KeyboardEvent, useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, MapPin, Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { cn } from '@/lib/utils'

import { placesQueryOptions } from '../../api/lookups.api'
import type { GeoPlace } from '../../types/settings.types'

interface LocationSearchProps {
  onSelect: (place: GeoPlace) => void
  disabled?: boolean
  /** Extra classes for the search box, e.g. the screen's placeholder colour. */
  inputClassName?: string
}

/**
 * "Search Location": type a place, pick a suggestion, and the pin moves there.
 * An ARIA combobox: arrow keys move through suggestions, Enter picks, Escape closes.
 */
export function LocationSearch({
  onSelect,
  disabled = false,
  inputClassName,
}: LocationSearchProps) {
  const listId = useId()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const query = useDebouncedValue(text, 250)
  const places = useQuery(placesQueryOptions(query))

  const searching = query.trim().length >= 2
  const results = searching ? (places.data ?? []) : []
  const expanded = open && searching
  const activeId = activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined

  const choose = (place: GeoPlace) => {
    setText(place.label)
    setOpen(false)
    setActiveIndex(-1)
    onSelect(place)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (results.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((index) => (index + step + results.length) % results.length)
    } else if (event.key === 'Enter') {
      // Never submit the surrounding form from the search box.
      event.preventDefault()
      const place = results[activeIndex] ?? results[0]
      if (expanded && place) choose(place)
    } else if (event.key === 'Escape' && expanded) {
      event.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-label sm:left-4"
      />
      <Input
        type="search"
        role="combobox"
        aria-label="Search location"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded ? activeId : undefined}
        placeholder="Search Location"
        autoComplete="off"
        value={text}
        disabled={disabled}
        onChange={(event) => {
          setText(event.target.value)
          setOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => {
          setOpen(true)
        }}
        onBlur={() => {
          setOpen(false)
        }}
        onKeyDown={onKeyDown}
        className={cn(
          'pr-10 pl-9 sm:pl-10 [&::-webkit-search-cancel-button]:hidden',
          inputClassName,
        )}
      />
      {places.isFetching && searching && (
        <Loader2
          aria-hidden="true"
          className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-label"
        />
      )}

      <ul
        id={listId}
        role="listbox"
        aria-label="Places"
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover py-1 text-sm text-popover-foreground shadow-lg"
      >
        {results.map((place, index) => (
          <li
            key={place.id}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            // Keep focus in the input so the list does not close before the click lands.
            onMouseDown={(event) => {
              event.preventDefault()
            }}
            onClick={() => {
              choose(place)
            }}
            onMouseEnter={() => {
              setActiveIndex(index)
            }}
            className={cn(
              'flex cursor-pointer items-start gap-2.5 px-3 py-2.5',
              index === activeIndex && 'bg-accent text-accent-foreground',
            )}
          >
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span className="min-w-0">
              <span className="block truncate">{place.label}</span>
              <span className="block text-xs text-muted-foreground tabular-nums">
                {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
              </span>
            </span>
          </li>
        ))}
        {results.length === 0 && (
          <li role="presentation" className="px-3 py-3 text-muted-foreground">
            {places.isFetching || query !== text ? 'Searching…' : 'No places match that search.'}
          </li>
        )}
      </ul>
    </div>
  )
}
