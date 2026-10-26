import { type SyntheticEvent, useId, useState } from 'react'

import { AppDialog } from '@/components/feedback/app-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { usePayslip, usePayslipHistory, useUpdatePayslip } from '../../hooks/use-payroll'
import type { PayslipDetail, PayslipLine } from '../../types/payroll.types'
import { formatAmount, formatMonth, profileOf } from '../../utils/format'
import { btn, dialogFieldType, footerButton } from '../../utils/styles'
import { ChangeLogDialog } from '../shared/change-log'
import { EmployeeCard } from '../shared/employee-card'

interface Draft {
  value: string
  employer: string
}

const draftsOf = (slip: PayslipDetail): Record<string, Draft> =>
  Object.fromEntries(
    slip.lines.map((line) => [
      line.payItemId,
      { value: String(line.amount), employer: String(line.employerContribution ?? 0) },
    ]),
  )

const nameOf = (line: PayslipLine) => line.payItemLabel ?? line.payItemName

/** Amounts may be negative (adjustments); only non-numbers are refused. */
const toAmount = (text: string) => {
  const value = Number(text.replace(/,/g, ''))
  return text.trim() !== '' && Number.isFinite(value) ? value : null
}

function RsInput({
  label,
  value,
  onChange,
  readOnly,
  invalid,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  readOnly: boolean
  invalid?: boolean
}) {
  return (
    <span className="flex h-10 min-w-0 overflow-hidden rounded-md border border-input bg-card focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25">
      <span
        aria-hidden="true"
        className="flex items-center bg-muted px-3 font-inter text-base font-semibold text-heading sm:text-[1.0625rem]"
      >
        Rs
      </span>
      <Input
        aria-label={label}
        aria-invalid={invalid}
        inputMode="decimal"
        readOnly={readOnly}
        value={readOnly ? formatAmount(Number(value) || 0) : value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        className="h-full min-w-0 rounded-none border-0 shadow-none read-only:bg-muted/40 focus-visible:ring-0"
      />
    </span>
  )
}

const nameBox =
  'flex h-10 min-w-0 items-center rounded-md bg-[#D9D9D9]/70 px-3 font-inter text-sm text-field-value dark:bg-muted'

/** "Payitems": Poppins SemiBold 24 #303030; the tables' headings Inter Semi Bold 17 #000000. */
const sectionTitle = 'text-xl font-semibold text-title sm:text-2xl'
const headRow = 'font-inter text-base text-heading sm:text-[1.0625rem]'

/**
 * Pay slip View / Edit (`GET/PUT /payslips/{id}`): the person card, "Payitems" (value,
 * Manually Updated, History) and "Payitems with Employer Contribution". Edit sends the changed
 * lines with the row version; the API marks them Manually Updated so a recalculation keeps them.
 */
export function PayslipDialog({
  payslipId,
  mode,
  onClose,
}: {
  payslipId: string
  mode: 'view' | 'edit'
  onClose: () => void
}) {
  const slip = usePayslip(payslipId)
  return slip.data ? (
    <PayslipForm key={slip.data.id} slip={slip.data} mode={mode} onClose={onClose} />
  ) : (
    <AppDialog
      title="Pay slip"
      hideTitle
      onRequestClose={onClose}
      className="max-w-5xl"
      footer={
        <Button onClick={onClose} className={cn(footerButton, btn.red)}>
          Cancel
        </Button>
      }
    >
      {slip.isError ? (
        <p role="alert" className="py-8 text-center text-sm text-destructive">
          The pay slip could not be loaded.
        </p>
      ) : (
        <div className="grid gap-6">
          <EmployeeCard profile={undefined} />
          <Skeleton className="h-64 w-full" />
        </div>
      )}
    </AppDialog>
  )
}

function PayslipForm({
  slip,
  mode,
  onClose,
}: {
  slip: PayslipDetail
  mode: 'view' | 'edit'
  onClose: () => void
}) {
  const formId = useId()
  const save = useUpdatePayslip()
  const [drafts, setDrafts] = useState(() => draftsOf(slip))
  const [history, setHistory] = useState<PayslipLine | null>(null)
  const changes = usePayslipHistory(history ? slip.id : null)
  const [error, setError] = useState<string | null>(null)
  const readOnly = mode === 'view'
  const lines = slip.lines.filter((line) => readOnly || !line.calculateOnly)
  const plain = lines.filter((line) => line.employerContribution === null)
  const shared = lines.filter((line) => line.employerContribution !== null)

  const patch = (id: string, next: Partial<Draft>) => {
    setDrafts((current) => {
      const before = current[id]
      if (!before) return current
      return { ...current, [id]: { ...before, ...next } }
    })
    setError(null)
  }
  const draftOf = (id: string): Draft => drafts[id] ?? { value: '0', employer: '0' }
  const invalid = (text: string) => toAmount(text) === null

  const submit = (event: SyntheticEvent) => {
    event.preventDefault()
    const bad = lines.find(
      (line) =>
        invalid(draftOf(line.payItemId).value) ||
        (line.employerContribution !== null && invalid(draftOf(line.payItemId).employer)),
    )
    if (bad) {
      setError(`Enter an amount for ${nameOf(bad)}.`)
      return
    }
    // Only changed lines are sent: the API marks them Manually Updated (kept on recalculation).
    const changed = lines
      .map((line) => {
        const draft = draftOf(line.payItemId)
        return {
          before: line,
          payItemId: line.payItemId,
          amount: toAmount(draft.value) ?? 0,
          employerContribution:
            line.employerContribution === null ? null : (toAmount(draft.employer) ?? 0),
        }
      })
      .filter(
        (next) =>
          next.amount !== next.before.amount ||
          (next.employerContribution ?? 0) !== (next.before.employerContribution ?? 0),
      )
    if (changed.length === 0) {
      onClose()
      return
    }
    save.mutate(
      {
        id: slip.id,
        rowVersion: slip.rowVersion,
        lines: changed.map(({ payItemId, amount, employerContribution }) => ({
          payItemId,
          amount,
          employerContribution,
        })),
      },
      {
        onSuccess: onClose,
        onError: (failure) => {
          setError(
            failure instanceof ApiError ? failure.message : 'The pay slip could not be saved.',
          )
        },
      },
    )
  }

  const historyButton = (line: PayslipLine) => (
    <Button
      type="button"
      onClick={() => {
        setHistory(line)
      }}
      aria-label={`History of ${nameOf(line)}`}
      className={cn('h-7 rounded-[4px] px-5 text-xs font-medium', btn.history)}
    >
      History
    </Button>
  )

  return (
    <>
      <AppDialog
        title={`${readOnly ? 'Pay slip' : 'Edit pay slip'} of ${slip.employeeName}, ${formatMonth(slip.payslipMonth)}`}
        hideTitle
        onRequestClose={onClose}
        className={cn('max-w-5xl', dialogFieldType)}
        footer={
          <>
            {error && (
              <p role="alert" className="mr-auto self-center text-sm text-destructive">
                {error}
              </p>
            )}
            {!readOnly && (
              <Button
                type="submit"
                form={formId}
                disabled={save.isPending}
                className={cn(footerButton, btn.green)}
              >
                Save
              </Button>
            )}
            <Button onClick={onClose} className={cn(footerButton, btn.red)}>
              Cancel
            </Button>
          </>
        }
      >
        <form id={formId} noValidate onSubmit={submit} className="grid gap-7">
          <EmployeeCard profile={profileOf(slip)} />

          <section aria-labelledby={`${formId}-items`} className="grid gap-4">
            <h3 id={`${formId}-items`} className={sectionTitle}>
              Payitems
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-separate border-spacing-y-3 text-sm">
                <thead>
                  <tr className={cn('bg-[#17263A]/[0.06] text-left dark:bg-muted', headRow)}>
                    <th scope="col" className="rounded-l-md px-3 py-2.5 font-semibold">
                      Name
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">
                      Value
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-center font-semibold">
                      Manually Updated
                    </th>
                    <th scope="col" className="rounded-r-md px-3 py-2.5 text-center font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {plain.map((line) => {
                    const draft = draftOf(line.payItemId)
                    return (
                      <tr key={line.payItemId}>
                        <td className="w-[38%] pr-6">
                          <span className={nameBox}>{nameOf(line)}</span>
                        </td>
                        <td className="w-[30%]">
                          <RsInput
                            label={`${nameOf(line)} value`}
                            value={draft.value}
                            readOnly={readOnly}
                            invalid={invalid(draft.value)}
                            onChange={(text) => {
                              patch(line.payItemId, { value: text })
                            }}
                          />
                        </td>
                        <td className="text-center">
                          <Checkbox
                            tone="navy"
                            aria-label={`${nameOf(line)} manually updated`}
                            checked={line.isManuallyUpdated}
                            disabled
                          />
                        </td>
                        <td className="text-center">{historyButton(line)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {shared.length > 0 && (
            <section aria-labelledby={`${formId}-shared`} className="grid gap-4">
              <h3 id={`${formId}-shared`} className={sectionTitle}>
                Payitems with Employer Contribution
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] border-separate border-spacing-y-3 text-sm">
                  <thead>
                    <tr className={cn('text-left', headRow)}>
                      <th scope="col" className="px-3 py-1 font-semibold">
                        Name
                      </th>
                      <th scope="col" className="px-3 py-1 font-semibold">
                        Employee Contribution
                      </th>
                      <th scope="col" className="px-3 py-1 font-semibold">
                        Employer Contribution
                      </th>
                      <th scope="col" className="px-3 py-1 font-semibold">
                        Value
                      </th>
                      <th scope="col" className="px-3 py-1 text-center font-semibold">
                        Manually Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shared.map((line) => {
                      const draft = draftOf(line.payItemId)
                      const total = (toAmount(draft.value) ?? 0) + (toAmount(draft.employer) ?? 0)
                      return (
                        <tr key={line.payItemId}>
                          <td className="w-[22%] pr-3">
                            <span className={nameBox}>{nameOf(line)}</span>
                          </td>
                          <td className="pr-3">
                            <RsInput
                              label={`${nameOf(line)} employee contribution`}
                              value={draft.value}
                              readOnly={readOnly}
                              invalid={invalid(draft.value)}
                              onChange={(text) => {
                                patch(line.payItemId, { value: text })
                              }}
                            />
                          </td>
                          <td className="pr-3">
                            <RsInput
                              label={`${nameOf(line)} employer contribution`}
                              value={draft.employer}
                              readOnly={readOnly}
                              invalid={invalid(draft.employer)}
                              onChange={(text) => {
                                patch(line.payItemId, { employer: text })
                              }}
                            />
                          </td>
                          <td className="pr-3">
                            <RsInput
                              label={`${nameOf(line)} total`}
                              value={String(total)}
                              readOnly
                              onChange={() => undefined}
                            />
                          </td>
                          <td className="text-center">
                            <Checkbox
                              tone="navy"
                              aria-label={`${nameOf(line)} (employer) manually updated`}
                              checked={line.isManuallyUpdated}
                              disabled
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </form>
      </AppDialog>
      {history && (
        <ChangeLogDialog
          title={`History: ${nameOf(history)}`}
          entries={(changes.data ?? []).filter(
            (entry) => entry.fieldName === null || entry.fieldName === history.payItemName,
          )}
          onClose={() => {
            setHistory(null)
          }}
        />
      )}
    </>
  )
}
