function splitLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line.charAt(index)
    if (char === '"') {
      if (quoted && line.charAt(index + 1) === '"') {
        current += '"'
        index += 1
      } else quoted = !quoted
    } else if (char === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
    } else current += char
  }
  cells.push(current.trim())
  return cells
}

/** The data lines of a CSV file (the header line, if any, is dropped). */
export function parseCsv(text: string, headerWord: string): string[][] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  const [first, ...rest] = lines
  if (!first) return []
  const body = first.toLowerCase().includes(headerWord.toLowerCase()) ? rest : lines
  return body.map(splitLine)
}

/**
 * Text a spreadsheet would run as a formula (`=`, `+`, `-`, `@`, tab or return first) gets a
 * leading apostrophe, so a typed answer like `=HYPERLINK(…)` stays text. Plain numbers
 * ("-5000", "+92 300") are left alone.
 */
function defuse(text: string): string {
  if (!/^[=+\-@\t\r]/.test(text)) return text
  return /^[-+]?[\d\s,.()]+$/.test(text) ? text : `'${text}`
}

const quote = (value: string | number) => {
  const text = typeof value === 'number' ? String(value) : defuse(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(
  header: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): string {
  return `${[header, ...rows].map((row) => row.map(quote).join(',')).join('\n')}\n`
}

/** A CSV starts with a byte order mark, so Excel reads it as UTF-8 (names with accents, Urdu). */
export function downloadText(text: string, fileName: string, type = 'text/csv;charset=utf-8') {
  const body = type.startsWith('text/csv') && !text.startsWith('\uFEFF') ? `\uFEFF${text}` : text
  const url = URL.createObjectURL(new Blob([body], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export const toNumber = (value: string | undefined) => {
  const number = Number((value ?? '').replace(/,/g, ''))
  return Number.isFinite(number) ? number : Number.NaN
}

export const toBoolean = (value: string | undefined) =>
  /^(yes|true|1|y)$/i.test((value ?? '').trim())
