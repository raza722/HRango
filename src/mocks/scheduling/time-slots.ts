import { createMockCollection } from '../collection'

/*
 * Time slots and break types of the mock API (Scheduling settings). Kept free of other
 * mock imports so Roster and Scheduling can both read them without an import cycle.
 */

export interface MockSlotBreak {
  id: string
  breakTypeId: string
  /** `HH:mm`. */
  startTime: string
  endTime: string
  isInclusive: boolean
}

export interface MockTimeSlot {
  id: string
  code: string
  name: string
  color: string | null
  /** `HH:mm`; an end at or before the start ends the next day. */
  startTime: string
  endTime: string
  isFlexible: boolean
  /** Flexible slots only; fixed slots work it out from the times and breaks. */
  workableMinutes: number | null
  fullOvertime: boolean
  shortOvertime: boolean
  breaks: MockSlotBreak[]
  createdAt: string
}

export interface MockBreakType {
  id: string
  name: string
  startIdentifier: string
  endIdentifier: string
  createdAt: string
}

const created = () => new Date(Date.now() - 120 * 86_400_000).toISOString()

export function seedBreakTypes(): MockBreakType[] {
  const type = (id: string, name: string, key: string): MockBreakType => ({
    id,
    name,
    startIdentifier: `${key}-OUT`,
    endIdentifier: `${key}-IN`,
    createdAt: created(),
  })
  return [
    type('bt_lunch', 'Lunch Break', 'LB'),
    type('bt_prayer', 'Prayer Break', 'PB'),
    type('bt_rest', 'Rest Break', 'RB'),
  ]
}

/**
 * The slots behind the seeded roster groups. A slot that matches a whole group keeps the
 * group's id (`rg_morning` …): the payroll mock treats roster groups as time slots, so both
 * mocks agree on those ids.
 */
export function seedTimeSlots(): MockTimeSlot[] {
  let next = 0
  const slot = (
    id: string,
    name: string,
    startTime: string,
    endTime: string,
    extra: Partial<MockTimeSlot> = {},
  ): MockTimeSlot => {
    next += 1
    return {
      id,
      code: `TS-${String(next).padStart(5, '0')}`,
      name,
      color: null,
      startTime,
      endTime,
      isFlexible: false,
      workableMinutes: null,
      fullOvertime: false,
      shortOvertime: false,
      breaks: [],
      createdAt: created(),
      ...extra,
    }
  }
  return [
    slot('rg_morning', 'Morning Work', '09:00', '17:00', {
      color: '#fecdd3',
      breaks: [
        {
          id: 'tsb_morning_lunch',
          breakTypeId: 'bt_lunch',
          startTime: '13:00',
          endTime: '14:00',
          isInclusive: false,
        },
      ],
    }),
    slot('rg_hybrid', 'Hybrid Work', '16:15', '18:15', { color: '#fed7aa' }),
    slot('ts_hybrid_eve', 'Hybrid Evening', '20:10', '21:15', { color: '#d9f99d' }),
    slot('rg_flexible', 'Flexible working', '10:00', '16:00', {
      color: '#e7e5e4',
      isFlexible: true,
      workableMinutes: 300,
    }),
    slot('ts_flexible_short', 'Flexible short day', '10:00', '13:00', { color: '#e7e5e4' }),
    slot('rg_swing', 'Swing Shift Doctors', '16:00', '00:30', {
      color: '#f5d0fe',
      fullOvertime: true,
    }),
    slot('rg_part', 'Part Time', '09:00', '13:00', { color: '#bae6fd' }),
  ]
}

export const timeSlots = createMockCollection<MockTimeSlot>({
  storageKey: 'hrms-mock-time-slots',
  seed: seedTimeSlots,
})

export const breakTypes = createMockCollection<MockBreakType>({
  storageKey: 'hrms-mock-break-types',
  seed: seedBreakTypes,
})

export function resetTimeSlotsDb(): void {
  timeSlots.reset()
  breakTypes.reset()
}

const MINUTES_PER_DAY = 24 * 60

export function clockMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':')
  return Number(hours) * 60 + Number(minutes)
}

/** Clock in to clock out; an end at or before the start is the next day. */
export function spanOf(startTime: string, endTime: string): number {
  return (
    (clockMinutes(endTime) - clockMinutes(startTime) + MINUTES_PER_DAY) % MINUTES_PER_DAY ||
    MINUTES_PER_DAY
  )
}

export const isOvernightSlot = (slot: Pick<MockTimeSlot, 'startTime' | 'endTime'>) =>
  clockMinutes(slot.endTime) <= clockMinutes(slot.startTime)

/** Minutes worked on a slot: flexible slots plan their workable minutes. */
export function workableMinutesOf(slot: MockTimeSlot): number {
  if (slot.isFlexible && slot.workableMinutes !== null) return slot.workableMinutes
  const unpaid = slot.breaks
    .filter((item) => !item.isInclusive)
    .reduce((sum, item) => sum + spanOf(item.startTime, item.endTime), 0)
  return Math.max(0, spanOf(slot.startTime, slot.endTime) - unpaid)
}

/** The slot with these clock times (the old mock records keep times, not slot ids). */
export function slotByTimes(
  clockIn: string | null,
  clockOut: string | null,
): MockTimeSlot | undefined {
  if (!clockIn || !clockOut) return undefined
  return timeSlots.all().find((slot) => slot.startTime === clockIn && slot.endTime === clockOut)
}

/** `HH:mm` → `HH:mm:ss`, as the API writes times. */
export const apiTime = (time: string) => (time.length === 5 ? `${time}:00` : time)
