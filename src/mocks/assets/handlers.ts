import { format } from 'date-fns'
import { http } from 'msw'
import { z } from 'zod'

import {
  type Asset,
  ASSET_CONDITIONS,
  type AssetChange,
  type AssetDetail,
  type AssetHistoryEntry,
  type AssetRow,
  type AssetStatus,
  CLEARANCE_CONDITIONS,
  type ClearanceDetail,
  type ClearanceForm,
  type ClearanceInput,
  type ClearanceRow,
  RETURN_STATUS_LABELS,
  RETURN_STATUSES,
} from '@/features/assets'

import { DIRECTORY, findEmployee } from '../employees/seed'
import { endOfEmployments } from '../offboarding/db'
import { employeeProfile, employeeRef, isActive } from '../payroll/engine'
import {
  conflict,
  day,
  invalid,
  ME,
  money,
  nextCode,
  notFound,
  ok,
  page,
  param,
  readBody,
  rejected,
} from '../payroll/http'
import { apiPath, createId, latency, requireAuth } from '../utils'
import { allocations, assets, assetTypes, clearances, openAllocationOf } from './db'

const base = (path: string) => apiPath(`/assets${path}`)

const authed = async (request: Request) => {
  await latency()
  return requireAuth(request)
}

const today = () => format(new Date(), 'yyyy-MM-dd')
const now = () => new Date().toISOString()
const nameOf = (id: string) => findEmployee(id)?.name ?? id
const typeName = (id: string) => assetTypes.find(id)?.name ?? '—'
const yesNo = (value: boolean) => (value ? 'Yes' : 'No')
const contains = (value: string, wanted: string | undefined) =>
  !wanted || value.toLowerCase().includes(wanted.trim().toLowerCase())

const employeeId = z
  .string()
  .min(1, 'Choose the employee')
  .refine((id) => Boolean(findEmployee(id)), { message: 'Choose the employee' })

// --- helpers ------------------------------------------------------------------------------------

function statusOf(asset: Asset): AssetStatus {
  if (!asset.active) return 'unavailable'
  return openAllocationOf(asset.id) ? 'allocated' : 'available'
}

function holderOf(assetId: string) {
  const open = openAllocationOf(assetId)
  return open ? employeeRef(open.employeeId) : null
}

const assetRow = (asset: Asset): AssetRow => ({
  id: asset.id,
  code: asset.code,
  name: asset.name,
  identificationNumber: asset.identificationNumber,
  assetTypeId: asset.assetTypeId,
  assetType: typeName(asset.assetTypeId),
  status: statusOf(asset),
  holder: holderOf(asset.id),
})

const assetDetail = (asset: Asset): AssetDetail => ({
  ...asset,
  assetType: typeName(asset.assetTypeId),
  status: statusOf(asset),
  holder: holderOf(asset.id),
})

function addHistory(assetId: string, action: AssetHistoryEntry['action'], changes: AssetChange[]) {
  const asset = assets.find(assetId)
  if (!asset) return
  const entry: AssetHistoryEntry = {
    id: createId('ah'),
    action,
    performedById: ME,
    performedAt: now(),
    changes,
  }
  assets.update(asset.id, { ...asset, history: [entry, ...asset.history] })
}

/** The fields an edit changed, as Asset History shows them. */
function diff(before: Asset, after: Asset): AssetChange[] {
  const show: [string, (asset: Asset) => string][] = [
    ['Name', (asset) => asset.name],
    ['Asset Type', (asset) => typeName(asset.assetTypeId)],
    ['Identification Number', (asset) => asset.identificationNumber],
    ['Is Taxable', (asset) => yesNo(asset.taxable)],
    ['Condition', (asset) => (asset.condition === 'new' ? 'New' : 'Old')],
    ['Manufacturer', (asset) => asset.manufacturer],
    ['Model', (asset) => asset.model],
    ['Attachment', (asset) => asset.attachmentName ?? ''],
    ['Current Value', (asset) => String(asset.currentValue)],
    ['Acquired Date', (asset) => asset.acquiredDate],
    ['Description', (asset) => asset.description],
  ]
  return show
    .map(([field, read]) => ({ field, oldValue: read(before), newValue: read(after) }))
    .filter((change) => change.oldValue !== change.newValue)
}

// --- lookups ------------------------------------------------------------------------------------

