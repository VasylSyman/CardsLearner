import { useCallback, useEffect, useState } from 'react'

export type Route =
  | { name: 'decks' }
  | { name: 'study'; deckId: string }
  | { name: 'browse'; deckId?: string }
  | { name: 'settings' }

function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  const [seg, arg] = path.split('/')
  switch (seg) {
    case 'study':
      return arg ? { name: 'study', deckId: decodeURIComponent(arg) } : { name: 'decks' }
    case 'browse':
      return { name: 'browse', deckId: arg ? decodeURIComponent(arg) : undefined }
    case 'settings':
      return { name: 'settings' }
    default:
      return { name: 'decks' }
  }
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'decks':
      return '#/'
    case 'study':
      return `#/study/${encodeURIComponent(route.deckId)}`
    case 'browse':
      return route.deckId ? `#/browse/${encodeURIComponent(route.deckId)}` : '#/browse'
    case 'settings':
      return '#/settings'
  }
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))

  useEffect(() => {
    const handler = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const navigate = useCallback((r: Route) => {
    window.location.hash = routeToHash(r)
  }, [])

  return { route, navigate }
}
