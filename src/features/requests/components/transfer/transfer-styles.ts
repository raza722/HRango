import { cn } from '@/lib/utils'

/** The bulk buttons, as drawn: navy Approved, maroon Unapproved. */
export const bulkButton = {
  approved: 'bg-[#17263A] text-white hover:bg-[#17263A]/90 dark:bg-primary',
  unapproved: 'bg-[#7B254A] text-white hover:bg-[#7B254A]/90',
}

/** Flow (cyan) and Reject (maroon) in the Approve popup. */
export const decisionButton = {
  flow: 'bg-[#22C3F3] text-white hover:bg-[#22C3F3]/90',
  reject: bulkButton.unapproved,
}

/** The two white cards of the Transfer popups: the form, and the Application beside it. */
export const transferCardClass =
  '@container rounded-[1.75rem] bg-card text-card-foreground shadow-xl'

/** View draws every box grey, not faded white. */
export const readOnlyFieldsClass = cn(
  '[&_[role=combobox]:disabled]:border-transparent [&_[role=combobox]:disabled]:bg-[#D9D9D9]/60 [&_[role=combobox]:disabled]:opacity-100',
  '[&_[aria-haspopup=dialog]:disabled]:border-transparent [&_[aria-haspopup=dialog]:disabled]:bg-[#D9D9D9]/60 [&_[aria-haspopup=dialog]:disabled]:opacity-100',
  '[&_textarea:disabled]:border-transparent [&_textarea:disabled]:bg-[#D9D9D9]/60 [&_textarea:disabled]:opacity-100',
  'dark:[&_[aria-haspopup=dialog]:disabled]:bg-muted dark:[&_[role=combobox]:disabled]:bg-muted dark:[&_textarea:disabled]:bg-muted',
)

/**
 * Fields of the Transfer popups (Figma, Inter): labels Regular 16 #000, the
 * required mark Regular 16 #D80027, placeholders Regular 16 #707070; chosen and
 * read-only values stay Inter Regular 14 #475569 (the kit's field type).
 */
export const transferFieldsClass = cn(
  '[&_[data-slot=label]]:font-inter [&_[data-slot=label]]:text-base [&_[data-slot=label]]:font-normal [&_[data-slot=label]]:text-heading',
  '[&_[data-slot=label]_[aria-hidden=true]]:text-[#D80027] dark:[&_[data-slot=label]_[aria-hidden=true]]:text-destructive',
  '[&_[data-placeholder]]:font-inter [&_[data-placeholder]]:text-base [&_[data-placeholder]]:text-grey',
  '[&_input]:placeholder:text-base [&_input]:placeholder:text-grey [&_textarea]:font-inter [&_textarea]:text-field-value [&_textarea]:placeholder:text-base [&_textarea]:placeholder:text-grey',
)
