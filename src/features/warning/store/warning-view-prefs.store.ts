import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

/** The two lists in the Warning module whose layout the user can adjust. */
export const WARNING_TABLE_IDS = ['policy', 'penalty'] as const
export type WarningTableId = (typeof WARNING_TABLE_IDS)[number]

/** Column ids per table, in display order, with the labels used in Column Preferences. */
export const WARNING_TABLE_COLUMNS = {
  policy: [
    { id: 'sr', label: 'Sr #' },
    { id: 'policyName', label: 'Policy Name' },
    { id: 'timeSpan', label: 'Time Span' },
    { id: 'title', label: 'Title of Warning Policy' },
    { id: 'status', label: 'Status' },
  ],
  penalty: [
    { id: 'sr', label: 'Sr #' },
    { id: 'policyName', label: 'Policy Name' },
    { id: 'rule', label: 'Warning Count' },
    { id: 'penaltyType', label: 'Penalty Type' },
    { id: 'deduction', label: 'Deduction' },
  ],
} as const satisfies Record<WarningTableId, readonly { id: string; label: string }[]>

interface WarningViewPrefsState {
  /** Hidden column ids per table (everything else is shown). */
  hiddenColumns: Record<WarningTableId, string[]>
  /** Collapsed list cards on the Warning overview. */
  collapsed: Record<WarningTableId, boolean>
}

interface WarningViewPrefsActions {
  setColumnVisible: (table: WarningTableId, columnId: string, visible: boolean) => void
  resetColumns: (table: WarningTableId) => void
  setCollapsed: (table: WarningTableId, collapsed: boolean) => void
}

const initialState: WarningViewPrefsState = {
  hiddenColumns: { policy: [], penalty: [] },
  collapsed: { policy: false, penalty: false },
}

/**
 * Per-user layout preferences for the Warning tables ("Column Preferences"
 * and the collapse chevrons). Persisted, so they survive reloads.
 */
export const useWarningViewPrefs = create<WarningViewPrefsState & WarningViewPrefsActions>()(
  persist(
    immer((set) => ({
      ...initialState,
      setColumnVisible: (table, columnId, visible) => {
        set((state) => {
          const hidden = state.hiddenColumns[table].filter((id) => id !== columnId)
          const total = WARNING_TABLE_COLUMNS[table].length
          // Always keep at least one column on screen.
          if (!visible && hidden.length + 1 >= total) return
          state.hiddenColumns[table] = visible ? hidden : [...hidden, columnId]
        })
      },
      resetColumns: (table) => {
        set((state) => {
          state.hiddenColumns[table] = []
        })
      },
      setCollapsed: (table, collapsed) => {
        set((state) => {
          state.collapsed[table] = collapsed
        })
      },
    })),
    {
      name: 'hrms-warning-view',
      // 2: columns follow the API's shapes (Status; Warning Count and Deduction for penalties).
      version: 2,
      migrate: () => initialState,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ hiddenColumns, collapsed }) => ({ hiddenColumns, collapsed }),
    },
  ),
)

export function resetWarningViewPrefs(): void {
  useWarningViewPrefs.setState(initialState)
}

/** Keeps only the columns the user has not hidden. */
export function visibleColumns<T extends { id: string }>(
  columns: readonly T[],
  hidden: readonly string[],
): T[] {
  return columns.filter((column) => !hidden.includes(column.id))
}
