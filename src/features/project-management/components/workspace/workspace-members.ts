import type { PmPerson, Workspace } from '../../types/pm.types'

/** The workspace's members as people (the directory's photo when there is one), owner first. */
export function membersOf(
  workspace: Pick<Workspace, 'members' | 'ownerId'>,
  people: ReadonlyMap<string, PmPerson>,
): PmPerson[] {
  const isOwner = (id: string) => Number(id === workspace.ownerId)
  return workspace.members
    .toSorted((a, b) => isOwner(b.employeeId) - isOwner(a.employeeId))
    .map(
      (member): PmPerson =>
        people.get(member.employeeId) ?? {
          id: member.employeeId,
          name: member.name,
          designation: member.designation,
          department: member.department,
          photoUrl: null,
        },
    )
}
