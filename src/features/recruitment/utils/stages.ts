import type { Application } from '../types/recruitment.types'

/** Hired, rejected or withdrawn: nothing moves the application any more. */
export const isClosedStage = (application: Pick<Application, 'stage'>) =>
  application.stage === 'hired' ||
  application.stage === 'rejected' ||
  application.stage === 'withdrawn'
