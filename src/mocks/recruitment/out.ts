import { format } from 'date-fns'

import type {
  ApplicantDetailOutDto,
  ApplicantOutDto,
  ApplicationDetailOutDto,
  ApplicationOutDto,
  EvaluationOutDto,
  InterviewDetailOutDto,
  InterviewOutDto,
  OfferOutDto,
  OpeningOutDto,
  RejectionReasonOutDto,
} from '@/features/recruitment/api/recruitment.dto'
import type { FileRef } from '@/lib/files'

import { findEmployee } from '../employees/seed'
import { mockFileUrl, mockUploadName } from '../files/handlers'
import { openPositions } from '../manpower-planning/db'
import { branches, jobTitles } from '../settings/handlers'
import { CITIES, COUNTRIES, STATES } from '../settings/seed'
import { employees } from '../talent-management/db'
import { DEPARTMENT_NAMES, DESIGNATION_NAMES } from '../talent-management/seed'
import {
  applicants,
  applications,
  evaluations,
  history,
  interviews,
  offers,
  openings,
  reasons,
} from './db'
import type {
  ApplicantRec,
  ApplicationRec,
  InterviewRec,
  OfferRec,
  OpeningRec,
  ReasonRec,
  StageValue,
} from './seed'

// The read side of the Recruitment mock: stored records → the API's `*Out` shapes, with the
// names and counts the API works out (organisation names, people, totals per opening …).

export const CLOSED: readonly StageValue[] = ['hired', 'rejected', 'withdrawn']
export const isActive = (application: ApplicationRec) => !CLOSED.includes(application.stage)

// --- names --------------------------------------------------------------------------------------

export const branchName = (id: string | null) => (id ? (branches.find(id)?.name ?? null) : null)
export const titleName = (id: string | null) =>
  id ? (jobTitles.find(id)?.name ?? DESIGNATION_NAMES.get(id) ?? null) : null
export const departmentName = (id: string | null) =>
  id ? (DEPARTMENT_NAMES.get(id) ?? null) : null

/** A person of the directory, or someone Recruitment hired into the Employees mock. */
export function personOf(id: string | null) {
  if (!id) return null
  const person = findEmployee(id)
  const rec = employees.find(id)
  if (!person && !rec) return null
  return {
    id,
    name: person?.name ?? `${rec?.firstName ?? ''} ${rec?.lastName ?? ''}`.trim(),
    code: rec?.code ?? null,
    jobTitle: person?.jobTitle ?? rec?.jobTitleName ?? rec?.designationName ?? null,
    email: rec?.email ?? null,
  }
}

export function cityOf(id: string | null) {
  const city = id ? CITIES.find((row) => row.id === id) : undefined
  if (!city) return { cityName: null, stateId: null, stateName: null, countryName: null }
  const state = STATES.find((row) => row.id === city.stateId)
  const country = state ? COUNTRIES.find((row) => row.id === state.countryId) : undefined
  return {
    cityName: city.name,
    stateId: city.stateId,
    stateName: state?.name ?? null,
    countryName: country?.name ?? null,
  }
}

function fileOf(id: string | null, name: string | null): FileRef | null {
  if (!id) return null
  return { id, name: mockUploadName(id) ?? name, url: mockFileUrl(id) }
}

// --- out shapes ---------------------------------------------------------------------------------

export function openingOut(rec: OpeningRec): OpeningOutDto {
  const own = applications.all().filter((row) => row.jobOpeningId === rec.id)
  const hired = own.filter((row) => row.stage === 'hired').length
  const position = rec.openPositionId ? openPositions.find(rec.openPositionId) : undefined
  const city = cityOf(rec.cityId)
  return {
    ...rec,
    openPositionTitle: position?.title ?? null,
    openPositionSeats: position?.totalPositions ?? null,
    jobTitleName: titleName(rec.jobTitleId),
    designationName: titleName(rec.designationId),
    departmentName: departmentName(rec.departmentId),
    branchName: branchName(rec.branchId),
    employmentTypeName: null,
    hiringManagerName: personOf(rec.hiringManagerId)?.name ?? null,
    cityName: city.cityName,
    stateId: city.stateId,
    stateName: city.stateName,
    hiredCount: hired,
    remainingVacancies: Math.max(0, rec.vacancies - hired),
    applicationCount: own.length,
    activeApplicationCount: own.filter(isActive).length,
  }
}

