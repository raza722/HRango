import { useState } from 'react'
import { FormProvider } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ArrowLeft, Check, Loader2, Plus } from 'lucide-react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { PageContainer, PageHeader, splitPageClassName } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Paginated } from '@/types/api'

import { warningPenaltyKeys } from '../../api/warning-penalty.api'
import { usePenaltyForm } from '../../hooks/use-penalty-form'
import { PENALTY_FORM_ID } from '../../penalty-constants'
import { usePolicyTablePrefs } from '../../store/policy-table-prefs.store'
import type { WarningPenalty } from '../../types/warning-penalty.types'
import { warningType } from '../type-styles'
import { PenaltyDetailsCard, PenaltyRulesCard } from './penalty-form-cards'
import { PenaltyTable } from './penalty-table'

const routeApi = getRouteApi('/_app/warning/penalty/')

type PendingConfirm = 'leave' | 'new' | null

/**
 * Warning → Penalty screen ("Warning Policy" in the design): the policy the
 * penalty belongs to, its penalty rules, and the Penalty list. `?page=` and
 * `?edit=` live in the URL like on the Policy screen.
 */
export function PenaltyPage() {
  const { page, edit } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const queryClient = useQueryClient()
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null)

  const leaveEditMode = () =>
    navigate({ search: (prev) => ({ ...prev, edit: undefined }), replace: true })

  const penaltyForm = usePenaltyForm({
    editingId: edit,
    onSaved: async (mode) => {
      if (mode === 'updated') {
        await leaveEditMode()
        return
      }
      const { pageSize } = usePolicyTablePrefs.getState()
      const lastPage = queryClient.getQueryData<Paginated<WarningPenalty>>(
        warningPenaltyKeys.list({ page, pageSize }),
      )?.meta.totalPages
      if (lastPage !== undefined && lastPage !== page) {
        await navigate({ search: (prev) => ({ ...prev, page: lastPage }) })
      }
    },
  })
  const { form, rules } = penaltyForm
  const { isDirty } = form.formState

  const startNew = () => {
    penaltyForm.resetToNew()
    if (edit) void leaveEditMode()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    form.setFocus('title')
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
                  if (isDirty) setPendingConfirm('leave')
                  else leave()
                }}
              >
                <ArrowLeft /> Cancel
              </Button>
              <Button
                type="submit"
                form={PENALTY_FORM_ID}
                disabled={penaltyForm.isSaving || penaltyForm.isLoadingPenalty}
              >
                {penaltyForm.isSaving ? <Loader2 className="animate-spin" /> : <Check />}
                {penaltyForm.isSaving ? 'Saving…' : 'Save'}
              </Button>
            </>
          }
        />

        <FormProvider {...form}>
          <form
            id={PENALTY_FORM_ID}
            noValidate
            aria-label={edit ? 'Edit penalty' : 'New penalty'}
            onSubmit={penaltyForm.submit}
            className={cn('flex min-w-0 flex-col gap-4 sm:gap-5', warningType.form)}
          >
            <PenaltyDetailsCard
              onAddPolicy={() => {
                if (isDirty) setPendingConfirm('new')
                else startNew()
              }}
              editingTitle={edit ? penaltyForm.editingPenalty?.title : undefined}
              isLoading={penaltyForm.isLoadingPenalty}
            />
            <PenaltyRulesCard
              rules={rules.fields}
              onAddRule={penaltyForm.addRule}
              onRemoveRule={rules.remove}
              disabled={penaltyForm.isLoadingPenalty}
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
              void navigate({ search: (prev) => ({ ...prev, edit: penalty.id }) })
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            onDelete={(penalty) => {
              if (penalty.id === edit) {
                penaltyForm.resetToNew()
                void leaveEditMode()
              }
            }}
            actions={
              <Button
                variant="outline"
                onClick={() => {
                  if (isDirty) setPendingConfirm('new')
                  else startNew()
                }}
              >
                <Plus /> Add Form
              </Button>
            }
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
          if (pendingConfirm === 'new') startNew()
          else leave()
          setPendingConfirm(null)
        }}
      />
    </PageContainer>
  )
}
