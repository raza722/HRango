import { VOUCHER_STATUS_LABELS } from '../../constants'
import type { VoucherStatus } from '../../types/payroll.types'
import { StatusChip } from '../shared/status-chip'

const CLASSES: Record<VoucherStatus, string> = {
  pending: 'bg-[#FFF1DE] text-[#FF8A1D]',
  approved: 'bg-[#DCE8FF] text-[#2975FB]',
  rejected: 'bg-[#FFE1E7] text-[#E50141]',
  processed: 'bg-[#E3F8E8] text-[#51B969]',
}

/** pending → approved / rejected → processed ("Verified" by Finance). */
export function VoucherStatusChip({ status }: { status: VoucherStatus }) {
  return <StatusChip label={VOUCHER_STATUS_LABELS[status]} className={CLASSES[status]} />
}
