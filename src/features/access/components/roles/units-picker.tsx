import { useQuery } from '@tanstack/react-query'

import { MultiSearchSelect } from '@/features/payroll'
import { orgLookupQueryOptions } from '@/features/settings'

import { UNIT_TYPE_LABELS } from '../../constants'
import { UNIT_TYPES, type UnitType } from '../../types/access.types'
import type { DraftUnit } from '../../utils/permission-tree'

const KIND: Record<UnitType, 'branches' | 'departments' | 'locations'> = {
  branch: 'branches',
  department: 'departments',
  location: 'locations',
}

const keyOf = (unit: DraftUnit) => `${unit.unitType}:${unit.unitId}`

function fromKey(key: string): DraftUnit | null {
  const at = key.indexOf(':')
  const unitType = UNIT_TYPES.find((type) => type === key.slice(0, at))
  const unitId = key.slice(at + 1)
  return unitType && unitId ? { unitType, unitId } : null
}

/**
 * The branches, departments and locations a Selected units tick reaches: one list of all
 * three (`/organisation/lookups/{branches,departments,locations}`), each marked with its kind.
 * `known` names units the lookups do not list (from the role as saved).
 */
export function UnitsPicker({
  value,
  onChange,
  label,
  invalid,
  describedBy,
  known,
  disabled = false,
}: {
  value: readonly DraftUnit[]
  onChange: (units: DraftUnit[]) => void
  label: string
  invalid: boolean
  describedBy?: string | undefined
  known: ReadonlyMap<string, string>
  disabled?: boolean
}) {
  const branches = useQuery(orgLookupQueryOptions(KIND.branch))
  const departments = useQuery(orgLookupQueryOptions(KIND.department))
  const locations = useQuery(orgLookupQueryOptions(KIND.location))
  const lists: [UnitType, typeof branches][] = [
    ['branch', branches],
    ['department', departments],
    ['location', locations],
  ]
  const options = lists.flatMap(([unitType, result]) =>
    (result.data ?? []).map((row) => ({
      value: `${unitType}:${row.id}`,
      label: row.name,
      hint: UNIT_TYPE_LABELS[unitType],
    })),
  )
  const chosen = value.map(keyOf)
  const missing = chosen
    .filter((key) => !options.some((option) => option.value === key))
    .map((key) => {
      const unit = fromKey(key)
      return {
        value: key,
        label: known.get(key) ?? unit?.unitId ?? key,
        hint: unit ? UNIT_TYPE_LABELS[unit.unitType] : '',
      }
    })

  return (
    <MultiSearchSelect
      aria-label={label}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      value={chosen}
      onChange={(keys) => {
        onChange(keys.map(fromKey).filter((unit): unit is DraftUnit => unit !== null))
      }}
      options={[...missing, ...options]}
      placeholder="Choose branches, departments or locations"
      loading={branches.isPending || departments.isPending || locations.isPending}
      disabled={disabled}
      className="h-9 min-h-9 text-xs"
    />
  )
}
