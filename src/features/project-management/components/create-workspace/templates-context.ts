import { createContext, useContext } from 'react'

import type { PmTemplates, WorkflowTemplate, WorkflowTemplateId } from '../../types/pm.types'

/** The API's workflow and status templates (`GET /projects/templates`), loaded by the wizard. */
export const TemplatesContext = createContext<PmTemplates | null>(null)

export function useWizardTemplates(): PmTemplates {
  const templates = useContext(TemplatesContext)
  if (!templates)
    throw new Error('useWizardTemplates must be used inside the Create Workspace wizard')
  return templates
}

const EMPTY_WORKFLOW: WorkflowTemplate = {
  id: '',
  name: '',
  description: '',
  setup: {
    views: ['list'],
    defaultView: 'list',
    statusMode: 'default',
    statusTemplate: null,
    statuses: [],
    organizer: [],
  },
}

/** A workflow template by code (an empty one while unknown). */
export function useWorkflowTemplate(id: WorkflowTemplateId): WorkflowTemplate {
  const { workflows } = useWizardTemplates()
  return workflows.find((entry) => entry.id === id) ?? EMPTY_WORKFLOW
}
