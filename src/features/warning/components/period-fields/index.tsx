import type { TimeSpan } from '../../types/warning-policy.types'
import { MonthlyPeriodFields } from './monthly-period-fields'
import type { PeriodFieldsProps } from './shared'
import { WeeklyPeriodFields } from './weekly-period-fields'
import { YearlyPeriodFields } from './yearly-period-fields'

/** Renders the sub-form that matches the selected time span. */
export function PeriodFields({ timeSpan, ...props }: PeriodFieldsProps & { timeSpan: TimeSpan }) {
  switch (timeSpan) {
    case 'weekly':
      return <WeeklyPeriodFields {...props} />
    case 'monthly':
      return <MonthlyPeriodFields {...props} />
    case 'yearly':
      return <YearlyPeriodFields {...props} />
  }
}