const lookupHandlers = [
  http.get(base('/lookups'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    return ok({
      employees: DIRECTORY.map((employee) => ({
        ...employeeRef(employee.id),
        status: isActive(employee.id) ? ('active' as const) : ('inactive' as const),
      })),
      departments: [...new Set(DIRECTORY.map((employee) => employee.department))].sort(),
      assetTypes: assetTypes
        .all()
        .map((type) => ({ id: type.id, name: type.name, active: type.active })),
      assets: assets.all().map((asset) => ({
        id: asset.id,
        name: asset.name,
        code: asset.code,
        identificationNumber: asset.identificationNumber,
        assetTypeId: asset.assetTypeId,
        status: statusOf(asset),
      })),
    })
  }),
]

// --- Asset Types --------------------------------------------------------------------------------

const typeSchema = z.object({
  name: z.string().trim().min(1, 'Enter the name').max(60, 'Keep it under 60 characters'),
  description: z.string().trim().max(500, 'Keep it under 500 characters'),
  active: z.boolean(),
})

const typeHandlers = [
  http.get(base('/types'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const status = param(url, 'status')
    const list = assetTypes
      .all()
      .filter(
        (type) =>
          contains(type.name, param(url, 'name')) &&
          (!status || (status === 'active') === type.active),
      )
      .sort((a, b) => a.code.localeCompare(b.code))
    return page(url, list)
  }),
  http.get(base('/types/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const type = assetTypes.find(String(params.id))
    return type ? ok(type) : notFound('asset type')
  }),
  http.post(base('/types'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, typeSchema)
    if (!parsed.success) return rejected(parsed.error)
    const clash = assetTypes
      .all()
      .some((type) => type.name.toLowerCase() === parsed.data.name.toLowerCase())
    if (clash) {
      return conflict('An asset type with this name already exists', 'DUPLICATE', {
        name: 'An asset type with this name already exists',
      })
    }
    const type = {
      id: createId('at'),
      code: nextCode(
        'ATP-',
        assetTypes.all().map((item) => item.code),
      ),
      ...parsed.data,
      createdAt: now(),
    }
    assetTypes.insert(type)
    return ok(type)
  }),
  http.put(base('/types/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = assetTypes.find(String(params.id))
    if (!existing) return notFound('asset type')
    const parsed = await readBody(request, typeSchema)
    if (!parsed.success) return rejected(parsed.error)
    const clash = assetTypes
      .all()
      .some(
        (type) =>
          type.id !== existing.id && type.name.toLowerCase() === parsed.data.name.toLowerCase(),
      )
    if (clash) {
      return conflict('An asset type with this name already exists', 'DUPLICATE', {
        name: 'An asset type with this name already exists',
      })
    }
    const type = { ...existing, ...parsed.data }
    assetTypes.update(existing.id, type)
    return ok(type)
  }),
  http.delete(base('/types/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const type = assetTypes.find(String(params.id))
    if (!type) return notFound('asset type')
    const used = assets.all().filter((asset) => asset.assetTypeId === type.id).length
    if (used > 0) {
      return conflict(
        `${type.name} is the type of ${String(used)} ${used === 1 ? 'asset' : 'assets'}; it cannot be deleted.`,
        'IN_USE',
      )
    }
    assetTypes.remove(type.id)
    return ok({ id: type.id })
  }),
]

// --- Company Assets -----------------------------------------------------------------------------

const assetSchema = z.object({
  name: z.string().trim().min(1, 'Enter the name').max(80, 'Keep it under 80 characters'),
  assetTypeId: z.string().min(1, 'Choose the asset type'),
  identificationNumber: z
    .string()
    .trim()
    .min(1, 'Enter the identification number')
    .max(40, 'Keep it under 40 characters'),
  taxable: z.boolean(),
  condition: z.enum(ASSET_CONDITIONS),
  manufacturer: z.string().trim().max(60, 'Keep it under 60 characters'),
  model: z.string().trim().max(60, 'Keep it under 60 characters'),
  attachmentName: z.string().max(200).nullable(),
  currentValue: money.refine((value) => value > 0, { message: 'Enter the current value' }),
  acquiredDate: day.refine((value) => value <= today(), {
    message: 'The acquired date cannot be in the future',
  }),
  description: z.string().trim().max(500, 'Keep it under 500 characters'),
})

