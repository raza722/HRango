import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Pagination } from './pagination'
import { getPageItems } from './pagination-utils'

describe('Pagination', () => {
  it('marks the current page and disables Previous on the first page', () => {
    render(<Pagination page={1} totalPages={2} onPageChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('reports the requested page', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Pagination page={1} totalPages={3} onPageChange={onPageChange} />)

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Page 3' }))

    expect(onPageChange.mock.calls).toEqual([[2], [3]])
  })
})

describe('getPageItems', () => {
  it('collapses long ranges with ellipses', () => {
    expect(getPageItems(5, 10)).toEqual([1, 'ellipsis-start', 4, 5, 6, 'ellipsis-end', 10])
    expect(getPageItems(1, 3)).toEqual([1, 2, 3])
  })
})
