import { addMonths, format, subDays } from 'date-fns'
import { z } from 'zod'

import { parseDateValue } from '@/lib/date'
import type { FileRef } from '@/lib/files'

import { CONTRACT_DURATIONS, DEPENDENT_SIDES, type DependentSide } from '../constants'
import {
  type BankAccountInput,
  CONTRACT_TYPES,
  type ContractInput,
  DEPENDENT_RELATIONS,
  type DependentInput,
  DOCUMENT_TYPES,
  type DocumentInput,
  type EducationInput,
  EMERGENCY_RELATIONS,
  type EmergencyContactInput,
  type Employee,
  EMPLOYEE_STATUSES,
  type EmployeeInput,
  type ExperienceInput,
  GENDERS,
  MARITAL_STATUSES,
  SALARY_FREQUENCIES,
  SKILL_LEVELS,
  type SkillInput,
} from '../types/employees.types'
import { splitFullName, textOrNull } from '../utils/format'

// The forms of Talent Management. Inputs are strings as the controls give them ('' = empty);
// the mappers turn them into the API's `*In` bodies. Limits follow the API (names 200, job
// title 100, phone 30, account number 50).

const text = (max: number, message = `Use at most ${String(max)} characters`) =>
  z.string().trim().max(max, message)
const required = (message: string, max = 200) => text(max).min(1, message)
const optionalDay = z.string()
const nullableId = z.string().nullable()
const fileRef = z
  .object({ id: z.string(), name: z.string().nullable(), url: z.string() })
  .nullable()

/** One of the values, or '' for "not chosen". */
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.literal(''), z.enum(values)])

const email = z
  .string()
  .trim()
  .max(200, 'Use at most 200 characters')
  .refine(
    (value) => value === '' || z.email().safeParse(value).success,
    'Enter a valid email address',
  )

/** Digits with optional dashes ("35202-1234567-1"). */
const cnic = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^[0-9-]{5,20}$/.test(value),
    'Enter the CNIC as digits, e.g. 35202-1234567-1',
  )

const phone = z
  .string()
  .trim()
  .max(30, 'Use at most 30 characters')
  .refine(
    (value) => value === '' || /^[0-9+()\-\s]{5,30}$/.test(value),
    'Enter a valid phone number',
  )

const today = () => format(new Date(), 'yyyy-MM-dd')

/** A date on or after another (both `yyyy-MM-dd`; empty passes). */
const notBefore = (later: string, earlier: string) => !later || !earlier || later >= earlier

// --- Add / Edit employee -------------------------------------------------------------------

export const employeeFormSchema = z
  .object({
    code: text(30),
    firstName: required('Enter the first name'),
    lastName: required('Enter the last name'),
    parentName: text(200),
    gender: optionalEnum(GENDERS),
    maritalStatus: optionalEnum(MARITAL_STATUSES),
    religion: text(100),
    nationality: text(100),
    dateOfBirth: optionalDay,
    cnic,
    email,
    phone1: phone,
    phone2: phone,
    homeAddress: text(500),
    branchId: z
      .string()
      .nullable()
      .refine((value) => Boolean(value), 'Choose the branch'),
    locationId: nullableId,
    areaId: nullableId,
    departmentId: nullableId,
    divisionId: nullableId,
    costCenterId: nullableId,
    designationId: nullableId,
    jobTitleId: nullableId,
    gradeId: nullableId,
    jobLevelId: nullableId,
    employeeGroupId: nullableId,
    employmentTypeId: nullableId,
    lineManagerId: nullableId,
    finalAuthorityId: nullableId,
    status: z.enum(EMPLOYEE_STATUSES),
    salaryFrequency: z.enum(SALARY_FREQUENCIES),
    joiningDate: optionalDay,
    probationEndDate: optionalDay,
    confirmationDate: optionalDay,
  })
  .superRefine((values, ctx) => {
    if (values.dateOfBirth && values.dateOfBirth >= today()) {
      ctx.addIssue({
        code: 'custom',
        path: ['dateOfBirth'],
        message: 'The date of birth must be in the past',
      })
    }
    if (!notBefore(values.probationEndDate, values.joiningDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['probationEndDate'],
        message: 'Probation cannot end before the joining date',
      })
    }
    if (!notBefore(values.confirmationDate, values.joiningDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmationDate'],
        message: 'Confirmation cannot be before the joining date',
      })
    }
    if (values.status === 'probation' && !values.probationEndDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['probationEndDate'],
        message: 'Choose when probation ends',
      })
    }
  })
