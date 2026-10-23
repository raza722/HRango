import type { Paginated } from '@/types/api'

/** Removes one record from a cached page and fixes the totals (for optimistic deletes). */
export function withoutRecord<T extends { id: string }>(
  page: Paginated<T>,
  id: string,
): Paginated<T> {
  const data = page.data.filter((record) => record.id !== id)
  if (data.length === page.data.length) return page
  const total = Math.max(0, page.meta.total - 1)
  return {
    data,
    meta: { ...page.meta, total, totalPages: Math.max(1, Math.ceil(total / page.meta.pageSize)) },
  }
}
