import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SEARCH_DEBOUNCE_MS, useSearchAsYouType } from './use-search-as-you-type'

function Box({
  value,
  onSearch,
}: {
  value: string | undefined
  onSearch: (text: string | undefined) => void
}) {
  const search = useSearchAsYouType({ value, onSearch })
  return <input aria-label="Search" {...search.inputProps} />
}

const box = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Search' })
const type = (text: string) => {
  fireEvent.change(box(), { target: { value: text } })
}
const wait = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('useSearchAsYouType', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('searches once typing pauses, not on every key', () => {
    const onSearch = vi.fn()
    render(<Box value={undefined} onSearch={onSearch} />)

    type('H')
    wait(100)
    type('Hi')
    wait(100)
    type('Hina ')
    expect(onSearch).not.toHaveBeenCalled()
    wait(SEARCH_DEBOUNCE_MS)
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('Hina')

    // The same words again (a space added) send nothing.
    type('Hina  ')
    wait(SEARCH_DEBOUNCE_MS)
    expect(onSearch).toHaveBeenCalledTimes(1)
  })

  it('searches at once on Enter, and clears on Escape', () => {
    const onSearch = vi.fn()
    render(<Box value={undefined} onSearch={onSearch} />)

    type('Zain')
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(onSearch).toHaveBeenLastCalledWith('Zain')
    wait(SEARCH_DEBOUNCE_MS)
    expect(onSearch).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(box(), { key: 'Escape' })
    expect(box().value).toBe('')
    expect(onSearch).toHaveBeenLastCalledWith(undefined)
  })

  it('waits for an input method to finish the word', () => {
    const onSearch = vi.fn()
    render(<Box value={undefined} onSearch={onSearch} />)

    fireEvent.compositionStart(box())
    type('ka')
    wait(SEARCH_DEBOUNCE_MS * 2)
    expect(onSearch).not.toHaveBeenCalled()
    fireEvent.compositionEnd(box(), { target: { value: 'か' } })
    wait(SEARCH_DEBOUNCE_MS)
    expect(onSearch).toHaveBeenCalledWith('か')
  })

  it('follows a search changed from outside (Back, Reset)', () => {
    const onSearch = vi.fn()
    const { rerender } = render(<Box value="Areeba" onSearch={onSearch} />)
    expect(box().value).toBe('Areeba')

    rerender(<Box value={undefined} onSearch={onSearch} />)
    expect(box().value).toBe('')
    expect(onSearch).not.toHaveBeenCalled()
  })
})
