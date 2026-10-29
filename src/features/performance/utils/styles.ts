import { cn } from '@/lib/utils'

/*
 * The module's type and colours. No frame draws Performance, so it takes the look of the newer
 * modules (Talent Management, Leaves, Benefits): white cards with shadow-xs on the lavender page,
 * Poppins, navy #17263A buttons, #D83838 Cancel, 8px fields with a #CFCFCF line, the faint navy
 * table header band and the small pale status chips.
 */

/** Page titles: Poppins Medium 20 #303030. */
export const pageTitleClass = 'text-xl font-medium text-title'

/** Card titles ("My Goals", "Check-in History"): Poppins Medium 16. */
export const cardTitleClass = 'text-base font-medium text-title'

/** The white cards of a page. */
export const cardClass = 'rounded-xl bg-card shadow-xs'

/** Toolbar buttons: 36px, 5px corners. */
export const toolbarButtonClass =
  'h-9 rounded-[5px] font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ring/50'

/** Filled navy. */
export const navyButtonClass = 'bg-sidebar text-white hover:bg-sidebar/90 dark:bg-primary'

/** Outlined navy, Poppins Medium 14. */
export const outlineButtonClass =
  'border-[1.5px] border-sidebar bg-card text-sm text-sidebar hover:bg-sidebar/5 dark:border-input dark:text-heading'

/** The lists: headers Medium 12 on the faint navy band, cells Regular 12, 48px rows. */
export const tableClass = cn(
  '[&_td]:h-12 [&_td]:px-3 [&_td]:text-xs [&_td]:text-[#3E3E3E] dark:[&_td]:text-heading',
  '[&_th]:h-10 [&_th]:bg-sidebar/[0.06] [&_th]:px-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-[#3E3E3E] dark:[&_th]:bg-muted dark:[&_th]:text-heading',
  '[&_th:first-child]:rounded-l-md [&_th:last-child]:rounded-r-md',
)

/** Status chips: Poppins Medium 10 in the status colour, 3px corners. */
export const chipClass =
  'inline-flex min-w-[3.6875rem] items-center justify-center gap-1 rounded-[3px] px-2 py-1 text-[0.625rem] leading-none font-medium whitespace-nowrap'

/** Section cards inside a page or a detail view. */
export const sectionCardClass =
  '@container rounded-[10px] border border-[#E0E0E0] bg-card dark:border-border'

/** Links in a cell or a card foot (Poppins Medium 12, navy). */
export const linkClass =
  'rounded-sm text-xs font-medium text-[#263871] underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-sky-300'

/** Dialogs: 16px corners, 24px padding, title Poppins SemiBold 20. */
export const dialogClass = 'max-w-[41.6875rem] gap-0 rounded-2xl p-6'
export const wideDialogClass = 'max-w-[60rem] gap-0 rounded-2xl p-0'
export const dialogTitleClass =
  'font-sans text-xl font-semibold text-[#202020] sm:text-xl dark:text-heading'
export const dialogFieldsClass = [
  '[&_[data-slot=label]]:text-sm [&_[data-slot=label]]:font-normal [&_[data-slot=label]]:text-title',
  '[&_[data-slot=input]]:rounded-lg [&_[data-slot=input]]:border-[#CFCFCF] [&_[data-slot=input]]:text-title [&_[data-slot=input]]:placeholder:text-[#A4A4A4] dark:[&_[data-slot=input]]:border-input dark:[&_[data-slot=input]]:text-heading dark:[&_[data-slot=input]]:placeholder:text-label',
  '[&_[data-slot=textarea]]:rounded-lg [&_[data-slot=textarea]]:border-[#CFCFCF] [&_[data-slot=textarea]]:placeholder:text-[#A4A4A4] dark:[&_[data-slot=textarea]]:border-input',
  '[&_[data-slot=select-trigger]]:h-10 [&_[data-slot=select-trigger]]:rounded-lg [&_[data-slot=select-trigger]]:border-[#CFCFCF] [&_[data-slot=select-trigger]]:text-title dark:[&_[data-slot=select-trigger]]:border-input dark:[&_[data-slot=select-trigger]]:text-heading',
].join(' ')

/** Cancel (#D83838) and Save (#17263A): 48px, 8px corners, Poppins Medium 15 white. */
export const cancelButtonClass =
  'h-12 min-w-[8.75rem] rounded-lg bg-[#D83838] px-7 text-[0.9375rem] font-medium text-white hover:bg-[#D83838]/90'
export const saveButtonClass =
  'h-12 min-w-[8.75rem] rounded-lg bg-sidebar px-7 text-[0.9375rem] font-medium text-white hover:bg-sidebar/90 dark:bg-primary'
export const secondaryButtonClass =
  'h-12 min-w-[8.75rem] rounded-lg border-[1.5px] border-sidebar bg-card px-7 text-[0.9375rem] font-medium text-sidebar hover:bg-sidebar/5 dark:border-input dark:text-heading'

/** The navy switch when on. */
export const navySwitchClass =
  '[&_[data-slot=switch][data-state=checked]]:bg-sidebar dark:[&_[data-slot=switch][data-state=checked]]:bg-primary'
