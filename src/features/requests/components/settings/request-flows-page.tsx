import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { toast } from 'sonner'

import {
  DataTable,
  type DataTableColumn,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import {
  ConfirmAction,
  FiltersButton,
  FiltersDialog,
  ListFooter,
  NoRecord,
  PayrollCard,
  payrollTableClass,
  StatusChip,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'

import {
  useDeleteRequestFlow,
  useRequestFlow,
  useRequestFlows,
} from '../../hooks/use-request-settings'
import {
  DELEGATION_STATUS_META,
  FLOW_NODE_LABELS,
  FLOW_SCOPE_LABELS,
  flowRequestTypeLabel,
  SETTINGS_PAGE_SIZE,
  splitFlowType,
} from '../../settings.constants'
import { StandardPageTabs } from '../../standard/standard-parts'
import type { FlowNodeRow, FlowRequestType, RequestFlow } from '../../types/request-settings.types'
import { AuthoritiesPanel } from './authorities-panel'
import { FlowEditDialog } from './flow-edit-dialog'
import { FLOW_REQUEST_TYPE_OPTIONS } from './settings-helpers'
import { CreateButton } from './settings-parts'

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
const step = (value: number | null) => (value === null ? '' : String(value))

const nodeColumns: DataTableColumn<FlowNodeRow>[] = [
  { id: 'id', header: 'ID', cell: (node) => node.stepNo },
  { id: 'edit', header: 'Can Edit', align: 'center', cell: (node) => yes(node.canEdit) },
  {
    id: 'condition',
    header: 'Is Condition',
    align: 'center',
    cell: (node) => yes(node.isCondition),
  },
  { id: 'name', header: 'Name', cell: (node) => node.employeeName ?? node.roleName ?? '' },
  {
    id: 'node',
    header: 'Node',
    mobile: 'heading',
    cell: (node) =>
      node.isCondition
        ? 'Condition'
        : `${node.approverKind ? FLOW_NODE_LABELS[node.approverKind] : ''}${node.isObserver ? ' (On Looker)' : ''}${node.canDisagree ? ' (Can Disagree)' : ''}`,
  },
  { id: 'next', header: 'Next', align: 'center', cell: (node) => step(node.next) },
  { id: 'expression', header: 'Expression', cell: (node) => node.expression ?? '' },
  { id: 'true', header: 'If True', align: 'center', cell: (node) => step(node.ifTrue) },
  { id: 'false', header: 'If False', align: 'center', cell: (node) => step(node.ifFalse) },
]

const scopeText = (flow: RequestFlow) =>
  flow.scopeType === 'company'
    ? FLOW_SCOPE_LABELS.company
    : `${FLOW_SCOPE_LABELS[flow.scopeType]}: ${flow.scopeName ?? '—'}`

type Dialog = { type: 'create' | 'filters' } | { type: 'edit' | 'delete'; flow: RequestFlow } | null

/**
 * Request Flows (`/requests/settings/flows`): the flows of one request type
 * (or its cancellation) — one for the company and any for a branch,
 * department or employee (the most specific active one applies) — and the
 * nodes of the chosen flow. Saving a flow stores a new version; requests on
 * the way keep theirs. The Authorities tab says who holds HR Manager, Finance
 * Manager … for the flows' authority nodes.
 */
export function RequestFlowsPage() {
  const { type, tab, flow: flowId } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const canView = useCan('requests.settings.flows.view')
  const canAuthorities = useCan('requests.settings.authorities.view')
  const shown = tab === 'authorities' || !canView ? 'authorities' : 'flows'
  const tabs = [
    ...(canView ? [{ value: 'flows' as const, label: 'Request Flows' }] : []),
    ...(canAuthorities ? [{ value: 'authorities' as const, label: 'Authorities' }] : []),
  ]

  return (
    <div className="grid gap-4 sm:gap-5">
      {tabs.length > 1 && (
        <div className="overflow-hidden rounded-xl bg-card shadow-xs">
          <StandardPageTabs
            tabs={tabs}
            value={shown}
            onChange={(next) => {
              void navigate({ search: (prev) => ({ ...prev, tab: next, flow: undefined }) })
            }}
          />
        </div>
      )}
      {shown === 'flows' ? (
        <FlowsTab
          type={type}
          flowId={flowId}
          onType={(next) => {
            void navigate({ search: (prev) => ({ ...prev, type: next, flow: undefined }) })
          }}
          onFlow={(next) => {
            void navigate({ search: (prev) => ({ ...prev, flow: next }) })
          }}
        />
      ) : (
        <AuthoritiesPanel />
      )}
    </div>
  )
}

function FlowsTab({
  type,
  flowId,
  onType,
  onFlow,
}: {
  type: FlowRequestType
  flowId: string | undefined
  onType: (type: FlowRequestType) => void
  onFlow: (id: string | undefined) => void
}) {
  const canCreate = useCan('requests.settings.flows.create')
  const canEdit = useCan('requests.settings.flows.edit')
  const canDelete = useCan('requests.settings.flows.delete')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<Dialog>(null)
  const { requestType, purpose } = splitFlowType(type)
  const list = useRequestFlows({ page, pageSize: SETTINGS_PAGE_SIZE, requestType, purpose })
  const flows = list.data?.data ?? []
  // The chosen flow, else the company's, else the first.
  const selected =
    flows.find((flow) => flow.id === flowId) ??
    flows.find((flow) => flow.scopeType === 'company') ??
    flows[0]
  const detail = useRequestFlow(selected?.id ?? null)
  const remove = useDeleteRequestFlow()
  const close = () => {
    setDialog(null)
  }
  const label = flowRequestTypeLabel(type)

  const columns: DataTableColumn<RequestFlow>[] = [
    { id: 'name', header: 'Name', mobile: 'heading', cell: (flow) => flow.name },
    { id: 'scope', header: 'Applies To', cell: scopeText },
    { id: 'nodes', header: 'Nodes', align: 'center', cell: (flow) => flow.nodeCount },
    {
      id: 'active',
      header: 'Active',
      align: 'center',
      cell: (flow) => (
        <StatusChip {...DELEGATION_STATUS_META[flow.isActive ? 'active' : 'inactive']} />
      ),
    },
  ]

  return (
    <>
      <PayrollCard
        title="Request Flows"
        actions={
          <>
            {canCreate && (
              <CreateButton
                onClick={() => {
                  setDialog({ type: 'create' })
                }}
              />
            )}
            <FiltersButton
              count={type === 'punch' ? 0 : 1}
              onClick={() => {
                setDialog({ type: 'filters' })
              }}
            />
          </>
        }
      >
        <p className="-mt-2 text-sm text-muted-foreground">{label}</p>
        <DataTable
          columns={columns}
          data={flows}
          getRowId={(flow) => flow.id}
          caption={`${label} flows`}
          isLoading={list.isPending}
          isFetching={list.isFetching}
          className={payrollTableClass}
          emptyState={
            <p className="py-8 text-center text-sm text-muted-foreground">
              No flow yet. The first request of this type adds the General Flow (Line Manager, then
              Final Authority); a cancellation without its own flow follows the request flow.
            </p>
          }
          rowActionsHeader="Actions"
          rowActions={(flow) => (
            <RowActionsMenu
              itemClassName={rowMenuItemClass.inter}
              label={`Actions for ${flow.name} (${scopeText(flow)})`}
              actions={[
                {
                  label: 'View Nodes',
                  onSelect: () => {
                    onFlow(flow.id)
                  },
                },
                ...(canEdit
                  ? [
                      {
                        label: 'Edit',
                        onSelect: () => {
                          setDialog({ type: 'edit', flow })
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
                          setDialog({ type: 'delete', flow })
                        },
                      },
                    ]
                  : []),
              ]}
            />
          )}
        />
        <ListFooter
          meta={list.data?.meta}
          noun="flows"
          disabled={list.isFetching}
          onPageChange={setPage}
        />
      </PayrollCard>

      <PayrollCard title={selected ? `Nodes · ${selected.name}` : 'Nodes'}>
        {selected && (
          <p className="-mt-2 text-sm text-muted-foreground">
            {scopeText(selected)}
            {selected.description ? ` · ${selected.description}` : ''}
          </p>
        )}
        <DataTable
          columns={nodeColumns}
          data={detail.data?.nodes ?? []}
          getRowId={(node) => node.id}
          caption={selected ? `Nodes of ${selected.name}` : 'Nodes'}
          isLoading={selected !== undefined && detail.isPending}
          isFetching={detail.isFetching}
          className={payrollTableClass}
          emptyState={<NoRecord />}
        />
      </PayrollCard>

      {dialog?.type === 'create' && (
        <FlowEditDialog requestType={requestType} purpose={purpose} flowId={null} onClose={close} />
      )}
      {dialog?.type === 'edit' && (
        <FlowEditDialog
          requestType={requestType}
          purpose={purpose}
          flowId={dialog.flow.id}
          onSaved={(saved) => {
            // A saved flow is a new version with a new id.
            onFlow(saved)
          }}
          onClose={close}
        />
      )}
      {dialog?.type === 'filters' && (
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
            setPage(1)
            onType((next.type ?? 'punch') as FlowRequestType)
          }}
          onClose={close}
        />
      )}
      <ConfirmAction
        open={dialog?.type === 'delete'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title="Delete flow"
        message="Are you sure you want to Delete this? Requests it covered follow a broader flow, or are refused until one applies."
        onConfirm={() => {
          if (dialog?.type !== 'delete') return
          remove.mutate(dialog.flow, {
            onSuccess: () => {
              onFlow(undefined)
            },
            onError: (error) => {
              toast.error(error instanceof ApiError ? error.message : 'Could not delete the flow.')
            },
          })
        }}
      />
    </>
  )
}
