import { z } from 'zod'

import { DATE_FORMATS, WEEK_START_DAYS } from '../types/settings.types'

export const generalSettingsFormSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, 'Enter the organization name')
    .max(120, 'Use at most 120 characters'),
  legalName: z.string().trim().max(160, 'Use at most 160 characters'),
  email: z.union([z.literal(''), z.email('Enter a valid email address')]),
  phone: z
    .string()
    .trim()
    .max(40, 'Use at most 40 characters')
    .regex(/^[+\d\s()-]*$/, 'Use digits, spaces, +, ( ) and - only'),
  website: z.union([
    z.literal(''),
    z.url({ protocol: /^https?$/, error: 'Enter a full address, e.g. https://example.com' }),
  ]),
  address: z.string().max(300, 'Use at most 300 characters'),
  timezone: z.string().min(1, 'Select a time zone'),
  currency: z.string().length(3, 'Select a currency'),
  dateFormat: z.enum(DATE_FORMATS),
  weekStartsOn: z.enum(WEEK_START_DAYS),
  /** Kept as text for the select; "1"–"12". */
  fiscalYearStartMonth: z.string().regex(/^(?:[1-9]|1[0-2])$/, 'Select a month'),
})

export type GeneralSettingsFormValues = z.infer<typeof generalSettingsFormSchema>
