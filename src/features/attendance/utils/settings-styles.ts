/**
 * Type of the Attendance Logs and Settings frames (Poppins family). See
 * docs/figma-typography.md.
 */

/** Settings and Logs tables: grey rounded header in Poppins Medium 11 #303030, cells Poppins Regular 11 #707070. */
export const compactTableClass =
  'text-[0.6875rem] sm:text-[0.6875rem] [&_td]:h-11 [&_td]:px-3 [&_td]:text-grey [&_th]:px-3 [&_th]:h-10 [&_th]:bg-muted [&_th]:text-[0.6875rem] [&_th]:font-medium [&_th]:text-title [&_th:first-child]:rounded-l-md [&_th:last-child]:rounded-r-md'

/** Page and card titles: Poppins Medium 20 #303030. */
export const pageTitleClass = 'text-xl font-medium text-title'

/** The navy of the sidebar, for Create / Save Changes buttons. */
export const navyButtonClass = 'bg-sidebar text-white hover:bg-sidebar/90 dark:bg-primary'

/** "+ Create", "Import" and "Delete" over a list: Poppins Medium 12 white. */
export const toolbarButtonClass = 'h-9 px-4 text-xs font-medium'

/** Outlined "Filter" and "Download": Poppins Medium 14 #17263A. */
export const outlineButtonClass =
  'h-9 border-heading/80 px-4 font-medium text-sidebar dark:border-border dark:text-heading'

/** Person cell: name Poppins Medium 11 #505050, code Poppins Regular 9 #707070. */
export const personNameClass = 'block truncate text-[0.6875rem] font-medium text-person'
export const personCodeClass = 'block text-[0.5625rem] text-grey'

/**
 * The chosen side of a two-way switch (Computer / Machine, Netmask / Range,
 * Organization / Employees): Poppins Medium #202020; the label sets the size
 * and the other side's #707070.
 */
export const switchOnClass = 'text-[#202020] dark:text-heading'

/** Dialog title of the Logs and Settings dialogs: Poppins SemiBold 20 #202020. */
export const poppinsDialogTitleClass =
  'font-sans text-lg font-semibold text-[#202020] sm:text-xl dark:text-heading'

/** Footer buttons of the Logs dialogs: Poppins Medium 15 white. */
export const logDialogButtonClass = 'min-w-24 px-5 text-[0.9375rem] font-medium'

/** Footer buttons of the Settings dialogs: Poppins Medium 14 white. */
export const settingsDialogButtonClass = 'min-w-24 px-5 text-sm font-medium'

/** Footer buttons of the Geo Fencing steps and Delete Rest Days: Poppins Medium 16 (Back #17263A, the rest white). */
export const stepDialogButtonClass = 'min-w-24 px-5 text-base font-medium'

/**
 * The Time Sheet Edit / View dialogs (older Inter frames; put on the dialog):
 * everything in Inter, field labels Regular 16 #000, field values Regular 14 #475569.
 */
export const interDialogClass =
  'font-inter [&_label[data-slot=label]]:text-base [&_label[data-slot=label]]:text-heading [&_input]:text-field-value [&_[role=combobox]:not([data-placeholder])]:text-field-value [&_button[aria-haspopup=dialog]]:text-field-value'

/**
 * Fields inside a Logs / Settings dialog (put on the dialog): labels Poppins
 * Regular 14 #303030, values Poppins Regular 14 #707070 (Break Type view),
 * placeholders Poppins Regular 14 #A4A4A4. The required mark is already the
 * Figma #D83838 (`text-destructive`).
 */
export const poppinsFieldsClass =
  '[&_label[data-slot=label]]:text-title [&_input]:text-grey [&_textarea]:text-grey [&_[role=combobox]:not([data-placeholder])]:text-grey [&_button[aria-haspopup=dialog]]:text-grey [&_input]:placeholder:text-[#A4A4A4] [&_textarea]:placeholder:text-[#A4A4A4] [&_button[data-placeholder]]:text-[#A4A4A4] [&_button>span.text-label]:text-[#A4A4A4] dark:[&_input]:placeholder:text-label dark:[&_textarea]:placeholder:text-label dark:[&_button[data-placeholder]]:text-label dark:[&_button>span.text-label]:text-label'
