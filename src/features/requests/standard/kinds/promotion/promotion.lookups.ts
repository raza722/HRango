import { apiClient } from '@/lib/axios'
import type { Paginated } from '@/types/api'

import { lookupsApi, type OrgLookupKind } from '../../../api/lookups.api'
import type { NamedRef } from '../../../types/requests.types'
import type { PromotionLookups } from './promotion.types'

/**
 * The Promotion form's pickers: grades, job levels, designations and job
 * titles (`/organisation/lookups/<kind>`), and the benefit pay items
 * (`/payroll/pay-items`, which the API reads with payroll.settings.pay_components.view).
 */
export async function loadPromotionLookups(signal?: AbortSignal): Promise<PromotionLookups> {
  const org = (kind: OrgLookupKind) =>
    lookupsApi
      .org(kind, undefined, signal)
      .then((rows) => rows.map(({ id, name }): NamedRef => ({ id, name })))
      .catch((): NamedRef[] => [])
  const [grades, levels, designations, jobTitles, benefits] = await Promise.all([
    org('grades'),
    org('job-levels'),
    org('designations'),
    org('job-titles'),
    apiClient
      .get<Paginated<{ id: string; name: string; isBenefit: boolean }>>('/payroll/pay-items', {
        params: { pageSize: 100 },
        signal,
      })
      .then(({ data }) =>
        data.data.filter((item) => item.isBenefit).map(({ id, name }) => ({ id, name })),
      )
      .catch((): NamedRef[] => []),
  ])
  return { grades, levels, designations, jobTitles, benefits }
}
