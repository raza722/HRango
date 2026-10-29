import { useEffect } from 'react'
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  useController,
  useForm,
  useWatch,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  DatePickerField,
  FormField,
  SelectField,
  SwitchField,
  TextareaField,
  TextField,
} from '@/components/form'
import { Input } from '@/components/ui/input'
import { parseDateValue } from '@/lib/date'
import type { FileRef } from '@/lib/files'

import { employeeKeys, employeesApi } from '../../api/employees.api'
import { CONTRACT_DURATIONS, CONTRACT_TYPE_LABELS, DOCUMENT_TYPE_LABELS } from '../../constants'
import { useSaveChild } from '../../hooks/use-employees'
import {
  academicFormSchema,
  type AcademicFormValues,
  academicToForm,
  academicToInput,
  contractEnd,
  contractFormSchema,
  type ContractFormValues,
  contractToForm,
  contractToInput,
  documentFormSchema,
  type DocumentFormValues,
  documentToForm,
  documentToInput,
  experienceFormSchema,
  type ExperienceFormValues,
  experienceToForm,
  experienceToInput,
} from '../../schemas/employee-forms.schema'
import {
  type Contract,
  CONTRACT_TYPES,
  DOCUMENT_TYPES,
  type Education,
  type Employee,
  type EmployeeDocument,
  type Experience,
} from '../../types/employees.types'
import { showServerErrors } from '../../utils/form-errors'
import { navySwitchClass } from '../../utils/styles'
import { FormDialog } from '../shared/form-dialog'
import { FilePickerField } from '../shared/parts'

/** API field → form field for the file pickers. */
const FILE_FIELD = { fileId: 'file' } as const

/** A FilePickerField bound to a `FileRef | null` field of a form. */
function FileField<T extends FieldValues>({
  control,
  name,
  label,
}: {
  control: Control<T>
  name: FieldPathByValue<T, FileRef | null>
  label: string
}) {
  const { field, fieldState } = useController({ control, name })
  return (
    <FilePickerField
      label={label}
      value={field.value}
      onChange={field.onChange}
      error={fieldState.error?.message}
    />
  )
}

const maxDay = (value: string) => parseDateValue(value)

/** Add Academic (2423:18123): Academic Title, Institute Name, From / To Date, In Process, Upload Document. */
export function AcademicDialog({
  employee,
  row,
  onClose,
}: {
  employee: Employee
  row: Education | null
  onClose: () => void
}) {
  const save = useSaveChild('education', 'Academic record')
  const form = useForm<AcademicFormValues>({
    resolver: zodResolver(academicFormSchema),
    defaultValues: academicToForm(row),
  })
  const inProcess = useWatch({ control: form.control, name: 'inProcess' })
  const fromDate = useWatch({ control: form.control, name: 'fromDate' })
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        employeeId: employee.id,
        rowId: row?.id,
        input: { ...academicToInput(values), ...(row ? { rowVersion: row.rowVersion } : {}) },
      })
    } catch (error) {
      showServerErrors(error, form.setError, Object.keys(values), FILE_FIELD)
      return
    }
    onClose()
  })
  return (
    <FormDialog
      title={row ? 'Edit Academic' : 'Add Academic'}
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      rootError={form.formState.errors.root?.message}
      dirty={form.formState.isDirty}
    >
      <div className="grid gap-4 @md:grid-cols-2">
        <TextField
          control={form.control}
          name="title"
          label="Academic Title"
          required
          placeholder="Enter Academic Title"
          className="@md:col-span-2"
        />
        <TextField
          control={form.control}
          name="institute"
          label="Institute Name"
          required
          placeholder="Enter Institute Name"
          className="@md:col-span-2"
        />
        <DatePickerField control={form.control} name="fromDate" label="From Date" required />
        <DatePickerField
          control={form.control}
          name="toDate"
          label="To Date"
          required={!inProcess}
          disabled={inProcess}
          minDate={maxDay(fromDate)}
        />
        <SwitchField
          control={form.control}
          name="inProcess"
          label="In Process"
          className={navySwitchClass}
          onCheckedChange={(on) => {
            if (on) form.setValue('toDate', '')
          }}
        />
        <div className="@md:col-span-2">
          <FileField control={form.control} name="file" label="Upload Document" />
        </div>
      </div>
    </FormDialog>
  )
}

