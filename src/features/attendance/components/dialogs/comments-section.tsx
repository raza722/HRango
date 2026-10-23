import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, parseISO } from 'date-fns'
import { ChevronDown, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { useAddComment, useDeleteComment } from '../../hooks/use-attendance'
import { commentSchema, type CommentValues } from '../../schemas/time-sheet.schema'
import type { AttendanceComment, DayKey } from '../../types/attendance.types'

/**
 * "Comments Details": a grey bar that opens the day's comments (author, code,
 * date, text, red remove) and a box to add one. Comments save on their own,
 * independent of the time sheet's Save.
 */
export function CommentsSection({
  dayKey,
  comments,
}: {
  dayKey: DayKey
  comments: readonly AttendanceComment[]
}) {
  const panelId = useId()
  const fieldId = useId()
  const [open, setOpen] = useState(comments.length > 0)
  const add = useAddComment(dayKey)
  const remove = useDeleteComment(dayKey)
  const form = useForm<CommentValues>({
    resolver: zodResolver(commentSchema),
    defaultValues: { text: '' },
  })
  const error = form.formState.errors.text?.message

  const submit = form.handleSubmit(async ({ text }) => {
    try {
      await add.mutateAsync(text.trim())
    } catch {
      return // The toast explains; the text stays for another try.
    }
    form.reset({ text: '' })
  })

  return (
    <section aria-labelledby={`${panelId}-title`} className="grid gap-3">
      <h3 id={`${panelId}-title`} className="text-xl font-medium text-heading sm:text-2xl">
        Comments
      </h3>
      <div className="overflow-hidden rounded-md bg-chip dark:bg-input">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen((value) => !value)
          }}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-base font-medium text-grey underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset sm:text-[1.4375rem]"
        >
          Comments Details{comments.length > 0 ? ` (${comments.length})` : ''}
          <ChevronDown
            aria-hidden="true"
            className={cn('size-5 no-underline transition-transform', open && 'rotate-180')}
          />
        </button>

        {open && (
          <div id={panelId} className="grid gap-3 px-3 pb-4 sm:px-4">
            {comments.length > 0 && (
              <ul className="grid gap-3">
                {comments.map((comment) => (
                  <li key={comment.id} className="grid gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="flex items-center gap-2 text-sm font-medium text-grey sm:text-[1.4375rem]">
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
                        {comment.author.name} - {comment.author.code}{' '}
                        {format(parseISO(comment.createdAt), 'MMMM d, yyyy')}
                      </p>
                      <button
                        type="button"
                        aria-label={`Delete the comment by ${comment.author.name}`}
                        disabled={remove.isPending}
                        onClick={() => {
                          remove.mutate(comment.id)
                        }}
                        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive text-white outline-none hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                      >
                        <X className="size-3.5" strokeWidth={2.5} />
                      </button>
                    </div>
                    <p className="rounded-sm bg-success/15 px-3 py-2 text-sm whitespace-pre-line text-heading">
                      {comment.text}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={(event) => void submit(event)} className="grid gap-3" noValidate>
              <label htmlFor={fieldId} className="sr-only">
                New comment
              </label>
              <Textarea
                id={fieldId}
                placeholder="Type your Message here"
                rows={4}
                maxLength={500}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${fieldId}-error` : undefined}
                className="bg-card placeholder:font-medium placeholder:text-[#585858] dark:placeholder:text-label"
                {...form.register('text')}
              />
              {error && (
                <p id={`${fieldId}-error`} role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={add.isPending}
                className="w-fit bg-[#3B6FF5] px-5 text-white hover:bg-[#3B6FF5]/90"
              >
                Comment
              </Button>
            </form>
          </div>
        )}
      </div>
    </section>
  )
}
