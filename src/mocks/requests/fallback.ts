import { http, type HttpHandler, type HttpResponseResolver } from 'msw'

import { apiPath } from '../utils'

/*
 * The request forms read pickers other modules own (leave types, roster groups,
 * time slots, grades …). Those modules' mocks may or may not serve them yet, so
 * the requests mock answers them only as a fallback: when another mock handler
 * matches the same request, this one steps aside (returns nothing, so MSW goes
 * on to the next handler).
 */

const fallbacks = new WeakSet<HttpHandler>()

async function servedElsewhere(request: Request): Promise<boolean> {
  // Imported when a request arrives: the list includes this module's handlers.
  const { handlers } = await import('../handlers')
  for (const handler of handlers) {
    if (fallbacks.has(handler)) continue
    if (await handler.test({ request: request.clone() })) return true
  }
  return false
}

/** `GET <path>` answered only when no other mock serves it. */
export function fallbackGet(path: string, resolver: HttpResponseResolver): HttpHandler {
  const handler = http.get(apiPath(path), async (info) => {
    if (await servedElsewhere(info.request)) return undefined
    return resolver(info)
  })
  fallbacks.add(handler)
  return handler
}
