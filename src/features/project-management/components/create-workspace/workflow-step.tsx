import { type ComponentType, type RefObject, type SVGProps, useId, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { WORKFLOW_TEMPLATE_LIST } from '../../constants'
import type { WorkflowTemplateId } from '../../types/pm.types'
import { handleListKeys } from './list-keys'
import { useFocusOnMount } from './use-focus-on-mount'
import { FormError, IconTile, RadioMark } from './wizard-controls'
import {
  DepartmentIcon,
  DropdownChevronIcon,
  MarketingTeamIcon,
  ProductEngineeringIcon,
  ProjectManagementIcon,
  SearchIcon,
  WorkStarterIcon,
} from './wizard-icons'
import { templateSetup, type WizardValues } from './wizard-state'
import { wz } from './wizard-styles'

const CARD_ICONS: Record<WorkflowTemplateId, ComponentType<SVGProps<SVGSVGElement>>> = {
  'work-starter': WorkStarterIcon,
  'project-management': ProjectManagementIcon,
  'marketing-team': MarketingTeamIcon,
  'product-engineering': ProductEngineeringIcon,
}

/** Step 2 "Define Workflow" (540:183144, 3061:738595, 576:187796). */
export function WorkflowStep({ departments }: { departments: readonly string[] }) {
  const { control, setValue, getValues, clearErrors, formState } = useFormContext<WizardValues>()
  const [department, template] = useWatch({ control, name: ['department', 'template'] })
  const headingRef = useFocusOnMount<HTMLHeadingElement>(true)
  const workflowHeadingId = useId()
  const { errors } = formState

  const chooseTemplate = (id: WorkflowTemplateId) => {
    if (getValues('template') === id) return
    setValue('template', id, { shouldDirty: true })
    // A new workflow starts from its own views, statuses and organizer.
    setValue('setup', templateSetup(id), { shouldDirty: true })
    clearErrors('template')
  }

  return (
    <div className="pb-4">
      <DepartmentField
        headingRef={headingRef}
        departments={departments}
        value={department}
        error={errors.department?.message}
        onChange={(next) => {
          setValue('department', next, { shouldDirty: true })
          clearErrors('department')
        }}
      />

      <h2 id={workflowHeadingId} className={cn(wz.title, 'mt-10')}>
        Define Your New Workflow <span className="text-[#DC3545]">*</span>
      </h2>
      <p className={cn(wz.intro, 'mt-3 max-w-[53.875rem]')}>
        Create your workflow from scratch according to your need to customize the required views,
        task statuses, and organizer.
      </p>
      <div
        role="radiogroup"
        aria-labelledby={workflowHeadingId}
        aria-required="true"
        onKeyDown={handleListKeys}
        className="mt-[1.875rem] grid gap-5 sm:grid-cols-2 sm:gap-x-[1.1875rem] sm:gap-y-6"
      >
        {WORKFLOW_TEMPLATE_LIST.map((entry) => {
          const Icon = CARD_ICONS[entry.id]
          const checked = template === entry.id
          return (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={checked}
              data-list-item
              tabIndex={checked || (template === null && entry.id === 'work-starter') ? 0 : -1}
              onClick={() => {
                chooseTemplate(entry.id)
              }}
              className={cn(
                'relative flex min-h-[10rem] flex-col rounded-[1.125rem] bg-white px-5 pt-4 pb-5 text-left transition-colors outline-none hover:bg-[#FAF8FF] focus-visible:ring-2 focus-visible:ring-[#A181FF]',
                checked && 'bg-[#F5F0FE] hover:bg-[#F5F0FE]',
              )}
            >
              <span className="flex items-center gap-[1.0625rem] pr-10">
                <IconTile>
                  <Icon className="size-5" />
                </IconTile>
                <span className={wz.cardTitle}>{entry.name}</span>
              </span>
              <span className={cn(wz.cardText, 'mt-3 pr-6')}>{entry.description}</span>
              <RadioMark checked={checked} className="absolute top-[0.9375rem] right-4" />
            </button>
          )
        })}
      </div>
      <FormError message={errors.template?.message} />
    </div>
  )
}

/** Select Your Department: the field and its open list (3061:738595) with a search. */
function DepartmentField({
  headingRef,
  departments,
  value,
  error,
  onChange,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>
  departments: readonly string[]
  value: string | null
  error: string | undefined
  onChange: (department: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const headingId = useId()
  const valueId = useId()
  const listId = useId()
  const errorId = useId()
  const query = search.trim().toLowerCase()
  const shown = query
    ? departments.filter((entry) => entry.toLowerCase().includes(query))
    : departments

  return (
    <div>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className={cn(wz.title, 'outline-none')}>
        Select Your Department <span className="text-[#DC3545]">*</span>
      </h2>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setSearch('')
        }}
      >
        <div className={cn(wz.field, wz.fieldFocus, 'mt-3 p-0', error && wz.fieldInvalid)}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-labelledby={`${headingId} ${valueId}`}
              aria-describedby={error ? errorId : undefined}
              aria-haspopup="listbox"
              className="flex min-h-[4.0625rem] w-full min-w-0 items-center gap-[1.0625rem] rounded-[1.125rem] px-5 text-left outline-none"
            >
              <IconTile>
                <DepartmentIcon className={cn('size-[1.125rem]', wz.iconPurple)} />
              </IconTile>
              <span id={valueId} className={cn(wz.value, 'min-w-0 flex-1 truncate text-[#3D3D3D]')}>
                {value ?? 'Select Your Department'}
              </span>
              <DropdownChevronIcon
                className={cn(
                  'h-[0.8125rem] w-[1.4375rem] shrink-0 text-[#7127EA] transition-transform',
                  open && 'rotate-180',
                )}
              />
            </button>
          </PopoverTrigger>
        </div>
        <PopoverContent
          align="start"
          sideOffset={18}
          className={cn(wz.panel, 'border-0 p-0')}
          onOpenAutoFocus={(event) => {
            // Focus the search, as the design opens with the search on top.
            event.preventDefault()
            const panel = event.currentTarget
            if (panel instanceof HTMLElement) panel.querySelector('input')?.focus()
          }}
        >
          <div className="px-4 pt-5 sm:px-5">
            <label className={wz.search}>
              <SearchIcon className="ml-0.5 size-[1.2rem] shrink-0 text-[#A181FF]" />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                }}
                aria-label="Search department"
                aria-controls={listId}
                placeholder="Search department here ..."
                className={wz.searchInput}
              />
            </label>
          </div>
          <div
            id={listId}
            role="listbox"
            aria-labelledby={headingId}
            onKeyDown={handleListKeys}
            className={cn(
              wz.scrollbar,
              'mt-3.5 mb-4 flex max-h-[min(24.875rem,45dvh)] flex-col gap-3 overflow-y-auto px-4 py-1 sm:mr-3 sm:gap-5 sm:pr-2 sm:pl-5',
            )}
          >
            {shown.map((entry) => {
              const selected = entry === value
              return (
                <button
                  key={entry}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-list-item
                  onClick={() => {
                    onChange(entry)
                    setOpen(false)
                    setSearch('')
                  }}
                  className={cn(
                    'flex min-h-[3.1875rem] w-full shrink-0 items-center rounded-xl border border-transparent bg-[#F6F6F6] px-3 text-left text-base leading-[1.6875rem] font-medium tracking-[0.0168rem] text-[#454545] transition-colors outline-none hover:bg-[#EEE7FF] focus-visible:ring-2 focus-visible:ring-[#A181FF] sm:text-[1.125rem]',
                    selected && 'border-[#7127EA] bg-[#EEE7FF]',
                  )}
                >
                  {entry}
                </button>
              )
            })}
            {shown.length === 0 && (
              <p className="py-4 text-center text-base text-[#5D5D5D]">No departments match.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <FormError id={errorId} message={error} />
    </div>
  )
}
