import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'

import { AppDialog } from '@/components/feedback/app-dialog'
import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { FieldLayoutContext, TextField } from '@/components/form'
import { type DataTableColumn, RowActionsMenu, rowMenuItemClass } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import {
  useDeleteSetting,
  useSaveSetting,
  useSetSettingActive,
  useSettingsList,
  useSettingsRecord,
} from '../../hooks/use-attendance-settings'
import type {
  AudienceCriteria,
  IpRestriction,
  IpRestrictionInput,
} from '../../types/settings.types'
import { criteriaIsEmpty, toCriteria, toTargets } from '../../utils/criteria'
import {
  navyButtonClass,
  poppinsDialogTitleClass,
  poppinsFieldsClass,
  settingsDialogButtonClass,
  switchOnClass,
} from '../../utils/settings-styles'
import { CriteriaEditor } from './criteria-editor'
import { ActiveChip, SettingsListCard } from './settings-list'

const PERMISSION = 'attendance.settings.ip_restrictions'

const IPV4 = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/
const isIpv6 = (value: string) => /^[0-9a-fA-F:.]+$/.test(value) && value.includes(':')
const isIp = (value: string) => IPV4.test(value) || isIpv6(value)
const toNumber = (address: string) =>
  address.split('.').reduce((sum, part) => sum * 256 + Number(part), 0)

const schema = z
  .object({
    appliesToAll: z.boolean(),
    range: z.boolean(),
    ipv4: z
      .string()
      .trim()
      .refine((value) => {
        if (value === '') return true
        const [address = '', bits] = value.split('/')
        return (
          IPV4.test(address) && (bits === undefined || (/^\d+$/.test(bits) && Number(bits) <= 32))
        )
      }, 'Enter an IPv4 address such as 192.168.2.38/31'),
    ipv6: z
      .string()
      .trim()
      .refine(
        (value) =>
          value === '' || (/^[0-9a-fA-F:]+(\/\d{1,3})?$/.test(value) && value.includes(':')),
        'Enter an IPv6 address',
      ),
    netmask: z
      .string()
      .trim()
      .refine((value) => value === '' || IPV4.test(value), 'Enter a mask such as 255.255.255.0'),
    rangeStart: z
      .string()
      .trim()
      .refine((value) => value === '' || isIp(value), 'Enter an IP address'),
    rangeEnd: z
      .string()
      .trim()
      .refine((value) => value === '' || isIp(value), 'Enter an IP address'),
    criteria: z.custom<AudienceCriteria>(),
    isActive: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.range) {
      if (!values.rangeStart)
        ctx.addIssue({ code: 'custom', path: ['rangeStart'], message: 'Enter the first address' })
      if (!values.rangeEnd)
        ctx.addIssue({ code: 'custom', path: ['rangeEnd'], message: 'Enter the last address' })
      if (
        IPV4.test(values.rangeStart) &&
        IPV4.test(values.rangeEnd) &&
        toNumber(values.rangeEnd) < toNumber(values.rangeStart)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['rangeEnd'],
          message: 'Must not be before Range Start',
        })
      }
    } else {
      if (!values.ipv4 && !values.ipv6)
        ctx.addIssue({
          code: 'custom',
          path: ['ipv4'],
          message: 'Enter an IPv4 or an IPv6 address',
        })
      if (values.netmask && !values.ipv4)
        ctx.addIssue({
          code: 'custom',
          path: ['netmask'],
          message: 'A subnet mask goes with an IPv4 address',
        })
    }
    if (!values.appliesToAll && criteriaIsEmpty(values.criteria)) {
      ctx.addIssue({
        code: 'custom',
        path: ['criteria'],
        message: 'Choose who it applies to, or tick All Employees',
      })
    }
  })
type Values = z.infer<typeof schema>

function toValues(record: IpRestriction | null): Values {
  return {
    appliesToAll: record?.appliesToAll ?? true,
    range: Boolean(record?.rangeStart),
    ipv4: record?.ipv4 ?? '',
    ipv6: record?.ipv6 ?? '',
    netmask: record?.netmask ?? '',
    rangeStart: record?.rangeStart ?? '',
    rangeEnd: record?.rangeEnd ?? '',
    criteria: toCriteria(record?.targets),
    isActive: record?.isActive ?? true,
  }
}

function toInput(values: Values, rowVersion: string | null): IpRestrictionInput {
  const text = (value: string) => (value.trim() === '' ? null : value.trim())
  return {
    ipv4: values.range ? null : text(values.ipv4),
    ipv6: values.range ? null : text(values.ipv6),
    netmask: values.range ? null : text(values.netmask),
    rangeStart: values.range ? text(values.rangeStart) : null,
    rangeEnd: values.range ? text(values.rangeEnd) : null,
    appliesToAll: values.appliesToAll,
    isActive: values.isActive,
    targets: values.appliesToAll ? [] : toTargets(values.criteria),
    rowVersion,
  }
}

