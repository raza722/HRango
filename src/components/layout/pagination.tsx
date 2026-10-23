import { ChevronLeft, ChevronRight } from 'lucide-react'

import { BREAKPOINTS, useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

import { getPageItems } from './pagination-utils'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  /** Pages shown either side of the current one (0 on phones). */
  siblingCount?: number
  disabled?: boolean
  className?: string
  /**
   * The current page's fill: navy in the newer frames (default), blue in the
   * older Warning frames (`bg-pager-active`).
   */
  currentClassName?: string
}

// Figma pager: Inter Regular 14.2, the current page Inter Medium white.
const cellClass =
  'inline-flex h-9 min-w-9 items-center justify-center px-2.5 font-inter text-sm transition-colors outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-3 pointer-coarse:h-10 pointer-coarse:min-w-10'

const stepClass =
  'gap-1 text-field-foreground hover:bg-accent disabled:text-chip disabled:hover:bg-transparent sm:px-4'

/**
 * "Previous / 1 2 3 / Next" pager from the Figma tables. On phones the
 * Previous/Next words become chevrons (the accessible names stay) and fewer
 * page numbers are shown, so the pager fits a 320px screen.
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  siblingCount = 1,
  disabled = false,
  className,
  currentClassName = 'bg-sidebar font-medium text-white dark:bg-pager-active',
}: PaginationProps) {
  const isSmUp = useMediaQuery(BREAKPOINTS.sm)
  const total = Math.max(1, totalPages)
  const items = getPageItems(page, total, isSmUp ? siblingCount : 0)
  const canPrevious = !disabled && page > 1
  const canNext = !disabled && page < total

  return (
    <nav aria-label="Pagination" className={cn('flex max-w-full', className)}>
      <ul className="inline-flex max-w-full items-stretch divide-x divide-pager-border overflow-hidden rounded-sm border border-pager-border bg-card">
        <li>
          <button
            type="button"
            className={cn(cellClass, stepClass)}
            disabled={!canPrevious}
            onClick={() => {
              onPageChange(page - 1)
            }}
          >
            <ChevronLeft className="size-4 sm:hidden" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Previous</span>
          </button>
        </li>
        {items.map((item) =>
          typeof item === 'number' ? (
            <li key={item}>
              <button
                type="button"
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
                disabled={disabled}
                className={cn(
                  cellClass,
                  item === page ? currentClassName : 'text-field-foreground hover:bg-accent',
                )}
                onClick={() => {
                  if (item !== page) onPageChange(item)
                }}
              >
                {item}
              </button>
            </li>
          ) : (
            <li key={item} aria-hidden="true" className={cn(cellClass, 'px-1.5 text-label')}>
              …
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            className={cn(cellClass, stepClass)}
            disabled={!canNext}
            onClick={() => {
              onPageChange(page + 1)
            }}
          >
            <span className="sr-only sm:not-sr-only">Next</span>
            <ChevronRight className="size-4 sm:hidden" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </nav>
  )
}
