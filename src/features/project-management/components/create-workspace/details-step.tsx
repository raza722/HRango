import { useEffect, useId, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'

import { EmployeeAvatar } from '@/components/layout'
import { cn } from '@/lib/utils'

import { WORKSPACE_DESCRIPTION_MAX, WORKSPACE_NAME_MAX } from '../../constants'
import type { PmPerson } from '../../types/pm.types'
import { EmployeePickerDialog } from './employee-picker-dialog'
import { useFocusOnMount } from './use-focus-on-mount'
import { VisibilityField } from './visibility-field'
import { FormError, IconTile } from './wizard-controls'
import {
  CloseIcon,
  DescriptionIcon,
  DropdownChevronIcon,
  OwnerIcon,
  WorkspaceIcon,
} from './wizard-icons'
import type { WizardValues } from './wizard-state'
import { wz } from './wizard-styles'

interface DetailsStepProps {
  employees: readonly PmPerson[]
  people: ReadonlyMap<string, PmPerson>
  /** Focus the heading on mount (coming back from another step); the name field otherwise. */
  focusHeading: boolean
}

/** Step 1 "Create Workspace" (505:146644, 1507:852259, 510:153602). */
export function DetailsStep({ employees, people, focusHeading }: DetailsStepProps) {
  const { register, control, setValue, setFocus, clearErrors, formState } =
    useFormContext<WizardValues>()
  const [name, ownerId, description, visibility, memberIds] = useWatch({
    control,
    name: ['name', 'ownerId', 'description', 'visibility', 'memberIds'],
  })
  const [pickingOwner, setPickingOwner] = useState(false)
  const headingRef = useFocusOnMount<HTMLHeadingElement>(focusHeading)
  const ids = {
    name: useId(),
    nameCounter: useId(),
    nameError: useId(),
    owner: useId(),
    ownerValue: useId(),
    ownerError: useId(),
    description: useId(),
    descriptionCounter: useId(),
  }
  useEffect(() => {
    if (!focusHeading) setFocus('name')
  }, [focusHeading, setFocus])
  const owner = ownerId ? people.get(ownerId) : undefined
  const { errors } = formState

  return (
    <div className="pb-4">
      <h2 ref={headingRef} tabIndex={-1} className={cn(wz.title, 'outline-none')}>
        Create Workspace
      </h2>
      <p className={cn(wz.intro, 'mt-3 max-w-[51.0625rem]')}>
        A workspace stands for a team, a department or a group of projects. Each workspace has its
        own task lists, workflow and templates.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 sm:gap-x-[2.6875rem]">
        {/* Workspace Name Input Field */}
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={ids.name} className={wz.label}>
              Workspace Name
            </label>
            <span id={ids.nameCounter} className={wz.counter}>
              {name.length}/{WORKSPACE_NAME_MAX} characters
            </span>
          </div>
          <div className={cn(wz.field, wz.fieldFocus, 'mt-3', errors.name && wz.fieldInvalid)}>
            <IconTile>
              <WorkspaceIcon className={cn('size-5', wz.iconPurple600)} />
            </IconTile>
            <input
              id={ids.name}
              {...register('name')}
              maxLength={WORKSPACE_NAME_MAX}
              autoComplete="off"
              placeholder="Enter workspace name"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={
                errors.name ? `${ids.nameCounter} ${ids.nameError}` : ids.nameCounter
              }
              className={cn(
                wz.value,
                'min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#9B9B9B]',
              )}
            />
          </div>
          <FormError id={ids.nameError} message={errors.name?.message} />
        </div>

        {/* Workspace Owner Dropdown */}
        <div className="min-w-0">
          <span id={ids.owner} className={wz.label}>
            Workspace Owner
          </span>
          <div
            className={cn(
              wz.field,
              wz.fieldFocus,
              'relative mt-3 p-0',
              errors.ownerId && wz.fieldInvalid,
            )}
          >
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={pickingOwner}
              aria-labelledby={`${ids.owner} ${ids.ownerValue}`}
              aria-describedby={errors.ownerId ? ids.ownerError : undefined}
              onClick={() => {
                setPickingOwner(true)
              }}
              className="flex min-h-[4.0625rem] w-full min-w-0 items-center gap-[1.0625rem] rounded-[1.125rem] pr-[1.6875rem] pl-5 text-left outline-none"
            >
              {owner ? (
                <EmployeeAvatar
                  name={owner.name}
                  photoUrl={owner.photoUrl}
                  className="-my-1.5 size-[2.8125rem]"
                  fallbackClassName="bg-[#7127EA] text-[#C9BCFF]"
                />
              ) : (
                <IconTile>
                  <OwnerIcon className={cn('h-5 w-[1.0825rem]', wz.iconPurple600)} />
                </IconTile>
              )}
              <span
                id={ids.ownerValue}
                className={cn(wz.value, 'min-w-0 flex-1 truncate', owner && 'pr-12')}
              >
                {owner?.name ?? 'Add workspace owner'}
              </span>
              <DropdownChevronIcon
                className={cn(
                  'h-[0.8125rem] w-[1.4375rem] shrink-0 text-[#7127EA] transition-transform',
                  pickingOwner && 'rotate-180',
                )}
              />
            </button>
            {owner && (
              <button
                type="button"
                aria-label={`Remove ${owner.name}`}
                onClick={() => {
                  setValue('ownerId', null, { shouldDirty: true })
                  clearErrors('ownerId')
                }}
                className="absolute top-1/2 right-[4.1875rem] inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-[#EC474F]/10 text-[#DC3545] transition-colors hover:bg-[#EC474F]/20 focus-visible:ring-2 focus-visible:ring-[#DC3545]/40 focus-visible:outline-none"
              >
                <CloseIcon className="size-[0.96rem]" />
              </button>
            )}
          </div>
          <FormError id={ids.ownerError} message={errors.ownerId?.message} />
          <EmployeePickerDialog
            open={pickingOwner}
            onOpenChange={setPickingOwner}
            title="Add Workspace Owner"
            showTitle
            employees={employees}
            multiple={false}
            selected={ownerId ? [ownerId] : []}
            onConfirm={(chosen) => {
              setValue('ownerId', chosen[0] ?? null, { shouldDirty: true })
              clearErrors('ownerId')
            }}
          />
        </div>

        {/* Description Input Field */}
        <div className="min-w-0 sm:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={ids.description} className={wz.label}>
              Description (Optional)
            </label>
            <span id={ids.descriptionCounter} className={wz.counter}>
              {description.length}/{WORKSPACE_DESCRIPTION_MAX} characters
            </span>
          </div>
          <div className={cn(wz.field, wz.fieldFocus, 'relative mt-3 items-start p-0')}>
            <IconTile className="absolute top-4 left-5">
              <DescriptionIcon className={cn('h-[1.03rem] w-[1.22rem]', wz.iconPurple)} />
            </IconTile>
            <textarea
              id={ids.description}
              {...register('description')}
              maxLength={WORKSPACE_DESCRIPTION_MAX}
              rows={4}
              placeholder="Write description here..."
              aria-describedby={ids.descriptionCounter}
              className={cn(
                wz.value,
                'h-[9.9375rem] w-full resize-none rounded-[1.125rem] bg-transparent pt-[1.09rem] pr-5 pb-3 pl-[4.29rem] outline-none placeholder:text-[#454545]',
              )}
            />
          </div>
        </div>

        <div className="min-w-0 sm:col-span-2">
          <VisibilityField
            visibility={visibility}
            memberIds={memberIds}
            employees={employees}
            people={people}
            onVisibilityChange={(next) => {
              setValue('visibility', next, { shouldDirty: true })
              clearErrors(['visibility', 'memberIds'])
            }}
            onMembersChange={(next) => {
              setValue('memberIds', next, { shouldDirty: true })
              clearErrors('memberIds')
            }}
            error={errors.memberIds?.message ?? errors.visibility?.message}
          />
        </div>
      </div>
    </div>
  )
}