export type EmployeeFormValues = z.infer<typeof employeeFormSchema>

const orEmpty = (value: string | null | undefined) => value ?? ''
const known = <T extends string>(values: readonly T[], value: string | null): T | '' =>
  values.find((item) => item === value) ?? ''

export function employeeToForm(employee: Employee | null): EmployeeFormValues {
  return {
    code: orEmpty(employee?.code),
    firstName: orEmpty(employee?.firstName),
    lastName: orEmpty(employee?.lastName),
    parentName: orEmpty(employee?.parentName),
    gender: known(GENDERS, employee?.gender ?? null),
    maritalStatus: known(MARITAL_STATUSES, employee?.maritalStatus ?? null),
    religion: orEmpty(employee?.religion),
    nationality: orEmpty(employee?.nationality),
    dateOfBirth: orEmpty(employee?.dateOfBirth),
    cnic: orEmpty(employee?.cnic),
    email: orEmpty(employee?.email),
    phone1: orEmpty(employee?.phone1),
    phone2: orEmpty(employee?.phone2),
    homeAddress: orEmpty(employee?.homeAddress),
    branchId: employee?.branchId ?? null,
    locationId: employee?.locationId ?? null,
    areaId: employee?.areaId ?? null,
    departmentId: employee?.departmentId ?? null,
    divisionId: employee?.divisionId ?? null,
    costCenterId: employee?.costCenterId ?? null,
    designationId: employee?.designationId ?? null,
    jobTitleId: employee?.jobTitleId ?? null,
    gradeId: employee?.gradeId ?? null,
    jobLevelId: employee?.jobLevelId ?? null,
    employeeGroupId: employee?.employeeGroupId ?? null,
    employmentTypeId: employee?.employmentTypeId ?? null,
    lineManagerId: employee?.lineManagerId ?? null,
    finalAuthorityId: employee?.finalAuthorityId ?? null,
    status: EMPLOYEE_STATUSES.find((status) => status === employee?.status) ?? 'active',
    salaryFrequency:
      SALARY_FREQUENCIES.find((frequency) => frequency === employee?.salaryFrequency) ?? 'monthly',
    joiningDate: orEmpty(employee?.joiningDate),
    probationEndDate: orEmpty(employee?.probationEndDate),
    confirmationDate: orEmpty(employee?.confirmationDate),
  }
}

/**
 * The `EmployeeIn` body. The CNIC goes on a new record; on an edit it is left out (it changes
 * through `PUT …/identity`, and a masked CNIC must not be sent back as blank).
 */
export function employeeFormToInput(
  values: EmployeeFormValues,
  employee: Employee | null,
): EmployeeInput {
  return {
    code: textOrNull(values.code),
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    parentName: textOrNull(values.parentName),
    gender: values.gender || null,
    maritalStatus: values.maritalStatus || null,
    religion: textOrNull(values.religion),
    nationality: textOrNull(values.nationality),
    dateOfBirth: values.dateOfBirth || null,
    ...(employee ? {} : { cnic: textOrNull(values.cnic) }),
    email: textOrNull(values.email),
    phone1: textOrNull(values.phone1),
    phone2: textOrNull(values.phone2),
    homeAddress: textOrNull(values.homeAddress),
    homeCityId: employee?.homeCityId ?? null,
    branchId: values.branchId ?? '',
    locationId: values.locationId,
    areaId: values.areaId,
    departmentId: values.departmentId,
    divisionId: values.divisionId,
    costCenterId: values.costCenterId,
    designationId: values.designationId,
    jobTitleId: values.jobTitleId,
    gradeId: values.gradeId,
    jobLevelId: values.jobLevelId,
    employeeGroupId: values.employeeGroupId,
    employmentTypeId: values.employmentTypeId,
    lineManagerId: values.lineManagerId,
    finalAuthorityId: values.finalAuthorityId,
    status: values.status,
    salaryFrequency: values.salaryFrequency,
    joiningDate: values.joiningDate || null,
    probationEndDate: values.probationEndDate || null,
    confirmationDate: values.confirmationDate || null,
    rowVersion: employee?.rowVersion ?? null,
  }
}

