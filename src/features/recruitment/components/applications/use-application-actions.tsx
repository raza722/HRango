import { useState } from 'react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import type { RowAction } from '@/components/layout'
import { useCan } from '@/lib/permissions'

import { RC_CODES } from '../../constants'
import { useDeleteApplication, useWithdrawApplication } from '../../hooks/use-recruitment'
import type { Application, MoveStage } from '../../types/recruitment.types'
import { isClosedStage } from '../../utils/stages'
import { InterviewFormDialog } from '../interviews/interview-form-dialog'
import { OfferFormDialog } from '../offers/offer-form-dialog'
import { RemarksDialog } from '../shared/remarks-dialog'
import { HireFromRow, MoveDialog, RejectDialog } from './application-dialogs'

type Kind = 'move' | 'reject' | 'withdraw' | 'hire' | 'interview' | 'offer' | 'delete'

interface Open {
  kind: Kind
  application: Application
  stage?: MoveStage | undefined
}

const OPEN_OFFER = new Set(['draft', 'sent', 'accepted'])

/**
 * The pipeline's actions on an application, shared by the board, the list and the detail:
 * `actionsFor(application)` lists what its stage and the user's permissions allow (Move,
 * Schedule Interview, Make Offer, Hire, Reject, Withdraw, Delete), `open(kind, application)` starts
 * one directly (a board drop), and `dialogs` renders the one in progress.
 */
export function useApplicationActions({
  onOpenDetail,
}: {
  /** After a hire: show the application (with the link to the new employee). */
  onOpenDetail: (applicationId: string) => void
}) {
  const canMove = useCan(RC_CODES.applicationsMove)
  const canReject = useCan(RC_CODES.applicationsReject)
  const canWithdraw = useCan(RC_CODES.applicationsWithdraw)
  const canHire = useCan(RC_CODES.applicationsHire)
  const canDelete = useCan(RC_CODES.applicationsDelete)
  const canInterview = useCan(RC_CODES.interviewsCreate)
  const canOffer = useCan(RC_CODES.offersCreate)
  const [current, setCurrent] = useState<Open | null>(null)
  const withdraw = useWithdrawApplication()
  const remove = useDeleteApplication()

  const open = (kind: Kind, application: Application, stage?: MoveStage) => {
    setCurrent({ kind, application, stage })
  }
  const close = () => {
    setCurrent(null)
  }

  const actionsFor = (application: Application): RowAction[] => {
    const items: RowAction[] = []
    const active = !isClosedStage(application)
    if (active && canMove)
      items.push({
        label: 'Move Stage',
        onSelect: () => {
          open('move', application)
        },
      })
    if (active && canInterview) {
      items.push({
        label: 'Schedule Interview',
        onSelect: () => {
          open('interview', application)
        },
      })
    }
    if (active && canOffer && !OPEN_OFFER.has(application.latestOfferStatus ?? '')) {
      items.push({
        label: 'Make Offer',
        onSelect: () => {
          open('offer', application)
        },
      })
    }
    if (active && canHire)
      items.push({
        label: 'Hire',
        onSelect: () => {
          open('hire', application)
        },
      })
    if (active && canWithdraw) {
      items.push({
        label: 'Withdraw',
        onSelect: () => {
          open('withdraw', application)
        },
      })
    }
    if (active && canReject) {
      items.push({
        label: 'Reject',
        variant: 'destructive',
        onSelect: () => {
          open('reject', application)
        },
      })
    }
    if (
      canDelete &&
      application.stage !== 'hired' &&
      application.interviewCount === 0 &&
      !application.latestOfferId
    ) {
      items.push({
        label: 'Delete',
        variant: 'destructive',
        onSelect: () => {
          open('delete', application)
        },
      })
    }
    return items
  }

  const application = current?.application
  const dialogs = application ? (
    <>
      {current.kind === 'move' && (
        <MoveDialog application={application} stage={current.stage} onClose={close} />
      )}
      {current.kind === 'reject' && <RejectDialog application={application} onClose={close} />}
      {current.kind === 'withdraw' && (
        <RemarksDialog
          title="Withdraw Application"
          intro={`${application.applicantName} no longer wants ${application.jobOpeningTitle}. The application leaves the pipeline.`}
          saveLabel="Withdraw"
          saving={withdraw.isPending}
          onSubmit={(remarks) => withdraw.mutateAsync({ record: application, remarks })}
          onClose={close}
        />
      )}
      {current.kind === 'hire' && (
        <HireFromRow
          application={application}
          onClose={close}
          onHired={(hired) => {
            close()
            onOpenDetail(hired.id)
          }}
        />
      )}
      {current.kind === 'interview' && (
        <InterviewFormDialog
          id={null}
          application={{
            id: application.id,
            label: `${application.applicantName} · ${application.jobOpeningTitle}`,
          }}
          onClose={close}
        />
      )}
      {current.kind === 'offer' && (
        <OfferFormDialog id={null} application={application} onClose={close} />
      )}
      <ConfirmDialog
        open={current.kind === 'delete'}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        title="Delete application"
        description={`Delete ${application.applicantName}'s application for ${application.jobOpeningTitle}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          remove.mutate(application)
          close()
        }}
      />
    </>
  ) : null

  return { actionsFor, open, dialogs, canMove }
}
