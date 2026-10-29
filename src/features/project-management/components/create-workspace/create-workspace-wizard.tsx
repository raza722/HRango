import { useState } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { Dialog as DialogPrimitive } from 'radix-ui'

import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import {
  useCreateWorkspace,
  useDepartments,
  usePeople,
  usePmLookups,
  usePmTemplates,
} from '../../hooks/use-pm'
import type { PmTemplates, WorkspaceSummary } from '../../types/pm.types'
import { CustomizeStep } from './customize-step'
import { DetailsStep } from './details-step'
import { OrganizerPage } from './organizer-page'
import { StatusesPage } from './statuses-page'
import { TemplatesContext } from './templates-context'
import { ViewsPage } from './views-page'
import { BackButton, CancelButton, CloseButton, ContinueButton, FormError } from './wizard-controls'
import { WizardProgress } from './wizard-progress'
import {
  type DetailPage,
  EMPTY_LIBRARY,
  EMPTY_WIZARD,
  fieldOfApiField,
  firstIncompleteStep,
  type StatusLibrary,
  stepComplete,
  stepHint,
  stepOfField,
  templateSetup,
  toWorkspaceInput,
  WIZARD_FIELDS,
  type WizardField,
  type WizardStep,
  type WizardValues,
} from './wizard-state'
import { wz } from './wizard-styles'
import { WorkflowStep } from './workflow-step'

export interface CreateWorkspaceWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the new workspace after "Create Workspace". */
  onCreated: (workspace: WorkspaceSummary) => void
}

