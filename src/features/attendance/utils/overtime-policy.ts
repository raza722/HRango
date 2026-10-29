import type { OvertimePolicy, OvertimePolicyPeriod, OvertimeSlab } from '../types/overtime.types'

/** The active policy of a period in force: the newest active one. */
export function policyOfPeriod(
  policies: readonly OvertimePolicy[],
  period: OvertimePolicyPeriod,
): OvertimePolicy | undefined {
  return [...policies]
    .filter((policy) => policy.period === period && policy.isActive)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

/** The slab whose range holds the minutes. */
export function slabFor(slabs: readonly OvertimeSlab[], minutes: number): OvertimeSlab | undefined {
  return slabs.find((slab) => minutes >= slab.minMinutes && minutes <= slab.maxMinutes)
}

/** The most minutes a policy's slabs reach; `null` without slabs. */
export function policyCap(policy: Pick<OvertimePolicy, 'slabs'> | undefined): number | null {
  if (!policy || policy.slabs.length === 0) return null
  return Math.max(...policy.slabs.map((slab) => slab.maxMinutes))
}

/**
 * What approving `minutes` under a policy comes to: the minutes cut to the policy's top slab,
 * and the slab they fall in (what they encash as). Without a policy nothing is capped.
 */
export function applyPolicy(
  policy: OvertimePolicy | undefined,
  minutes: number,
): { minutes: number; slab: OvertimeSlab | null; capped: boolean } {
  const cap = policyCap(policy)
  if (!policy || cap === null) return { minutes, slab: null, capped: false }
  const granted = Math.min(minutes, cap)
  return {
    minutes: granted,
    capped: granted < minutes,
    slab: slabFor(policy.slabs, granted) ?? null,
  }
}

/** The pairs of slabs whose ranges overlap (both ends count), for the policy form. */
export function overlappingSlabs(
  slabs: readonly Pick<OvertimeSlab, 'minMinutes' | 'maxMinutes'>[],
): [number, number][] {
  const pairs: [number, number][] = []
  slabs.forEach((slab, index) => {
    slabs.forEach((other, otherIndex) => {
      if (otherIndex <= index) return
      if (slab.minMinutes <= other.maxMinutes && other.minMinutes <= slab.maxMinutes) {
        pairs.push([index, otherIndex])
      }
    })
  })
  return pairs
}
