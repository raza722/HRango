import type { FilterField } from '@/features/payroll'

import { typePermission } from '../../../api/backend'
import { employeeFilterField } from '../../../components/shared/request-employee'
import { REQUEST_STATUSES } from '../../../types/requests.types'
import type { StandardFilterContext } from '../../standard.types'
import { STANDARD_STATUS_META } from '../../standard-styles'

/**
 * The Filters popup of the time-window types, with what the API filters on:
 * employee, department, status and a date range; Delegates adds the delegator.
 * (The design's Next Requestee filter is left out: the API has no such filter.)
 */
export function timeWindowFilterFields({
  kind,
  tab,
  scope,
  view,
  lookups,
}: StandardFilterContext): readonly FilterField[] {
  const fields: FilterField[] = [
    ...(tab === 'request' && scope === 'my'
      ? []
      : [
          employeeFilterField(typePermission(kind, 'create')),
          {
            kind: 'select' as const,
            key: 'departmentId',
            label: 'Department',
            placeholder: 'Select Department',
            options: (lookups?.departments ?? []).map((item) => ({
              value: item.id,
              label: item.name,
            })),
          },
        ]),
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      placeholder: 'Select Status',
      options: REQUEST_STATUSES.map((value) => ({
        value,
        label: STANDARD_STATUS_META[value].label,
      })),
    },
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'To' },
  ]
  if (tab === 'approvals' && view === 'delegates') {
    fields.unshift({
      kind: 'select',
      key: 'delegatorId',
      label: 'Delegator',
      placeholder: 'Select Delegator',
      options: (lookups?.delegators ?? []).map((person) => ({
        value: person.id,
        label: person.name,
      })),
    })
  }
  return fields
}
