import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { SelectField, TextareaField } from '@/components/form'
import { DataTable, type DataTableColumn } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { SearchSelectField } from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { ACCESS_CODES, EFFECT_LABELS, labelOf, SCOPE_HINTS, SCOPE_LABELS } from '../../constants'
import {
  useCatalogue,
  useDeleteOverride,
  useOverrides,
  useSaveOverride,
} from '../../hooks/use-access'
import {
  OVERRIDE_FORM_DEFAULTS,
  overrideFormSchema,
  overrideFormToInput,
  type OverrideFormValues,
} from '../../schemas/access-forms.schema'
import {
  type Override,
  OVERRIDE_EFFECTS,
  OVERRIDE_SCOPES,
  type UserDetail,
} from '../../types/access.types'
import { showServerErrors } from '../../utils/form-errors'
import { formatStamp, plural, possessive } from '../../utils/format'
import { navyButtonClass, tableClass, toolbarButtonClass } from '../../utils/styles'
import { ConfirmAction, FormDialog } from '../shared/dialogs'
import { Chip, LoadError, SectionCard, SensitiveChip } from '../shared/parts'

const FIELDS = ['code', 'effect', 'scope', 'reason']

/** Add Override: one permission granted (with a scope) or denied, and why. */
function OverrideDialog({
  user,
  existing,
  onClose,
}: {
  user: UserDetail
  existing: readonly Override[]
  onClose: () => void
}) {
  const catalogue = useCatalogue()
  const save = useSaveOverride()
  const form = useForm<OverrideFormValues>({
    resolver: zodResolver(overrideFormSchema),
    defaultValues: OVERRIDE_FORM_DEFAULTS,
  })
  const effect = useWatch({ control: form.control, name: 'effect' })
  const code = useWatch({ control: form.control, name: 'code' })
  const replacing = existing.find((override) => override.code === code)

  const options = (catalogue.data ?? []).map((definition) => ({
    value: definition.code,
    label: definition.label,
    hint: definition.isSensitive ? `${definition.module} · Sensitive` : definition.module,
  }))

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ userId: user.id, input: overrideFormToInput(values) })
    } catch (error) {
      showServerErrors(error, form.setError, FIELDS)
      return
    }
    onClose()
  })

  return (
    <FormDialog
      title="Add Override"
      description={`Grant or deny one permission to ${user.name}, whatever their roles say.`}
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      saveLabel="Save Override"
      rootError={form.formState.errors.root?.message}
    >
      <SearchSelectField
        control={form.control}
        name="code"
        label="Permission"
        required
        options={options}
        placeholder={catalogue.isPending ? 'Loading the catalogue…' : 'Search a screen or action'}
      />
      {replacing && (
        <p role="status" className="-mt-2 text-xs text-[#B7791F] dark:text-amber-300">
          This replaces the {replacing.effect === 'grant' ? 'grant' : 'denial'} {user.name} already
          has for it.
        </p>
      )}
      <div className="grid gap-4 @md:grid-cols-2">
        <SelectField
          control={form.control}
          name="effect"
          label="Effect"
          required
          options={OVERRIDE_EFFECTS.map((value) => ({ value, label: EFFECT_LABELS[value] }))}
          onValueChange={(next) => {
            if (next === 'deny') form.setValue('scope', '')
            else if (form.getValues('scope') === '') form.setValue('scope', 'own')
          }}
        />
        {effect === 'grant' && (
          <SelectField
            control={form.control}
            name="scope"
            label="Scope"
            required
            options={OVERRIDE_SCOPES.map((value) => ({
              value,
              label: `${SCOPE_LABELS[value]}: ${SCOPE_HINTS[value].toLowerCase()}`,
            }))}
          />
        )}
      </div>
      {effect === 'deny' && (
        <p className="-mt-2 text-xs text-muted-foreground">
          A denial takes the permission away at every scope, even when a role gives it.
        </p>
      )}
      <TextareaField
        control={form.control}
        name="reason"
        label="Reason"
        required
        placeholder="Why this person needs the exception (kept in the history)"
      />
    </FormDialog>
  )
}