function assetProblem(input: z.infer<typeof assetSchema>, id?: string) {
  const type = assetTypes.find(input.assetTypeId)
  if (!type) return invalid('Choose the asset type', { assetTypeId: 'Choose the asset type' })
  const current = id ? assets.find(id) : undefined
  if (!type.active && current?.assetTypeId !== type.id) {
    return invalid(`${type.name} is not active`, { assetTypeId: `${type.name} is not active` })
  }
  const clash = assets
    .all()
    .some(
      (asset) =>
        asset.id !== id &&
        asset.identificationNumber.toLowerCase() === input.identificationNumber.toLowerCase(),
    )
  if (clash) {
    return conflict('Another asset has this identification number', 'DUPLICATE', {
      identificationNumber: 'Another asset has this identification number',
    })
  }
  return null
}

const importSchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string(),
        assetType: z.string(),
        identificationNumber: z.string(),
        currentValue: z.number(),
        acquiredDate: z.string(),
        manufacturer: z.string(),
        model: z.string(),
      }),
    )
    .min(1, 'The file has no rows')
    .max(2000),
})

const itemHandlers = [
  http.get(base('/items'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const status = param(url, 'status')
    const assetTypeId = param(url, 'assetTypeId')
    const list = assets
      .all()
      .filter(
        (asset) =>
          contains(asset.name, param(url, 'name')) &&
          contains(asset.code, param(url, 'code')) &&
          contains(asset.identificationNumber, param(url, 'identificationNumber')) &&
          (!assetTypeId || asset.assetTypeId === assetTypeId) &&
          (!status || statusOf(asset) === status),
      )
      .sort((a, b) => a.code.localeCompare(b.code))
    return page(url, list.map(assetRow))
  }),
  http.get(base('/items/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const asset = assets.find(String(params.id))
    return asset ? ok(assetDetail(asset)) : notFound('asset')
  }),
  http.get(base('/items/:id/history'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const asset = assets.find(String(params.id))
    if (!asset) return notFound('asset')
    return ok(
      asset.history.map(({ performedById, ...entry }) => ({
        ...entry,
        performedBy: employeeRef(performedById),
      })),
    )
  }),
  http.post(base('/items'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, assetSchema)
    if (!parsed.success) return rejected(parsed.error)
    const problem = assetProblem(parsed.data)
    if (problem) return problem
    const blank: Asset = {
      id: createId('as'),
      code: nextCode(
        'AST-',
        assets.all().map((item) => item.code),
      ),
      name: '',
      assetTypeId: '',
      identificationNumber: '',
      taxable: false,
      condition: 'new',
      manufacturer: '',
      model: '',
      attachmentName: null,
      currentValue: 0,
      acquiredDate: '',
      description: '',
      active: true,
      createdAt: now(),
      history: [],
    }
    const asset: Asset = { ...blank, ...parsed.data }
    const changes = diff({ ...blank, assetTypeId: '__none__' }, asset).map((change) =>
      change.field === 'Asset Type' ? { ...change, oldValue: '' } : change,
    )
    assets.insert({
      ...asset,
      history: [
        { id: createId('ah'), action: 'Create', performedById: ME, performedAt: now(), changes },
      ],
    })
    return ok(assetDetail(asset))
  }),
  http.put(base('/items/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = assets.find(String(params.id))
    if (!existing) return notFound('asset')
    const parsed = await readBody(request, assetSchema)
    if (!parsed.success) return rejected(parsed.error)
    const problem = assetProblem(parsed.data, existing.id)
    if (problem) return problem
    const next: Asset = { ...existing, ...parsed.data }
    const changes = diff(existing, next)
    assets.update(existing.id, next)
    if (changes.length > 0) addHistory(existing.id, 'Update', changes)
    return ok(assetDetail(assets.find(existing.id) ?? next))
  }),
  http.delete(base('/items/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const asset = assets.find(String(params.id))
    if (!asset) return notFound('asset')
    if (allocations.all().some((item) => item.assetId === asset.id)) {
      return conflict(
        'This asset has been allocated, so its record is kept. Deactivate it instead.',
        'IN_USE',
      )
    }
    assets.remove(asset.id)
    return ok({ id: asset.id })
  }),
  http.post(base('/items/:id/deactivate'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const asset = assets.find(String(params.id))
    if (!asset) return notFound('asset')
    if (!asset.active) return conflict('This asset is already deactivated.')
    const open = openAllocationOf(asset.id)
    if (open) {
      return conflict(
        `This asset is allocated to ${nameOf(open.employeeId)}. Deallocate it first.`,
        'ALLOCATED',
      )
    }
    assets.update(asset.id, { ...asset, active: false })
    addHistory(asset.id, 'Deactivate', [{ field: 'Active', oldValue: 'Yes', newValue: 'No' }])
    return ok(assetDetail(assets.find(asset.id) ?? asset))
  }),
  http.post(base('/items/:id/activate'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const asset = assets.find(String(params.id))
    if (!asset) return notFound('asset')
    if (asset.active) return conflict('This asset is already active.')
    assets.update(asset.id, { ...asset, active: true })
    addHistory(asset.id, 'Activate', [{ field: 'Active', oldValue: 'No', newValue: 'Yes' }])
    return ok(assetDetail(assets.find(asset.id) ?? asset))
  }),
  http.post(base('/items/import'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, importSchema)
    if (!parsed.success) return rejected(parsed.error)
    const errors: string[] = []
    let created = 0
    parsed.data.rows.forEach((row, index) => {
      const line = index + 2
      const type = assetTypes
        .all()
        .find((item) => item.name.toLowerCase() === row.assetType.trim().toLowerCase())
      const input = {
        name: row.name.trim(),
        assetTypeId: type?.id ?? '',
        identificationNumber: row.identificationNumber.trim(),
        taxable: true,
        condition: 'new' as const,
        manufacturer: row.manufacturer.trim(),
        model: row.model.trim(),
        attachmentName: null,
        currentValue: row.currentValue,
        acquiredDate: row.acquiredDate.trim(),
        description: '',
      }
      const result = assetSchema.safeParse(input)
      if (!type) {
        errors.push(`Line ${String(line)}: no asset type called ${row.assetType}`)
      } else if (!result.success) {
        errors.push(`Line ${String(line)}: ${result.error.issues[0]?.message ?? 'not valid'}`)
      } else if (
        assets
          .all()
          .some(
            (asset) =>
              asset.identificationNumber.toLowerCase() === input.identificationNumber.toLowerCase(),
          )
      ) {
        errors.push(
          `Line ${String(line)}: an asset with number ${input.identificationNumber} exists`,
        )
      } else {
        const id = createId('as')
        assets.insert({
          id,
          code: nextCode(
            'AST-',
            assets.all().map((item) => item.code),
          ),
          ...result.data,
          active: true,
          createdAt: now(),
          history: [
            {
              id: createId('ah'),
              action: 'Create',
              performedById: ME,
              performedAt: now(),
              changes: [
                { field: 'Name', oldValue: '', newValue: result.data.name },
                { field: 'Asset Type', oldValue: '', newValue: type.name },
                {
                  field: 'Identification Number',
                  oldValue: '',
                  newValue: result.data.identificationNumber,
                },
              ],
            },
          ],
        })
        created += 1
      }
    })
    return ok({ created, errors })
  }),
]

