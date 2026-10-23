import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { setViewportWidth } from '@/test/test-utils'

import { DataTable, type DataTableColumn } from './data-table'

interface Row {
  id: string
  name: string
  span: string
}

const rows: Row[] = [
  { id: 'a', name: 'Grace Minutes', span: 'Month' },
  { id: 'b', name: 'Late Arrival', span: 'Week' },
]

const columns: DataTableColumn<Row>[] = [
  { id: 'sr', header: 'Sr#', cell: (_row, index) => index + 1, mobile: 'hidden' },
  { id: 'name', header: 'Policy Name', cell: (row) => row.name, mobile: 'heading' },
  { id: 'span', header: 'Time Span', cell: (row) => row.span },
]

function renderTable() {
  render(
    <DataTable
      caption="Warning policies"
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      rowActions={(row) => <button type="button">Actions for {row.name}</button>}
    />,
  )
}

describe('DataTable responsiveness', () => {
  it('renders columns on wide screens', () => {
    setViewportWidth(1024)
    renderTable()

    const table = screen.getByRole('table', { name: 'Warning policies' })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Sr#', 'Policy Name', 'Time Span', 'Actions'])
  })

  it('stacks rows into labelled cards on phones', () => {
    setViewportWidth(375)
    renderTable()

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Warning policies' })
    const [first] = within(list).getAllByRole('listitem')

    // Heading column becomes the card title, hidden columns are left out.
    expect(within(first!).getByText('Grace Minutes')).toHaveClass('font-medium')
    expect(within(first!).queryByText('Sr#')).not.toBeInTheDocument()
    expect(within(first!).getByText('Time Span')).toBeInTheDocument()
    expect(within(first!).getByText('Month')).toBeInTheDocument()
    expect(
      within(first!).getByRole('button', { name: 'Actions for Grace Minutes' }),
    ).toBeInTheDocument()
  })

  it('sorts from the header on wide screens and from a "Sort by" bar on phones', async () => {
    const sortable = columns.map((column) =>
      column.id === 'name' ? { ...column, sortKey: 'name' } : column,
    )
    const onSortChange = vi.fn()
    const table = (width: number) => {
      setViewportWidth(width)
      return render(
        <DataTable
          caption="Warning policies"
          columns={sortable}
          data={rows}
          getRowId={(row) => row.id}
          sort={{ key: 'name', direction: 'asc' }}
          onSortChange={onSortChange}
        />,
      )
    }
    const user = userEvent.setup()

    const wide = table(1024)
    const header = screen.getByRole('columnheader', { name: 'Policy Name' })
    expect(header).toHaveAttribute('aria-sort', 'ascending')
    await user.click(within(header).getByRole('button'))
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'name', direction: 'desc' })
    wide.unmount()

    table(375)
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveTextContent('Policy Name')
    await user.click(screen.getByRole('button', { name: /switch to Z to A/ }))
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'name', direction: 'desc' })
  })
})