/** The whole `EmployeeIn` of a record as it is (Update Profile changes a few fields of it). */
export function employeeToInput(employee: Employee): EmployeeInput {
  return employeeFormToInput(employeeToForm(employee), employee)
}

// --- Update Profile --------------------------------------------------------------------------

export const updateProfileSchema = z
  .object({
    fullName: required('Enter the full name', 401),
    email,
    phone,
    address: text(500),
    cnic,
    dateOfBirth: optionalDay,
    maritalStatus: optionalEnum(MARITAL_STATUSES),
  })
  .superRefine((values, ctx) => {
    const { firstName, lastName } = splitFullName(values.fullName)
    if (values.fullName.trim() && !lastName) {
      ctx.addIssue({
        code: 'custom',
        path: ['fullName'],
        message: 'Enter the first and last name',
      })
    }
    if (firstName.length > 200 || lastName.length > 200) {
      ctx.addIssue({ code: 'custom', path: ['fullName'], message: 'This name is too long' })
    }
    if (values.dateOfBirth && values.dateOfBirth >= today()) {
      ctx.addIssue({
        code: 'custom',
        path: ['dateOfBirth'],
        message: 'The date of birth must be in the past',
      })
    }
  })
export type UpdateProfileValues = z.infer<typeof updateProfileSchema>

export function profileToForm(employee: Employee): UpdateProfileValues {
  return {
    fullName: `${employee.firstName} ${employee.lastName}`.trim(),
    email: orEmpty(employee.email),
    phone: orEmpty(employee.phone1),
    address: orEmpty(employee.homeAddress),
    cnic: orEmpty(employee.cnic),
    dateOfBirth: orEmpty(employee.dateOfBirth),
    maritalStatus: known(MARITAL_STATUSES, employee.maritalStatus),
  }
}

/** The record with the popup's fields changed (`PUT /employees/{id}`), and the CNIC apart. */
export function profileToInput(
  values: UpdateProfileValues,
  employee: Employee,
): { input: EmployeeInput; cnic: string | null | undefined } {
  const { firstName, lastName } = splitFullName(values.fullName)
  return {
    input: {
      ...employeeToInput(employee),
      firstName,
      lastName,
      email: textOrNull(values.email),
      phone1: textOrNull(values.phone),
      homeAddress: textOrNull(values.address),
      dateOfBirth: values.dateOfBirth || null,
      maritalStatus: values.maritalStatus || null,
    },
    cnic: employee.canSeeIdentity ? textOrNull(values.cnic) : undefined,
  }
}

/** API field → Update Profile field. */
export const PROFILE_FIELD_OF: Record<string, keyof UpdateProfileValues> = {
  firstName: 'fullName',
  lastName: 'fullName',
  email: 'email',
  phone1: 'phone',
  homeAddress: 'address',
  cnic: 'cnic',
  dateOfBirth: 'dateOfBirth',
  maritalStatus: 'maritalStatus',
}

// --- Dependents ------------------------------------------------------------------------------

export const dependentFormSchema = z
  .object({
    side: z.enum(['male', 'female']),
    relation: z.union([z.literal(''), z.enum(DEPENDENT_RELATIONS)]),
    firstName: required('Enter the first name'),
    lastName: text(200),
    occupation: text(200),
  })
  .superRefine((values, ctx) => {
    if (!values.relation) {
      ctx.addIssue({ code: 'custom', path: ['relation'], message: 'Choose the relation' })
    }
  })
export type DependentFormValues = z.infer<typeof dependentFormSchema>

/** Male or female side of the toggle, from the relation (spouse / other: the first side). */
export function sideOf(relation: string | null): DependentSide {
  return (DEPENDENT_SIDES.female as readonly string[]).includes(relation ?? '') &&
    !(DEPENDENT_SIDES.male as readonly string[]).includes(relation ?? '')
    ? 'female'
    : 'male'
}

