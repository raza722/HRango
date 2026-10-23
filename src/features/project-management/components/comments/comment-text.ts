import { format, parseISO } from 'date-fns'

import type { PmPerson, TaskRow } from '../../types/pm.types'

/** "June 02 at 05:30 PM", as the comment cards show it. */
export const commentTime = (iso: string) => format(parseISO(iso), "MMMM dd 'at' hh:mm a")

export type CommentPart =
  | { kind: 'text'; text: string }
  | { kind: 'person'; person: PmPerson }
  | { kind: 'task'; task: TaskRow }

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A comment's body split into plain text, `@Name` mentions of people and `#HR…` task
 * references, so the card can draw mentions blue and tasks as status chips.
 */
export function commentParts(
  body: string,
  people: readonly PmPerson[],
  tasks: readonly TaskRow[],
): CommentPart[] {
  const byName = [...people].sort((a, b) => b.name.length - a.name.length)
  const byCode = new Map(tasks.map((task) => [task.code, task]))
  const names = byName.map((person) => `@${escape(person.name)}`)
  const pattern = new RegExp(`(${[...names, '#HR\\d{9}'].join('|')})`, 'g')
  const parts: CommentPart[] = []
  let last = 0
  for (const match of body.matchAll(pattern)) {
    const token = match[0]
    const index = match.index
    if (index > last) parts.push({ kind: 'text', text: body.slice(last, index) })
    const task = byCode.get(token)
    const person = byName.find((entry) => `@${entry.name}` === token)
    if (task) parts.push({ kind: 'task', task })
    else if (person) parts.push({ kind: 'person', person })
    else parts.push({ kind: 'text', text: token })
    last = index + token.length
  }
  if (last < body.length) parts.push({ kind: 'text', text: body.slice(last) })
  return parts
}

/** Emoji offered by the comment emoji menus. */
export const COMMENT_EMOJI = [
  '👍',
  '👏',
  '🎉',
  '✅',
  '🔥',
  '❤️',
  '😀',
  '😂',
  '🤔',
  '👀',
  '🙏',
  '🚀',
] as const
