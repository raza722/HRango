import { cn } from '@/lib/utils'

/**
 * Text styles of the Settings → Control Panel frames in Figma (Branch Create, Location Create,
 * Job Title), all Inter. The shared form and layout components are styled from outside,
 * through `className`.
 */

/** The card title ("Branch Create", "Job Title"): Inter Medium 20 #000. */
const cardTitleScope =
  '[&_[data-slot=card-title]]:font-medium sm:[&_[data-slot=card-title]]:text-xl'

export const settingsType = {
  /**
   * On a form card: Inter; labels Inter Regular 16 #000 (14 while the labels sit above the
   * fields); the required mark Inter Medium 20 #E50141; values and placeholders Inter Regular
   * 16, placeholders #707070.
   */
  form: cn(
    'font-inter',
    '[&_[data-slot=label]]:text-heading @xl:[&_[data-slot=label]]:text-base',
    '[&_[data-slot=label]_[aria-hidden=true]]:text-xl [&_[data-slot=label]_[aria-hidden=true]]:leading-none [&_[data-slot=label]_[aria-hidden=true]]:font-medium [&_[data-slot=label]_[aria-hidden=true]]:text-[#E50141] dark:[&_[data-slot=label]_[aria-hidden=true]]:text-destructive',
    'sm:[&_[aria-invalid]]:text-base',
    '[&_[aria-invalid]]:placeholder:text-grey [&_[aria-invalid][data-placeholder]]:text-grey',
  ),
  /**
   * On a list card (`PaginatedTableCard`, built from the Warning list card): Inter, the title
   * Inter Medium 20 #000, table header Inter Semi Bold 16.2 #1E293B and cells Inter Regular
   * 16.2 #1E293B, as in the Warning frames.
   */
  listCard: cn(
    'font-inter',
    cardTitleScope,
    '[&_th]:text-[1.0125rem] [&_th]:font-semibold [&_th]:text-foreground',
    '[&_td]:text-[1.0125rem] [&_td:not([colspan])]:text-foreground',
  ),
  /** `RowActionsMenu` items, as in the Warning lists: Inter Regular 14.2 #1E293B. */
  rowMenuItem: 'font-inter text-[0.8875rem] text-foreground',
  /** "Search Location": Inter Regular 14 #B4B5B6. */
  locationSearchInput: 'placeholder:text-[#B4B5B6] dark:placeholder:text-label',
} as const
