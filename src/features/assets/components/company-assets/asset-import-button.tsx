import { useRef } from 'react'
import { toast } from 'sonner'

import { downloadText, MenuButton, parseCsv, toCsv, toNumber } from '@/features/payroll'

import { useImportAssets } from '../../hooks/use-assets'

const HEADER = [
  'Name',
  'Asset Type',
  'Identification Number',
  'Current Value',
  'Acquired Date',
  'Manufacturer',
  'Model',
] as const

const SAMPLE = toCsv(HEADER, [
  ['Laptop', 'Laptop', 'DL-7420-2201', 120000, '2026-01-15', 'Dell', 'Latitude 7420'],
  ['Mobile Phone', 'Mobile Phone', '358812090114567', 85000, '2026-02-01', 'Samsung', 'Galaxy A35'],
])

/**
 * "Import File ⌄": Assets reads a CSV (Name, Asset Type, Identification
 * Number, Current Value, Acquired Date, Manufacturer, Model); Sample File
 * downloads one to fill in.
 */
export function AssetImportButton() {
  const input = useRef<HTMLInputElement>(null)
  const importFile = useImportAssets()
  return (
    <>
      <MenuButton
        label="Import File"
        choices={[
          { key: 'assets', label: 'Assets' },
          { key: 'sample', label: 'Sample File' },
        ]}
        onChoose={(key) => {
          if (key === 'sample') downloadText(SAMPLE, 'company-assets-sample.csv')
          else input.current?.click()
        }}
      />
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        aria-label="Import assets (CSV)"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          void file.text().then(async (text) => {
            const rows = parseCsv(text, 'identification').map((cells) => {
              const value = toNumber(cells[3])
              return {
                name: cells[0] ?? '',
                assetType: cells[1] ?? '',
                identificationNumber: cells[2] ?? '',
                // A bad amount goes as 0 so the server names the line.
                currentValue: Number.isFinite(value) ? value : 0,
                acquiredDate: cells[4] ?? '',
                manufacturer: cells[5] ?? '',
                model: cells[6] ?? '',
              }
            })
            if (rows.length === 0) {
              toast.error('The file has no rows.')
              return
            }
            try {
              const result = await importFile.mutateAsync(rows)
              if (result.errors.length > 0) toast.error(result.errors.slice(0, 3).join('\n'))
            } catch {
              toast.error('The file could not be imported.')
            }
          })
        }}
      />
    </>
  )
}
