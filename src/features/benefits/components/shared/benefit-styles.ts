// The Benefits frames' type and colours (HRango Dashboard App Version, section 3054:4092), read
// from their CSS exports. Poppins throughout; the accent is #7469E8 and the rules #EBEFF8.

/** #7469E8: buttons, the card's bar, links, ticks. */
export const accent = {
  bg: 'bg-[#7469E8] text-white hover:bg-[#6458D9] dark:bg-[#7F75F0] dark:hover:bg-[#7469E8]',
  text: 'text-[#7469E8] dark:text-[#A39BFF]',
  outline:
    'border border-[#7469E8] bg-card text-[#7469E8] hover:bg-[#7469E8]/8 dark:border-[#A39BFF] dark:text-[#A39BFF]',
} as const

/** The #EBEFF8 rules, boxes and the current tab. */
export const rule = 'border-[#EBEFF8] dark:border-border'
export const ruleBg = 'bg-[#EBEFF8] dark:bg-[#22304a]'

/** "Benefits Management": Poppins Medium 24/36 #303030. */
export const pageTitleText = 'text-xl leading-9 font-medium text-title sm:text-2xl'

/** Card titles beside the purple bar: Poppins Medium 16/24 #000. */
export const cardTitleText = 'text-base leading-6 font-medium text-heading'

/** Dialog titles: Poppins Medium 20/30 #303030. */
export const dialogTitleText = 'text-lg leading-[1.875rem] font-medium text-title sm:text-xl'

/** Tabs, labels and buttons: Poppins Medium 14/21. */
export const mediumText = 'text-sm leading-[1.3125rem] font-medium'

/** Field labels: Poppins Medium 14/21 #000. */
export const labelText = `${mediumText} text-heading`

/** Table cells and plain copy: Poppins Regular 14/21 #000. */
export const bodyText = 'text-sm leading-[1.3125rem] font-normal text-heading'

/** Small copy (field values, menu items, list rows): Poppins Regular 12/18 #000. */
export const smallText = 'text-xs leading-[1.125rem] font-normal text-heading'

/** The required mark #D33300. */
export const requiredMark = 'text-[#D33300] dark:text-[#FF7A4D]'

/** Placeholders #818CA3. */
export const placeholderColor = 'text-[#818CA3] dark:text-muted-foreground'

/**
 * The form boxes: 227 x 39, 1px #EBEFF8, 6px corners, Poppins Regular 12 with the #818CA3
 * placeholder, 16px inside.
 */
export const boxClass =
  'h-[2.4375rem] w-full min-w-0 rounded-[6px] border border-[#EBEFF8] bg-card px-4 text-xs font-normal text-heading shadow-none outline-none placeholder:text-[#818CA3] focus-visible:border-[#7469E8] focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/20 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:bg-muted/60 dark:border-border dark:placeholder:text-muted-foreground sm:px-4 sm:text-xs pointer-coarse:h-11'

/** The New Hires boxes: 41px tall, Poppins Regular 14. */
export const largeBoxClass =
  'h-[2.5625rem] w-full min-w-0 rounded-[6px] border border-[#EBEFF8] bg-card px-4 text-sm font-normal text-heading shadow-none outline-none placeholder:text-[#818CA3] focus-visible:border-[#7469E8] focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/20 aria-invalid:border-destructive dark:border-border sm:px-4 sm:text-sm pointer-coarse:h-11'

/** Buttons: 43px, 6px corners, Poppins Medium 14. */
export const buttonClass =
  'inline-flex h-[2.6875rem] items-center justify-center gap-3 rounded-[6px] px-5 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 disabled:pointer-events-none disabled:opacity-60'

/** The grey Back button of the enrollment window: 1px #AAB5CD. */
export const greyOutline =
  'border border-[#AAB5CD] bg-card text-[#AAB5CD] hover:bg-muted/60 hover:text-[#7C89A6] dark:text-muted-foreground'

/** The 32px white header buttons with their #516284 icons. */
export const headerIconButton =
  'flex size-8 items-center justify-center rounded-[6px] bg-card text-[#516284] outline-none hover:bg-card/70 focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 aria-expanded:bg-[#7469E8]/10 dark:text-[#A9B6CF] [&_svg]:size-[1.1rem]'

/** Chips: 5px corners, Poppins Regular 14. */
export const chipClass =
  'inline-flex h-[1.6875rem] items-center rounded-[5px] px-[0.5625rem] text-sm leading-[1.3125rem] font-normal whitespace-nowrap'

/**
 * The lists' table: a 48px heading row between #EBEFF8 rules (Poppins Medium 14 #292929), rows of
 * Poppins Regular 14 #000 set at the top; 32px in from the card's left edge.
 */
export const tableClass = [
  // Phones: the stacked cards sit inside the card's margins.
  'text-sm sm:text-sm max-md:px-4 max-md:pt-4',
  '[&_thead_tr]:border-y [&_thead_tr]:border-[#EBEFF8] dark:[&_thead_tr]:border-border',
  '[&_th]:h-12 [&_th]:px-3 [&_th]:text-sm [&_th]:font-medium [&_th]:text-[#292929] dark:[&_th]:text-heading',
  '[&_tbody_tr:hover]:bg-transparent',
  '[&_td]:h-auto [&_td]:px-3 [&_td]:py-[1.1rem] [&_td]:align-top [&_td]:text-sm [&_td]:font-normal [&_td]:text-heading',
  '[&_th:first-child]:pl-4 [&_td:first-child]:pl-4 sm:[&_th:first-child]:pl-8 sm:[&_td:first-child]:pl-8',
  '[&_th:last-child]:pr-4 [&_td:last-child]:pr-4 sm:[&_th:last-child]:pr-8 sm:[&_td:last-child]:pr-8',
].join(' ')

/** Plan Years: no rules between rows. */
export const plainRows = '[&_tbody_tr]:border-0'

/** Plans and the other lists: a #EBEFF8 rule under every row (59px rows). */
export const ruledRows =
  '[&_tbody_tr]:border-b [&_tbody_tr]:border-[#EBEFF8] dark:[&_tbody_tr]:border-border [&_td]:py-[1.15rem]'
