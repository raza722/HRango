import { cn } from '@/lib/utils'

/**
 * View dialogs draw their fields as grey boxes, not faded white ones: the
 * disabled drop-downs, date pickers, text boxes and text areas of a form.
 */
export const viewFieldsClass = cn(
  '[&_[role=combobox]:disabled]:border-transparent [&_[role=combobox]:disabled]:bg-[#D9D9D9]/60 [&_[role=combobox]:disabled]:opacity-100',
  '[&_[aria-haspopup=dialog]:disabled]:border-transparent [&_[aria-haspopup=dialog]:disabled]:bg-[#D9D9D9]/60 [&_[aria-haspopup=dialog]:disabled]:opacity-100',
  '[&_input:disabled]:border-transparent [&_input:disabled]:bg-[#D9D9D9]/60 [&_input:disabled]:opacity-100',
  '[&_textarea:disabled]:border-transparent [&_textarea:disabled]:bg-[#D9D9D9]/60 [&_textarea:disabled]:opacity-100',
  'dark:[&_[aria-haspopup=dialog]:disabled]:bg-muted dark:[&_[role=combobox]:disabled]:bg-muted dark:[&_input:disabled]:bg-muted dark:[&_textarea:disabled]:bg-muted',
)
