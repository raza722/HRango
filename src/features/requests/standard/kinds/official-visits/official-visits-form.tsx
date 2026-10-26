import type { StandardFormProps } from '../../standard.types'
import { TimeWindowForm, type TimeWindowFormOptions } from '../relaxation/time-window-form'
import type { OfficialVisitPayload } from './official-visits.types'

const OPTIONS: TimeWindowFormOptions = {
  kind: 'official-visits',
  titles: {
    create: 'Create Official Visit Request',
    edit: 'Official Visit Request Edit',
    view: 'Official Visit Request View',
  },
  needsShift: false,
  reasonLabel: 'Purpose of Visit',
  reasonRequired: true,
  extras: true,
}

/**
 * "Create Official Visit Request" (not drawn; built in the style of
 * Relaxation): Employee Name (All only), Date, the day's Time Slot, Start
 * Time, End Time, Purpose of Visit, Description and an Attachment. A visit
 * needs no shift that day.
 */
export function OfficialVisitForm(props: StandardFormProps<OfficialVisitPayload>) {
  return <TimeWindowForm {...props} options={OPTIONS} />
}