export const fullName = (rec: Pick<ApplicantRec, 'firstName' | 'lastName'>) =>
  `${rec.firstName} ${rec.lastName}`.trim()

export function applicantOut(rec: ApplicantRec): ApplicantOutDto {
  const { cvName, ...rest } = rec
  const city = cityOf(rec.cityId)
  return {
    ...rest,
    fullName: fullName(rec),
    cityName: city.cityName,
    stateName: city.stateName,
    countryName: city.countryName,
    referredByName: personOf(rec.referredByEmployeeId)?.name ?? null,
    cv: fileOf(rec.cvFileId, cvName),
    applicationCount: applications.all().filter((row) => row.applicantId === rec.id).length,
  }
}

export function applicantDetailOut(rec: ApplicantRec): ApplicantDetailOutDto {
  return {
    ...applicantOut(rec),
    applications: applications
      .all()
      .filter((row) => row.applicantId === rec.id)
      .sort((a, b) => b.appliedOn.localeCompare(a.appliedOn))
      .map(applicationOut),
  }
}

const average = (values: readonly number[]) =>
  values.length === 0
    ? null
    : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10

const ownInterviews = (applicationId: string) =>
  interviews.all().filter((row) => row.applicationId === applicationId)

export function applicationOut(rec: ApplicationRec): ApplicationOutDto {
  const opening = openings.find(rec.jobOpeningId)
  const applicant = applicants.find(rec.applicantId)
  const own = ownInterviews(rec.id)
  const ratings = evaluations
    .all()
    .filter((row) => own.some((interview) => interview.id === row.interviewId))
    .map((row) => row.rating)
  const now = new Date().toISOString()
  const next = own
    .filter((row) => row.status === 'scheduled' && row.scheduledAt >= now)
    .map((row) => row.scheduledAt)
    .sort()[0]
  const latestOffer = offers
    .all()
    .filter((row) => row.applicationId === rec.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const applicantCity = applicant ? cityOf(applicant.cityId) : null
  return {
    ...rec,
    jobOpeningCode: opening?.code ?? '',
    jobOpeningTitle: opening?.title ?? '',
    departmentId: opening?.departmentId ?? null,
    departmentName: departmentName(opening?.departmentId ?? null),
    branchId: opening?.branchId ?? null,
    branchName: branchName(opening?.branchId ?? null),
    applicantName: applicant ? fullName(applicant) : '',
    applicantEmail: applicant?.email ?? '',
    applicantPhone: applicant?.phone ?? null,
    applicantCurrentJobTitle: applicant?.currentJobTitle ?? null,
    applicantCityName: applicantCity?.cityName ?? null,
    cvFileId: applicant?.cvFileId ?? null,
    cv: applicant ? fileOf(applicant.cvFileId, applicant.cvName) : null,
    rejectionReasonName: rec.rejectionReasonId
      ? (reasons.find(rec.rejectionReasonId)?.name ?? null)
      : null,
    employeeCode: rec.employeeId ? (employees.find(rec.employeeId)?.code ?? null) : null,
    interviewCount: own.filter((row) => row.status !== 'cancelled').length,
    nextInterviewAt: next ?? null,
    averageRating: average(ratings),
    evaluationCount: ratings.length,
    latestOfferId: latestOffer?.id ?? null,
    latestOfferStatus: latestOffer?.status ?? null,
  }
}

export function applicationDetailOut(rec: ApplicationRec): ApplicationDetailOutDto {
  return {
    ...applicationOut(rec),
    history: history
      .all()
      .filter((row) => row.applicationId === rec.id)
      .sort((a, b) => a.changedAt.localeCompare(b.changedAt))
      .map((row) => ({
        id: row.id,
        fromStage: row.fromStage,
        toStage: row.toStage,
        changedAt: row.changedAt,
        changedByUserId: null,
        changedByName: row.changedByName,
        remarks: row.remarks,
      })),
    interviews: ownInterviews(rec.id)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .map(interviewOut),
    offers: offers
      .all()
      .filter((row) => row.applicationId === rec.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(offerOut),
  }
}

const endOf = (rec: InterviewRec) =>
  new Date(new Date(rec.scheduledAt).getTime() + rec.durationMinutes * 60_000).toISOString()

export function interviewOut(rec: InterviewRec): InterviewOutDto {
  const application = applications.find(rec.applicationId)
  const app = application ? applicationOut(application) : null
  const own = evaluations.all().filter((row) => row.interviewId === rec.id)
  const { interviewerIds, ...rest } = rec
  return {
    ...rest,
    applicationStage: application?.stage ?? 'applied',
    jobOpeningId: application?.jobOpeningId ?? '',
    jobOpeningTitle: app?.jobOpeningTitle ?? '',
    applicantId: application?.applicantId ?? '',
    applicantName: app?.applicantName ?? '',
    applicantEmail: app?.applicantEmail ?? '',
    applicantPhone: app?.applicantPhone ?? null,
    applicantCityName: app?.applicantCityName ?? null,
    cvFileId: app?.cvFileId ?? null,
    cv: app?.cv ?? null,
    endsAt: endOf(rec),
    interviewerNames: interviewerIds.map((id) => personOf(id)?.name ?? id).join(', ') || null,
    interviewerCount: interviewerIds.length,
    evaluationCount: own.length,
    averageRating: average(own.map((row) => row.rating)),
  }
}

export function interviewDetailOut(rec: InterviewRec): InterviewDetailOutDto {
  const own = evaluations.all().filter((row) => row.interviewId === rec.id)
  return {
    ...interviewOut(rec),
    interviewers: rec.interviewerIds.map((id) => {
      const person = personOf(id)
      return {
        employeeId: id,
        employeeCode: person?.code ?? null,
        employeeName: person?.name ?? id,
        jobTitleName: person?.jobTitle ?? null,
        email: person?.email ?? null,
        hasEvaluated: own.some((row) => row.employeeId === id),
      }
    }),
    evaluations: own.map((row): EvaluationOutDto => ({
      ...row,
      employeeName: personOf(row.employeeId)?.name ?? row.employeeId,
      evaluatedByUserId: null,
    })),
  }
}

/** A draft or sent offer whose expiry day has passed (the server reports it as expired). */
export function offerExpired(rec: Pick<OfferRec, 'status' | 'expiresOn'>): boolean {
  return (
    (rec.status === 'draft' || rec.status === 'sent') &&
    rec.expiresOn !== null &&
    rec.expiresOn < format(new Date(), 'yyyy-MM-dd')
  )
}

export function offerOut(rec: OfferRec): OfferOutDto {
  const application = applications.find(rec.applicationId)
  const app = application ? applicationOut(application) : null
  const { offerLetterName, ...rest } = rec
  return {
    ...rest,
    status: offerExpired(rec) ? 'expired' : rec.status,
    applicationStage: application?.stage ?? 'applied',
    jobOpeningId: application?.jobOpeningId ?? '',
    jobOpeningTitle: app?.jobOpeningTitle ?? '',
    applicantId: application?.applicantId ?? '',
    applicantName: app?.applicantName ?? '',
    applicantEmail: app?.applicantEmail ?? '',
    jobTitleName: titleName(rec.jobTitleId),
    designationName: titleName(rec.designationId),
    departmentName: departmentName(rec.departmentId),
    branchName: branchName(rec.branchId),
    employmentTypeName: null,
    offerLetter: fileOf(rec.offerLetterFileId, offerLetterName),
  }
}

export function reasonOut(rec: ReasonRec): RejectionReasonOutDto {
  return {
    ...rec,
    usageCount: applications.all().filter((row) => row.rejectionReasonId === rec.id).length,
  }
}

/** The local day of an instant (`yyyy-MM-dd`), for the date filters. */
export const localDay = (iso: string) => format(new Date(iso), 'yyyy-MM-dd')
