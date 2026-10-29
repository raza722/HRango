import { cn } from '@/lib/utils'

/*
 * The module's type and colours. There is no current-style frame for Talent Management, so the
 * screens use the navy look of the Leaves and Benefits modules (Poppins, navy #17263A buttons,
 * #D83838 Cancel, 8px fields with a #CFCFCF line) with the copy, sizes and colours the Employee
 * Record frame (1091:2428) and the mobile profile frames (2423:17024 …) give.
 */

/** "Employee Record": Poppins Medium 20 #303030 (drawn 18; 20 as every list title of the app). */
export const pageTitleClass = 'text-xl font-medium text-title'

/** Card titles ("Employees", "Payroll History"): Poppins Medium 16 #303030. */
export const cardTitleClass = 'text-base font-medium text-title'

/** Toolbar buttons: 36px, 5px corners (the frame's 32px, raised for touch). */
export const toolbarButtonClass =
  'h-9 rounded-[5px] font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ring/50'

/** Filled navy (#17263A; the frame's charcoal #2A2A2A in the current shell). */
export const navyButtonClass = 'bg-sidebar text-white hover:bg-sidebar/90 dark:bg-primary'

/** Outlined navy, Poppins Medium 14. */
export const outlineButtonClass =
  'border-[1.5px] border-sidebar bg-card text-sm text-sidebar hover:bg-sidebar/5 dark:border-input dark:text-heading'

/** The 32px header icon buttons beside the title (#E1E7F5 tiles in the frame). */
export const headerIconButtonClass =
  'flex size-9 items-center justify-center rounded-[6px] bg-[#E1E7F5] text-sidebar outline-none hover:bg-[#d3dcf0] focus-visible:ring-2 focus-visible:ring-ring/50 aria-expanded:bg-[#d3dcf0] dark:bg-muted dark:text-heading [&_svg]:size-[1.1rem]'

/**
 * The Employees table: headers Poppins Medium 12 #3E3E3E on the faint navy band, cells Regular
 * 11 #3E3E3E (the frame's values), 48px rows.
 */
export const employeeTableClass = cn(
  '[&_td]:h-12 [&_td]:px-3 [&_td]:text-[0.6875rem] [&_td]:text-[#3E3E3E] dark:[&_td]:text-heading',
  '[&_th]:h-10 [&_th]:bg-sidebar/[0.06] [&_th]:px-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-[#3E3E3E] dark:[&_th]:bg-muted dark:[&_th]:text-heading',
  '[&_th:first-child]:rounded-l-md [&_th:last-child]:rounded-r-md',
)

/** The profile's small tables (Payroll History, Loan Summary, …): the same type. */
export const sectionTableClass = employeeTableClass

/** Status chips: Poppins Medium 10 in the status colour, 3px corners. */
export const chipClass =
  'inline-flex min-w-[3.6875rem] items-center justify-center rounded-[3px] px-2 py-1 text-[0.625rem] leading-none font-medium whitespace-nowrap'

/** The profile's white section cards (10px corners as the mobile cards). */
export const sectionCardClass =
  '@container rounded-[10px] border border-[#E0E0E0] bg-card dark:border-border'

/** "View History", "View More": the link at a card's foot (Poppins Medium 12, navy). */
export const sectionLinkClass =
  'rounded-sm text-xs font-medium text-[#263871] underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-sky-300'

/**
 * Dialogs (the Leaves "Add Policy" popup): 16px corners, 24px padding, title Poppins SemiBold 20
 * #202020, labels Regular 14 #303030, 40px fields with 8px corners and a #CFCFCF line.
 */
export const dialogClass = 'max-w-[41.6875rem] gap-0 rounded-2xl p-6'
export const wideDialogClass = 'max-w-[56rem] gap-0 rounded-2xl p-0'
export const dialogTitleClass =
  'font-sans text-xl font-semibold text-[#202020] sm:text-xl dark:text-heading'
export const dialogFieldsClass = [
  '[&_[data-slot=label]]:text-sm [&_[data-slot=label]]:font-normal [&_[data-slot=label]]:text-title',
  '[&_[data-slot=input]]:rounded-lg [&_[data-slot=input]]:border-[#CFCFCF] [&_[data-slot=input]]:text-title [&_[data-slot=input]]:placeholder:text-[#A4A4A4] dark:[&_[data-slot=input]]:border-input dark:[&_[data-slot=input]]:text-heading dark:[&_[data-slot=input]]:placeholder:text-label',
  '[&_[data-slot=textarea]]:rounded-lg [&_[data-slot=textarea]]:border-[#CFCFCF] [&_[data-slot=textarea]]:placeholder:text-[#A4A4A4] dark:[&_[data-slot=textarea]]:border-input',
  '[&_[data-slot=select-trigger]]:h-10 [&_[data-slot=select-trigger]]:rounded-lg [&_[data-slot=select-trigger]]:border-[#CFCFCF] [&_[data-slot=select-trigger]]:text-title [&_[data-slot=select-trigger]]:data-[placeholder]:text-[#A4A4A4] dark:[&_[data-slot=select-trigger]]:border-input dark:[&_[data-slot=select-trigger]]:text-heading',
].join(' ')

/** Cancel (#D83838) and Save (#17263A): 140 × 48, 8px corners, Poppins Medium 15 white. */
export const cancelButtonClass =
  'h-12 min-w-[8.75rem] rounded-lg bg-[#D83838] px-7 text-[0.9375rem] font-medium text-white hover:bg-[#D83838]/90'
export const saveButtonClass =
  'h-12 min-w-[8.75rem] rounded-lg bg-sidebar px-7 text-[0.9375rem] font-medium text-white hover:bg-sidebar/90 dark:bg-primary'

/** Put on a `SwitchField`'s wrapper: the switch navy when on (the frames' "In Process" switch). */
export const navySwitchClass =
  '[&_[data-slot=switch][data-state=checked]]:bg-sidebar dark:[&_[data-slot=switch][data-state=checked]]:bg-primary'

/**
 * The profile's tabs (Personal, Work, …): Poppins Regular 13 #5C5C5C, the current one Medium 14
 * navy over a 2.5px bar, as the module sub menus.
 */
export const profileTabClass = cn(
  'relative h-12 min-w-16 shrink-0 rounded-none bg-transparent px-1 text-[0.8125rem] font-normal text-tab shadow-none hover:text-heading pointer-coarse:h-12',
  'data-[state=active]:bg-transparent data-[state=active]:text-sm data-[state=active]:font-medium data-[state=active]:text-sidebar data-[state=active]:shadow-none dark:data-[state=active]:text-heading',
  'data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:bottom-0 data-[state=active]:after:h-[2.5px] data-[state=active]:after:rounded-t-[10px] data-[state=active]:after:bg-sidebar dark:data-[state=active]:after:bg-primary',
)
