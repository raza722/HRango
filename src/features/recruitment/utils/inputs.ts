import type { FileRef } from '@/lib/files'

import type {
  ApplicantInDto,
  ApplicationInDto,
  HireInDto,
  InterviewInDto,
  OfferInDto,
  OpeningInDto,
} from '../api/recruitment.dto'
import { toApiId, toOptionalId } from '../api/recruitment.mappers'
import {
  type ApplicantFormValues,
  type ApplicationFormValues,
  type HireFormValues,
  type InterviewFormValues,
  type OfferFormValues,
  type OpeningFormValues,
  toNumber,
} from '../schemas/recruitment-forms.schema'
import type { Applicant, Interview, Offer, Opening } from '../types/recruitment.types'
import { blank, numberText } from './format'

// Form values ⇄ API bodies. Empty boxes go out as null; ids as numbers (`toApiId`).

export const openingValues = (opening: Opening | undefined): OpeningFormValues => ({
  title: opening?.title ?? '',
  code: opening?.code ?? '',
  openPositionId: opening?.openPositionId ?? null,
  jobTitleId: opening?.jobTitleId ?? null,
  designationId: opening?.designationId ?? null,
  departmentId: opening?.departmentId ?? null,
  branchId: opening?.branchId ?? null,
  employmentTypeId: opening?.employmentTypeId ?? null,
  hiringManagerId: opening?.hiringManagerId ?? null,
  cityId: opening?.cityId ?? null,
  workMode: opening?.workMode ?? '',
  experienceFromYears: numberText(opening?.experienceFromYears),
  experienceToYears: numberText(opening?.experienceToYears),
  vacancies: opening ? String(opening.vacancies) : '1',
  postedOn: opening?.postedOn ?? '',
  applyBy: opening?.applyBy ?? '',
  closeOn: opening?.closeOn ?? '',
  salaryFrom: numberText(opening?.salaryFrom),
  salaryTo: numberText(opening?.salaryTo),
  isSalaryVisible: opening?.isSalaryVisible ?? false,
  description: opening?.description ?? '',
  requirements: opening?.requirements ?? '',
})

export const toOpeningIn = (values: OpeningFormValues, rowVersion?: string): OpeningInDto => ({
  code: blank(values.code),
  title: values.title.trim(),
  openPositionId: toOptionalId(values.openPositionId),
  jobTitleId: toOptionalId(values.jobTitleId),
  designationId: toOptionalId(values.designationId),
  departmentId: toOptionalId(values.departmentId),
  branchId: toOptionalId(values.branchId),
  employmentTypeId: toOptionalId(values.employmentTypeId),
  hiringManagerId: toOptionalId(values.hiringManagerId),
  cityId: toOptionalId(values.cityId),
  workMode: values.workMode === '' ? null : values.workMode,
  experienceFromYears: toNumber(values.experienceFromYears),
  experienceToYears: toNumber(values.experienceToYears),
  vacancies: toNumber(values.vacancies),
  postedOn: values.postedOn || null,
  applyBy: values.applyBy || null,
  closeOn: values.closeOn || null,
  salaryFrom: toNumber(values.salaryFrom),
  salaryTo: toNumber(values.salaryTo),
  isSalaryVisible: values.isSalaryVisible,
  description: blank(values.description),
  requirements: blank(values.requirements),
  ...(rowVersion ? { rowVersion } : {}),
})

export const applicantValues = (applicant: Applicant | undefined): ApplicantFormValues => ({
  firstName: applicant?.firstName ?? '',
  lastName: applicant?.lastName ?? '',
  email: applicant?.email ?? '',
  phone: applicant?.phone ?? '',
  gender: applicant?.gender ?? '',
  dateOfBirth: applicant?.dateOfBirth ?? '',
  cityId: applicant?.cityId ?? null,
  address: applicant?.address ?? '',
  currentEmployer: applicant?.currentEmployer ?? '',
  currentJobTitle: applicant?.currentJobTitle ?? '',
  experienceYears: numberText(applicant?.experienceYears),
  currentSalary: numberText(applicant?.currentSalary),
  expectedSalary: numberText(applicant?.expectedSalary),
  noticePeriodDays: numberText(applicant?.noticePeriodDays),
  highestEducation: applicant?.highestEducation ?? '',
  linkedinUrl: applicant?.linkedinUrl ?? '',
  source: applicant?.source ?? '',
  referredByEmployeeId: applicant?.referredByEmployeeId ?? null,
  notes: applicant?.notes ?? '',
})

export const toApplicantIn = (
  values: ApplicantFormValues,
  cv: FileRef | null,
  rowVersion?: string,
): ApplicantInDto => ({
  firstName: values.firstName.trim(),
  lastName: values.lastName.trim(),
  email: values.email.trim(),
  phone: blank(values.phone),
  gender: values.gender === '' ? null : values.gender,
  dateOfBirth: values.dateOfBirth || null,
  cityId: toOptionalId(values.cityId),
  address: blank(values.address),
  currentEmployer: blank(values.currentEmployer),
  currentJobTitle: blank(values.currentJobTitle),
  experienceYears: toNumber(values.experienceYears),
  currentSalary: toNumber(values.currentSalary),
  expectedSalary: toNumber(values.expectedSalary),
  noticePeriodDays: toNumber(values.noticePeriodDays),
  highestEducation: blank(values.highestEducation),
  linkedinUrl: blank(values.linkedinUrl),
  source: values.source === '' ? null : values.source,
  referredByEmployeeId:
    values.source === 'referral' ? toOptionalId(values.referredByEmployeeId) : null,
  cvFileId: cv ? toApiId(cv.id) : null,
  notes: blank(values.notes),
  ...(rowVersion ? { rowVersion } : {}),
})