// --- Asset Allocations --------------------------------------------------------------------------

const allocationRow = (id: string) => {
  const allocation = allocations.find(id)
  if (!allocation) return undefined
  const asset = assets.find(allocation.assetId)
  return {
    id: allocation.id,
    company: employeeProfile(allocation.employeeId).company ?? '—',
    employee: employeeRef(allocation.employeeId),
    assetId: allocation.assetId,
    asset: asset?.name ?? '—',
    assetTypeId: asset?.assetTypeId ?? '',
    assetType: asset ? typeName(asset.assetTypeId) : '—',
    identificationNumber: asset?.identificationNumber ?? '—',
    allocationDate: allocation.allocationDate,
    deallocationDate: allocation.deallocationDate,
    status: allocation.deallocationDate ? ('deallocated' as const) : ('allocated' as const),
  }
}

const allocationSchema = z.object({
  employeeId,
  assetId: z.string().min(1, 'Choose the asset'),
  allocationDate: day,
  attachmentName: z.string().max(200).nullable(),
  description: z.string().trim().max(500, 'Keep it under 500 characters'),
})

const allocationHandlers = [
  http.get(base('/allocations'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const wanted = {
      employeeId: param(url, 'employeeId'),
      assetTypeId: param(url, 'assetTypeId'),
      status: param(url, 'status'),
      assetId: param(url, 'assetId'),
      from: param(url, 'from'),
      to: param(url, 'to'),
    }
    const list = allocations
      .all()
      .sort(
        (a, b) =>
          b.allocationDate.localeCompare(a.allocationDate) ||
          b.createdAt.localeCompare(a.createdAt),
      )
      .map((item) => allocationRow(item.id))
      .filter((row): row is NonNullable<typeof row> => row !== undefined)
      .filter(
        (row) =>
          (!wanted.employeeId || row.employee.id === wanted.employeeId) &&
          (!wanted.assetTypeId || row.assetTypeId === wanted.assetTypeId) &&
          (!wanted.status || row.status === wanted.status) &&
          (!wanted.assetId || row.assetId === wanted.assetId) &&
          (!wanted.from || row.allocationDate >= wanted.from) &&
          (!wanted.to || row.allocationDate <= wanted.to),
      )
    return page(url, list)
  }),
  http.get(base('/allocations/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const allocation = allocations.find(String(params.id))
    const row = allocationRow(String(params.id))
    if (!allocation || !row) return notFound('allocation')
    return ok({
      ...row,
      attachmentName: allocation.attachmentName,
      description: allocation.description,
    })
  }),
  http.post(base('/allocations'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, allocationSchema)
    if (!parsed.success) return rejected(parsed.error)
    const input = parsed.data
    const asset = assets.find(input.assetId)
    if (!asset) return invalid('Choose the asset', { assetId: 'Choose the asset' })
    if (!isActive(input.employeeId)) {
      return invalid(`${nameOf(input.employeeId)} no longer works here`, {
        employeeId: `${nameOf(input.employeeId)} no longer works here`,
      })
    }
    if (!asset.active) {
      return invalid('This asset is deactivated', { assetId: 'This asset is deactivated' })
    }
    const open = openAllocationOf(asset.id)
    if (open) {
      const message = `This asset is allocated to ${nameOf(open.employeeId)}`
      return conflict(message, 'ALLOCATED', { assetId: message })
    }
    if (input.allocationDate < asset.acquiredDate) {
      const message = 'The allocation date is before the asset was acquired'
      return invalid(message, { allocationDate: message })
    }
    const allocation = {
      id: createId('al'),
      ...input,
      deallocationDate: null,
      createdAt: now(),
    }
    allocations.insert(allocation)
    addHistory(asset.id, 'Allocate', [
      { field: 'Allocated To', oldValue: '', newValue: nameOf(input.employeeId) },
    ])
    return ok({
      ...allocationRow(allocation.id),
      attachmentName: allocation.attachmentName,
      description: allocation.description,
    })
  }),
  http.post(base('/allocations/:id/deallocate'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const allocation = allocations.find(String(params.id))
    if (!allocation) return notFound('allocation')
    if (allocation.deallocationDate) return conflict('This asset is already deallocated.')
    const parsed = await readBody(request, z.object({ deallocationDate: day }))
    if (!parsed.success) return rejected(parsed.error)
    if (parsed.data.deallocationDate < allocation.allocationDate) {
      const message = 'The deallocation date is before the allocation date'
      return invalid(message, { deallocationDate: message })
    }
    allocations.update(allocation.id, {
      ...allocation,
      deallocationDate: parsed.data.deallocationDate,
    })
    addHistory(allocation.assetId, 'Deallocate', [
      { field: 'Allocated To', oldValue: nameOf(allocation.employeeId), newValue: '' },
    ])
    return ok({
      ...allocationRow(allocation.id),
      attachmentName: allocation.attachmentName,
      description: allocation.description,
    })
  }),
]

