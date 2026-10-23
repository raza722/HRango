import { cn } from '@/lib/utils'

/**
 * Text styles of the Warning frames in Figma (Yearly, Warning Policy, Over Time Day), all Inter.
 * The shared layout and form components are styled from outside, through `className`.
 */

/** Card titles ("Warning Policy", "Yearly", "Penalty"): Inter Medium 20 #000. */
const cardTitleScope =
  '[&_[data-slot=card-title]]:font-medium sm:[&_[data-slot=card-title]]:text-xl'

export const warningType = {
  /** On a `PageHeader`: Inter throughout (buttons Inter Regular 14), title Inter Medium 20 #000. */
  pageHeader: 'font-inter [&_h1]:font-medium sm:[&_h1]:text-xl',
  /** On a `CardTitle` inside an Inter container. */
  cardTitle: 'font-medium sm:text-xl',
  /** On a `CollapsibleCard` / `Card` whose title is a `CardTitle`. */
  cardTitleScope,
  /**
   * On a list card (`PaginatedTableCard`): Inter, the title, table header Inter Semi Bold 16.2
   * #1E293B and cells Inter Regular 16.2 #1E293B (the empty-state cell keeps its grey).
   */
  listCard: cn(
    'font-inter',
    cardTitleScope,
    '[&_th]:text-[1.0125rem] [&_th]:font-semibold [&_th]:text-foreground',
    '[&_td]:text-[1.0125rem] [&_td:not([colspan])]:text-foreground',
  ),
  /**
   * On the policy / penalty `<form>`: Inter; field labels Inter Regular 13.2 #94A3B8; values
   * Inter Regular 14 #475569 (placeholders keep their grey); month and day chips Inter
   * Regular 13.2; the Mon … Sun circles Inter Regular 14.2, #303030 when picked.
   */
  form: cn(
    'font-inter',
    '[&_[data-slot=label]]:text-[0.825rem]',
    '[&_[aria-invalid]:not([data-placeholder])]:text-field-value',
    'sm:[&_[role=radio]]:text-[0.825rem]',
    '[&_button[aria-pressed=true]]:text-title @md:[&_button[aria-pressed]]:text-[0.8875rem]',
  ),
  /** `RowActionsMenu` items: Inter Regular 14.2 #1E293B. */
  rowMenuItem: 'font-inter text-[0.8875rem] text-foreground',
} as const
