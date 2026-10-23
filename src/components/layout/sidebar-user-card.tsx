import { Link } from '@tanstack/react-router'
import { ChevronDown, LogOut, Settings } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, getInitials } from '@/lib/utils'
import type { AuthUser } from '@/types/auth'

interface SidebarUserCardProps {
  user: AuthUser | null
  collapsed: boolean
  onSignOut: () => void
}

export function SidebarUserCard({ user, collapsed, onSignOut }: SidebarUserCardProps) {
  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${user.name}`}
        className={cn(
          'flex w-full shrink-0 items-center gap-3 border-b border-sidebar-border px-6 py-5 text-left transition-colors outline-none hover:bg-sidebar-hover focus-visible:bg-sidebar-hover',
          collapsed && 'justify-center px-0',
        )}
      >
        <Avatar className="size-10 ring-2 ring-white/10">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              {/* Figma: Poppins Medium 16 white, Poppins Light 11 #D1D4D8. */}
              <span className="block truncate text-base font-medium text-sidebar-foreground">
                {user.name}
              </span>
              <span className="block truncate text-[0.6875rem] font-light text-sidebar-subtle">
                {user.role}
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-sidebar-muted" aria-hidden="true" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={collapsed ? 'right' : 'bottom'} className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium text-heading">{user.name}</span>
          <span className="block truncate">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onSignOut}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
