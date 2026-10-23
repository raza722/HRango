import type { ReactNode } from 'react'

import { AppDialog } from '@/components/feedback/app-dialog'
import { FieldLayoutContext } from '@/components/form'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { btn, dialogFieldType, dialogLargeLabels, footerButton } from '../../utils/styles'

interface PayrollDialogProps {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  /** The form this dialog's Save submits (`form` attribute), or a click handler. */
  formId?: string
  onSave?: () => void
  saveLabel?: string
  /** View dialogs: Cancel only. */
  readOnly?: boolean
  pending?: boolean
  /** A form-level error, shown beside the buttons. */
  error?: string | null | undefined
  /** Extra buttons before Save (History, Back, Voucher…). */
  actions?: ReactNode
  /** `vertical` puts labels above the fields; the designs mostly put them on the left. */
  layout?: 'horizontal' | 'vertical'
  /** `large`: Inter Regular 18 labels (the Payroll Create form); default Inter Regular 16. */
  labelSize?: 'default' | 'large'
  /** Overrides the title's type (default Inter Medium 24 #000000). */
  titleClassName?: string
  className?: string
}

/**
 * The Payroll dialogs: title at the top left, labels on the left of the
 * fields, green Save and red Cancel at the bottom right.
 */
export function PayrollDialog({
  title,
  onClose,
  children,
  formId,
  onSave,
  saveLabel = 'Save',
  readOnly = false,
  pending = false,
  error,
  actions,
  layout = 'horizontal',
  labelSize = 'default',
  titleClassName,
  className,
}: PayrollDialogProps) {
  return (
    <AppDialog
      title={title}
      titleClassName={titleClassName}
      onRequestClose={onClose}
      className={cn(
        'max-w-4xl',
        dialogFieldType,
        labelSize === 'large' && dialogLargeLabels,
        className,
      )}
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto self-center text-sm text-destructive">
              {error}
            </p>
          )}
          {actions}
          {!readOnly && (
            <Button
              type={formId ? 'submit' : 'button'}
              form={formId}
              onClick={formId ? undefined : onSave}
              disabled={pending}
              className={cn(footerButton, btn.green)}
            >
              {saveLabel}
            </Button>
          )}
          <Button type="button" onClick={onClose} className={cn(footerButton, btn.red)}>
            Cancel
          </Button>
        </>
      }
    >
      <FieldLayoutContext value={layout}>{children}</FieldLayoutContext>
    </AppDialog>
  )
}
