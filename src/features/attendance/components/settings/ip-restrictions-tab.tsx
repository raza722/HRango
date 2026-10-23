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
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import {
  useDeleteSetting,
  useSaveSetting,
  useSetSettingActive,
  useSettingsList,
} from '../../hooks/use-attendance-settings'
import type {
  AudienceCriteria,
  IpRestriction,
  IpRestrictionInput,
} from '../../types/settings.types'
import {
  navyButtonClass,
  poppinsDialogTitleClass,
  poppinsFieldsClass,
  settingsDialogButtonClass,
  switchOnClass,
} from '../../utils/settings-styles'
import { CriteriaEditor } from './criteria-editor'
import { ActiveChip, SettingsListCard } from './settings-list'

const IPV4 = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/
const optionalIp = z
  .string()
  .trim()
  .refine((value) => value === '' || IPV4.test(value), 'Enter an IPv4 address such as 192.168.2.33')
const toNumber = (address: string) =>
  address.split('.').reduce((sum, part) => sum * 256 + Number(part), 0)

const schema = z
  .object({
    allEmployees: z.boolean(),
    range: z.boolean(),
    name: z.string().trim().max(80, 'Keep it under 80 characters'),
    ipv4: z
      .string()
      .trim()
      .min(1, 'Enter the IPv4 address')
      .refine((value) => {
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
    subnetMask: optionalIp,
    rangeStart: optionalIp,
    rangeEnd: optionalIp,
    count: z
      .string()
      .trim()
      .refine(
        (value) => value === '' || (/^\d+$/.test(value) && Number(value) >= 1),
        'A whole number of addresses',
      ),
    criteria: z.array(z.custom<AudienceCriteria>()),
    active: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.range) {
      if (!values.rangeStart)
        ctx.addIssue({ code: 'custom', path: ['rangeStart'], message: 'Enter the first address' })
      if (!values.rangeEnd)
        ctx.addIssue({ code: 'custom', path: ['rangeEnd'], message: 'Enter the last address' })
      if (
        values.rangeStart &&
        values.rangeEnd &&
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
    }
    if (!values.allEmployees && values.criteria.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['criteria'],
        message: 'Add criteria, or tick All Employees',
      })
    }
  })
type Values = z.infer<typeof schema>

function toValues(record: IpRestriction | null): Values {
  return {
    allEmployees: record?.allEmployees ?? true,
    range: record?.mode === 'range',
    name: record?.name ?? '',
    ipv4: record?.ipv4 ?? '',
    ipv6: record?.ipv6 ?? '',
    subnetMask: record?.subnetMask ?? '',
    rangeStart: record?.rangeStart ?? '',
    rangeEnd: record?.rangeEnd ?? '',
    count: record?.count == null ? '' : String(record.count),
    criteria: record?.criteria ?? [],
    active: record?.active ?? true,
  }
}

function toInput(values: Values): IpRestrictionInput {
  const text = (value: string) => (value.trim() === '' ? null : value.trim())
  return {
    name: values.name.trim(),
    mode: values.range ? 'range' : 'netmask',
    ipv4: values.ipv4.trim(),
    ipv6: text(values.ipv6),
    subnetMask: values.range ? null : text(values.subnetMask),
    rangeStart: values.range ? text(values.rangeStart) : null,
    rangeEnd: values.range ? text(values.rangeEnd) : null,
    count: values.range && values.count ? Number(values.count) : null,
    allEmployees: values.allEmployees,
    criteria: values.allEmployees ? [] : values.criteria,
    active: values.active,
  }
}

const FIELDS = ['name', 'ipv4', 'ipv6', 'subnetMask', 'rangeStart', 'rangeEnd', 'count'] as const

/** "Create IP Restriction": the address (netmask or range) and who it applies to. */
function IpRestrictionDialog({
  record,
  onClose,
}: {
  record: IpRestriction | null
  onClose: () => void
}) {
  const save = useSaveSetting('ipRestrictions')
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(record) })
  const { control } = form
  const [allEmployees, range] = useWatch({ control, name: ['allEmployees', 'range'] })

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: record?.id, input: toInput(values) })
    } catch (error) {
      if (error instanceof ApiError) {
        const [field, message] = Object.entries(error.fieldErrors)[0] ?? []
        const known = FIELDS.find((name) => name === field)
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
          <Button
            type="submit"
            form="ip-restriction-form"
            size="lg"
            disabled={save.isPending}
            className={cn(settingsDialogButtonClass, navyButtonClass)}
          >
            {record ? 'Save Changes' : 'Create'}
          </Button>
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
              name="allEmployees"
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
          </div>
          <div className="grid gap-4 @2xl:grid-cols-3">
            <TextField control={control} name="name" label="Name" placeholder="Enter name" />
            <TextField
              control={control}
              name="ipv4"
              label="IPv4 Address"
              placeholder="192.168.2.38/31"
              required
            />
            <TextField
              control={control}
              name="ipv6"
              label="IPv6 Address"
              placeholder="2001:0000:130F::09C0:876A:130B"
            />
          </div>
          <div className="grid gap-4 @md:grid-cols-2 @3xl:grid-cols-4">
            <TextField
              control={control}
              name="subnetMask"
              label="Subnet Mask"
              placeholder="255.255.255.248"
              disabled={range}
            />
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
            <TextField
              control={control}
              name="count"
              label="Count"
              placeholder="Enter count"
              inputMode="numeric"
              disabled={!range}
            />
          </div>
          <div className="border-t pt-4">
            {allEmployees ? (
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

const columns: DataTableColumn<IpRestriction>[] = [
  { id: 'code', header: 'Code', cell: (row) => row.code, mobile: 'heading' },
  { id: 'name', header: 'Name', cell: (row) => row.name },
  {
    id: 'ip',
    header: 'IP',
    cell: (row) =>
      row.mode === 'range' ? `${row.rangeStart ?? ''} – ${row.rangeEnd ?? ''}` : row.ipv4,
  },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => <ActiveChip active={row.active} />,
    align: 'right',
  },
]

/** Settings → IP Restrictions: the networks punches are accepted from. */
export function IpRestrictionsTab() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<{ record: IpRestriction | null } | null>(null)
  const [deleting, setDeleting] = useState<IpRestriction | null>(null)
  const list = useSettingsList('ipRestrictions', {
    page,
    pageSize: 10,
    ...(search ? { search } : {}),
  })
  const remove = useDeleteSetting('ipRestrictions')
  const setActive = useSetSettingActive('ipRestrictions')

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
        onCreate={() => {
          setDialog({ record: null })
        }}
        emptyText="No IP restrictions match."
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.poppins}
            label={`Actions for ${row.code}`}
            actions={[
              {
                label: 'View / Edit',
                onSelect: () => {
                  setDialog({ record: row })
                },
              },
              {
                label: row.active ? 'Deactivate' : 'Activate',
                onSelect: () => {
                  setActive.mutate({ id: row.id, active: !row.active })
                },
              },
              {
                label: 'Delete',
                variant: 'destructive',
                onSelect: () => {
                  setDeleting(row)
                },
              },
            ]}
          />
        )}
      />
      {dialog && (
        <IpRestrictionDialog
          record={dialog.record}
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
            remove.mutate(deleting.id, {
              onError: () => {
                toast.error('Could not delete the IP restriction.')
              },
            })
          }
        }}
      />
    </>
  )
}
