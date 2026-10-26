import { useCan } from '@/lib/permissions'

/**
 * What the signed-in user may do with a Control Panel record type
 * (`<permission>.create|edit|delete`, e.g. `organisation.branches.edit`).
 * Everything is allowed in mock mode (no permissions list).
 */
export function useOrgPermissions(resource: { permission: string }) {
  return {
    canCreate: useCan(`${resource.permission}.create`),
    canEdit: useCan(`${resource.permission}.edit`),
    canDelete: useCan(`${resource.permission}.delete`),
  }
}
