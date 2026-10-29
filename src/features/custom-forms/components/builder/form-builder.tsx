import { useState } from 'react'
import {
  type Control,
  type FieldPath,
  useController,
  useFieldArray,
  useForm,
  useFormState,
  useWatch,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FileQuestion, Lock, Plus, Rows3 } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { UnsavedChangesDialog } from '@/components/feedback/unsaved-changes-dialog'
import { FormField, SwitchField, TextareaField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DateInput } from '@/features/payroll'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import { ApiError } from '@/lib/api-error'
import { toDateValue } from '@/lib/date'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { CF_CODES, FIELD_TYPE_META, LIMITS } from '../../constants'
import { customFormKeys } from '../../hooks/custom-forms.keys'
import { useCustomForm, usePublishForm, useSaveForm } from '../../hooks/use-custom-forms'
import { BUILDER_PANES, type BuilderPane } from '../../routing'
import {
  builderErrors,
  builderSchema,
  builderToDefinition,
  builderToInput,
  type BuilderValues,
  copyOf,
  emptyBuilder,
  formToBuilder,
  newField,
  newSection,
  withType,
} from '../../schemas/builder.schema'
import { type CustomForm, FIELD_TYPES } from '../../types/custom-forms.types'
import { countText } from '../../utils/format'
import {
  cardClass,
  cardTitleClass,
  fieldsClass,
  navyButtonClass,
  navySwitchClass,
  outlineButtonClass,
  saveButtonClass,
  secondaryButtonClass,
  tabClass,
  toolbarButtonClass,
} from '../../utils/styles'
import { FillForm } from '../fill/fill-form'
import { EmptyBox, LoadError, LoadingBlock, PageHeaderCard, StatusChip } from '../shared/page-parts'
import { AudienceFields } from './audience-fields'
import { ItemEditor } from './item-editor'

type Intent = 'save' | 'publish'

const BUILD_PANE_ID = 'cf-build-pane'
const PREVIEW_PANE_ID = 'cf-preview-pane'

/** The closing date: a calendar from today on, and Clear. */
function ClosingDateField({
  control,
  minDate,
}: {
  control: Control<BuilderValues>
  minDate: Date
}) {
  const { field, fieldState } = useController({ control, name: 'closesOn' })
  return (
    <FormField
      label="Closing date"
      description="Optional: the last day people can answer."
      error={fieldState.error?.message}
    >
      {(a11y) => (
        <div className="flex items-center gap-2">
          <DateInput
            {...a11y}
            value={field.value}
            onChange={field.onChange}
            minDate={minDate}
            placeholder="No closing date"
            className="min-w-0 flex-1"
          />
          {field.value && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                field.onChange('')
              }}
              aria-label="Clear the closing date"
            >
              Clear
            </Button>
          )}
        </div>
      )}
    </FormField>
  )
}

