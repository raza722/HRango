import { describe, expect, it } from 'vitest'

import { formatDuration, formatMinutes, isOvernight, shiftMinutes, toMinutes } from './shift-time'

describe('shift time maths', () => {
  it('reads HH:mm and rejects anything else', () => {
    expect(toMinutes('16:15')).toBe(975)
    expect(toMinutes('24:00')).toBeNull()
    expect(toMinutes('')).toBeNull()
  })

  it('measures a shift, wrapping past midnight', () => {
    expect(shiftMinutes('16:15', '18:15')).toBe(120)
    expect(shiftMinutes('20:10', '21:15')).toBe(65)
    expect(shiftMinutes('22:00', '06:00')).toBe(480)
    expect(isOvernight('22:00', '06:00')).toBe(true)
    expect(isOvernight('09:00', '17:00')).toBe(false)
    expect(shiftMinutes('09:00', null)).toBeNull()
  })

  it('formats minutes as drawn and as a short duration', () => {
    expect(formatMinutes(120)).toBe('120 minutes')
    expect(formatMinutes(1)).toBe('1 minute')
    expect(formatDuration(65)).toBe('1h 5m')
    expect(formatDuration(480)).toBe('8h')
  })
})
