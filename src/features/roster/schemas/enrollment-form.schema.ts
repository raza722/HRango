import { z } from 'zod'

/** "Enroll New Employee": who, from when, until when, and (optionally) at which branch. */
export const enrollmentFormSchema = z
  .object({
    employeeIds: z.array(z.string()).min(1, 'Select at least one employee'),
    startDate: z.string().min(1, 'Pick the start date'),
    endDate: z.string(),
    branchId: z.string(),
  })
  .superRefine((values, ctx) => {
    // Both are `yyyy-MM-dd`, so they compare as text.
    if (values.endDate && values.startDate && values.endDate < values.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Pick a date on or after the start date',
      })
    }
  })

export type EnrollmentFormValues = z.infer<typeof enrollmentFormSchema>
