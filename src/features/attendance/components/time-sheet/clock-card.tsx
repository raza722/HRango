import { useEffect, useId, useState } from 'react'
import { format } from 'date-fns'
import { Camera, Clock } from 'lucide-react'
import { toast } from 'sonner'

import { Spinner } from '@/components/feedback/spinner'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { uploadFile } from '@/lib/files'

import { useClock, usePunchClock } from '../../hooks/use-attendance'
import type { ClockInput } from '../../types/attendance.types'
import { formatClockTime } from '../../utils/local-time'

/** Ticks once a second. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => {
      window.clearInterval(timer)
    }
  }, [])
  return now
}

/** The browser's position, for a geo-fenced clock in. */
function currentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This browser cannot share its location.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude })
      },
      () => {
        reject(new Error('Allow location access to clock in.'))
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    )
  })
}

/**
 * "Current time" card with Clock In / Clock Out for the signed-in person. The API decides
 * whether it is allowed (dashboard punch on, a user linked to an employee) and whether it needs
 * a picture ("Take Picture") or the location (a geo fence applies); IP limits are checked on the
 * server.
 */
export function ClockCard() {
  const now = useNow()
  const photoId = useId()
  const clock = useClock()
  const punch = usePunchClock()
  const [busy, setBusy] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const state = clock.data
  const clockedIn = state?.clockedIn ?? false
  const allowed = state?.allowed ?? true
  const pending = clock.isPending || punch.isPending || busy

  const submit = async () => {
    if (!state) return
    setBusy(true)
    try {
      const input: ClockInput = {
        punchType: state.nextPunchType === 'check_out' ? 'check_out' : 'check_in',
      }
      if (state.photoRequired) {
        if (!photo) {
          toast.error('Take a picture to clock in.')
          return
        }
        input.photoFileId = (await uploadFile(photo, 'attendance')).id
      }
      if (state.locationRequired) Object.assign(input, await currentPosition())
      await punch.mutateAsync(input)
      setPhoto(null)
    } catch (error) {
      toast.error(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Could not record the punch. Try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-label="Clock"
      className="flex w-full flex-col items-center justify-center gap-1 rounded-xl bg-card px-4 py-4 shadow-xs sm:w-60 sm:shrink-0"
    >
      <p className="text-2xl font-medium text-heading tabular-nums">{format(now, 'hh:mm:ss a')}</p>
      <p className="text-xs text-muted-foreground">Current time</p>
      {allowed && state?.photoRequired && (
        <label
          htmlFor={photoId}
          className="mt-1 flex cursor-pointer items-center gap-1.5 text-[0.6875rem] text-primary"
        >
          <Camera className="size-3.5" aria-hidden="true" />
          {photo ? photo.name : 'Take Picture'}
          <input
            id={photoId}
            type="file"
            accept="image/*"
            capture="user"
            className="sr-only"
            onChange={(event) => {
              setPhoto(event.target.files?.[0] ?? null)
            }}
          />
        </label>
      )}
      <Button
        onClick={() => void submit()}
        disabled={pending || !allowed}
        className="mt-2 h-8 w-full max-w-52 bg-[#3B6FF5] text-white hover:bg-[#3B6FF5]/90"
      >
        {pending && !clock.isPending ? <Spinner className="size-4" /> : <Clock />}
        {clockedIn ? 'Clock Out' : 'Clock In'}
      </Button>
      {!allowed && (
        <p className="text-center text-[0.6875rem] text-muted-foreground">
          {state?.reason ?? 'Punching from the dashboard is turned off in Attendance Settings.'}
        </p>
      )}
      {state?.lastPunchedAt && (
        <p className="text-[0.6875rem] text-muted-foreground">
          {state.lastPunchType === 'check_in' ? 'Clocked in' : 'Clocked out'} at{' '}
          {formatClockTime(state.lastPunchedAt)}
        </p>
      )}
    </section>
  )
}