// --- Asset Clearance Form -----------------------------------------------------------------------

const clearanceRow = (form: ClearanceForm): ClearanceRow => ({
  id: form.id,
  employee: employeeRef(form.employeeId),
  clearanceDate: form.clearanceDate,
  status: form.status,
})

const clearanceDetail = (form: ClearanceForm): ClearanceDetail => ({
  ...form,
  employee: employeeRef(form.employeeId),
  lines: form.lines.map((line) => {
    const asset = assets.find(line.assetId)
    return {
      ...line,
      asset: asset?.name ?? '—',
      identificationNumber: asset?.identificationNumber ?? '—',
    }
  }),
})

const clearanceSchema = z
  .object({
    employeeId,
    clearanceDate: day,
    lines: z
      .array(
        z.object({
          assetId: z.string().min(1, 'Choose the asset'),
          allocationId: z.string().nullable(),
          dateAllocated: day,
          condition: z.enum(CLEARANCE_CONDITIONS),
          reason: z.string().trim().max(500, 'Keep it under 500 characters'),
          returnStatus: z.enum(RETURN_STATUSES).nullable(),
          comments: z.string().trim().max(1000, 'Keep it under 1000 characters'),
        }),
      )
      .min(1, 'Add the assets being cleared'),
    checkedById: employeeId,
    approvedById: employeeId,
    approvalDate: day,
    attachmentName: z.string().max(200).nullable(),
    endOfEmploymentId: z.string().nullable(),
  })
  .refine((value) => new Set(value.lines.map((line) => line.assetId)).size === value.lines.length, {
    message: 'Each asset can be cleared once',
    path: ['lines'],
  })

