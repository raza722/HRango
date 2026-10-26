import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { z } from 'zod'

import { TextareaField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { DateField, PayrollDialog, SearchSelectField } from '@/features/payroll'
import type { FileRef } from '@/lib/files'
import { cn } from '@/lib/utils'

import { RequestFileField } from '../../../components/shared/request-files'
import { detailFileRef } from '../../../utils/request-files'
import { standardButton } from '../../standard-styles'
import { CNIC_PATTERN, RELATIONSHIPS, viewDay } from './loan-advances.constants'
import type { LoanGuarantor } from './loan-advances.types'

const schema = z.object({
  name: z.string().trim().min(1, 'Write the name').max(80, 'Keep it under 80 characters'),
  cnic: z.string().trim().regex(CNIC_PATTERN, 'Write the CNIC as 12345-1234567-1'),
  knownSince: z.string().min(1, 'Choose since when'),
  relationship: z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message: 'Choose the relationship' }),
  extensionNo: z
    .string()
    .trim()
    .regex(/^\d{0,6}$/, 'Up to 6 digits'),
  description: z.string().trim().max(500, 'Keep it under 500 characters'),
})
type Values = z.infer<typeof schema>

const endOfToday = () => {
  const date = new Date()
  date.setHours(23, 59, 59, 999)
  return date
}

/**
 * "Guarantor Create" (frames 4183:54518, 4187:55182): Name, CNIC, Attachment,
 * Known Since, Relationship, Extension No and Description. Save adds the
 * guarantor to the request's list; the request is saved with them.
 */
export function GuarantorDialog({
  guarantor,
  onSave,
  onClose,
}: {
  guarantor: LoanGuarantor | null
  onSave: (guarantor: LoanGuarantor) => void
  onClose: () => void
}) {
  const formId = useId()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: guarantor?.name ?? '',
      cnic: guarantor?.cnic ?? '',
      knownSince: guarantor?.knownSince ?? '',
      relationship: guarantor?.relationship ?? null,
      extensionNo: guarantor?.extensionNo ?? '',
      description: guarantor?.description ?? '',
    },
  })
  const [file, setFile] = useState<FileRef | null>(guarantor ? detailFileRef(guarantor) : null)
  const submit = form.handleSubmit((values) => {
    onSave({
      ...values,
      relationship: values.relationship ?? '',
      fileId: file?.id ?? null,
      fileName: file?.name ?? null,
      fileUrl: file?.url ?? null,
    })
  })

  return (
    <PayrollDialog
      title={guarantor ? 'Guarantor Edit' : 'Guarantor Create'}
      // Drawn as Inter Regular 16 #000000, not the usual popup title.
      titleClassName="font-inter text-base font-normal text-heading sm:text-base"
      onClose={onClose}
      formId={formId}
      className="max-w-3xl"
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          // The Create form is this popup's parent in React: keep its submit out of it.
          event.stopPropagation()
          void submit(event)
        }}
        className="grid gap-5"
      >
        <TextField
          control={form.control}
          name="name"
          label="Name"
          required
          placeholder="Write Name Here"
          maxLength={80}
        />
        <TextField
          control={form.control}
          name="cnic"
          label="CNIC"
          required
          placeholder="12345-1234567-1"
          inputMode="numeric"
          maxLength={15}
        />
        <RequestFileField value={file} onChange={setFile} />
        <DateField
          control={form.control}
          name="knownSince"
          label="Known Since"
          required
          maxDate={endOfToday()}
        />
        <SearchSelectField
          control={form.control}
          name="relationship"
          label="Relationship"
          required
          placeholder="Select Relationship"
          options={RELATIONSHIPS.map((value) => ({ value, label: value }))}
        />
        <TextField
          control={form.control}
          name="extensionNo"
          label="Extension No"
          inputMode="numeric"
          maxLength={6}
        />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          rows={4}
          maxLength={500}
        />
      </form>
    </PayrollDialog>
  )
}

/** Popup tables: Poppins Medium 11 #303030 headers, Poppins Regular 12 #707070 cells. */
const tableClass =
  'w-full font-sans text-xs [&_td]:px-3 [&_td]:py-2 [&_td]:text-grey [&_th]:bg-sidebar/[0.06] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[0.6875rem] [&_th]:font-medium [&_th]:text-title dark:[&_th]:bg-muted'

/**
 * "Guarantor *" with "+ Add" on the Create form, and the guarantors added so
 * far (each can be edited or removed).
 */
export function GuarantorsRow({
  guarantors,
  required,
  error,
  disabled,
  onAdd,
  onEdit,
  onRemove,
}: {
  guarantors: readonly LoanGuarantor[]
  required: boolean
  error: string | null
  disabled: boolean
  onAdd: () => void
  onEdit: (index: number) => void
  onRemove: (index: number) => void
}) {
  const labelId = useId()
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="grid content-start gap-x-6 gap-y-2.5 @xl:grid-cols-[10rem_minmax(0,1fr)] @3xl:grid-cols-[11rem_minmax(0,1fr)]"
    >
      <span
        id={labelId}
        data-slot="label"
        className="flex items-center gap-1 text-sm leading-snug text-heading/80 @xl:min-h-10 @xl:self-start @xl:py-2 @xl:text-[0.9375rem]"
      >
        <span>
          Guarantor
          {required && (
            <span aria-hidden="true" className="ml-1 text-destructive">
              *
            </span>
          )}
        </span>
      </span>
      <div className="grid min-w-0 gap-2.5">
        <div>
          <Button
            type="button"
            disabled={disabled}
            onClick={onAdd}
            aria-label="Add guarantor"
            className={cn(
              'h-8 gap-1 rounded-[5px] px-4 font-sans text-xs font-medium',
              standardButton.navy,
            )}
          >
            <Plus aria-hidden="true" className="size-3.5" /> Add
          </Button>
        </div>
        {guarantors.length > 0 && (
          <div className="overflow-x-auto rounded-md">
            <table className={cn(tableClass, 'min-w-[30rem]')}>
              <caption className="sr-only">Guarantors</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">CNIC</th>
                  <th scope="col">Relationship</th>
                  <th scope="col">Known Since</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {guarantors.map((guarantor, index) => (
                  <tr key={`${guarantor.cnic}-${String(index)}`} className="border-b last:border-0">
                    <td className="font-medium text-person">{guarantor.name}</td>
                    <td className="whitespace-nowrap">{guarantor.cnic}</td>
                    <td>{guarantor.relationship}</td>
                    <td className="whitespace-nowrap">{viewDay(guarantor.knownSince)}</td>
                    <td>
                      <span className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={disabled}
                          aria-label={`Edit ${guarantor.name}`}
                          onClick={() => {
                            onEdit(index)
                          }}
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={disabled}
                          aria-label={`Remove ${guarantor.name}`}
                          onClick={() => {
                            onRemove(index)
                          }}
                          className="text-destructive"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {error && (
          <p role="alert" className="-mt-1 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
