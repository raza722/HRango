import type { StatusGroup } from '../../types/pm.types'

/**
 * The dashboards have no Figma frame. They take the module's look (pm-styles, workspace-styles):
 * white cards with a #ECECEC outline and 14 px radius, #7127EA accents on #F0E9FD lavender,
 * Poppins, #303030 / #707070 text, and add a dark theme from the app's tokens.
 */
export const dash = {
  /** Every widget and tile. */
  card: 'min-w-0 rounded-[0.875rem] border border-[#ECECEC] bg-card dark:border-border',
  title: 'text-base font-semibold text-title',
  subtle: 'text-xs text-grey',
  /** Purple glyph on lavender, as the task row menu's icons. */
  iconTile:
    'flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-[#F0E9FD] text-[#7127EA] dark:bg-[#7127EA]/20 dark:text-[#C4ABFF] [&_svg]:size-[1.125rem]',
  dangerTile:
    'flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-[#FDECEE] text-[#DC3545] dark:bg-[#DC3545]/15 dark:text-[#FF8A94] [&_svg]:size-[1.125rem]',
  chip: 'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  lavender: 'bg-[#F0E9FD] text-[#5B1FC2] dark:bg-[#7127EA]/20 dark:text-[#D7C6FF]',
  danger: 'bg-[#FDECEE] text-[#B7192C] dark:bg-[#DC3545]/15 dark:text-[#FF9AA3]',
  warning: 'bg-[#FFF4E5] text-[#9A5B00] dark:bg-[#F79009]/15 dark:text-[#FFC266]',
  success: 'bg-[#E7F7EC] text-[#1E7B3A] dark:bg-emerald-500/15 dark:text-emerald-300',
  neutral: 'bg-[#F1F2F3] text-[#5D6481] dark:bg-white/10 dark:text-grey',
  focus: 'outline-none focus-visible:ring-2 focus-visible:ring-[#A181FF]',
  link: 'rounded-sm font-medium text-[#7127EA] underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:text-[#C4ABFF]',
  /** A clickable line in a widget's list. */
  row: 'flex min-w-0 items-center gap-3 rounded-[0.625rem] px-2 py-2 transition-colors outline-none hover:bg-[#F8F5FF] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:hover:bg-white/5',
  /** Ghost button in a widget header ("View all", the table toggle). */
  ghost:
    'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-[#7127EA] transition-colors outline-none hover:bg-[#F0E9FD] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:text-[#C4ABFF] dark:hover:bg-[#7127EA]/20',
  /** Segmented control (scope toggles). */
  segment:
    'inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold text-grey transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#A181FF] aria-pressed:bg-card aria-pressed:text-[#7127EA] aria-pressed:shadow-xs dark:aria-pressed:bg-[#7127EA]/25 dark:aria-pressed:text-[#E2D6FF]',
  segmentGroup: 'inline-flex rounded-[0.625rem] bg-[#F1F2F3] p-0.5 dark:bg-white/5',
  /** Hairline track behind progress bars. */
  track: 'h-1.5 overflow-hidden rounded-full bg-[#EEE7FF] dark:bg-white/10',
  trackFill: 'h-full rounded-full bg-[#7127EA] dark:bg-[#9F7BF3]',
} as const

/**
 * Chart colours as CSS variables, light and dark, set once on each dashboard's root. Validated
 * with the dataviz palette script (27 Oct 2026):
 * - status groups (amber, blue, aqua, purple) pass every categorical check in both themes; amber
 *   and aqua are under 3:1 on white, so the breakdown always carries labels and a table view;
 * - open / done (purple steps) pass the ordinal checks in both themes;
 * - due columns are the de-emphasis grey behind the purple completed ones (emphasis form).
 */
export const chartVars = [
  '[--dash-open:#7127EA] [--dash-done:#A88BF5] [--dash-completed:#7127EA] [--dash-due:#CBD2DD] [--dash-muted:#9AA1AE]',
  '[--grp-not-started:#eda100] [--grp-active:#2E64E2] [--grp-done:#1baf7a] [--grp-closed:#7127EA]',
  '[--dash-grid:#ECECEC] [--dash-axis:#C3C2B7]',
  'dark:[--dash-open:#9F7BF3] dark:[--dash-done:#5A3D9E] dark:[--dash-completed:#9F7BF3] dark:[--dash-due:#3B4A61] dark:[--dash-muted:#6B7689]',
  'dark:[--grp-not-started:#c98500] dark:[--grp-active:#4F7FEA] dark:[--grp-done:#199e70] dark:[--grp-closed:#9061F0]',
  'dark:[--dash-grid:#2B3A50] dark:[--dash-axis:#3B4A61]',
].join(' ')

export const GROUP_COLOR_VARS: Record<StatusGroup, string> = {
  'not-started': 'var(--grp-not-started)',
  active: 'var(--grp-active)',
  done: 'var(--grp-done)',
  closed: 'var(--grp-closed)',
}
