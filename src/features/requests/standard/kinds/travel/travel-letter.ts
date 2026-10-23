import { format, parse } from 'date-fns'

import type { TravelDetailValue } from './travel.types'

/** What "Regenerate" needs to write the travel application. */
export interface TravelLetterInput {
  employee: string
  purpose: string
  description: string
  extensionNo: string
  alternativePhone: string
  /** Amounts with their ISO currency codes ("PKR"). */
  advances: { amount: number; currency: string }[]
  details: (TravelDetailValue & { travelModeLabel: string })[]
}

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const when = (date: string, time: string) =>
  format(parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date()), 'EEEE, MMMM d, yyyy h:mm a')

const sentence = (text: string) => text.trim().replace(/\.?$/, '.')

/**
 * The travel application the editor's "Regenerate" writes from the form:
 * subject, greeting, each leg with its stay, the advance, how to reach the
 * person, thanks and signature. The same input always gives the same letter.
 */
export function travelLetter(input: TravelLetterInput): string {
  const first = input.details[0]
  const last = input.details.at(-1)
  const legs = input.details.map((detail) => {
    const stay = detail.stayRequired
      ? detail.hotels
          .map(
            (hotel) =>
              ` I will stay at ${hotel.address}, ${hotel.city} for ${String(hotel.nights)} night${hotel.nights === 1 ? '' : 's'}.`,
          )
          .join('')
      : ''
    return `From ${detail.departureFrom} to ${detail.arrivalAt} by ${detail.travelModeLabel.toLowerCase()}, leaving ${when(detail.fromDate, detail.fromTime)} and arriving ${when(detail.toDate, detail.toTime)}.${stay}`
  })
  const advance = input.advances
    .map((item) => `${item.currency} ${item.amount.toLocaleString('en-US')}`)
    .join(' and ')
  const reach = [
    input.extensionNo ? `on extension ${input.extensionNo}` : '',
    input.alternativePhone ? `at ${input.alternativePhone}` : '',
  ].filter(Boolean)
  const paragraphs = [
    first && last
      ? `Subject: Travel Request from ${first.departureFrom} to ${last.arrivalAt}`
      : 'Subject: Travel Request',
    'Dear Sir/Madam,',
    `I am writing to request approval for official travel. ${sentence(input.purpose)}`,
    ...legs,
    ...(input.description.trim() ? [sentence(input.description)] : []),
    ...(advance ? [`I request an advance of ${advance} for the travel expenses.`] : []),
    ...(reach.length > 0 ? [`I can be reached ${reach.join(' or ')} while I am away.`] : []),
    'Thank you for your consideration.',
  ]
  return [
    ...paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`),
    `<p>Sincerely,<br>${escapeHtml(input.employee)}</p>`,
  ].join('')
}
