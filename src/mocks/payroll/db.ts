import { RECORD_TABLES } from './db-records'
import { RUN_TABLES } from './db-runs'
import { SETTINGS_TABLES } from './db-settings'

// The payroll mock tables, by area (settings, runs, records). Other mocks import from here.
export * from './db-records'
export * from './db-runs'
export * from './db-settings'

/** Listeners that must forget cached work when the data is reset. */
const resetHooks: (() => void)[] = []
export const onPayrollReset = (hook: () => void) => {
  resetHooks.push(hook)
}

export function resetPayrollDb(): void {
  for (const collection of [...SETTINGS_TABLES, ...RUN_TABLES, ...RECORD_TABLES]) {
    collection.reset()
  }
  for (const hook of resetHooks) hook()
}
