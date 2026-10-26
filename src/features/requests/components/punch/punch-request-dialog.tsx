import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { AppDialog } from '@/components/feedback/app-dialog'
import {
  DatePickerField,
  FieldLayoutContext,
  SelectField,
  TextareaField,
  TimePickerField,
} from '@/components/form'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import type { FileRef } from '@/lib/files'
import { cn } from '@/lib/utils'

import { type RequestBody, typePermission } from '../../api/backend'
import { engineApi } from '../../api/engine.api'
import { currentPerson } from '../../api/lookups.api'
import { PUNCH_TYPE_LABELS } from '../../constants'
import {
  useCreateRequest,
  useDayShift,
  useRequestDetail,
  useUpdateRequest,
} from '../../hooks/use-requests'
import { punchRequestSchema, type PunchRequestValues } from '../../schemas/request-forms.schema'
import { PUNCH_REQUEST_TYPES, type PunchRequest } from '../../types/requests.types'
import { clock } from '../../utils/request-format'
import { RequestEmployeeField } from '../shared/request-employee-field'
import { RequestFileField, RequestFileLinks } from '../shared/request-files'
import {
  punchDialogButtonClass,
  punchDialogTitleClass,
  punchFieldsClass,
} from '../shared/request-styles'

const TYPE_OPTIONS = PUNCH_REQUEST_TYPES.map((type) => ({
  value: type,
  label: PUNCH_TYPE_LABELS[type],
}))
/** The API's field names → the form's. */
const FIELD_OF: Record<string, 'employeeId' | 'date' | 'punchType' | 'punchTime' | 'description'> =
  {
    employeeId: 'employeeId',
    punchDate: 'date',
    fromDate: 'date',
    punchType: 'punchType',
    punchTime: 'punchTime',
    description: 'description',
  }

function ReadOnlyTime({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2.5">
      <span className="text-sm leading-none text-title">{label}</span>
      <span
        role="textbox"
        aria-readonly="true"
        aria-label={label}
        className="flex h-9 items-center rounded-md bg-chip px-3 text-sm text-sidebar dark:bg-input dark:text-heading"
      >
        {value}
      </span>
    </div>
  )
}

/**
 * Punch Request Create (and Edit): the day's expected times come from the
 * schedule (`/scheduling/schedules`); All adds the Employee picker. The punch
 * goes to the API as `details { punchDate, punchType, punchTime }`; an
 * attachment is uploaded first and sent by id.
 */