function clearanceProblem(input: ClearanceInput, id?: string) {
  for (const [index, line] of input.lines.entries()) {
    const asset = assets.find(line.assetId)
    if (!asset) {
      return invalid('Choose the asset', { [`lines.${String(index)}.assetId`]: 'Choose the asset' })
    }
    if (line.allocationId) {
      const allocation = allocations.find(line.allocationId)
      if (allocation?.employeeId !== input.employeeId || allocation.assetId !== asset.id) {
        const message = `${asset.name} (${asset.identificationNumber}) is not allocated to ${nameOf(input.employeeId)}`
        return invalid(message, { [`lines.${String(index)}.assetId`]: message })
      }
    }
  }
  const pending = clearances
    .all()
    .find(
      (form) => form.id !== id && form.employeeId === input.employeeId && form.status === 'pending',
    )
  if (pending) {
    return conflict(`${nameOf(input.employeeId)} already has a clearance form pending with HR.`)
  }
  if (input.endOfEmploymentId) {
    const record = endOfEmployments.find(input.endOfEmploymentId)
    if (!record) return invalid('That end of employment record could not be found.')
    if (record.clearanceId && record.clearanceId !== id) {
      return conflict('That end of employment record already has a clearance form.')
    }
  }
  return null
}

function linkToEndOfEmployment(form: ClearanceForm | undefined, linked: boolean) {
  if (!form?.endOfEmploymentId) return
  const record = endOfEmployments.find(form.endOfEmploymentId)
  if (!record) return
  endOfEmployments.update(record.id, { ...record, clearanceId: linked ? form.id : null })
}

/**
 * Approving frees the assets: each line's allocation ends on the clearance
 * date. An asset not returned, or returned damaged, becomes Unavailable.
 */
function approve(form: ClearanceForm) {
  const deallocated: string[] = []
  const deactivated: string[] = []
  for (const line of form.lines) {
    const allocation = line.allocationId ? allocations.find(line.allocationId) : undefined
    if (allocation?.deallocationDate === null) {
      const date =
        form.clearanceDate < allocation.allocationDate
          ? allocation.allocationDate
          : form.clearanceDate
      allocations.update(allocation.id, { ...allocation, deallocationDate: date })
      deallocated.push(allocation.id)
    }
    const changes: AssetChange[] = [
      { field: 'Allocated To', oldValue: nameOf(form.employeeId), newValue: '' },
      {
        field: 'Return Status',
        oldValue: '',
        newValue: line.returnStatus ? RETURN_STATUS_LABELS[line.returnStatus] : '',
      },
    ]
    const asset = assets.find(line.assetId)
    if (asset?.active && (line.returnStatus === 'not-returned' || line.condition === 'damaged')) {
      assets.update(asset.id, { ...asset, active: false })
      deactivated.push(asset.id)
      changes.push({ field: 'Active', oldValue: 'Yes', newValue: 'No' })
    }
    addHistory(line.assetId, 'Clearance', changes)
  }
  clearances.update(form.id, { ...form, status: 'approved', effects: { deallocated, deactivated } })
}

/** Unapproved: back to Pending by HR, with the assets given back as they were. */
function unapprove(form: ClearanceForm) {
  for (const id of form.effects?.deallocated ?? []) {
    const allocation = allocations.find(id)
    // Only if nobody has been given the asset since.
    if (allocation && !openAllocationOf(allocation.assetId)) {
      allocations.update(id, { ...allocation, deallocationDate: null })
      addHistory(allocation.assetId, 'Clearance', [
        { field: 'Allocated To', oldValue: '', newValue: nameOf(allocation.employeeId) },
      ])
    }
  }
  for (const id of form.effects?.deactivated ?? []) {
    const asset = assets.find(id)
    if (asset && !asset.active) {
      assets.update(id, { ...asset, active: true })
      addHistory(id, 'Clearance', [{ field: 'Active', oldValue: 'No', newValue: 'Yes' }])
    }
  }
  clearances.update(form.id, { ...form, status: 'pending', effects: null })
}

