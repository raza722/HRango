import type { PermissionLevel } from '../../types/pm.types'

/** The text under each permission level (Set Role Permission 228:145854, levels dropdown). */
export const PERMISSION_DESCRIPTIONS: Record<PermissionLevel, string> = {
  default:
    'Inheriting permission from your workspace settings. This is the default when no permission is selected for this current field.',
  'can-edit':
    'People or teams with this permission level can edit the current field and set its value on task.',
  'can-view': 'Users have read-only permissions to view this field on task.',
  private:
    'Only people with explicit edit, set, or view permission can see a private field. Private fields are hidden from everyone else.',
}

/** The paragraph under the dialog's title (132:126211; also the designer's note 145:127435). */
export const ROLE_PERMISSION_NOTE =
  'Role Based Permissions are defined based on user role (e.g., Workspace Admin Creator, HR, Managers, Team Leaders, Contributors.) This option tailors access based on the hierarchy, or responsibility level, enabling specific roles to edit, view or restrict access to certain fields with task.'
