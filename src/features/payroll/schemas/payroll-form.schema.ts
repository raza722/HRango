import { z } from 'zod'

import type { Payroll, PayrollInput } from '../types/payroll.types'

const payItemRow = z.object({
  payItemId: z.string().min(1, 'Choose the pay item'),
  taxable: z.boolean(),
  arrearApplicable: z.boolean(),
  finalSettlement: z.boolean(),
  calculateOnly: z.boolean(),
})

/** "Payrolls Monthly" (create / edit). Selects hold strings; the mapper makes numbers. */
export const payrollFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter the payroll name').max(80, 'Keep it under 80 characters'),
    currency: z.literal('PKR'),
    taxStructureId: z.string().min(1, 'Choose the tax structure'),
    taxApplicable: z.boolean(),
    processing: z.enum(['from-date', 'month-end']),
    processingDay: z.string().min(1, 'Choose the payroll processing date'),
    applicableDays: z.enum(['actual', 'fixed']),
    fixedDays: z.string(),
    companyBankId: z.string(),
    description: z.string().trim().max(500, 'Keep it under 500 characters'),
    payItems: z.array(payItemRow),
  })
  .refine(
    (value) =>
      value.applicableDays === 'actual' ||
      (/^\d+$/.test(value.fixedDays) &&
        Number(value.fixedDays) >= 1 &&
        Number(value.fixedDays) <= 31),
    { message: 'Enter the number of fixed days (1 to 31)', path: ['fixedDays'] },
  )
  .refine(
    (value) => new Set(value.payItems.map((row) => row.payItemId)).size === value.payItems.length,
    {
      message: 'Each pay item can be added once',
      path: ['payItems'],
    },
  )

export type PayrollFormValues = z.infer<typeof payrollFormSchema>

export const emptyPayrollForm = (): PayrollFormValues => ({
  name: '',
  currency: 'PKR',
  taxStructureId: '',
  taxApplicable: true,
  processing: 'month-end',
  processingDay: '',
  applicableDays: 'actual',
  fixedDays: '',
  companyBankId: '',
  description: '',
  payItems: [],
})

export function toPayrollForm(payroll: Payroll): PayrollFormValues {
  return {
    name: payroll.name,
    currency: payroll.currency,
    taxStructureId: payroll.taxStructureId ?? '',
    taxApplicable: payroll.taxApplicable,
    processing: payroll.processing,
    processingDay: payroll.processingDay === null ? '' : String(payroll.processingDay),
    applicableDays: payroll.applicableDays,
    fixedDays: payroll.fixedDays === null ? '' : String(payroll.fixedDays),
    companyBankId: payroll.companyBankId ?? '',
    description: payroll.description,
    payItems: payroll.payItems.map((row) => ({ ...row })),
  }
}

export function toPayrollInput(values: PayrollFormValues): PayrollInput {
  return {
    name: values.name.trim(),
    currency: values.currency,
    taxStructureId: values.taxStructureId || null,
    taxApplicable: values.taxApplicable,
    processing: values.processing,
    processingDay: values.processingDay ? Number(values.processingDay) : null,
    applicableDays: values.applicableDays,
    fixedDays: values.applicableDays === 'fixed' ? Number(values.fixedDays) : null,
    companyBankId: values.companyBankId || null,
    description: values.description.trim(),
    payItems: values.payItems,
  }
}
