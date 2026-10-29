import { z } from 'zod'

import { findEmployee } from '../employees/seed'
import { profileOf } from '../scheduling/seed'
import { branches, locations } from '../settings/handlers'
import { errorResponse } from '../utils'
import { textOrNull } from './backend'
import { currentPlace, mockDepartments, transferRequests } from './db'
import { applyTransfer, revertTransfer } from './effects'
import type { CoreKindDef } from './handlers'
import { invalid } from './http'
import type { StoredTransferRequest } from './transfer-flow'

/*
 * Transfer (`/requests/transfer`, admin only): `details { locationId, branchId,
 * departmentId, lineManagerId, finalAuthorityId, effectiveDate }`, the
 * application letter as the request's `application`. Approval records the move
 * in the transfer log (effects.ts).
 */

const id = z.union([z.string(), z.number()]).transform(String)

const transferDetails = z.object({
  locationId: id.nullish(),
  branchId: id.nullish(),
  departmentId: id.nullish(),
  lineManagerId: id.nullish(),
  finalAuthorityId: id.nullish(),
  effectiveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
})

const isActive = (employeeId: string) => {
  const employee = findEmployee(employeeId)
  return employee ? profileOf(employee).status === 'active' : false
}

const nameOf = (employeeId: string) => findEmployee(employeeId)?.name ?? null

export const transferDef: CoreKindDef<StoredTransferRequest> = {
  kind: 'transfer',
  typeName: 'Transfer',
  codePrefix: 'RQ-TRF',
  idPrefix: 'trq',
  collection: transferRequests,
  toPayload: (body, employeeId, current) => {
    const parsed = transferDetails.safeParse(body.details)
    if (!parsed.success) return invalid('Some fields are not valid.')
    const details = parsed.data
    const location = details.locationId ? locations.find(details.locationId) : undefined
    if (!location) return invalid('Location is required.', { locationId: 'Location is required.' })
    const branch = details.branchId ? branches.find(details.branchId) : undefined
    if (!branch) return invalid('Branch is required.', { branchId: 'Branch is required.' })
    if (branch.locationId !== location.id) {
      return invalid('This branch is not in the chosen location.', {
        branchId: 'This branch is not in the chosen location.',
      })
    }
    const department = mockDepartments().find((item) => item.id === details.departmentId)
    if (!department) {
      return invalid('Department is required.', { departmentId: 'Department is required.' })
    }
    for (const [field, value, message] of [
      ['lineManagerId', details.lineManagerId, 'Choose a line manager other than the employee.'],
      [
        'finalAuthorityId',
        details.finalAuthorityId,
        'Choose a final authority other than the employee.',
      ],
    ] as const) {
      if (!value || value === employeeId || !isActive(value)) {
        return invalid(message, { [field]: message })
      }
    }
    const effectiveDate = details.effectiveDate ?? body.fromDate
    if (!effectiveDate) {
      return invalid('Effective date is required.', {
        effectiveDate: 'Effective date is required.',
      })
    }
    const open = transferRequests
      .all()
      .some(
        (record) =>
          record.id !== current?.id &&
          record.employeeId === employeeId &&
          (record.status === 'pending' || record.status === 'cancelling'),
      )
    if (open) {
      return errorResponse(409, 'This employee already has a transfer request waiting.', {
        code: 'TRANSFER_OPEN',
        fieldErrors: { employeeId: 'This employee already has a transfer request waiting.' },
      })
    }
    const from = current
      ? {
          fromLocationId: current.payload.fromLocationId,
          fromBranchId: current.payload.fromBranchId,
          fromDepartment: current.payload.fromDepartment,
        }
      : currentPlace(employeeId)
    // A move to where the person already works (same branch and department) is no transfer.
    if (from.fromBranchId === branch.id && from.fromDepartment === department.name) {
      const message = `${nameOf(employeeId) ?? 'The employee'} already works in ${department.name} at ${branch.name}. Choose another branch or department.`
      return invalid(message, { branchId: message })
    }
    return {
      ...from,
      locationId: location.id,
      branchId: branch.id,
      departmentId: department.id,
      department: department.name,
      lineManagerId: details.lineManagerId ?? '',
      finalAuthorityId: details.finalAuthorityId ?? '',
      effectiveDate,
      reason: textOrNull(body.reason),
      description: textOrNull(body.description),
      application: body.application ?? null,
    }
  },
  facts: (payload) => ({ departmentId: payload.departmentId, branchId: payload.branchId }),
  dateOf: (payload) => payload.effectiveDate,
  details: (record) => {
    const { payload } = record
    return {
      locationId: payload.locationId,
      locationName: locations.find(payload.locationId)?.name ?? null,
      branchId: payload.branchId,
      branchName: branches.find(payload.branchId)?.name ?? null,
      departmentId: payload.departmentId,
      departmentName: payload.department,
      lineManagerId: payload.lineManagerId,
      lineManagerName: nameOf(payload.lineManagerId),
      finalAuthorityId: payload.finalAuthorityId,
      finalAuthorityName: nameOf(payload.finalAuthorityId),
      effectiveDate: payload.effectiveDate,
    }
  },
  header: (record) => ({
    fromDate: record.payload.effectiveDate,
    toDate: record.payload.effectiveDate,
    days: null,
    reason: record.payload.reason,
    description: record.payload.description,
    application: record.payload.application,
  }),
  onApproved: (record) => {
    applyTransfer(record)
    return null
  },
  onCancelled: (record) => {
    revertTransfer(record.id)
  },
}
