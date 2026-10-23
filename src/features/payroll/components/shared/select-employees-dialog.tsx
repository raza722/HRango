import { useState } from 'react'

import { AppDialog } from '@/components/feedback/app-dialog'
import { Button } from '@/components/ui/button'
import { EmployeeSelector } from '@/features/scheduling'
import { cn } from '@/lib/utils'

import { btn, footerButton } from '../../utils/styles'

/**
 * "Select Employees" (Payroll Employments → Add): Employee, Location,
 * Designation, Department, Grade, Employment and Group, then All Employees
 * and the Selected Employees chips.
 */
export function SelectEmployeesDialog({
  initial,
  onSave,
  onClose,
  pending = false,
  error,
}: {
  initial: readonly string[]
  onSave: (employeeIds: string[]) => void
  onClose: () => void
  pending?: boolean
  error?: string | null
}) {
  const [ids, setIds] = useState<string[]>([...initial])
  return (
    <AppDialog
      title={<span className="text-xl font-medium sm:text-2xl">Select Employees</span>}
      onRequestClose={onClose}
      className="max-w-5xl"
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto self-center text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            onClick={() => {
              onSave(ids)
            }}
            disabled={pending}
            className={cn(footerButton, btn.green)}
          >
            Save
          </Button>
          <Button onClick={onClose} className={cn(footerButton, btn.red)}>
            Cancel
          </Button>
        </>
      }
    >
      <EmployeeSelector
        value={ids}
        onChange={setIds}
        filters={[
          'employee',
          'location',
          'designation',
          'department',
          'grade',
          'employmentType',
          'group',
        ]}
      />
    </AppDialog>
  )
}
