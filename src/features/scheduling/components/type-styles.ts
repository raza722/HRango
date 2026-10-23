import { cn } from '@/lib/utils'

/**
 * Text styles of the Scheduling frames in Figma. The board and most dialogs are Inter; the
 * "Create New Rest Day" dialog and the employee lists are drawn in Poppins. The shared form
 * components are styled from outside, through `className`.
 */

export const schedulingType = {
  /**
   * On an Inter dialog: labels Inter Regular 16 #000 (14 on phones); the required mark Inter
   * Medium 20 #E50141; field values and placeholders Inter Regular 14 #475569.
   */
  dialog: cn(
    'font-inter',
    '[&_[data-slot=label]]:text-heading sm:[&_[data-slot=label]]:text-base',
    // Written out in full: Tailwind only generates class names it finds in the source.
    '[&_[data-slot=label]_[aria-hidden=true]]:text-xl [&_[data-slot=label]_[aria-hidden=true]]:leading-none [&_[data-slot=label]_[aria-hidden=true]]:font-medium [&_[data-slot=label]_[aria-hidden=true]]:text-[#E50141] dark:[&_[data-slot=label]_[aria-hidden=true]]:text-destructive',
    '[&_[aria-invalid]]:text-field-value [&_[aria-invalid]]:placeholder:text-field-value [&_[aria-invalid][data-placeholder]]:text-field-value [&_[data-slot=input]]:text-field-value [&_[data-slot=select-trigger]]:text-field-value',
  ),
  /**
   * On the "Create New Rest Day" form (Poppins): labels Poppins Regular 14 #303030,
   * placeholders Poppins Regular 14 #A4A4A4.
   */
  restDayForm:
    '[&_[data-slot=label]]:text-title [&_[aria-invalid]]:placeholder:text-[#A4A4A4] [&_[aria-invalid][data-placeholder]]:text-[#A4A4A4] dark:[&_[aria-invalid]]:placeholder:text-label dark:[&_[aria-invalid][data-placeholder]]:text-label',
  /** A label that is not a `<Label>` (read-only rows, radios): Inter Regular 16 #000. */
  label: 'text-sm text-heading sm:text-base',
  /** A read-only value box: Inter Regular 14 #475569. */
  value: 'text-sm text-field-value',
  /** Section bars and sub-titles of the dialogs ("Shift Scheduling", "Breaks"): Inter Medium 24 #000. */
  section: 'text-xl font-medium text-heading sm:text-2xl',
  /** Header and dialog buttons: Inter Medium 16 white. */
  button: 'text-base font-medium',
  /** Shift times, day headers, hours: #585858. */
  grey: 'text-[#585858] dark:text-field-foreground',
  /** "Search Location" boxes: placeholder Inter Regular 14 #B4B5B6. */
  locationPlaceholder: 'placeholder:text-[#B4B5B6] dark:placeholder:text-label',
  /** The pager's current page, blue in the Scheduling frames. */
  pagerCurrent: 'bg-pager-active font-medium text-white',
} as const
