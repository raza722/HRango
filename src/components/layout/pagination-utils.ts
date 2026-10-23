export type PageItem = number | 'ellipsis-start' | 'ellipsis-end'

/**
 * Page numbers to show around the current page, with ellipses for gaps.
 * `getPageItems(5, 10)` -> [1, 'ellipsis-start', 4, 5, 6, 'ellipsis-end', 10]
 */
export function getPageItems(page: number, totalPages: number, siblingCount = 1): PageItem[] {
  const total = Math.max(1, totalPages)
  // first + last + current + siblings + two ellipses
  const maxVisible = siblingCount * 2 + 5
  if (total <= maxVisible) return Array.from({ length: total }, (_, i) => i + 1)

  const start = Math.max(2, page - siblingCount)
  const end = Math.min(total - 1, page + siblingCount)
  const items: PageItem[] = [1]
  if (start > 2) items.push('ellipsis-start')
  for (let p = start; p <= end; p += 1) items.push(p)
  if (end < total - 1) items.push('ellipsis-end')
  items.push(total)
  return items
}
