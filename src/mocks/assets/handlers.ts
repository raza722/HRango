import { format } from 'date-fns'
import { http } from 'msw'
import { z } from 'zod'

import {
  type Allocation,
  type Asset,
  ASSET_CONDITIONS,
  type AssetHistoryRow,
  type AssetType,
  type Clearance,
  type ClearancePrefill,
  type ClearanceRow,
  RETURN_CONDITIONS,
  RETURN_STATUSES,
} from '@/features/assets'

import { endOfEmployments } from '../offboarding/db'
import { apiPath, createId } from '../utils'
import {
  allocations,
  assets,
  assetTypes,
  clearances,
  openAllocationOf,
  type StoredAllocation,
  type StoredAsset,
  type StoredAssetType,
  type StoredClearance,
} from './db'
import {
  authed,
  conflict,
  created,
  day,
  fileIdSchema,
  fileRef,
  idSchema,
  invalid,
  matches,
  nextCode,
  nextVersion,
  noContent,
  notFound,
  now,
  ok,
  optionalId,
  optionalText,
  page,
  param,
  readBody,
  rejected,
  stale,
} from './http'
import { isActive, personOf, sameUnit } from './people'

/*
 * The backend's /api/assets routes (backend/app/routers/assets.py) over the mock tables.
 */

const base = (path: string) => apiPath(`/assets${path}`)

const today = () => format(new Date(), 'yyyy-MM-dd')
const nameOf = (id: string) => personOf(id)?.name ?? id
/** How audit rows name a holder: "Name - CODE". */
const holderText = (id: string) => {
  const person = personOf(id)
  return person ? `${person.name} - ${person.code}` : id
}
const ME = { performedByUserId: '1', performedByName: 'Shelley Kannes' }

/** Adds core.audit_log rows for the asset (one per changed field, or one without a field). */
function addHistory(
  assetId: string,
  action: string,
  changes: { fieldName: string | null; oldValue: string | null; newValue: string | null }[],
) {
  const asset = assets.find(assetId)
  if (!asset) return
  const at = now()
  const rows: AssetHistoryRow[] = (
    changes.length > 0 ? changes : [{ fieldName: null, oldValue: null, newValue: null }]
  ).map((change) => ({ id: createId('ah'), action, performedAt: at, ...ME, ...change }))
  assets.update(asset.id, { ...asset, history: [...rows, ...asset.history] })
}

// --- shapes out ---------------------------------------------------------------------------------

const typeOut = (type: StoredAssetType): AssetType => ({
  id: type.id,
  code: type.code,
  name: type.name,
  description: type.description,
  isActive: type.isActive,
  assetCount: assets.all().filter((asset) => asset.assetTypeId === type.id).length,
  createdAt: type.createdAt,
  updatedAt: type.updatedAt,
  rowVersion: type.rowVersion,
})

function availabilityOf(asset: StoredAsset): Asset['availability'] {
  if (asset.status !== 'active') return 'unavailable'
  return openAllocationOf(asset.id) ? 'allocated' : 'available'
}

function assetOut(asset: StoredAsset): Asset {
  const holder = openAllocationOf(asset.id)
  const person = holder ? personOf(holder.employeeId) : undefined
  const { fileName, history: _history, ...fields } = asset
  return {
    ...fields,
    assetTypeName: assetTypes.find(asset.assetTypeId)?.name ?? '',
    file: fileRef(asset.fileId, fileName),
    availability: availabilityOf(asset),
    holderId: holder?.employeeId ?? null,
    holderCode: person?.code ?? null,
    holderName: person?.name ?? null,
  }
}

function allocationOut(allocation: StoredAllocation): Allocation {
  const asset = assets.find(allocation.assetId)
  const person = personOf(allocation.employeeId)
  const { fileName, ...fields } = allocation
  return {
    ...fields,
    employeeCode: person?.code ?? null,
    employeeName: person?.name ?? null,
    companyName: person?.companyName ?? 'TopEdge Technologies',
    assetCode: asset?.code ?? '',
    assetName: asset?.name ?? '',
    identificationNo: asset?.identificationNo ?? null,
    assetTypeId: asset?.assetTypeId ?? '',
    assetTypeName: asset ? (assetTypes.find(asset.assetTypeId)?.name ?? '') : '',
    status: allocation.deallocatedOn ? 'deallocated' : 'allocated',
    file: fileRef(allocation.fileId, fileName),
  }
}

