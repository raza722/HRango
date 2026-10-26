import {
  RESIGNATION_TYPES,
  type ResignationLookups,
  type ResignationType,
} from './resignation.types'

/** "Type" as the form words the API's values. */
export const RESIGNATION_TYPE_LABELS: Record<ResignationType, string> = {
  resignation: 'Resignation',
  voluntary: 'Voluntary',
  retirement: 'Retirement',
  contract_end: 'Contract End',
}

/** The Resignation form's own look-ups: the API's fixed list of types. */
export function loadResignationLookups(): Promise<ResignationLookups> {
  return Promise.resolve({
    types: RESIGNATION_TYPES.map((value) => ({ value, label: RESIGNATION_TYPE_LABELS[value] })),
  })
}
