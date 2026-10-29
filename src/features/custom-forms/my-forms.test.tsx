import { configure, screen, waitFor, within } from '@testing-library/react'
import { format } from 'date-fns'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api-error'
import { DEMO_USER } from '@/mocks/auth/handlers'
import { customFormResponses } from '@/mocks/custom-forms/handlers'
import { server } from '@/mocks/node'
import { apiPath, errorResponse } from '@/mocks/utils'
import { useAuthStore } from '@/stores/auth-store'
import { renderApp, setViewportWidth } from '@/test/test-utils'

import { customFormsApi } from './api/custom-forms.api'

configure({ asyncUtilTimeout: 4000 })

const FIRST_LOAD = { timeout: 15_000 }

/** Renders as a user who holds only these permission codes (as `/auth/me` sends them). */
function renderAs(path: string, codes: string[]) {
  const result = renderApp(path)
  useAuthStore.getState().setSession({
    token: useAuthStore.getState().token ?? '',
    user: { ...DEMO_USER, permissions: codes.map((code) => ({ code, scope: 'company' })) },
  })
  return result
}

/** A toast, once it has faded in. */
async function expectToast(text: string | RegExp) {
  await waitFor(() => {
    expect(screen.getByText(text)).toBeVisible()
  })
}

const mine = (formId: string) =>
  customFormResponses
    .all()
    .filter((response) => response.formId === formId && response.employeeId === 'em_shelley')

/** The row of an assigned form or a submission (by its title). */
function rowOf(table: HTMLElement, title: string) {
  const tr = within(table).getByText(title).closest('tr')
  if (!tr) throw new Error(`No row for ${title}`)
  return tr
}

async function findRow(table: HTMLElement, title: string) {
  await within(table).findByText(title)
  return rowOf(table, title)
}

