// The sums behind a plan, shared by the form (live totals) and the mock API. They follow the
// server's pricing (`mp` procedures): a new position's month is (max salary + allowance) x
// headcount; an existing employee's is monthly salary + allowance; a year is the month times the
// calendar months from start to end, both counted.

/** Calendar months from one month to another, both counted ("2024-01" → "2024-03" = 3). */
export function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.slice(0, 7).split('-').map(Number)
  const [toYear, toMonth] = to.slice(0, 7).split('-').map(Number)
  if (
    fromYear === undefined ||
    fromMonth === undefined ||
    toYear === undefined ||
    toMonth === undefined ||
    [fromYear, fromMonth, toYear, toMonth].some((part) => !Number.isFinite(part))
  ) {
    return 0
  }
  return Math.max(0, (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1)
}

/** A new position's Total Salary: the top of its range plus its allowances, a month, per head. */
export const newLineMonthly = (line: {
  maxSalary: number
  totalAllowance: number
  headcount?: number
}) => (line.maxSalary + line.totalAllowance) * (line.headcount ?? 1)

export const newLineAnnual = (line: {
  maxSalary: number
  totalAllowance: number
  headcount?: number
  fromMonth: string
  toMonth: string
}) => newLineMonthly(line) * monthsBetween(line.fromMonth, line.toMonth)

/** An existing position's month: salary plus allowances. */
export const existingLineMonthly = (line: { monthlySalary: number; totalAllowance: number }) =>
  line.monthlySalary + line.totalAllowance

/** Annual Gross Salary: the month times the months from its start date to its end date. */
export const existingLineAnnual = (line: {
  monthlySalary: number
  totalAllowance: number
  startDate: string
  endDate: string
}) => existingLineMonthly(line) * monthsBetween(line.startDate, line.endDate)

interface PlanLines {
  newPositions: readonly Parameters<typeof newLineAnnual>[0][]
  existingPositions: readonly Parameters<typeof existingLineAnnual>[0][]
}

/** Monthly Amount: every planned position's month added up. */
export const planMonthly = (plan: PlanLines) =>
  plan.newPositions.reduce((sum, line) => sum + newLineMonthly(line), 0) +
  plan.existingPositions.reduce((sum, line) => sum + existingLineMonthly(line), 0)

/** Annual Amount: each position's month times the months it is planned for. */
export const planAnnual = (plan: PlanLines) =>
  plan.newPositions.reduce((sum, line) => sum + newLineAnnual(line), 0) +
  plan.existingPositions.reduce((sum, line) => sum + existingLineAnnual(line), 0)

/** A number from a form box ("1,500" → 1500); NaN when it is not one. */
export function toAmount(value: string | number | undefined): number {
  if (typeof value === 'number') return value
  const text = (value ?? '').replace(/,/g, '').trim()
  if (text === '') return Number.NaN
  const number = Number(text)
  return Number.isFinite(number) ? number : Number.NaN
}

/** `toAmount`, with 0 for a blank or bad box (live totals). */
export const amountOr0 = (value: string | number | undefined) => {
  const number = toAmount(value)
  return Number.isFinite(number) ? number : 0
}

/** `toAmount`, with `undefined` for a blank box (the API then uses its default). */
export const amountOrUndefined = (value: string | undefined) => {
  const number = toAmount(value)
  return Number.isFinite(number) ? number : undefined
}

/** `yyyy-MM` → its first day; `yyyy-MM-dd` stays. */
export const monthStart = (month: string) => (month.length === 7 ? `${month}-01` : month)

/** `yyyy-MM` → its last day ("2024-02" → "2024-02-29"). */
export function monthEnd(month: string): string {
  const [year, value] = month.slice(0, 7).split('-').map(Number)
  if (year === undefined || value === undefined || !Number.isFinite(year + value)) return month
  const last = new Date(Date.UTC(year, value, 0)).getUTCDate()
  return `${month.slice(0, 7)}-${String(last).padStart(2, '0')}`
}
