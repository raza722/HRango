import type {
  AreaFormValues,
  BranchFormValues,
  JobTitleFormValues,
  LocationFormValues,
} from '../schemas/org-forms.schema'
import { fromCoordinate, toCoordinate, toOptionalId } from '../schemas/shared'
import type {
  JobTitle,
  JobTitleInput,
  OrgArea,
  OrgAreaInput,
  OrgBranch,
  OrgBranchInput,
  OrgLocation,
  OrgLocationInput,
} from '../types/settings.types'

/** Maps between a record, the strings its form holds, and the API input. */
export interface FormMapper<TRecord, TValues, TInput> {
  empty: () => TValues
  toValues: (record: TRecord) => TValues
  toInput: (values: TValues) => TInput
}

export const branchMapper: FormMapper<OrgBranch, BranchFormValues, OrgBranchInput> = {
  empty: () => ({
    name: '',
    employeePrefix: '',
    companyId: '',
    locationId: '',
    areaId: '',
    managerId: '',
    description: '',
    countryCode: '',
    regionCode: '',
    cityId: '',
    latitude: '',
    longitude: '',
  }),
  toValues: (branch) => ({
    name: branch.name,
    employeePrefix: branch.employeePrefix,
    companyId: branch.companyId,
    locationId: branch.locationId,
    areaId: branch.areaId ?? '',
    managerId: branch.managerId ?? '',
    description: branch.description,
    countryCode: branch.countryCode ?? '',
    regionCode: branch.regionCode ?? '',
    cityId: branch.cityId ?? '',
    latitude: fromCoordinate(branch.latitude),
    longitude: fromCoordinate(branch.longitude),
  }),
  toInput: (values) => ({
    name: values.name.trim(),
    employeePrefix: values.employeePrefix.trim().toUpperCase(),
    companyId: values.companyId,
    locationId: values.locationId,
    areaId: toOptionalId(values.areaId),
    managerId: toOptionalId(values.managerId),
    description: values.description.trim(),
    countryCode: toOptionalId(values.countryCode),
    regionCode: toOptionalId(values.regionCode),
    cityId: toOptionalId(values.cityId),
    latitude: toCoordinate(values.latitude),
    longitude: toCoordinate(values.longitude),
  }),
}

export const locationMapper: FormMapper<OrgLocation, LocationFormValues, OrgLocationInput> = {
  empty: () => ({
    name: '',
    employeePrefix: '',
    companyId: '',
    description: '',
    latitude: '',
    longitude: '',
  }),
  toValues: (location) => ({
    name: location.name,
    employeePrefix: location.employeePrefix,
    companyId: location.companyId,
    description: location.description,
    latitude: fromCoordinate(location.latitude),
    longitude: fromCoordinate(location.longitude),
  }),
  toInput: (values) => ({
    name: values.name.trim(),
    employeePrefix: values.employeePrefix.trim().toUpperCase(),
    companyId: values.companyId,
    description: values.description.trim(),
    latitude: toCoordinate(values.latitude),
    longitude: toCoordinate(values.longitude),
  }),
}

export const areaMapper: FormMapper<OrgArea, AreaFormValues, OrgAreaInput> = {
  empty: () => ({ name: '', locationId: '', description: '' }),
  toValues: (area) => ({
    name: area.name,
    locationId: area.locationId,
    description: area.description,
  }),
  toInput: (values) => ({
    name: values.name.trim(),
    locationId: values.locationId,
    description: values.description.trim(),
  }),
}

export const jobTitleMapper: FormMapper<JobTitle, JobTitleFormValues, JobTitleInput> = {
  empty: () => ({ name: '', limitHeadCount: false, maxHeadCount: '', description: '' }),
  toValues: (jobTitle) => ({
    name: jobTitle.name,
    limitHeadCount: jobTitle.limitHeadCount,
    maxHeadCount: jobTitle.maxHeadCount === null ? '' : String(jobTitle.maxHeadCount),
    description: jobTitle.description,
  }),
  toInput: (values) => ({
    name: values.name.trim(),
    limitHeadCount: values.limitHeadCount,
    // A cap is only stored while "Limit Head Count" is on.
    maxHeadCount: values.limitHeadCount ? Number(values.maxHeadCount) : null,
    description: values.description.trim(),
  }),
}
