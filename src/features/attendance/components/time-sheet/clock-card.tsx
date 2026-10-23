import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Clock } from 'lucide-react'

import { Spinner } from '@/components/feedback/spinner'
import { Button } from '@/components/ui/button'

import { useClock, usePunchClock } from '../../hooks/use-attendance'
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

/** "Current time" card with Clock In / Clock Out for the signed-in person. */
export function ClockCard() {
  const now = useNow()
  const clock = useClock()
  const punch = usePunchClock()
  const clockedIn = clock.data?.clockedIn ?? false
  const allowed = clock.data?.allowed ?? true
  const last = clock.data?.lastPunch

  return (
    <section
      aria-label="Clock"
      className="flex w-full flex-col items-center justify-center gap-1 rounded-xl bg-card px-4 py-4 shadow-xs sm:w-60 sm:shrink-0"
    >
      <p className="text-2xl font-medium text-heading tabular-nums">{format(now, 'hh:mm:ss a')}</p>
      <p className="text-xs text-muted-foreground">Current time</p>
      <Button
        onClick={() => {
          punch.mutate()
        }}
        disabled={clock.isPending || punch.isPending || !allowed}
        className="mt-2 h-8 w-full max-w-52 bg-[#3B6FF5] text-white hover:bg-[#3B6FF5]/90"
      >
        {punch.isPending ? <Spinner className="size-4" /> : <Clock />}
        {clockedIn ? 'Clock Out' : 'Clock In'}
      </Button>
      {!allowed && (
        <p className="text-center text-[0.6875rem] text-muted-foreground">
          Punching from the dashboard is turned off in Attendance Settings.
        </p>
      )}
      {last && (
        <p className="text-[0.6875rem] text-muted-foreground">
          {last.type === 'check-in' ? 'Clocked in' : 'Clocked out'} at {formatClockTime(last.at)}
        </p>
      )}
    </section>
  )
}
