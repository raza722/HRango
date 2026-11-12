import { leavesApi } from '../api/leaves.api'

/**
 * The leave year that contains today for one person, as the backend counts it (it starts in the
 * company's fiscal year start month, not always January): read from their balances, whose rows
 * carry it. Falls back to this calendar year when they have none or the read fails.
 */
export async function currentLeaveYearOf(employeeId: string): Promise<number> {
  try {
    const page = await leavesApi.balances({ employeeId, page: 1, pageSize: 1 })
    return page.data[0]?.fiscalYear ?? new Date().getFullYear()
  } catch {
    return new Date().getFullYear()
  }
}
