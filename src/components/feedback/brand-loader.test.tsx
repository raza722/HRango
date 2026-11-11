import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BrandLoader, BrandMark } from './brand-loader'
import { PageSpinner, Spinner } from './spinner'

describe('BrandLoader', () => {
  it('is a status named by its label, with the words under the mark', () => {
    render(<BrandLoader label="Loading the employee" showLabel />)

    const status = screen.getByRole('status', { name: 'Loading the employee' })
    expect(status).toBeVisible()
    expect(screen.getByText('Loading the employee')).not.toHaveClass('sr-only')
    // The Pegasus and its comet are decoration: nothing in them is read out.
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(status.querySelector('[aria-hidden="true"] img')).toHaveAttribute('alt', '')
  })

  it('keeps the words for screen readers only without showLabel', () => {
    render(<BrandLoader label="Loading" />)

    expect(screen.getByRole('status', { name: 'Loading' })).toBeVisible()
    expect(screen.getByText('Loading')).toHaveClass('sr-only')
  })

  it('adds the shadow and sparkles only where there is room', () => {
    const { container, rerender } = render(<BrandMark size="xs" />)
    expect(container.querySelectorAll('svg')).toHaveLength(0)

    rerender(<BrandMark size="lg" />)
    expect(container.querySelectorAll('svg')).toHaveLength(3)
  })

  it('backs Spinner and PageSpinner, which keep their labels', () => {
    render(
      <>
        <Spinner label="Loading the goal" />
        <PageSpinner label="Loading the plan" />
      </>,
    )

    expect(screen.getByRole('status', { name: 'Loading the goal' })).toBeVisible()
    expect(screen.getByRole('status', { name: 'Loading the plan' })).toBeVisible()
    expect(screen.getByText('Loading the plan')).toBeVisible()
  })
})
