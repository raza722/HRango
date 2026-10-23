/** Pagination block returned with every list endpoint. */
export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** Standard list envelope: `{ data: T[], meta: PaginationMeta }`. */
export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}

/** Standard single-resource envelope: `{ data: T }`. */
export interface ApiItem<T> {
  data: T
}

/** Query string accepted by paginated list endpoints. */
export interface PageParams {
  page: number
  pageSize: number
}

/**
 * Error body the API returns for any non-2xx response.
 * `fieldErrors` maps form field paths to messages (used for server-side validation).
 */
export interface ApiErrorBody {
  message: string
  code?: string
  fieldErrors?: Record<string, string>
}
