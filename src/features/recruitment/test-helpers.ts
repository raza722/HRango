import { screen, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'

/** Opens a search select (or Radix select) by its label and picks an option. */
export async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opens a row's ⋮ menu and picks an item. */
export async function rowAction(user: UserEvent, menu: string | RegExp, item: string) {
  await user.click(await screen.findByRole('button', { name: menu }))
  await user.click(await screen.findByRole('menuitem', { name: item }))
}

/** The open dialog with this name. */
export const dialog = async (name: string | RegExp) => screen.findByRole('dialog', { name })

/** A button inside the given element. */
export const buttonIn = (element: HTMLElement, name: string | RegExp) =>
  within(element).getByRole('button', { name })