describe('Custom Form → My Forms', { timeout: 60_000 }, () => {
  it('lists the forms assigned to me and my submissions', async () => {
    const { user, router } = renderApp('/custom-form/my-forms')
    expect(
      await screen.findByRole('heading', { name: 'My Forms', level: 1 }, FIRST_LOAD),
    ).toBeVisible()
    expect(screen.getByText('Sample data')).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Assigned to me' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    const table = await screen.findByRole('table', { name: 'Forms assigned to me' })
    await within(table).findByText('Employee Satisfaction Survey 2026')
    const survey = rowOf(table, 'Employee Satisfaction Survey 2026')
    expect(within(survey).getByText('To do')).toBeVisible()
    expect(
      within(survey).getByRole('button', { name: 'Fill in: Employee Satisfaction Survey 2026' }),
    ).toBeVisible()
    // Shelley already asked for a monitor; the form takes as many requests as needed.
    const request = rowOf(table, 'IT Equipment Request')
    expect(within(request).getByText('Submitted')).toBeVisible()
    expect(
      within(request).getByRole('button', { name: 'Fill in again: IT Equipment Request' }),
    ).toBeVisible()
    // Closed, answered: only her answers to see.
    const health = rowOf(table, 'Annual Health Check Registration')
    expect(within(health).getByText('Submitted')).toBeVisible()
    expect(within(health).getByRole('button', { name: /^View my answers/ })).toBeVisible()
    // Drafts never reach anyone.
    expect(within(table).queryByText('Exit Interview')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'My submissions' }))
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ tab: 'submissions' })
    })
    const submissions = await screen.findByRole('table', { name: 'My submissions' })
    const sent = await findRow(submissions, 'IT Equipment Request')
    expect(within(sent).getByText('Shown to HR')).toBeVisible()
    await user.click(
      within(sent).getByRole('button', { name: /^View my answers: IT Equipment Request/ }),
    )

    const dialog = await screen.findByRole('dialog', { name: 'IT Equipment Request' })
    expect(await within(dialog).findByText('Monitor')).toBeVisible()
    expect(within(dialog).getByText(/^Shelley Kannes · submitted/)).toBeVisible()
    expect(within(dialog).getByText('A second screen for the payroll reviews.')).toBeVisible()
    expect(within(dialog).getByText('Normal')).toBeVisible()
    expect(within(dialog).getByText('Not answered')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('fills in a form with checks from its questions, a file and a submit', async () => {
    const { user, router } = renderApp('/custom-form/my-forms')
    await user.click(
      await screen.findByRole(
        'button',
        { name: 'Fill in again: IT Equipment Request' },
        FIRST_LOAD,
      ),
    )
    expect(
      await screen.findByRole('heading', { name: 'IT Equipment Request', level: 1 }),
    ).toBeVisible()
    expect(router.state.location.search).toMatchObject({ fill: 'cf_it' })
    const form = screen.getByRole('form', { name: 'IT Equipment Request' })

    // Every required question says what it needs.
    await user.click(within(form).getByRole('button', { name: 'Submit' }))
    expect(await within(form).findByText('Tick this to go on.')).toBeVisible()
    expect(within(form).getAllByText('This question needs an answer.')).toHaveLength(3)
    expect(within(form).getAllByText('Choose one of the options.')).toHaveLength(2)

    const quantity = within(form).getByRole('textbox', { name: /Quantity/ })
    await user.type(quantity, 'abc')
    expect(await within(form).findByText('Enter a number.')).toBeVisible()
    await user.clear(quantity)
    await user.type(quantity, '9')
    expect(await within(form).findByText('Enter 5 or less.')).toBeVisible()
    await user.clear(quantity)
    await user.type(quantity, '2')

    await user.click(within(form).getByRole('combobox', { name: /Equipment/ }))
    await user.click(await screen.findByRole('option', { name: 'Laptop' }))
    await user.click(within(form).getByRole('button', { name: /Needed by/ }))
    await user.click(
      await screen.findByRole('button', { name: new RegExp(format(new Date(), 'MMMM do, yyyy')) }),
    )
    await user.click(within(form).getByRole('radio', { name: 'High' }))
    const reason = within(form).getByRole('textbox', { name: /Why do you need it/ })
    await user.type(reason, 'Too short')
    expect(await within(form).findByText('Enter at least 10 characters.')).toBeVisible()
    await user.type(reason, ' for the new hire')
    await user.upload(
      within(form).getByLabelText('File for Quotation or photo'),
      new File(['quote'], 'quote.pdf', { type: 'application/pdf' }),
    )
    expect(await within(form).findByRole('link', { name: 'quote.pdf' })).toBeVisible()
    await user.click(within(form).getByRole('checkbox', { name: /I will return the equipment/ }))

    await user.click(within(form).getByRole('button', { name: 'Submit' }))
    await expectToast('Thank you. Your answers were sent.')
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ tab: 'submissions' })
    })
    expect(router.state.location.search).not.toHaveProperty('fill')
    const sent = mine('cf_it')
    expect(sent).toHaveLength(2)
    const latest = sent.toSorted((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0]
    const value = (fieldId: string) =>
      latest?.answers.find((item) => item.fieldId === fieldId)?.value
    expect(value('cf_it_f1')).toBe('cf_it_f1_o1')
    expect(value('cf_it_f2')).toBe(2)
    expect(value('cf_it_f3')).toBe(format(new Date(), 'yyyy-MM-dd'))
    expect(value('cf_it_f4')).toBe('cf_it_f4_o3')
    expect(value('cf_it_f5')).toBe('Too short for the new hire')
    expect(value('cf_it_f6')).toMatch(/^file_/)
    expect(value('cf_it_f7')).toBe(true)
  })

  it('takes one response per person, with the choice limits checked', async () => {
    const { user } = renderApp('/custom-form/my-forms?fill=cf_survey')
    const form = await screen.findByRole(
      'form',
      { name: 'Employee Satisfaction Survey 2026' },
      FIRST_LOAD,
    )
    expect(screen.getByText('Anonymous: your name is not shown with your answers')).toBeVisible()

    await user.click(within(form).getByRole('radio', { name: '4 out of 5' }))
    await user.click(within(form).getByRole('radio', { name: 'Usually' }))
    for (const benefit of ['Health cover', 'Flexible hours', 'Training budget', 'Remote work']) {
      await user.click(within(form).getByRole('checkbox', { name: benefit }))
    }
    await user.click(within(form).getByRole('combobox', { name: /feedback/ }))
    await user.click(await screen.findByRole('option', { name: 'Every month' }))
    await user.click(within(form).getByRole('button', { name: 'Submit' }))
    expect(await within(form).findByText('Choose at most 3 options.')).toBeVisible()
    await user.click(within(form).getByRole('checkbox', { name: 'Remote work' }))
    await user.click(within(form).getByRole('button', { name: 'Submit' }))
    await expectToast('Thank you. Your answers were sent.')

    const sent = mine('cf_survey')
    expect(sent).toHaveLength(1)
    expect(sent[0]?.answers.find((item) => item.fieldId === 'cf_survey_f3')?.value).toEqual([
      'cf_survey_f3_o1',
      'cf_survey_f3_o2',
      'cf_survey_f3_o3',
    ])
    const submissions = await screen.findByRole('table', { name: 'My submissions' })
    const row = await findRow(submissions, 'Employee Satisfaction Survey 2026')
    expect(within(row).getByText('Hidden (anonymous)')).toBeVisible()

    // The survey now offers my answers, not a second go.
    await user.click(screen.getByRole('tab', { name: 'Assigned to me' }))
    const table = await screen.findByRole('table', { name: 'Forms assigned to me' })
    const survey = await findRow(table, 'Employee Satisfaction Survey 2026')
    expect(within(survey).getByText('Submitted')).toBeVisible()
    expect(within(survey).queryByRole('button', { name: /^Fill in/ })).not.toBeInTheDocument()

    // And the API refuses a second response.
    const second = customFormsApi.submitResponse(
      'cf_survey',
      [{ fieldId: 'cf_survey_f1', value: 5 }],
      { fields: [] },
    )
    await expect(second).rejects.toBeInstanceOf(ApiError)
    await expect(second).rejects.toMatchObject({ status: 409, code: 'ALREADY_RESPONDED' })
  })

  it("puts the server's answer errors on the questions", async () => {
    server.use(
      http.post(apiPath('/forms/cf_survey/responses'), () =>
        errorResponse(422, 'Some answers need your attention.', {
          code: 'VALIDATION_FAILED',
          fieldErrors: { 'answers.cf_survey_f5': 'Leave out names of colleagues.' },
        }),
      ),
    )
    const { user } = renderApp('/custom-form/my-forms?fill=cf_survey')
    const form = await screen.findByRole(
      'form',
      { name: 'Employee Satisfaction Survey 2026' },
      FIRST_LOAD,
    )
    await user.click(within(form).getByRole('radio', { name: '3 out of 5' }))
    await user.click(within(form).getByRole('radio', { name: 'Sometimes' }))
    await user.click(within(form).getByRole('checkbox', { name: 'Bonuses' }))
    await user.click(within(form).getByRole('combobox', { name: /feedback/ }))
    await user.click(await screen.findByRole('option', { name: 'Rarely' }))
    await user.type(within(form).getByRole('textbox', { name: /make work better/ }), 'Ask Omar.')
    await user.click(within(form).getByRole('button', { name: 'Submit' }))

    await expectToast('Some answers need your attention.')
    const comment = within(form).getByRole('textbox', { name: /make work better/ })
    expect(comment).toHaveAccessibleDescription('Leave out names of colleagues.')
    expect(comment).toHaveAttribute('aria-invalid', 'true')
    expect(mine('cf_survey')).toHaveLength(0)
  })

  it('takes no answers to a closed form or a draft', async () => {
    renderApp('/custom-form/my-forms?fill=cf_health')
    expect(await screen.findByText('This form is closed', {}, FIRST_LOAD)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View my answers' })).toBeVisible()

    // The API refuses them too.
    const answer = [{ fieldId: 'cf_health_f1', value: 'cf_health_f1_o1' }]
    await expect(
      customFormsApi.submitResponse('cf_health', answer, { fields: [] }),
    ).rejects.toMatchObject({ status: 409, code: 'FORM_CLOSED' })
    await expect(
      customFormsApi.submitResponse('cf_exit', [], { fields: [] }),
    ).rejects.toMatchObject({ status: 409, code: 'FORM_NOT_PUBLISHED' })
  })

  it('waits for the server when the backend has no form endpoints', async () => {
    server.use(http.get(apiPath('/forms/assigned'), () => errorResponse(404, 'Not Found')))
    renderApp('/custom-form/my-forms')
    expect(await screen.findByText('Waiting for the server', {}, FIRST_LOAD)).toBeVisible()
    expect(screen.queryByText('Sample data')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('works at phone width', async () => {
    setViewportWidth(375)
    const { user } = renderApp('/custom-form/my-forms')
    const list = await screen.findByRole('list', { name: 'Forms assigned to me' }, FIRST_LOAD)
    expect(await within(list).findByText('Employee Satisfaction Survey 2026')).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await user.click(
      within(list).getByRole('button', { name: 'Fill in: Employee Satisfaction Survey 2026' }),
    )
    expect(
      await screen.findByRole('form', { name: 'Employee Satisfaction Survey 2026' }),
    ).toBeVisible()
  })

  it('is open to every employee: My Forms needs only its own codes', async () => {
    renderAs('/custom-form/my-forms', ['forms.my_forms.view', 'forms.my_forms.submit'])
    const table = await screen.findByRole('table', { name: 'Forms assigned to me' }, FIRST_LOAD)
    expect(
      await within(table).findByRole('button', {
        name: 'Fill in: Employee Satisfaction Survey 2026',
      }),
    ).toBeVisible()
  })
})
