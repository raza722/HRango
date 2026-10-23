import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'

import {
  useWarningViewPrefs,
  WARNING_TABLE_COLUMNS,
  WARNING_TABLE_IDS,
  type WarningTableId,
} from '../../store/warning-view-prefs.store'

interface ColumnPreferencesSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TABLE_TITLES: Record<WarningTableId, string> = {
  policy: 'Warning Policy',
  penalty: 'Penalty',
}

/**
 * "Column Preferences" side panel. It does not dim the page, so the tables
 * update in view as columns are switched; choices persist per user.
 */
export function ColumnPreferencesSheet({ open, onOpenChange }: ColumnPreferencesSheetProps) {
  const hiddenColumns = useWarningViewPrefs((state) => state.hiddenColumns)
  const setColumnVisible = useWarningViewPrefs((state) => state.setColumnVisible)
  const resetColumns = useWarningViewPrefs((state) => state.resetColumns)

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        overlay={false}
        // Keep the panel open while the user looks at the tables behind it.
        onInteractOutside={(event) => {
          event.preventDefault()
        }}
        className="w-80 max-w-[85vw] overflow-y-auto border-l border-border bg-card px-6 pt-12 pb-8 font-inter text-card-foreground"
      >
        <SheetTitle className="text-lg font-medium text-heading">Column Preferences</SheetTitle>
        <SheetDescription className="mt-1 text-sm text-muted-foreground">
          Choose the columns the Warning tables show. At least one stays visible.
        </SheetDescription>

        {WARNING_TABLE_IDS.map((table) => {
          const hidden = hiddenColumns[table]
          const visibleCount = WARNING_TABLE_COLUMNS[table].length - hidden.length
          return (
            <fieldset key={table} className="mt-7">
              <legend className="mb-2 text-sm font-medium text-heading">
                {TABLE_TITLES[table]}
              </legend>
              <ul className="flex flex-col">
                {WARNING_TABLE_COLUMNS[table].map((column) => {
                  const checked = !hidden.includes(column.id)
                  const id = `column-${table}-${column.id}`
                  return (
                    <li
                      key={column.id}
                      className="flex items-center gap-3 py-2 pointer-coarse:py-3"
                    >
                      <Checkbox
                        id={id}
                        checked={checked}
                        disabled={checked && visibleCount === 1}
                        onCheckedChange={(next) => {
                          setColumnVisible(table, column.id, next === true)
                        }}
                      />
                      <label htmlFor={id} className="min-w-0 truncate text-base text-heading">
                        {column.label}
                      </label>
                    </li>
                  )
                })}
              </ul>
              {hidden.length > 0 && (
                <Button
                  variant="link"
                  className="mt-1 h-auto p-0"
                  onClick={() => {
                    resetColumns(table)
                  }}
                >
                  Show all columns
                </Button>
              )}
            </fieldset>
          )
        })}
      </SheetContent>
    </Sheet>
  )
}
