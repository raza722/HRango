import type { KeyboardEvent } from 'react'

/**
 * Arrow keys, Home and End move focus between the `[data-list-item]` buttons inside the element
 * the handler sits on (listboxes and radio groups of the wizard).
 */
export function handleListKeys(event: KeyboardEvent<HTMLElement>) {
  const keys = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End']
  if (!keys.includes(event.key)) return
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[data-list-item]:not([disabled])'),
  )
  if (items.length === 0) return
  const index = items.findIndex((item) => item === document.activeElement)
  const last = items.length - 1
  const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight'
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? last
        : forward
          ? index >= last
            ? 0
            : index + 1
          : index <= 0
            ? last
            : index - 1
  event.preventDefault()
  items[next]?.focus()
}
