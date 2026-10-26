import { expenseApi } from './expense.api'
import type { ExpenseLookups } from './expense.types'

/** The claim form's categories (active only); none when the caller may not file claims. */
export async function loadExpenseLookups(signal?: AbortSignal): Promise<ExpenseLookups> {
  const categories = await expenseApi.categoryOptions(signal).catch(() => [])
  return { categories }
}
