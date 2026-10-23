import { format, isValid, parse, parseISO } from 'date-fns'

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** "Rs 55,000" as drawn. */
export const formatRs = (value: number) => `Rs ${grouped.format(Math.round(value))}`

/** "55,000" for the read-only amount fields beside an "Rs" prefix. */
export const formatAmount = (value: number) => grouped.format(value)

const toDate = (value: string) => {
  const date =
    value.length === 7
      ? parse(value, 'yyyy-MM', new Date())
      : value.length === 10
        ? parse(value, 'yyyy-MM-dd', new Date())
        : parseISO(value)
  return isValid(date) ? date : null
}

/** "August,2024" (Payrolls list). */
export const formatMonthComma = (month: string) => {
  const date = toDate(month)
  return date ? format(date, 'MMMM,yyyy') : month
}

/** "August, 2024" (filters, payslip). */
export const formatMonth = (month: string) => {
  const date = toDate(month)
  return date ? format(date, 'MMMM, yyyy') : month
}

/** "14, August 2024" (Pay Slips list). */
export const formatDayMonth = (date: string) => {
  const value = toDate(date)
  return value ? format(value, 'd, MMMM yyyy') : date
}

/** "September 15, 2024". */
export const formatLong = (date: string) => {
  const value = toDate(date)
  return value ? format(value, 'MMMM d, yyyy') : date
}

/** "15, Jan 2024" (Vouchers list). */
export const formatShort = (date: string) => {
  const value = toDate(date)
  return value ? format(value, 'd, MMM yyyy') : date
}

/** "Sat,31 Aug 2024" (the voucher form's date boxes). */
export const formatWeekday = (date: string) => {
  const value = toDate(date)
  return value ? format(value, 'EEE,d MMM yyyy') : date
}

/** "September 5, 2024 04:22 PM" (Last Running / Last Closing). */
export const formatStamp = (iso: string) => {
  const value = toDate(iso)
  return value ? format(value, 'MMMM d, yyyy hh:mm a') : iso
}

/** "Sep 5, 2024" (Employee Accounts month column). */
export const formatMonthShort = (month: string) => {
  const value = toDate(month.length === 7 ? `${month}-05` : month)
  return value ? format(value, 'MMM d, yyyy') : month
}

/** "1, January 2024" (person card joining date). */
export const formatJoining = (date: string) => {
  const value = toDate(date)
  return value ? format(value, 'd, MMMM yyyy') : '—'
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function belowThousand(value: number): string {
  const hundreds = Math.floor(value / 100)
  const rest = value % 100
  const words: string[] = []
  if (hundreds) words.push(`${ONES[hundreds] ?? ''} Hundred`)
  if (rest >= 20)
    words.push(
      `${TENS[Math.floor(rest / 10)] ?? ''}${rest % 10 ? ` ${ONES[rest % 10] ?? ''}` : ''}`,
    )
  else if (rest) words.push(ONES[rest] ?? '')
  return words.join(' ')
}

/** "Thirty Eight Thousand" (payslip "In Words"), in the international system. */
export function amountInWords(value: number): string {
  const whole = Math.floor(Math.abs(Math.round(value)))
  if (whole === 0) return 'Zero'
  const scales: [number, string][] = [
    [1_000_000_000, 'Billion'],
    [1_000_000, 'Million'],
    [1_000, 'Thousand'],
  ]
  let left = whole
  const words: string[] = []
  for (const [size, label] of scales) {
    const count = Math.floor(left / size)
    if (count) {
      words.push(`${belowThousand(count)} ${label}`)
      left %= size
    }
  }
  if (left) words.push(belowThousand(left))
  return `${value < 0 ? 'Minus ' : ''}${words.join(' ')}`
}

/** "7h" / "7h 30m" from minutes. */
export function hours(minutes: number | null): string {
  if (minutes === null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

/** "09:00 AM" from "09:00" or a local date-time. */
export function clock(value: string | null): string {
  if (!value) return '—'
  const time = value.includes('T') ? value.slice(11, 16) : value
  const date = parse(time, 'HH:mm', new Date())
  return isValid(date) ? format(date, 'hh:mm a') : value
}

/** "TS-00001-Morning Work (09:00 AM to 05:00 PM)". */
export const slotLabel = (slot: {
  code: string
  name: string
  clockIn: string
  clockOut: string
}) => `${slot.code}-${slot.name} (${clock(slot.clockIn)} to ${clock(slot.clockOut)})`
