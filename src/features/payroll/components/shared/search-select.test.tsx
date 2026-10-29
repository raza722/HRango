import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { SearchSelect } from './search-select'

const OPTIONS = [
  { value: 'em_sara', label: 'Sara Khan', hint: 'Id-014' },
  { value: 'em_saad', label: 'Saad Hadier', hint: 'Id-008' },
  { value: 'em_hina', label: 'Hina Raza', hint: 'Id-021' },
]

function Picker({ clearable = false }: { clearable?: boolean }) {
  const [value, setValue] = useState<string | null>(null)
  return (
    <>
      <SearchSelect
        aria-label="Employee"
        value={value}
        onChange={setValue}
        options={OPTIONS}
        placeholder="Select"
        clearable={clearable}
      />
      <output aria-label="Chosen">{value ?? 'none'}</output>
    </>
  )
}

describe('SearchSelect from the keyboard', () => {
  it('moves with the arrow keys and picks with Enter', async () => {
    const user = userEvent.setup()
    render(<Picker />)
    await user.click(screen.getByRole('combobox', { name: 'Employee' }))
    const search = await screen.findByRole('searchbox', { name: 'Search employee' })
    expect(search).toHaveFocus()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(search).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: /Saad Hadier/ }).id,
    )
    await user.keyboard('{Enter}')
    expect(screen.getByRole('status', { name: 'Chosen' })).toHaveTextContent('em_saad')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('picks the only match with Enter, and stops at the ends of the list', async () => {
    const user = userEvent.setup()
    render(<Picker clearable />)
    await user.click(screen.getByRole('combobox', { name: 'Employee' }))
    await user.type(await screen.findByRole('searchbox'), 'hina{Enter}')
    expect(screen.getByRole('status', { name: 'Chosen' })).toHaveTextContent('em_hina')

    await user.click(screen.getByRole('combobox', { name: 'Employee' }))
    await user.keyboard('{ArrowUp}{ArrowUp}{Enter}')
    // The first choice of a clearable picker clears it.
    expect(screen.getByRole('status', { name: 'Chosen' })).toHaveTextContent('none')
  })
})
