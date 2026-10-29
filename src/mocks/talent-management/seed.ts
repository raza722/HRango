import { addMonths, format, subDays } from 'date-fns'

import type {
  BankAccount,
  Contract,
  Dependent,
  Education,
  EmergencyContact,
  Employee,
  EmployeeDocument,
  Experience,
  Skill,
} from '@/features/talent-management/types/employees.types'

import { DIRECTORY, type DirectoryEmployee } from '../employees/seed'
import { mockFileUrl } from '../files/handlers'
import { departmentId } from '../payroll/lookup-handlers'
import { branches, jobTitles } from '../settings/handlers'

/*
 * Seed of the Employees mock: an `EmployeeOut` record for each person of the shared directory
 * (`src/mocks/employees/seed.ts`), with the same ids and the `EMP-0001` codes the employee lookup
 * gives, so every module's people stay the same; plus their child tables. The organisation ids
 * are the ones the other mocks' pickers hand out: branches and job titles from Settings,
 * departments as Payroll's lookup names them (`dep_<slug>`).
 */

/** What the table keeps: the record without the values the API works out on reading. */
export type EmployeeRec = Omit<
  Employee,
  | 'name'
  | 'canSeeIdentity'
  | 'branchName'
  | 'locationName'
  | 'areaName'
  | 'lineManagerName'
  | 'finalAuthorityName'
  | 'tenureMonths'
  | 'emergencyContactName'
  | 'emergencyContactPhone'
  | 'directReportCount'
  | 'photoUrl'
  | 'homeCityName'
>

/** A child row as stored: the `*Out` shape without its worked-out fields. */
export type DependentRec = Omit<Dependent, 'name'>
export type SkillRec = Skill
export type EducationRec = Education
export type ExperienceRec = Omit<Experience, 'isCurrent' | 'months'>
export type ContractRec = Omit<Contract, 'status'>
export type DocumentRec = Omit<EmployeeDocument, 'category' | 'isExpired'>
export type EmergencyContactRec = EmergencyContact
export type BankAccountRec = BankAccount

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const DAY = 'yyyy-MM-dd'
const day = (date: Date) => format(date, DAY)
/** The day `months` before this month, on the given day of the month. */
const monthsAgoDate = (months: number, dayOfMonth = 1) => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - months, dayOfMonth)
}
const monthsAgo = (months: number, dayOfMonth = 1) => day(monthsAgoDate(months, dayOfMonth))
const stamp = (date: string) => `${date}T09:00:00.000Z`
let version = 0
/** A fresh row version (hex, as the API's). */
export const nextRowVersion = () => {
  version += 1
  return (Date.now() * 1000 + version).toString(16).padStart(16, '0')
}

/** The code the employee lookup gives a directory person (`EMP-0001` …). */
export const codeOf = (index: number) => `EMP-${String(index + 1).padStart(4, '0')}`

/** People the mock seeds as women (the rest as men). */
const WOMEN = new Set([
  'em_shelley',
  'em_ayesha',
  'em_sara',
  'em_hina',
  'em_hamda',
  'em_areeba',
  'em_sana',
  'em_mahnoor',
  'em_zainab',
  'em_sadia',
  'em_maryam',
  'em_nida',
  'em_fatima',
  'em_rabia',
  'em_laiba',
])

/** Who leads each department (the people's line manager). */
const DEPARTMENT_HEAD: Record<string, string> = {
  'Human Resource Management': 'em_shelley',
  Operations: 'em_ayesha',
  Sales: 'em_sara',
  Software: 'em_bilal',
  'Mobile App': 'em_bilal',
  Finance: 'em_hina',
  Marketing: 'em_jack',
  Physiotherapy: 'em_hamda',
  Surgery: 'em_kamal',
}

/** Recent joiners still on probation. */
const ON_PROBATION = new Set(['em_laiba', 'em_talha', 'em_asad', 'em_rabia'])

const FATHERS = [
  'Ashraf Hussain',
  'Muhammad Aslam',
  'Tariq Mehmood',
  'Abdul Rehman',
  'Khalid Mahmood',
  'Javed Iqbal',
  'Nasir Ali',
  'Zahid Hussain',
]

const ADDRESSES: Record<string, string> = {
  br_lhr_ho: 'House 12, Street 4, Gulberg III, Lahore',
  br_lhr_jt: 'House 88, Block G, Johar Town, Lahore',
  br_isb: 'House 7, Street 21, F-7/2, Islamabad',
  br_khi: 'Flat 304, Block 5, Clifton, Karachi',
  br_dxb: 'Apartment 1204, Marina Heights, Dubai Marina, Dubai',
  br_rwp: 'House 31, Satellite Town, Rawalpindi',
}

