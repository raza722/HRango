import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'

import { DEMO_USER } from '@/mocks/auth/handlers'
import { server } from '@/mocks/node'
import { employees } from '@/mocks/talent-management/db'
import { apiPath, MOCK_TOKEN_PREFIX } from '@/mocks/utils'
import { useAuthStore } from '@/stores/auth-store'
import { renderApp } from '@/test/test-utils'
import type { Permission } from '@/types/auth'

// What the profile does with two backend rules (backend commit 14b3940): personal details need
// `employees.personal.view` for the person (`canSeePersonal`), and line managers and department
// heads no longer read a report's dependents or documents.

/** The mock's sample colleague whose personal details the API hides (`PERSONAL_HIDDEN`). */
const HIDDEN_ID = 'em_daniyal'
const HIDDEN_NAME = 'Daniyal Qureshi'

/** The `EmployeeIn` fields that carry personal details: never sent for a hidden record. */
const PERSONAL_INPUTS = [
  'parentName',
  'maritalStatus',
  'religion',
  'nationality',
  'dateOfBirth',
  'phone1',
  'phone2',
  'homeAddress',
  'homeCityId',
]

/** Collects the bodies of `PUT /employees/{id}`, then lets the mock answer. */
function spyOnEmployeeSaves(): Record<string, unknown>[] {
  const bodies: Record<string, unknown>[] = []
  server.use(
    http.put(apiPath('/employees/:id'), async ({ request }) => {
      bodies.push((await request.clone().json()) as Record<string, unknown>)
      return undefined
    }),
  )
  return bodies
}

/** The profile tabs read from now on, as `{employeeId}/{tab}`. */
function spyOnReads(): string[] {
  const reads: string[] = []
  server.use(
    http.get<{ id: string; tab: string }>(apiPath('/employees/:id/:tab'), ({ params }) => {
      reads.push(`${params.id}/${params.tab}`)
      return undefined
    }),
  )
  return reads
}

/** Signs in as the demo user (Shelley Kannes) holding only these permissions. */
function signInWith(permissions: Permission[]) {
  useAuthStore.getState().setSession({
    token: `${MOCK_TOKEN_PREFIX}test`,
    user: { ...DEMO_USER, permissions },
  })
}

/**
 * A line manager as the backend's default role makes one: the directory and four profile tabs
 * for their team, and every tab of their own record (self-service).
 */
const LINE_MANAGER: Permission[] = [
  { code: 'employees.directory.view', scope: 'team' },
  ...['emergency_contacts', 'skills', 'education', 'experience'].map((tab) => ({
    code: `employees.${tab}.view`,
    scope: 'team',
  })),
  ...['emergency_contacts', 'dependents', 'skills', 'education', 'experience', 'documents'].map(
    (tab) => ({ code: `employees.${tab}.view`, scope: 'own' }),
  ),
  { code: 'employees.contracts.view', scope: 'own' },
]

async function openMenuItem(user: UserEvent, menu: string, item: string) {
  await user.click(await screen.findByRole('button', { name: menu }))
  await user.click(await screen.findByRole('menuitem', { name: item }))
}

const valueOf = (group: HTMLElement, label: string) =>
  within(group).getByText(label).nextSibling?.textContent

/** The profile's name heading; the first render of a file also loads the route, so it may wait. */
const profileHeading = (name: string) =>
  screen.findByRole('heading', { level: 1, name }, { timeout: 15_000 })

