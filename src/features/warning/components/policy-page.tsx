import { useState } from 'react'
import { FormProvider } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { PageContainer, PageHeader, splitPageClassName } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import type { Paginated } from '@/types/api'

import { warningPolicyKeys } from '../api/warning-policy.queries'
import { POLICY_FORM_ID } from '../constants'
import { usePolicyForm } from '../hooks/use-policy-form'
import { usePolicyTablePrefs } from '../store/policy-table-prefs.store'
import type { WarningPolicy } from '../types/warning-policy.types'
import { PolicyFormCard } from './policy-form-card'
import { PolicyRulesCard } from './policy-rules-card'
import { PolicyTable } from './policy-table'
import { warningType } from './type-styles'

const routeApi = getRouteApi('/_app/warning/policy/')

type PendingConfirm = 'leave' | 'new' | null

/**
 * Warning → Policy screen: header card, policy form, rules card and the
 * Warning Policy table. Saving needs `warning.settings.policies.create` (new) or `.edit`. Page number and the policy being edited live in the
 * URL (`?page=2&edit=wp_123`), so both survive reloads and can be shared.
 */
export function PolicyPage() {
  const { page, edit } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const queryClient = useQueryClient()
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null)

  const leaveEditMode = () =>
    navigate({ search: (prev) => ({ ...prev, edit: undefined }), replace: true })

  const policyForm = usePolicyForm({
    editingId: edit,
    onSaved: async (mode) => {
      if (mode === 'updated') {
        await leaveEditMode()
        return
      }
      // New policies are listed last; show the page they landed on. The lists
      // were refetched before this runs, so the cached total is current.
      const { pageSize } = usePolicyTablePrefs.getState()
      const lastPage = queryClient.getQueryData<Paginated<WarningPolicy>>(
        warningPolicyKeys.list({ page, pageSize }),
      )?.meta.totalPages
      if (lastPage !== undefined && lastPage !== page) {
        await navigate({ search: (prev) => ({ ...prev, page: lastPage }) })
      }
    },
  })
  const { form, rules } = policyForm
  const { isDirty } = form.formState
  const canCreate = useCan('warning.settings.policies.create')
  const canEdit = useCan('warning.settings.policies.edit')
  const canSave = edit ? canEdit : canCreate

  const discard = () => {
    policyForm.resetToNew()
    if (edit) void leaveEditMode()
  }

  const startNewPolicy = () => {
    discard()
    form.setFocus('title')
  }

  /** "← Cancel": back to the Warning overview. */
  const leave = () => {
    policyForm.resetToNew()
    void navigate({ to: '/warning' })
  }

  const editPolicy = (policy: WarningPolicy) => {
    void navigate({ search: (prev) => ({ ...prev, edit: policy.id }) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <PageContainer>
      <div className={splitPageClassName}>
        <PageHeader
          className={cn('@[90rem]/page:col-span-2', warningType.pageHeader)}
          title="Policy"
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
              {canSave && (
                <Button
                  type="submit"
                  form={POLICY_FORM_ID}
                  disabled={policyForm.isSaving || policyForm.isLoadingPolicy}
                >
                  {policyForm.isSaving ? <Loader2 className="animate-spin" /> : <Check />}
                  {policyForm.isSaving ? 'Saving…' : 'Save'}
                </Button>
              )}
            </>
          }
        />

        <FormProvider {...form}>
          <form
            id={POLICY_FORM_ID}
            noValidate
            aria-label={edit ? 'Edit warning policy' : 'New warning policy'}
            onSubmit={policyForm.submit}
            className={cn('flex min-w-0 flex-col gap-4 sm:gap-5', warningType.form)}
          >
            <PolicyFormCard
              onAddPolicy={
                canCreate
                  ? () => {
                      if (isDirty) setPendingConfirm('new')
                      else startNewPolicy()
                    }
                  : undefined
              }
              onAppliesToChange={policyForm.changeAppliesTo}
              editingTitle={edit ? policyForm.editingPolicy?.title : undefined}
              isLoadingPolicy={policyForm.isLoadingPolicy}
            />
            <PolicyRulesCard
              rules={rules.fields}
              onAddRule={policyForm.addRule}
              onRemoveRule={rules.remove}
              disabled={policyForm.isLoadingPolicy}
            />
          </form>
        </FormProvider>

        {/* Wide screens: the table sits beside the form and stays in view while it scrolls. */}
        <div className="min-w-0 @[90rem]/page:sticky @[90rem]/page:top-[6.25rem] @[90rem]/page:max-h-[calc(100dvh-7.5rem)] @[90rem]/page:overflow-y-auto">
          <PolicyTable
            page={page}
            onPageChange={(next) => {
              void navigate({ search: (prev) => ({ ...prev, page: next }) })
            }}
            onView={(policy) => {
              void navigate({ to: '/warning/policy/$policyId', params: { policyId: policy.id } })
            }}
            onEdit={editPolicy}
            onDelete={(policy) => {
              if (policy.id === edit) discard()
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
        description="The policy form has unsaved changes. They will be lost."
        confirmLabel="Discard"
        variant="destructive"
        onConfirm={() => {
          if (pendingConfirm === 'new') startNewPolicy()
          else leave()
          setPendingConfirm(null)
        }}
      />
    </PageContainer>
  )
}
