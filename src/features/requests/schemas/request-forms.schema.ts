import { z } from 'zod'

import { PUNCH_REQUEST_TYPES } from '../types/requests.types'

const description = z.string().trim().max(4000, 'Keep it under 4000 characters')

/** Punch Request Create: Employee (All only), Date, Punch Type, Punch Time, Description. */
export const punchRequestSchema = z.object({
  employeeId: z.string(),
  date: z.string().min(1, 'Choose the date'),
  punchType: z
    .union([z.enum(PUNCH_REQUEST_TYPES), z.literal('')])
    .refine((value) => value.length > 0, {
      message: 'Choose the punch type',
    }),
  punchTime: z.string().min(1, 'Enter the punch time'),
  description,
})
export type PunchRequestValues = z.infer<typeof punchRequestSchema>

/**
 * Shift Request: Employee Name, Date, Time Slot, Swap To, Description. Either
 * a new time slot or a colleague to swap with, not both (the API's rule).
 */
export const shiftRequestSchema = z
  .object({
    employeeId: z.string(),
    date: z.string().min(1, 'Choose the date'),
    timeSlotId: z.string(),
    swapWithId: z.string(),
    description,
  })
  .refine((values) => values.timeSlotId !== '' || values.swapWithId !== '', {
    message: 'Choose a time slot or someone to swap with',
    path: ['timeSlotId'],
  })
export type ShiftRequestValues = z.infer<typeof shiftRequestSchema>
