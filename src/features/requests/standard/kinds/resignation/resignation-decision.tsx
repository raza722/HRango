import { useEffect } from 'react'
import { parse } from 'date-fns'

import { FieldLayoutContext, FormField } from '@/components/form'
import { Checkbox } from '@/components/ui/checkbox'
import { DateInput, dialogFieldType } from '@/features/payroll'

import type { StandardDecisionFieldsProps } from '../../standard.types'
import type { ResignationPayload } from './resignation.types'
import { noticeDaysOf } from './resignation.utils'

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())

/**
 * The approver's part of the Approve popup (`details` of the approval):
 * Last Working Date, Serve Notice and the notice period in days. The FRD asks
 * for the last working date before the final approval; the API keeps what is
 * given and works the notice period out from the two dates when left out.
 */
export function ResignationDecisionFields({
  request,
  readOnly,
  value,
  onChange,
  errors,
}: StandardDecisionFieldsProps<ResignationPayload>) {
  const { payload } = request

  useEffect(() => {
    if (readOnly) return
    onChange({
      lastWorkingDate: payload.lastWorkingDate,
      serveNotice: payload.serveNotice,
      noticePeriodDays: payload.noticePeriodDays,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the popup opens
  }, [readOnly])

  // View: the detail rows already show these.
  if (readOnly) return null

  const lastWorkingDate = typeof value.lastWorkingDate === 'string' ? value.lastWorkingDate : ''
  const notice = typeof value.noticePeriodDays === 'number' ? value.noticePeriodDays : null
  return (
    <FieldLayoutContext value="horizontal">
      <div className={`grid gap-6 ${dialogFieldType}`}>
        <FormField label="Last Working Date" error={errors.lastWorkingDate}>
          {(a11y) => (
            <DateInput
              id={a11y.id}
              value={lastWorkingDate}
              onChange={(next) => {
                onChange({
                  ...value,
                  lastWorkingDate: next || null,
                  noticePeriodDays: noticeDaysOf(payload.resignationDate, next || null),
                })
              }}
              {...(payload.resignationDate ? { minDate: day(payload.resignationDate) } : {})}
            />
          )}
        </FormField>
        <FormField label="Notice Period (Days)" error={errors.noticePeriodDays}>
          {(a11y) => (
            <span
              id={a11y.id}
              className="flex h-10 items-center rounded-md bg-[#D9D9D9]/60 px-4 font-inter text-sm text-field-value dark:bg-muted"
            >
              {notice === null ? '—' : String(notice)}
            </span>
          )}
        </FormField>
        <FormField label="Serve Notice" error={errors.serveNotice}>
          {(a11y) => (
            <span className="flex h-10 items-center">
              <Checkbox
                id={a11y.id}
                tone="navy"
                checked={value.serveNotice === true}
                onCheckedChange={(checked) => {
                  onChange({ ...value, serveNotice: checked === true })
                }}
                className="size-5 rounded-[0.125rem]"
              />
            </span>
          )}
        </FormField>
      </div>
    </FieldLayoutContext>
  )
}
