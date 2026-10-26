import { z } from 'zod'

import { DATE_FORMATS, WEEK_START_DAYS } from '../types/settings.types'

/** Limits follow the API (`CompanyIn`): name 2–200, legal name 200, phone 30, address 500. */
export const generalSettingsFormSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, 'Enter the organization name')
    .max(200, 'Use at most 200 characters'),
  legalName: z.string().trim().max(200, 'Use at most 200 characters'),
  email: z.union([z.literal(''), z.email('Enter a valid email address')]),
  phone: z
    .string()
    .trim()
    .max(30, 'Use at most 30 characters')
    .regex(/^[+\d\s()-]*$/, 'Use digits, spaces, +, ( ) and - only'),
  website: z.union([
    z.literal(''),
    z.url({ protocol: /^https?$/, error: 'Enter a full address, e.g. https://example.com' }),
  ]),
  address: z.string().max(500, 'Use at most 500 characters'),
  /** Optional; an id from `/organisation/geo/countries`. */
  countryId: z.string(),
  timezone: z.string().min(1, 'Select a time zone'),
  currency: z.string().length(3, 'Select a currency'),
  dateFormat: z.enum(DATE_FORMATS),
  weekStartsOn: z.enum(WEEK_START_DAYS),
  /** Kept as text for the select; "1"–"12". */
  fiscalYearStartMonth: z.string().regex(/^(?:[1-9]|1[0-2])$/, 'Select a month'),
})

export type GeneralSettingsFormValues = z.infer<typeof generalSettingsFormSchema>