/**
 * Add Work Experience (2423:17959): Job Title, Company Name, From / To Date, In Process, Upload
 * Document. The experience API keeps no file, so a chosen file is saved as an Experience Letter
 * among the documents.
 */
export function ExperienceDialog({
  employee,
  row,
  onClose,
}: {
  employee: Employee
  row: Experience | null
  onClose: () => void
}) {
  const save = useSaveChild('experience', 'Experience')
  const queryClient = useQueryClient()
  const form = useForm<ExperienceFormValues>({
    resolver: zodResolver(experienceFormSchema),
    defaultValues: experienceToForm(row),
  })
  const inProcess = useWatch({ control: form.control, name: 'inProcess' })
  const fromDate = useWatch({ control: form.control, name: 'fromDate' })
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        employeeId: employee.id,
        rowId: row?.id,
        input: { ...experienceToInput(values), ...(row ? { rowVersion: row.rowVersion } : {}) },
      })
    } catch (error) {
      showServerErrors(error, form.setError, Object.keys(values))
      return
    }
    if (values.file) {
      try {
        await employeesApi.createChild(employee.id, 'documents', {
          documentType: 'experience_letter',
          title: `${values.jobTitle.trim()} at ${values.companyName.trim()}`,
          issueDate: values.inProcess ? null : values.toDate || null,
          fileId: values.file.id,
        })
        await queryClient.invalidateQueries({
          queryKey: employeeKeys.children(employee.id, 'documents'),
        })
      } catch {
        toast.error('The experience is saved, but its document could not be added.')
      }
    }
    onClose()
  })
  return (
    <FormDialog
      title={row ? 'Edit Work Experience' : 'Add Work Experience'}
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      rootError={form.formState.errors.root?.message}
      dirty={form.formState.isDirty}
    >
      <div className="grid gap-4 @md:grid-cols-2">
        <TextField
          control={form.control}
          name="jobTitle"
          label="Job Title"
          required
          placeholder="Enter Job Title"
          className="@md:col-span-2"
        />
        <TextField
          control={form.control}
          name="companyName"
          label="Company Name"
          required
          placeholder="Enter Company Name"
          className="@md:col-span-2"
        />
        <DatePickerField
          control={form.control}
          name="fromDate"
          label="From Date"
          required
          maxDate={new Date()}
        />
        <DatePickerField
          control={form.control}
          name="toDate"
          label="To Date"
          required={!inProcess}
          disabled={inProcess}
          minDate={maxDay(fromDate)}
        />
        <SwitchField
          control={form.control}
          name="inProcess"
          label="In Process"
          className={navySwitchClass}
          onCheckedChange={(on) => {
            if (on) form.setValue('toDate', '')
          }}
        />
        {!row && (
          <div className="@md:col-span-2">
            <FileField control={form.control} name="file" label="Upload Document" />
          </div>
        )}
      </div>
    </FormDialog>
  )
}

/**
 * Add Contract (2423:18292): Employee Name, Contract Type, Contract Duration in Months (or
 * Custom), From / To Date, the Status switch (on: in process, no end date yet), Attachment and
 * Additional Details. A duration fills the To Date.
 */
