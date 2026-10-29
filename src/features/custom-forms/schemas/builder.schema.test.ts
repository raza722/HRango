import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api-error'

import {
  builderErrors,
  builderSchema,
  builderToInput,
  type BuilderValues,
  emptyBuilder,
  newField,
  newSection,
  withType,
} from './builder.schema'

function values(): BuilderValues {
  const intro = { ...newField('short_text'), label: 'Your name' }
  const section = { ...newSection(), label: 'About the job' }
  const blank = newField('dropdown')
  const choice = {
    ...blank,
    label: 'Team',
    options: blank.options.map((option, index) => ({
      ...option,
      label: `Team ${String(index + 1)}`,
    })),
  }
  return { ...emptyBuilder(), title: 'Onboarding', items: [intro, section, choice] }
}

const issues = (input: BuilderValues) => {
  const result = builderSchema.safeParse(input)
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]))
}

describe('the builder form', () => {
  it('turns the list into sections and fields, each field in the section above it', () => {
    const input = builderToInput(values())
    expect(input.sections).toHaveLength(1)
    expect(input.sections[0]?.title).toBe('About the job')
    expect(input.fields.map((field) => [field.label, field.sectionKey])).toEqual([
      ['Your name', null],
      ['Team', input.sections[0]?.key],
    ])
    expect(input.fields[1]?.options.map((option) => option.label)).toEqual(['Team 1', 'Team 2'])
  })

  it('starts a choice with two empty options and refuses them blank', () => {
    const fresh = { ...newField('single_choice'), label: 'Shift' }
    expect(fresh.options.map((option) => option.label)).toEqual(['', ''])
    expect(issues({ ...values(), items: [fresh] })).toEqual({
      'items.0.options': 'Fill in every option.',
    })
  })

  it('checks options, limits and the audience', () => {
    const form = values()
    const [intro, section, choice] = form.items
    if (!intro || !section || !choice) throw new Error('No items')
    expect(
      issues({
        ...form,
        audienceKind: 'departments',
        items: [
          { ...intro, min: '5', max: '2' },
          section,
          {
            ...choice,
            options: [
              { ...choice.options[0]!, label: 'Same' },
              { ...choice.options[1]!, label: 'same' },
            ],
          },
          { ...newField('rating'), label: 'Stars', max: '12' },
        ],
      }),
    ).toEqual({
      departmentIds: 'Choose at least one department.',
      'items.0.max': 'The max must not be below the min.',
      'items.2.options': 'Each option must differ.',
      'items.3.max': 'Use 3 to 10.',
    })
  })

  it('keeps the options of a choice when the type changes to another choice', () => {
    const choice = { ...newField('single_choice'), label: 'Shift' }
    expect(withType(choice, 'dropdown').options).toBe(choice.options)
    expect(withType(choice, 'number').options).toEqual([])
    expect(withType(choice, 'rating').max).toBe('5')
  })

  it('puts the API field errors on the right builder fields', () => {
    const error = new ApiError({
      message: 'Some fields need your attention.',
      status: 422,
      kind: 'http',
      fieldErrors: {
        title: 'Taken.',
        'fields.1.options': 'Add at least two options.',
        'sections.0.title': 'Required.',
      },
    })
    expect(builderErrors(error, values())).toEqual({
      fields: [
        { name: 'title', message: 'Taken.' },
        { name: 'items.2.options', message: 'Add at least two options.' },
        { name: 'items.1.label', message: 'Required.' },
      ],
      root: null,
    })
  })
})