export const toApplicationIn = (values: ApplicationFormValues): ApplicationInDto => ({
  jobOpeningId: toApiId(values.jobOpeningId ?? ''),
  ...(values.who === 'existing'
    ? { applicantId: toOptionalId(values.applicantId) }
    : {
        applicant: {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          phone: blank(values.phone),
          source: values.source === '' ? null : values.source,
        },
      }),
  appliedOn: values.appliedOn || null,
  source: values.source === '' ? null : values.source,
  coverLetter: blank(values.coverLetter),
  remarks: blank(values.remarks),
})

export const toHireIn = (values: HireFormValues): Omit<HireInDto, 'rowVersion'> => ({
  code: blank(values.code),
  joiningDate: values.joiningDate || null,
  branchId: toOptionalId(values.branchId),
  departmentId: toOptionalId(values.departmentId),
  designationId: toOptionalId(values.designationId),
  jobTitleId: toOptionalId(values.jobTitleId),
  employmentTypeId: toOptionalId(values.employmentTypeId),
  lineManagerId: toOptionalId(values.lineManagerId),
  salary: toNumber(values.salary),
  status: values.status,
  probationEndDate: values.status === 'probation' ? values.probationEndDate || null : null,
  cnic: blank(values.cnic),
  remarks: blank(values.remarks),
})

/** "yyyy-MM-dd" + "HH:mm" (local) → an ISO instant with offset. */
export function localInstant(date: string, time: string): string {
  const [year = 0, month = 1, dayOfMonth = 1] = date.split('-').map(Number)
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return new Date(year, month - 1, dayOfMonth, hours, minutes).toISOString()
}

const pad = (value: number) => String(value).padStart(2, '0')

/** An instant as the local "yyyy-MM-dd" and "HH:mm" of the form. */
export function localParts(iso: string): { date: string; time: string } {
  const date = new Date(iso)
  return {
    date: `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

export const interviewValues = (
  interview: (Interview & { interviewerIds: string[] }) | undefined,
  applicationId: string | null,
): InterviewFormValues => {
  const parts = interview ? localParts(interview.scheduledAt) : { date: '', time: '10:00' }
  return {
    applicationId: interview?.applicationId ?? applicationId,
    title: interview?.title ?? '',
    mode: interview?.mode ?? 'in_person',
    date: parts.date,
    time: parts.time,
    durationMinutes: interview ? String(interview.durationMinutes) : '60',
    venue: interview?.venue ?? '',
    interviewerIds: interview?.interviewerIds ?? [],
    remarks: interview?.remarks ?? '',
  }
}

export const toInterviewIn = (
  values: InterviewFormValues,
  rowVersion?: string,
): InterviewInDto => ({
  applicationId: toOptionalId(values.applicationId),
  title: blank(values.title),
  mode: values.mode,
  scheduledAt: localInstant(values.date, values.time),
  durationMinutes: toNumber(values.durationMinutes) ?? 60,
  venue: blank(values.venue),
  remarks: blank(values.remarks),
  interviewerIds: values.interviewerIds.map(toApiId),
  ...(rowVersion ? { rowVersion } : {}),
})

export const offerValues = (
  offer: Offer | undefined,
  applicationId: string | null,
  defaults: Partial<OfferFormValues> = {},
): OfferFormValues => ({
  applicationId: offer?.applicationId ?? applicationId,
  jobTitleId: offer?.jobTitleId ?? defaults.jobTitleId ?? null,
  designationId: offer?.designationId ?? defaults.designationId ?? null,
  departmentId: offer?.departmentId ?? defaults.departmentId ?? null,
  branchId: offer?.branchId ?? defaults.branchId ?? null,
  employmentTypeId: offer?.employmentTypeId ?? defaults.employmentTypeId ?? null,
  offeredSalary: offer ? String(offer.offeredSalary) : (defaults.offeredSalary ?? ''),
  salaryFrequency: offer?.salaryFrequency ?? 'monthly',
  joiningDate: offer?.joiningDate ?? '',
  probationMonths: offer ? numberText(offer.probationMonths) : '3',
  expiresOn: offer?.expiresOn ?? '',
  remarks: offer?.remarks ?? '',
})

export const toOfferIn = (
  values: OfferFormValues,
  letter: FileRef | null,
  rowVersion?: string,
): OfferInDto => ({
  applicationId: toOptionalId(values.applicationId),
  jobTitleId: toOptionalId(values.jobTitleId),
  designationId: toOptionalId(values.designationId),
  departmentId: toOptionalId(values.departmentId),
  branchId: toOptionalId(values.branchId),
  employmentTypeId: toOptionalId(values.employmentTypeId),
  offeredSalary: toNumber(values.offeredSalary) ?? 0,
  salaryFrequency: values.salaryFrequency,
  joiningDate: values.joiningDate,
  probationMonths: toNumber(values.probationMonths),
  expiresOn: values.expiresOn || null,
  offerLetterFileId: letter ? toApiId(letter.id) : null,
  remarks: blank(values.remarks),
  ...(rowVersion ? { rowVersion } : {}),
})
