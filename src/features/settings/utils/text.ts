/** "job title" → "Job title". */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "job title" → "Job Title" (button and heading words). */
export function titleCase(text: string): string {
  return text.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
}
