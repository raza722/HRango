import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'

import { SelectField, SwitchField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import {
  EMERGENCY_RELATION_LABELS,
  GENDER_LABELS,
  labelOf,
  MARITAL_LABELS,
  SALARY_FREQUENCY_LABELS,
  statusMeta,
  TM_CODES,
} from '../../constants'
import { useDeleteChild, useEmployeeChildren, useSaveChild } from '../../hooks/use-employees'
import {
  emergencyContactFormSchema,
  type EmergencyContactFormValues,
  emergencyContactToForm,
  emergencyContactToInput,
} from '../../schemas/employee-forms.schema'
import {
  EMERGENCY_RELATIONS,
  type EmergencyContact,
  type Employee,
} from '../../types/employees.types'
import { showServerErrors } from '../../utils/form-errors'
import { formatDay, tenureText } from '../../utils/format'
import { navySwitchClass, outlineButtonClass, toolbarButtonClass } from '../../utils/styles'
import { FormDialog } from '../shared/form-dialog'
import {
  Chip,
  ConfirmDelete,
  EditDeleteMenu,
  EmptyNote,
  LoadingRows,
  SectionCard,
} from '../shared/parts'

/** One "label / value" row of the Personal list (labels Poppins SemiBold 12, values 14). */
function InfoList({ rows, label }: { rows: readonly [string, string][]; label: string }) {
  return (
    <div role="group" aria-label={label}>
      <dl className="grid gap-x-6 gap-y-2.5 @lg:grid-cols-2 @4xl:grid-cols-3">
        {rows.map(([name, value]) => (
          <div
            key={name}
            className="flex min-h-[2.6875rem] items-center justify-between gap-3 rounded-[10px] border border-[#E0E0E0] px-3 py-2 dark:border-border"
          >
            <dt className="text-xs font-semibold text-title">{name}</dt>
            <dd className="min-w-0 text-right text-sm break-words text-[#475569] dark:text-heading">
              {value || '—'}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function EmergencyContactDialog({
  employee,
  contact,
  first,
  onClose,
}: {
  employee: Employee
  contact: EmergencyContact | null
  first: boolean
  onClose: () => void
}) {
  const save = useSaveChild('emergency-contacts', 'Emergency contact')
  const form = useForm<EmergencyContactFormValues>({
    resolver: zodResolver(emergencyContactFormSchema),
    defaultValues: emergencyContactToForm(contact, first),
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        employeeId: employee.id,
        rowId: contact?.id,
        input: {
          ...emergencyContactToInput(values),
          ...(contact ? { rowVersion: contact.rowVersion } : {}),
        },
      })
    } catch (error) {
      showServerErrors(error, form.setError, Object.keys(values))
      return
    }
    onClose()
  })
  return (
    <FormDialog
      title={contact ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      rootError={form.formState.errors.root?.message}
      dirty={form.formState.isDirty}
    >
      <div className="grid gap-4 @md:grid-cols-2">
        <TextField
          control={form.control}
          name="name"
          label="Name"
          required
          placeholder="Enter Name"
        />
        <SelectField
          control={form.control}
          name="relation"
          label="Relation"
          required
          placeholder="What is your relation?"
          options={EMERGENCY_RELATIONS.map((value) => ({
            value,
            label: EMERGENCY_RELATION_LABELS[value],
          }))}
        />
        <TextField
          control={form.control}
          name="phone"
          label="Phone Number"
          required
          type="tel"
          placeholder="Enter Phone Number"
        />
        <TextField
          control={form.control}
          name="altPhone"
          label="Other Phone Number"
          type="tel"
          placeholder="Enter Phone Number"
        />
        <TextField
          control={form.control}
          name="address"
          label="Address"
          placeholder="Enter Address"
          className="@md:col-span-2"
        />
        <SwitchField
          control={form.control}
          name="isPrimary"
          label="Primary contact"
          stateLabel={(on) => (on ? 'Called first' : 'No')}
          className={navySwitchClass}
        />
      </div>
    </FormDialog>
  )
}

/** Emergency contacts: the Personal list's "Emergency Contact #" is the primary one. */
function EmergencyContacts({ employee }: { employee: Employee }) {
  const canEdit = useCan(TM_CODES.records)
  const contacts = useEmployeeChildren(employee.id, 'emergency-contacts')
  const remove = useDeleteChild('emergency-contacts', 'Emergency contact')
  const [editing, setEditing] = useState<EmergencyContact | 'new' | null>(null)
  const [deleting, setDeleting] = useState<EmergencyContact | null>(null)
  const rows = contacts.data ?? []

  return (
    <SectionCard
      title="Emergency Contacts"
      actions={
        canEdit && (
          <Button
            variant="outline"
            onClick={() => {
              setEditing('new')
            }}
            className={cn(toolbarButtonClass, outlineButtonClass, 'gap-1.5 px-3 text-xs')}
          >
            <Plus aria-hidden="true" className="size-4" />
            Add Contact
          </Button>
        )
      }
    >
      {contacts.isPending ? (
        <LoadingRows rows={1} label="emergency contacts" />
      ) : contacts.isError ? (
        <EmptyNote>The emergency contacts could not be loaded.</EmptyNote>
      ) : rows.length === 0 ? (
        <EmptyNote>No emergency contact yet.</EmptyNote>
      ) : (
        <ul className="grid gap-2 @lg:grid-cols-2">
          {rows.map((contact) => (
            <li
              key={contact.id}
              className="flex items-start justify-between gap-3 rounded-[10px] border border-[#E0E0E0] px-3 py-2.5 dark:border-border"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-title">
                  {contact.name}
                  {contact.isPrimary && (
                    <Chip
                      meta={{
                        label: 'Primary',
                        className:
                          'bg-[#EBEFF8] text-[#263871] dark:bg-sky-500/15 dark:text-sky-300',
                      }}
                    />
                  )}
                </p>
                <p className="text-xs text-grey">
                  {labelOf(EMERGENCY_RELATION_LABELS, contact.relation)} | {contact.phone}
                  {contact.altPhone ? `, ${contact.altPhone}` : ''}
                </p>
              </div>
              {canEdit && (
                <EditDeleteMenu
                  label={`Actions for ${contact.name}`}
                  onEdit={() => {
                    setEditing(contact)
                  }}
                  onDelete={() => {
                    setDeleting(contact)
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <EmergencyContactDialog
          employee={employee}
          contact={editing === 'new' ? null : editing}
          first={rows.length === 0}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      {deleting && (
        <ConfirmDelete
          what={`the emergency contact ${deleting.name}`}
          onClose={() => {
            setDeleting(null)
          }}
          onConfirm={() => {
            remove.mutate({
              employeeId: employee.id,
              rowId: deleting.id,
              rowVersion: deleting.rowVersion,
            })
            setDeleting(null)
          }}
        />
      )}
    </SectionCard>
  )
}

/**
 * Personal (2423:17024): Full Name, Date of Birth, Hire Date, CNIC, Reg. #, Tenure, Emergency
 * Contact #, Phone No, Marital Status as drawn, then the rest of the record (contact and
 * organisation), and the emergency contacts.
 */
export function PersonalTab({ employee }: { employee: Employee }) {
  const personal: [string, string][] = [
    ['Full Name', employee.name],
    ['Date of Birth', formatDay(employee.dateOfBirth)],
    ['Hire Date', formatDay(employee.joiningDate)],
    ['CNIC', employee.canSeeIdentity ? (employee.cnic ?? '') : 'Hidden'],
    ['Reg. #', employee.code],
    ['Tenure', tenureText(employee.tenureMonths, employee.joiningDate, employee.endDate)],
    ['Emergency Contact #', employee.emergencyContactPhone ?? ''],
    ['Phone No', employee.phone1 ?? ''],
    ['Marital Status', labelOf(MARITAL_LABELS, employee.maritalStatus)],
    ['Gender', labelOf(GENDER_LABELS, employee.gender)],
    ['Father / Husband Name', employee.parentName ?? ''],
    ['Email Address', employee.email ?? ''],
    ['Other Phone No', employee.phone2 ?? ''],
    ['Address', employee.homeAddress ?? ''],
    ['Religion', employee.religion ?? ''],
    ['Nationality', employee.nationality ?? ''],
  ]
  const organisation: [string, string][] = [
    ['Branch', employee.branchName],
    ['Location', employee.locationName ?? ''],
    ['Department', employee.departmentName ?? ''],
    ['Designation', employee.designationName ?? ''],
    ['Job Title', employee.jobTitleName ?? ''],
    ['Grade', employee.gradeName ?? ''],
    ['Employment Type', employee.employmentTypeName ?? ''],
    ['Line Manager', employee.lineManagerName ?? ''],
    ['Final Authority', employee.finalAuthorityName ?? ''],
    ['Status', statusMeta(employee.status).label],
    ['Probation End Date', formatDay(employee.probationEndDate)],
    ['Confirmation Date', formatDay(employee.confirmationDate)],
    ['Salary Frequency', labelOf(SALARY_FREQUENCY_LABELS, employee.salaryFrequency)],
  ]
  return (
    <div className="@container grid gap-5">
      <InfoList label="Personal details" rows={personal} />
      <section aria-labelledby="organisation-heading" className="grid gap-3">
        <h3 id="organisation-heading" className="text-base font-medium text-title">
          Organisation
        </h3>
        <InfoList label="Organisation details" rows={organisation} />
      </section>
      <EmergencyContacts employee={employee} />
    </div>
  )
}
