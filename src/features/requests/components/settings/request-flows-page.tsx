import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { Check } from 'lucide-react'

import { DataTable, type DataTableColumn } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  btn,
  FiltersButton,
  FiltersDialog,
  NoRecord,
  PayrollCard,
  payrollTableClass,
  toolbarButton,
} from '@/features/payroll'
import { cn } from '@/lib/utils'

import { useRequestFlow } from '../../hooks/use-request-settings'
import { FLOW_NODE_LABELS, flowRequestTypeLabel } from '../../settings.constants'
import type { FlowNodeRow, FlowRequestType } from '../../types/request-settings.types'
import { FlowAssignmentCard } from './flow-assignment-card'
import { FlowEditDialog } from './flow-edit-dialog'
import { FLOW_REQUEST_TYPE_OPTIONS } from './settings-helpers'

const routeApi = getRouteApi('/_app/requests/settings/flows')

const yes = (on: boolean) =>
  on ? (
    <>
      <Check aria-hidden="true" className="mx-auto size-4 text-[#17263A] dark:text-heading" />
      <span className="sr-only">Yes</span>
    </>
  ) : (
    <span className="sr-only">No</span>
  )
const row = (value: number | null) => (value === null ? '' : String(value))

const columns: DataTableColumn<FlowNodeRow>[] = [
  { id: 'id', header: 'ID', cell: (node) => node.id },
  { id: 'edit', header: 'Can Edit', align: 'center', cell: (node) => yes(node.canEdit) },
  {
    id: 'condition',
    header: 'Is Condition',
    align: 'center',
    cell: (node) => yes(node.isCondition),
  },
  { id: 'name', header: 'Name', cell: (node) => node.employee?.name ?? '' },
  {
    id: 'node',
    header: 'Node',
    mobile: 'heading',
    cell: (node) =>
      `${FLOW_NODE_LABELS[node.node]}${node.onLooker ? ' (On Looker)' : ''}${node.canDisagree ? ' (Can Disagree)' : ''}`,
  },
  { id: 'next', header: 'Next', align: 'center', cell: (node) => row(node.next) },
  { id: 'expression', header: 'Expression', cell: (node) => node.expression },
  { id: 'true', header: 'If True', align: 'center', cell: (node) => row(node.ifTrue) },
  { id: 'false', header: 'If False', align: 'center', cell: (node) => row(node.ifFalse) },
]

/**
 * Request Flows: the steps of one request type's approval flow (Edit opens
 * the node builder; Filters picks the type), then the Request Flow card that
 * sets a chain of authorities for chosen people.
 */
export function RequestFlowsPage() {
  const { type } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [dialog, setDialog] = useState<'edit' | 'filters' | null>(null)
  const flow = useRequestFlow(type)
  const setType = (next: FlowRequestType) => {
    void navigate({ search: (prev) => ({ ...prev, type: next }) })
  }
  const close = () => {
    setDialog(null)
  }

  return (
    <div className="grid gap-4 sm:gap-5">
      <PayrollCard
        title="Request Flows"
        actions={
          <>
            <Button
              disabled={!flow.data}
              onClick={() => {
                setDialog('edit')
              }}
              className={cn(toolbarButton, btn.navy, 'min-w-20')}
            >
              Edit
            </Button>
            <FiltersButton
              count={type === 'punch' ? 0 : 1}
              onClick={() => {
                setDialog('filters')
              }}
            />
          </>
        }
      >
        <p className="-mt-2 text-sm text-muted-foreground">
          {flowRequestTypeLabel(type)}
          {flow.data && ` · ${flow.data.name}`}
        </p>
        <DataTable
          columns={columns}
          data={flow.data?.rows ?? []}
          getRowId={(node) => String(node.id)}
          caption={`${flowRequestTypeLabel(type)} flow`}
          isLoading={flow.isPending}
          isFetching={flow.isFetching}
          className={payrollTableClass}
          emptyState={<NoRecord />}
        />
      </PayrollCard>

      <FlowAssignmentCard type={type} onTypeChange={setType} />

      {dialog === 'edit' && flow.data && (
        <FlowEditDialog requestType={type} nodes={flow.data.nodes} onClose={close} />
      )}
      {dialog === 'filters' && (
        <FiltersDialog
          fields={[
            {
              kind: 'select',
              key: 'type',
              label: 'Request Type',
              placeholder: 'Select Request Type',
              options: FLOW_REQUEST_TYPE_OPTIONS,
            },
          ]}
          value={{ type }}
          preset="request-flows"
          onApply={(next) => {
            setType((next.type ?? 'punch') as FlowRequestType)
          }}
          onClose={close}
        />
      )}
    </div>
  )
}
