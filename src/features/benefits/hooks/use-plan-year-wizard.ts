import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { ApiError } from '@/lib/api-error'

import {
  PLAN_YEAR_STEP_FIELDS,
  planYearFormSchema,
  type PlanYearFormValues,
} from '../schemas/benefits.schema'
import type { PlanYearInput, PlanYearRow } from '../types/benefits.types'

export type PlanYearStep = 'details' | 'plans' | 'new-hires'

export const PLAN_YEAR_STEPS: readonly { value: PlanYearStep; label: string }[] = [
  { value: 'details', label: 'Details' },
  { value: 'plans', label: 'Plans' },
  { value: 'new-hires', label: 'New Hires' },
]

const ORDER = PLAN_YEAR_STEPS.map((step) => step.value)

export const EMPTY_PLAN_YEAR: PlanYearFormValues = {
  name: '',
  startDate: '',
  endDate: '',
  planIds: [],
  newHireStart: 'immediately',
  electionPeriod: '1',
  electionUnit: 'month',
}

export function planYearValues(year: PlanYearRow): PlanYearFormValues {
  return {
    name: year.name,
    startDate: year.startDate,
    endDate: year.endDate,
    planIds: year.planIds,
    newHireStart: year.newHireStart,
    electionPeriod: String(year.electionPeriod),
    electionUnit: year.electionUnit,
  }
}

export function toPlanYearInput(values: PlanYearFormValues): PlanYearInput {
  return { ...values, name: values.name.trim(), electionPeriod: Number(values.electionPeriod) }
}

/** The step a server error belongs to, so the wizard can go back to it. */
function stepOf(field: string): PlanYearStep {
  const found = ORDER.find((step) =>
    (PLAN_YEAR_STEP_FIELDS[step] as readonly string[]).includes(field),
  )
  return found ?? 'details'
}

/**
 * The three plan year steps (Details → Plans → New Hires) over one form: Continue checks the
 * step's fields before the next opens, finished steps can be opened again, and the last step
 * saves. A field error from the server opens its step.
 */
export function usePlanYearWizard({
  initial,
  startStep = 'details',
  save,
}: {
  initial: PlanYearFormValues
  startStep?: PlanYearStep
  save: (input: PlanYearInput) => Promise<unknown>
}) {
  const form = useForm<PlanYearFormValues>({
    resolver: zodResolver(planYearFormSchema),
    defaultValues: initial,
  })
  const [step, setStep] = useState<PlanYearStep>(startStep)
  // Opening an existing plan year at a later step treats the steps before it as done.
  const [done, setDone] = useState<PlanYearStep[]>(ORDER.slice(0, ORDER.indexOf(startStep)))

  const submit = form.handleSubmit(async (values) => {
    try {
      await save(toPlanYearInput(values))
    } catch (error) {
      const fields = error instanceof ApiError ? Object.entries(error.fieldErrors) : []
      const first = fields[0]
      if (first && first[0] in initial) {
        for (const [name, message] of fields) {
          if (name in initial) form.setError(name as keyof PlanYearFormValues, { message })
        }
        setStep(stepOf(first[0]))
      } else {
        form.setError('root', {
          message: error instanceof ApiError ? error.message : 'Could not save the plan year.',
        })
      }
    }
  })

  const advance = async () => {
    const valid = await form.trigger([...PLAN_YEAR_STEP_FIELDS[step]], { shouldFocus: true })
    if (!valid) return
    const index = ORDER.indexOf(step)
    const next = ORDER[index + 1]
    setDone((list) => (list.includes(step) ? list : [...list, step]))
    if (next) setStep(next)
    else await submit()
  }

  const open = (target: PlanYearStep) => {
    form.clearErrors('root')
    setStep(target)
  }

  return { form, step, done, advance, open, isLast: step === 'new-hires' }
}
