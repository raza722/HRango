import { configure, screen, waitFor, within } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { DEMO_USER } from '@/mocks/auth/handlers'
import { customFormResponses } from '@/mocks/custom-forms/handlers'
import { server } from '@/mocks/node'
import { apiPath, errorResponse } from '@/mocks/utils'
import { useAuthStore } from '@/stores/auth-store'
import { renderApp, setViewportWidth } from '@/test/test-utils'

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

async function expectToast(text: string | RegExp) {
  await waitFor(() => {
    expect(screen.getByText(text)).toBeVisible()
  })
}

/** How many of a form's responses gave this answer to the question. */
const countOf = (formId: string, fieldId: string, value: string) =>
  customFormResponses
    .all()
    .filter((response) => response.formId === formId)
    .filter((response) => {
      const answer = response.answers.find((item) => item.fieldId === fieldId)?.value
      return Array.isArray(answer) ? answer.includes(value) : answer === value
    }).length

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.onerror = () => {
      reject(new Error('Could not read the file'))
    }
    reader.readAsText(blob)
  })
}

describe('Custom Form → Responses', { timeout: 60_000 }, () => {
  it('picks a form and shows one column per question, anonymous rows and the counts', async () => {
    const { user, router } = renderApp('/custom-form/responses')
    expect(
      await screen.findByRole('heading', { name: 'Form Responses', level: 1 }, FIRST_LOAD),
    ).toBeVisible()
    expect(screen.getByText('Pick a form to see its responses')).toBeVisible()

    const picker = screen.getByRole('combobox', { name: 'Form' })
    await waitFor(() => {
      expect(picker).toBeEnabled()
    })
    await user.click(picker)
    // Drafts have no answers, so they are not offered.
    expect(screen.queryByRole('option', { name: /Exit Interview/ })).not.toBeInTheDocument()
    await user.click(
      await screen.findByRole('option', {
        name: /Employee Satisfaction Survey 2026.*14 responses/,
      }),
    )
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ formId: 'cf_survey' })
    })

    const table = await screen.findByRole('table', {
      name: 'Responses to Employee Satisfaction Survey 2026',
    })
    for (const header of [
      'Respondent',
      'Submitted',
      'How satisfied are you with your role?',
      'Is your workload manageable?',
      'Which benefits matter most to you?',
      'How often does your manager give you feedback?',
      'What would make work better for you?',
    ]) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeVisible()
    }
    // An anonymous form never names anyone.
    expect(await within(table).findAllByText('Anonymous')).toHaveLength(10)
    expect(within(table).queryByText('Ayesha Malik')).not.toBeInTheDocument()
    expect(screen.getByText('Showing 1–10 of 14')).toBeVisible()
    // Respondents have no names to search on an anonymous form.
    expect(screen.queryByRole('textbox', { name: 'Search respondents' })).not.toBeInTheDocument()

    // The counts of a choice question, as bars with their numbers.
    const workload = await screen.findByRole('region', { name: 'Is your workload manageable?' })
    expect(within(workload).getByText('14 answers')).toBeVisible()
    const usually = countOf('cf_survey', 'cf_survey_f2', 'cf_survey_f2_o2')
    const line = within(workload).getByText('Usually').closest('li')
    expect(line).toHaveTextContent(
      `Usually${String(usually)} answers, · ${String(Math.round((usually / 14) * 100))}%`,
    )
    const benefits = screen.getByRole('region', { name: 'Which benefits matter most to you?' })
    const remote = countOf('cf_survey', 'cf_survey_f3', 'cf_survey_f3_o4')
    expect(within(benefits).getByText('Remote work').closest('li')).toHaveTextContent(
      new RegExp(`^Remote work${String(remote)} answers?,`),
    )
    const rating = screen.getByRole('region', { name: 'How satisfied are you with your role?' })
    expect(within(rating).getByText('5 of 5')).toBeVisible()
  })

  it('names the people of a named form, searches them and opens one response', async () => {
    const { user, router } = renderApp('/custom-form/responses?formId=cf_it')
    const table = await screen.findByRole(
      'table',
      { name: 'Responses to IT Equipment Request' },
      FIRST_LOAD,
    )
    expect(await within(table).findByText('Haroon Jalani')).toBeVisible()
    expect(within(table).getByText('Shelley Kannes')).toBeVisible()
    expect(within(table).getByText('Mahnoor Ali')).toBeVisible()
    expect(within(table).getByRole('columnheader', { name: 'Quantity' })).toBeVisible()
    expect(within(table).getAllByText('Laptop')).toHaveLength(1)

    await user.type(screen.getByRole('textbox', { name: 'Search respondents' }), 'haroon')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ q: 'haroon' })
    })
    expect(await screen.findByText('Showing 1–1 of 1')).toBeVisible()

    await user.click(screen.getByRole('button', { name: /^View the response of Haroon Jalani/ }))
    const dialog = await screen.findByRole('dialog', { name: 'IT Equipment Request' })
    expect(await within(dialog).findByText('My laptop no longer holds a charge.')).toBeVisible()
    expect(within(dialog).getByText(/^Haroon Jalani · submitted/)).toBeVisible()
    expect(within(dialog).getByText('High')).toBeVisible()
    expect(within(dialog).getByText('Yes')).toBeVisible()
    expect(router.state.location.search).toMatchObject({ response: 'cf_it_r1' })
  })

  it('exports every response as CSV, built in the browser', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:responses')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    const { user } = renderApp('/custom-form/responses?formId=cf_it')
    await user.click(await screen.findByRole('button', { name: 'Export CSV' }, FIRST_LOAD))
    await expectToast('Exported 3 responses')

    expect(click).toHaveBeenCalledTimes(1)
    const link = click.mock.contexts[0] as HTMLAnchorElement
    expect(link.download).toMatch(/^it-equipment-request-responses-\d{4}-\d{2}-\d{2}\.csv$/)
    const blob = createObjectURL.mock.calls[0]?.[0]
    if (!blob) throw new Error('No file was made')
    const lines = (await readBlob(blob)).trim().split('\n')
    expect(lines[0]).toBe(
      'Submitted,Respondent,Employee code,Department,Equipment,Quantity,Needed by,Urgency,Why do you need it?,Quotation or photo,I will return the equipment when I leave the company',
    )
    expect(lines).toHaveLength(4)
    const haroon = lines.find((line) => line.includes('Haroon Jalani'))
    expect(haroon).toMatch(/,Software,Laptop,1,.+,High,My laptop no longer holds a charge\.,,Yes$/)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:responses')
  })

  it('waits for the server when the backend has no form endpoints', async () => {
    server.use(http.get(apiPath('/forms'), () => errorResponse(404, 'Not Found')))
    renderApp('/custom-form/responses?formId=cf_it')
    expect(await screen.findByText('Waiting for the server', {}, FIRST_LOAD)).toBeVisible()
    expect(screen.queryByText('Sample data')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument()
  })

  it('works at phone width', async () => {
    setViewportWidth(375)
    renderApp('/custom-form/responses?formId=cf_it')
    const list = await screen.findByRole(
      'list',
      { name: 'Responses to IT Equipment Request' },
      FIRST_LOAD,
    )
    expect(await within(list).findByText('Haroon Jalani')).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Urgency' })).toBeVisible()
  })

  it('keeps the responses to HR', async () => {
    renderAs('/custom-form/responses?formId=cf_it', ['forms.my_forms.view'])
    expect(await screen.findByText('No access', {}, FIRST_LOAD)).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('reads the answers without Export CSV for someone who may not export', async () => {
    renderAs('/custom-form/responses?formId=cf_it', ['forms.responses.view'])
    expect(
      await screen.findByRole('table', { name: 'Responses to IT Equipment Request' }, FIRST_LOAD),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open in builder' })).not.toBeInTheDocument()
  })
})
