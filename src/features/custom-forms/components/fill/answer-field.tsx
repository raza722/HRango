import { type ReactNode, useId } from 'react'
import { type Control, useController } from 'react-hook-form'
import { Star } from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DateInput } from '@/features/payroll'
import type { FileRef } from '@/lib/files'
import { cn } from '@/lib/utils'

import { LIMITS, RATING_DEFAULT_SCALE } from '../../constants'
import { answerKey, type AnswerValues } from '../../schemas/answers.schema'
import type { FormFieldDef } from '../../types/custom-forms.types'
import { FileAnswer } from './file-answer'

const asText = (value: unknown) => (typeof value === 'string' ? value : '')
const asList = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
const asFile = (value: unknown): FileRef | null =>
  typeof value === 'object' && value !== null && 'id' in value ? (value as FileRef) : null

/** The red asterisk; screen readers hear "required" from the control itself. */
function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-1 text-[#D80027] dark:text-destructive">
      *
    </span>
  )
}

interface ShellProps {
  number: number
  field: FormFieldDef
  error: string | undefined
  /** `group`: a fieldset with a legend (options, rating); otherwise a label for one control. */
  group: boolean
  controlId: string
  helpId: string | undefined
  errorId: string | undefined
  children: ReactNode
}

/** A question's frame: the number and label, the help text, the control and its error. */
function QuestionShell({
  number,
  field,
  error,
  group,
  controlId,
  helpId,
  errorId,
  children,
}: ShellProps) {
  const title = (
    <>
      <span className="text-grey">{number}.</span> {field.label || 'Untitled question'}
      {field.required && <RequiredMark />}
      {field.required && group && <span className="sr-only"> (required)</span>}
    </>
  )
  const titleClass = 'text-sm leading-snug font-medium text-title dark:text-heading'
  const body = (
    <>
      {field.helpText && (
        <p id={helpId} className="text-xs text-grey dark:text-muted-foreground">
          {field.helpText}
        </p>
      )}
      {children}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </>
  )
  return group ? (
    <fieldset className="grid min-w-0 gap-2.5" data-invalid={Boolean(error)}>
      <legend className={cn(titleClass, 'mb-2.5')}>{title}</legend>
      {body}
    </fieldset>
  ) : (
    <div className="grid min-w-0 gap-2.5" data-invalid={Boolean(error)}>
      <label htmlFor={controlId} className={titleClass}>
        {title}
      </label>
      {body}
    </div>
  )
}

const radioClass =
  'size-4 shrink-0 accent-[#17263A] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:accent-[#8B5CF6]'

/**
 * One question of the fill form, drawn by its type: a text box, a number box, a date picker,
 * radio buttons, check boxes, a drop-down, a single tick, a file upload or a star rating.
 */
