import { createMockCollection } from '../collection'
import {
  type BankAccountRec,
  type ContractRec,
  type DependentRec,
  type DocumentRec,
  type EducationRec,
  type EmergencyContactRec,
  type EmployeeRec,
  type ExperienceRec,
  seedBankAccounts,
  seedContracts,
  seedDependents,
  seedDocuments,
  seedEducation,
  seedEmergencyContacts,
  seedEmployees,
  seedExperience,
  seedSkills,
  type SkillRec,
} from './seed'

// The Employees mock's tables, kept in sessionStorage in the browser like every mock.

const key = (name: string) => `hrms-mock-talent-${name}`

export const employees = createMockCollection<EmployeeRec>({
  storageKey: key('employees'),
  seed: seedEmployees,
})
export const dependents = createMockCollection<DependentRec>({
  storageKey: key('dependents'),
  seed: seedDependents,
})
export const skills = createMockCollection<SkillRec>({
  storageKey: key('skills'),
  seed: seedSkills,
})
export const education = createMockCollection<EducationRec>({
  storageKey: key('education'),
  seed: seedEducation,
})
export const experience = createMockCollection<ExperienceRec>({
  storageKey: key('experience'),
  seed: seedExperience,
})
export const contracts = createMockCollection<ContractRec>({
  storageKey: key('contracts'),
  seed: seedContracts,
})
export const documents = createMockCollection<DocumentRec>({
  storageKey: key('documents'),
  seed: seedDocuments,
})
export const emergencyContacts = createMockCollection<EmergencyContactRec>({
  storageKey: key('emergency-contacts'),
  seed: seedEmergencyContacts,
})
export const bankAccounts = createMockCollection<BankAccountRec>({
  storageKey: key('bank-accounts'),
  seed: seedBankAccounts,
})

/** Restores every table to its seed (tests, `resetMockDb`). */
export function resetTalentManagementDb(): void {
  employees.reset()
  dependents.reset()
  skills.reset()
  education.reset()
  experience.reset()
  contracts.reset()
  documents.reset()
  emergencyContacts.reset()
  bankAccounts.reset()
}
