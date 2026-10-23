import { useId, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'

import { dialogButtonClass } from '@/components/feedback/app-dialog'
import { type Coordinates, GeoFenceMap } from '@/components/map'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LocationSearch } from '@/features/settings'
import { ApiError } from '@/lib/api-error'

import { useCreateGeoFence } from '../../hooks/use-scheduling'
import type { GeoFence } from '../../types/scheduling.types'
import { schedulingType } from '../type-styles'
import { SchedulingDialog } from './scheduling-dialog'

interface GeoFenceDialogProps {
  onClose: () => void
  onCreated: (fence: GeoFence) => void
}

const SHAPE_LABELS = { circle: 'Circle', polygon: 'Polygon' } as const

/**
 * "Select Geo Fence": choose Circle or Polygon, find the place, click the map
 * (the circle centre, or each polygon corner), name it and save.
 */
export function GeoFenceDialog({ onClose, onCreated }: GeoFenceDialogProps) {
  const nameId = useId()
  const radiusId = useId()
  const [shape, setShape] = useState<'circle' | 'polygon'>('circle')
  const [name, setName] = useState('')
  const [center, setCenter] = useState<Coordinates | null>(null)
  const [radius, setRadius] = useState('200')
  const [points, setPoints] = useState<Coordinates[]>([])
  const [focus, setFocus] = useState<Coordinates | null>(null)
  const [error, setError] = useState<string | null>(null)
  const create = useCreateGeoFence()

  const radiusMeters = Number(radius)
  const ready =
    name.trim() !== '' &&
    (shape === 'circle'
      ? center !== null && radiusMeters >= 10 && radiusMeters <= 50_000
      : points.length >= 3)

  const reset = () => {
    setCenter(null)
    setPoints([])
    setError(null)
  }

  const save = () => {
    if (!ready) {
      setError(
        name.trim() === ''
          ? 'Give the geo fence a name.'
          : shape === 'circle'
            ? 'Click the map to place the circle, and keep the radius between 10 and 50,000 m.'
            : 'Click at least three corners on the map.',
      )
      return
    }
    create.mutate(
      {
        name: name.trim(),
        shape:
          shape === 'circle' && center
            ? {
                type: 'circle',
                latitude: center.latitude,
                longitude: center.longitude,
                radiusMeters,
              }
            : { type: 'polygon', points },
      },
      {
        onSuccess: (fence) => {
          onCreated(fence)
          onClose()
        },
        onError: (failure) => {
          setError(
            failure instanceof ApiError
              ? (failure.fieldErrors.name ?? failure.message)
              : 'Could not save.',
          )
        },
      },
    )
  }

  return (
    <SchedulingDialog
      title="Select Geo Fence"
      onRequestClose={onClose}
      className="max-w-3xl"
      footer={
        <>
          <Button
            size="lg"
            disabled={create.isPending}
            onClick={save}
            className={dialogButtonClass}
          >
            {create.isPending && <Loader2 className="animate-spin" />}
            Next
          </Button>
          <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={`Shape: ${SHAPE_LABELS[shape]}`}
                className={schedulingType.button}
              >
                {SHAPE_LABELS[shape]} <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup
                value={shape}
                onValueChange={(value) => {
                  setShape(value === 'polygon' ? 'polygon' : 'circle')
                  reset()
                }}
              >
                <DropdownMenuRadioItem value="circle">Circle</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="polygon">Polygon</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="destructive" onClick={reset} className={schedulingType.button}>
            Reset
          </Button>
          {shape === 'polygon' && points.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                setPoints((current) => current.slice(0, -1))
              }}
              className={schedulingType.button}
            >
              Undo corner
            </Button>
          )}
        </div>

        <div className="grid gap-4 @xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="grid gap-2">
            <Label htmlFor={nameId}>
              Name
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <Input
              id={nameId}
              value={name}
              maxLength={80}
              placeholder="e.g. Head Office Gulberg"
              onChange={(event) => {
                setName(event.target.value)
              }}
            />
          </div>
          {shape === 'circle' && (
            <div className="grid gap-2">
              <Label htmlFor={radiusId}>Radius (m)</Label>
              <Input
                id={radiusId}
                type="number"
                inputMode="numeric"
                min={10}
                max={50_000}
                value={radius}
                onChange={(event) => {
                  setRadius(event.target.value)
                }}
              />
            </div>
          )}
        </div>

        <LocationSearch
          inputClassName={schedulingType.locationPlaceholder}
          onSelect={(place) => {
            setFocus({ latitude: place.latitude, longitude: place.longitude })
            if (shape === 'circle')
              setCenter({ latitude: place.latitude, longitude: place.longitude })
          }}
        />
        <GeoFenceMap
          shape={shape}
          center={center}
          radiusMeters={Number.isFinite(radiusMeters) ? radiusMeters : 0}
          points={points}
          focus={focus}
          onPick={(point) => {
            setError(null)
            if (shape === 'circle') {
              // The first click zooms in so the circle can be placed precisely.
              if (!center) setFocus(point)
              setCenter(point)
            } else setPoints((current) => [...current, point])
          }}
        />
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {shape === 'circle'
            ? center
              ? `Centre ${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}. Click again to move it.`
              : 'Click the map to place the centre of the circle.'
            : `${points.length} corner${points.length === 1 ? '' : 's'}. Click the map to add corners (at least three).`}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </SchedulingDialog>
  )
}
