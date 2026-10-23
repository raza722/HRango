import { useId, useState } from 'react'
import { toast } from 'sonner'

import { AppDialog } from '@/components/feedback/app-dialog'
import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { type DataTableColumn, RowActionsMenu, rowMenuItemClass } from '@/components/layout'
import { type Coordinates, GeoFenceMap } from '@/components/map'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LocationSearch } from '@/features/settings'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import {
  useDeleteSetting,
  useSaveSetting,
  useSetSettingActive,
  useSettingsList,
} from '../../hooks/use-attendance-settings'
import type { AudienceCriteria, GeoFenceSetting } from '../../types/settings.types'
import {
  navyButtonClass,
  poppinsDialogTitleClass,
  poppinsFieldsClass,
  stepDialogButtonClass,
} from '../../utils/settings-styles'
import { CriteriaEditor } from './criteria-editor'
import { ActiveChip, SettingsListCard } from './settings-list'

type Shape = 'circle' | 'polygon'

/**
 * "Select Geo Fence" in two steps: draw it (Circle or Polygon, search a
 * place, click the map), then name it and choose For Shift, All Employees or
 * criteria. Reset clears the step's drawing or fields.
 */
function GeoFenceWizard({
  record,
  onClose,
}: {
  record: GeoFenceSetting | null
  onClose: () => void
}) {
  const ids = { name: useId(), radius: useId(), shape: useId() }
  const save = useSaveSetting('geoFences')
  const start = record?.shape
  const [step, setStep] = useState<1 | 2>(1)
  const [shape, setShape] = useState<Shape>(start?.type ?? 'circle')
  const [center, setCenter] = useState<Coordinates | null>(
    start?.type === 'circle' ? { latitude: start.latitude, longitude: start.longitude } : null,
  )
  const [radius, setRadius] = useState(
    start?.type === 'circle' ? String(start.radiusMeters) : '200',
  )
  const [points, setPoints] = useState<Coordinates[]>(start?.type === 'polygon' ? start.points : [])
  const [focus, setFocus] = useState<Coordinates | null>(
    start?.type === 'circle'
      ? { latitude: start.latitude, longitude: start.longitude }
      : (start?.points[0] ?? null),
  )
  const [name, setName] = useState(record?.name ?? '')
  const [forShift, setForShift] = useState(record?.forShift ?? true)
  const [allEmployees, setAllEmployees] = useState(record?.allEmployees ?? true)
  const [criteria, setCriteria] = useState<AudienceCriteria[]>(record?.criteria ?? [])
  const [error, setError] = useState<string | null>(null)
  const radiusMeters = Number(radius)

  const next = () => {
    const drawn =
      shape === 'circle'
        ? center !== null && radiusMeters >= 10 && radiusMeters <= 50_000
        : points.length >= 3
    if (!drawn) {
      setError(
        shape === 'circle'
          ? 'Click the map to place the circle, and keep the radius between 10 and 50,000 m.'
          : 'Click at least three corners on the map.',
      )
      return
    }
    setError(null)
    setStep(2)
  }

  const create = async () => {
    if (!name.trim()) {
      setError('Give the geo fence a name.')
      return
    }
    if (!allEmployees && criteria.length === 0) {
      setError('Add criteria, or tick All Employees.')
      return
    }
    try {
      await save.mutateAsync({
        id: record?.id,
        input: {
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
          forShift,
          allEmployees,
          criteria: allEmployees ? [] : criteria,
          active: record?.active ?? true,
        },
      })
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? (failure.fieldErrors.name ?? failure.message)
          : 'Could not save.',
      )
      return
    }
    onClose()
  }

  const reset = () => {
    setError(null)
    if (step === 1) {
      setCenter(null)
      setPoints([])
    } else {
      setName('')
      setForShift(true)
      setAllEmployees(true)
      setCriteria([])
    }
  }

  return (
    <AppDialog
      title={record ? `Geo Fence ${record.code}` : 'Select Geo Fence'}
      description={
        step === 1
          ? 'Step 1 of 2: draw the fence.'
          : 'Step 2 of 2: name it and choose who it applies to.'
      }
      onRequestClose={onClose}
      className={cn('max-w-4xl', poppinsFieldsClass)}
      titleClassName={poppinsDialogTitleClass}
      footer={
        step === 1 ? (
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={onClose}
              className={cn(stepDialogButtonClass, 'mr-auto text-sidebar dark:text-heading')}
            >
              Back
            </Button>
            <Button size="lg" onClick={next} className={cn(stepDialogButtonClass, navyButtonClass)}>
              Next
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setStep(1)
              }}
              className={cn(stepDialogButtonClass, 'mr-auto text-sidebar dark:text-heading')}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              size="lg"
              onClick={onClose}
              className={stepDialogButtonClass}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              disabled={save.isPending}
              onClick={() => void create()}
              className={cn(stepDialogButtonClass, navyButtonClass)}
            >
              {record ? 'Save Changes' : 'Create'}
            </Button>
          </>
        )
      }
    >
      <div className="grid gap-4">
        <div className="flex justify-end">
          <Button variant="destructive" onClick={reset} className="text-base font-medium">
            Reset
          </Button>
        </div>
        {step === 1 ? (
          <>
            <div className="grid gap-4 @xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div className="grid gap-2">
                <label htmlFor={ids.shape} className="text-sm leading-none text-title">
                  Select
                </label>
                <Select
                  value={shape}
                  onValueChange={(value) => {
                    setShape(value === 'polygon' ? 'polygon' : 'circle')
                    setCenter(null)
                    setPoints([])
                  }}
                >
                  <SelectTrigger id={ids.shape} className="w-full">
                    <SelectValue placeholder="Circle, Polygon …" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="circle">Circle</SelectItem>
                    <SelectItem value="polygon">Polygon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <LocationSearch
                onSelect={(place) => {
                  setFocus({ latitude: place.latitude, longitude: place.longitude })
                  if (shape === 'circle')
                    setCenter({ latitude: place.latitude, longitude: place.longitude })
                }}
              />
            </div>
            {shape === 'circle' && (
              <div className="grid max-w-48 gap-2">
                <label htmlFor={ids.radius} className="text-sm leading-none text-title">
                  Radius (m)
                </label>
                <Input
                  id={ids.radius}
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
            <GeoFenceMap
              shape={shape}
              center={center}
              radiusMeters={Number.isFinite(radiusMeters) ? radiusMeters : 0}
              points={points}
              focus={focus}
              onPick={(point) => {
                setError(null)
                if (shape === 'circle') {
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
          </>
        ) : (
          <>
            <div className="grid gap-4 @xl:grid-cols-[12rem_minmax(0,1fr)]">
              <div className="grid content-start gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-[#202020] dark:text-heading">
                  <Checkbox
                    checked={forShift}
                    onCheckedChange={(checked) => {
                      setForShift(checked === true)
                    }}
                  />
                  For Shift
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-[#202020] dark:text-heading">
                  <Checkbox
                    checked={allEmployees}
                    onCheckedChange={(checked) => {
                      setAllEmployees(checked === true)
                    }}
                  />
                  All Employees
                </label>
              </div>
              <div className="grid max-w-md gap-2">
                <label htmlFor={ids.name} className="text-sm leading-none text-title">
                  Name
                  <span aria-hidden="true" className="ml-1 text-destructive">
                    *
                  </span>
                </label>
                <Input
                  id={ids.name}
                  value={name}
                  maxLength={80}
                  placeholder="Enter name"
                  onChange={(event) => {
                    setName(event.target.value)
                  }}
                />
              </div>
            </div>
            <div className="border-t pt-4">
              {allEmployees ? (
                <p className="text-sm text-muted-foreground">
                  Applies to all employees. Untick All Employees to add criteria.
                </p>
              ) : (
                <CriteriaEditor value={criteria} onChange={setCriteria} />
              )}
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </AppDialog>
  )
}

const columns: DataTableColumn<GeoFenceSetting>[] = [
  { id: 'code', header: 'Code', cell: (row) => row.code, mobile: 'heading' },
  { id: 'name', header: 'Name', cell: (row) => row.name, className: 'whitespace-normal' },
  {
    id: 'forShift',
    header: 'For Shift',
    cell: (row) => (
      <span className="font-medium text-sidebar dark:text-heading">
        {row.forShift ? 'YES' : 'NO'}
      </span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => <ActiveChip active={row.active} />,
    align: 'right',
  },
]

/** Settings → Geo Fencing: the fences shifts and punches can require (shared with Scheduling). */
export function GeoFencingTab() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<{ record: GeoFenceSetting | null } | null>(null)
  const [deleting, setDeleting] = useState<GeoFenceSetting | null>(null)
  const list = useSettingsList('geoFences', { page, pageSize: 10, ...(search ? { search } : {}) })
  const remove = useDeleteSetting('geoFences')
  const setActive = useSetSettingActive('geoFences')

  return (
    <>
      <SettingsListCard
        title="Geo Fencing"
        columns={columns}
        rows={list.data?.data ?? []}
        meta={list.data?.meta}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        searchLabel="Search geo fences"
        onSearch={(text) => {
          setSearch(text)
          setPage(1)
        }}
        onPageChange={setPage}
        onCreate={() => {
          setDialog({ record: null })
        }}
        emptyText="No geo fences match."
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.poppins}
            label={`Actions for ${row.code}`}
            actions={[
              {
                label: 'View / Edit',
                onSelect: () => {
                  setDialog({ record: row })
                },
              },
              {
                label: row.active ? 'Deactivate' : 'Activate',
                onSelect: () => {
                  setActive.mutate({ id: row.id, active: !row.active })
                },
              },
              {
                label: 'Delete',
                variant: 'destructive',
                onSelect: () => {
                  setDeleting(row)
                },
              },
            ]}
          />
        )}
      />
      {dialog && (
        <GeoFenceWizard
          record={dialog.record}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete ${deleting?.code ?? 'geo fence'}`}
        description="Are you sure you want to Delete this? Shifts that use it will no longer require it."
        confirmLabel="Yes"
        cancelLabel="No"
        variant="destructive"
        onConfirm={() => {
          if (deleting) {
            remove.mutate(deleting.id, {
              onError: () => {
                toast.error('Could not delete the geo fence.')
              },
            })
          }
        }}
      />
    </>
  )
}
