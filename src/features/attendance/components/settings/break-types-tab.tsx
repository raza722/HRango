import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'

import { AppDialog } from '@/components/feedback/app-dialog'
import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { FieldLayoutContext, TextField } from '@/components/form'
import { type DataTableColumn, RowActionsMenu, rowMenuItemClass } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import {
  useDeleteSetting,
  useSaveSetting,
  useSettingsList,
} from '../../hooks/use-attendance-settings'
import type { BreakTypeRecord } from '../../types/settings.types'
import {
  navyButtonClass,
  poppinsDialogTitleClass,
  poppinsFieldsClass,
  settingsDialogButtonClass,
} from '../../utils/settings-styles'
import { SettingsListCard } from './settings-list'

const PAGE_SIZE = 10

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(80, 'Keep it under 80 characters'),
  startIdentifier: z.string().trim().min(1, 'Enter the start identifier').max(80),
  endIdentifier: z.string().trim().min(1, 'Enter the end identifier').max(80),
})
type Values = z.infer<typeof schema>

/** "Create New Break Type" and "Break Type" (view / edit): Name, Start and End Identifier. */
function BreakTypeDialog({
  record,
  onClose,
}: {
  record: BreakTypeRecord | null
  onClose: () => void
}) {
  const save = useSaveSetting('breakTypes')
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: record
      ? {
          name: record.name,
          startIdentifier: record.startIdentifier,
          endIdentifier: record.endIdentifier,
        }
      : { name: '', startIdentifier: '', endIdentifier: '' },
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: record?.id, input: values })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fieldErrors.name) form.setError('name', { message: error.fieldErrors.name })
        else form.setError('root', { message: error.message })
      }
      return
    }
    onClose()
  })
  return (
    <AppDialog
      title={record ? 'Break Type' : 'Create New Break Type'}
      onRequestClose={onClose}
      className={cn('max-w-md', poppinsFieldsClass)}
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
            className={cn(settingsDialogButtonClass, 'flex-1')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="break-type-form"
            size="lg"
            disabled={save.isPending}
            className={cn(settingsDialogButtonClass, navyButtonClass, 'flex-1')}
          >
            {record ? 'Save Changes' : 'Create'}
          </Button>
        </>
      }
    >
      <FieldLayoutContext value="vertical">
        <form
          id="break-type-form"
          noValidate
          onSubmit={(event) => void submit(event)}
          className="grid gap-4"
        >
          <TextField
            control={form.control}
            name="name"
            label="Name"
            placeholder="Enter name"
            required
          />
          <TextField
            control={form.control}
            name="startIdentifier"
            label={record ? 'Start Identifier' : 'Start Indicator'}
            placeholder="Enter start identifier name"
            required
          />
          <TextField
            control={form.control}
            name="endIdentifier"
            label={record ? 'End Identifier' : 'End Indicator'}
            placeholder="Enter end identifier name"
            required
          />
        </form>
      </FieldLayoutContext>
    </AppDialog>
  )
}

const columns: DataTableColumn<BreakTypeRecord>[] = [
  { id: 'name', header: 'Name', cell: (row) => row.name, mobile: 'heading' },
  { id: 'start', header: 'Start Identifier', cell: (row) => row.startIdentifier },
  { id: 'end', header: 'End Identifier', cell: (row) => row.endIdentifier },
]

/** Settings → Break Types: the identifiers a device sends at the start and end of a break. */
export function BreakTypesTab() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<{ record: BreakTypeRecord | null } | null>(null)
  const [deleting, setDeleting] = useState<BreakTypeRecord | null>(null)
  const list = useSettingsList('breakTypes', {
    page,
    pageSize: PAGE_SIZE,
    ...(search ? { search } : {}),
  })
  const remove = useDeleteSetting('breakTypes')

  return (
    <>
      <SettingsListCard
        title="Break Types"
        columns={columns}
        rows={list.data?.data ?? []}
        meta={list.data?.meta}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        searchLabel="Search break types"
        onSearch={(text) => {
          setSearch(text)
          setPage(1)
        }}
        onPageChange={setPage}
        onCreate={() => {
          setDialog({ record: null })
        }}
        emptyText="No break types match."
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.poppins}
            label={`Actions for ${row.name}`}
            actions={[
              {
                label: 'View / Edit',
                onSelect: () => {
                  setDialog({ record: row })
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
        <BreakTypeDialog
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
        title={`Delete ${deleting?.name ?? 'break type'}`}
        description="Are you sure you want to Delete this?"
        confirmLabel="Yes"
        cancelLabel="No"
        variant="destructive"
        onConfirm={() => {
          if (!deleting) return
          remove.mutate(deleting.id, {
            onError: (error) => {
              toast.error(error instanceof ApiError ? error.message : 'Could not delete.')
            },
          })
        }}
      />
    </>
  )
}
