import { createContext } from 'react'

/**
 * What the red close of the detail pages says: the wizard closes Create Workspace; Workspace
 * Settings reuses those pages (Default Views, Edit Statuses, Organizer) with its own label.
 */
export const DetailCloseLabelContext = createContext('Close Create Workspace')