/** The departments Payroll's lookup lists, by id. */
export const DEPARTMENT_NAMES = new Map(
  [...new Set(DIRECTORY.map((person) => person.department))].map((name) => [
    departmentId(name),
    name,
  ]),
)

/** Designations not among Settings' job titles keep an id of their own. */
export const designationIdOf = (name: string) =>
  jobTitles.all().find((title) => title.name === name)?.id ?? `dsg_${slug(name)}`

/** Every designation a seeded person has, by id (Settings' job titles answer the rest). */
export const DESIGNATION_NAMES = new Map(
  DIRECTORY.map((person) => [designationIdOf(person.jobTitle), person.jobTitle]),
)

function nameParts(name: string) {
  const words = name.split(/\s+/)
  return { firstName: words.slice(0, -1).join(' ') || name, lastName: words.at(-1) ?? name }
}

function emailOf(name: string) {
  const words = name
    .replace(/^Dr\s+/i, '')
    .toLowerCase()
    .split(/\s+/)
  return `${words.join('.')}@topedge.tech`
}

function employeeRecord(person: DirectoryEmployee, index: number): EmployeeRec {
  const { firstName, lastName } = nameParts(person.name)
  const manager = index < 7 ? 0 : 1
  const probation = ON_PROBATION.has(person.id)
  const joinedDate = monthsAgoDate(probation ? 2 + (index % 3) : 27 + index * 4, 1 + (index % 27))
  const joined = day(joinedDate)
  const head = DEPARTMENT_HEAD[person.department]
  const branchId = person.branchId ?? 'br_lhr_ho'
  const branch = branches.find(branchId)
  return {
    id: person.id,
    code: codeOf(index),
    firstName,
    lastName,
    parentName: FATHERS[index % FATHERS.length] ?? null,
    gender: WOMEN.has(person.id) ? 'female' : 'male',
    maritalStatus: index % 3 === 0 ? 'single' : 'married',
    religion: person.branchId === 'br_dxb' ? null : 'Islam',
    nationality: person.id === 'em_daniel' ? 'British' : 'Pakistani',
    dateOfBirth: day(
      new Date(1982 + ((index * 7) % 17) + manager, index % 12, 1 + ((index * 3) % 27)),
    ),
    cnic: `${String(35202 + (index % 7) * 101)}-${String(1_234_567 + index * 7_919).slice(0, 7)}-${String((index % 9) + 1)}`,
    email: emailOf(person.name),
    phone1: `0300-${String(1_234_567 + index * 11_111).slice(0, 7)}`,
    phone2: index % 4 === 0 ? `042-3${String(5_000_000 + index * 731).slice(0, 7)}` : null,
    homeAddress: ADDRESSES[branchId] ?? null,
    homeCityId: null,
    photoFileId: null,
    branchId,
    locationId: branch?.locationId ?? null,
    areaId: branch?.areaId ?? null,
    departmentId: departmentId(person.department),
    departmentName: person.department,
    divisionId: null,
    divisionName: null,
    costCenterId: null,
    costCenterName: null,
    designationId: designationIdOf(person.jobTitle),
    designationName: person.jobTitle,
    jobTitleId: designationIdOf(person.jobTitle),
    jobTitleName: person.jobTitle,
    gradeId: null,
    gradeName: null,
    jobLevelId: null,
    jobLevelName: null,
    employeeGroupId: null,
    employeeGroupName: null,
    employmentTypeId: null,
    employmentTypeName: null,
    lineManagerId: head && head !== person.id ? head : index < 7 && index > 0 ? 'em_shelley' : null,
    finalAuthorityId: index === 0 ? null : 'em_shelley',
    status: probation ? 'probation' : 'active',
    salaryFrequency: 'monthly',
    joiningDate: joined,
    confirmationDate: probation ? null : day(addMonths(joinedDate, 3)),
    probationEndDate: day(subDays(addMonths(joinedDate, probation ? 6 : 3), 1)),
    endDate: null,
    userAccountId: index < 7 ? `us_${person.id.slice(3)}` : null,
    createdAt: stamp(joined),
    updatedAt: null,
    rowVersion: nextRowVersion(),
  }
}

export function seedEmployees(): EmployeeRec[] {
  return DIRECTORY.map(employeeRecord)
}

// --- child tables ------------------------------------------------------------------------------

const base = (prefix: string, employeeId: string, n: number, created: string) => ({
  id: `${prefix}_${employeeId.slice(3)}_${String(n)}`,
  employeeId,
  createdAt: stamp(created),
  updatedAt: null,
  rowVersion: nextRowVersion(),
})

