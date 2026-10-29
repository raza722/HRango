import { Link } from '@tanstack/react-router'

import { useCan } from '@/lib/permissions'

import { DEVICE_CODES } from '../../hooks/use-devices'

/**
 * Attendance Logs' Machine cell: the machine's name, then its code once (some machines are
 * named with it already). It opens the device in Settings → Biometric Devices for those who
 * may see the devices.
 */
export function DeviceMachineCell({
  deviceId,
  deviceCode,
  deviceName,
}: {
  deviceId: string | null
  deviceCode: string | null
  deviceName: string | null
}) {
  const canView = useCan(DEVICE_CODES.view)
  if (!deviceId) return '—'
  const name = deviceName ?? 'Machine'
  const code = deviceCode && !name.includes(deviceCode) ? deviceCode : null
  const content = (
    <>
      {name}
      {code && (
        <>
          {' '}
          <span className="block">({code})</span>
        </>
      )}
    </>
  )
  return canView ? (
    <Link
      to="/settings/biometric-devices"
      search={{ device: deviceId }}
      className="block w-fit rounded-sm leading-tight underline-offset-2 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {content}
    </Link>
  ) : (
    <span className="leading-tight">{content}</span>
  )
}