/**
 * Overrides (`GET / PUT / DELETE /access/users/{id}/overrides`): single permissions granted to
 * this person with a scope, or denied, each with its reason. A grant adds to the roles; a
 * denial wins over them. Remove asks first.
 */
export function UserOverridesTab({ user }: { user: UserDetail }) {
  const canManage = useCan(ACCESS_CODES.usersOverrides)
  const overrides = useOverrides(user.id)
  const remove = useDeleteOverride()
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<Override | null>(null)

  const columns: DataTableColumn<Override>[] = [
    {
      id: 'permission',
      header: 'Permission',
      mobile: 'heading',
      className: 'min-w-56 whitespace-normal',
      cell: (row) => (
        <span className="grid gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-person dark:text-heading">{row.label}</span>
            {row.isSensitive && <SensitiveChip />}
          </span>
          <span className="text-[0.625rem] text-grey">{row.module}</span>
        </span>
      ),
    },
    {
      id: 'effect',
      header: 'Effect',
      cell: (row) =>
        row.effect === 'grant' ? <Chip tone="green">Grant</Chip> : <Chip tone="red">Deny</Chip>,
    },
    {
      id: 'scope',
      header: 'Scope',
      cell: (row) => (row.scope ? labelOf(SCOPE_LABELS, row.scope) : 'Every scope'),
    },
    {
      id: 'reason',
      header: 'Reason',
      className: 'min-w-48 whitespace-normal',
      cell: (row) => row.reason ?? '—',
    },
    {
      id: 'updated',
      header: 'Updated',
      className: 'min-w-32',
      cell: (row) => formatStamp(row.updatedAt ?? row.createdAt),
    },
    ...(canManage
      ? [
          {
            id: 'action',
            header: 'Action',
            align: 'center' as const,
            cell: (row: Override) => (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRemoving(row)
                }}
                aria-label={`Remove override: ${row.label}`}
                className="h-8 px-2 text-xs text-destructive hover:text-destructive"
              >
                Remove
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <SectionCard
      title={overrides.data ? `Overrides (${String(overrides.data.length)})` : 'Overrides'}
      as="h3"
      actions={
        canManage && (
          <Button
            onClick={() => {
              setAdding(true)
            }}
            className={cn(toolbarButtonClass, navyButtonClass)}
          >
            + Add Override
          </Button>
        )
      }
    >
      {overrides.isError && !overrides.data ? (
        <LoadError
          error={overrides.error}
          what="the overrides"
          onRetry={() => void overrides.refetch()}
        />
      ) : (
        <div className="grid gap-3">
          <p className="text-xs text-muted-foreground">
            Exceptions for {user.name} alone: a grant adds a permission with its own scope, a denial
            takes one away whatever the roles say.
          </p>
          <DataTable
            caption={`${possessive(user.name)} overrides`}
            columns={columns}
            data={overrides.data ?? []}
            getRowId={(row) => row.id}
            isLoading={overrides.isPending}
            isFetching={overrides.isFetching}
            className={tableClass}
            loadingRowCount={3}
            emptyState="No overrides: the account holds exactly what its roles give."
          />
        </div>
      )}
      {adding && (
        <OverrideDialog
          user={user}
          existing={overrides.data ?? []}
          onClose={() => {
            setAdding(false)
          }}
        />
      )}
      {removing && (
        <ConfirmAction
          title={`Remove the ${removing.effect === 'grant' ? 'grant' : 'denial'} of ${removing.label}?`}
          description={
            removing.effect === 'grant'
              ? `${user.name} keeps it only if one of their roles gives it.`
              : `${user.name} gets it back if one of their roles gives it.`
          }
          confirmLabel="Remove Override"
          destructive
          onConfirm={() => {
            remove.mutate({
              userId: user.id,
              id: removing.id,
              rowVersion: removing.rowVersion,
              label: removing.label,
            })
          }}
          onClose={() => {
            setRemoving(null)
          }}
        />
      )}
      <span className="sr-only" aria-live="polite">
        {overrides.data ? plural(overrides.data.length, 'override') : ''}
      </span>
    </SectionCard>
  )
}