/** The three-step Create Workspace modal (Add Workspace Details > Define Workflow > Customize Template). */
export function CreateWorkspaceWizard({
  open,
  onOpenChange,
  onCreated,
}: CreateWorkspaceWizardProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={wz.overlay} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={wz.modal}
          onEscapeKeyDown={(event) => {
            // Escape inside an inline editor (a status name) cancels the edit, not the wizard.
            if (event.target instanceof Element && event.target.closest('[data-escape-local]')) {
              event.preventDefault()
            }
          }}
        >
          <DialogPrimitive.Title asChild>
            <span className="sr-only">Create Workspace</span>
          </DialogPrimitive.Title>
          <WizardBody
            onClose={() => {
              onOpenChange(false)
            }}
            onCreated={onCreated}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

const NO_TEMPLATES: PmTemplates = { workflows: [], statusTemplates: [] }

/** The wizard's state; mounted while the modal is open, so closing it starts over. */
function WizardBody({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (workspace: WorkspaceSummary) => void
}) {
  const lookups = usePmLookups()
  const departments = useDepartments()
  const templates = usePmTemplates()
  const people = usePeople()
  const create = useCreateWorkspace()
  const form = useForm<WizardValues>({ defaultValues: EMPTY_WIZARD, mode: 'onChange' })
  const [name, ownerId, description, visibility, memberIds, departmentId, template, setup] =
    useWatch({ control: form.control, name: WIZARD_FIELDS })
  const values: WizardValues = {
    name,
    ownerId,
    description,
    visibility,
    memberIds,
    departmentId,
    template,
    setup,
  }
  const [step, setStep] = useState<WizardStep>('details')
  const [page, setPage] = useState<DetailPage | null>(null)
  const [returnTo, setReturnTo] = useState<DetailPage | null>(null)
  const [moved, setMoved] = useState(false)
  const [library, setLibrary] = useState<StatusLibrary>(EMPTY_LIBRARY)
  const [rootError, setRootError] = useState<string | undefined>()

  const goTo = (next: WizardStep) => {
    setStep(next)
    setReturnTo(null)
    setMoved(true)
    setRootError(undefined)
  }
  const closePage = () => {
    setReturnTo(page)
    setPage(null)
  }

  const submit = async () => {
    const input = toWorkspaceInput(values)
    if (!input) {
      goTo(firstIncompleteStep(values) ?? 'details')
      return
    }
    setRootError(undefined)
    try {
      const workspace = await create.mutateAsync(input)
      onCreated(workspace)
    } catch (error) {
      const fieldErrors = error instanceof ApiError ? Object.entries(error.fieldErrors) : []
      const known = fieldErrors
        .map(([field, message]) => [fieldOfApiField(field), message] as const)
        .filter((entry): entry is [WizardField, string] => entry[0] !== null)
      const [first] = known
      if (first) {
        for (const [field, message] of known) form.setError(field, { type: 'server', message })
        goTo(stepOfField(first[0]))
        return
      }
      setRootError(error instanceof ApiError ? error.message : 'Could not create the workspace.')
    }
  }

  const templateData = templates.data ?? NO_TEMPLATES

  if (page && setup && template) {
    const saveSetup = (patch: Partial<NonNullable<WizardValues['setup']>>) => {
      form.setValue('setup', { ...setup, ...patch }, { shouldDirty: true })
      closePage()
    }
    if (page === 'views') {
      return (
        <TemplatesContext value={templateData}>
          <ViewsPage
            template={template}
            setup={setup}
            onSave={saveSetup}
            onDiscard={closePage}
            onClose={onClose}
          />
        </TemplatesContext>
      )
    }
    if (page === 'statuses') {
      return (
        <TemplatesContext value={templateData}>
          <StatusesPage
            template={template}
            statusMode={setup.statusMode}
            statuses={setup.statuses}
            library={library}
            onSave={(result, nextLibrary) => {
              setLibrary(nextLibrary)
              saveSetup(result)
            }}
            onDiscard={closePage}
            onClose={onClose}
          />
        </TemplatesContext>
      )
    }
    return (
      <TemplatesContext value={templateData}>
        <OrganizerPage
          template={template}
          organizer={setup.organizer}
          onSave={(organizer) => {
            saveSetup({ organizer })
          }}
          onDiscard={closePage}
          onClose={onClose}
        />
      </TemplatesContext>
    )
  }

  const complete = stepComplete(step, values)
  const hint = step === 'customize' || complete ? null : stepHint(step, values)
  const employees = lookups.data?.employees ?? []

  const loading = lookups.isPending || templates.isPending || departments.isPending
  const failed = lookups.isError || templates.isError || departments.isError

  return (
    <TemplatesContext value={templateData}>
      <FormProvider {...form}>
        <header
          className={cn(
            wz.gutter,
            'relative shrink-0 pt-5 pr-14 sm:pt-[1.875rem] sm:pr-8 lg:pr-[3.125rem]',
          )}
        >
          <WizardProgress step={step} />
          <CloseButton
            label="Close Create Workspace"
            onClick={onClose}
            className="absolute top-4 right-3 sm:top-[1.9375rem] sm:right-[1.9375rem]"
          />
        </header>

        <div className={cn(wz.body, wz.gutter, wz.scrollbar, 'pt-8 sm:pt-10')}>
          {loading ? (
            <div aria-busy="true" aria-label="Loading" className="grid gap-5">
              <Skeleton className="h-10 w-72" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : failed ? (
            <FormError message="The employees, departments or templates could not be loaded. Close and try again." />
          ) : step === 'details' ? (
            <DetailsStep employees={employees} people={people} focusHeading={moved} />
          ) : step === 'workflow' ? (
            <WorkflowStep departments={departments.data} />
          ) : template && setup ? (
            <CustomizeStep
              template={template}
              setup={setup}
              focusHeading={returnTo === null}
              returnTo={returnTo}
              onOpenPage={(next) => {
                setPage(next)
                setRootError(undefined)
              }}
            />
          ) : null}
        </div>

        <footer className={cn(wz.gutter, 'shrink-0')}>
          <FormError message={rootError} />
          {/*
            Why Continue is disabled. One paragraph whose text only changes (never emptied): the
            dialog's focus trap refocuses itself when nodes are removed while focus is on <body>,
            which happened as a nested picker closed.
          */}
          <p
            aria-live="polite"
            className={cn(
              'text-right text-xs text-[#707070] dark:text-grey',
              hint ? 'mb-2' : 'hidden',
            )}
          >
            {hint ?? ' '}
          </p>
          <div className={cn(wz.footer, step !== 'details' && 'justify-between')}>
            {step !== 'details' && (
              <BackButton
                onClick={() => {
                  goTo(step === 'customize' ? 'workflow' : 'details')
                }}
              />
            )}
            <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-[1.5625rem]">
              <CancelButton onClick={onClose} />
              {step === 'customize' ? (
                <ContinueButton
                  badge="plus"
                  className={wz.create}
                  disabled={create.isPending}
                  aria-busy={create.isPending || undefined}
                  onClick={() => {
                    void submit()
                  }}
                >
                  Create Workspace
                </ContinueButton>
              ) : (
                <ContinueButton
                  disabled={!complete}
                  onClick={() => {
                    if (step === 'workflow' && !setup && template) {
                      form.setValue(
                        'setup',
                        templateSetup(
                          templateData.workflows.find((entry) => entry.id === template),
                        ),
                      )
                    }
                    goTo(step === 'details' ? 'workflow' : 'customize')
                  }}
                />
              )}
            </div>
          </div>
        </footer>
      </FormProvider>
    </TemplatesContext>
  )
}
