interface CacheEntry<T> {
  data: T;
  expiry: number;
}

export class TTLCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 3600000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) return undefined;
    return entry.data as T;
  }

  getStale<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.store.set(key, {
      data,
      expiry: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  clear(): void {
    this.store.clear();
  }

  static buildKey(prefix: string, params: Record<string, unknown>): string {
    const sorted = Object.keys(params)
      .sort()
      .map((k) => `${k}=${JSON.stringify(params[k])}`)
      .join('&');
    return `${prefix}:${sorted}`;
  }
}
