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
import { Skeleton } from '@/components/ui/skeleton'
import { LocationSearch } from '@/features/settings'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import {
  useDeleteSetting,
  useSaveSetting,
  useSetSettingActive,
  useSettingsList,
  useSettingsRecord,
} from '../../hooks/use-attendance-settings'
import type { AudienceCriteria, GeoFenceSetting } from '../../types/settings.types'
import { criteriaIsEmpty, toCriteria, toTargets } from '../../utils/criteria'
import {
  navyButtonClass,
  poppinsDialogTitleClass,
  poppinsFieldsClass,
  stepDialogButtonClass,
} from '../../utils/settings-styles'
import { DateBox } from '../shared/date-box'
import { CriteriaEditor } from './criteria-editor'
import { ActiveChip, SettingsListCard } from './settings-list'

type Shape = 'circle' | 'polygon'

const PERMISSION = 'attendance.settings.geo_fencing'

const toCoordinates = (lat: number | null, lng: number | null): Coordinates | null =>
  lat === null || lng === null ? null : { latitude: lat, longitude: lng }

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
  const canSave = useCan(`${PERMISSION}.${record ? 'edit' : 'create'}`)
  const startCenter = record ? toCoordinates(record.centerLat, record.centerLng) : null
  const startPoints = (record?.polygonPoints ?? []).map((point) => ({
    latitude: point.lat,
    longitude: point.lng,
  }))
  const [step, setStep] = useState<1 | 2>(1)
  const [shape, setShape] = useState<Shape>(record?.shape ?? 'circle')
  const [center, setCenter] = useState<Coordinates | null>(startCenter)
  const [radius, setRadius] = useState(record?.radiusM ? String(record.radiusM) : '200')
  const [points, setPoints] = useState<Coordinates[]>(startPoints)
  const [focus, setFocus] = useState<Coordinates | null>(startCenter ?? startPoints[0] ?? null)
  const [name, setName] = useState(record?.name ?? '')
  const [forShift, setForShift] = useState(record?.isForShift ?? true)
  const [active, setActive] = useState(record?.isActive ?? true)
  const [allEmployees, setAllEmployees] = useState(record?.appliesToAll ?? true)
  const [criteria, setCriteria] = useState<AudienceCriteria>(() => toCriteria(record?.targets))
  const [joiningFrom, setJoiningFrom] = useState(record?.joiningFromDate ?? '')
  const [joiningTo, setJoiningTo] = useState(record?.joiningToDate ?? '')
  const [error, setError] = useState<string | null>(null)
  const radiusMeters = Number(radius)

  const next = () => {
    const drawn =
      shape === 'circle'
        ? center !== null && radiusMeters >= 10 && radiusMeters <= 100_000
        : points.length >= 3
    if (!drawn) {
      setError(
        shape === 'circle'
          ? 'Click the map to place the circle, and keep the radius between 10 and 100,000 m.'
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
    if (!allEmployees && criteriaIsEmpty(criteria) && !joiningFrom && !joiningTo) {
      setError('Add criteria, or tick All Employees.')
      return
    }
    if (joiningFrom && joiningTo && joiningTo < joiningFrom) {
      setError('The joining end date is before the start date.')
      return
    }
    const circle = shape === 'circle' ? center : null
    try {
      await save.mutateAsync({
        id: record?.id,
        input: {
          name: name.trim(),
          shape,
          centerLat: circle ? circle.latitude : null,
          centerLng: circle ? circle.longitude : null,
          radiusM: circle ? Math.round(radiusMeters) : null,
          polygonPoints: circle
            ? null
            : points.map((point) => ({ lat: point.latitude, lng: point.longitude })),
          isForShift: forShift,
          isActive: active,
          appliesToAll: allEmployees,
          joiningFromDate: allEmployees ? null : joiningFrom || null,
          joiningToDate: allEmployees ? null : joiningTo || null,
          targets: allEmployees ? [] : toTargets(criteria),
          rowVersion: record?.rowVersion ?? null,
        },
      })
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? (Object.values(failure.fieldErrors)[0] ?? failure.message)
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
      setActive(true)
      setAllEmployees(true)
      setCriteria(toCriteria(null))
      setJoiningFrom('')
      setJoiningTo('')
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
            {canSave && (
              <Button
                size="lg"
                disabled={save.isPending}
                onClick={() => void create()}
                className={cn(stepDialogButtonClass, navyButtonClass)}
              >
                {record ? 'Save Changes' : 'Create'}
              </Button>
            )}
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
                  max={100_000}
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
                <label className="flex items-center gap-2 text-xs font-medium text-[#202020] dark:text-heading">
                  <Checkbox
                    checked={active}
                    onCheckedChange={(checked) => {
                      setActive(checked === true)
                    }}
                  />
                  Active
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
                  maxLength={200}
                  placeholder="Enter name"
                  onChange={(event) => {
                    setName(event.target.value)
                  }}
                />
              </div>
            </div>
            <div className="@container grid gap-4 border-t pt-4">
              {allEmployees ? (
                <p className="text-sm text-muted-foreground">
                  Applies to all employees. Untick All Employees to add criteria.
                </p>
              ) : (
                <>
                  <CriteriaEditor
                    value={criteria}
                    onChange={setCriteria}
                    permission={`${PERMISSION}.view`}
                  />
                  <div className="grid max-w-xl gap-4 @md:grid-cols-2">
                    <DateBox
                      label="Joining Start Date"
                      variant="form"
                      value={joiningFrom}
                      onChange={setJoiningFrom}
                    />
                    <DateBox
                      label="Joining End Date"
                      variant="form"
                      value={joiningTo}
                      onChange={setJoiningTo}
                    />
                  </div>
                </>
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

/** Loads the whole fence (the list leaves its targets out), then shows the wizard. */
function GeoFenceDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const record = useSettingsRecord('geoFences', id)
  if (id === null) return <GeoFenceWizard record={null} onClose={onClose} />
  if (!record.data) {
    return (
      <AppDialog
        title="Geo Fence"
        onRequestClose={onClose}
        className="max-w-4xl"
        titleClassName={poppinsDialogTitleClass}
      >
        {record.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {record.error.message}
          </p>
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </AppDialog>
    )
  }
  return <GeoFenceWizard record={record.data} onClose={onClose} />
}

const columns: DataTableColumn<GeoFenceSetting>[] = [
  { id: 'code', header: 'Code', cell: (row) => row.code, mobile: 'heading' },
  { id: 'name', header: 'Name', cell: (row) => row.name, className: 'whitespace-normal' },
  {
    id: 'forShift',
    header: 'For Shift',
    cell: (row) => (
      <span className="font-medium text-sidebar dark:text-heading">
        {row.isForShift ? 'YES' : 'NO'}
      </span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => <ActiveChip active={row.isActive} />,
    align: 'right',
  },
]

/** Settings → Geo Fencing: the fences shifts and punches can require (shared with Scheduling). */
export function GeoFencingTab() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<{ id: string | null } | null>(null)
  const [deleting, setDeleting] = useState<GeoFenceSetting | null>(null)
  const list = useSettingsList('geoFences', {
    page,
    pageSize: 10,
    ...(search ? { q: search } : {}),
  })
  const remove = useDeleteSetting('geoFences')
  const setActive = useSetSettingActive('geoFences')
  const canCreate = useCan(`${PERMISSION}.create`)
  const canEdit = useCan(`${PERMISSION}.edit`)
  const canDelete = useCan(`${PERMISSION}.delete`)

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
        {...(canCreate
          ? {
              onCreate: () => {
                setDialog({ id: null })
              },
            }
          : {})}
        emptyText="No geo fences match."
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.poppins}
            label={`Actions for ${row.code}`}
            actions={[
              {
                label: canEdit ? 'View / Edit' : 'View',
                onSelect: () => {
                  setDialog({ id: row.id })
                },
              },
              ...(canEdit
                ? [
                    {
                      label: row.isActive ? 'Deactivate' : 'Activate',
                      onSelect: () => {
                        setActive.mutate(
                          { id: row.id, active: !row.isActive },
                          {
                            onError: (error) => {
                              toast.error(error.message)
                            },
                          },
                        )
                      },
                    },
                  ]
                : []),
              ...(canDelete
                ? [
                    {
                      label: 'Delete',
                      variant: 'destructive' as const,
                      onSelect: () => {
                        setDeleting(row)
                      },
                    },
                  ]
                : []),
            ]}
          />
        )}
      />
      {dialog && (
        <GeoFenceDialog
          id={dialog.id}
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
        description="Are you sure you want to Delete this? A fence that shifts use cannot be deleted; make it inactive instead."
        confirmLabel="Yes"
        cancelLabel="No"
        variant="destructive"
        onConfirm={() => {
          if (deleting) {
            remove.mutate(
              { id: deleting.id, rowVersion: deleting.rowVersion },
              {
                onError: (error) => {
                  toast.error(
                    error instanceof ApiError ? error.message : 'Could not delete the geo fence.',
                  )
                },
              },
            )
          }
        }}
      />
    </>
  )
}
