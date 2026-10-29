/**
 * Classes shared by the task column cells and their popups (Workspace file uDxoMdHpwl3tN5jqZpmofM:
 * the Workspace Page 1:2755 layers, Add Assignee 1:21985, Calendar 1:10061 and 1:10346).
 *
 * The column components are drawn larger than the page (cells 60 px high, popup text 16 to
 * 22 px); like the List view, they are drawn here at 0.72 of their Figma size, so 18 px text is
 * 13 px, a 60 px cell 43 px and the 689 px Add Assignee popup 496 px.
 */
export const fieldStyles = {
  /** The white popup card (radius 18, #E9E9E9 outline, 0 4 17.1 shadow). */
  popup:
    'rounded-[0.8125rem] border border-[#E9E9E9] dark:border-border bg-white dark:bg-card p-0 font-sans text-[#3D3D3D] dark:text-title shadow-[0_3px_12px_rgba(0,0,0,0.14)]',
  /** Title: Poppins SemiBold 22 #393636. */
  popupTitle: 'text-base font-semibold text-[#393636] dark:text-title',
  /** Section labels: Medium 16.88 #3D3D3D. */
  sectionTitle: 'text-xs font-medium tracking-[0.01em] text-[#3D3D3D] dark:text-title',
  /** Group labels in the lavender panels: SemiBold 18 #4A4A4A. */
  groupTitle: 'text-[0.8125rem] font-semibold tracking-[0.01em] text-[#4A4A4A] dark:text-title',
  muted: 'text-xs text-[#909090]',
  /** "View more", "Browse Task": SemiBold 16.88 #4382EE. */
  link: 'text-xs font-semibold tracking-[0.01em] text-[#4382EE] dark:text-[#8FB0FF] hover:underline',
  /** "+ Add Task", "+ Add a Roll-up": Medium 18 #3D3D3D with a purple plus. */
  purpleLink:
    'inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[0.8125rem] font-medium text-[#3D3D3D] dark:text-title transition-colors hover:bg-[#F8F5FF] dark:hover:bg-[#7127EA]/15 [&_svg]:text-[#7127EA] dark:[&_svg]:text-[#C4ABFF]',
  /** Divider line: 2.5 px rgba(0,0,0,0.08). */
  divider: 'h-[0.125rem] w-full shrink-0 bg-black/[0.08]',
  /** The round search field (shadow 0 0 9.2 rgba(0,0,0,0.12)) with the purple search icon. */
  search:
    'flex h-8 min-w-0 flex-1 items-center gap-2 rounded-full bg-white dark:bg-card px-2.5 shadow-[0_0_6.6px_rgba(0,0,0,0.12)]',
  searchInput:
    'min-w-0 flex-1 bg-transparent text-xs tracking-[0.01em] text-[#3D3D3D] dark:text-title outline-none placeholder:text-[#909090]',
  /** A grey pill row of a popup list (#F4F4F4, Medium 18 #5D5D5D). */
  row: 'flex h-[2.375rem] w-full shrink-0 items-center gap-2.5 rounded-full bg-[#F4F4F4] dark:bg-white/5 px-1.5 text-left text-[0.8125rem] font-medium text-[#5D5D5D] dark:text-title',
  rowButton:
    'flex h-[2.375rem] w-full shrink-0 items-center gap-2.5 rounded-full bg-[#F4F4F4] dark:bg-white/5 px-1.5 text-left text-[0.8125rem] font-medium text-[#5D5D5D] dark:text-title transition-colors hover:bg-[#EEE7FF] dark:hover:bg-[#7127EA]/25 focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none',
  /** The light rows of the quick picks and lists (rgba(221,221,221,0.2), radius 12). */
  softRow:
    'flex h-10 w-full items-center justify-between rounded-[0.5625rem] bg-[rgba(221,221,221,0.2)] px-2 text-[0.71875rem] font-medium tracking-[0.01em] text-[#4A4A4A] dark:text-title transition-colors hover:bg-[#EEE7FF] dark:hover:bg-[#7127EA]/25',
  /** Input fields: #E9E9E9 outline, radius 12, placeholder Regular 16.88 #909090. */
  input:
    'h-9 w-full rounded-[0.5625rem] border border-[#E9E9E9] dark:border-border bg-white dark:bg-card px-2.5 text-xs tracking-[0.01em] text-[#3D3D3D] dark:text-title outline-none placeholder:text-[#909090] focus:border-[#A181FF] focus:ring-[3px] focus:ring-[rgba(132,78,255,0.2)]',
  error: 'text-[0.6875rem] text-[#DC3545] dark:text-[#FF8A94]',
  /** Lavender panel (#EEE7FF, radius 18). */
  panel: 'rounded-[0.8125rem] bg-[#EEE7FF] dark:bg-[#7127EA]/10',
  /** White card inside a panel (#E9E9E9 outline, radius 18). */
  card: 'rounded-[0.8125rem] border border-[#E9E9E9] dark:border-border bg-white dark:bg-card',
  /** The List view cell box: white, #E9E9E9 outline, radius 12. */
  cell: 'flex h-10 w-full min-w-0 items-center gap-2 rounded-[0.5625rem] border border-[#E9E9E9] dark:border-border bg-white dark:bg-card pr-2 pl-1.5 text-left text-[0.8125rem] font-medium text-[#626262] dark:text-title transition-colors hover:border-[#D9C8FB] focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none data-[state=open]:border-[#A181FF]',
  /** Lavender square behind a cell's leading icon (#F6F2FF, radius 9). */
  cellIcon:
    'flex size-[1.625rem] shrink-0 items-center justify-center rounded-[0.4rem] bg-[#F6F2FF] dark:bg-[#7127EA]/10 text-[#7127EA] dark:text-[#C4ABFF] [&_svg]:h-[0.95rem] [&_svg]:w-auto',
  cellChevron: 'ml-auto h-[0.4rem] w-[0.75rem] shrink-0 text-[#7127EA] dark:text-[#C4ABFF]',
  placeholder: 'truncate text-[0.8125rem] font-medium text-[#626262] dark:text-title',
  /** Red Cancel (#B7192C) and green Save (#318845), SemiBold 18 white. */
  cancel:
    'inline-flex h-12 flex-1 items-center justify-center rounded-[0.7rem] bg-[#B7192C] text-[0.8125rem] font-semibold text-white transition-colors hover:bg-[#9b1524] disabled:opacity-60',
  save: 'inline-flex h-12 flex-1 items-center justify-center rounded-[0.5625rem] bg-[#318845] text-[0.8125rem] font-semibold text-white transition-colors hover:bg-[#2a753b] disabled:opacity-60',
  /** Blue Done (#2550D0) of Add Time Estimate. */
  done: 'inline-flex h-12 flex-1 items-center justify-center rounded-[0.5rem] bg-[#2550D0] text-[0.75rem] font-semibold text-white transition-colors hover:bg-[#1f44b3] disabled:opacity-60',
  /** The red square close (x) at a popup's top right (rgba(236,71,79,0.1), radius 9.33). */
  close:
    'inline-flex size-[1.8125rem] shrink-0 items-center justify-center rounded-[0.4375rem] bg-[rgba(236,71,79,0.1)] text-[#DC3545] dark:text-[#FF8A94] transition-colors hover:bg-[rgba(236,71,79,0.18)] [&_svg]:size-[0.7rem]',
  /** The round red (x) that removes a row. */
  removeIcon:
    'ml-auto inline-flex size-[1.375rem] shrink-0 items-center justify-center rounded-full bg-[rgba(236,71,79,0.1)] text-[#DC3545] dark:text-[#FF8A94] hover:bg-[rgba(236,71,79,0.2)] [&_svg]:size-[0.55rem]',
  /** Thin scrollbars (track rgba(41,55,73,0.07), thumb #E4E4E4). */
  scroll: '[scrollbar-color:#E4E4E4_rgba(41,55,73,0.07)] [scrollbar-width:thin]',
  /** Dark tooltip (#282828, radius 8, Regular 16 white). */
  tooltip: 'rounded-md bg-[#282828] px-3 py-1.5 text-[0.71875rem] text-white',
} as const

/** A tag's chip colours: a light tint behind a dark shade (Active #D4F9D6 / #2A6B39). */
export function tagColors(color: string): { backgroundColor: string; color: string } {
  const hex = color.replace('#', '')
  const channels = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16))
  const mix = (target: number, amount: number) =>
    channels.map((channel) => Math.round(channel + (target - channel) * amount))
  const toHex = (values: number[]) =>
    `#${values.map((value) => value.toString(16).padStart(2, '0')).join('')}`
  return { backgroundColor: toHex(mix(255, 0.8)), color: toHex(mix(0, 0.4)) }
}
