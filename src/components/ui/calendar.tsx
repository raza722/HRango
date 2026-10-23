import type { ComponentProps } from 'react'
import { type ChevronProps, DayPicker, getDefaultClassNames } from 'react-day-picker'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function CalendarChevron({ orientation, className }: ChevronProps) {
  const Icon = orientation === 'left' ? ChevronLeftIcon : ChevronRightIcon
  return <Icon className={cn('size-4', className)} />
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: ComponentProps<typeof DayPicker>) {
  const defaults = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        root: cn('w-fit', defaults.root),
        months: cn('relative flex flex-col gap-4', defaults.months),
        month: cn('flex w-full flex-col gap-4', defaults.month),
        nav: cn(
          'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
          defaults.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'select-none aria-disabled:opacity-50',
          defaults.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'select-none aria-disabled:opacity-50',
          defaults.button_next,
        ),
        month_caption: cn('flex h-7 w-full items-center justify-center', defaults.month_caption),
        caption_label: cn('text-sm font-medium select-none', defaults.caption_label),
        month_grid: 'w-full border-collapse',
        weekdays: cn('flex', defaults.weekdays),
        weekday: cn(
          'flex-1 text-[0.8rem] font-normal text-muted-foreground select-none',
          defaults.weekday,
        ),
        week: cn('mt-1 flex w-full', defaults.week),
        day: cn('relative aspect-square size-9 p-0 text-center text-sm select-none', defaults.day),
        day_button: cn(
          buttonVariants({ variant: 'ghost', size: 'icon' }),
          'size-9 rounded-md font-normal aria-selected:opacity-100',
        ),
        selected:
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground',
        today: '[&>button]:bg-accent [&>button]:text-accent-foreground',
        outside: cn('text-muted-foreground opacity-60', defaults.outside),
        disabled: cn('text-muted-foreground opacity-50', defaults.disabled),
        hidden: cn('invisible', defaults.hidden),
        ...classNames,
      }}
      components={{ Chevron: CalendarChevron }}
      {...props}
    />
  )
}

export { Calendar }
