/**
 * The Payroll designs' button colours: navy Create / +Add, orange Filters and
 * Search, red On Hold and Cancel, green Save / Refresh / Import, blue Create
 * (Salary Revision, Balances), Reset and Download Excel, purple Next / Voucher.
 */
export const btn = {
  navy: 'bg-[#17263A] text-white hover:bg-[#17263A]/90 dark:bg-primary dark:hover:bg-primary/90',
  orange: 'bg-[#F2683B] text-white hover:bg-[#F2683B]/90',
  red: 'bg-[#E50141] text-white hover:bg-[#E50141]/90',
  hold: 'bg-[#EB3434] text-white hover:bg-[#EB3434]/90',
  green: 'bg-[#2CBD4D] text-white hover:bg-[#2CBD4D]/90',
  blue: 'bg-[#2F6FED] text-white hover:bg-[#2F6FED]/90',
  purple: 'bg-[#8B5CF6] text-white hover:bg-[#8B5CF6]/90',
  outline:
    'border border-[#17263A] bg-transparent text-[#17263A] hover:bg-muted dark:border-border dark:text-heading',
  history: 'bg-[#0D4DB8] text-white hover:bg-[#0D4DB8]/90',
} as const

/** Page-header buttons (+ Create, Filters, Import File…): 36px tall, Poppins Medium 12, 5px corners. */
export const toolbarButton = 'h-9 rounded-[5px] px-4 text-xs font-medium'

/** Dialog-footer buttons: Save / Cancel / Yes / No / Reset / Search (Figma: Inter Medium 16). */
export const footerButton = 'h-10 min-w-24 rounded-[4px] px-5 font-inter text-base font-medium'

/**
 * The lists' table look: grey rounded header, Poppins Medium 14 #303030
 * headings and Poppins Regular 14 #303030 cells.
 */
export const payrollTableClass =
  'text-sm sm:text-sm [&_td]:h-12 [&_td]:px-3 [&_td]:text-title [&_th]:h-10 [&_th]:bg-[#17263A]/[0.06] [&_th]:px-3 [&_th]:text-sm [&_th]:font-medium [&_th]:text-title dark:[&_th]:bg-muted [&_th:first-child]:rounded-l-md [&_th:last-child]:rounded-r-md'

/**
 * Payroll Settings tables (Pay Items, Tax, Rewards, Account Type, Banks):
 * Poppins Medium 11 #303030 headings, Poppins Regular 11 #707070 cells.
 */
export const payrollSettingsTableClass =
  'text-[0.6875rem] sm:text-[0.6875rem] [&_td]:text-grey [&_th]:text-[0.6875rem]'

/** A list's person cell: name Poppins Medium 11 #202020, code Poppins Regular 9 #707070. */
export const personNameText = 'text-[0.6875rem] font-medium text-[#202020] dark:text-heading'
export const personCodeText = 'text-[0.5625rem] font-normal text-grey'

/** Field values and placeholders in the forms (Figma: Inter Regular 14 #475569). */
export const fieldValueText = 'font-inter font-normal text-field-value'

/**
 * Type of the fields inside a Payroll / Assets / Off-boarding dialog, set on
 * the dialog so the shared `FormField`, `Input`, `Textarea` and `Select` match
 * the frames:
 * - labels Inter Regular 16 #000000 (14 on narrow dialogs, as before);
 * - the required mark Inter Regular 18 #E50141;
 * - values and placeholders Inter Regular 14 #475569 (16 on phones, which
 *   stops iOS from zooming into a focused field).
 */
export const dialogFieldType = [
  '[&_[data-slot=label]]:font-inter [&_[data-slot=label]]:font-normal [&_[data-slot=label]]:text-heading',
  '[&_[data-slot=label]]:text-sm @xl:[&_[data-slot=label]]:text-base',
  '[&_[data-slot=label]_[aria-hidden=true]]:text-lg [&_[data-slot=label]_[aria-hidden=true]]:leading-none [&_[data-slot=label]_[aria-hidden=true]]:text-[#E50141]',
  '[&_[data-slot=input]]:font-inter [&_[data-slot=input]]:text-field-value [&_[data-slot=input]]:placeholder:text-field-value',
  '[&_[data-slot=textarea]]:font-inter [&_[data-slot=textarea]]:text-field-value [&_[data-slot=textarea]]:placeholder:text-field-value',
  '[&_[data-slot=select-trigger]]:font-inter [&_[data-slot=select-trigger]]:text-field-value [&_[data-slot=select-trigger]]:data-[placeholder]:text-field-value',
].join(' ')

/** The Payroll Create form draws its labels and values larger: Inter Regular 18 and 16. */
export const dialogLargeLabels = [
  '@xl:[&_[data-slot=label]]:text-lg',
  'sm:[&_[data-slot=input]]:text-base sm:[&_[data-slot=textarea]]:text-base sm:[&_[data-slot=select-trigger]]:text-base sm:[&_[role=combobox]]:text-base',
].join(' ')
