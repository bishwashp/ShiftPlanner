/**
 * Simple in-memory cache service for API responses
 */

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL = 60000; // 1 minute default TTL
  
  /**
   * Get a value from the cache
   * @param key The cache key
   * @returns The cached value or undefined if not found or expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }
    
    // Check if the entry has expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.data;
  }
  
  /**
   * Set a value in the cache
   * @param key The cache key
   * @param value The value to cache
   * @param ttl Time-to-live in milliseconds (optional, defaults to 1 minute)
   */
  set<T>(key: string, value: T, ttl = this.defaultTTL): void {
    this.cache.set(key, {
      data: value,
      expiry: Date.now() + ttl
    });
  }
  
  /**
   * Remove a value from the cache
   * @param key The cache key
   */
  remove(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get the number of entries in the cache
   */
  size(): number {
    return this.cache.size;
  }
}

// Export a singleton instance
export const cacheService = new CacheService();
