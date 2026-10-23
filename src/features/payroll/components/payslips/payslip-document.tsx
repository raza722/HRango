import type { ReactNode } from 'react'

import { AppDialog } from '@/components/feedback/app-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { COMPANY_NAME } from '../../constants'
import type { PayslipDetail } from '../../types/payroll.types'
import { formatRs } from '../../utils/format'
import { btn, footerButton } from '../../utils/styles'
import { PAYSLIP_NOTE, payslipHtml, payslipLines, printHtml } from './payslip-html'

const headCell = 'bg-[#17263A] px-3 py-1 text-left text-xs font-semibold text-white'

function Rows({
  rows,
  totalLabel,
  total,
}: {
  rows: [string, string][]
  totalLabel: string
  total: string
}) {
  return (
    <tbody>
      {rows.map(([label, value]) => (
        <tr key={label} className="even:bg-muted/60">
          <td className="px-3 py-1 text-field-foreground">{label}</td>
          <td className="px-3 py-1 text-field-foreground">{value}</td>
        </tr>
      ))}
      <tr className="border-t font-semibold text-heading">
        <td className="px-3 py-1">{totalLabel}</td>
        <td className="px-3 py-1">{total}</td>
      </tr>
    </tbody>
  )
}

function Block({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <table className="w-full border border-[#B9BDC4] text-xs">
      <thead>
        <tr>{title}</tr>
      </thead>
      {children}
    </table>
  )
}

/** The printable pay slip (Pay Slips → Payslip, Final Settlement → Payslip). */
export function PayslipSheet({ slip }: { slip: PayslipDetail }) {
  const lines = payslipLines(slip)
  return (
    <article
      aria-label={`Payslip of ${slip.employee.name}`}
      className="grid gap-3 border border-[#B9BDC4] p-3 sm:p-4"
    >
      <header className="text-center">
        <p className="text-sm font-bold text-heading">{COMPANY_NAME}</p>
        <p className="text-xs text-heading">Payslip</p>
      </header>
      <Block
        title={
          <th colSpan={2} className={cn(headCell, 'text-center')}>
            Employee Info
          </th>
        }
      >
        <tbody>
          {lines.info.map(([label, value]) => (
            <tr key={label} className="even:bg-muted/60">
              <td className="w-1/2 px-3 py-1 text-field-foreground">{label}</td>
              <td className="px-3 py-1 text-field-foreground">{value}</td>
            </tr>
          ))}
        </tbody>
      </Block>
      <div className="grid items-start gap-3 @2xl:grid-cols-2">
        <Block
          title={
            <>
              <th className={headCell}>Earnings</th>
              <th className={headCell}>Amount</th>
            </>
          }
        >
          <tbody>
            <tr>
              <td colSpan={2} className="px-2 py-1.5">
                <Block
                  title={
                    <>
                      <th className={headCell}>Gross Salary Division</th>
                      <th className={headCell}>Amount</th>
                    </>
                  }
                >
                  <Rows
                    rows={lines.gross.map((item) => [item.name, formatRs(item.value)])}
                    totalLabel="Gross Salary"
                    total={formatRs(lines.grossTotal)}
                  />
                </Block>
              </td>
            </tr>
          </tbody>
          <Rows
            rows={lines.otherEarnings.map((item) => [item.name, formatRs(item.value)])}
            totalLabel="Earnings"
            total={formatRs(lines.earningsTotal)}
          />
        </Block>
        <Block
          title={
            <>
              <th className={headCell}>Deductions</th>
              <th className={headCell}>Amount</th>
            </>
          }
        >
          <Rows
            rows={lines.deductions.map((item) => [item.name, formatRs(item.value)])}
            totalLabel="Deductions"
            total={formatRs(lines.deductionsTotal)}
          />
        </Block>
      </div>
      <Block
        title={
          <th colSpan={2} className={headCell}>
            Net Transfer
          </th>
        }
      >
        <tbody>
          <tr className="font-semibold text-heading">
            <td className="w-1/2 px-3 py-1">Net Payable</td>
            <td className="px-3 py-1">{formatRs(lines.netPayable)}</td>
          </tr>
          <tr className="bg-muted/60 font-semibold text-heading">
            <td className="px-3 py-1">In Words</td>
            <td className="px-3 py-1">{lines.inWords}</td>
          </tr>
        </tbody>
      </Block>
      <p className="text-[0.6875rem] font-bold text-heading italic">{PAYSLIP_NOTE}</p>
    </article>
  )
}

/** "Payslip": the slip in a dialog, with Print and Cancel. */
export function PayslipDocumentDialog({
  slip,
  isError = false,
  onClose,
}: {
  slip: PayslipDetail | undefined
  isError?: boolean
  onClose: () => void
}) {
  return (
    <AppDialog
      title="Payslip"
      hideTitle
      onRequestClose={onClose}
      className="max-w-5xl"
      footer={
        <>
          <Button
            disabled={!slip}
            onClick={() => {
              if (slip) printHtml(payslipHtml(slip))
            }}
            className={cn(footerButton, btn.navy)}
          >
            Print
          </Button>
          <Button onClick={onClose} className={cn(footerButton, btn.red)}>
            Cancel
          </Button>
        </>
      }
    >
      {slip ? (
        <PayslipSheet slip={slip} />
      ) : isError ? (
        <p role="alert" className="py-8 text-center text-sm text-destructive">
          The pay slip could not be loaded.
        </p>
      ) : (
        <Skeleton className="h-96 w-full" />
      )}
    </AppDialog>
  )
}