describe('Employee profile → personal details the API hides (canSeePersonal)', () => {
  it('shows Hidden in place of a colleague’s personal details', async () => {
    renderApp(`/talent-management/employees/${HIDDEN_ID}`)

    expect(await profileHeading(HIDDEN_NAME)).toBeVisible()
    const personal = screen.getByRole('group', { name: 'Personal details' })
    for (const label of [
      'Date of Birth',
      'Emergency Contact #',
      'Phone No',
      'Marital Status',
      'Father / Husband Name',
      'Other Phone No',
      'Address',
      'Religion',
      'Nationality',
    ]) {
      expect(valueOf(personal, label), label).toBe('Hidden')
    }
    // Work details, the email and the CNIC (its own permission) still show.
    expect(valueOf(personal, 'Email Address')).toBe('daniyal.qureshi@topedge.tech')
    expect(valueOf(personal, 'Gender')).toBe('Male')
    expect(valueOf(personal, 'CNIC')).not.toBe('Hidden')
    // The mock keeps the real values; only what the API sends is blank.
    expect(employees.find(HIDDEN_ID)?.phone1).toBeTruthy()
  })

  it('shows a colleague’s personal details when the API sends them', async () => {
    renderApp('/talent-management/employees/em_omer')

    expect(await profileHeading('Omer Farooq')).toBeVisible()
    const personal = screen.getByRole('group', { name: 'Personal details' })
    expect(valueOf(personal, 'Phone No')).toBe(employees.find('em_omer')?.phone1)
    expect(within(personal).queryByText('Hidden')).not.toBeInTheDocument()
  })

  it('leaves them out of Edit Employee and keeps them on save', async () => {
    const stored = employees.find(HIDDEN_ID)
    expect(stored?.dateOfBirth).toBeTruthy()
    const saves = spyOnEmployeeSaves()
    const { user } = renderApp(`/talent-management/employees/${HIDDEN_ID}`)
    await profileHeading(HIDDEN_NAME)

    await openMenuItem(user, `More actions for ${HIDDEN_NAME}`, 'Edit Employee')
    const dialog = await screen.findByRole('dialog', { name: 'Edit Employee' })
    expect(within(dialog).getByText(/You can’t see this person’s personal details/)).toBeVisible()
    for (const label of [
      'Father / Husband Name',
      'Marital Status',
      'Date of Birth',
      'Religion',
      'Nationality',
      'Phone Number',
      'Other Phone Number',
      'Address',
    ]) {
      expect(within(dialog).queryByLabelText(label), label).not.toBeInTheDocument()
    }
    const email = within(dialog).getByRole('textbox', { name: 'Email Address' })
    await user.clear(email)
    await user.type(email, 'daniyal.q@topedge.tech')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit Employee' })).not.toBeInTheDocument()
    })
    expect(saves).toHaveLength(1)
    for (const field of PERSONAL_INPUTS) expect(saves[0], field).not.toHaveProperty(field)
    expect(employees.find(HIDDEN_ID)).toMatchObject({
      email: 'daniyal.q@topedge.tech',
      parentName: stored?.parentName,
      maritalStatus: stored?.maritalStatus,
      dateOfBirth: stored?.dateOfBirth,
      phone1: stored?.phone1,
      homeAddress: stored?.homeAddress,
    })
  }, 30_000)

  it('leaves them out of Update Profile and keeps them on save', async () => {
    const stored = employees.find(HIDDEN_ID)
    const saves = spyOnEmployeeSaves()
    const { user } = renderApp(`/talent-management/employees/${HIDDEN_ID}`)
    await profileHeading(HIDDEN_NAME)

    await user.click(screen.getByRole('button', { name: 'Update Profile' }))
    const dialog = await screen.findByRole('dialog', { name: 'Update Profile' })
    expect(within(dialog).getByText(/You can’t see this person’s personal details/)).toBeVisible()
    for (const label of ['Phone Number', 'Address', 'Date of Birth', 'Marital Status']) {
      expect(within(dialog).queryByLabelText(label), label).not.toBeInTheDocument()
    }
    const fullName = within(dialog).getByRole('textbox', { name: 'Full Name' })
    await user.clear(fullName)
    await user.type(fullName, 'Daniyal Ahmed Qureshi')
    await user.click(within(dialog).getByRole('button', { name: 'Update Profile' }))

    expect((await screen.findAllByText('Profile updated')).length).toBeGreaterThan(0)
    expect(saves).toHaveLength(1)
    for (const field of PERSONAL_INPUTS) expect(saves[0], field).not.toHaveProperty(field)
    expect(employees.find(HIDDEN_ID)).toMatchObject({
      firstName: 'Daniyal Ahmed',
      lastName: 'Qureshi',
      maritalStatus: stored?.maritalStatus,
      dateOfBirth: stored?.dateOfBirth,
      phone1: stored?.phone1,
      homeAddress: stored?.homeAddress,
    })
  }, 30_000)
})

describe('Employee profile → tabs the user may not read', () => {
  it('tells a line manager they can’t see a report’s dependents, and asks for none', async () => {
    const reads = spyOnReads()
    signInWith(LINE_MANAGER)
    renderApp('/talent-management/employees/em_maryam?tab=dependents', { signedIn: false })

    expect(await profileHeading('Maryam Javed')).toBeVisible()
    expect(await screen.findByText('You can’t see this person’s dependents.')).toBeVisible()
    expect(screen.queryByText('Javed Iqbal')).not.toBeInTheDocument()
    expect(screen.queryByText(/could not be loaded/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Dependents' })).not.toBeInTheDocument()
    expect(reads).not.toContain('em_maryam/dependents')
  })

  it('shows a line manager the academics and experience, not the documents or contracts', async () => {
    const reads = spyOnReads()
    signInWith(LINE_MANAGER)
    renderApp('/talent-management/employees/em_maryam?tab=documents', { signedIn: false })

    await profileHeading('Maryam Javed')
    expect(await screen.findByText('Studied at FAST Lahore')).toBeVisible()
    expect(await screen.findByText('Worked at Pixel Studio')).toBeVisible()
    const documents = screen.getByRole('region', { name: 'Documents' })
    expect(within(documents).getByText('You can’t see this person’s documents.')).toBeVisible()
    const contracts = screen.getByRole('region', { name: 'Contracts' })
    expect(within(contracts).getByText('You can’t see this person’s contracts.')).toBeVisible()
    expect(screen.queryByText(/could not be loaded/)).not.toBeInTheDocument()
    expect(reads).toEqual(expect.arrayContaining(['em_maryam/education', 'em_maryam/experience']))
    expect(reads).not.toContain('em_maryam/documents')
    expect(reads).not.toContain('em_maryam/contracts')
  })

  it('shows a line manager their own dependents and documents', async () => {
    signInWith(LINE_MANAGER)
    const { user } = renderApp('/talent-management/employees/em_shelley?tab=dependents', {
      signedIn: false,
    })

    await profileHeading('Shelley Kannes')
    expect(await screen.findByText('Ashraf Hussain')).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Documents' }))
    expect(await screen.findByText('Resume')).toBeVisible()
    expect(await screen.findByText('Project Contract')).toBeVisible()
    expect(screen.queryByText(/You can’t see/)).not.toBeInTheDocument()
  })

  it('says so once when none of the Documents tab may be read', async () => {
    signInWith([{ code: 'employees.directory.view', scope: 'company' }])
    renderApp('/talent-management/employees/em_maryam?tab=documents', { signedIn: false })

    await profileHeading('Maryam Javed')
    expect(await screen.findByText('You can’t see this person’s documents.')).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Academics' })).not.toBeInTheDocument()
  })
})
