import { createContext } from 'react'

/**
 * True inside the app shell (`AuthenticatedLayout`), so a page drawn either way (the 404) does
 * not draw the shell twice.
 */
export const InShellContext = createContext(false)
