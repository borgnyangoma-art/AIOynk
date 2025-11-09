type CacheEntry<T> = {
  value: T
  expiresAt: number
  tags: Set<string>
  createdAt: number
}

const DEFAULT_TTL_SECONDS = 60
const MAX_ENTRIES = 500

class ApplicationCacheService {
  private store = new Map<string, CacheEntry<unknown>>()

  private evictIfNecessary() {
    if (this.store.size <= MAX_ENTRIES) {
      return
    }
    const oldestKey = this.store.keys().next().value
    if (oldestKey) {
      this.store.delete(oldestKey)
    }
  }

  private buildEntry<T>(value: T, ttlSeconds: number, tags: string[]) {
    const now = Date.now()
    return {
      value,
      expiresAt: now + ttlSeconds * 1000,
      createdAt: now,
      tags: new Set(tags),
    } satisfies CacheEntry<T>
  }

  private isExpired(entry: CacheEntry<unknown>) {
    return entry.expiresAt <= Date.now()
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) {
      return null
    }

    if (this.isExpired(entry)) {
      this.store.delete(key)
      return null
    }

    return entry.value as T
  }

  set<T>(key: string, value: T, ttlSeconds = DEFAULT_TTL_SECONDS, tags: string[] = []) {
    this.store.set(key, this.buildEntry(value, ttlSeconds, tags))
    this.evictIfNecessary()
  }

  async wrap<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds = DEFAULT_TTL_SECONDS,
    tags: string[] = [],
  ): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const value = await factory()
    this.set(key, value, ttlSeconds, tags)
    return value
  }

  invalidateByTag(tag: string) {
    Array.from(this.store.entries()).forEach(([key, entry]) => {
      if (entry.tags.has(tag)) {
        this.store.delete(key)
      }
    })
  }

  invalidateByPattern(pattern: RegExp) {
    Array.from(this.store.keys()).forEach((key) => {
      if (pattern.test(key)) {
        this.store.delete(key)
      }
    })
  }

  clear() {
    this.store.clear()
  }

  inspect(limit = 50) {
    return Array.from(this.store.entries())
      .slice(0, limit)
      .map(([key, entry]) => ({
        key,
        expiresAt: entry.expiresAt,
        tags: Array.from(entry.tags),
        ageMs: Date.now() - entry.createdAt,
      }))
  }
}

export default new ApplicationCacheService()
