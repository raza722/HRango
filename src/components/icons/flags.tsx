import type { ComponentProps, JSX } from 'react'

import flagUsUrl from '@/assets/images/flag-us.png'
import { cn } from '@/lib/utils'
import type { LanguageCode } from '@/stores/ui-store'

type FlagProps = Omit<ComponentProps<'span'>, 'children'>

/** United States flag from the Figma top bar. */
function FlagUs({ className, ...props }: FlagProps) {
  return (
    <span className={cn('block overflow-hidden rounded-full', className)} {...props}>
      <img src={flagUsUrl} alt="" className="size-full object-cover" />
    </span>
  )
}

function Tricolour({
  colours,
  className,
  ...props
}: FlagProps & { colours: [string, string, string] }) {
  return (
    <span className={cn('block overflow-hidden rounded-full', className)} {...props}>
      <svg viewBox="0 0 3 3" className="size-full" aria-hidden="true">
        <rect width="1" height="3" x="0" fill={colours[0]} />
        <rect width="1" height="3" x="1" fill={colours[1]} />
        <rect width="1" height="3" x="2" fill={colours[2]} />
      </svg>
    </span>
  )
}

function FlagFr(props: FlagProps) {
  return <Tricolour colours={['#0055A4', '#FFFFFF', '#EF4135']} {...props} />
}

function FlagDe({ className, ...props }: FlagProps) {
  return (
    <span className={cn('block overflow-hidden rounded-full', className)} {...props}>
      <svg viewBox="0 0 3 3" className="size-full" aria-hidden="true">
        <rect width="3" height="1" y="0" fill="#000000" />
        <rect width="3" height="1" y="1" fill="#DD0000" />
        <rect width="3" height="1" y="2" fill="#FFCE00" />
      </svg>
    </span>
  )
}

const FLAGS: Record<LanguageCode, (props: FlagProps) => JSX.Element> = {
  en: FlagUs,
  fr: FlagFr,
  de: FlagDe,
}

/** Round flag for a supported interface language. */
export function LanguageFlag({ code, ...props }: FlagProps & { code: LanguageCode }) {
  const Flag = FLAGS[code]
  return <Flag {...props} />
}
