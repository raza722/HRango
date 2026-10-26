import { useState } from 'react'

import { PRODUCT_LOGO, PRODUCT_NAME } from '@/lib/brand'
import { cn, getInitials } from '@/lib/utils'
import type { AuthUser } from '@/types/auth'

interface OrganisationBrandProps {
  user: AuthUser | null
  collapsed: boolean
}

/**
 * The sidebar header: the brand of the organisation using hRango (its logo from General Settings,
 * or its initials and name when it has none). hRango's own mark appears only when no company is known.
 */
export function OrganisationBrand({ user, collapsed }: OrganisationBrandProps) {
  // A link that fails (expired, removed) falls back to the initials until a new one arrives.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)
  const name = user?.companyName ?? null
  const url = user?.companyLogoUrl ?? null
  const logo = url !== brokenUrl ? url : null

  if (logo) {
    return (
      <img
        src={logo}
        alt=""
        onError={() => {
          setBrokenUrl(logo)
        }}
        className={cn('object-contain', collapsed ? 'size-9' : 'h-[2.9375rem] max-w-[10rem]')}
      />
    )
  }
  if (!name) {
    return (
      <img
        src={collapsed ? PRODUCT_LOGO.iconWhite : PRODUCT_LOGO.fullWhite}
        alt={PRODUCT_NAME}
        className={collapsed ? 'size-9 object-contain' : 'h-7 w-auto'}
      />
    )
  }
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
      >
        {getInitials(name)}
      </span>
      {!collapsed && <span className="truncate text-base font-semibold">{name}</span>}
    </span>
  )
}

/** "Powered by hRango", at the foot of the sidebar. */
export function PoweredBy({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2 border-t border-sidebar-border text-xs text-sidebar-muted',
        collapsed ? 'justify-center py-3' : 'px-6 py-3',
      )}
    >
      <img src={PRODUCT_LOGO.iconWhite} alt="" className="h-4 w-auto opacity-80" />
      {!collapsed && (
        <span>
          Powered by <span className="font-semibold text-sidebar-foreground">{PRODUCT_NAME}</span>
        </span>
      )}
    </div>
  )
}
