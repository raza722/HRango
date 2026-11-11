import { type ChangeEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react'

import { SEARCH_DEBOUNCE_MS } from './use-debounced-value'

export { SEARCH_DEBOUNCE_MS }

/** Trimmed text, or `undefined` for none (an empty box is no search). */
function clean(text: string | undefined): string | undefined {
  const trimmed = text?.trim()
  return trimmed === '' ? undefined : trimmed
}

/**
 * Search text that applies itself, so nobody has to press Search: `onSearch` runs once typing
 * pauses (`delayMs`), at once on Enter (or `flush`, for a Search button) and with `undefined` when
 * the box is cleared (also by the input's own clear button: an empty value counts as cleared). The same text is never sent twice, and nothing is sent while an input method
 * is still composing a word. When `value` changes from outside (Back, Reset, a link), the box
 * follows it.
 *
 * Spread `inputProps` on the `<input>`; Escape clears it.
 */
export function useSearchAsYouType({
  value,
  onSearch,
  delayMs = SEARCH_DEBOUNCE_MS,
}: {
  /** The search in force (usually the URL's `q`). */
  value: string | undefined
  onSearch: (text: string | undefined) => void
  delayMs?: number
}) {
  const [text, setText] = useState(value ?? '')
  const applied = useRef(clean(value))
  const timer = useRef<number | undefined>(undefined)
  const composing = useRef(false)
  const latest = useRef(onSearch)
  useEffect(() => {
    latest.current = onSearch
  })

  // Back, Reset or a link changed the search: show it (unless it is what was just sent).
  useEffect(() => {
    const next = clean(value)
    if (next === applied.current) return
    applied.current = next
    window.clearTimeout(timer.current)
    setText(value ?? '')
  }, [value])

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
    },
    [],
  )

  const apply = (raw: string) => {
    window.clearTimeout(timer.current)
    const next = clean(raw)
    if (next === applied.current) return
    applied.current = next
    latest.current(next)
  }

  const change = (raw: string) => {
    setText(raw)
    window.clearTimeout(timer.current)
    if (composing.current) return
    timer.current = window.setTimeout(() => {
      apply(raw)
    }, delayMs)
  }

  return {
    text,
    /** Set the text as if typed (debounced). */
    change,
    /** Run the search now with the text as it is. */
    flush: () => {
      apply(text)
    },
    /** Empty the box and drop the search now. */
    clear: () => {
      setText('')
      apply('')
    },
    inputProps: {
      value: text,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        change(event.target.value)
      },
      onCompositionStart: () => {
        composing.current = true
      },
      onCompositionEnd: (event: { currentTarget: HTMLInputElement }) => {
        composing.current = false
        change(event.currentTarget.value)
      },
      onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
        // Enter searches at once (a form around the box still submits; nothing is sent twice).
        if (event.key === 'Enter') apply(event.currentTarget.value)
        if (event.key === 'Escape' && text !== '') {
          // Clear the box, not the dialog or menu around it.
          event.stopPropagation()
          setText('')
          apply('')
        }
      },
    },
  }
}
