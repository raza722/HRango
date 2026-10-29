import type { Cycle } from '../types/performance.types'

export type CycleAction = 'launch' | 'close' | 'delete'

/** The confirm text of Launch, Close and Delete. */
export function cycleConfirmCopy(cycle: Cycle, action: CycleAction) {
  if (action === 'launch') {
    return {
      title: 'Launch review cycle',
      label: 'Launch',
      text: `Launch ${cycle.name} for its ${String(cycle.participants)} participant${cycle.participants === 1 ? '' : 's'}? Their reviews open and the form can no longer change.`,
    }
  }
  if (action === 'close') {
    const open = cycle.participants - cycle.finalised
    return {
      title: 'Close review cycle',
      label: 'Close Cycle',
      text:
        open > 0
          ? `${String(open)} of ${String(cycle.participants)} appraisals are not finalised; closing locks them as they are, with their goals. Close ${cycle.name}?`
          : `Close ${cycle.name}? Its appraisals and goals are locked.`,
    }
  }
  return {
    title: 'Delete review cycle',
    label: 'Delete',
    text: `Delete ${cycle.name} and its ${String(cycle.participants)} draft appraisal${cycle.participants === 1 ? '' : 's'}? Its goals stay, without a cycle.`,
  }
}
