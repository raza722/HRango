import { type ReactNode, useId, useState } from 'react'
import { addDays, format } from 'date-fns'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { useDecideExtension, useRequestExtension } from '../../hooks/use-pm'
import { pmButton, pmCloseButton } from '../../pm-styles'
import type { ExtensionRequest, TaskRow } from '../../types/pm.types'
import { formatCellDate, fromDay } from '../task-fields/field-utils'
import { CloseIcon } from './workspace-icons'
import { popupStyles } from './workspace-styles'

const REASON_MAX = 1000

/** The frame of both popups: title, description, the red ×, then the form. */
function ExtensionDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={false} className="max-w-[30rem] gap-0 rounded-[1.125rem] p-0">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="font-sans text-xl font-medium text-[#303030] sm:text-xl dark:text-title">
                {title}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-[#707070] dark:text-grey">
                {description}
              </DialogDescription>
            </div>
            <DialogClose className={pmCloseButton} aria-label="Close">
              <CloseIcon className="size-4" />
            </DialogClose>
          </div>
          {open && children}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** A field's label, box and error, in the PM popups' look. */
function Field({
  label,
  error,
  children,
}: {
  label: string
  error: string | undefined
  children: (a11y: {
    id: string
    'aria-invalid': boolean
    'aria-describedby'?: string
  }) => ReactNode
}) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-[#303030] dark:text-title">
        {label}
      </label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        ...(error ? { 'aria-describedby': errorId } : {}),
      })}
      {error && (
        <p id={errorId} className="text-xs text-[#DC3545] dark:text-[#FF8A94]">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Request Extension (not drawn; the BRD's overdue handling): an assignee asks for a later due
 * date with a reason (`POST /projects/tasks/{id}/extension-requests`). A manager answers it.
 */
export function ExtensionRequestDialog({
  task,
  open,
  onOpenChange,
}: {
  task: Pick<TaskRow, 'id' | 'name' | 'dueDate'>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <ExtensionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Request Extension"
      description={
        task.dueDate
          ? `${task.name} is due ${formatCellDate(task.dueDate)}. A manager of the workspace answers.`
          : task.name
      }
    >
      <RequestForm
        task={task}
        onDone={() => {
          onOpenChange(false)
        }}
      />
    </ExtensionDialog>
  )
}

function RequestForm({
  task,
  onDone,
}: {
  task: Pick<TaskRow, 'id' | 'dueDate'>
  onDone: () => void
}) {
  const request = useRequestExtension()
  const [newDueDate, setNewDueDate] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<{ newDueDate?: string; reason?: string; root?: string }>({})
  // The first day it may move to: the day after the due date, and never a day already past.
  const today = format(new Date(), 'yyyy-MM-dd')
  const afterDue = task.dueDate
    ? format(addDays(fromDay(task.dueDate), 1), 'yyyy-MM-dd')
    : undefined
  const earliest = afterDue && afterDue > today ? afterDue : today

  const submit = async () => {
    const found: typeof errors = {}
    if (!newDueDate) found.newDueDate = 'Choose the new due date'
    else if (newDueDate < today) found.newDueDate = 'Choose today or a later date'
    else if (afterDue && newDueDate < afterDue) {
      found.newDueDate = `Choose a date after ${formatCellDate(task.dueDate ?? newDueDate)}`
    }
    if (!reason.trim()) found.reason = 'Give the reason'
    else if (reason.trim().length > REASON_MAX) {
      found.reason = `Keep it under ${String(REASON_MAX)} characters`
    }
    setErrors(found)
    if (Object.keys(found).length > 0) return
    try {
      await request.mutateAsync({ taskId: task.id, input: { newDueDate, reason: reason.trim() } })
    } catch (failure) {
      if (failure instanceof ApiError) {
        setErrors({
          ...(failure.fieldErrors.newDueDate ? { newDueDate: failure.fieldErrors.newDueDate } : {}),
          ...(failure.fieldErrors.reason ? { reason: failure.fieldErrors.reason } : {}),
          ...(!failure.fieldErrors.newDueDate && !failure.fieldErrors.reason
            ? { root: failure.message }
            : {}),
        })
      }
      return
    }
    onDone()
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      className="grid gap-4"
    >
      <Field label="New Due Date" error={errors.newDueDate}>
        {(a11y) => (
          <input
            {...a11y}
            type="date"
            min={earliest}
            value={newDueDate}
            onChange={(event) => {
              setNewDueDate(event.target.value)
            }}
            className={popupStyles.field}
          />
        )}
      </Field>
      <Field label="Reason" error={errors.reason}>
        {(a11y) => (
          <textarea
            {...a11y}
            rows={4}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
            }}
            placeholder="Why does it need more time?"
            className={cn(popupStyles.field, 'resize-y')}
          />
        )}
      </Field>
      {errors.root && (
        <p role="alert" className="text-sm text-[#DC3545] dark:text-[#FF8A94]">
          {errors.root}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <DialogClose className={cn(pmButton.cancel, 'h-11')}>Cancel</DialogClose>
        <button type="submit" disabled={request.isPending} className={cn(pmButton.primary, 'h-11')}>
          Send Request
        </button>
      </div>
    </form>
  )
}

/**
 * Approve / Reject an extension request (`PATCH /projects/extension-requests/{id}/approve |
 * reject`): approving moves the due date to the one asked for; rejecting needs remarks.
 */
export function ExtensionDecisionDialog({
  taskName,
  extension,
  decision,
  open,
  onOpenChange,
}: {
  taskName: string
  extension: ExtensionRequest
  decision: 'approve' | 'reject'
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const approving = decision === 'approve'
  return (
    <ExtensionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={approving ? 'Approve Extension' : 'Reject Extension'}
      description={`${extension.requestedByName} asks to move ${taskName} from ${
        extension.oldDueDate ? formatCellDate(extension.oldDueDate) : 'no due date'
      } to ${formatCellDate(extension.newDueDate)}.`}
    >
      <DecisionForm
        extension={extension}
        decision={decision}
        onDone={() => {
          onOpenChange(false)
        }}
      />
    </ExtensionDialog>
  )
}

function DecisionForm({
  extension,
  decision,
  onDone,
}: {
  extension: ExtensionRequest
  decision: 'approve' | 'reject'
  onDone: () => void
}) {
  const decide = useDecideExtension()
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [failure, setFailure] = useState<string | null>(null)
  const approving = decision === 'approve'

  const submit = async () => {
    if (!approving && !remarks.trim()) {
      setError('Give the reason for rejecting')
      return
    }
    setError(undefined)
    setFailure(null)
    try {
      await decide.mutateAsync({ extension, decision, remarks: remarks.trim() || null })
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.fieldErrors.remarks) setError(caught.fieldErrors.remarks)
        else setFailure(caught.message)
      }
      return
    }
    onDone()
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      className="grid gap-4"
    >
      {extension.reason && (
        <p className="rounded-xl bg-[#F8F5FF] px-3 py-2 text-sm text-[#4A4A4A] dark:bg-[#7127EA]/10 dark:text-title">
          <span className="font-medium text-[#303030] dark:text-title">Reason: </span>
          {extension.reason}
        </p>
      )}
      <Field label={approving ? 'Remarks (optional)' : 'Reason for Rejecting'} error={error}>
        {(a11y) => (
          <textarea
            {...a11y}
            rows={3}
            maxLength={REASON_MAX}
            value={remarks}
            onChange={(event) => {
              setRemarks(event.target.value)
            }}
            className={cn(popupStyles.field, 'resize-y')}
          />
        )}
      </Field>
      {failure && (
        <p role="alert" className="text-sm text-[#DC3545] dark:text-[#FF8A94]">
          {failure}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <DialogClose className={cn(pmButton.back, 'h-11')}>Cancel</DialogClose>
        <button
          type="submit"
          disabled={decide.isPending}
          className={cn(approving ? pmButton.primary : pmButton.cancel, 'h-11')}
        >
          {approving ? 'Approve' : 'Reject'}
        </button>
      </div>
    </form>
  )
}
