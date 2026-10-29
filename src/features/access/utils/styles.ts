import { cn } from '@/lib/utils'

/*
 * The module's type and colours. No frame draws System Users or User Group Permissions, so the
 * screens take the look of the newer modules (Talent Management, Performance, Recruitment):
 * white cards with shadow-xs on the lavender page, Poppins, navy #17263A buttons, #D83838
 * Cancel, 8px fields with a #CFCFCF line, the faint navy table header band and small status
 * chips that always carry their text.
 */

/** Page titles: Poppins Medium 20 #303030. */
export const pageTitleClass = 'text-xl font-medium text-title'

/** Card titles: Poppins Medium 16. */
export const cardTitleClass = 'text-base font-medium text-title'

/** The white cards of a page. */
export const cardClass = 'rounded-xl bg-card shadow-xs'

/** Section cards inside a page or a tab. */
export const sectionCardClass =
  '@container rounded-[10px] border border-[#E0E0E0] bg-card dark:border-border'

/** Toolbar buttons: 36px, 5px corners. */
export const toolbarButtonClass =
  'h-9 rounded-[5px] px-4 text-xs font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ring/50'

/** Filled navy. */
export const navyButtonClass = 'bg-sidebar text-white hover:bg-sidebar/90 dark:bg-primary'

/** Outlined navy, Poppins Medium 12. */
export const outlineButtonClass =
  'border-[1.5px] border-sidebar bg-card text-sidebar hover:bg-sidebar/5 dark:border-input dark:bg-card dark:text-heading'

/** Filled red (Disable, Delete, End). */
export const dangerButtonClass = 'bg-[#D83838] text-white hover:bg-[#D83838]/90'

/** The lists: headers Medium 12 on the faint navy band, cells Regular 12, 48px rows. */
export const tableClass = cn(
  '[&_td]:h-12 [&_td]:px-3 [&_td]:text-xs [&_td]:text-[#3E3E3E] dark:[&_td]:text-heading',
  '[&_th]:h-10 [&_th]:bg-sidebar/[0.06] [&_th]:px-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-[#3E3E3E] dark:[&_th]:bg-muted dark:[&_th]:text-heading',
  '[&_th:first-child]:rounded-l-md [&_th:last-child]:rounded-r-md',
)

/** Status chips: Poppins Medium 10 in the status colour, 3px corners. */
export const chipClass =
  'inline-flex items-center justify-center gap-1 rounded-[3px] px-2 py-1 text-[0.625rem] leading-none font-medium whitespace-nowrap'

export const chipTone = {
  green: 'bg-[#2CBD4D]/[0.18] text-[#2E9E48] dark:bg-green-500/15 dark:text-green-400',
  red: 'bg-[#D83838]/[0.12] text-[#C02626] dark:bg-red-500/15 dark:text-red-300',
  amber: 'bg-[#FFF3D9] text-[#B7791F] dark:bg-amber-500/15 dark:text-amber-300',
  navy: 'bg-sidebar/[0.08] text-sidebar dark:bg-sky-500/15 dark:text-sky-300',
  violet: 'bg-[#EDE7FB] text-[#6631C7] dark:bg-violet-500/15 dark:text-violet-300',
  grey: 'bg-[#EEF1F5] text-[#5C5C5C] dark:bg-muted dark:text-field-foreground',
} as const

/** Links in a cell or a card (Poppins Medium 12, navy). */
export const linkClass =
  'rounded-sm font-medium text-[#263871] underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-sky-300'

/** Dialogs: 16px corners, 24px padding, title Poppins SemiBold 20. */
export const dialogClass = 'max-w-[41.6875rem] gap-0 rounded-2xl p-6'
export const dialogTitleClass =
  'font-sans text-xl font-semibold text-[#202020] sm:text-xl dark:text-heading'
export const dialogFieldsClass = [
  '[&_[data-slot=label]]:text-sm [&_[data-slot=label]]:font-normal [&_[data-slot=label]]:text-title',
  '[&_[data-slot=input]]:rounded-lg [&_[data-slot=input]]:border-[#CFCFCF] [&_[data-slot=input]]:text-title [&_[data-slot=input]]:placeholder:text-[#A4A4A4] dark:[&_[data-slot=input]]:border-input dark:[&_[data-slot=input]]:text-heading dark:[&_[data-slot=input]]:placeholder:text-label',
  '[&_[data-slot=textarea]]:rounded-lg [&_[data-slot=textarea]]:border-[#CFCFCF] [&_[data-slot=textarea]]:placeholder:text-[#A4A4A4] dark:[&_[data-slot=textarea]]:border-input',
  '[&_[data-slot=select-trigger]]:h-10 [&_[data-slot=select-trigger]]:rounded-lg [&_[data-slot=select-trigger]]:border-[#CFCFCF] [&_[data-slot=select-trigger]]:text-title dark:[&_[data-slot=select-trigger]]:border-input dark:[&_[data-slot=select-trigger]]:text-heading',
].join(' ')

/** Cancel (#D83838) and the action (#17263A): 48px, 8px corners, Poppins Medium 15 white. */
export const cancelButtonClass =
  'h-12 min-w-[8.75rem] rounded-lg bg-[#D83838] px-7 text-[0.9375rem] font-medium text-white hover:bg-[#D83838]/90'
export const saveButtonClass =
  'h-12 min-w-[8.75rem] rounded-lg bg-sidebar px-7 text-[0.9375rem] font-medium text-white hover:bg-sidebar/90 dark:bg-primary'

/** The navy switch when on. */
export const navySwitchClass =
  '[&_[data-slot=switch][data-state=checked]]:bg-sidebar dark:[&_[data-slot=switch][data-state=checked]]:bg-primary'

/** The detail pages' tabs: Poppins Regular 13 #5C5C5C, the current one Medium 14 navy over a bar. */
export const detailTabClass = cn(
  'relative h-12 min-w-16 shrink-0 rounded-none bg-transparent px-1 text-[0.8125rem] font-normal text-tab shadow-none hover:text-heading pointer-coarse:h-12',
  'data-[state=active]:bg-transparent data-[state=active]:text-sm data-[state=active]:font-medium data-[state=active]:text-sidebar data-[state=active]:shadow-none dark:data-[state=active]:text-heading',
  'data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:bottom-0 data-[state=active]:after:h-[2.5px] data-[state=active]:after:rounded-t-[10px] data-[state=active]:after:bg-sidebar dark:data-[state=active]:after:bg-primary',
)

/** A native select in the field look (the scope pickers of the role editor). */
export const nativeSelectClass =
  'h-9 w-full min-w-0 rounded-lg border border-[#CFCFCF] bg-card px-2 text-xs text-title outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive dark:border-input dark:text-heading pointer-coarse:h-11'
