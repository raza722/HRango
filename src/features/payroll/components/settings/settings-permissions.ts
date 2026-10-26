import { useCan } from '@/lib/permissions'

import { PAYROLL_CODES } from '../../constants'

type SettingsTabKey = 'general' | 'tax' | 'rewards' | 'payComponents' | 'accountTypes' | 'banks'

/**
 * What the user may do on a settings tab (`payroll.settings.<tab>.create|edit|delete`).
 * The API checks every request anyway; this only hides the buttons.
 */
export function useSettingsCan(tab: SettingsTabKey) {
  const code = PAYROLL_CODES[tab]
  return {
    create: useCan(`${code}.create`),
    edit: useCan(`${code}.edit`),
    remove: useCan(`${code}.delete`),
  }
}

/**
 * The ⋮ menu's handlers for a row, given what the user may do: Edit and Delete only with
 * their codes (and Delete only when the record can be deleted, e.g. not a system item).
 */
export function rowMenuHandlers<T>(
  may: { edit: boolean; remove: boolean },
  row: T,
  open: (state: { mode: 'edit' | 'view'; record: T }) => void,
  remove: (row: T) => void,
  deletable = true,
): { onEdit?: () => void; onView: () => void; onDelete?: () => void } {
  return {
    ...(may.edit && {
      onEdit: () => {
        open({ mode: 'edit', record: row })
      },
    }),
    onView: () => {
      open({ mode: 'view', record: row })
    },
    ...(may.remove &&
      deletable && {
        onDelete: () => {
          remove(row)
        },
      }),
  }
}