const FIELDS = ['ipv4', 'ipv6', 'netmask', 'rangeStart', 'rangeEnd', 'criteria'] as const

/** "Create IP Restriction": the address (netmask or range) and who it applies to. */
function IpRestrictionForm({
  record,
  onClose,
}: {
  record: IpRestriction | null
  onClose: () => void
}) {
  const save = useSaveSetting('ipRestrictions')
  const canSave = useCan(`${PERMISSION}.${record ? 'edit' : 'create'}`)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(record) })
  const { control } = form
  const [appliesToAll, range] = useWatch({ control, name: ['appliesToAll', 'range'] })

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: record?.id,
        input: toInput(values, record?.rowVersion ?? null),
      })
    } catch (error) {
      if (error instanceof ApiError) {
        const [field, message] = Object.entries(error.fieldErrors)[0] ?? []
        const known = FIELDS.find((name) => name === (field === 'targets' ? 'criteria' : field))
        if (known && message) form.setError(known, { message })
        else form.setError('root', { message: error.message })
      }
      return
    }
    onClose()
  })

  return (
    <AppDialog
      title={record ? `IP Restriction ${record.code}` : 'Create IP Restriction'}
      onRequestClose={onClose}
      className={cn('max-w-4xl', poppinsFieldsClass)}
      titleClassName={poppinsDialogTitleClass}
      footer={
        <>
          {form.formState.errors.root && (
            <p role="alert" className="mr-auto self-center text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}
          <Button
            variant="destructive"
            size="lg"
            onClick={onClose}
            className={settingsDialogButtonClass}
          >
            Cancel
          </Button>
          {canSave && (
            <Button
              type="submit"
              form="ip-restriction-form"
              size="lg"
              disabled={save.isPending}
              className={cn(settingsDialogButtonClass, navyButtonClass)}
            >
              {record ? 'Save Changes' : 'Create'}
            </Button>
          )}
        </>
      }
    >
      <FieldLayoutContext value="vertical">
        <form
          id="ip-restriction-form"
          noValidate
          onSubmit={(event) => void submit(event)}
          className="grid gap-5"
        >
          <div className="flex flex-wrap items-center gap-x-10 gap-y-3">
            <Controller
              control={control}
              name="appliesToAll"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-xs font-medium text-[#202020] dark:text-heading">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked === true)
                    }}
                  />
                  All Employees
                </label>
              )}
            />
            <Controller
              control={control}
              name="range"
              render={({ field }) => (
                <label className="flex items-center gap-2.5 text-[0.6875rem] font-medium text-grey">
                  <span className={cn(!field.value && switchOnClass)}>Netmask</span>
                  <Switch
                    checked={field.value}
                    aria-label="Use an address range"
                    onCheckedChange={field.onChange}
                    className="data-[state=checked]:bg-sidebar dark:data-[state=checked]:bg-primary"
                  />
                  <span className={cn(field.value && switchOnClass)}>Range</span>
                </label>
              )}
            />
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-xs font-medium text-[#202020] dark:text-heading">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked === true)
                    }}
                  />
                  Active
                </label>
              )}
            />
          </div>
          <div className="grid gap-4 @2xl:grid-cols-3">
            <TextField
              control={control}
              name="ipv4"
              label="IPv4 Address"
              placeholder="192.168.2.38/31"
              disabled={range}
            />
            <TextField
              control={control}
              name="ipv6"
              label="IPv6 Address"
              placeholder="2001:0000:130F::09C0:876A:130B"
              disabled={range}
            />
            <TextField
              control={control}
              name="netmask"
              label="Subnet Mask"
              placeholder="255.255.255.248"
              disabled={range}
            />
          </div>
          <div className="grid gap-4 @md:grid-cols-2 @3xl:grid-cols-3">
            <TextField
              control={control}
              name="rangeStart"
              label="Range Start"
              placeholder="192.168.2.33"
              disabled={!range}
            />
            <TextField
              control={control}
              name="rangeEnd"
              label="Range End"
              placeholder="192.168.2.38"
              disabled={!range}
            />
            {record && (
              <div className="grid gap-2">
                <span className="text-sm leading-none text-title">Count</span>
                <span className="flex h-10 items-center text-sm text-grey">
                  {record.addressCount?.toLocaleString() ?? '—'} address
                  {record.addressCount === 1 ? '' : 'es'}
                </span>
              </div>
            )}
          </div>
          <div className="@container border-t pt-4">
            {appliesToAll ? (
              <p className="text-sm text-muted-foreground">
                Applies to all employees. Untick All Employees to add criteria.
              </p>
            ) : (
              <Controller
                control={control}
                name="criteria"
                render={({ field, fieldState }) => (
                  <CriteriaEditor
                    value={field.value}
                    onChange={field.onChange}
                    permission={`${PERMISSION}.view`}
                    error={fieldState.error?.message}
                  />
                )}
              />
            )}
          </div>
        </form>
      </FieldLayoutContext>
    </AppDialog>
  )
}

