import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'

import type { FileRef } from '@/lib/files'
import { server } from '@/mocks/node'
import { apiPath } from '@/mocks/utils'
import { signIn } from '@/test/test-utils'

import { UploadField } from './upload-field'

function Field() {
  const [value, setValue] = useState<FileRef | null>(null)
  return <UploadField value={value} onChange={setValue} />
}

describe('Payroll UploadField', () => {
  it('shows how much of the file has gone up while it uploads, then the file', async () => {
    signIn()
    // Hold the upload's answer until the test has looked at the field.
    let release: () => void = () => undefined
    const answered = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.post(apiPath('/files'), async () => {
        await answered
        // Nothing returned: the files mock answers it.
      }),
    )
    const user = userEvent.setup()
    const { container } = render(<Field />)

    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (!input) throw new Error('No file input')
    await user.upload(input, new File(['payslip'], 'payslip.pdf', { type: 'application/pdf' }))

    expect(await screen.findByText(/^Uploading \d{1,3}%$/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Attach a file' })).toBeDisabled()

    release()
    expect(await screen.findByRole('link', { name: 'payslip.pdf' })).toBeVisible()
    expect(screen.queryByText(/^Uploading/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeVisible()
  })
})
