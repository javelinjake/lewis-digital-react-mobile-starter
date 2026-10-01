import { queryToParams } from '@directus/sdk'
import { normalizeDirectusError } from './directus-errors'
import { getTotalPages, type PaginatedResult, type PaginationParams } from './pagination'

interface DirectusListResponse<T> {
  data: T[]
  meta?: {
    filter_count?: number
    total_count?: number
  }
  errors?: Array<{ message?: string }>
}

export interface ReadPaginatedItemsOptions {
  baseUrl: string
  credentials?: RequestCredentials
  collection: string
  query: Record<string, unknown>
  pagination: PaginationParams
}

function buildDirectusUrl(baseUrl: string, path: string, params: Record<string, unknown>): string {
  const normalisedBase = baseUrl.replace(/\/$/, '')
  const url = new URL(`${normalisedBase}${path}`)

  for (const [key, value] of Object.entries(queryToParams(params))) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value))
        url.searchParams.set(`${key}[${nestedKey}]`, String(nestedValue))
    }
    else {
      url.searchParams.set(key, String(value))
    }
  }

  return url.toString()
}

export async function readPaginatedItems<T>(
  options: ReadPaginatedItemsOptions,
): Promise<PaginatedResult<T>> {
  const { baseUrl, credentials = 'include', collection, query, pagination } = options

  const params = {
    ...query,
    limit: pagination.limit,
    page: pagination.page,
    meta: 'filter_count',
  }

  try {
    const response = await fetch(buildDirectusUrl(baseUrl, `/items/${collection}`, params), {
      method: 'GET',
      credentials,
      headers: {
        Accept: 'application/json',
      },
    })

    const payload = await response.json() as DirectusListResponse<T>

    if (!response.ok || payload.errors?.length) {
      throw normalizeDirectusError({
        errors: payload.errors,
        response: { status: response.status },
      })
    }

    const total = payload.meta?.filter_count ?? payload.data.length

    return {
      data: payload.data,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: getTotalPages(total, pagination.limit),
    }
  }
  catch (error) {
    throw normalizeDirectusError(error)
  }
}
