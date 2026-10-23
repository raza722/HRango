import { Plus } from 'lucide-react'

import { EmployeeAvatar } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { btn, toolbarButton } from '@/features/payroll'
import { cn } from '@/lib/utils'

import type { PersonRef } from '../../types/requests.types'
import { personCodeText, personNameText } from '../shared/request-styles'

/** The navy "+ Create" of the Settings lists. */
export function CreateButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick} className={cn(toolbarButton, btn.navy, 'gap-1')}>
      <Plus aria-hidden="true" className="size-3.5" />
      Create
    </Button>
  )
}

/** A person with their code under the name, as in the Request Flow table. */
export function PersonWithCode({ person }: { person: PersonRef }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <EmployeeAvatar name={person.name} photoUrl={null} className="size-6 shrink-0" />
      <span className="min-w-0">
        <span className={cn('block truncate', personNameText)}>{person.name}</span>
        <span className={cn('block truncate', personCodeText)}>{person.code}</span>
      </span>
    </span>
  )
}