export function dependentToForm(
  row: {
    relation: string
    firstName: string
    lastName: string | null
    occupation: string | null
  } | null,
): DependentFormValues {
  return {
    side: sideOf(row?.relation ?? null),
    relation: DEPENDENT_RELATIONS.find((relation) => relation === row?.relation) ?? '',
    firstName: row?.firstName ?? '',
    lastName: row?.lastName ?? '',
    occupation: row?.occupation ?? '',
  }
}

export const dependentToInput = (values: DependentFormValues): DependentInput => ({
  firstName: values.firstName.trim(),
  lastName: textOrNull(values.lastName),
  relation: values.relation || 'other',
  occupation: textOrNull(values.occupation),
})

// --- Skills ----------------------------------------------------------------------------------

export const skillFormSchema = z
  .object({
    skillTitle: required('Enter the skill title'),
    skillLevel: z.union([z.literal(''), z.enum(SKILL_LEVELS)]),
  })
  .superRefine((values, ctx) => {
    if (!values.skillLevel) {
      ctx.addIssue({ code: 'custom', path: ['skillLevel'], message: 'Choose the skill level' })
    }
  })
export type SkillFormValues = z.infer<typeof skillFormSchema>

export const skillToInput = (values: SkillFormValues): SkillInput => ({
  skillTitle: values.skillTitle.trim(),
  skillLevel: values.skillLevel || 'beginner',
})

// --- Academics (education) and Experience ------------------------------------------------------

/**
 * From / To with the "In Process" switch: To Date is needed unless in process. `openEnded` says
 * how the form marks an open end (the contract's switch is its Status).
 */
function checkPeriod(
  values: { fromDate: string; toDate: string; inProcess: boolean },
  ctx: z.RefinementCtx,
  openEnded = 'switch on In Process',
) {
  if (!values.fromDate) {
    ctx.addIssue({ code: 'custom', path: ['fromDate'], message: 'Choose the from date' })
  }
  if (!values.inProcess && !values.toDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['toDate'],
      message: `Choose the to date, or ${openEnded}`,
    })
  }
  if (!values.inProcess && !notBefore(values.toDate, values.fromDate)) {
    ctx.addIssue({
      code: 'custom',
      path: ['toDate'],
      message: 'The to date cannot be before the from date',
    })
  }
}

export const academicFormSchema = z
  .object({
    title: required('Enter the academic title'),
    institute: required('Enter the institute name'),
    fromDate: optionalDay,
    toDate: optionalDay,
    inProcess: z.boolean(),
    file: fileRef,
  })
  .superRefine(checkPeriod)
export type AcademicFormValues = z.infer<typeof academicFormSchema>

export const academicToForm = (
  row: {
    title: string
    institute: string
    fromDate: string | null
    toDate: string | null
    isInProcess: boolean
    file: FileRef | null
  } | null,
): AcademicFormValues => ({
  title: row?.title ?? '',
  institute: row?.institute ?? '',
  fromDate: row?.fromDate ?? '',
  toDate: row?.toDate ?? '',
  inProcess: row?.isInProcess ?? false,
  file: row?.file ?? null,
})

export const academicToInput = (values: AcademicFormValues): EducationInput => ({
  title: values.title.trim(),
  institute: values.institute.trim(),
  fromDate: values.fromDate || null,
  toDate: values.inProcess ? null : values.toDate || null,
  isInProcess: values.inProcess,
  fileId: values.file?.id ?? null,
})

export const experienceFormSchema = z
  .object({
    jobTitle: required('Enter the job title', 100),
    companyName: required('Enter the company name'),
    fromDate: optionalDay,
    toDate: optionalDay,
    inProcess: z.boolean(),
    file: fileRef,
  })
  .superRefine(checkPeriod)
export type ExperienceFormValues = z.infer<typeof experienceFormSchema>

export const experienceToForm = (
  row: { jobTitle: string; companyName: string; fromDate: string; toDate: string | null } | null,
): ExperienceFormValues => ({
  jobTitle: row?.jobTitle ?? '',
  companyName: row?.companyName ?? '',
  fromDate: row?.fromDate ?? '',
  toDate: row?.toDate ?? '',
  inProcess: row ? row.toDate === null : false,
  file: null,
})

