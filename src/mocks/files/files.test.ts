import { describe, expect, it } from 'vitest'

import { configureApiClient } from '@/lib/axios'
import { uploadFile } from '@/lib/files'

import { MOCK_TOKEN_PREFIX } from '../utils'
import { mockUploadName } from './handlers'

describe('files mock', () => {
  it('accepts an upload from jsdom and remembers its name', async () => {
    configureApiClient({
      getAccessToken: () => `${MOCK_TOKEN_PREFIX}test`,
      onUnauthorized: () => undefined,
    })
    const file = new File(['hello'], 'Offer Letter.pdf', { type: 'application/pdf' })
    const uploaded = await uploadFile(file, 'requests')
    expect(uploaded).toMatchObject({
      name: 'Offer Letter.pdf',
      module: 'requests',
      extension: 'pdf',
    })
    expect(mockUploadName(uploaded.id)).toBe('Offer Letter.pdf')
  })
})
