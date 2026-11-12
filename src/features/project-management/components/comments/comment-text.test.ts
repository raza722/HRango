import { describe, expect, it } from 'vitest'

import { mentionsIn } from '../../api/pm.api'
import type { PmPerson, TaskRow } from '../../types/pm.types'
import { commentParts } from './comment-text'

const task = (id: string, code: string) => ({ id, code, name: `Task ${code}` }) as TaskRow
const people = [{ id: 'em_sara', name: 'Sara Khan' }] as PmPerson[]
const tasks = [task('tk_1', 'ONB-1'), task('tk_12', 'ONB-12'), task('tk_old', 'HR000000007')]

describe('task codes in comments', () => {
  it('links workspace codes (#ONB-12) and the older company codes (#HR000000007)', () => {
    const parts = commentParts('@Sara Khan see #ONB-12 and #HR000000007, not #XYZ-4', people, tasks)
    expect(parts.filter((part) => part.kind === 'task').map((part) => part.task.id)).toEqual([
      'tk_12',
      'tk_old',
    ])
    expect(parts.some((part) => part.kind === 'person')).toBe(true)
    // An unknown code stays text.
    expect(parts.at(-1)).toEqual({ kind: 'text', text: '#XYZ-4' })
  })

  it('does not find #ONB-1 inside #ONB-12', () => {
    expect(mentionsIn('Blocked by #ONB-12.', { people, tasks })).toEqual([{ taskId: 'tk_12' }])
  })
})