/** "+ Add question": every field type with its icon. */
function AddQuestionMenu({
  onAdd,
  disabled,
}: {
  onAdd: (type: (typeof FIELD_TYPES)[number]) => void
  disabled: boolean
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          disabled={disabled}
          className={cn(toolbarButtonClass, navyButtonClass, 'gap-1.5 px-4 text-xs')}
        >
          <Plus aria-hidden="true" className="size-4" />
          Add question
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[12rem] py-1.5">
        {FIELD_TYPES.map((type) => {
          const { icon: Icon, label } = FIELD_TYPE_META[type]
          return (
            <DropdownMenuItem
              key={type}
              onSelect={() => {
                onAdd(type)
              }}
              className="text-xs font-medium text-title"
            >
              <Icon aria-hidden="true" className="text-grey" />
              {label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The live preview: the real fill form over what is being built, nothing sent. */
function Preview({ control }: { control: Control<BuilderValues> }) {
  const [title, description, anonymous, items] = useWatch({
    control,
    name: ['title', 'description', 'anonymous', 'items'],
  })
  const definition = builderToDefinition({ title, description, anonymous, items })
  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <p className="text-lg font-medium break-words text-title dark:text-heading">
          {definition.title || 'Untitled form'}
        </p>
        {definition.description && (
          <p className="text-xs whitespace-pre-line text-grey">{definition.description}</p>
        )}
        {anonymous && (
          <p className="text-xs text-[#263871] dark:text-sky-300">
            Anonymous: HR sees the answers, not who sent them.
          </p>
        )}
      </div>
      <FillForm
        definition={definition}
        preview
        submitLabel="Try the checks"
        onSubmit={() => {
          toast.success('Preview only: the answers pass every check. Nothing was sent.')
          return Promise.resolve()
        }}
      />
    </div>
  )
}

/** The questions card: the list of questions and section breaks, and the add buttons. */
function QuestionsCard({ control, locked }: { control: Control<BuilderValues>; locked: number }) {
  const items = useFieldArray({ control, name: 'items', keyName: 'rowKey' })
  const values = useWatch({ control, name: 'items' })
  const { errors } = useFormState({ control, name: 'items' })
  const listError = errors.items?.message ?? errors.items?.root?.message
  const fieldCount = values.filter((item) => item.kind === 'field').length
  // "Question 3", "Section 2": counted per kind, in list order.
  const names = values.map((item, index) => {
    const nth = values.slice(0, index + 1).filter((other) => other.kind === item.kind).length
    return `${item.kind === 'section' ? 'Section' : 'Question'} ${String(nth)}`
  })

  return (
    <section aria-labelledby="cf-questions" className={cn(cardClass, 'grid gap-4 p-4 sm:p-6')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cf-questions" className={cardTitleClass}>
          Questions <span className="text-sm font-normal text-grey">({fieldCount})</span>
        </h2>
      </div>
      {locked > 0 && (
        <p className="flex gap-2 rounded-lg bg-[#EBEFF8] px-3.5 py-2.5 text-xs leading-relaxed text-[#263871] dark:bg-sky-500/10 dark:text-sky-300">
          <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            This form has {countText(locked, 'response')}. You can reword questions and options, add
            new ones, reorder them and change the settings; questions with answers keep their type
            and cannot be deleted, and their options cannot be removed, so the answers keep their
            meaning. Anonymity cannot change.
          </span>
        </p>
      )}
      {values.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#D5DCEB] px-4 py-8 text-center text-sm text-grey dark:border-border">
          No questions yet. Add the first one below.
        </p>
      ) : (
        <ol className="grid gap-3">
          {items.fields.map((row, index) => (
            <li key={row.rowKey}>
              <ItemEditor
                control={control}
                index={index}
                count={items.fields.length}
                name={names[index] ?? ''}
                onMove={(from, to) => {
                  items.move(from, to)
                }}
                onRemove={(at) => {
                  items.remove(at)
                }}
                onDuplicate={(at) => {
                  const source = values[at]
                  if (source)
                    items.insert(at + 1, copyOf(source), {
                      focusName: `items.${String(at + 1)}.label`,
                    })
                }}
                onTypeChange={(at, type) => {
                  const source = values[at]
                  if (source) items.update(at, withType(source, type))
                }}
              />
            </li>
          ))}
        </ol>
      )}
      {listError && (
        <p role="alert" className="text-sm text-destructive">
          {listError}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        <AddQuestionMenu
          disabled={fieldCount >= LIMITS.fields}
          onAdd={(type) => {
            items.append(newField(type), { focusName: `items.${String(values.length)}.label` })
          }}
        />
        <Button
          variant="outline"
          onClick={() => {
            items.append(newSection(), { focusName: `items.${String(values.length)}.label` })
          }}
          className={cn(toolbarButtonClass, outlineButtonClass, 'gap-1.5 px-4 text-xs')}
        >
          <Rows3 aria-hidden="true" className="size-4" />
          Add section
        </Button>
      </div>
    </section>
  )
}

/** The builder over one form (or a new one). */
function BuilderEditor({
  form: initial,
  pane,
  onPaneChange,
  onClose,
  onCreated,
}: {
  form: CustomForm | null
  pane: BuilderPane
  onPaneChange: (pane: BuilderPane) => void
  onClose: () => void
  onCreated: (form: CustomForm) => void
}) {
  const [saved, setSaved] = useState<CustomForm | null>(initial)
  const [today] = useState(() => new Date())
  const [confirmLeave, setConfirmLeave] = useState(false)
  // The checked values waiting for "Publish form?": the confirm comes after the form's checks.
  const [publishing, setPublishing] = useState<BuilderValues | null>(null)
  const canPublish = useCan(CF_CODES.formsPublish)
  const save = useSaveForm()
  const publish = usePublishForm({ quiet: true })
  const form = useForm<BuilderValues>({
    resolver: zodResolver(builderSchema),
    defaultValues: saved ? formToBuilder(saved) : emptyBuilder(),
  })
  const { control, formState } = form
  const guard = useUnsavedChangesGuard(formState.isDirty)
  const busy = formState.isSubmitting || save.isPending || publish.isPending
  const locked = saved?.responseCount ?? 0
  const status = saved?.status ?? 'draft'

  const showErrors = (error: unknown, values: BuilderValues) => {
    const { fields, root } = builderErrors(error, values)
    fields.forEach(({ name, message }, index) => {
      form.setError(
        name as FieldPath<BuilderValues>,
        { type: 'server', message },
        { shouldFocus: index === 0 },
      )
    })
    if (root) toast.error(root)
    else if (error instanceof ApiError) toast.error(error.message)
  }

  const submit = (intent: Intent) =>
    form.handleSubmit(async (values) => {
      if (intent === 'publish') {
        if (!values.items.some((item) => item.kind === 'field')) {
          form.setError('items', { message: 'Add at least one question before publishing.' })
          return
        }
        if (values.closesOn && values.closesOn < toDateValue(today)) {
          form.setError(
            'closesOn',
            { message: 'Pick a closing date from today on.' },
            { shouldFocus: true },
          )
          return
        }
        setPublishing(values)
        return
      }
      await run(intent, values)
    })()

  /** Saves the form, then publishes it for 'publish' (after its confirm). */
  const run = async (intent: Intent, values: BuilderValues) => {
    let result: CustomForm
    try {
      result = await save.mutateAsync({ form: saved, input: builderToInput(values) })
    } catch (error) {
      showErrors(error, values)
      return
    }
    setSaved(result)
    form.reset(formToBuilder(result))
    if (intent === 'publish' && result.status !== 'published') {
      try {
        result = await publish.mutateAsync({
          id: result.id,
          rowVersion: result.rowVersion,
          title: result.title,
        })
        setSaved(result)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'The form was saved but not published.',
        )
      }
    } else {
      toast.success(saved ? 'Changes saved' : 'Draft saved')
    }
    if (!saved) {
      guard.allowNextNavigation()
      onCreated(result)
    }
  }

  const leave = () => {
    if (formState.isDirty) setConfirmLeave(true)
    else onClose()
  }

  return (
    <>
      <PageHeaderCard
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            {saved ? saved.title : 'New form'}
            <StatusChip status={status} />
          </span>
        }
        actions={
          <Button
            variant="outline"
            onClick={leave}
            className={cn(toolbarButtonClass, outlineButtonClass, 'gap-1.5 px-4 text-xs')}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to forms
          </Button>
        }
      >
        <p className="text-xs text-grey">
          {saved
            ? `${countText(saved.fields.length, 'question')} · ${countText(saved.responseCount, 'response')}`
            : 'Build the questions on the left; the preview shows the form as people will fill it.'}
        </p>
      </PageHeaderCard>

      <div
        role="tablist"
        aria-label="Builder"
        className={cn(cardClass, 'flex gap-6 px-4 sm:px-6 @[80rem]/page:hidden')}
      >
        {BUILDER_PANES.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={pane === item}
            aria-controls={item === 'build' ? BUILD_PANE_ID : PREVIEW_PANE_ID}
            data-state={pane === item ? 'active' : 'inactive'}
            onClick={() => {
              onPaneChange(item)
            }}
            className={tabClass}
          >
            {item === 'build' ? 'Build' : 'Preview'}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-4 sm:gap-5 @[80rem]/page:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <form
          id={BUILD_PANE_ID}
          noValidate
          aria-label="Form builder"
          onSubmit={(event) => {
            event.preventDefault()
            void submit('save')
          }}
          className={cn(
            'grid min-w-0 gap-4 sm:gap-5',
            fieldsClass,
            pane === 'preview' && 'hidden @[80rem]/page:grid',
          )}
        >
          <section aria-labelledby="cf-details" className={cn(cardClass, 'grid gap-4 p-4 sm:p-6')}>
            <h2 id="cf-details" className={cardTitleClass}>
              Details
            </h2>
            <TextField
              control={control}
              name="title"
              label="Title"
              required
              maxLength={LIMITS.title}
              placeholder="e.g. Employee Satisfaction Survey"
            />
            <TextareaField
              control={control}
              name="description"
              label="Description"
              maxLength={LIMITS.description}
              placeholder="What the form is for, shown above the questions"
            />
            <div className="grid gap-4 @lg:grid-cols-2">
              <TextField
                control={control}
                name="category"
                label="Category"
                maxLength={LIMITS.category}
                placeholder="Optional, e.g. Engagement"
              />
              <ClosingDateField control={control} minDate={today} />
            </div>
          </section>

          <section aria-labelledby="cf-audience" className={cn(cardClass, 'grid gap-4 p-4 sm:p-6')}>
            <h2 id="cf-audience" className={cardTitleClass}>
              Audience and settings
            </h2>
            <AudienceFields control={control} known={saved?.audience.targets ?? []} />
            <div className="grid gap-4 @lg:grid-cols-2">
              <SwitchField
                control={control}
                name="oneResponsePerPerson"
                label="One response per person"
                stateLabel={(on) => (on ? 'Each person answers once' : 'People can answer again')}
                className={navySwitchClass}
              />
              <SwitchField
                control={control}
                name="anonymous"
                label="Anonymous"
                disabled={locked > 0}
                stateLabel={(on) =>
                  on ? 'Names are not shown with answers' : 'Names are shown with answers'
                }
                className={navySwitchClass}
              />
            </div>
          </section>

          <QuestionsCard control={control} locked={locked} />

          <div className={cn(cardClass, 'flex flex-wrap items-center gap-3 p-4 sm:px-6')}>
            <Button
              type="submit"
              disabled={busy}
              className={status === 'draft' ? secondaryButtonClass : saveButtonClass}
            >
              {status === 'draft' ? 'Save draft' : 'Save changes'}
            </Button>
            {status !== 'published' && canPublish && (
              <Button
                disabled={busy}
                onClick={() => {
                  void submit('publish')
                }}
                className={saveButtonClass}
              >
                {status === 'closed' ? 'Save and reopen' : 'Publish'}
              </Button>
            )}
            {formState.isDirty && <span className="text-xs text-grey">Unsaved changes</span>}
          </div>
        </form>

        <section
          id={PREVIEW_PANE_ID}
          aria-labelledby="cf-preview"
          className={cn(
            cardClass,
            'grid gap-4 p-4 sm:p-6 @[80rem]/page:sticky @[80rem]/page:top-4',
            pane === 'build' && 'hidden @[80rem]/page:grid',
          )}
        >
          <h2 id="cf-preview" className={cardTitleClass}>
            Preview
          </h2>
          <Preview control={control} />
        </section>
      </div>

      <UnsavedChangesDialog guard={guard} />
      <ConfirmDialog
        open={publishing !== null}
        onOpenChange={(open) => {
          if (!open) setPublishing(null)
        }}
        title={status === 'closed' ? 'Save and reopen form' : 'Publish form'}
        description={`${status === 'closed' ? 'Reopen' : 'Publish'} “${publishing?.title.trim() ?? ''}”? The people it is for will find it in My Forms and can start answering.`}
        confirmLabel={status === 'closed' ? 'Save and reopen' : 'Publish'}
        cancelLabel="Keep editing"
        onConfirm={() => {
          const values = publishing
          setPublishing(null)
          if (values) void run('publish', values)
        }}
      />
      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="Discard your changes?"
        description="This form has changes that are not saved. They will be lost if you go back."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="destructive"
        onConfirm={() => {
          guard.allowNextNavigation()
          onClose()
        }}
      />
    </>
  )
}

/**
 * The builder (`/custom-form/forms?edit=new|<id>`): Details, Audience and settings, the
 * questions with sections, and the live preview beside them (a Build / Preview tab on a narrow
 * page). A form with responses opens limited: see `QuestionsCard`.
 */
export function FormBuilder({
  formId,
  pane,
  onPaneChange,
  onClose,
  onCreated,
}: {
  /** `null` for a new form. */
  formId: string | null
  pane: BuilderPane
  onPaneChange: (pane: BuilderPane) => void
  onClose: () => void
  /** After the first save: the new form's id goes in the URL. */
  onCreated: (id: string) => void
}) {
  const query = useCustomForm(formId)
  const queryClient = useQueryClient()
  if (formId !== null && query.isPending) {
    return (
      <div className={cn(cardClass, 'p-4 sm:p-6')}>
        <LoadingBlock label="the form" rows={6} />
      </div>
    )
  }
  if (formId !== null && query.error) {
    if (query.error.isNotFound) {
      return (
        <div className={cn(cardClass, 'p-4 sm:p-6')}>
          <EmptyBox icon={<FileQuestion />} title="This form no longer exists">
            <Button
              variant="outline"
              onClick={onClose}
              className={cn(toolbarButtonClass, outlineButtonClass, 'mt-2 px-4 text-xs')}
            >
              Back to forms
            </Button>
          </EmptyBox>
        </div>
      )
    }
    return (
      <LoadError
        error={query.error}
        onRetry={() => {
          void query.refetch()
        }}
      />
    )
  }
  const form = formId === null ? null : (query.data ?? null)
  return (
    <BuilderEditor
      key={form?.id ?? 'new'}
      form={form}
      pane={pane}
      onPaneChange={onPaneChange}
      onClose={onClose}
      onCreated={(created) => {
        // The builder reopens on the saved form at once, without reading it again.
        queryClient.setQueryData(customFormKeys.form(created.id), created)
        onCreated(created.id)
      }}
    />
  )
}
