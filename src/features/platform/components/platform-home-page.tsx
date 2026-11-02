import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PRODUCT_LOGO, PRODUCT_NAME } from '@/lib/brand'
import { formatDateTime } from '@/lib/date'
import { type StaffRole, usePlatformStore } from '@/stores/platform-store'

import { usePlatformLogout, useStaffAudit, useStaffList } from '../hooks/use-platform'

const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  support: 'Support',
  billing: 'Billing',
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold text-heading">{title}</h2>
      {children}
    </section>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

/** Home of the staff area. Support and Billing have no lists yet; those arrive with customers. */
export function PlatformHomePage() {
  const staff = usePlatformStore((state) => state.staff)
  const logout = usePlatformLogout()
  const canReadStaff = staff?.role === 'super_admin' || staff?.role === 'admin'
  const team = useStaffList(canReadStaff)
  const audit = useStaffAudit(canReadStaff)

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-card px-4 py-3 sm:px-6">
        <img
          src={PRODUCT_LOGO.fullColor}
          alt={PRODUCT_NAME}
          className="h-8 w-auto"
          width={97}
          height={32}
        />
        <div className="flex items-center gap-3">
          <p className="text-right text-sm">
            <span className="block font-medium text-heading">{staff?.displayName}</span>
            <span className="block text-muted-foreground">
              {staff ? ROLE_LABELS[staff.role] : ''}
            </span>
          </p>
          <Button variant="outline" onClick={() => void logout()}>
            <LogOut />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold text-heading">{PRODUCT_NAME} staff</h1>

        {!canReadStaff ? (
          <Section title="Welcome">
            <Note>Nothing here for your role yet. Customer tools come next.</Note>
          </Section>
        ) : (
          <>
            <Section title="Staff">
              {team.isError ? (
                <Note>Could not load the staff list.</Note>
              ) : team.isPending ? (
                <Note>Loading…</Note>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last sign-in</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team.data.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.displayName}</TableCell>
                        <TableCell>{row.email}</TableCell>
                        <TableCell>{ROLE_LABELS[row.role]}</TableCell>
                        <TableCell>{row.isActive ? 'Active' : 'Disabled'}</TableCell>
                        <TableCell>
                          {row.lastLoginAt ? formatDateTime(row.lastLoginAt) : 'Never'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Section>

            <Section title="Recent activity">
              {audit.isError ? (
                <Note>Could not load the activity.</Note>
              ) : audit.isPending ? (
                <Note>Loading…</Note>
              ) : audit.data.length === 0 ? (
                <Note>Nothing recorded yet.</Note>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Who</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.data.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                        <TableCell>{row.staffName ?? '—'}</TableCell>
                        <TableCell>{row.actionName}</TableCell>
                        <TableCell>{row.entityRef ?? row.entityType ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Section>
          </>
        )}
      </main>
    </div>
  )
}
