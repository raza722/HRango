import { describe, expect, it } from 'vitest'

import type { FormFieldDef } from '../types/custom-forms.types'
import { answerKey, buildAnswersSchema, emptyAnswers, toAnswerInputs } from './answers.schema'

const field = (id: string, type: FormFieldDef['type'], extra: Partial<FormFieldDef> = {}) =>
  ({
    id,
    sectionId: null,
    type,
    label: id,
    helpText: null,
    required: false,
    options: [],
    min: null,
    max: null,
    ...extra,
  }) satisfies FormFieldDef

const options = [
  { id: 'o1', label: 'One' },
  { id: 'o2', label: 'Two' },
  { id: 'o3', label: 'Three' },
]

const FIELDS = [
  field('name', 'short_text', { required: true, min: 2, max: 10 }),
  field('age', 'number', { required: true, min: 18, max: 65 }),
  field('pick', 'single_choice', { required: true, options }),
  field('many', 'multiple_choice', { options, min: 1, max: 2 }),
  field('agree', 'checkbox', { required: true }),
  field('stars', 'rating', { max: 5 }),
  field('when', 'date'),
]

/** The messages the schema gives, by field id. */
function errorsOf(values: Record<string, unknown>) {
  const result = buildAnswersSchema(FIELDS).safeParse({ ...emptyAnswers(FIELDS), ...values })
  if (result.success) return {}
  return Object.fromEntries(
    result.error.issues.map((issue) => [String(issue.path[0]).replace(/^q_/, ''), issue.message]),
  )
}

const valid = {
  [answerKey('name')]: 'Sara',
  [answerKey('age')]: '30',
  [answerKey('pick')]: 'o2',
  [answerKey('agree')]: true,
}

describe('the fill form schema made from the questions', () => {
  it('asks for every required answer', () => {
    expect(errorsOf({})).toEqual({
      name: 'This question needs an answer.',
      age: 'This question needs an answer.',
      pick: 'Choose one of the options.',
      agree: 'Tick this to go on.',
    })
    expect(errorsOf(valid)).toEqual({})
  })

  it('checks numbers, lengths and their limits', () => {
    expect(errorsOf({ ...valid, [answerKey('age')]: 'twelve' })).toEqual({ age: 'Enter a number.' })
    expect(errorsOf({ ...valid, [answerKey('age')]: '17' })).toEqual({ age: 'Enter 18 or more.' })
    expect(errorsOf({ ...valid, [answerKey('age')]: '1,000' })).toEqual({
      age: 'Enter 65 or less.',
    })
    expect(errorsOf({ ...valid, [answerKey('name')]: 'S' })).toEqual({
      name: 'Enter at least 2 characters.',
    })
    expect(errorsOf({ ...valid, [answerKey('name')]: 'Sara Khan Malik' })).toEqual({
      name: 'Keep it to 10 characters.',
    })
  })

  it('takes only the options and their pick limits', () => {
    expect(errorsOf({ ...valid, [answerKey('pick')]: 'o9' })).toEqual({
      pick: 'Choose one of the options.',
    })
    expect(errorsOf({ ...valid, [answerKey('many')]: ['o1', 'o2', 'o3'] })).toEqual({
      many: 'Choose at most 2 options.',
    })
    // Optional with a minimum: nothing picked is fine.
    expect(errorsOf({ ...valid, [answerKey('many')]: [] })).toEqual({})
    expect(errorsOf({ ...valid, [answerKey('stars')]: 6 })).toEqual({ stars: 'Choose 1 to 5.' })
  })

  it('turns the answers into what the API takes', () => {
    expect(
      toAnswerInputs(FIELDS, {
        ...emptyAnswers(FIELDS),
        ...valid,
        [answerKey('name')]: '  Sara ',
        [answerKey('many')]: ['o3', 'o1'],
        [answerKey('stars')]: 4,
      }),
    ).toEqual([
      { fieldId: 'name', value: 'Sara' },
      { fieldId: 'age', value: 30 },
      { fieldId: 'pick', value: 'o2' },
      // In the options' order.
      { fieldId: 'many', value: ['o1', 'o3'] },
      { fieldId: 'agree', value: true },
      { fieldId: 'stars', value: 4 },
      { fieldId: 'when', value: null },
    ])
  })

  it('keeps form-state names safe for any id', () => {
    expect(answerKey('12')).toBe('q_12')
    expect(answerKey('a.b c')).toBe('q_a_b_c')
  })
})
