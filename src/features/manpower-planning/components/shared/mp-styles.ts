// The Manpower Planning frames' type and colours (HRango Dashboard App Version, page App UI),
// read from their CSS exports. Poppins throughout; the accent is #7469E8.

/** #7469E8 purple: buttons, the card title bar, names and ticks. */
export const accent = {
  bg: 'bg-[#7469E8] text-white hover:bg-[#6458D9] dark:bg-[#7F75F0] dark:hover:bg-[#7469E8]',
  text: 'text-[#7469E8] dark:text-[#A39BFF]',
  outline:
    'border border-[#7469E8] bg-card text-[#7469E8] hover:bg-[#7469E8]/8 dark:border-[#A39BFF] dark:text-[#A39BFF]',
} as const

/** Page title above the card: Poppins Medium 24/36 #303030. */
export const pageTitleText = 'text-xl leading-9 font-medium text-title sm:text-2xl'

/** Card title next to the purple bar: Poppins Medium 16/24 #000. */
export const cardTitleText = 'text-base leading-6 font-medium text-heading'

/** Field labels in the filter rows and Add Planning: Poppins Medium 14/21 #000. */
export const labelText = 'text-sm leading-[1.3125rem] font-medium text-heading'

/** Popup labels: Poppins Medium 14/21 #010101. */
export const dialogLabelText = 'text-sm leading-[1.3125rem] font-medium text-heading'

/** Table headings: Poppins Medium 14/21 #292929. */
export const headText = 'text-sm leading-[1.3125rem] font-medium text-[#292929] dark:text-heading'

/** Table cells: Poppins Regular 14/21 #000. */
export const cellText = 'text-sm leading-[1.3125rem] font-normal text-heading'

/** The light field outline #EBEFF8. */
export const softBorder = 'border-[#EBEFF8] dark:border-border'

/**
 * The boxes of the filter rows and Add Planning: 36px tall, 1px #EBEFF8, 5px corners,
 * Poppins Regular 14 #000.
 */
export const boxClass =
  'h-9 rounded-[5px] border border-[#EBEFF8] bg-card px-3 text-sm font-normal text-heading shadow-none outline-none placeholder:text-[#818CA3] focus-visible:border-[#7469E8] focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/20 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:bg-muted/60 dark:border-border sm:px-3 sm:text-sm'

/** Popup boxes: 39px tall, 6px corners, Poppins Regular 12 #818CA3 placeholders. */
export const dialogBoxClass =
  'h-[2.4375rem] rounded-[6px] border border-[#EBEFF8] bg-card px-4 text-xs font-normal text-heading shadow-none outline-none placeholder:text-[#818CA3] focus-visible:border-[#7469E8] focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/20 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:bg-muted/60 dark:border-border sm:px-4 sm:text-xs'

/** Table-row boxes in Add Planning: 36px, Poppins Regular 12 (selects) or 14 (amounts). */
export const cellBoxClass =
  'h-9 rounded-[5px] border border-[#EBEFF8] bg-card px-2 text-xs font-normal text-heading shadow-none data-[placeholder]:text-heading outline-none placeholder:text-[#818CA3] focus-visible:border-[#7469E8] focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/20 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:bg-muted/60 dark:border-border sm:px-2 sm:text-xs'

/** Card header buttons (+ Add New Plan, + Add Budget Duration): 43px, 6px corners, Medium 14. */
export const headerButton =
  'inline-flex h-[2.6875rem] items-center justify-center gap-3 rounded-[6px] px-3.5 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 disabled:pointer-events-none disabled:opacity-60'

/** Filter-row and table buttons (Search, Refresh, Import Positions): 36px, 5px, Regular 12. */
export const smallButton =
  'inline-flex h-9 items-center justify-center gap-2 rounded-[5px] px-3 text-xs font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 disabled:pointer-events-none disabled:opacity-60'

/** Popup buttons (Cancel, Delete, Add Duration): 43px, 6px corners, Medium 14. */
export const dialogButton =
  'inline-flex h-[2.6875rem] min-w-[8.4375rem] items-center justify-center rounded-[6px] px-5 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 disabled:pointer-events-none disabled:opacity-60'

/**
 * The lists' table: a 48px heading row between two #EBEFF8 rules (Poppins Medium 14
 * #292929), then unruled rows of Poppins Regular 14 #000 set at the top, 24px from
 * the card's edges.
 */
export const mpTableClass = [
  'text-sm sm:text-sm',
  '[&_thead_tr]:border-y [&_thead_tr]:border-[#EBEFF8] dark:[&_thead_tr]:border-border',
  '[&_th]:h-12 [&_th]:px-2 [&_th]:py-1 [&_th]:text-sm [&_th]:leading-tight [&_th]:font-medium [&_th]:whitespace-normal [&_th]:text-[#292929] dark:[&_th]:text-heading',
  '[&_tbody_tr]:border-0 [&_tbody_tr:hover]:bg-transparent',
  '[&_td]:h-auto [&_td]:px-2 [&_td]:py-3.5 [&_td]:align-top [&_td]:font-normal [&_td]:text-heading',
  '[&_th:first-child]:pl-4 [&_td:first-child]:pl-4 sm:[&_th:first-child]:pl-6 sm:[&_td:first-child]:pl-6',
  '[&_th:last-child]:pr-4 [&_td:last-child]:pr-4',
  // The stacked (phone) layout: the cards' side margin.
  '[&>li]:px-4 sm:[&>li]:px-6',
].join(' ')

/** The "Show 10 entries" and "Search here…" boxes: 43px, 1px #C9C9C9 at 60%. */
export const listBoxClass =
  'h-[2.6875rem] rounded-none border border-[#C9C9C9]/60 bg-card text-sm font-normal text-heading shadow-none outline-none placeholder:text-xs placeholder:text-[#C9C9C9] focus-visible:border-[#7469E8] focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/20 dark:border-border'