/** A file the seed says was uploaded (the link answers 404 in the mock: no bytes kept). */
const seededFile = (id: string, name: string) => ({ id, name, url: mockFileUrl(id) })

export function seedDependents(): DependentRec[] {
  const dependent = (
    employeeId: string,
    n: number,
    firstName: string,
    lastName: string | null,
    relation: string,
    occupation: string | null,
    dateOfBirth: string | null = null,
  ): DependentRec => ({
    ...base('dp', employeeId, n, '2024-01-10'),
    firstName,
    lastName,
    relation,
    occupation,
    dateOfBirth,
  })
  return [
    // The frame's two cards (2423:18475).
    dependent('em_shelley', 1, 'Ashraf', 'Hussain', 'father', 'Property Dealer', '1962-05-14'),
    dependent('em_shelley', 2, 'Fatima', 'Bibi', 'mother', 'Housewife', '1966-09-02'),
    dependent('em_maryam', 1, 'Javed', 'Iqbal', 'father', 'Retired Banker'),
    dependent('em_maryam', 2, 'Saima', 'Javed', 'mother', 'Teacher'),
    dependent('em_bilal', 1, 'Amna', 'Bilal', 'spouse', 'Doctor', '1990-03-21'),
    dependent('em_bilal', 2, 'Hassan', 'Bilal', 'son', 'Student', '2017-11-08'),
  ]
}

export function seedSkills(): SkillRec[] {
  const skill = (employeeId: string, n: number, skillTitle: string, skillLevel: string) => ({
    ...base('sk', employeeId, n, '2024-02-01'),
    skillTitle,
    skillLevel,
  })
  // The frame's chips (2423:18981).
  const drawn: [string, string][] = [
    ['Logo Design', 'expert'],
    ['UI UX Design', 'advanced'],
    ['Photo Editing', 'advanced'],
    ['Newsletter Design', 'intermediate'],
    ['Magazine Design', 'intermediate'],
    ['App Design', 'advanced'],
    ['Website Design', 'expert'],
  ]
  return [
    ...drawn.map(([title, level], index) => skill('em_shelley', index + 1, title, level)),
    ...drawn
      .slice(0, 4)
      .map(([title, level], index) => skill('em_maryam', index + 1, title, level)),
    skill('em_haroon', 1, 'React', 'advanced'),
    skill('em_haroon', 2, 'TypeScript', 'advanced'),
    skill('em_haroon', 3, 'SQL Server', 'intermediate'),
  ]
}

export function seedEducation(): EducationRec[] {
  const education = (
    employeeId: string,
    n: number,
    title: string,
    institute: string,
    fromDate: string,
    toDate: string | null,
    file: Education['file'] = null,
  ): EducationRec => ({
    ...base('ed', employeeId, n, '2023-12-01'),
    title,
    institute,
    fromDate,
    toDate,
    isInProcess: toDate === null,
    file,
  })
  return [
    // The frame's cards (2423:17609): "Studied at BZU Multan, 2018-2022, Graduation: BSIT".
    education(
      'em_shelley',
      1,
      'Graduation: BSIT',
      'BZU Multan',
      '2018-09-01',
      '2022-07-31',
      seededFile('file_seed_bsit', 'bsit-degree.pdf'),
    ),
    education(
      'em_shelley',
      2,
      'Intermediate: F.S.C',
      'Punjab College Multan',
      '2016-09-01',
      '2018-06-30',
    ),
    education(
      'em_maryam',
      1,
      'Graduation: BS Software Engineering',
      'FAST Lahore',
      '2015-09-01',
      '2019-06-30',
    ),
    education('em_haroon', 1, 'Masters: MS Computer Science', 'LUMS', '2024-09-01', null),
  ]
}

export function seedExperience(): ExperienceRec[] {
  const experience = (
    employeeId: string,
    n: number,
    companyName: string,
    jobTitle: string,
    fromDate: string,
    toDate: string | null,
  ): ExperienceRec => ({
    ...base('ex', employeeId, n, '2023-12-01'),
    companyName,
    jobTitle,
    fromDate,
    toDate,
  })
  return [
    // "Worked at HexaTech, 2021-2022, Position: Graphic Designer" (2423:17609).
    experience('em_shelley', 1, 'HexaTech', 'Graphic Designer', '2021-01-04', '2022-12-30'),
    // The Profile Dashboard's timeline (765:234).
    experience('em_bilal', 1, 'HData Systems', 'Senior App Developer', '2020-01-06', null),
    experience('em_bilal', 2, 'iTechArt', 'App Developer', '2018-02-01', '2019-12-31'),
    experience(
      'em_bilal',
      3,
      'Protiviti Limited',
      'Junior App Developer',
      '2017-03-01',
      '2018-01-31',
    ),
    experience('em_maryam', 1, 'Pixel Studio', 'Junior Designer', '2019-08-01', '2021-05-31'),
  ]
}

