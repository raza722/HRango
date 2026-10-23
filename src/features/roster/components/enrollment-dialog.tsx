import { useState } from 'react'
import { useIsMutating } from '@tanstack/react-query'
import { Loader2, UserPlus } from 'lucide-react'

import { dialogButtonClass } from '@/components/feedback/app-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import { ENROLLMENT_STATUS_LABELS } from '../constants'
import { enrollMutationKey } from '../hooks/use-roster-enrollments'
import { useRosterGroup } from '../hooks/use-roster-groups'
import { ENROLLMENT_STATUSES, type EnrollmentStatus } from '../types/roster.types'
import { ENROLL_FORM_ID, EnrollForm } from './enroll-form'
import { EnrollmentList } from './enrollment-list'
import { RosterDialogShell } from './roster-dialog-shell'
import { rosterType } from './type-styles'

interface EnrollmentDialogProps {
  groupId: string
  onClose: () => void
}

/**
 * "Enroll Employee in … Roster": who is on the roster (Active / Discontinued)
 * and the form to enroll more, in one modal.
 */
export function EnrollmentDialog({ groupId, onClose }: EnrollmentDialogProps) {
  const group = useRosterGroup(groupId)
  const [view, setView] = useState<'list' | 'enroll'>('list')
  const [tab, setTab] = useState<EnrollmentStatus>('active')
  const saving = useIsMutating({ mutationKey: enrollMutationKey(groupId) }) > 0

  const title = group.data
    ? view === 'enroll'
      ? `Enroll Employees in “${group.data.title}” Roster`
      : `Enroll Employee in “${group.data.title}” Roster`
    : 'Enroll Employee'

  const footer =
    view === 'enroll' ? (
      <>
        <Button
          type="submit"
          form={ENROLL_FORM_ID}
          variant="success"
          size="lg"
          disabled={saving}
          className={dialogButtonClass}
        >
          {saving && <Loader2 className="animate-spin" />}
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button
          variant="destructive"
          size="lg"
          disabled={saving}
          onClick={() => {
            setView('list')
          }}
          className={dialogButtonClass}
        >
          Cancel
        </Button>
      </>
    ) : (
      <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
        Close
      </Button>
    )

  return (
    <RosterDialogShell title={title} onRequestClose={onClose} footer={footer} className="max-w-6xl">
      {group.error && !group.data ? (
        <ErrorState
          message={group.error.message}
          onRetry={() => {
            void group.refetch()
          }}
          className="shadow-none"
        />
      ) : !group.data ? (
        <div aria-busy="true" className="grid gap-4">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : view === 'enroll' ? (
        <EnrollForm
          groupId={groupId}
          onBack={() => {
            setView('list')
            setTab('active')
          }}
        />
      ) : (
        <div className="grid gap-5">
          <Button
            onClick={() => {
              setView('enroll')
            }}
            className={cn(
              'w-fit bg-pager-active text-white hover:bg-pager-active/90',
              rosterType.button,
            )}
          >
            <UserPlus /> Enroll New Employee
          </Button>
          <Tabs
            value={tab}
            onValueChange={(next) => {
              setTab(next === 'discontinued' ? 'discontinued' : 'active')
            }}
          >
            <TabsList aria-label="Enrollment status">
              {ENROLLMENT_STATUSES.map((status) => (
                <TabsTrigger key={status} value={status}>
                  {ENROLLMENT_STATUS_LABELS[status]}
                </TabsTrigger>
              ))}
            </TabsList>
            {ENROLLMENT_STATUSES.map((status) => (
              <TabsContent key={status} value={status}>
                <EnrollmentList groupId={groupId} status={status} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}
    </RosterDialogShell>
  )
}
