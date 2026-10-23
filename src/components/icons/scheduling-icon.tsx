import type { NavIconProps } from './figma-icons'

/**
 * Sidebar icon for Scheduling: a filled calendar page with schedule lines,
 * in the solid style of the Figma sidebar icons.
 */
export function SchedulingIcon(props: NavIconProps) {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.25 2.5a.75.75 0 0 1 .75.75V4h6v-.75a.75.75 0 0 1 1.5 0V4h.75A2.75 2.75 0 0 1 19 6.75v9.5A2.75 2.75 0 0 1 16.25 19h-10.5A2.75 2.75 0 0 1 3 16.25v-9.5A2.75 2.75 0 0 1 5.75 4h.75v-.75a.75.75 0 0 1 .75-.75ZM4.5 9v7.25c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25V9h-13Zm2.25 2h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Zm0 3h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Z"
        fill="currentColor"
      />
    </svg>
  )
}
