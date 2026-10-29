/**
 * Type and colours of the Attendance → Overtime frames (2785:14902 … 4207:75397), Poppins
 * like the other Attendance lists; the Overtime Policy popup is an Inter frame.
 */

/** The inner tabs: Poppins Regular 13 #5C5C5C; the current one Medium 14 #17263A under a 2.5px navy bar. */
export const overtimeTabClass =
  'relative flex h-[2.625rem] shrink-0 items-end px-0.5 pb-0.5 text-[0.8125rem] whitespace-nowrap text-tab outline-none hover:text-heading focus-visible:ring-2 focus-visible:ring-ring/50 aria-[current=page]:text-sm aria-[current=page]:font-medium aria-[current=page]:text-sidebar dark:aria-[current=page]:text-heading'

/**
 * The lists: headers Poppins Medium 11 #303030 on the faint navy band (6px corners), cells
 * Poppins Regular 11 #707070, rows 48.5px apart.
 */
export const overtimeTableClass =
  'text-[0.6875rem] sm:text-[0.6875rem] [&_td]:h-12 [&_td]:px-3 [&_td]:text-grey [&_th]:h-10 [&_th]:bg-sidebar/[0.06] [&_th]:px-3 [&_th]:text-[0.6875rem] [&_th]:font-medium [&_th]:text-title dark:[&_th]:bg-muted [&_th:first-child]:rounded-l-md [&_th:last-child]:rounded-r-md'

/** The policy list: headers Poppins Medium 14 #303030, cells Poppins Medium 13 #303030, rows 57px apart. */
export const policyTableClass =
  'text-[0.8125rem] sm:text-[0.8125rem] [&_td]:h-14 [&_td]:px-3 [&_td]:font-medium [&_td]:text-title [&_th]:h-10 [&_th]:bg-sidebar/[0.06] [&_th]:px-3 [&_th]:text-sm [&_th]:font-medium [&_th]:text-title dark:[&_th]:bg-muted [&_th:first-child]:rounded-l-md [&_th:last-child]:rounded-r-md'

/** "+ Apply Overtime", "+ Create", "Bulk Save": 36px, 5px corners, 30px sides, Poppins Medium 12 white on #17263A. */
export const overtimeNavyButtonClass =
  'h-9 rounded-[5px] bg-sidebar px-7 text-xs font-medium text-white hover:bg-sidebar/90 dark:bg-primary dark:hover:bg-primary/90'

/** Outlined "Filter": 1.5px #17263A, 5px corners, Poppins Medium 14 #17263A. */
export const overtimeOutlineButtonClass =
  'h-9 gap-2.5 rounded-[5px] border-[1.5px] border-sidebar bg-card px-5 text-sm font-medium text-sidebar hover:bg-sidebar/5 dark:border-input dark:text-heading'

/** The filled "Filter" of Overtime Applications: Poppins Medium 14 white on #17263A. */
export const overtimeFilledFilterClass =
  'h-9 gap-2.5 rounded-[5px] bg-sidebar px-5 text-sm font-medium text-white hover:bg-sidebar/90 dark:bg-primary'

/** Approved (#17263A) and Unapproved (#7E2448, "Tawny Port"): 36px, 5px corners, Poppins Medium 14 white. */
export const approvedToggleClass =
  'h-9 rounded-[5px] bg-sidebar px-7 text-sm font-medium text-white hover:bg-sidebar/90 dark:bg-primary'
export const unapprovedToggleClass =
  'h-9 rounded-[5px] bg-[#7E2448] px-7 text-sm font-medium text-white hover:bg-[#7E2448]/90'

/** The "Search" box of Overtime Applications: 200 × 36, 8px corners, #CFCFCF line, Poppins 13 #A4A4A4. */
export const overtimeSearchClass =
  'h-9 rounded-lg border-[#CFCFCF] pl-9 text-[0.8125rem] text-title placeholder:text-[#A4A4A4] sm:pl-9 sm:text-[0.8125rem] dark:border-input dark:placeholder:text-label'

/** Status chips: 68.62 × 20, 3px corners, Poppins Medium 10 in the status colour. */
export const overtimeChipClass = {
  approved: 'bg-[rgba(44,189,77,0.18)] text-[#51B969]',
  pending: 'bg-[rgba(235,190,30,0.16)] text-[#EBA51E]',
  rejected: 'bg-[rgba(216,56,56,0.14)] text-[#D83838]',
  // Not drawn: the API's cancellation states, in the Payroll orange and the grey text colour.
  cancelling: 'bg-[rgba(242,104,59,0.15)] text-[#F2683B]',
  cancelled: 'bg-[rgba(112,112,112,0.15)] text-grey',
} as const

/**
 * The Poppins popups (Apply for Overtime, Create Bulk Overtime Request, Slab Create): 16px
 * corners, 24px padding, title Poppins SemiBold 20 #202020; labels Poppins Regular 14
 * #303030; fields 40px with 8px corners and a #CFCFCF line, placeholders #A4A4A4.
 */
