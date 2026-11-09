import { useMatches } from 'react-router'

export function useRouteTitle(fallback: string) {
  const matches = useMatches()

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const handle = matches[index]?.handle as { title?: string } | undefined
    if (handle?.title)
      return handle.title
  }

  return fallback
}