export const experienceToInput = (values: ExperienceFormValues): ExperienceInput => ({
  jobTitle: values.jobTitle.trim(),
  companyName: values.companyName.trim(),
  fromDate: values.fromDate,
  toDate: values.inProcess ? null : values.toDate || null,
})

// --- Contracts -------------------------------------------------------------------------------

export const CONTRACT_DURATION_VALUES = [
  ...CONTRACT_DURATIONS.map((months) => String(months)),
  'custom',
] as const

export const contractFormSchema = z
  .object({
    contractType: z.union([z.literal(''), z.enum(CONTRACT_TYPES)]),
    duration: z.string(),
    fromDate: optionalDay,
    toDate: optionalDay,
    /** The popup's "Status" switch: on = in process (no end date yet). */
    inProcess: z.boolean(),
    file: fileRef,
    remarks: text(1000),
  })
  .superRefine((values, ctx) => {
    if (!values.contractType) {
      ctx.addIssue({ code: 'custom', path: ['contractType'], message: 'Choose the contract type' })
    }
    checkPeriod(values, ctx, 'set Status to In Process')
  })
export type ContractFormValues = z.infer<typeof contractFormSchema>

/** The To Date a fixed term gives: From + months − 1 day. */
export function contractEnd(fromDate: string, months: number): string {
  const start = parseDateValue(fromDate)
  return start ? format(subDays(addMonths(start, months), 1), 'yyyy-MM-dd') : ''
}

export const contractToForm = (
  row: {
    contractType: string
    durationMonths: number | null
    fromDate: string
    toDate: string | null
    file: FileRef | null
    remarks: string | null
  } | null,
): ContractFormValues => ({
  contractType: CONTRACT_TYPES.find((type) => type === row?.contractType) ?? '',
  duration:
    row?.durationMonths && (CONTRACT_DURATIONS as readonly number[]).includes(row.durationMonths)
      ? String(row.durationMonths)
      : 'custom',
  fromDate: row?.fromDate ?? '',
  toDate: row?.toDate ?? '',
  inProcess: row ? row.toDate === null : false,
  file: row?.file ?? null,
  remarks: row?.remarks ?? '',
})

export const contractToInput = (values: ContractFormValues): ContractInput => {
  const months = Number(values.duration)
  return {
    contractType: values.contractType || 'temporary',
    durationMonths: Number.isInteger(months) && months > 0 ? months : null,
    fromDate: values.fromDate,
    toDate: values.inProcess ? null : values.toDate || null,
    fileId: values.file?.id ?? null,
    remarks: textOrNull(values.remarks),
  }
}

// --- Documents -------------------------------------------------------------------------------

export const documentFormSchema = z
  .object({
    documentType: z.union([z.literal(''), z.enum(DOCUMENT_TYPES)]),
    title: text(200),
    documentNumber: text(100),
    issueDate: optionalDay,
    expiryDate: optionalDay,
    file: fileRef,
    remarks: text(1000),
  })
  .superRefine((values, ctx) => {
    if (!values.documentType) {
      ctx.addIssue({ code: 'custom', path: ['documentType'], message: 'Choose the document type' })
    }
    if (!values.file) {
      ctx.addIssue({ code: 'custom', path: ['file'], message: 'Choose the file to upload' })
    }
    if (!notBefore(values.expiryDate, values.issueDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiryDate'],
        message: 'The expiry date cannot be before the issue date',
      })
    }
  })
export type DocumentFormValues = z.infer<typeof documentFormSchema>

export const documentToForm = (
  row: {
    documentType: string
    title: string | null
    documentNumber: string | null
    issueDate: string | null
    expiryDate: string | null
    file: FileRef
    remarks: string | null
  } | null,
): DocumentFormValues => ({
  documentType: DOCUMENT_TYPES.find((type) => type === row?.documentType) ?? '',
  title: row?.title ?? '',
  documentNumber: row?.documentNumber ?? '',
  issueDate: row?.issueDate ?? '',
  expiryDate: row?.expiryDate ?? '',
  file: row?.file ?? null,
  remarks: row?.remarks ?? '',
})

