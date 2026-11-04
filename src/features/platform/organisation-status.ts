import { Ban, Play, X } from 'lucide-react'

import type { RowAction } from '@/components/layout'

import type { Organisation } from './api/platform.api'

export type OrganisationStatus = 'active' | 'suspended' | 'cancelled'

export interface StatusChange {
  row: Organisation
  status: OrganisationStatus
}

export function statusActions(
  row: Organisation,
  set: (next: StatusChange) => void,
): readonly RowAction[] {
  if (row.status !== 'active') {
    return [
      {
        label: 'Reactivate',
        icon: Play,
        onSelect: () => {
          set({ row, status: 'active' })
        },
      },
    ]
  }
  return [
    {
      label: 'Suspend',
      icon: Ban,
      onSelect: () => {
        set({ row, status: 'suspended' })
      },
    },
    {
      label: 'Cancel organisation',
      icon: X,
      variant: 'destructive',
      onSelect: () => {
        set({ row, status: 'cancelled' })
      },
    },
  ]
}
