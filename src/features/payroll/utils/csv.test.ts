import { afterEach, describe, expect, it, vi } from 'vitest'

import { downloadText, toCsv } from './csv'

describe('toCsv', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(toCsv(['Name', 'Note'], [['Khan, Sara', 'said "hi"\nbye']])).toBe(
      'Name,Note\n"Khan, Sara","said ""hi""\nbye"\n',
    )
  })

  it('keeps typed formulas as text and leaves numbers alone', () => {
    expect(
      toCsv(['A'], [['=HYPERLINK("x")'], ['@SUM(A1)'], ['+cmd'], ['-5000'], [-12], ['+92 300']]),
    ).toBe('A\n"\'=HYPERLINK(""x"")"\n\'@SUM(A1)\n\'+cmd\n-5000\n-12\n+92 300\n')
  })
})

describe('downloadText', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(URL, 'createObjectURL')
    Reflect.deleteProperty(URL, 'revokeObjectURL')
  })

  it('starts a CSV with a byte order mark so spreadsheets read it as UTF-8', async () => {
    let saved: Blob | undefined
    Object.assign(URL, {
      createObjectURL: (blob: Blob) => {
        saved = blob
        return 'blob:csv'
      },
      revokeObjectURL: () => undefined,
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    downloadText('Name\nZoë\n', 'people.csv')
    if (!saved) throw new Error('Nothing saved')
    const bytes = new Uint8Array(await saved.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  })
})
