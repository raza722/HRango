/**
 * A tiny in-memory table for mock handlers. In the browser it is mirrored to
 * sessionStorage, so created records survive a reload but not a new tab.
 */
export interface MockCollection<T extends { id: string }> {
  all: () => T[]
  find: (id: string) => T | undefined
  insert: (item: T) => T
  update: (id: string, item: T) => T | undefined
  remove: (id: string) => boolean
  reset: () => void
}

function readStorage(key: string): unknown {
  try {
    const raw = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeStorage(key: string, items: readonly unknown[]): void {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, JSON.stringify(items))
  } catch {
    // Storage full or blocked: keep working from memory.
  }
}

export function createMockCollection<T extends { id: string }>(options: {
  /** sessionStorage key; omit to keep the data in memory only. */
  storageKey?: string
  seed: () => T[]
}): MockCollection<T> {
  const { storageKey, seed } = options
  const stored = storageKey ? readStorage(storageKey) : null
  // Only this collection writes the key, so a stored array has the right shape.
  let items: T[] = Array.isArray(stored) ? (stored as T[]) : seed()

  const persist = () => {
    if (storageKey) writeStorage(storageKey, items)
  }

  return {
    all: () => [...items],
    find: (id) => items.find((item) => item.id === id),
    insert: (item) => {
      items = [item, ...items]
      persist()
      return item
    },
    update: (id, next) => {
      const index = items.findIndex((item) => item.id === id)
      if (index === -1) return undefined
      items = items.map((item, i) => (i === index ? next : item))
      persist()
      return next
    },
    remove: (id) => {
      const before = items.length
      items = items.filter((item) => item.id !== id)
      persist()
      return items.length < before
    },
    reset: () => {
      items = seed()
      persist()
    },
  }
}
