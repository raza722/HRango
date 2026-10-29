import { configure, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'

import { DEMO_USER } from '@/mocks/auth/handlers'
import { customFormResponses, customForms } from '@/mocks/custom-forms/handlers'
import { server } from '@/mocks/node'
import { apiPath, errorResponse } from '@/mocks/utils'
import { useAuthStore } from '@/stores/auth-store'
import { renderApp, setViewportWidth } from '@/test/test-utils'

configure({ asyncUtilTimeout: 4000 })

/** Renders as a user who holds only these permission codes (as `/auth/me` sends them). */
function renderAs(path: string, codes: string[]) {
  const result = renderApp(path)
  useAuthStore.getState().setSession({
    token: useAuthStore.getState().token ?? '',
    user: { ...DEMO_USER, permissions: codes.map((code) => ({ code, scope: 'company' })) },
  })
  return result
}

const FIRST_LOAD = { timeout: 15_000 }

/** A toast, once it has faded in. */
async function expectToast(text: string | RegExp) {
  await waitFor(() => {
    expect(screen.getByText(text)).toBeVisible()
  })
}

/** The Forms table's row of a form (by its title). */
async function row(title: string) {
  const table = await screen.findByRole('table', { name: 'Forms' }, FIRST_LOAD)
  const cell = await within(table).findByRole('button', { name: title })
  const tr = cell.closest('tr')
  if (!tr) throw new Error(`No row for ${title}`)
  return tr
}

async function rowAction(user: UserEvent, title: string, action: string) {
  await user.click(screen.getByRole('button', { name: `Actions for ${title}` }))
  await user.click(await screen.findByRole('menuitem', { name: action }))
}

/** A builder card ("Question 2, Single choice", "Section 1"). */
const card = (name: string | RegExp) => screen.getByRole('region', { name })

async function addQuestion(user: UserEvent, type: string) {
  await user.click(screen.getByRole('button', { name: 'Add question' }))
  await user.click(await screen.findByRole('menuitem', { name: type }))
}

describe('Custom Form → Forms', { timeout: 60_000 }, () => {
  it('lists the forms with their status, audience and responses, and filters them', async () => {
    const { user, router } = renderApp('/custom-form')

    expect(
      await screen.findByRole('heading', { name: 'Forms', level: 1 }, FIRST_LOAD),
    ).toBeVisible()
    expect(router.state.location.pathname).toBe('/custom-form/forms')
    // No backend endpoint yet: what the page shows is the mock's sample data.
    expect(screen.getByText('Sample data')).toBeVisible()

    const survey = await row('Employee Satisfaction Survey 2026')
    expect(within(survey).getByText('Published')).toBeVisible()
    expect(within(survey).getByText('Everyone')).toBeVisible()
    expect(within(survey).getByRole('link', { name: /^14 responses to/ })).toHaveAttribute(
      'href',
      '/custom-form/responses?formId=cf_survey',
    )
    const request = await row('IT Equipment Request')
    expect(
      within(request).getByText(/^People: Shelley Kannes, Bilal Ahmed \+4 more$/),
    ).toBeVisible()
    expect(within(await row('Exit Interview')).getByText('Draft')).toBeVisible()
    expect(within(await row('Annual Health Check Registration')).getByText('Closed')).toBeVisible()
    expect(screen.getByText('Showing 1–4 of 4')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Closed' }))
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ status: 'closed' })
    })
    expect(await screen.findByText('Showing 1–1 of 1')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Exit Interview' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'All' }))
    await user.type(screen.getByRole('textbox', { name: 'Search forms' }), 'equipment')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ q: 'equipment' })
    })
    expect(await screen.findByText('Showing 1–1 of 1')).toBeVisible()
    expect(await row('IT Equipment Request')).toBeInTheDocument()
  })

  it('builds a form with several field types, reorders, previews and publishes it', async () => {
    const { user, router } = renderApp('/custom-form/forms')
    await user.click(await screen.findByRole('button', { name: 'New Form' }, FIRST_LOAD))
    expect(await screen.findByRole('heading', { name: /^New form/, level: 1 })).toBeVisible()
    expect(router.state.location.search).toMatchObject({ edit: 'new' })

    // Saving without a title or question words is refused on the fields.
    await addQuestion(user, 'Number')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Give the form a title.')).toBeVisible()
    expect(within(card(/^Question 1/)).getByText('Enter the question.')).toBeVisible()

    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Shift survey')
    const number = card('Question 1, Number')
    await user.type(
      within(number).getByRole('textbox', { name: 'Question' }),
      'Years at the company',
    )
    await user.type(within(number).getByRole('textbox', { name: 'Min value' }), '0')
    await user.type(within(number).getByRole('textbox', { name: 'Max value' }), '50')
    await user.click(within(number).getByRole('switch', { name: 'Required' }))

    await addQuestion(user, 'Single choice')
    const choice = card('Question 2, Single choice')
    await user.type(within(choice).getByRole('textbox', { name: 'Question' }), 'Preferred shift')
    const first = within(choice).getByRole('textbox', { name: 'Option 1' })
    await user.clear(first)
    await user.type(first, 'Morning')
    const second = within(choice).getByRole('textbox', { name: 'Option 2' })
    await user.clear(second)
    await user.type(second, 'Evening')
    await user.click(within(choice).getByRole('button', { name: 'Add option' }))
    const third = within(choice).getByRole('textbox', { name: 'Option 3' })
    await user.clear(third)
    await user.type(third, 'Night')
    await user.click(within(choice).getByRole('switch', { name: 'Required' }))

    await addQuestion(user, 'Rating')
    await user.type(
      within(card('Question 3, Rating')).getByRole('textbox', { name: 'Question' }),
      'How rested do you feel?',
    )
    await user.click(screen.getByRole('button', { name: 'Add section' }))
    await user.type(
      within(card('Section 1')).getByRole('textbox', { name: 'Section title' }),
      'Anything else',
    )
    await addQuestion(user, 'Long text')
    await user.type(
      within(card('Question 4, Long text')).getByRole('textbox', { name: 'Question' }),
      'Comments',
    )

    // Up / down move a question; the cards are numbered again.
    // The buttons name the question by its words.
    await user.click(screen.getByRole('button', { name: 'Move “Preferred shift” up' }))
    expect(
      within(card('Question 1, Single choice')).getByRole('textbox', { name: 'Question' }),
    ).toHaveValue('Preferred shift')
    expect(
      within(card('Question 2, Number')).getByRole('textbox', { name: 'Question' }),
    ).toHaveValue('Years at the company')

    // The live preview renders the real fill form, in the new order, with its checks.
    const preview = screen.getByRole('form', { name: 'Preview of Shift survey' })
    expect(within(preview).getByRole('radio', { name: 'Night' })).toBeVisible()
    expect(
      within(preview).getByRole('textbox', { name: /^2\. Years at the company/ }),
    ).toBeVisible()
    expect(within(preview).getByRole('radio', { name: '3 out of 5' })).toBeVisible()
    expect(within(preview).getByRole('region', { name: 'Anything else' })).toBeVisible()
    await user.type(within(preview).getByRole('textbox', { name: /Years at the company/ }), '70')
    await user.click(within(preview).getByRole('button', { name: 'Try the checks' }))
    expect(await within(preview).findByText('Choose one of the options.')).toBeVisible()
    expect(within(preview).getByText('Enter 50 or less.')).toBeVisible()

    // Publish asks first.
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Publish form' })
    expect(within(confirm).getByText(/^Publish “Shift survey”\?/)).toBeVisible()
    await user.click(within(confirm).getByRole('button', { name: 'Publish' }))
    await expectToast('“Shift survey” is published')
    const saved = customForms.all().find((form) => form.title === 'Shift survey')
    expect(saved?.status).toBe('published')
    expect(saved?.fields.map((field) => [field.type, field.label])).toEqual([
      ['single_choice', 'Preferred shift'],
      ['number', 'Years at the company'],
      ['rating', 'How rested do you feel?'],
      ['long_text', 'Comments'],
    ])
    expect(saved?.fields[0]?.options.map((option) => option.label)).toEqual([
      'Morning',
      'Evening',
      'Night',
    ])
    expect(saved?.fields[1]).toMatchObject({ required: true, min: 0, max: 50 })
    expect(saved?.fields[2]?.max).toBe(5)
    expect(saved?.sections.map((section) => section.title)).toEqual(['Anything else'])
    expect(saved?.fields[3]?.sectionId).toBe(saved?.sections[0]?.id)
    // The builder stays on the saved form.
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ edit: saved?.id })
    })
    expect(await screen.findByRole('heading', { name: /^Shift survey/, level: 1 })).toBeVisible()
  })

  it('limits editing a form that has responses', async () => {
    const { user } = renderApp('/custom-form/forms?edit=cf_survey')
    expect(
      await screen.findByRole(
        'heading',
        { name: /^Employee Satisfaction Survey 2026/, level: 1 },
        FIRST_LOAD,
      ),
    ).toBeVisible()
    expect(screen.getByText(/This form has 14 responses\. You can reword questions/)).toBeVisible()
    const rating = card('Question 1, Rating')
    expect(within(rating).getByText('Has answers')).toBeVisible()
    expect(within(rating).getByRole('button', { name: /^Delete “.+”$/ })).toBeDisabled()
    expect(within(rating).getByRole('combobox', { name: 'Type' })).toBeDisabled()
    const choice = card('Question 2, Single choice')
    expect(within(choice).getByRole('button', { name: 'Remove option 1' })).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Anonymous' })).toBeDisabled()

    // Rewording and adding are allowed.
    const words = within(choice).getByRole('textbox', { name: 'Question' })
    await user.clear(words)
    await user.type(words, 'Is your workload manageable most weeks?')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await expectToast('Changes saved')
    expect(customForms.find('cf_survey')?.fields[1]?.label).toBe(
      'Is your workload manageable most weeks?',
    )
    expect(customFormResponses.all().filter((item) => item.formId === 'cf_survey')).toHaveLength(14)
  })

  it('publishes, closes, duplicates and deletes from the row menu', async () => {
    const { user } = renderApp('/custom-form/forms')
    await row('Exit Interview')

    await rowAction(user, 'Exit Interview', 'Publish')
    const publish = await screen.findByRole('alertdialog', { name: 'Publish form' })
    expect(within(publish).getByText(/Everyone will find it in My Forms/)).toBeVisible()
    await user.click(within(publish).getByRole('button', { name: 'Publish' }))
    await expectToast('“Exit Interview” is published')
    expect(customForms.find('cf_exit')?.status).toBe('published')
    expect(await within(await row('Exit Interview')).findByText('Published')).toBeVisible()

    await rowAction(user, 'IT Equipment Request', 'Close')
    await user.click(
      within(await screen.findByRole('alertdialog', { name: 'Close form' })).getByRole('button', {
        name: 'Close form',
      }),
    )
    await expectToast('“IT Equipment Request” is closed')
    expect(customForms.find('cf_it')?.status).toBe('closed')

    // An open form with answers is closed first, so Delete is not offered.
    await user.click(
      screen.getByRole('button', { name: 'Actions for Employee Satisfaction Survey 2026' }),
    )
    expect(await screen.findByRole('menuitem', { name: 'Duplicate' })).toBeVisible()
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    await expectToast('Draft “Copy of Employee Satisfaction Survey 2026” created')
    const copy = await row('Copy of Employee Satisfaction Survey 2026')
    expect(within(copy).getByText('Draft')).toBeVisible()
    expect(within(copy).getByText('5')).toBeVisible()

    await rowAction(user, 'Copy of Employee Satisfaction Survey 2026', 'Delete')
    await user.click(
      within(await screen.findByRole('alertdialog', { name: 'Delete form' })).getByRole('button', {
        name: 'Delete',
      }),
    )
    await expectToast('“Copy of Employee Satisfaction Survey 2026” deleted')
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Copy of Employee Satisfaction Survey 2026' }),
      ).not.toBeInTheDocument()
    })
  })

  it('refuses a stale edit with 409 and keeps the builder open', async () => {
    const { user } = renderApp('/custom-form/forms?edit=cf_exit')
    const title = await screen.findByRole('textbox', { name: 'Title' }, FIRST_LOAD)
    // Someone else saves the form meanwhile.
    const current = customForms.find('cf_exit')
    if (!current) throw new Error('No exit interview')
    customForms.update('cf_exit', { ...current, rowVersion: 'someone-else' })

    await user.type(title, ' (2026)')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await expectToast(/Someone else changed this form/)
    expect(customForms.find('cf_exit')?.title).toBe('Exit Interview')
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Exit Interview (2026)')
  })

  it('waits for the server when the backend has no form endpoints', async () => {
    server.use(http.get(apiPath('/forms'), () => errorResponse(404, 'Not Found')))
    renderApp('/custom-form/forms')
    expect(await screen.findByText('Waiting for the server', {}, FIRST_LOAD)).toBeVisible()
    expect(screen.getByText(/need backend endpoints that do not exist yet/)).toBeVisible()
    // Nothing is shown, so nothing is marked as sample data, and nothing can be built.
    expect(screen.queryByText('Sample data')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New Form' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('works at phone width', async () => {
    setViewportWidth(375)
    const { user, router } = renderApp('/custom-form/forms')
    // Rows become cards on a phone.
    const list = await screen.findByRole('list', { name: 'Forms' }, FIRST_LOAD)
    expect(await within(list).findByText('Employee Satisfaction Survey 2026')).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New Form' }))
    const tabs = await screen.findByRole('tablist', { name: 'Builder' })
    await user.click(within(tabs).getByRole('tab', { name: 'Preview' }))
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ edit: 'new', pane: 'preview' })
    })
    expect(within(tabs).getByRole('tab', { name: 'Preview' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('opens from Settings → Custom Forms', async () => {
    const { router } = renderApp('/settings/custom-forms')
    expect(
      await screen.findByRole('heading', { name: 'Forms', level: 1 }, FIRST_LOAD),
    ).toBeVisible()
    expect(router.state.location.pathname).toBe('/custom-form/forms')
  })

  it('keeps the builder to HR', async () => {
    renderAs('/custom-form/forms', ['forms.my_forms.view', 'forms.my_forms.submit'])
    expect(await screen.findByText('No access', {}, FIRST_LOAD)).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New Form' })).not.toBeInTheDocument()
  })

  it('shows the list without the builder or row actions to someone who may only view', async () => {
    renderAs('/custom-form/forms?edit=cf_survey', ['forms.forms.view', 'forms.responses.view'])
    expect(await screen.findByRole('table', { name: 'Forms' }, FIRST_LOAD)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'New Form' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Title' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Actions for Employee Satisfaction Survey 2026' }),
    ).not.toBeInTheDocument()
  })
})
