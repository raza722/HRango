import { cn } from '@/lib/utils'

/*
 * The module's type and colours. Custom Form has no Figma frames, so the screens use the navy
 * look of the newer modules (Talent Management, Leaves, Benefits): white cards with shadow-xs on
 * the lavender page, Poppins, navy #17263A buttons, #D83838 Cancel, 8px fields with a #CFCFCF
 * line, small pale status chips with their label.
 */

/** Page titles: Poppins Medium 20 #303030. */
export const pageTitleClass = 'text-xl font-medium text-title'

/** Card titles: Poppins Medium 16 #303030. */
export const cardTitleClass = 'text-base font-medium text-title'

/** A page's white cards. */
export const cardClass = '@container min-w-0 rounded-xl bg-card shadow-xs'

/** Toolbar buttons: 36px, 5px corners, Poppins Medium. */
export const toolbarButtonClass =
  'h-9 rounded-[5px] font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ring/50'

/** Filled navy (#17263A). */
export const navyButtonClass = 'bg-sidebar text-white hover:bg-sidebar/90 dark:bg-primary'

/** Outlined navy, Poppins Medium 12–14. */
export const outlineButtonClass =
  'border-[1.5px] border-sidebar bg-card text-sidebar hover:bg-sidebar/5 dark:border-input dark:text-heading'

/** Small square icon buttons (up, down, copy, delete on a question). */
export const iconButtonClass =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-[6px] text-[#516284] outline-none hover:bg-[#E1E7F5] focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-35 pointer-coarse:size-10 dark:text-muted-foreground dark:hover:bg-muted [&_svg]:size-4'

/** Cancel (#D83838) and Save (#17263A), as the Talent Management popups. */
export const cancelButtonClass =
  'h-11 min-w-[7.5rem] rounded-lg bg-[#D83838] px-6 text-sm font-medium text-white hover:bg-[#D83838]/90'
export const saveButtonClass =
  'h-11 min-w-[7.5rem] rounded-lg bg-sidebar px-6 text-sm font-medium text-white hover:bg-sidebar/90 dark:bg-primary'
export const secondaryButtonClass =
  'h-11 min-w-[7.5rem] rounded-lg border-[1.5px] border-sidebar bg-card px-6 text-sm font-medium text-sidebar hover:bg-sidebar/5 dark:border-input dark:text-heading'

/**
 * Tables: headers Poppins Medium 12 #3E3E3E on the faint navy band, cells Regular 12, 48px rows
 * (the Employee Record table, one size up for the longer texts).
 */
export const tableClass = cn(
  '[&_td]:h-12 [&_td]:px-3 [&_td]:text-xs [&_td]:text-[#3E3E3E] dark:[&_td]:text-heading',
  '[&_th]:h-10 [&_th]:bg-sidebar/[0.06] [&_th]:px-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-[#3E3E3E] dark:[&_th]:bg-muted dark:[&_th]:text-heading',
  '[&_th:first-child]:rounded-l-md [&_th:last-child]:rounded-r-md',
)

/** Status chips: Poppins Medium 10 in the status colour, 3px corners. */
export const chipClass =
  'inline-flex min-w-[3.6875rem] items-center justify-center gap-1 rounded-[3px] px-2 py-1 text-[0.625rem] leading-none font-medium whitespace-nowrap'

/**
 * The fields of the builder, the fill form and the dialogs: labels Regular 14 #303030, 40px
 * boxes with 8px corners and a #CFCFCF line, #A4A4A4 placeholders.
 */
export const fieldsClass = [
  '[&_[data-slot=label]]:text-sm [&_[data-slot=label]]:font-normal [&_[data-slot=label]]:text-title',
  '[&_[data-slot=input]]:rounded-lg [&_[data-slot=input]]:border-[#CFCFCF] [&_[data-slot=input]]:text-title [&_[data-slot=input]]:placeholder:text-[#A4A4A4] dark:[&_[data-slot=input]]:border-input dark:[&_[data-slot=input]]:text-heading dark:[&_[data-slot=input]]:placeholder:text-label',
  '[&_[data-slot=textarea]]:rounded-lg [&_[data-slot=textarea]]:border-[#CFCFCF] [&_[data-slot=textarea]]:placeholder:text-[#A4A4A4] dark:[&_[data-slot=textarea]]:border-input',
  '[&_[data-slot=select-trigger]]:h-10 [&_[data-slot=select-trigger]]:rounded-lg [&_[data-slot=select-trigger]]:border-[#CFCFCF] [&_[data-slot=select-trigger]]:text-title dark:[&_[data-slot=select-trigger]]:border-input dark:[&_[data-slot=select-trigger]]:text-heading',
].join(' ')

/** Put on a switch's wrapper: navy when on. */
export const navySwitchClass =
  '[&_[data-slot=switch][data-state=checked]]:bg-sidebar dark:[&_[data-slot=switch][data-state=checked]]:bg-primary'

/** Tabs (My Forms, the list's status tabs, Build / Preview): as the Talent Management tabs. */
export const tabClass = cn(
  'relative h-11 min-w-14 shrink-0 rounded-none bg-transparent px-1 text-[0.8125rem] font-normal text-tab shadow-none hover:text-heading pointer-coarse:h-11',
  'data-[state=active]:bg-transparent data-[state=active]:text-sm data-[state=active]:font-medium data-[state=active]:text-sidebar data-[state=active]:shadow-none dark:data-[state=active]:text-heading',
  'data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:bottom-0 data-[state=active]:after:h-[2.5px] data-[state=active]:after:rounded-t-[10px] data-[state=active]:after:bg-sidebar dark:data-[state=active]:after:bg-primary',
)
export const tabListClass =
  'relative flex scrollbar-thin h-auto w-full max-w-none justify-start gap-6 overflow-x-auto rounded-none border-b bg-transparent p-0'
