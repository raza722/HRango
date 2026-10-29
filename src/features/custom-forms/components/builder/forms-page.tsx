import { getRouteApi } from '@tanstack/react-router'

import { PageContainer } from '@/components/layout'
import { useCan } from '@/lib/permissions'

import { CF_CODES } from '../../constants'
import { useFormList } from '../../hooks/use-custom-forms'
import type { FormsSearch } from '../../routing'
import { isUnavailable, pagedResult } from '../../utils/pending'
import { NoAccess, PageHeaderCard, WaitingForServer } from '../shared/page-parts'
import { FormBuilder } from './form-builder'
import { FormsList } from './forms-list'

const routeApi = getRouteApi('/_app/custom-form/forms')

/**
 * Forms (`/custom-form/forms`): the list, or the builder when `?edit=` names a form (`new` for a
 * new one). HR and admins only. Against an API without the Custom Form endpoints the page says
 * it is waiting for the server.
 */
export function FormsPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const canView = useCan(CF_CODES.formsView)
  const canCreate = useCan(CF_CODES.formsCreate)
  const canEdit = useCan(CF_CODES.formsEdit)
  // Read in builder mode too: it tells whether the backend has the endpoints at all.
  const list = useFormList(
    { q: search.q, status: search.status, page: search.page, pageSize: search.pageSize },
    canView,
  )
  const update = (patch: Partial<FormsSearch>, replace = false) => {
    void navigate({ search: (current) => ({ ...current, ...patch }), replace })
  }

  if (!canView) {
    return (
      <PageContainer>
        <PageHeaderCard title="Forms" badge={false} />
        <NoAccess what="the form builder" />
      </PageContainer>
    )
  }
  if (isUnavailable(list)) {
    return (
      <PageContainer>
        <PageHeaderCard title="Forms" badge={false} />
        <WaitingForServer what="The form builder and its list" />
      </PageContainer>
    )
  }

  const editing =
    search.edit !== undefined && (search.edit === 'new' ? canCreate : canEdit) ? search.edit : null

  return (
    <PageContainer>
      {/* The builder opens only for those who may save what it builds. */}
      {editing ? (
        <FormBuilder
          formId={editing === 'new' ? null : editing}
          pane={search.pane}
          onPaneChange={(pane) => {
            update({ pane }, true)
          }}
          onClose={() => {
            update({ edit: undefined, pane: 'build' })
          }}
          onCreated={(id) => {
            update({ edit: id }, true)
          }}
        />
      ) : (
        <FormsList
          search={search}
          result={pagedResult(list)}
          onSearchChange={(patch) => {
            update(patch)
          }}
          onOpen={(id) => {
            update({ edit: id, pane: 'build' })
          }}
        />
      )}
    </PageContainer>
  )
}
