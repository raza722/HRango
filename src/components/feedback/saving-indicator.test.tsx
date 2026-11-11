import { type MutationMeta, useMutation } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderWithQueryClient } from '@/test/test-utils'

import { SAVING_DELAY_MS, SavingIndicator } from './saving-indicator'

/** A promise the test settles when it wants the "save" to finish. */
function gate() {
  let open: () => void = () => undefined
  const promise = new Promise<void>((resolve) => {
    open = resolve
  })
  return { promise, open }
}

function SaveButton({ meta, until }: { meta?: MutationMeta; until: Promise<void> }) {
  const save = useMutation({ mutationFn: () => until, meta })
  return (
    <button
      type="button"
      onClick={() => {
        save.mutate()
      }}
    >
      Save
    </button>
  )
}

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

describe('SavingIndicator', () => {
  it('shows "Saving changes" while a save runs, after a short delay, then goes', async () => {
    const save = gate()
    const { user } = renderWithQueryClient(
      <>
        <SaveButton until={save.promise} />
        <SavingIndicator />
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))
    // A quick save never flashes the pill.
    expect(screen.queryByText('Saving changes')).not.toBeInTheDocument()
    expect(await screen.findByText('Saving changes')).toBeVisible()
    expect(screen.getByRole('status', { name: 'Saving changes' })).toBeVisible()

    save.open()
    await waitFor(
      () => {
        expect(screen.queryByText('Saving changes')).not.toBeInTheDocument()
      },
      { timeout: 2_000 },
    )
  })

  it('uses the mutation’s own words', async () => {
    const save = gate()
    const { user } = renderWithQueryClient(
      <>
        <SaveButton until={save.promise} meta={{ pendingLabel: 'Deleting the policy' }} />
        <SavingIndicator />
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Deleting the policy')).toBeVisible()
    save.open()
  })

  it('stays away for a quiet change', async () => {
    const save = gate()
    const { user } = renderWithQueryClient(
      <>
        <SaveButton until={save.promise} meta={{ quiet: true }} />
        <SavingIndicator />
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await wait(SAVING_DELAY_MS + 200)
    expect(screen.queryByText('Saving changes')).not.toBeInTheDocument()
    save.open()
  })
})
