import type { ReactNode } from 'react'

import type { ActivityEntry } from '../../types/pm.types'
import { actionLabel, fieldLabel, valueText } from './activity-labels'

const Value = ({ children }: { children: ReactNode }) => (
  <span className="font-medium text-[#303030] dark:text-title">{children}</span>
)

/**
 * A history line's sentence after the person's name ("changed Status of [task] from A to B"),
 * for the Activity view and the task panel's History (with "this task" as the item).
 */
export function ActivitySentence({ entry, item }: { entry: ActivityEntry; item: ReactNode }) {
  const field = entry.fieldName
  const from = field && entry.oldValue !== null ? valueText(field, entry.oldValue) : null
  const to = field && entry.newValue !== null ? valueText(field, entry.newValue) : null
  switch (entry.action) {
    case 'created':
      return <>created {item}</>
    case 'deleted':
      return <>deleted {item}</>
    case 'commented':
      return <>commented on {item}</>
    case 'extension_requested':
      return (
        <>
          asked for more time on {item}
          {to && (
            <>
              {' '}
              (due date <Value>{to}</Value>
              {from && (
                <>
                  , was <Value>{from}</Value>
                </>
              )}
              )
            </>
          )}
        </>
      )
    case 'extension_approved':
      return (
        <>
          approved the extension of {item}
          {to && (
            <>
              {' '}
              to <Value>{to}</Value>
            </>
          )}
        </>
      )
    case 'extension_rejected':
      return <>rejected the extension of {item}</>
  }
  const verb = entry.action === 'updated' ? null : actionLabel(entry.action).toLowerCase()
  if (!field)
    return verb ? (
      <>
        {verb} {item}
      </>
    ) : (
      <>changed {item}</>
    )
  const label = <Value>{fieldLabel(field)}</Value>
  if (from === null && to === null) {
    return (
      <>
        {verb ?? 'changed'} {label} of {item}
      </>
    )
  }
  if (from === null) {
    return (
      <>
        {verb ?? 'set'} {label} of {item} to <Value>{to}</Value>
      </>
    )
  }
  if (to === null) {
    return (
      <>
        {verb ?? 'cleared'} {label} of {item} (was <Value>{from}</Value>)
      </>
    )
  }
  return (
    <>
      {verb ?? 'changed'} {label} of {item} from <Value>{from}</Value> to <Value>{to}</Value>
    </>
  )
}
