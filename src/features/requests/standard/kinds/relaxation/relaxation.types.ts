/** A Relaxation request: time off inside the person's shift on one day. */
export interface RelaxationPayload {
  date: string
  /** `HH:mm`. */
  startTime: string
  endTime: string
  reason: string
  /** The day's shift when the request was made. */
  slotName: string
  shiftIn: string
  shiftOut: string
  /** "Morning Work (09:00 AM - 05:00 PM)": the list's Time Slot. */
  timeSlot: string
  /** "01:00 PM - 05:00 PM". */
  time: string
  minutes: number
  /** "4h", "1h 30m". */
  duration: string
}

export interface RelaxationInput {
  employeeId?: string
  date: string
  startTime: string
  endTime: string
  reason: string
}