export function AnswerField({
  field,
  number,
  control,
  disabled = false,
  preview = false,
}: {
  field: FormFieldDef
  /** 1-based, across the whole form. */
  number: number
  control: Control<AnswerValues>
  disabled?: boolean
  /** The builder's preview: uploads are off. */
  preview?: boolean
}) {
  const id = useId()
  const {
    field: { ref, value: current, onChange, onBlur },
    fieldState,
  } = useController({ control, name: answerKey(field.id) })
  const error = fieldState.error?.message
  const helpId = field.helpText ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined
  const shell = (group: boolean, children: ReactNode) => (
    <QuestionShell
      number={number}
      field={field}
      error={error}
      group={group}
      controlId={id}
      helpId={helpId}
      errorId={errorId}
    >
      {children}
    </QuestionShell>
  )
  const a11y = {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': Boolean(error),
    'aria-required': field.required,
  }

  switch (field.type) {
    case 'short_text':
      return shell(
        false,
        <Input
          {...a11y}
          ref={ref}
          value={asText(current)}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          maxLength={field.max ?? LIMITS.text}
          placeholder="Your answer"
        />,
      )
    case 'long_text': {
      const text = asText(current)
      return shell(
        false,
        <>
          <Textarea
            {...a11y}
            ref={ref}
            value={text}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            maxLength={field.max ?? LIMITS.text}
            placeholder="Your answer"
            className="min-h-24"
          />
          {field.max !== null && (
            <p aria-hidden="true" className="-mt-1 text-right text-[0.6875rem] text-grey">
              {text.length} / {field.max}
            </p>
          )}
        </>,
      )
    }
    case 'number':
      return shell(
        false,
        <Input
          {...a11y}
          ref={ref}
          inputMode="decimal"
          value={asText(current)}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={
            field.min !== null && field.max !== null
              ? `${String(field.min)} to ${String(field.max)}`
              : 'A number'
          }
          className="max-w-xs"
        />,
      )
    case 'date':
      return shell(
        false,
        <DateInput
          id={id}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          value={asText(current)}
          onChange={(next) => {
            onChange(next)
            onBlur()
          }}
          disabled={disabled}
          placeholder="Pick a date"
          className="max-w-xs"
        />,
      )
    case 'dropdown': {
      const value = asText(current)
      return shell(
        false,
        <Select
          value={value}
          disabled={disabled}
          onValueChange={(next) => {
            onChange(next)
          }}
        >
          <SelectTrigger {...a11y} ref={ref} onBlur={onBlur} className="w-full max-w-sm">
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label || 'Untitled option'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>,
      )
    }
    case 'single_choice': {
      const value = asText(current)
      return shell(
        true,
        <div role="radiogroup" aria-describedby={describedBy} className="grid gap-2">
          {field.options.map((option) => (
            <label
              key={option.id}
              className="flex items-center gap-2.5 text-sm text-title dark:text-heading"
            >
              <input
                type="radio"
                name={`${id}-choice`}
                value={option.id}
                checked={value === option.id}
                disabled={disabled}
                onChange={() => {
                  onChange(option.id)
                }}
                onBlur={onBlur}
                aria-invalid={Boolean(error)}
                className={radioClass}
              />
              {option.label || 'Untitled option'}
            </label>
          ))}
        </div>,
      )
    }
    case 'multiple_choice': {
      const picked = asList(current)
      const hint =
        field.min !== null && field.max !== null
          ? `Choose ${String(field.min)} to ${String(field.max)}.`
          : field.max !== null
            ? `Choose up to ${String(field.max)}.`
            : field.min !== null
              ? `Choose at least ${String(field.min)}.`
              : null
      return shell(
        true,
        <div className="grid gap-2" aria-describedby={describedBy}>
          {hint && !field.helpText && <p className="-mt-1 text-xs text-grey">{hint}</p>}
          {field.options.map((option) => {
            const checkboxId = `${id}-${option.id}`
            return (
              <div key={option.id} className="flex items-center gap-2.5">
                <Checkbox
                  id={checkboxId}
                  tone="navy"
                  checked={picked.includes(option.id)}
                  disabled={disabled}
                  aria-invalid={Boolean(error)}
                  onCheckedChange={(checked) => {
                    onChange(
                      checked === true
                        ? [...picked, option.id]
                        : picked.filter((item) => item !== option.id),
                    )
                  }}
                  onBlur={onBlur}
                />
                <label htmlFor={checkboxId} className="text-sm text-title dark:text-heading">
                  {option.label || 'Untitled option'}
                </label>
              </div>
            )
          })}
        </div>,
      )
    }
    case 'checkbox':
      return (
        <div className="grid gap-2" data-invalid={Boolean(error)}>
          <div className="flex items-start gap-2.5">
            <Checkbox
              {...a11y}
              tone="navy"
              ref={ref}
              checked={current === true}
              disabled={disabled}
              onCheckedChange={(checked) => {
                onChange(checked === true)
              }}
              onBlur={onBlur}
              className="mt-0.5"
            />
            <label
              htmlFor={id}
              className="text-sm leading-snug font-medium text-title dark:text-heading"
            >
              <span className="text-grey">{number}.</span> {field.label || 'Untitled question'}
              {field.required && <RequiredMark />}
            </label>
          </div>
          {field.helpText && (
            <p id={helpId} className="pl-7 text-xs text-grey dark:text-muted-foreground">
              {field.helpText}
            </p>
          )}
          {error && (
            <p id={errorId} className="pl-7 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      )
    case 'file':
      return shell(
        false,
        <FileAnswer
          id={id}
          label={field.label || `question ${String(number)}`}
          value={asFile(current)}
          onChange={(file) => {
            onChange(file)
            onBlur()
          }}
          disabled={disabled || preview}
          {...(preview ? { disabledNote: 'Uploads are off in the preview.' } : {})}
          describedBy={describedBy}
          invalid={Boolean(error)}
        />,
      )
    case 'rating': {
      const scale = field.max ?? RATING_DEFAULT_SCALE
      const value = typeof current === 'number' ? current : 0
      return shell(
        true,
        <div
          role="radiogroup"
          aria-describedby={describedBy}
          className="flex flex-wrap items-center gap-1"
        >
          {Array.from({ length: scale }, (_, index) => {
            const star = index + 1
            const on = star <= value
            return (
              <label
                key={star}
                className={cn(
                  'flex size-9 cursor-pointer items-center justify-center rounded-md outline-none has-focus-visible:ring-2 has-focus-visible:ring-ring/50 pointer-coarse:size-10',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <input
                  type="radio"
                  name={`${id}-rating`}
                  value={star}
                  checked={value === star}
                  disabled={disabled}
                  onChange={() => {
                    onChange(star)
                  }}
                  onBlur={onBlur}
                  className="sr-only"
                  aria-label={`${String(star)} out of ${String(scale)}`}
                />
                <Star
                  aria-hidden="true"
                  className={cn(
                    'size-6',
                    on
                      ? 'fill-[#F5B301] text-[#F5B301]'
                      : 'text-[#CFCFCF] dark:text-muted-foreground',
                  )}
                />
              </label>
            )
          })}
          <span className="ml-2 text-xs text-grey" aria-hidden="true">
            {value > 0 ? `${String(value)} / ${String(scale)}` : 'Not rated'}
          </span>
        </div>,
      )
    }
  }
}