export function PunchRequestDialog({
  forOthers,
  request,
  onClose,
}: {
  /** All: pick the employee; My: the signed-in person. */
  forOthers: boolean
  /** Edit this request; create a new one when absent. */
  request?: PunchRequest
  onClose: () => void
}) {
  const create = useCreateRequest('punch')
  const update = useUpdateRequest('punch')
  const detail = useRequestDetail('punch', request?.id ?? '', 'request')
  const [file, setFile] = useState<FileRef | null>(null)
  const form = useForm<PunchRequestValues>({
    resolver: zodResolver(punchRequestSchema),
    defaultValues: request
      ? {
          employeeId: request.employee.id,
          date: request.payload.punchDate ?? request.fromDate ?? '',
          punchType: request.payload.punchType,
          punchTime: request.payload.punchTime.slice(0, 5),
          description: request.description ?? '',
        }
      : { employeeId: '', date: '', punchType: '', punchTime: '', description: '' },
  })
  const { control } = form
  const [employeeId, date] = useWatch({ control, name: ['employeeId', 'date'] })
  const showEmployee = forOthers && !request
  const waitingForEmployee = showEmployee && !employeeId
  const shift = useDayShift(
    showEmployee ? employeeId : (request?.employee.id ?? currentPerson()?.id),
    waitingForEmployee ? '' : date,
  )

  const submit = form.handleSubmit(async (values) => {
    if (showEmployee && !values.employeeId) {
      form.setError('employeeId', { message: 'Choose the employee' })
      return
    }
    if (!values.punchType) return
    const body: RequestBody = {
      ...(showEmployee ? { employeeId: values.employeeId } : {}),
      fromDate: values.date,
      toDate: values.date,
      description: values.description.trim() || null,
      details: {
        punchDate: values.date,
        punchType: values.punchType,
        punchTime: values.punchTime,
      },
    }
    try {
      if (request) {
        await update.mutateAsync({
          id: request.id,
          body: { ...body, rowVersion: request.rowVersion },
        })
        if (file) await engineApi.addAttachment('punch', request.id, file.id)
      } else {
        await create.mutateAsync({ ...body, attachments: file ? [file.id] : [] })
      }
    } catch (error) {
      if (error instanceof ApiError) {
        const fields = Object.entries(error.fieldErrors)
        let shown = false
        for (const [field, message] of fields) {
          const name = FIELD_OF[field]
          if (name) {
            form.setError(name, { message })
            shown = true
          }
        }
        if (!shown) form.setError('root', { message: error.message })
      }
      return
    }
    onClose()
  })

  const pending = create.isPending || update.isPending
  const rootError = form.formState.errors.root?.message
  const noShift = shift.data && !shift.data.clockIn
  const existing = detail.data?.request.attachments ?? []

  return (
    <AppDialog
      title={request ? `Punch Request Edit, ${request.code}` : 'Punch Request Create'}
      onRequestClose={onClose}
      className={cn('max-w-4xl', punchFieldsClass)}
      titleClassName={punchDialogTitleClass}
      footer={
        <>
          {rootError && (
            <p role="alert" className="mr-auto self-center text-sm text-destructive">
              {rootError}
            </p>
          )}
          <Button
            type="submit"
            form="punch-request-form"
            size="lg"
            disabled={pending}
            className={cn(
              punchDialogButtonClass,
              'bg-sidebar text-white hover:bg-sidebar/90 dark:bg-primary',
            )}
          >
            Save
          </Button>
          <Button
            variant="destructive"
            size="lg"
            onClick={onClose}
            className={punchDialogButtonClass}
          >
            Cancel
          </Button>
        </>
      }
    >
      <FieldLayoutContext value="vertical">
        <form
          id="punch-request-form"
          noValidate
          onSubmit={(event) => void submit(event)}
          className="grid gap-x-8 gap-y-5 @2xl:grid-cols-3"
        >
          {showEmployee && (
            <RequestEmployeeField
              control={control}
              name="employeeId"
              permission={typePermission('punch', 'create')}
              placeholder="Enter name"
              required
              className="@2xl:col-span-3"
            />
          )}
          <DatePickerField
            control={control}
            name="date"
            label="Date"
            maxDate={new Date()}
            required
            description={
              noShift
                ? 'No shift is scheduled on this day.'
                : waitingForEmployee
                  ? 'Choose the employee first.'
                  : undefined
            }
          />
          <ReadOnlyTime
            label="Expected Check In Time"
            value={shift.data ? clock(shift.data.clockIn) : '—'}
          />
          <ReadOnlyTime
            label="Expected Check Out Time"
            value={shift.data ? clock(shift.data.clockOut) : '—'}
          />
          <SelectField
            control={control}
            name="punchType"
            label="Punch Type"
            placeholder="Select Punch Type"
            options={TYPE_OPTIONS}
            required
          />
          <TimePickerField control={control} name="punchTime" label="Punch Time" required />
          <div className="hidden @2xl:block" aria-hidden="true" />
          <div className="@2xl:col-span-3">
            {existing.length > 0 && (
              <div className="mb-2 text-sm">
                <RequestFileLinks files={existing} />
              </div>
            )}
            <RequestFileField value={file} onChange={setFile} />
          </div>
          <TextareaField
            control={control}
            name="description"
            label="Description"
            className="@2xl:col-span-3"
            textareaClassName="min-h-40"
            showCount
          />
        </form>
      </FieldLayoutContext>
    </AppDialog>
  )
}
