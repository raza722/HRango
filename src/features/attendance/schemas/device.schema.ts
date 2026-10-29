import { z } from 'zod'

import type { BiometricDevice, DeviceInput, EnrolmentInput } from '../types/devices.types'
import { DEVICE_STATUSES } from '../types/devices.types'

/** Four numbers 0–255, no leading zeros: `192.168.10.201`. */
export const IPV4 = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/

/** The port most biometric devices listen on. */
export const DEFAULT_DEVICE_PORT = '4370'

const isPort = (value: string) =>
  /^\d{1,5}$/.test(value) && Number(value) >= 1 && Number(value) <= 65535

/** Add / Edit device (`DeviceIn`). Only the name is required, as in the API. */
export const deviceFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter the device name')
      .max(200, 'Keep the name under 200 characters'),
    model: z.string().trim().max(100, 'Keep the model under 100 characters'),
    serialNo: z.string().trim().max(50, 'Keep the serial no under 50 characters'),
    ipAddress: z
      .string()
      .trim()
      .refine(
        (value) => value === '' || IPV4.test(value),
        'Enter an IPv4 address such as 192.168.1.201',
      ),
    port: z
      .string()
      .trim()
      .refine((value) => value === '' || isPort(value), 'Enter a port from 1 to 65535'),
    branchId: z.string(),
    address: z.string().trim().max(500, 'Keep the address under 500 characters'),
    status: z.enum(DEVICE_STATUSES),
  })
  .superRefine((values, ctx) => {
    // A connector reaches the device at IP:port, so an address needs its port.
    if (values.ipAddress !== '' && values.port === '') {
      ctx.addIssue({ code: 'custom', path: ['port'], message: 'Enter the port of this IP address' })
    }
  })
export type DeviceFormValues = z.input<typeof deviceFormSchema>

export const emptyDeviceValues = (): DeviceFormValues => ({
  name: '',
  model: '',
  serialNo: '',
  ipAddress: '',
  port: DEFAULT_DEVICE_PORT,
  branchId: '',
  address: '',
  status: 'active',
})

export const toDeviceValues = (device: BiometricDevice): DeviceFormValues => ({
  name: device.name,
  model: device.model ?? '',
  serialNo: device.serialNo ?? '',
  ipAddress: device.ipAddress ?? '',
  port: device.port === null ? '' : String(device.port),
  branchId: device.branchId ?? '',
  address: device.address ?? '',
  status: device.status,
})

/** Form values → `DeviceIn`: blanks as null, the port as a number. */
export function toDeviceInput(values: DeviceFormValues, rowVersion?: string): DeviceInput {
  const text = (value: string) => (value.trim() === '' ? null : value.trim())
  return {
    name: values.name.trim(),
    model: text(values.model),
    serialNo: text(values.serialNo),
    ipAddress: text(values.ipAddress),
    port: values.port.trim() === '' ? null : Number(values.port),
    branchId: values.branchId || null,
    address: text(values.address),
    status: values.status,
    ...(rowVersion ? { rowVersion } : {}),
  }
}

/** API field → form field, for 422 answers. */
export const DEVICE_FIELD_OF: Record<string, keyof DeviceFormValues> = {
  name: 'name',
  model: 'model',
  serialNo: 'serialNo',
  ipAddress: 'ipAddress',
  port: 'port',
  branchId: 'branchId',
  address: 'address',
  status: 'status',
}

// --- enrolments ------------------------------------------------------------------------------

const enrolmentRowSchema = z.object({
  employeeId: z.string().min(1),
  employeeCode: z.string(),
  employeeName: z.string(),
  deviceUserNo: z
    .string()
    .trim()
    .min(1, 'Enter the device user no')
    .max(30, 'Keep it to 30 digits')
    .regex(/^\d+$/, 'Use digits only'),
  /** When the person was enrolled; null for a row added here and not saved yet. */
  createdAt: z.string().nullable(),
})
export type EnrolmentRow = z.infer<typeof enrolmentRowSchema>

/** "Omar", "Omar and Sara", "Omar, Sara and Kamal". */
const names = (list: readonly string[]) =>
  list.length <= 1 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list.at(-1) ?? ''}`

/**
 * Everyone on a device: user numbers are digits and unique on the device (every row sharing a
 * number is marked, naming the others); nobody twice.
 */
export const enrolmentsFormSchema = z
  .object({ rows: z.array(enrolmentRowSchema) })
  .superRefine(({ rows }, ctx) => {
    const byNumber = new Map<string, number[]>()
    const people = new Set<string>()
    rows.forEach((row, index) => {
      if (people.has(row.employeeId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['rows', index, 'employeeId'],
          message: `${row.employeeName} is listed twice`,
        })
      }
      people.add(row.employeeId)
      const number = row.deviceUserNo.trim()
      byNumber.set(number, [...(byNumber.get(number) ?? []), index])
    })
    for (const [number, indexes] of byNumber) {
      if (indexes.length < 2) continue
      for (const index of indexes) {
        const others = indexes
          .filter((other) => other !== index)
          .map((other) => rows[other]?.employeeName ?? '')
        ctx.addIssue({
          code: 'custom',
          path: ['rows', index, 'deviceUserNo'],
          message: `${number} is also ${names(others)}'s number`,
        })
      }
    }
  })
export type EnrolmentsFormValues = z.infer<typeof enrolmentsFormSchema>

export const toEnrolmentInputs = (rows: readonly EnrolmentRow[]): EnrolmentInput[] =>
  rows.map((row) => ({ employeeId: row.employeeId, deviceUserNo: row.deviceUserNo.trim() }))

/** The next free user number after the highest one in use (1 on an empty device). */
export function nextUserNo(rows: readonly Pick<EnrolmentRow, 'deviceUserNo'>[]): string {
  const highest = rows.reduce((max, row) => {
    const value = /^\d{1,15}$/.test(row.deviceUserNo.trim()) ? Number(row.deviceUserNo) : 0
    return Math.max(max, value)
  }, 0)
  return String(highest + 1)
}
