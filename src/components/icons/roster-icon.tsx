import type { NavIconProps } from './figma-icons'

/**
 * Sidebar icon for Roster: a filled clock, drawn on the same 22px grid and
 * solid style as the Figma sidebar icons (the design's Roster icon is a pasted image).
 */
export function RosterIcon(props: NavIconProps) {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11 2.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5ZM4.5 11a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0Zm7.375-3.875a.875.875 0 0 0-1.75 0V11c0 .232.092.455.256.619l2.5 2.5a.875.875 0 1 0 1.238-1.238l-2.244-2.243V7.125Z"
        fill="currentColor"
      />
    </svg>
  )
}
