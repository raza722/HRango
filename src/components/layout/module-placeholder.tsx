import type { ComponentType, SVGProps } from 'react'
import { Construction } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

import { PageContainer, PageHeader } from './page-header'

interface ModulePlaceholderProps {
  title: string
  description: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Screens planned for this module (taken from the Figma design folders). */
  plannedScreens: readonly string[]
}

/**
 * Stand-in page for modules that are routed and gated but not built yet.
 * Replace it with the module's feature components when the module is implemented.
 */
export function ModulePlaceholder({
  title,
  description,
  icon: Icon,
  plannedScreens,
}: ModulePlaceholderProps) {
  return (
    <PageContainer>
      <PageHeader title={title} description={description} />
      <section
        aria-labelledby="module-placeholder-heading"
        className="flex flex-col items-center gap-4 rounded-md bg-card px-6 py-14 text-center shadow-xs"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Icon className="size-8" />
        </span>
        <h2
          id="module-placeholder-heading"
          className="flex items-center gap-2 text-lg text-heading"
        >
          <Construction className="size-5 text-primary" aria-hidden="true" />
          {title} is scaffolded
        </h2>
        <p className="max-w-lg text-sm text-muted-foreground">
          The route, navigation entry and auth gate are in place. Build the screens below as a
          feature under <code className="rounded bg-muted px-1 py-0.5 text-xs">src/features/</code>,
          following the Warning → Policy reference.
        </p>
        {plannedScreens.length > 0 && (
          <ul
            aria-label="Planned screens"
            className="flex max-w-2xl flex-wrap justify-center gap-2"
          >
            {plannedScreens.map((screen) => (
              <li key={screen}>
                <Badge variant="outline" className="px-3 py-1 text-sm font-normal">
                  {screen}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  )
}
