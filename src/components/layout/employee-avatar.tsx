import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const COLOURS = [
  'bg-violet-200 text-violet-900',
  'bg-sky-200 text-sky-900',
  'bg-amber-200 text-amber-900',
  'bg-emerald-200 text-emerald-900',
  'bg-rose-200 text-rose-900',
  'bg-indigo-200 text-indigo-900',
]

function initials(name: string): string {
  const words = name
    .replace(/^Dr\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
  return ((words[0]?.[0] ?? '') + (words.at(-1)?.[0] ?? '')).toUpperCase()
}

/**
 * A person's photo, or their initials in a colour picked from the name, so a
 * person keeps one colour everywhere.
 */
export function EmployeeAvatar({
  name,
  photoUrl,
  className,
  fallbackClassName,
}: {
  name: string
  photoUrl?: string | null
  className?: string
  /** Text size of the initials, for large avatars. */
  fallbackClassName?: string
}) {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) hash += name.charCodeAt(index)
  return (
    <Avatar className={cn('size-9', className)}>
      {photoUrl && <AvatarImage src={photoUrl} alt="" className="object-cover" />}
      <AvatarFallback
        className={cn('text-xs font-medium', COLOURS[hash % COLOURS.length], fallbackClassName)}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
