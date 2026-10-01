export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export function getTotalPages(total: number, limit: number): number {
  if (limit <= 0)
    return 1

  return Math.max(1, Math.ceil(total / limit))
}

export function getPageRange(pagination: PaginatedResult<unknown>): {
  from: number
  to: number
} {
  if (pagination.total === 0)
    return { from: 0, to: 0 }

  const from = (pagination.page - 1) * pagination.limit + 1
  const to = Math.min(pagination.page * pagination.limit, pagination.total)

  return { from, to }
}
