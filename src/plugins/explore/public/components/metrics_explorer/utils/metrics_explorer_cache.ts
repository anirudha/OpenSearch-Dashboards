/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const DEFAULT_DATA_TTL = 60_000; // 60 seconds
const DEFAULT_METADATA_TTL = 300_000; // 5 minutes
const MAX_ENTRIES = 500;

/**
 * In-memory cache with TTL, LRU eviction, and request deduplication.
 */
export class MetricsExplorerCache {
  private cache = new Map<string, CacheEntry<any>>();
  private inflight = new Map<string, Promise<any>>();

  /**
   * Get a cached value if it exists and has not expired.
   */
  get<T>(key: string, ttlMs: number = DEFAULT_DATA_TTL): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end for LRU ordering (Map maintains insertion order)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data as T;
  }

  /**
   * Set a value in the cache. Evicts oldest entries if over capacity.
   */
  set<T>(key: string, data: T): void {
    // Evict oldest if at capacity
    if (this.cache.size >= MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Deduplicate concurrent requests for the same key.
   * If a request for this key is already in-flight, returns the same promise.
   */
  async dedupe<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = DEFAULT_DATA_TTL
  ): Promise<T> {
    // Check cache first
    const cached = this.get<T>(key, ttlMs);
    if (cached !== undefined) return cached;

    // Check if a request is already in-flight
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    // Execute and cache
    const promise = fetcher()
      .then((result) => {
        this.set(key, result);
        this.inflight.delete(key);
        return result;
      })
      .catch((err) => {
        this.inflight.delete(key);
        throw err;
      });

    this.inflight.set(key, promise);
    return promise;
  }

  /**
   * Invalidate entries matching an optional prefix. If no prefix, clears all.
   */
  invalidate(keyPrefix?: string): void {
    if (!keyPrefix) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(keyPrefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate all data entries but keep metadata entries.
   * Metadata keys should be prefixed with 'metadata:'.
   */
  invalidateData(): void {
    for (const key of this.cache.keys()) {
      if (!key.startsWith('metadata:')) {
        this.cache.delete(key);
      }
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

/** Default TTLs exported for use in hooks */
export const CACHE_TTL = {
  DATA: DEFAULT_DATA_TTL,
  METADATA: DEFAULT_METADATA_TTL,
};
