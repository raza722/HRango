import { useRef } from 'react'

/**
 * Inside a menu, list box or dialog: focus there says nothing about where a dialog was
 * opened from (the menu item is gone once the menu closes).
 */
const TRANSIENT = '[role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"]'

let lastSteadyFocus: HTMLElement | null = null

if (typeof document !== 'undefined') {
  document.addEventListener(
    'focusin',
    (event) => {
      const target = event.target
      if (target instanceof HTMLElement && !target.closest(TRANSIENT)) lastSteadyFocus = target
    },
    true,
  )
}

/** What had focus when a dialog opened: the control itself, or the one that opened its menu. */
function opener(): HTMLElement | null {
  const active = document.activeElement
  if (active instanceof HTMLElement && active !== document.body) {
    if (!active.closest(TRANSIENT)) return active
    // A menu item: Radix labels the open menu with its trigger, which a click never focuses.
    const triggerId = active.closest('[role="menu"]')?.getAttribute('aria-labelledby')
    const trigger = triggerId ? document.getElementById(triggerId) : null
    if (trigger) return trigger
  }
  return lastSteadyFocus?.isConnected ? lastSteadyFocus : null
}

/**
 * Radix gives focus back to a dialog's `Trigger` on close, but most dialogs here open from
 * state (a row ⋮ menu, a button's onClick) and have none, so focus fell to `<body>`. These
 * handlers remember the opener when the dialog opens and focus it again when it closes;
 * a caller's own handler runs first and can still take over with `preventDefault()`.
 */
export function useReturnFocus({
  onOpenAutoFocus,
  onCloseAutoFocus,
}: {
  onOpenAutoFocus?: ((event: Event) => void) | undefined
  onCloseAutoFocus?: ((event: Event) => void) | undefined
}) {
  const returnTo = useRef<HTMLElement | null>(null)
  return {
    onOpenAutoFocus: (event: Event) => {
      returnTo.current = opener()
      onOpenAutoFocus?.(event)
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event)
      if (event.defaultPrevented) return
      const target = returnTo.current
      if (target?.isConnected) {
        event.preventDefault()
        target.focus({ preventScroll: true })
      }
    },
  }
}
