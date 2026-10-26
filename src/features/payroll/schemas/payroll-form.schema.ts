import { z } from 'zod'

import type { PayrollInput, PayrollRow } from '../types/payroll.types'
import { monthOf, monthStart } from '../utils/format'

const payItemRow = z.object({
  payItemId: z.string().min(1, 'Choose the pay item'),
  isTaxable: z.boolean(),
  arrearApplicable: z.boolean(),
  finalSettlement: z.boolean(),
  calculateOnly: z.boolean(),
})

/**
 * "Payrolls Monthly" (create / edit), as `POST/PUT /payroll/payrolls` takes it. The month is
 * `yyyy-MM` in the picker and `yyyy-MM-01` on the wire; selects hold strings.
 */
export const payrollFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter the payroll name')
      .max(200, 'Keep it under 200 characters'),
    payrollMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Choose the payroll month'),
    currency: z.string().regex(/^[A-Z]{3}$/, 'Choose the currency'),
    taxStructureId: z.string().min(1, 'Choose the tax structure'),
    taxApplicable: z.boolean(),
    processingMode: z.enum(['from_date', 'month_end']),
    processingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the payroll processing date'),
    applicableDays: z.enum(['actual', 'fixed']),
    fixedDays: z.string(),
    disbursementBankId: z.string().min(1, 'Choose the disbursement bank'),
    description: z.string().trim().max(200, 'Keep it under 200 characters'),
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
  payrollMonth: '',
  currency: 'PKR',
  taxStructureId: '',
  taxApplicable: true,
  processingMode: 'month_end',
  processingDate: '',
  applicableDays: 'actual',
  fixedDays: '',
  disbursementBankId: '',
  description: '',
  payItems: [],
})

export function toPayrollForm(payroll: PayrollRow): PayrollFormValues {
  return {
    name: payroll.name,
    payrollMonth: monthOf(payroll.payrollMonth),
    currency: payroll.currency ?? 'PKR',
    taxStructureId: payroll.taxStructureId ?? '',
    taxApplicable: payroll.taxApplicable,
    processingMode: payroll.processingMode ?? 'month_end',
    processingDate: payroll.processingDate ?? '',
    applicableDays: payroll.applicableDays ?? 'actual',
    fixedDays: payroll.fixedDays === null ? '' : String(payroll.fixedDays),
    disbursementBankId: payroll.disbursementBankId ?? '',
    description: payroll.description ?? '',
    payItems: payroll.payItems.map((row) => ({
      payItemId: row.payItemId,
      isTaxable: row.isTaxable,
      arrearApplicable: row.arrearApplicable,
      finalSettlement: row.finalSettlement,
      calculateOnly: row.calculateOnly,
    })),
  }
}

/**
 * The request body. On create an empty pay item list is left out, so the API puts every pay
 * item of the company on the payroll.
 */
export function toPayrollInput(
  values: PayrollFormValues,
  payroll: PayrollRow | null,
): PayrollInput {
  return {
    name: values.name.trim(),
    payrollMonth: monthStart(values.payrollMonth),
    currency: values.currency,
    taxStructureId: values.taxStructureId,
    taxApplicable: values.taxApplicable,
    processingMode: values.processingMode,
    processingDate: values.processingDate,
    applicableDays: values.applicableDays,
    fixedDays: values.applicableDays === 'fixed' ? Number(values.fixedDays) : null,
    disbursementBankId: values.disbursementBankId,
    description: values.description.trim() || null,
    payItems: payroll === null && values.payItems.length === 0 ? null : values.payItems,
    ...(payroll ? { rowVersion: payroll.rowVersion } : {}),
  }
}
