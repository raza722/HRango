import { createContext, use } from 'react'

/**
 * How `FormField` places its label:
 * - `vertical` (default): label above the control.
 * - `horizontal`: label in a left column, control on the right (the Settings
 *   forms). It falls back to `vertical` when the surrounding container
 *   (`@container`, e.g. a `Card`) is narrower than `@xl` (36rem).
 *
 * Wrap a form in `<FieldLayoutContext value="horizontal">` to switch every field inside.
 */
export type FieldOrientation = 'vertical' | 'horizontal'

export const FieldLayoutContext = createContext<FieldOrientation>('vertical')

export function useFieldOrientation(): FieldOrientation {
  return use(FieldLayoutContext)
}

/** Grid for one horizontal row: a fixed label column and a flexible control column. */
export const horizontalRowClassName =
  'grid content-start gap-x-6 gap-y-2.5 @xl:grid-cols-[10rem_minmax(0,1fr)] @3xl:grid-cols-[11rem_minmax(0,1fr)]'

/**
 * Label in a horizontal row: lined up with the first line of the control
 * (40px inputs, 44px on touch screens), so tall controls such as a textarea
 * keep their label at the top.
 */
export const horizontalLabelClassName =
  'text-sm leading-snug text-heading/80 @xl:min-h-10 @xl:self-start @xl:py-2 @xl:text-[0.9375rem] pointer-coarse:@xl:min-h-11 pointer-coarse:@xl:py-2.5'
