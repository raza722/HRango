import { type DragEvent, useId } from 'react'
import { type Control, useController, useFieldArray, useFormState, useWatch } from 'react-hook-form'
import { ArrowDown, ArrowUp, Copy, GripVertical, Lock, Plus, Trash2, X } from 'lucide-react'

import { FormField, SelectField, SwitchField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { FIELD_TYPE_META, LIMITS, RATING_MAX_SCALE, RATING_MIN_SCALE } from '../../constants'
import { type BuilderValues, newKey } from '../../schemas/builder.schema'
import { FIELD_TYPES, type FieldType, isChoiceType } from '../../types/custom-forms.types'
import {
  chipClass,
  iconButtonClass,
  navySwitchClass,
  outlineButtonClass,
  toolbarButtonClass,
} from '../../utils/styles'

const SCALES = Array.from({ length: RATING_MAX_SCALE - RATING_MIN_SCALE + 1 }, (_, index) => {
  const value = String(RATING_MIN_SCALE + index)
  return { value, label: `${value} stars` }
})

/** The drag data type of a builder item (its index). */
const DRAG_TYPE = 'application/x-custom-form-item'

function OptionInput({
  control,
  index,
  optionIndex,
}: {
  control: Control<BuilderValues>
  index: number
  optionIndex: number
}) {
  const {
    field: { ref, value, onChange, onBlur },
  } = useController({
    control,
    name: `items.${index}.options.${optionIndex}.label`,
  })
  return (
    <Input
      aria-label={`Option ${String(optionIndex + 1)}`}
      placeholder={`Option ${String(optionIndex + 1)}`}
      ref={ref}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      maxLength={LIMITS.option}
      className="h-9 min-w-0 flex-1"
    />
  )
}

/** A choice question's options: a box each, × to remove (not one with answers), + Add option. */
function OptionsEditor({
  control,
  index,
  locked,
}: {
  control: Control<BuilderValues>
  index: number
  locked: boolean
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `items.${index}.options`,
    keyName: 'rowKey',
  })
  const { errors } = useFormState({ control, name: `items.${index}.options` })
  const error = errors.items?.[index]?.options
  const message = error?.message ?? error?.root?.message
  const errorId = useId()
  return (
    <fieldset className="grid gap-2" aria-describedby={message ? errorId : undefined}>
      <legend className="mb-2 text-sm text-title dark:text-heading">Options</legend>
      <ol className="grid gap-2">
        {fields.map((option, optionIndex) => (
          <li key={option.rowKey} className="flex items-center gap-2">
            <span aria-hidden="true" className="w-5 shrink-0 text-right text-xs text-grey">
              {optionIndex + 1}.
            </span>
            <OptionInput control={control} index={index} optionIndex={optionIndex} />
            <button
              type="button"
              aria-label={`Remove option ${String(optionIndex + 1)}`}
              title={option.locked ? 'This option has answers, so it stays.' : undefined}
              disabled={option.locked}
              onClick={() => {
                remove(optionIndex)
              }}
              className={iconButtonClass}
            >
              {option.locked ? <Lock aria-hidden="true" /> : <X aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ol>
      {message && (
        <p id={errorId} className="text-xs text-destructive">
          {message}
        </p>
      )}
      <div>
        <Button
          variant="outline"
          disabled={fields.length >= LIMITS.options}
          onClick={() => {
            append({
              key: newKey(),
              id: null,
              label: '',
              locked: false,
            })
          }}
          className={cn(toolbarButtonClass, outlineButtonClass, 'gap-1.5 px-3 text-xs')}
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Add option
        </Button>
      </div>
      {locked && (
        <p className="text-xs text-grey">
          Options with answers stay; you can reword them or add more.
        </p>
      )}
    </fieldset>
  )
}

/** The type picker: every type with its icon; fixed once the question has answers. */
function TypeSelect({
  value,
  locked,
  onChange,
}: {
  value: FieldType
  locked: boolean
  onChange: (type: FieldType) => void
}) {
  return (
    <FormField label="Type" description={locked ? 'Fixed: the question has answers.' : undefined}>
      {(a11y) => (
        <Select
          value={value}
          disabled={locked}
          onValueChange={(next) => {
            const type = FIELD_TYPES.find((item) => item === next)
            if (type) onChange(type)
          }}
        >
          <SelectTrigger {...a11y}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((type) => {
              const { icon: Icon, label } = FIELD_TYPE_META[type]
              return (
                <SelectItem key={type} value={type}>
                  <span className="flex items-center gap-2">
                    <Icon aria-hidden="true" className="size-4 text-grey" />
                    {label}
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      )}
    </FormField>
  )
}

export interface ItemEditorProps {
  control: Control<BuilderValues>
  index: number
  /** Items in the list (for the move buttons). */
  count: number
  /** "Question 3" or "Section 2". */
  name: string
  onMove: (from: number, to: number) => void
  onRemove: (index: number) => void
  onDuplicate: (index: number) => void
  onTypeChange: (index: number, type: FieldType) => void
}

/**
 * One question or section break in the builder: its words, type, options, limits and Required,
 * with Move up / Move down / Duplicate / Delete. The grip drags it to another place (the buttons
 * do the same from the keyboard). A question with answers keeps its type and cannot be deleted.
 */
export function ItemEditor({
  control,
  index,
  count,
  name,
  onMove,
  onRemove,
  onDuplicate,
  onTypeChange,
}: ItemEditorProps) {
  const item = useWatch({ control, name: `items.${index}` })
  const section = item.kind === 'section'
  const limits = section ? null : FIELD_TYPE_META[item.type].limits
  const lower = name.toLowerCase()
  // The buttons name the question by its text ("Move “Preferred shift” up"), its number until
  // it has one.
  const text = item.label.trim()
  const called = text ? `“${text}”` : lower

  const onDrop = (event: DragEvent) => {
    const from = Number(event.dataTransfer.getData(DRAG_TYPE))
    if (!event.dataTransfer.types.includes(DRAG_TYPE) || Number.isNaN(from)) return
    event.preventDefault()
    if (from !== index) onMove(from, index)
  }

  return (
    <section
      aria-label={section ? name : `${name}, ${FIELD_TYPE_META[item.type].label}`}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(DRAG_TYPE)) event.preventDefault()
      }}
      onDrop={onDrop}
      className={cn(
        'grid gap-4 rounded-[10px] border bg-card p-3.5 sm:p-4',
        section
          ? 'border-sidebar/30 bg-[#F6F8FC] dark:border-primary/40 dark:bg-muted/40'
          : 'border-[#E0E0E0] dark:border-border',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(DRAG_TYPE, String(index))
            event.dataTransfer.effectAllowed = 'move'
          }}
          title="Drag to move"
          aria-hidden="true"
          className="flex cursor-grab items-center text-grey active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </span>
        <h3 className="text-sm font-medium text-sidebar dark:text-heading">
          {name}
          {!section && (
            <span className="font-normal text-grey"> · {FIELD_TYPE_META[item.type].label}</span>
          )}
        </h3>
        {item.locked && (
          <span
            className={cn(
              chipClass,
              'bg-[#EBEFF8] text-[#263871] dark:bg-sky-500/15 dark:text-sky-300',
            )}
          >
            <Lock aria-hidden="true" className="size-3" />
            Has answers
          </span>
        )}
        <span className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            aria-label={`Move ${called} up`}
            disabled={index === 0}
            onClick={() => {
              onMove(index, index - 1)
            }}
            className={iconButtonClass}
          >
            <ArrowUp aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Move ${called} down`}
            disabled={index === count - 1}
            onClick={() => {
              onMove(index, index + 1)
            }}
            className={iconButtonClass}
          >
            <ArrowDown aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Duplicate ${called}`}
            onClick={() => {
              onDuplicate(index)
            }}
            className={iconButtonClass}
          >
            <Copy aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${called}`}
            title={item.locked ? 'This question has answers, so it stays.' : undefined}
            disabled={item.locked}
            onClick={() => {
              onRemove(index)
            }}
            className={cn(iconButtonClass, 'hover:text-destructive')}
          >
            <Trash2 aria-hidden="true" />
          </button>
        </span>
      </div>

      {section ? (
        <div className="grid gap-4 @lg:grid-cols-2">
          <TextField
            control={control}
            name={`items.${index}.label`}
            label="Section title"
            required
            maxLength={LIMITS.sectionTitle}
          />
          <TextField
            control={control}
            name={`items.${index}.helpText`}
            label="Section description"
            maxLength={LIMITS.helpText}
          />
        </div>
      ) : (
        <>
          <div className="grid gap-4 @lg:grid-cols-[minmax(0,1fr)_13rem]">
            <TextField
              control={control}
              name={`items.${index}.label`}
              label="Question"
              required
              maxLength={LIMITS.label}
              placeholder="What do you want to ask?"
            />
            <TypeSelect
              value={item.type}
              locked={item.locked}
              onChange={(type) => {
                onTypeChange(index, type)
              }}
            />
          </div>
          <TextField
            control={control}
            name={`items.${index}.helpText`}
            label="Help text"
            maxLength={LIMITS.helpText}
            placeholder="Optional: a hint under the question"
          />
          {isChoiceType(item.type) && (
            <OptionsEditor control={control} index={index} locked={item.locked} />
          )}
          {limits && (
            <div className="grid gap-4 @md:grid-cols-2">
              <TextField
                control={control}
                name={`items.${index}.min`}
                label={limits.min}
                inputMode={limits.integer ? 'numeric' : 'decimal'}
                placeholder="No minimum"
              />
              <TextField
                control={control}
                name={`items.${index}.max`}
                label={limits.max}
                inputMode={limits.integer ? 'numeric' : 'decimal'}
                placeholder="No maximum"
              />
            </div>
          )}
          {item.type === 'rating' && (
            <SelectField
              control={control}
              name={`items.${index}.max`}
              label="Scale"
              options={SCALES}
              className="max-w-[13rem]"
            />
          )}
          <SwitchField
            control={control}
            name={`items.${index}.required`}
            label="Required"
            stateLabel={(on) => (on ? 'An answer is needed' : 'Optional')}
            className={navySwitchClass}
          />
        </>
      )}
    </section>
  )
}
