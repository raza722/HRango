import { useMemo } from 'react'

import { useRosterGroups } from '@/features/roster'

import { NEUTRAL_TONE, SHIFT_TONES, type ShiftTone } from '../constants'

/**
 * Time rosters (Roster → roster groups) and a colour for each, so every shift
 * of one roster looks the same on the board.
 */
export function useRosterTones() {
  const query = useRosterGroups({ page: 1, pageSize: 100 })
  const groups = useMemo(() => query.data?.data ?? [], [query.data])

  return useMemo(() => {
    const tones = new Map<string, ShiftTone>()
    groups.forEach((group, index) => {
      tones.set(group.id, SHIFT_TONES[index % SHIFT_TONES.length] ?? NEUTRAL_TONE)
    })
    return {
      groups,
      isLoading: query.isPending,
      toneFor: (rosterGroupId: string | null): ShiftTone =>
        (rosterGroupId ? tones.get(rosterGroupId) : undefined) ?? NEUTRAL_TONE,
      titleOf: (rosterGroupId: string | null) =>
        groups.find((group) => group.id === rosterGroupId)?.title ?? null,
    }
  }, [groups, query.isPending])
}