export const overtimeDialogClass = 'gap-0 rounded-2xl p-6'
export const overtimeDialogTitleClass =
  'font-sans text-lg leading-tight font-semibold text-[#202020] sm:text-xl dark:text-heading'
export const overtimeFieldsClass = [
  '[&_[data-slot=label]]:text-sm [&_[data-slot=label]]:font-normal [&_[data-slot=label]]:text-title',
  '[&_input]:rounded-lg [&_input]:border-[#CFCFCF] [&_input]:text-title [&_input]:placeholder:text-[#A4A4A4] dark:[&_input]:border-input dark:[&_input]:text-heading dark:[&_input]:placeholder:text-label',
  '[&_textarea]:rounded-lg [&_textarea]:border-[#CFCFCF] [&_textarea]:text-title [&_textarea]:placeholder:text-[#A4A4A4] dark:[&_textarea]:border-input dark:[&_textarea]:text-heading dark:[&_textarea]:placeholder:text-label',
  '[&_[data-slot=select-trigger]]:h-10 [&_[data-slot=select-trigger]]:rounded-lg [&_[data-slot=select-trigger]]:border-[#CFCFCF] [&_[data-slot=select-trigger]]:text-title [&_[data-slot=select-trigger]]:data-[placeholder]:text-[#A4A4A4] dark:[&_[data-slot=select-trigger]]:border-input dark:[&_[data-slot=select-trigger]]:text-heading dark:[&_[data-slot=select-trigger]]:data-[placeholder]:text-label',
  '[&_[role=combobox]]:rounded-lg [&_[role=combobox]]:border-[#CFCFCF] [&_[role=combobox]]:font-sans [&_[role=combobox]]:text-title [&_[role=combobox]_[data-placeholder]]:text-[#A4A4A4] dark:[&_[role=combobox]]:border-input dark:[&_[role=combobox]]:text-heading dark:[&_[role=combobox]_[data-placeholder]]:text-label',
  '[&_button[aria-haspopup=dialog]]:rounded-lg [&_button[aria-haspopup=dialog]]:border-[#CFCFCF] [&_button[aria-haspopup=dialog]]:text-title [&_button[aria-haspopup=dialog]>span.text-label]:text-[#A4A4A4] dark:[&_button[aria-haspopup=dialog]]:border-input dark:[&_button[aria-haspopup=dialog]]:text-heading dark:[&_button[aria-haspopup=dialog]>span.text-label]:text-label',
].join(' ')

/** Slab Create's labels are Poppins Medium 14. */
export const slabFieldsClass = '[&_[data-slot=label]]:font-medium'

/**
 * The Overtime Policy Create popup (Inter frame, 1015 wide, 8px corners): title Inter
 * Medium 24 #000, labels Inter Regular 16 #000 on the left, fields with 6px corners and
 * a #CBD5E1 line.
 */
export const policyDialogClass = 'gap-0 rounded-lg p-6 sm:p-8'
export const policyDialogTitleClass =
  'font-inter text-xl leading-tight font-medium text-heading sm:text-2xl'
export const policyFieldsClass =
  '[&_[data-slot=label]]:font-inter [&_[data-slot=label]]:text-base [&_[data-slot=label]]:font-normal [&_[data-slot=label]]:text-heading [&_input]:font-inter [&_textarea]:font-inter'

/** Cancel (#D83838) and Apply / Create / Save (#17263A): 180 × 48, 8px corners, Poppins Medium 15 white. */
export const dialogCancelButtonClass =
  'h-12 min-w-[11.25rem] rounded-lg bg-[#D83838] px-7 text-[0.9375rem] font-medium text-white hover:bg-[#D83838]/90'
export const dialogSubmitButtonClass =
  'h-12 min-w-[11.25rem] rounded-lg bg-sidebar px-7 text-[0.9375rem] font-medium text-white hover:bg-sidebar/90 dark:bg-primary dark:hover:bg-primary/90'

/** The policy popup's Daily / Monthly switch: 37.8 × 18, #707070 with a white knob. */
export const policyTypeSwitchClass =
  'h-[1.125rem] w-[2.375rem] data-[state=checked]:bg-grey data-[state=unchecked]:bg-grey'

/** The slab table inside the policy popup: Inter, the faint navy header band. */
export const slabTableClass =
  'font-inter text-sm sm:text-sm [&_td]:h-11 [&_td]:px-3 [&_td]:text-heading [&_th]:h-9 [&_th]:bg-sidebar/[0.06] [&_th]:px-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-title dark:[&_th]:bg-muted [&_th:first-child]:rounded-l-md [&_th:last-child]:rounded-r-md'

/** The editable cells of the Bulk Overtime sheet: a small box in the row's own type. */
export const sheetInputClass =
  'h-8 w-24 rounded-md border border-[#CFCFCF] bg-card px-2 text-[0.6875rem] text-title outline-none placeholder:text-[#A4A4A4] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 aria-invalid:border-destructive dark:border-input dark:text-heading'
