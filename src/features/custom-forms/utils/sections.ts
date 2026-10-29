import type { FormDefinition, FormFieldDef, FormSection } from '../types/custom-forms.types'

export interface QuestionGroup {
  /** `null` for the questions before the first section. */
  section: FormSection | null
  fields: FormFieldDef[]
}

/** The questions before the first section, then each section with its own. */
export function groupBySection(
  definition: Pick<FormDefinition, 'sections' | 'fields'>,
): QuestionGroup[] {
  const groups: QuestionGroup[] = []
  const loose = definition.fields.filter(
    (field) =>
      field.sectionId === null || !definition.sections.some((item) => item.id === field.sectionId),
  )
  if (loose.length > 0) groups.push({ section: null, fields: loose })
  for (const section of definition.sections) {
    groups.push({
      section,
      fields: definition.fields.filter((field) => field.sectionId === section.id),
    })
  }
  return groups
}

/** Question numbers (1-based) in reading order, by field id. */
export function questionNumbers(groups: readonly QuestionGroup[]): Map<string, number> {
  return new Map(
    groups.flatMap((group) => group.fields).map((field, index) => [field.id, index + 1]),
  )
}