const departmentIdOf = (name: string) => `dep_${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

function clearanceRow(form: StoredClearance): ClearanceRow {
  const person = personOf(form.employeeId)
  return {
    id: form.id,
    employeeId: form.employeeId,
    employeeCode: person?.code ?? null,
    employeeName: person?.name ?? null,
    departmentId: person ? departmentIdOf(person.departmentName) : null,
    departmentName: person?.departmentName ?? null,
    endOfEmploymentId: form.endOfEmploymentId,
    clearanceDate: form.clearanceDate,
    approvalDate: form.approvalDate,
    status: form.status,
    itemCount: form.items.length,
    createdAt: form.createdAt,
    updatedAt: form.updatedAt,
    rowVersion: form.rowVersion,
  }
}

function clearanceOut(form: StoredClearance): Clearance {
  return {
    ...clearanceRow(form),
    checkedById: form.checkedById,
    checkedByName: form.checkedById ? nameOf(form.checkedById) : null,
    approvedById: form.approvedById,
    approvedByName: form.approvedById ? nameOf(form.approvedById) : null,
    fileId: form.fileId,
    file: fileRef(form.fileId, form.fileName),
    items: form.items.map((item) => {
      const allocation = allocations.find(item.assetAllocationId)
      const asset = allocation ? assets.find(allocation.assetId) : undefined
      return {
        ...item,
        assetId: allocation?.assetId ?? '',
        assetCode: asset?.code ?? '',
        assetName: asset?.name ?? '',
        identificationNo: asset?.identificationNo ?? null,
        allocatedOn: allocation?.allocatedOn ?? '',
      }
    }),
  }
}

// --- Asset Types --------------------------------------------------------------------------------

const typeSchema = z.object({
  name: z.string().trim().min(1, 'Asset type name is required.').max(200),
  description: optionalText(4000),
  isActive: z.boolean().default(true),
  rowVersion: z.string().nullish(),
})

const nameTaken = (name: string, id?: string) =>
  assetTypes.all().some((type) => type.id !== id && type.name.toLowerCase() === name.toLowerCase())

const DUPLICATE_TYPE = 'An asset type with this name already exists.'

const typeHandlers = [
  http.get(base('/types'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const active = param(url, 'isActive')
    const list = assetTypes
      .all()
      .filter(
        (type) =>
          matches(url, type.name, type.code) &&
          (active === undefined || String(type.isActive) === active),
      )
      .sort((a, b) => a.code.localeCompare(b.code))
    return page(url, list.map(typeOut))
  }),
  http.get(base('/types/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const type = assetTypes.find(String(params.id))
    return type ? ok(typeOut(type)) : notFound('Asset type')
  }),
  http.post(base('/types'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, typeSchema)
    if (!parsed.success) return rejected(parsed.error)
    if (nameTaken(parsed.data.name)) return conflict(DUPLICATE_TYPE, 'ASSET_TYPE_DUPLICATE', 'name')
    const type: StoredAssetType = {
      id: createId('at'),
      code: nextCode(
        'AITP-',
        assetTypes.all().map((item) => item.code),
      ),
      name: parsed.data.name,
      description: parsed.data.description,
      isActive: parsed.data.isActive,
      createdAt: now(),
      updatedAt: null,
      rowVersion: nextVersion(),
    }
    assetTypes.insert(type)
    return created(typeOut(type))
  }),
  http.put(base('/types/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = assetTypes.find(String(params.id))
    if (!existing) return notFound('Asset type')
    const parsed = await readBody(request, typeSchema)
    if (!parsed.success) return rejected(parsed.error)
    const old = stale(existing, parsed.data.rowVersion, 'asset type')
    if (old) return old
    if (nameTaken(parsed.data.name, existing.id)) {
      return conflict(DUPLICATE_TYPE, 'ASSET_TYPE_DUPLICATE', 'name')
    }
    const type: StoredAssetType = {
      ...existing,
      name: parsed.data.name,
      description: parsed.data.description,
      isActive: parsed.data.isActive,
      updatedAt: now(),
      rowVersion: nextVersion(),
    }
    assetTypes.update(existing.id, type)
    return ok(typeOut(type))
  }),
  http.delete(base('/types/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const type = assetTypes.find(String(params.id))
    if (!type) return notFound('Asset type')
    const old = stale(type, new URL(request.url).searchParams.get('rowVersion'), 'asset type')
    if (old) return old
    const used = assets.all().filter((asset) => asset.assetTypeId === type.id).length
    if (used > 0) {
      return conflict('Assets of this type exist. Deactivate the type instead.')
    }
    assetTypes.remove(type.id)
    return noContent()
  }),
]

// --- Company Assets -----------------------------------------------------------------------------

const assetSchema = z.object({
  name: z.string().trim().min(1, 'Asset name is required.').max(200),
  assetTypeId: idSchema('Asset type not found.'),
  identificationNo: optionalText(100),
  isTaxable: z.boolean().default(false),
  assetCondition: z.enum(ASSET_CONDITIONS, { error: 'Condition must be old, new or fair.' }),
  manufacturer: optionalText(100),
  model: optionalText(100),
  currentValue: z.number().min(0, 'Current value cannot be negative.').nullish(),
  acquiredDate: day.nullish(),
  description: optionalText(4000),
  fileId: fileIdSchema,
  rowVersion: z.string().nullish(),
})
type AssetBody = z.infer<typeof assetSchema>

function assetProblem(input: AssetBody, current?: StoredAsset) {
  const type = assetTypes.find(input.assetTypeId)
  if (!type) return invalid('Asset type not found.', { assetTypeId: 'Asset type not found.' })
  if (!type.isActive && current?.assetTypeId !== type.id) {
    return invalid('This asset type is inactive.', { assetTypeId: 'This asset type is inactive.' })
  }
  const number = input.identificationNo?.toLowerCase()
  if (
    number &&
    assets
      .all()
      .some((asset) => asset.id !== current?.id && asset.identificationNo?.toLowerCase() === number)
  ) {
    return conflict(
      'Another asset has this identification number.',
      'ASSET_DUPLICATE',
      'identificationNo',
    )
  }
  return null
}

/** What an edit changed, as core.audit_log rows (column names, values as text). */
function diff(before: StoredAsset, after: StoredAsset) {
  const text = (value: string | number | boolean | null) =>
    value === null ? null : typeof value === 'boolean' ? (value ? '1' : '0') : String(value)
  type Column =
    | 'name'
    | 'assetTypeId'
    | 'identificationNo'
    | 'isTaxable'
    | 'assetCondition'
    | 'manufacturer'
    | 'model'
    | 'currentValue'
    | 'acquiredDate'
    | 'description'
    | 'fileId'
  const columns: [string, Column][] = [
    ['name', 'name'],
    ['asset_type_id', 'assetTypeId'],
    ['identification_no', 'identificationNo'],
    ['is_taxable', 'isTaxable'],
    ['asset_condition', 'assetCondition'],
    ['manufacturer', 'manufacturer'],
    ['model', 'model'],
    ['current_value', 'currentValue'],
    ['acquired_date', 'acquiredDate'],
    ['description', 'description'],
    ['file_id', 'fileId'],
  ]
  return columns
    .map(([fieldName, key]) => ({
      fieldName,
      oldValue: text(before[key]),
      newValue: text(after[key]),
    }))
    .filter((change) => change.oldValue !== change.newValue)
}

const fields = (input: AssetBody) => ({
  name: input.name,
  assetTypeId: input.assetTypeId,
  identificationNo: input.identificationNo,
  isTaxable: input.isTaxable,
  assetCondition: input.assetCondition,
  manufacturer: input.manufacturer,
  model: input.model,
  currentValue: input.currentValue ?? null,
  acquiredDate: input.acquiredDate ?? null,
  description: input.description,
  fileId: input.fileId,
})

const itemHandlers = [
  http.get(base('/company-assets'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const status = param(url, 'status')
    const availability = param(url, 'availability')
    const assetTypeId = param(url, 'assetTypeId')
    const list = assets
      .all()
      .filter(
        (asset) =>
          matches(url, asset.name, asset.code, asset.identificationNo) &&
          (!assetTypeId || asset.assetTypeId === assetTypeId) &&
          (!status || asset.status === status) &&
          (!availability || availabilityOf(asset) === availability),
      )
      .sort((a, b) => a.code.localeCompare(b.code))
    return page(url, list.map(assetOut))
  }),
  http.get(base('/company-assets/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const asset = assets.find(String(params.id))
    return asset ? ok(assetOut(asset)) : notFound('Asset')
  }),
  http.get(base('/company-assets/:id/history'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const asset = assets.find(String(params.id))
    return asset ? ok(asset.history) : notFound('Asset')
  }),
  http.post(base('/company-assets'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, assetSchema)
    if (!parsed.success) return rejected(parsed.error)
    const problem = assetProblem(parsed.data)
    if (problem) return problem
    const asset: StoredAsset = {
      id: createId('as'),
      code: nextCode(
        'AST-',
        assets.all().map((item) => item.code),
      ),
      ...fields(parsed.data),
      fileName: null,
      status: 'active',
      createdAt: now(),
      updatedAt: null,
      rowVersion: nextVersion(),
      history: [],
    }
    assets.insert(asset)
    addHistory(asset.id, 'create', [])
    return created(assetOut(asset))
  }),
  http.put(base('/company-assets/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = assets.find(String(params.id))
    if (!existing) return notFound('Asset')
    const parsed = await readBody(request, assetSchema)
    if (!parsed.success) return rejected(parsed.error)
    const old = stale(existing, parsed.data.rowVersion, 'asset')
    if (old) return old
    const problem = assetProblem(parsed.data, existing)
    if (problem) return problem
    const next: StoredAsset = {
      ...existing,
      ...fields(parsed.data),
      fileName: parsed.data.fileId === existing.fileId ? existing.fileName : null,
      updatedAt: now(),
      rowVersion: nextVersion(),
    }
    const changes = diff(existing, next)
    assets.update(existing.id, next)
    if (changes.length > 0) addHistory(existing.id, 'update', changes)
    return ok(assetOut(assets.find(existing.id) ?? next))
  }),
  http.delete(base('/company-assets/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const asset = assets.find(String(params.id))
    if (!asset) return notFound('Asset')
    const old = stale(asset, new URL(request.url).searchParams.get('rowVersion'), 'asset')
    if (old) return old
    if (allocations.all().some((item) => item.assetId === asset.id)) {
      return conflict('This asset has been allocated before. Deactivate it instead.')
    }
    assets.remove(asset.id)
    return noContent()
  }),
  http.patch(base('/company-assets/:id/:action'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const action = String(params.action)
    if (action !== 'activate' && action !== 'deactivate') return notFound('Route')
    const asset = assets.find(String(params.id))
    if (!asset) return notFound('Asset')
    const parsed = await readBody(request, z.object({ rowVersion: z.string().nullish() }))
    if (!parsed.success) return rejected(parsed.error)
    const old = stale(asset, parsed.data.rowVersion, 'asset')
    if (old) return old
    const next = action === 'activate' ? 'active' : 'decommissioned'
    if (action === 'deactivate' && openAllocationOf(asset.id)) {
      return conflict('This asset is allocated. Deallocate it first.', 'ASSET_ALLOCATED', 'status')
    }
    if (asset.status !== next) {
      assets.update(asset.id, {
        ...asset,
        status: next,
        updatedAt: now(),
        rowVersion: nextVersion(),
      })
      addHistory(asset.id, action, [
        { fieldName: 'status', oldValue: asset.status, newValue: next },
      ])
    }
    return ok(assetOut(assets.find(asset.id) ?? asset))
  }),
]

// --- Asset Allocations --------------------------------------------------------------------------

const allocationSchema = z.object({
  assetId: idSchema('Asset not found.'),
  employeeId: idSchema('Employee not found.'),
  allocatedOn: day,
  description: optionalText(4000),
  fileId: fileIdSchema,
})

const deallocateSchema = z.object({
  deallocatedOn: day,
  returnCondition: z
    .enum(RETURN_CONDITIONS, { error: 'Condition must be good, fair or damaged.' })
    .nullish(),
  remarks: optionalText(500),
  rowVersion: z.string().nullish(),
})

const allocationHandlers = [
  http.get(base('/allocations'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const wanted = {
      employeeId: param(url, 'employeeId'),
      assetTypeId: param(url, 'assetTypeId'),
      assetId: param(url, 'assetId'),
      status: param(url, 'status'),
      from: param(url, 'from'),
      to: param(url, 'to'),
    }
    const list = allocations
      .all()
      .sort(
        (a, b) =>
          b.allocatedOn.localeCompare(a.allocatedOn) || b.createdAt.localeCompare(a.createdAt),
      )
      .map(allocationOut)
      .filter(
        (row) =>
          matches(
            url,
            row.employeeName,
            row.employeeCode,
            row.assetName,
            row.assetCode,
            row.identificationNo,
          ) &&
          (!wanted.employeeId || row.employeeId === wanted.employeeId) &&
          (!wanted.assetTypeId || row.assetTypeId === wanted.assetTypeId) &&
          (!wanted.status || row.status === wanted.status) &&
          (!wanted.assetId || row.assetId === wanted.assetId) &&
          (!wanted.from || row.allocatedOn >= wanted.from) &&
          (!wanted.to || row.allocatedOn <= wanted.to),
      )
    return page(url, list)
  }),
  http.get(base('/allocations/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const allocation = allocations.find(String(params.id))
    return allocation ? ok(allocationOut(allocation)) : notFound('Allocation')
  }),
  http.post(base('/allocations'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, allocationSchema)
    if (!parsed.success) return rejected(parsed.error)
    const input = parsed.data
    const asset = assets.find(input.assetId)
    if (!asset) return invalid('Asset not found.', { assetId: 'Asset not found.' })
    if (!personOf(input.employeeId)) {
      return invalid('Employee not found.', { employeeId: 'Employee not found.' })
    }
    if (!isActive(input.employeeId)) {
      return invalid('This employee has left.', { employeeId: 'This employee has left.' })
    }
    if (asset.status !== 'active') {
      return conflict(
        'This asset is not active and cannot be allocated.',
        'ASSET_UNAVAILABLE',
        'assetId',
      )
    }
    if (openAllocationOf(asset.id)) {
      return conflict(
        'The asset was still with someone else on that date.',
        'ASSET_ALLOCATED',
        'assetId',
      )
    }
    if (asset.acquiredDate && input.allocatedOn < asset.acquiredDate) {
      const message = 'The allocation date is before the asset was acquired.'
      return invalid(message, { allocatedOn: message })
    }
    const allocation: StoredAllocation = {
      id: createId('al'),
      employeeId: input.employeeId,
      assetId: asset.id,
      allocatedOn: input.allocatedOn,
      deallocatedOn: null,
      description: input.description,
      returnCondition: null,
      deallocationRemarks: null,
      fileId: input.fileId,
      fileName: null,
      assetClearanceId: null,
      createdAt: now(),
      updatedAt: null,
      rowVersion: nextVersion(),
    }
    allocations.insert(allocation)
    addHistory(asset.id, 'allocate', [
      { fieldName: 'holder', oldValue: null, newValue: holderText(input.employeeId) },
    ])
    return created(allocationOut(allocation))
  }),
  http.patch(base('/allocations/:id/deallocate'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const allocation = allocations.find(String(params.id))
    if (!allocation) return notFound('Allocation')
    const parsed = await readBody(request, deallocateSchema)
    if (!parsed.success) return rejected(parsed.error)
    const old = stale(allocation, parsed.data.rowVersion, 'allocation')
    if (old) return old
    if (allocation.deallocatedOn) {
      return conflict(
        'This asset has already been deallocated.',
        'ALLOCATION_CLOSED',
        'deallocatedOn',
      )
    }
    if (parsed.data.deallocatedOn < allocation.allocatedOn) {
      const message = 'The deallocation date is before the allocation date.'
      return invalid(message, { deallocatedOn: message })
    }
    const next: StoredAllocation = {
      ...allocation,
      deallocatedOn: parsed.data.deallocatedOn,
      returnCondition: parsed.data.returnCondition ?? null,
      deallocationRemarks: parsed.data.remarks,
      updatedAt: now(),
      rowVersion: nextVersion(),
    }
    allocations.update(allocation.id, next)
    addHistory(allocation.assetId, 'deallocate', [
      { fieldName: 'holder', oldValue: holderText(allocation.employeeId), newValue: null },
    ])
    const asset = assets.find(allocation.assetId)
    if (parsed.data.returnCondition === 'damaged' && asset?.status === 'active') {
      assets.update(asset.id, { ...asset, status: 'damaged', rowVersion: nextVersion() })
      addHistory(asset.id, 'deallocate', [
        { fieldName: 'status', oldValue: 'active', newValue: 'damaged' },
      ])
    }
    return ok(allocationOut(next))
  }),
]

// --- Asset Clearance Form -----------------------------------------------------------------------

const clearanceSchema = z.object({
  employeeId: idSchema('Employee not found.'),
  endOfEmploymentId: optionalId,
  clearanceDate: day,
  checkedById: optionalId,
  approvedById: optionalId,
  approvalDate: day.nullish(),
  fileId: fileIdSchema,
  items: z
    .array(
      z.object({
        assetAllocationId: idSchema('Choose the asset'),
        conditionAtClearance: z.enum(RETURN_CONDITIONS, { error: 'Choose the condition' }),
        reason: optionalText(4000),
        returnStatus: z.enum(RETURN_STATUSES, { error: 'Choose the return status' }),
        comments: optionalText(4000),
      }),
    )
    .default([]),
  rowVersion: z.string().nullish(),
})
type ClearanceBody = z.infer<typeof clearanceSchema>

/** The person's pending end of employment, which a form made from the Assets menu links to. */
const pendingRecordOf = (employeeId: string) =>
  endOfEmployments.all().find((item) => item.employeeId === employeeId && item.status === 'pending')

function clearanceProblem(input: ClearanceBody, current?: StoredClearance) {
  if (!personOf(input.employeeId)) {
    return invalid('Employee not found.', { employeeId: 'Employee not found.' })
  }
  if (current && current.employeeId !== input.employeeId) {
    const message = 'The employee of a clearance form cannot be changed.'
    return invalid(message, { employeeId: message })
  }
  for (const key of ['checkedById', 'approvedById'] as const) {
    const id = input[key]
    if (id && !personOf(id)) return invalid('Employee not found.', { [key]: 'Employee not found.' })
  }
  const seen = new Set<string>()
  for (const [index, item] of input.items.entries()) {
    const allocation = allocations.find(item.assetAllocationId)
    const field = `items.${String(index)}.assetAllocationId`
    if (seen.has(item.assetAllocationId) || allocation?.employeeId !== input.employeeId) {
      return invalid('Items are not valid.', {
        [field]: 'This asset is not allocated to the employee.',
      })
    }
    seen.add(item.assetAllocationId)
  }
  const open = clearances
    .all()
    .find(
      (form) =>
        form.id !== current?.id &&
        form.employeeId === input.employeeId &&
        form.status === 'in_progress',
    )
  if (open) {
    return conflict(
      'This employee already has a clearance form in progress.',
      'CLEARANCE_OPEN',
      'employeeId',
    )
  }
  if (input.endOfEmploymentId) {
    const record = endOfEmployments.find(input.endOfEmploymentId)
    if (record?.employeeId !== input.employeeId || record.status !== 'pending') {
      const message = 'No pending end of employment for this employee.'
      return invalid(message, { endOfEmploymentId: message })
    }
  }
  return null
}

function linkToEndOfEmployment(form: StoredClearance, linked: boolean) {
  if (!form.endOfEmploymentId) return
  const record = endOfEmployments.find(form.endOfEmploymentId)
  if (!record) return
  endOfEmployments.update(record.id, { ...record, clearanceId: linked ? form.id : null })
}

/**
 * Approving ends each listed allocation on the clearance date with the condition at
 * clearance; damaged marks the asset damaged, not returned marks it lost.
 */
function approve(form: StoredClearance) {
  const statusChanges: StoredClearance['statusChanges'] = []
  for (const item of form.items) {
    const allocation = allocations.find(item.assetAllocationId)
    if (!allocation) continue
    if (allocation.deallocatedOn === null) {
      allocations.update(allocation.id, {
        ...allocation,
        deallocatedOn:
          form.clearanceDate < allocation.allocatedOn ? allocation.allocatedOn : form.clearanceDate,
        returnCondition: item.conditionAtClearance,
        assetClearanceId: form.id,
        rowVersion: nextVersion(),
      })
    }
    addHistory(allocation.assetId, 'clearance', [
      { fieldName: 'holder', oldValue: holderText(form.employeeId), newValue: item.returnStatus },
    ])
    const asset = assets.find(allocation.assetId)
    const lost = item.returnStatus === 'not_returned'
    if (asset?.status === 'active' && (lost || item.conditionAtClearance === 'damaged')) {
      const next = lost ? 'lost' : 'damaged'
      assets.update(asset.id, { ...asset, status: next, rowVersion: nextVersion() })
      addHistory(asset.id, 'clearance', [
        { fieldName: 'status', oldValue: 'active', newValue: next },
      ])
      statusChanges.push({ assetId: asset.id, from: 'active' })
    }
  }
  clearances.update(form.id, {
    ...form,
    status: 'approved',
    approvalDate: form.approvalDate ?? today(),
    statusChanges,
    updatedAt: now(),
    rowVersion: nextVersion(),
  })
}

/** Unapprove: back in progress, with the allocations it closed reopened and asset statuses back. */
function unapprove(form: StoredClearance) {
  for (const allocation of allocations.all().filter((item) => item.assetClearanceId === form.id)) {
    allocations.update(allocation.id, {
      ...allocation,
      deallocatedOn: null,
      returnCondition: null,
      assetClearanceId: null,
      rowVersion: nextVersion(),
    })
  }
  for (const change of form.statusChanges) {
    const asset = assets.find(change.assetId)
    if (!asset) continue
    assets.update(asset.id, { ...asset, status: change.from, rowVersion: nextVersion() })
    addHistory(asset.id, 'unapprove clearance', [
      { fieldName: 'status', oldValue: asset.status, newValue: change.from },
    ])
  }
  clearances.update(form.id, {
    ...form,
    status: 'in_progress',
    statusChanges: [],
    updatedAt: now(),
    rowVersion: nextVersion(),
  })
}

const bulkSchema = z.object({
  forms: z
    .array(z.object({ id: idSchema('Choose a form'), rowVersion: z.string() }))
    .min(1, 'Choose at least one clearance form.'),
})

const clearanceHandlers = [
  http.get(base('/clearance-forms'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const status = param(url, 'status')
    const employeeId = param(url, 'employeeId')
    const departmentId = param(url, 'departmentId')
    const eoe = param(url, 'endOfEmploymentId')
    const list = clearances
      .all()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(clearanceRow)
      .filter(
        (row) =>
          matches(url, row.employeeName, row.employeeCode) &&
          (!status || row.status === status) &&
          (!employeeId || row.employeeId === employeeId) &&
          (!departmentId || sameUnit(departmentId, row.departmentName)) &&
          (!eoe || row.endOfEmploymentId === eoe),
      )
    return page(url, list)
  }),
  http.get(base('/clearance-forms/prefill'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const employeeId = new URL(request.url).searchParams.get('employeeId') ?? ''
    const person = personOf(employeeId)
    if (!person) return notFound('Employee')
    const prefill: ClearancePrefill = {
      employeeId,
      employeeCode: person.code,
      employeeName: person.name,
      departmentId: departmentIdOf(person.departmentName),
      departmentName: person.departmentName,
      endOfEmploymentId: pendingRecordOf(employeeId)?.id ?? null,
      items: allocations
        .all()
        .filter((item) => item.employeeId === employeeId && item.deallocatedOn === null)
        .map((item) => {
          const asset = assets.find(item.assetId)
          return {
            assetAllocationId: item.id,
            assetId: item.assetId,
            assetCode: asset?.code ?? '',
            assetName: asset?.name ?? '',
            identificationNo: asset?.identificationNo ?? null,
            allocatedOn: item.allocatedOn,
          }
        }),
    }
    return ok(prefill)
  }),
  http.patch(base('/clearance-forms/:action'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const action = String(params.action)
    if (action !== 'approve' && action !== 'unapprove') return notFound('Route')
    const parsed = await readBody(request, bulkSchema)
    if (!parsed.success) return rejected(parsed.error)
    // All or nothing: check every form first.
    const forms: StoredClearance[] = []
    for (const ref of parsed.data.forms) {
      const form = clearances.find(ref.id)
      if (!form) return notFound('Clearance form')
      const old = stale(form, ref.rowVersion, 'clearance form')
      if (old) return old
      if (action === 'approve' && form.status === 'approved') {
        return conflict(
          'A chosen clearance form is already approved.',
          'CLEARANCE_APPROVED',
          'status',
        )
      }
      if (action === 'unapprove' && form.status !== 'approved') {
        return conflict(
          'A chosen clearance form is not approved.',
          'CLEARANCE_NOT_APPROVED',
          'status',
        )
      }
      const record = form.endOfEmploymentId
        ? endOfEmployments.find(form.endOfEmploymentId)
        : undefined
      const reallocated = allocations
        .all()
        .filter((item) => item.assetClearanceId === form.id)
        .some((closed) =>
          allocations
            .all()
            .some(
              (other) =>
                other.assetId === closed.assetId &&
                other.id !== closed.id &&
                other.createdAt > closed.createdAt,
            ),
        )
      if (action === 'unapprove' && reallocated) {
        return conflict('An asset on a chosen form has been allocated again since.')
      }
      if (action === 'unapprove' && record?.status === 'completed') {
        return conflict(
          'The end of employment for a chosen form is completed.',
          'END_OF_EMPLOYMENT_COMPLETED',
          'status',
        )
      }
      forms.push(form)
    }
    for (const form of forms) {
      if (action === 'approve') approve(form)
      else unapprove(form)
    }
    return ok(forms.map((form) => clearanceRow(clearances.find(form.id) ?? form)))
  }),
  http.get(base('/clearance-forms/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const form = clearances.find(String(params.id))
    return form ? ok(clearanceOut(form)) : notFound('Clearance form')
  }),
  http.post(base('/clearance-forms'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, clearanceSchema)
    if (!parsed.success) return rejected(parsed.error)
    const input = parsed.data
    const problem = clearanceProblem(input)
    if (problem) return problem
    const form: StoredClearance = {
      id: createId('cf'),
      employeeId: input.employeeId,
      endOfEmploymentId: input.endOfEmploymentId ?? pendingRecordOf(input.employeeId)?.id ?? null,
      clearanceDate: input.clearanceDate,
      checkedById: input.checkedById,
      approvedById: input.approvedById,
      approvalDate: input.approvalDate ?? null,
      fileId: input.fileId,
      fileName: null,
      status: 'in_progress',
      items: input.items.map((item) => ({ id: createId('cl'), ...item })),
      createdAt: now(),
      updatedAt: null,
      rowVersion: nextVersion(),
      statusChanges: [],
    }
    clearances.insert(form)
    linkToEndOfEmployment(form, true)
    return created(clearanceOut(form))
  }),
  http.put(base('/clearance-forms/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = clearances.find(String(params.id))
    if (!existing) return notFound('Clearance form')
    const parsed = await readBody(request, clearanceSchema)
    if (!parsed.success) return rejected(parsed.error)
    const old = stale(existing, parsed.data.rowVersion, 'clearance form')
    if (old) return old
    if (existing.status === 'approved') {
      return conflict(
        'This clearance form is approved. Unapprove it first.',
        'CLEARANCE_APPROVED',
        'status',
      )
    }
    const input = { ...parsed.data, endOfEmploymentId: existing.endOfEmploymentId }
    const problem = clearanceProblem(input, existing)
    if (problem) return problem
    const form: StoredClearance = {
      ...existing,
      clearanceDate: input.clearanceDate,
      checkedById: input.checkedById,
      approvedById: input.approvedById,
      approvalDate: input.approvalDate ?? null,
      fileId: input.fileId,
      fileName: input.fileId === existing.fileId ? existing.fileName : null,
      items: input.items.map((item, index) => ({
        id: existing.items[index]?.id ?? createId('cl'),
        ...item,
      })),
      updatedAt: now(),
      rowVersion: nextVersion(),
    }
    clearances.update(existing.id, form)
    return ok(clearanceOut(form))
  }),
  http.delete(base('/clearance-forms/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const form = clearances.find(String(params.id))
    if (!form) return notFound('Clearance form')
    const old = stale(form, new URL(request.url).searchParams.get('rowVersion'), 'clearance form')
    if (old) return old
    if (form.status === 'approved') {
      return conflict(
        'This clearance form is approved. Unapprove it first.',
        'CLEARANCE_APPROVED',
        'status',
      )
    }
    linkToEndOfEmployment(form, false)
    clearances.remove(form.id)
    return noContent()
  }),
]

export const assetHandlers = [
  ...typeHandlers,
  ...itemHandlers,
  ...allocationHandlers,
  ...clearanceHandlers,
]
