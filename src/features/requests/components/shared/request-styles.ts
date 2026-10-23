/**
 * Type of the Requests list frames (Punch, Shift, Transfer), Poppins family.
 * See docs/figma-typography.md.
 */

/** Punch Request Create / Edit (Poppins frame): title Poppins SemiBold 20 #202020. */
export const punchDialogTitleClass =
  'font-sans text-lg font-semibold text-[#202020] sm:text-xl dark:text-heading'

/** Its Save / Cancel: Poppins Medium 16 white. */
export const punchDialogButtonClass = 'min-w-24 px-5 text-base font-medium'

/**
 * Its fields (put on the dialog): labels Poppins Regular 14 #303030, the
 * required mark #D80027, values Poppins Regular 14 #17263A, placeholders
 * Poppins Regular 14 #A4A4A4.
 */
export const punchFieldsClass = [
  '[&_label[data-slot=label]]:text-title [&_label[data-slot=label]_[aria-hidden=true]]:text-[#D80027] dark:[&_label[data-slot=label]_[aria-hidden=true]]:text-destructive',
  '[&_input]:text-sidebar [&_textarea]:text-sidebar [&_[role=combobox]:not([data-placeholder])]:text-sidebar [&_button[aria-haspopup=dialog]]:text-sidebar dark:[&_input]:text-heading dark:[&_textarea]:text-heading dark:[&_[role=combobox]:not([data-placeholder])]:text-heading dark:[&_button[aria-haspopup=dialog]]:text-heading',
  '[&_input]:placeholder:text-[#A4A4A4] [&_textarea]:placeholder:text-[#A4A4A4] [&_button[data-placeholder]]:text-[#A4A4A4] [&_button>span.text-label]:text-[#A4A4A4] dark:[&_input]:placeholder:text-label dark:[&_textarea]:placeholder:text-label dark:[&_button[data-placeholder]]:text-label dark:[&_button>span.text-label]:text-label',
].join(' ')

/**
 * The Shift Request form (Inter frame; put on the form): labels Inter Regular
 * 16 #000, the required mark Inter Regular 16 #D80027, values and placeholders
 * Inter Regular 14 #475569.
 */
export const shiftFieldsClass = [
  '[&_[data-slot=label]]:font-inter [&_[data-slot=label]]:text-base [&_[data-slot=label]]:text-heading',
  '[&_[data-slot=label]_[aria-hidden=true]]:text-[#D80027] dark:[&_[data-slot=label]_[aria-hidden=true]]:text-destructive',
  '[&_input]:font-inter [&_textarea]:font-inter [&_[role=combobox]]:font-inter [&_button[aria-haspopup=dialog]]:font-inter',
  '[&_input]:text-field-value [&_textarea]:text-field-value [&_[role=combobox]]:text-field-value [&_button[aria-haspopup=dialog]]:text-field-value [&_button[data-placeholder]]:text-field-value [&_button>span.text-label]:text-field-value [&_input]:placeholder:text-field-value [&_textarea]:placeholder:text-field-value',
].join(' ')

/** Page and list titles ("Punch Request", "Transfer Approvals"): Poppins Medium 20 #303030. */
export const requestTitleClass = 'text-xl font-medium text-title'

/**
 * The Punch and Shift tables: grey rounded header in Poppins Medium 11
 * #303030, cells Poppins Regular 12 #707070.
 */
export const requestTableClass =
  'text-xs sm:text-xs [&_td]:h-11 [&_td]:px-2.5 [&_td]:text-grey [&_th]:h-10 [&_th]:bg-muted [&_th]:px-2.5 [&_th]:text-[0.6875rem] [&_th]:font-medium [&_th]:text-title [&_th:first-child]:rounded-l-md [&_th:last-child]:rounded-r-md'

/**
 * The Transfer tables: the same type (the frames draw 9px cells; 12 as in
 * Punch, for readability) on the record-page kit's row sizes.
 */
export const transferTableClass =
  'text-xs sm:text-xs [&_td]:h-12 [&_td]:px-3 [&_td]:text-grey [&_th]:h-10 [&_th]:bg-[#17263A]/[0.06] [&_th]:px-3 [&_th]:text-[0.6875rem] [&_th]:font-medium [&_th]:text-title dark:[&_th]:bg-muted [&_th:first-child]:rounded-l-md [&_th:last-child]:rounded-r-md'

/** Request / Approvals and the status tabs: Poppins Regular 13 #5C5C5C; the current one Poppins Medium 14 #17263A. */
export const tabText = {
  base: 'text-[0.8125rem]',
  idle: 'text-tab hover:text-title',
  current: 'text-sm font-medium text-sidebar dark:text-heading',
} as const

/** "+ Create": Poppins Medium 12 white. */
export const createButtonText = 'text-xs font-medium'

/** Outlined "Filter" and "All Requests ⌄": Poppins Medium 14 #17263A. */
export const outlinedControlText = 'text-sm font-medium text-sidebar dark:text-heading'

/** Status chips: Poppins Medium 10 in the status colour. */
export const chipText = 'font-sans text-[0.625rem] font-medium'

/**
 * Person cell: name Poppins Medium 11 #505050, code Poppins Regular 9 #707070
 * (the Requests frames draw 9 / 7px; 11 / 9 as in the other modules).
 */
export const personNameText = 'text-[0.6875rem] font-medium text-person'
export const personCodeText = 'text-[0.5625rem] text-grey'
