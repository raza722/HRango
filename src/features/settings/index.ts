// Public API of the settings feature. Import from '@/features/settings', not from deep paths.
export {
  companiesQueryOptions,
  generalSettingsApi,
  generalSettingsKeys,
  generalSettingsQueryOptions,
  lookupKeys,
  placesQueryOptions,
} from './api/lookups.api'
export {
  areaResource,
  branchResource,
  jobTitleResource,
  locationResource,
  type OrgListParams,
  type OrgResource,
  SETTINGS_QUERY_ROOT,
} from './api/org-resource'
export { AreaFormPage, AreaListPage } from './components/areas/area-pages'
export { BranchFormPage, BranchListPage } from './components/branches/branch-pages'
export { ControlPanelLayout } from './components/control-panel/control-panel-layout'
export { GeneralSettingsPage } from './components/general/general-settings-page'
export { JobTitleFormPage, JobTitleListPage } from './components/job-titles/job-title-pages'
export { LocationFormPage, LocationListPage } from './components/locations/location-pages'
export { LocationSearch } from './components/shared/location-search'
export { SettingsPlaceholder } from './components/shared/settings-placeholder'
export {
  CONTROL_PANEL_SECTIONS,
  SETTINGS_PLACEHOLDERS,
  type SettingsPlaceholderKey,
} from './constants'
export {
  useDeleteOrgRecord,
  useOrgList,
  useOrgRecord,
  useSaveOrgRecord,
} from './hooks/use-org-records'
export {
  companyFilteredSearchSchema,
  locationFilteredSearchSchema,
  ORG_LIST_SEARCH_DEFAULTS,
  orgListSearchSchema,
} from './routing'
export {
  generalSettingsFormSchema,
  type GeneralSettingsFormValues,
} from './schemas/general-settings.schema'
export {
  areaFormSchema,
  type AreaFormValues,
  branchFormSchema,
  type BranchFormValues,
  jobTitleFormSchema,
  type JobTitleFormValues,
  locationFormSchema,
  type LocationFormValues,
} from './schemas/org-forms.schema'
export * from './types/settings.types'
