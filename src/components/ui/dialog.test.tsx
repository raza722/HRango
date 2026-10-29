import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AlertDialog, AlertDialogContent, AlertDialogTitle } from './alert-dialog'
import { Dialog, DialogContent, DialogTitle } from './dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

/** A dialog opened from state (no Trigger), as most of the app's dialogs are. */
function FromButton({ alert = false }: { alert?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
        }}
      >
        Open
      </button>
      {alert ? (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent aria-describedby={undefined}>
            <AlertDialogTitle>Sure?</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        open && (
          // Unmounted on close, as the app's form dialogs are.
          <Dialog open onOpenChange={setOpen}>
            <DialogContent aria-describedby={undefined}>
              <DialogTitle>Edit</DialogTitle>
              <input aria-label="Name" />
            </DialogContent>
          </Dialog>
        )
      )}
    </>
  )
}

function FromMenu() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onSelect={() => {
              setOpen(true)
            }}
          >
            Edit
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Edit row</DialogTitle>
        </DialogContent>
      </Dialog>
    </>
  )
}

describe('dialogs give focus back to what opened them', () => {
  it('returns to the button after Escape, also when the dialog unmounts', async () => {
    const user = userEvent.setup()
    render(<FromButton />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('dialog', { name: 'Edit' })).toBeVisible()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus()
    })
  })

  it('returns to the button after a confirm closes', async () => {
    const user = userEvent.setup()
    render(<FromButton alert />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('alertdialog', { name: 'Sure?' })).toBeVisible()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus()
    })
  })

  it('returns to the menu button when the dialog came from a menu item', async () => {
    const user = userEvent.setup()
    render(<FromMenu />)
    await user.click(screen.getByRole('button', { name: 'Actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    expect(await screen.findByRole('dialog', { name: 'Edit row' })).toBeVisible()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus()
    })
  })
})
