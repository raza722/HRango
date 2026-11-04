import { describe, expect, it } from 'vitest'

import { canOpenPlatform, canRegister, platformNavFor } from './platform-nav'

const labels = (role: Parameters<typeof platformNavFor>[0]) =>
  platformNavFor(role).map((item) => item.label)

describe('staff menu', () => {
  it('gives each role its own modules', () => {
    expect(labels('super_admin')).toHaveLength(9)
    expect(labels('billing')).toEqual([
      'Dashboard',
      'Organisations',
      'Subscriptions',
      'Plans',
      'Invoices',
    ])
    expect(labels('sales')).toEqual(['Dashboard', 'Organisations', 'Plans', 'Sales'])
    expect(labels('support')).toEqual(['Dashboard', 'Organisations', 'Plans', 'Support'])
    expect(labels(undefined)).toEqual([])
  })

  it('guards a page by the same list, sub-pages included', () => {
    expect(canOpenPlatform('support', '/platform/support')).toBe(true)
    expect(canOpenPlatform('support', '/platform/invoices')).toBe(false)
    expect(canOpenPlatform('billing', '/platform/sales')).toBe(false)
    expect(canOpenPlatform('sales', '/platform/organisations/7')).toBe(true)
    expect(canOpenPlatform('sales', '/platform/staff')).toBe(false)
    expect(canOpenPlatform('admin', '/platform/activity')).toBe(true)
  })

  it('lets sales and admins register organisations', () => {
    expect(canRegister('sales')).toBe(true)
    expect(canRegister('admin')).toBe(true)
    expect(canRegister('billing')).toBe(false)
    expect(canRegister('support')).toBe(false)
  })
})
