import { useEffect, useRef, useState } from 'react'

/** Search text that calls `onChange` once typing pauses. */
export function useDebouncedSearch(onChange: (value: string) => void) {
  const [text, setText] = useState('')
  const timer = useRef<number | undefined>(undefined)
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
    },
    [],
  )
  return {
    text,
    set: (value: string) => {
      setText(value)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        onChange(value.trim())
      }, 300)
    },
  }
}
