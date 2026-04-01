import { describe, expect, test } from 'bun:test';
import { getNavigationCachePath, getNavigationFallbackPath } from './service-worker-navigation';

describe('getNavigationCachePath', () => {
  test('normalizes root page requests to index.html', () => {
    expect(getNavigationCachePath('/sl', '/sl')).toBe('/sl/index.html');
    expect(getNavigationCachePath('/sl', '/sl/')).toBe('/sl/index.html');
    expect(getNavigationCachePath('/sl', '/sl/index.html')).toBe('/sl/index.html');
  });

  test('normalizes embed page requests to embed.html', () => {
    expect(getNavigationCachePath('/sl', '/sl/embed')).toBe('/sl/embed.html');
    expect(getNavigationCachePath('/sl', '/sl/embed.html')).toBe('/sl/embed.html');
  });

  test('returns null for unknown routes', () => {
    expect(getNavigationCachePath('/sl', '/sl/unknown')).toBeNull();
  });
});

describe('getNavigationFallbackPath', () => {
  test('falls back to embed shell for embed routes', () => {
    expect(getNavigationFallbackPath('/sl', '/sl/embed')).toBe('/sl/embed.html');
    expect(getNavigationFallbackPath('/sl', '/sl/embed.html')).toBe('/sl/embed.html');
  });

  test('falls back to index shell for unknown routes', () => {
    expect(getNavigationFallbackPath('/sl', '/sl/unknown')).toBe('/sl/index.html');
  });
});
