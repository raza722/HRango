/** Requisitions need no look-ups of their own (the types are fixed). */
export function loadRequisitionLookups(): Promise<object> {
  return Promise.resolve({})
}