/** Loads the whole record (the list leaves its targets out), then shows the form. */
function IpRestrictionDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const record = useSettingsRecord('ipRestrictions', id)
  if (id === null) return <IpRestrictionForm record={null} onClose={onClose} />
  if (!record.data) {
    return (
      <AppDialog
        title="IP Restriction"
        onRequestClose={onClose}
        className="max-w-4xl"
        titleClassName={poppinsDialogTitleClass}
      >
        {record.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {record.error.message}
          </p>
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </AppDialog>
    )
  }
  return <IpRestrictionForm record={record.data} onClose={onClose} />
}

const describe = (row: IpRestriction) =>
  row.rangeStart
    ? `${row.rangeStart} – ${row.rangeEnd ?? ''}`
    : [row.ipv4 && (row.netmask ? `${row.ipv4} / ${row.netmask}` : row.ipv4), row.ipv6]
        .filter(Boolean)
        .join(', ')

const columns: DataTableColumn<IpRestriction>[] = [
  { id: 'code', header: 'Code', cell: (row) => row.code, mobile: 'heading' },
  { id: 'ip', header: 'IP', cell: describe },
  {
    id: 'count',
    header: 'Count',
    cell: (row) => row.addressCount?.toLocaleString() ?? '—',
  },
  {
    id: 'appliesTo',
    header: 'Applies To',
    cell: (row) =>
      row.appliesToAll
        ? 'All Employees'
        : `${row.targetCount} criteria value${row.targetCount === 1 ? '' : 's'}`,
  },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => <ActiveChip active={row.isActive} />,
    align: 'right',
  },
]

/** Settings → IP Restrictions: the networks punches are accepted from. */
export function IpRestrictionsTab() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<{ id: string | null } | null>(null)
  const [deleting, setDeleting] = useState<IpRestriction | null>(null)
  const list = useSettingsList('ipRestrictions', {
    page,
    pageSize: 10,
    ...(search ? { q: search } : {}),
  })
  const remove = useDeleteSetting('ipRestrictions')
  const setActive = useSetSettingActive('ipRestrictions')
  const canCreate = useCan(`${PERMISSION}.create`)
  const canEdit = useCan(`${PERMISSION}.edit`)
  const canDelete = useCan(`${PERMISSION}.delete`)

  return (
    <>
      <SettingsListCard
        title="IP Restrictions"
        columns={columns}
        rows={list.data?.data ?? []}
        meta={list.data?.meta}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        searchLabel="Search IP restrictions"
        onSearch={(text) => {
          setSearch(text)
          setPage(1)
        }}
        onPageChange={setPage}
        {...(canCreate
          ? {
              onCreate: () => {
                setDialog({ id: null })
              },
            }
          : {})}
        emptyText="No IP restrictions match."
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.poppins}
            label={`Actions for ${row.code}`}
            actions={[
              {
                label: canEdit ? 'View / Edit' : 'View',
                onSelect: () => {
                  setDialog({ id: row.id })
                },
              },
              ...(canEdit
                ? [
                    {
                      label: row.isActive ? 'Deactivate' : 'Activate',
                      onSelect: () => {
                        setActive.mutate(
                          { id: row.id, active: !row.isActive },
                          {
                            onError: (error) => {
                              toast.error(error.message)
                            },
                          },
                        )
                      },
                    },
                  ]
                : []),
              ...(canDelete
                ? [
                    {
                      label: 'Delete',
                      variant: 'destructive' as const,
                      onSelect: () => {
                        setDeleting(row)
                      },
                    },
                  ]
                : []),
            ]}
          />
        )}
      />
      {dialog && (
        <IpRestrictionDialog
          id={dialog.id}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete ${deleting?.code ?? 'IP restriction'}`}
        description="Are you sure you want to Delete this?"
        confirmLabel="Yes"
        cancelLabel="No"
        variant="destructive"
        onConfirm={() => {
          if (deleting) {
            remove.mutate(
              { id: deleting.id, rowVersion: deleting.rowVersion },
              {
                onError: (error) => {
                  toast.error(
                    error instanceof ApiError ? error.message : 'Could not delete the restriction.',
                  )
                },
              },
            )
          }
        }}
      />
    </>
  )
}
