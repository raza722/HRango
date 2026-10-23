/**
 * Text styles of the Roster frames in Figma (Roster Group, View), all Inter. The shared
 * components are styled from outside, through `className`.
 */
export const rosterType = {
  /**
   * On the purple roster table: header Inter Medium 20 white, cells (group title, enrolled
   * count) Inter Medium 20 #303030. The row number is #000 (see `rowNumber`).
   */
  groupTable: '[&_td]:text-xl [&_td]:font-medium [&_td:not([colspan])]:text-title [&_th]:text-xl',
  rowNumber: 'text-heading',
  /** Buttons ("Add New", "Save", "Cancel", "Enroll New Employee"): Inter Medium 16 white. */
  button: 'font-inter text-base font-medium',
  /** Times and minutes in the View dialog: Inter Medium 16 #585858. */
  time: 'text-base font-medium text-[#585858] dark:text-muted-foreground',
  /** The pager's current page, blue in the Roster frames. */
  pagerCurrent: 'bg-pager-active font-medium text-white',
} as const
