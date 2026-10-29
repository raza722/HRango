import type { ReactNode } from 'react'

import { FilterSlidersIcon } from '@/components/icons/attendance-menu-icons'
import { EmployeeAvatar, Pagination } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { PaginationMeta } from '@/types/api'

import type { OvertimeStatus } from '../../types/overtime.types'
import { OVERTIME_STATUS_LABELS } from '../../utils/overtime-format'
import {
  dialogCancelButtonClass,
  dialogSubmitButtonClass,
  overtimeChipClass,
  overtimeDialogClass,
  overtimeDialogTitleClass,
  overtimeFieldsClass,
  overtimeFilledFilterClass,
  overtimeOutlineButtonClass,
  policyDialogClass,
  policyDialogTitleClass,
  policyFieldsClass,
} from '../../utils/overtime-styles'
import { pageTitleClass, personCodeClass, personNameClass } from '../../utils/settings-styles'

/** "Approved" / "Pending" / "Rejected": 68.62 × 20, 3px corners, Poppins Medium 10 in the status colour. */
export function OvertimeStatusChip({ status }: { status: OvertimeStatus }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[4.25rem] items-center justify-center rounded-[3px] px-2 py-1 text-[0.625rem] leading-none font-medium whitespace-nowrap',
        overtimeChipClass[status],
      )}
    >
      {OVERTIME_STATUS_LABELS[status]}
    </span>
  )
}

/** Employees cell: the 28px photo with a 1px #B9B9B9 ring, the name Poppins Medium 11 and the code Regular 9. */
export function OvertimePersonCell({
  name,
  code,
  photoUrl,
}: {
  name: string
  code: string
  photoUrl?: string | null
}) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <EmployeeAvatar
        name={name}
        photoUrl={photoUrl ?? null}
        className="size-7 shrink-0 ring-1 ring-[#B9B9B9] dark:ring-border"
      />
      <span className="min-w-0">
        <span className={personNameClass}>{name}</span>
        <span className={personCodeClass}>{code}</span>
      </span>
    </span>
  )
}

/** The title row of a tab: the Poppins Medium 20 title on the left, the buttons on the right. */
export function OvertimeTitleRow({
  title,
  titleId,
  children,
}: {
  title: string
  titleId: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id={titleId} className={pageTitleClass}>
        {title}
      </h2>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  )
}

/** "Filter" with the design's page-info icon: outlined, or filled navy on Overtime Applications. */
export function OvertimeFilterButton({
  filled = false,
  open,
  onClick,
}: {
  filled?: boolean
  open: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant={filled ? 'default' : 'outline'}
      aria-expanded={open}
      onClick={onClick}
      className={filled ? overtimeFilledFilterClass : overtimeOutlineButtonClass}
    >
      <FilterSlidersIcon className="size-5" /> Filter
    </Button>
  )
}

/** The grey panel the Filter button opens, with the tab's filters inside. */
export function OvertimeFilterPanel({ children }: { children: ReactNode }) {
  return (
    <div className="@container grid gap-3 rounded-md bg-muted/50 p-3">
      <div className="grid grid-cols-1 gap-3 @md:grid-cols-2 @2xl:grid-cols-4">{children}</div>
    </div>
  )
}

/** "Showing 1 to 10 of 23 applications" and the pager. */
export function OvertimeListFooter({
  meta,
  noun,
  disabled,
  onPageChange,
}: {
  meta: PaginationMeta | undefined
  noun: string
  disabled: boolean
  onPageChange: (page: number) => void
}) {
  if (!meta || meta.total === 0) return null
  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        Showing {(meta.page - 1) * meta.pageSize + 1} to{' '}
        {Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total} {noun}
      </p>
      <Pagination
        page={meta.page}
        totalPages={meta.totalPages}
        disabled={disabled}
        onPageChange={onPageChange}
      />
    </div>
  )
}

/** The empty line under a list. */
export function OvertimeEmpty({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-grey">{children}</p>
}

interface OvertimeDialogProps {
  title: string
  /** Read to screen readers under the title. */
  description?: string
  /** `poppins`: the Apply / Create / Slab popups; `inter`: the Overtime Policy popup. */
  tone?: 'poppins' | 'inter'
  onClose: () => void
  /** The form the submit button sends (`form` attribute), or a click handler. */
  formId?: string
  onSubmit?: () => void
  submitLabel?: string
  /** View popups: Cancel only. */
  readOnly?: boolean
  pending?: boolean
  /** A form-level error, under the buttons. */
  error?: string | null | undefined
  /** Extra buttons after the submit (Reject…). */
  actions?: ReactNode
  cancelLabel?: string
  className?: string
  children: ReactNode
}

/**
 * The Overtime popups as drawn: the title at the top left, the fields, and Cancel (red)
 * then Apply / Create / Save (navy) at the bottom left, 180 × 48 with 8px corners.
 */
export function OvertimeDialog({
  title,
  description,
  tone = 'poppins',
  onClose,
  formId,
  onSubmit,
  submitLabel = 'Save',
  readOnly = false,
  pending = false,
  error,
  actions,
  cancelLabel = 'Cancel',
  className,
  children,
}: OvertimeDialogProps) {
  const inter = tone === 'inter'
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showClose={false}
        className={cn(
          inter ? policyDialogClass : overtimeDialogClass,
          inter ? policyFieldsClass : overtimeFieldsClass,
          className,
        )}
      >
        <DialogTitle className={inter ? policyDialogTitleClass : overtimeDialogTitleClass}>
          {title}
        </DialogTitle>
        <DialogDescription className="sr-only">{description ?? title}</DialogDescription>
        <div className="@container min-h-0 flex-1 overflow-y-auto pt-6">{children}</div>
        <div className="flex flex-wrap items-center gap-4 pt-6 sm:gap-6">
          <Button type="button" onClick={onClose} className={dialogCancelButtonClass}>
            {cancelLabel}
          </Button>
          {!readOnly && (
            <Button
              type={formId ? 'submit' : 'button'}
              form={formId}
              onClick={formId ? undefined : onSubmit}
              disabled={pending}
              className={dialogSubmitButtonClass}
            >
              {submitLabel}
            </Button>
          )}
          {actions}
          {error && (
            <p role="alert" className="basis-full text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** A grey read-only box in a Poppins popup: label Poppins 14 #303030, value Poppins 14 #707070. */
export function OvertimeReadOnly({
  label,
  value,
  className,
}: {
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid min-w-0 gap-2', className)}>
      <span className="text-sm leading-none text-title">{label}</span>
      <span
        role="textbox"
        aria-readonly="true"
        aria-label={label}
        className="flex min-h-10 items-center rounded-lg bg-chip/60 px-4 py-2 text-sm text-grey dark:bg-input"
      >
        <span className="truncate">{value}</span>
      </span>
    </div>
  )
}