const clearanceHandlers = [
  http.get(base('/clearances'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const department = param(url, 'department')
    const clearanceDate = param(url, 'clearanceDate')
    const list = clearances
      .all()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(clearanceRow)
      .filter(
        (row) =>
          contains(row.employee.code, param(url, 'code')) &&
          contains(row.employee.name, param(url, 'name')) &&
          (!department || row.employee.department === department) &&
          (!clearanceDate || row.clearanceDate === clearanceDate),
      )
    return page(url, list)
  }),
  http.get(base('/clearances/prefill/:employeeId'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const id = String(params.employeeId)
    if (!findEmployee(id)) return notFound('employee')
    const lines = allocations
      .all()
      .filter((item) => item.employeeId === id && item.deallocationDate === null)
      .map((item) => ({
        assetId: item.assetId,
        allocationId: item.id,
        dateAllocated: item.allocationDate,
        condition: 'good' as const,
        reason: '',
        returnStatus: null,
        comments: '',
      }))
    return ok({ employee: employeeRef(id), lines })
  }),
  http.get(base('/clearances/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const form = clearances.find(String(params.id))
    return form ? ok(clearanceDetail(form)) : notFound('clearance form')
  }),
  http.post(base('/clearances'), async ({ request }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, clearanceSchema)
    if (!parsed.success) return rejected(parsed.error)
    const problem = clearanceProblem(parsed.data)
    if (problem) return problem
    const form: ClearanceForm = {
      id: createId('cf'),
      ...parsed.data,
      lines: parsed.data.lines.map((line) => ({ id: createId('cl'), ...line })),
      status: 'pending',
      createdAt: now(),
      effects: null,
    }
    clearances.insert(form)
    linkToEndOfEmployment(form, true)
    return ok(clearanceDetail(form))
  }),
  http.put(base('/clearances/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const existing = clearances.find(String(params.id))
    if (!existing) return notFound('clearance form')
    if (existing.status === 'approved') {
      return conflict('An approved clearance form cannot be changed. Unapprove it first.')
    }
    const parsed = await readBody(request, clearanceSchema)
    if (!parsed.success) return rejected(parsed.error)
    const input = { ...parsed.data, endOfEmploymentId: existing.endOfEmploymentId }
    const problem = clearanceProblem(input, existing.id)
    if (problem) return problem
    const form: ClearanceForm = {
      ...existing,
      ...input,
      lines: input.lines.map((line, index) => ({
        id: existing.lines[index]?.id ?? createId('cl'),
        ...line,
      })),
    }
    clearances.update(existing.id, form)
    return ok(clearanceDetail(form))
  }),
  http.delete(base('/clearances/:id'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const form = clearances.find(String(params.id))
    if (!form) return notFound('clearance form')
    if (form.status === 'approved') {
      return conflict('An approved clearance form cannot be deleted. Unapprove it first.')
    }
    linkToEndOfEmployment(form, false)
    clearances.remove(form.id)
    return ok({ id: form.id })
  }),
  http.post(base('/clearances/:action'), async ({ request, params }) => {
    const unauthorized = await authed(request)
    if (unauthorized) return unauthorized
    const action = String(params.action)
    if (action !== 'approve' && action !== 'unapprove') return notFound('action')
    const parsed = await readBody(
      request,
      z.object({ ids: z.array(z.string()).min(1, 'Tick the forms first') }),
    )
    if (!parsed.success) return rejected(parsed.error)
    let changed = 0
    for (const id of parsed.data.ids) {
      const form = clearances.find(id)
      if (!form) continue
      if (action === 'approve' && form.status === 'pending') {
        approve(form)
        changed += 1
      } else if (action === 'unapprove' && form.status === 'approved') {
        unapprove(form)
        changed += 1
      }
    }
    if (changed === 0) {
      return invalid(
        action === 'approve'
          ? 'None of the ticked forms is pending.'
          : 'None of the ticked forms is approved.',
      )
    }
    return ok({ changed })
  }),
]

export const assetHandlers = [
  ...lookupHandlers,
  ...typeHandlers,
  ...itemHandlers,
  ...allocationHandlers,
  ...clearanceHandlers,
]
