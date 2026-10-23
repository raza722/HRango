import { Construction } from 'lucide-react'

import { PageContainer } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { SETTINGS_PLACEHOLDERS, type SettingsPlaceholderKey } from '../../constants'

interface SettingsPlaceholderProps {
  section: SettingsPlaceholderKey
  /** Inside the Control Panel layout the page container is already there. */
  standalone?: boolean
}

/** A routed Settings screen that has no design yet. */
export function SettingsPlaceholder({ section, standalone = false }: SettingsPlaceholderProps) {
  const copy = SETTINGS_PLACEHOLDERS[section]
  const card = (
    <Card className="rounded-xl font-inter">
      <CardHeader className="pt-6 sm:px-8 sm:pt-7">
        <div>
          <CardTitle as="h1" className="text-xl font-medium sm:text-xl">
            {copy.title}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 px-6 py-12 text-center sm:px-8">
        <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Construction className="size-7" aria-hidden="true" />
        </span>
        <p className="max-w-md text-sm text-muted-foreground">
          This screen is routed and in the menu, but the design does not cover it yet.
        </p>
        <ul aria-label="Planned" className="flex max-w-xl flex-wrap justify-center gap-2">
          {copy.planned.map((item) => (
            <li key={item}>
              <Badge variant="outline" className="px-3 py-1 text-sm font-normal">
                {item}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )

  return standalone ? <PageContainer>{card}</PageContainer> : card
}
