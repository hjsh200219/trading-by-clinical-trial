import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TTLCache } from '../../src/lib/cache.js';

describe('TTLCache', () => {
  let cache: TTLCache;

  beforeEach(() => {
    cache = new TTLCache(1000); // 1 second default TTL
  });

  it('should store and retrieve data', () => {
    cache.set('key1', { name: 'test' });
    expect(cache.get('key1')).toEqual({ name: 'test' });
  });

  it('should return undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('should return undefined for expired entries', () => {
    vi.useFakeTimers();
    cache.set('key1', 'value');
    vi.advanceTimersByTime(1500); // past 1s TTL
    expect(cache.get('key1')).toBeUndefined();
    vi.useRealTimers();
  });

  it('should return data within TTL', () => {
    vi.useFakeTimers();
    cache.set('key1', 'value');
    vi.advanceTimersByTime(500); // within 1s TTL
    expect(cache.get('key1')).toBe('value');
    vi.useRealTimers();
  });

  it('should support custom TTL per entry', () => {
    vi.useFakeTimers();
    cache.set('short', 'val', 500);
    cache.set('long', 'val', 2000);
    vi.advanceTimersByTime(800);
    expect(cache.get('short')).toBeUndefined();
    expect(cache.get('long')).toBe('val');
    vi.useRealTimers();
  });

  it('should return stale data via getStale', () => {
    vi.useFakeTimers();
    cache.set('key1', 'stale-value');
    vi.advanceTimersByTime(1500); // expired
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.getStale('key1')).toBe('stale-value');
    vi.useRealTimers();
  });

  it('should return undefined from getStale for never-set keys', () => {
    expect(cache.getStale('never')).toBeUndefined();
  });

  it('should clear all entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
    expect(cache.getStale('a')).toBeUndefined();
  });

  it('should build cache key from object params', () => {
    const key = TTLCache.buildKey('prefix', { b: 2, a: 1 });
    const key2 = TTLCache.buildKey('prefix', { a: 1, b: 2 });
    expect(key).toBe(key2); // sorted keys should produce same key
    expect(key).toContain('prefix');
  });
});
