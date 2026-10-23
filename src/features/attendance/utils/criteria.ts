import type { AudienceCriteria } from '../types/settings.types'

let counter = 0

/** An empty criteria block (organisation, nothing chosen yet). */
export function newCriteria(): AudienceCriteria {
  counter += 1
  return {
    id: `crit_${Date.now().toString(36)}_${counter}`,
    target: 'organization',
    departments: [],
    locations: [],
    designations: [],
    grades: [],
    religions: [],
    jobTitles: [],
    nationalities: [],
    areas: [],
    branches: [],
    joiningFrom: null,
    joiningTo: null,
    employeeIds: [],
  }
}
