// Talent Management → Employees, as the API (`/api/employees…`) speaks it: the employee record
// (`EmployeeOut` / `EmployeeIn`) and its child tables (dependents, skills, education, experience,
// contracts, documents, emergency contacts, bank accounts). Ids are strings; dates `yyyy-MM-dd`;
// times ISO. There is no mapping layer: the screens use these shapes as they come.

import type { FileRef } from '@/lib/files'

export const EMPLOYEE_STATUSES = ['active', 'probation', 'notice', 'left', 'inactive'] as const
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number]

export const GENDERS = ['male', 'female', 'other'] as const
export type Gender = (typeof GENDERS)[number]

export const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed'] as const
export type MaritalStatus = (typeof MARITAL_STATUSES)[number]

export const SALARY_FREQUENCIES = ['monthly', 'daily', 'hourly'] as const
export type SalaryFrequency = (typeof SALARY_FREQUENCIES)[number]

/** `GET /employees`, `GET /employees/{id}` and every write answer: the whole record. */
export interface Employee {
  id: string
  code: string
  firstName: string
  lastName: string
  name: string
  /** Father's or husband's name. */
  parentName: string | null
  gender: string | null
  maritalStatus: string | null
  religion: string | null
  nationality: string | null
  dateOfBirth: string | null
  /** Null (masked) when `canSeeIdentity` is false. */
  cnic: string | null
  canSeeIdentity: boolean
  email: string | null
  phone1: string | null
  phone2: string | null
  homeAddress: string | null
  homeCityId: string | null
  homeCityName: string | null
  photoFileId: string | null
  photoUrl: string | null
  branchId: string
  branchName: string
  locationId: string | null
  locationName: string | null
  areaId: string | null
  areaName: string | null
  departmentId: string | null
  departmentName: string | null
  divisionId: string | null
  divisionName: string | null
  costCenterId: string | null
  costCenterName: string | null
  designationId: string | null
  designationName: string | null
  jobTitleId: string | null
  jobTitleName: string | null
  gradeId: string | null
  gradeName: string | null
  jobLevelId: string | null
  jobLevelName: string | null
  employeeGroupId: string | null
  employeeGroupName: string | null
  employmentTypeId: string | null
  employmentTypeName: string | null
  lineManagerId: string | null
  lineManagerName: string | null
  finalAuthorityId: string | null
  finalAuthorityName: string | null
  status: string
  salaryFrequency: string | null
  joiningDate: string | null
  confirmationDate: string | null
  probationEndDate: string | null
  endDate: string | null
  tenureMonths: number | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  directReportCount: number
  userAccountId: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** `POST /employees`, `PUT /employees/{id}` (`EmployeeIn`). Ids go as the strings the API gave. */
export interface EmployeeInput {
  /** Blank: the next number. */
  code?: string | null
  firstName: string
  lastName: string
  parentName?: string | null
  gender?: Gender | null
  maritalStatus?: MaritalStatus | null
  religion?: string | null
  nationality?: string | null
  dateOfBirth?: string | null
  /** Left out when the user cannot see identity (the record's CNIC is masked). */
  cnic?: string | null
  email?: string | null
  phone1?: string | null
  phone2?: string | null
  homeAddress?: string | null
  homeCityId?: string | null
  branchId: string
  locationId?: string | null
  areaId?: string | null
  departmentId?: string | null
  divisionId?: string | null
  costCenterId?: string | null
  designationId?: string | null
  jobTitleId?: string | null
  gradeId?: string | null
  jobLevelId?: string | null
  employeeGroupId?: string | null
  employmentTypeId?: string | null
  lineManagerId?: string | null
  finalAuthorityId?: string | null
  status?: EmployeeStatus
  salaryFrequency?: SalaryFrequency
  joiningDate?: string | null
  probationEndDate?: string | null
  confirmationDate?: string | null
  rowVersion?: string | null
}

/** The list's filters (`GET /employees?…`), as the URL keeps them. */
export interface EmployeeListParams {
  q?: string | undefined
  status?: EmployeeStatus | undefined
  includeInactive?: boolean | undefined
  branchId?: string | undefined
  departmentId?: string | undefined
  designationId?: string | undefined
  page: number
  pageSize: number
}

/** The four tiles of Employee Record. */
export interface EmployeeStats {
  total: number
  male: number
  female: number
  probation: number
  /** False when the company has more people than were read (the counts are partial). */
  complete: boolean
}

/** `GET /organisation/lookups/{kind}`: a picker row. */
export interface OrgLookupItem {
  id: string
  name: string
  code?: string | null
  parentId?: string | null
}

/** The organisation pickers the employee form uses. */
export const ORG_LOOKUP_KINDS = [
  'branches',
  'locations',
  'areas',
  'departments',
  'divisions',
  'cost-centers',
  'designations',
  'job-titles',
  'grades',
  'job-levels',
  'employee-groups',
  'employment-types',
] as const
export type OrgLookupKind = (typeof ORG_LOOKUP_KINDS)[number]

// --- child tables ---------------------------------------------------------------------------

interface Stamped {
  id: string
  employeeId: string
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export const DEPENDENT_RELATIONS = [
  'spouse',
  'son',
  'daughter',
  'father',
  'mother',
  'brother',
  'sister',
  'other',
] as const
export type DependentRelation = (typeof DEPENDENT_RELATIONS)[number]

export interface Dependent extends Stamped {
  firstName: string
  lastName: string | null
  name: string
  relation: string
  occupation: string | null
  dateOfBirth: string | null
}

export interface DependentInput {
  firstName: string
  lastName?: string | null
  relation: DependentRelation
  occupation?: string | null
  dateOfBirth?: string | null
  rowVersion?: string | null
}

export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const
export type SkillLevel = (typeof SKILL_LEVELS)[number]

export interface Skill extends Stamped {
  skillTitle: string
  skillLevel: string
}

export interface SkillInput {
  skillTitle: string
  skillLevel: SkillLevel
  rowVersion?: string | null
}

export interface Education extends Stamped {
  title: string
  institute: string
  fromDate: string | null
  toDate: string | null
  isInProcess: boolean
  file: FileRef | null
}

export interface EducationInput {
  title: string
  institute: string
  fromDate?: string | null
  toDate?: string | null
  isInProcess?: boolean
  fileId?: string | null
  rowVersion?: string | null
}

export interface Experience extends Stamped {
  companyName: string
  jobTitle: string
  fromDate: string
  toDate: string | null
  /** No end date. */
  isCurrent: boolean
  months: number | null
}

export interface ExperienceInput {
  companyName: string
  jobTitle: string
  fromDate: string
  toDate?: string | null
  rowVersion?: string | null
}

export const CONTRACT_TYPES = [
  'permanent',
  'temporary',
  'contractual',
  'probation',
  'internship',
  'consultant',
] as const
export type ContractType = (typeof CONTRACT_TYPES)[number]

export const CONTRACT_STATUSES = ['upcoming', 'active', 'expired'] as const
export type ContractStatus = (typeof CONTRACT_STATUSES)[number]

export interface Contract extends Stamped {
  contractType: string
  durationMonths: number | null
  fromDate: string
  toDate: string | null
  /** Worked out by the server from the dates. */
  status: ContractStatus
  file: FileRef | null
  remarks: string | null
}

export interface ContractInput {
  contractType: ContractType
  durationMonths?: number | null
  fromDate: string
  toDate?: string | null
  fileId?: string | null
  remarks?: string | null
  rowVersion?: string | null
}

export const DOCUMENT_TYPES = [
  'cnic',
  'passport',
  'driving_licence',
  'offer_letter',
  'promotion_letter',
  'appraisal_letter',
  'salary_certificate',
  'experience_letter',
  'degree',
  'certificate',
  'medical',
  'other',
] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const DOCUMENT_CATEGORIES = ['identity', 'pay', 'general'] as const
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]

export interface EmployeeDocument extends Stamped {
  documentType: string
  category: DocumentCategory
  title: string | null
  documentNumber: string | null
  issueDate: string | null
  expiryDate: string | null
  isExpired: boolean
  file: FileRef
  fileMimeType: string | null
  fileSizeBytes: number | null
  remarks: string | null
}

export interface DocumentInput {
  documentType: DocumentType
  title?: string | null
  documentNumber?: string | null
  issueDate?: string | null
  expiryDate?: string | null
  fileId: string
  remarks?: string | null
  rowVersion?: string | null
}

export const EMERGENCY_RELATIONS = [
  'spouse',
  'father',
  'mother',
  'brother',
  'sister',
  'son',
  'daughter',
  'friend',
  'relative',
  'other',
] as const
export type EmergencyRelation = (typeof EMERGENCY_RELATIONS)[number]

export interface EmergencyContact extends Stamped {
  name: string
  relation: string
  phone: string
  altPhone: string | null
  address: string | null
  isPrimary: boolean
}

export interface EmergencyContactInput {
  name: string
  relation: EmergencyRelation
  phone: string
  altPhone?: string | null
  address?: string | null
  isPrimary?: boolean
  rowVersion?: string | null
}

export interface BankAccount extends Stamped {
  accountHolder: string | null
  accountNumber: string
  bankName: string
  branchName: string | null
  branchCode: string | null
  taxPayerId: string | null
  isPrimary: boolean
}

export interface BankAccountInput {
  accountHolder?: string | null
  accountNumber: string
  bankName: string
  branchName?: string | null
  branchCode?: string | null
  taxPayerId?: string | null
  isPrimary?: boolean
  rowVersion?: string | null
}

/** The child tables under `/employees/{id}/…`, with their row and input shapes. */
export interface EmployeeChildTables {
  dependents: { row: Dependent; input: DependentInput }
  skills: { row: Skill; input: SkillInput }
  education: { row: Education; input: EducationInput }
  experience: { row: Experience; input: ExperienceInput }
  contracts: { row: Contract; input: ContractInput }
  documents: { row: EmployeeDocument; input: DocumentInput }
  'emergency-contacts': { row: EmergencyContact; input: EmergencyContactInput }
  'bank-accounts': { row: BankAccount; input: BankAccountInput }
}
export type EmployeeChildKind = keyof EmployeeChildTables
export type ChildRow<K extends EmployeeChildKind> = EmployeeChildTables[K]['row']
export type ChildInput<K extends EmployeeChildKind> = EmployeeChildTables[K]['input']

/** The profile's tabs, in their order (`?tab=`). */
export const PROFILE_TABS = [
  'personal',
  'work',
  'documents',
  'dependents',
  'benefits',
  'leave',
  'skills',
] as const
export type ProfileTab = (typeof PROFILE_TABS)[number]
