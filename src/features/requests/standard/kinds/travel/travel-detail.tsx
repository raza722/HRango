import { useMemo, useState } from 'react'

import { ApplicationEditor } from '../../../components/transfer/application-editor'
import type { StandardRequest } from '../../standard.types'
import { StandardReadOnlyRow } from '../../standard-dialogs'
import { useStandardLookups } from '../../use-standard'
import { currencyLabel } from './travel.constants'
import type { TravelLookups, TravelPayload } from './travel.types'
import { legsOf } from './travel-codec'
import { TravelDetailDialog } from './travel-detail-dialog'
import { TravelDetailsTable, TravelSection } from './travel-parts'

/**
 * The request's fields in the Approve/Reject and approvals' View popups: what
 * the Travel Request View draws (Purpose, Extension No, Alternative Phone No,
 * Description, Advance Required, Details with Expected Departure and Expected
 * Arrivals; each leg opens "Travel Detail View" with its hotel and ticket
 * bookings), the Advances and the Application.
 */
export function TravelDetail({ request }: { request: StandardRequest<TravelPayload> }) {
  const { payload } = request
  const lookups = useStandardLookups<TravelLookups>('travel')
  const legs = useMemo(() => legsOf(payload), [payload])
  const [open, setOpen] = useState<number | null>(null)
  const leg = open === null ? undefined : legs[open]
  return (
    <>
      <StandardReadOnlyRow label="Purpose" value={payload.purpose} multiline />
      <StandardReadOnlyRow label="Extension No" value={payload.extensionNo ?? '—'} />
      <StandardReadOnlyRow label="Alternative Phone No" value={payload.altPhone ?? '—'} />
      <StandardReadOnlyRow label="Description" value={request.description ?? '—'} multiline />
      <StandardReadOnlyRow
        label="Advance Required"
        value={payload.advanceRequired ? 'Yes' : 'No'}
      />
      {payload.advances.length > 0 && (
        <TravelSection title="Advances">
          <div className="grid gap-2">
            {payload.advances.map((item, index) => (
              <StandardReadOnlyRow
                key={item.id}
                label={`Advance ${String(index + 1)}`}
                value={`${item.amount.toLocaleString('en-US')} · ${currencyLabel(item.currency)}`}
              />
            ))}
          </div>
        </TravelSection>
      )}
      <TravelSection title="Details" required>
        <TravelDetailsTable details={legs} onView={setOpen} />
      </TravelSection>
      {request.application && <ApplicationEditor value={request.application} readOnly />}
      {leg && (
        <TravelDetailDialog
          mode="view"
          value={leg}
          lookups={lookups.data?.extra}
          onClose={() => {
            setOpen(null)
          }}
        />
      )}
    </>
  )
}
