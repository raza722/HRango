import { useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { EmployeeAvatar, RowActionsMenu, rowMenuItemClass } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { isInactiveStatus, PHOTO_ACCEPT, statusMeta, TM_CODES } from '../../constants'
import { useSavePhoto } from '../../hooks/use-employees'
import type { Employee } from '../../types/employees.types'
import { navyButtonClass, toolbarButtonClass } from '../../utils/styles'
import { Chip } from '../shared/parts'
import { CameraIcon } from '../talent-icons'

/** Photos up to 5 MB. */
const PHOTO_MAX_BYTES = 5 * 1024 * 1024

/**
 * The profile's head (mobile 2423:17024, Profile Dashboard 765:234): the photo with the camera
 * badge (uploads and sets the photo), the name, the designation, the Reg. # and status, Update
 * Profile, and a ⋮ menu with Edit Employee and Deactivate / Reactivate.
 */
export function ProfileHeader({
  employee,
  onUpdateProfile,
  onEdit,
  onToggleActive,
}: {
  employee: Employee
  onUpdateProfile: () => void
  onEdit: () => void
  onToggleActive: () => void
}) {
  const canEdit = useCan(TM_CODES.edit)
  const canDeactivate = useCan(TM_CODES.deactivate)
  const savePhoto = useSavePhoto()
  const input = useRef<HTMLInputElement>(null)
  const role = employee.designationName ?? employee.jobTitleName
  const inactive = isInactiveStatus(employee.status)
  const menu = [
    ...(canEdit ? [{ label: 'Edit Employee', onSelect: onEdit }] : []),
    ...(canDeactivate
      ? [
          {
            label: inactive ? 'Reactivate' : 'Deactivate',
            variant: inactive ? ('default' as const) : ('destructive' as const),
            onSelect: onToggleActive,
          },
        ]
      : []),
  ]

  return (
    <section
      aria-label="Employee"
      className="@container flex flex-col items-center gap-3 rounded-xl bg-card px-4 py-6 text-center shadow-xs"
    >
      <div className="relative">
        <EmployeeAvatar
          name={employee.name}
          photoUrl={employee.photoUrl}
          className="size-28 ring-4 ring-[#EBEFF8] dark:ring-border"
          fallbackClassName="text-3xl"
        />
        {canEdit && (
          <>
            <button
              type="button"
              aria-label="Change photo"
              disabled={savePhoto.isPending}
              onClick={() => input.current?.click()}
              className="absolute right-0 bottom-0 flex size-9 items-center justify-center rounded-full bg-card text-sidebar shadow-md ring-1 ring-[#E0E0E0] outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-70 dark:text-heading dark:ring-border"
            >
              {savePhoto.isPending ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <CameraIcon className="h-[1.05rem] w-[1.15rem]" />
              )}
            </button>
            <input
              ref={input}
              type="file"
              accept={PHOTO_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-label="Photo file"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                if (file.size > PHOTO_MAX_BYTES) {
                  toast.error('Choose a photo of 5 MB or less.')
                  return
                }
                savePhoto.mutate({ employee, file })
              }}
            />
          </>
        )}
      </div>
      <div className="grid gap-1">
        <h1 className="text-xl font-medium break-words text-title">{employee.name}</h1>
        {role && <p className="text-sm text-grey">{role}</p>}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-grey">
        <span>
          Reg. # <span className="font-medium text-title">{employee.code}</span>
        </span>
        <Chip meta={statusMeta(employee.status)} />
      </div>
      {(canEdit || menu.length > 0) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {canEdit && (
            <Button
              onClick={onUpdateProfile}
              className={cn(toolbarButtonClass, navyButtonClass, 'px-5 text-xs')}
            >
              Update Profile
            </Button>
          )}
          {menu.length > 0 && (
            <RowActionsMenu
              label={`More actions for ${employee.name}`}
              actions={menu}
              itemClassName={rowMenuItemClass.poppins}
            />
          )}
        </div>
      )}
    </section>
  )
}
