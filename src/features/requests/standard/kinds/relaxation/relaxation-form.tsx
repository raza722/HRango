import type { StandardFormProps } from '../../standard.types'
import type { RelaxationPayload } from './relaxation.types'
import { TimeWindowForm, type TimeWindowFormOptions } from './time-window-form'

const OPTIONS: TimeWindowFormOptions = {
  kind: 'relaxation',
  titles: {
    create: 'Create Relaxation Request',
    edit: 'Relaxation Request Edit',
    view: 'Relaxation Request View',
  },
  needsShift: true,
  reasonLabel: 'Reason',
  reasonRequired: true,
  extras: false,
}

/**
 * "Create Relaxation Request": Employee Name (All only), Date, Start Time,
 * End Time and Reason. The relaxation must fall inside the person's shift
 * that day (checked by the API), so the form shows that shift (Time Slot).
 */
export function RelaxationForm(props: StandardFormProps<RelaxationPayload>) {
  return <TimeWindowForm {...props} options={OPTIONS} />
}