export function ContractDialog({
  employee,
  row,
  onClose,
}: {
  employee: Employee
  row: Contract | null
  onClose: () => void
}) {
  const save = useSaveChild('contracts', 'Contract')
  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: contractToForm(row),
  })
  const [duration, fromDate, inProcess] = useWatch({
    control: form.control,
    name: ['duration', 'fromDate', 'inProcess'],
  })
  const months = Number(duration)
  const fixed = Number.isInteger(months) && months > 0

  useEffect(() => {
    if (fixed && fromDate && !inProcess) {
      form.setValue('toDate', contractEnd(fromDate, months), { shouldValidate: false })
    }
  }, [fixed, fromDate, inProcess, months, form])

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        employeeId: employee.id,
        rowId: row?.id,
        input: { ...contractToInput(values), ...(row ? { rowVersion: row.rowVersion } : {}) },
      })
    } catch (error) {
      showServerErrors(error, form.setError, Object.keys(values), {
        ...FILE_FIELD,
        durationMonths: 'duration',
      })
      return
    }
    onClose()
  })
  return (
    <FormDialog
      title={row ? 'Edit Contract' : 'Add Contract'}
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      rootError={form.formState.errors.root?.message}
      dirty={form.formState.isDirty}
    >
      <div className="grid gap-4 @md:grid-cols-2">
        <FormField label="Employee Name" className="@md:col-span-2">
          {(a11y) => <Input {...a11y} value={employee.name} readOnly disabled />}
        </FormField>
        <SelectField
          control={form.control}
          name="contractType"
          label="Contract Type"
          required
          placeholder="Temporary"
          options={CONTRACT_TYPES.map((value) => ({ value, label: CONTRACT_TYPE_LABELS[value] }))}
        />
        <SelectField
          control={form.control}
          name="duration"
          label="Contract Duration in Months"
          placeholder="Custom"
          options={[
            ...CONTRACT_DURATIONS.map((value) => ({
              value: String(value),
              label: `${String(value)} Months`,
            })),
            { value: 'custom', label: 'Custom' },
          ]}
        />
        <DatePickerField control={form.control} name="fromDate" label="From Date" required />
        <DatePickerField
          control={form.control}
          name="toDate"
          label="To Date"
          required={!inProcess}
          disabled={inProcess || fixed}
          minDate={maxDay(fromDate)}
        />
        <SwitchField
          control={form.control}
          name="inProcess"
          label="Status"
          stateLabel={(on) => (on ? 'In Process' : 'Fixed term')}
          className={navySwitchClass}
          onCheckedChange={(on) => {
            if (on) form.setValue('toDate', '')
          }}
        />
        <div className="@md:col-span-2">
          <FileField control={form.control} name="file" label="Attachment" />
        </div>
        <TextareaField
          control={form.control}
          name="remarks"
          label="Additional Details"
          placeholder="Additional Details"
          rows={3}
          className="@md:col-span-2"
        />
      </div>
    </FormDialog>
  )
}

/**
 * Upload Document (the add menu's item; no popup is drawn): Document Type, Title, Number, Issue
 * and Expiry Date, the file, Remarks.
 */
export function DocumentDialog({
  employee,
  row,
  onClose,
}: {
  employee: Employee
  row: EmployeeDocument | null
  onClose: () => void
}) {
  const save = useSaveChild('documents', 'Document')
  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: documentToForm(row),
  })
  const issueDate = useWatch({ control: form.control, name: 'issueDate' })
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        employeeId: employee.id,
        rowId: row?.id,
        input: { ...documentToInput(values), ...(row ? { rowVersion: row.rowVersion } : {}) },
      })
    } catch (error) {
      showServerErrors(error, form.setError, Object.keys(values), FILE_FIELD)
      return
    }
    onClose()
  })
  return (
    <FormDialog
      title={row ? 'Edit Document' : 'Upload Document'}
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      rootError={form.formState.errors.root?.message}
      dirty={form.formState.isDirty}
    >
      <div className="grid gap-4 @md:grid-cols-2">
        <SelectField
          control={form.control}
          name="documentType"
          label="Document Type"
          placeholder="Select Document Type"
          options={DOCUMENT_TYPES.map((value) => ({ value, label: DOCUMENT_TYPE_LABELS[value] }))}
        />
        <TextField control={form.control} name="title" label="Title" placeholder="e.g. Resume" />
        <TextField
          control={form.control}
          name="documentNumber"
          label="Document Number"
          placeholder="Enter Document Number"
        />
        <DatePickerField control={form.control} name="issueDate" label="Issue Date" />
        <DatePickerField
          control={form.control}
          name="expiryDate"
          label="Expiry Date"
          minDate={maxDay(issueDate)}
        />
        <div className="@md:col-span-2">
          <FileField control={form.control} name="file" label="Upload Document" />
        </div>
        <TextareaField
          control={form.control}
          name="remarks"
          label="Remarks"
          placeholder="Remarks"
          rows={2}
          className="@md:col-span-2"
        />
      </div>
    </FormDialog>
  )
}
