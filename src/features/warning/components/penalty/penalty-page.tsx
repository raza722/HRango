import { useState } from 'react'
import { FormProvider } from 'react-hook-form'
import { getRouteApi } from '@tanstack/react-router'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { PageContainer, PageHeader, splitPageClassName } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { usePenaltyForm } from '../../hooks/use-penalty-form'
import { PENALTY_FORM_ID } from '../../penalty-constants'
import { warningType } from '../type-styles'
import { PenaltyDetailsCard, PenaltyRulesCard } from './penalty-form-cards'
import { PenaltyTable } from './penalty-table'

const routeApi = getRouteApi('/_app/warning/penalty/')

type PendingConfirm = { kind: 'leave' } | { kind: 'policy'; policyId: string } | null

/**
 * Warning → Penalty screen ("Warning Policy" in the design): pick a warning policy, set its
 * penalty rules, save them together. `?edit=` is the policy's id, `?page=` the list's page.
 */
export function PenaltyPage() {
  const { page, edit } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null)
  const canSave = useCan('warning.settings.penalties.edit')

  const penaltyForm = usePenaltyForm({ editingId: edit })
  const { form, rules } = penaltyForm
  const { isDirty } = form.formState

  const openPolicy = (policyId: string | undefined) => {
    penaltyForm.resetToNew()
    void navigate({ search: (prev) => ({ ...prev, edit: policyId }) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const leave = () => {
    penaltyForm.resetToNew()
    void navigate({ to: '/warning' })
  }

  return (
    <PageContainer>
      <div className={splitPageClassName}>
        <PageHeader
          className={cn('@[90rem]/page:col-span-2', warningType.pageHeader)}
          title="Warning Policy"
          description="Penalties applied when a warning policy is broken."
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  if (isDirty) setPendingConfirm({ kind: 'leave' })
                  else leave()
                }}
              >
                <ArrowLeft /> Cancel
              </Button>
              {canSave && (
                <Button
                  type="submit"
                  form={PENALTY_FORM_ID}
                  disabled={penaltyForm.isSaving || penaltyForm.isLoadingPenalty || !edit}
                >
                  {penaltyForm.isSaving ? <Loader2 className="animate-spin" /> : <Check />}
                  {penaltyForm.isSaving ? 'Saving…' : 'Save'}
                </Button>
              )}
            </>
          }
        />

        <FormProvider {...form}>
          <form
            id={PENALTY_FORM_ID}
            noValidate
            aria-label="Penalties of a warning policy"
            onSubmit={penaltyForm.submit}
            className={cn('flex min-w-0 flex-col gap-4 sm:gap-5', warningType.form)}
          >
            <PenaltyDetailsCard
              policy={edit ? penaltyForm.editingPolicy : undefined}
              isLoading={penaltyForm.isLoadingPenalty}
              onPolicyChange={(policyId) => {
                if (policyId === edit) return
                if (isDirty && edit) setPendingConfirm({ kind: 'policy', policyId })
                else openPolicy(policyId)
              }}
            />
            <PenaltyRulesCard
              rules={rules.fields}
              onAddRule={penaltyForm.addRule}
              onRemoveRule={rules.remove}
              disabled={!edit || penaltyForm.isLoadingPenalty || !canSave}
            />
          </form>
        </FormProvider>

        <div className="min-w-0 @[90rem]/page:sticky @[90rem]/page:top-[6.25rem] @[90rem]/page:max-h-[calc(100dvh-7.5rem)] @[90rem]/page:overflow-y-auto">
          <PenaltyTable
            collapsible
            page={page}
            onPageChange={(next) => {
              void navigate({ search: (prev) => ({ ...prev, page: next }) })
            }}
            onEdit={(penalty) => {
              if (penalty.warningPolicyId === edit) return
              if (isDirty && edit) {
                setPendingConfirm({ kind: 'policy', policyId: penalty.warningPolicyId })
              } else openPolicy(penalty.warningPolicyId)
            }}
          />
        </div>
      </div>

      <ConfirmDialog
        open={pendingConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setPendingConfirm(null)
        }}
        title="Discard your changes?"
        description="The penalty form has unsaved changes. They will be lost."
        confirmLabel="Discard"
        variant="destructive"
        onConfirm={() => {
          if (pendingConfirm?.kind === 'policy') openPolicy(pendingConfirm.policyId)
          else leave()
          setPendingConfirm(null)
        }}
      />
    </PageContainer>
  )
}