export function seedContracts(): ContractRec[] {
  const contract = (
    employeeId: string,
    n: number,
    contractType: string,
    durationMonths: number | null,
    fromDate: string,
    toDate: string | null,
    remarks: string | null,
    file: Contract['file'] = null,
  ): ContractRec => ({
    ...base('ct', employeeId, n, fromDate),
    contractType,
    durationMonths,
    fromDate,
    toDate,
    file,
    remarks,
  })
  return [
    // "Project Contract, 21 Jan 2024 - 21 Feb 2024, Temporary" (2423:17711).
    contract(
      'em_shelley',
      1,
      'temporary',
      1,
      '2024-01-21',
      '2024-02-21',
      'Project Contract',
      seededFile('file_seed_contract', 'project-contract.pdf'),
    ),
    contract('em_shelley', 2, 'permanent', null, '2024-03-01', null, 'Permanent appointment'),
    contract('em_bilal', 1, 'permanent', null, '2020-01-06', null, null),
    contract(
      'em_talha',
      1,
      'probation',
      6,
      monthsAgo(3),
      day(subDays(addMonths(monthsAgoDate(3), 6), 1)),
      'Probation period',
    ),
  ]
}

export function seedDocuments(): DocumentRec[] {
  const document = (
    employeeId: string,
    n: number,
    documentType: string,
    title: string | null,
    issueDate: string | null,
    expiryDate: string | null,
    file: EmployeeDocument['file'],
    documentNumber: string | null = null,
  ): DocumentRec => ({
    ...base('dc', employeeId, n, issueDate ?? '2024-01-01'),
    documentType,
    title,
    documentNumber,
    issueDate,
    expiryDate,
    file,
    fileMimeType: 'application/pdf',
    fileSizeBytes: 182_000,
    remarks: null,
  })
  return [
    // "Resume, 12-10-2022" (2423:17609).
    document(
      'em_shelley',
      1,
      'certificate',
      'Resume',
      '2022-10-12',
      null,
      seededFile('file_seed_resume', 'resume.pdf'),
    ),
    document(
      'em_shelley',
      2,
      'cnic',
      'CNIC copy',
      '2021-03-15',
      '2031-03-15',
      seededFile('file_seed_cnic', 'cnic.pdf'),
      '35202-1234567-1',
    ),
    document(
      'em_bilal',
      1,
      'offer_letter',
      'Offer Letter',
      '2019-12-20',
      null,
      seededFile('file_seed_offer', 'offer-letter.pdf'),
    ),
  ]
}

const RELATIONS = ['father', 'spouse', 'brother', 'mother', 'sister'] as const

export function seedEmergencyContacts(): EmergencyContactRec[] {
  return DIRECTORY.map((person, index): EmergencyContactRec => {
    const first = person.id === 'em_shelley'
    return {
      ...base('ec', person.id, 1, '2024-01-05'),
      name: first ? 'Ashraf Hussain' : (FATHERS[(index + 3) % FATHERS.length] ?? 'Next of kin'),
      relation: first ? 'father' : (RELATIONS[index % RELATIONS.length] ?? 'other'),
      // "03125656412" (2423:17024).
      phone: first ? '0312-5656412' : `0321-${String(4_000_000 + index * 13_579).slice(0, 7)}`,
      altPhone: null,
      address: null,
      isPrimary: true,
    }
  })
}

export function seedBankAccounts(): BankAccountRec[] {
  const account = (
    employeeId: string,
    n: number,
    bankName: string,
    accountNumber: string,
    branchName: string,
    isPrimary: boolean,
  ): BankAccountRec => ({
    ...base('ba', employeeId, n, '2023-06-01'),
    accountHolder: DIRECTORY.find((person) => person.id === employeeId)?.name ?? null,
    accountNumber,
    bankName,
    branchName,
    branchCode: null,
    taxPayerId: null,
    isPrimary,
  })
  return [
    account('em_shelley', 1, 'Meezan Bank', 'PK36MEZN0002010101234567', 'Gulberg Branch', true),
    account('em_bilal', 1, 'HBL', 'PK24HABB0012345678901234', 'Johar Town Branch', true),
    account('em_bilal', 2, 'Bank Alfalah', 'PK51ALFH0123000004567890', 'Main Boulevard', false),
  ]
}