export const documentToInput = (values: DocumentFormValues): DocumentInput => ({
  documentType: values.documentType || 'other',
  title: textOrNull(values.title),
  documentNumber: textOrNull(values.documentNumber),
  issueDate: values.issueDate || null,
  expiryDate: values.expiryDate || null,
  fileId: values.file?.id ?? '',
  remarks: textOrNull(values.remarks),
})

// --- Emergency contacts and bank accounts -----------------------------------------------------

export const emergencyContactFormSchema = z
  .object({
    name: required('Enter the name'),
    relation: z.union([z.literal(''), z.enum(EMERGENCY_RELATIONS)]),
    phone: phone.refine((value) => value !== '', 'Enter the phone number'),
    altPhone: phone,
    address: text(500),
    isPrimary: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (!values.relation) {
      ctx.addIssue({ code: 'custom', path: ['relation'], message: 'Choose the relation' })
    }
  })
export type EmergencyContactFormValues = z.infer<typeof emergencyContactFormSchema>

export const emergencyContactToForm = (
  row: {
    name: string
    relation: string
    phone: string
    altPhone: string | null
    address: string | null
    isPrimary: boolean
  } | null,
  first = false,
): EmergencyContactFormValues => ({
  name: row?.name ?? '',
  relation: EMERGENCY_RELATIONS.find((relation) => relation === row?.relation) ?? '',
  phone: row?.phone ?? '',
  altPhone: row?.altPhone ?? '',
  address: row?.address ?? '',
  isPrimary: row?.isPrimary ?? first,
})

export const emergencyContactToInput = (
  values: EmergencyContactFormValues,
): EmergencyContactInput => ({
  name: values.name.trim(),
  relation: values.relation || 'other',
  phone: values.phone.trim(),
  altPhone: textOrNull(values.altPhone),
  address: textOrNull(values.address),
  isPrimary: values.isPrimary,
})

/** An account number or IBAN with its spaces and dashes taken out. */
export const compactAccount = (value: string) => value.replace(/[\s-]/g, '').toUpperCase()

/** A bank account number: 6 to 30 digits. */
const ACCOUNT_DIGITS = /^\d{6,30}$/
/** An IBAN: country letters, check digits, then 11 to 30 letters and digits (PK: 24 in all). */
const IBAN = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/
/** A Pakistan NTN (1234567 or 1234567-8) or a CNIC used as one (35202-1234567-1). */
const NTN = /^(\d{7}(-?\d)?|\d{5}-?\d{7}-?\d)$/

export const bankAccountFormSchema = z.object({
  accountHolder: text(200),
  accountNumber: required('Enter the account number', 50).refine((value) => {
    const compact = compactAccount(value)
    return compact === '' || ACCOUNT_DIGITS.test(compact) || IBAN.test(compact)
  }, 'Enter the account number (digits) or an IBAN such as PK36SCBL0000001123456702'),
  bankName: required('Enter the bank name'),
  branchName: text(200),
  branchCode: text(50),
  taxPayerId: text(50).refine(
    (value) => value.trim() === '' || NTN.test(value.trim()),
    'Enter the NTN as digits, such as 1234567-8',
  ),
  isPrimary: z.boolean(),
})
export type BankAccountFormValues = z.infer<typeof bankAccountFormSchema>

export const bankAccountToForm = (
  row: {
    accountHolder: string | null
    accountNumber: string
    bankName: string
    branchName: string | null
    branchCode: string | null
    taxPayerId: string | null
    isPrimary: boolean
  } | null,
  first = false,
): BankAccountFormValues => ({
  accountHolder: row?.accountHolder ?? '',
  accountNumber: row?.accountNumber ?? '',
  bankName: row?.bankName ?? '',
  branchName: row?.branchName ?? '',
  branchCode: row?.branchCode ?? '',
  taxPayerId: row?.taxPayerId ?? '',
  isPrimary: row?.isPrimary ?? first,
})

export const bankAccountToInput = (values: BankAccountFormValues): BankAccountInput => ({
  accountHolder: textOrNull(values.accountHolder),
  accountNumber: values.accountNumber.trim(),
  bankName: values.bankName.trim(),
  branchName: textOrNull(values.branchName),
  branchCode: textOrNull(values.branchCode),
  taxPayerId: textOrNull(values.taxPayerId),
  isPrimary: values.isPrimary,
})
