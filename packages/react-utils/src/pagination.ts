import { useState } from 'react'

export function usePaginationState(initialPage = 1) {
  const [page, setPage] = useState(initialPage)

  return {
    page,
    setPage,
    next: () => setPage(current => current + 1),
    previous: () => setPage(current => Math.max(1, current - 1)),
  }
}
