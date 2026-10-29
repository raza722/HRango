import { format, parseISO } from 'date-fns'
import { z } from 'zod'

/** Dates as the Rehire dialog writes them ("September 8, 2026"). */
export const REHIRE_DATE = 'MMMM d, yyyy'

/** Rehire: the new joining date comes after the last working date (the server refuses it). */
export const makeRehireSchema = (lastWorkingDate: string) =>
  z.object({
    joiningDate: z
      .string()
      .min(1, 'Choose the joining date')
      .refine(
        (value) => value > lastWorkingDate,
        `Choose a date after the last working date (${format(parseISO(lastWorkingDate), REHIRE_DATE)})`,
      ),
  })
export type RehireValues = z.infer<ReturnType<typeof makeRehireSchema>>
