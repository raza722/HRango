import { cn } from '@/lib/utils'

/*
 * Type and colours of the Leaves frames (4428:89943, 4428:90071, 4428:90230),
 * Poppins throughout like the Requests lists (docs/figma-typography.md).
 */

/** Page titles ("My Leaves", "Leave Applications", "Settings"): Poppins Medium 20 #303030. */
export const leaveTitleClass = 'text-xl font-medium text-title'

/**
 * The lists: headers Poppins Medium 11 #303030 on the faint navy band (6px
 * corners), cells Poppins Regular 11 #707070, rows 41px apart.
 */
export const leaveTableClass = cn(
  'text-[0.6875rem] sm:text-[0.6875rem] [&_td]:h-[2.5625rem] [&_td]:px-3 [&_td]:text-grey [&_th]:h-10 [&_th]:bg-sidebar/[0.06] [&_th]:px-3 [&_th]:text-[0.6875rem] [&_th]:font-medium [&_th]:text-title',
  'dark:[&_th]:bg-muted [&_th:first-child]:rounded-l-md [&_th:last-child]:rounded-r-md',
)

/** The toolbar buttons: 36px tall, 5px corners. */
export const leaveToolbarClass =
  'h-9 rounded-[5px] font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ring/50'

/** "+ Apply Leave": Poppins Medium 12 white on #17263A, 30px side padding. */
export const leaveNavyButtonClass = 'bg-sidebar text-white hover:bg-sidebar/90 dark:bg-primary'

/** Outlined "Filter" and "All Requests ⌄": 1.5px #17263A, Poppins Medium 14 #17263A. */
export const leaveOutlineButtonClass =
  'border-[1.5px] border-sidebar bg-card text-sm text-sidebar hover:bg-sidebar/5 dark:border-input dark:text-heading'

/**
 * The Settings forms (frame 4428:90230): labels Poppins Regular 14 #303030,
 * fields 40px with 8px corners and a #CFCFCF line, placeholders #A4A4A4.
 */
export const leaveSettingsFieldsClass = [
  '[&_[data-slot=label]]:text-sm [&_[data-slot=label]]:font-normal [&_[data-slot=label]]:text-title',
  '[&_[data-slot=input]]:rounded-lg [&_[data-slot=input]]:border-[#CFCFCF] [&_[data-slot=input]]:text-title [&_[data-slot=input]]:placeholder:text-[#A4A4A4] dark:[&_[data-slot=input]]:border-input dark:[&_[data-slot=input]]:text-heading dark:[&_[data-slot=input]]:placeholder:text-label',
  '[&_[data-slot=select-trigger]]:h-10 [&_[data-slot=select-trigger]]:rounded-lg [&_[data-slot=select-trigger]]:border-[#CFCFCF] [&_[data-slot=select-trigger]]:text-title [&_[data-slot=select-trigger]]:data-[placeholder]:text-[#A4A4A4] dark:[&_[data-slot=select-trigger]]:border-input dark:[&_[data-slot=select-trigger]]:text-heading',
].join(' ')

/** Cancel (#D83838) and Save Changes (#17263A): 140 × 48, 8px corners, Poppins Medium 16 / 15 white. */
export const settingsCancelButtonClass =
  'h-12 min-w-[8.75rem] rounded-lg bg-[#D83838] px-7 text-base font-medium text-white hover:bg-[#D83838]/90'
export const settingsSaveButtonClass =
  'h-12 min-w-[8.75rem] rounded-lg bg-sidebar px-7 text-[0.9375rem] font-medium text-white hover:bg-sidebar/90 dark:bg-primary'

/** The lists' Status / Leave Encashment / Leave Policy switches: 33.6 × 16, navy when on. */
export const listSwitchClass =
  'h-4 w-[2.1rem] data-[state=checked]:bg-sidebar dark:data-[state=checked]:bg-primary'

/** The forms' switches (Add Policy, General Settings): 37.8 × 18, navy when on. */
export const formSwitchClass =
  'h-[1.125rem] w-[2.375rem] data-[state=checked]:bg-sidebar dark:data-[state=checked]:bg-primary'

/**
 * The "Add Policy" popup (frame 4428:90498, a copy of the Attendance Settings
 * dialogs): 667 wide, 16px corners, 24px padding, title Poppins SemiBold 20
 * #202020, labels Poppins Regular 14 #303030, fields 300 × 40 with 8px corners
 * and a #CFCFCF line, placeholders #A4A4A4.
 */
export const policyDialogClass = 'max-w-[41.6875rem] gap-0 rounded-2xl p-6'
export const policyDialogTitleClass = 'text-xl font-semibold text-[#202020] dark:text-heading'

/** Cancel (#D83838) and Add Policy (#17263A): 140 × 48, 8px corners, Poppins Medium 15 white. */
export const policyCancelButtonClass =
  'h-12 min-w-[8.75rem] rounded-lg bg-[#D83838] px-7 text-[0.9375rem] font-medium text-white hover:bg-[#D83838]/90'
export const policySaveButtonClass =
  'h-12 min-w-[8.75rem] rounded-lg bg-sidebar px-7 text-[0.9375rem] font-medium text-white hover:bg-sidebar/90 dark:bg-primary'

/**
 * The "Add Leave Types" popup's checkboxes: 14px squares with 2px corners and a
 * 1.2px #707070 line, navy when ticked (put on the form).
 */
export const typeCheckboxesClass =
  '[&_[data-slot=checkbox]]:size-3.5 [&_[data-slot=checkbox]]:rounded-[2px] [&_[data-slot=checkbox]]:border-grey [&_[data-slot=checkbox]_svg]:size-2.5'

/** The slab tables' boxes: Poppins 14, 8px corners, #CFCFCF line, #A4A4A4 placeholders. */
export const slabInputClass =
  'flex h-10 w-full min-w-0 rounded-lg border border-[#CFCFCF] bg-card px-4 font-sans text-sm text-title outline-none placeholder:text-[#A4A4A4] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:border-input dark:text-heading dark:placeholder:text-label'

/** "Add" under a slab table: #2975FB, 96 × 40, 4px corners, Inter Medium 16 white. */
export const slabAddButtonClass =
  'h-10 min-w-24 rounded-[4px] bg-[#2975FB] px-5 font-inter text-base font-medium text-white hover:bg-[#2975FB]/90'

/** View dialogs draw every box grey, not faded white. */
export const leaveReadOnlyClass = cn(
  '[&_[role=combobox]:disabled]:border-transparent [&_[role=combobox]:disabled]:bg-[#D9D9D9]/60 [&_[role=combobox]:disabled]:opacity-100',
  '[&_[aria-haspopup=dialog]:disabled]:border-transparent [&_[aria-haspopup=dialog]:disabled]:bg-[#D9D9D9]/60 [&_[aria-haspopup=dialog]:disabled]:opacity-100',
  '[&_input:disabled]:border-transparent [&_input:disabled]:bg-[#D9D9D9]/60 [&_input:disabled]:opacity-100',
  '[&_textarea:disabled]:border-transparent [&_textarea:disabled]:bg-[#D9D9D9]/60 [&_textarea:disabled]:opacity-100',
  'dark:[&_[aria-haspopup=dialog]:disabled]:bg-muted dark:[&_[role=combobox]:disabled]:bg-muted dark:[&_input:disabled]:bg-muted dark:[&_textarea:disabled]:bg-muted',
)
