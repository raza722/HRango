import { useEffect, useRef, useState } from 'react'
import { useMutationState } from '@tanstack/react-query'

import { BrandMark, LoadingCaption } from './brand-loader'

/** Shown only for a change that takes this long, so quick saves do not flash it. */
export const SAVING_DELAY_MS = 250
/** Once shown it stays at least this long, so it never blinks. */
export const SAVING_MIN_VISIBLE_MS = 600

const DEFAULT_LABEL = 'Saving changes'

/** True `delay` ms after `active` turns on; once true, false no sooner than `minVisible` ms later. */
function useDelayedFlag(active: boolean, delay: number, minVisible: number) {
  const [visible, setVisible] = useState(false)
  const shownAt = useRef(0)
  useEffect(() => {
    if (active) {
      if (visible) return
      const timer = setTimeout(() => {
        shownAt.current = Date.now()
        setVisible(true)
      }, delay)
      return () => {
        clearTimeout(timer)
      }
    }
    if (!visible) return
    const left = Math.max(0, minVisible - (Date.now() - shownAt.current))
    const timer = setTimeout(() => {
      setVisible(false)
    }, left)
    return () => {
      clearTimeout(timer)
    }
  }, [active, visible, delay, minVisible])
  return visible
}

/**
 * The saving pill: while any create, edit or delete runs (every mutation but a `quiet` one), a
 * small pill at the bottom of the screen shows the Pegasus loader and "Saving changes", or the
 * mutation's `pendingLabel`. It sits above dialogs, never takes a click, and is a polite status
 * for screen readers. Mounted by the signed-in shells, not the sign-in pages.
 */
export function SavingIndicator() {
  const labels = useMutationState({
    filters: { status: 'pending', predicate: (mutation) => !mutation.meta?.quiet },
    select: (mutation) => mutation.meta?.pendingLabel,
  })
  const visible = useDelayedFlag(labels.length > 0, SAVING_DELAY_MS, SAVING_MIN_VISIBLE_MS)
  // The newest running change names the pill; kept while the pill fades out after it settles.
  const latest = labels.findLast((label) => label !== undefined)
  const [label, setLabel] = useState(DEFAULT_LABEL)
  const current = labels.length > 0 ? (latest ?? DEFAULT_LABEL) : label
  if (current !== label) setLabel(current)

  return (
    <div
      role="status"
      aria-label={visible ? label : undefined}
      className="pointer-events-none fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-[60] -translate-x-1/2"
    >
      {visible && (
        <div className="flex animate-pill-in items-center gap-2.5 rounded-full border border-border bg-card/95 py-1.5 pr-4 pl-1.5 shadow-[0_14px_36px_-14px_rgb(15_23_42/0.45)] backdrop-blur-sm motion-reduce:animate-none">
          <BrandMark size="xs" />
          <LoadingCaption label={label} className="font-medium whitespace-nowrap text-heading" />
        </div>
      )}
    </div>
  )
}
