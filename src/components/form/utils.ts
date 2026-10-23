/** Narrows an unknown form value to a string for controlled inputs. */
export function toInputValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
