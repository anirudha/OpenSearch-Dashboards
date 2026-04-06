/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { MetricsExplorerCache, CACHE_TTL } from './metrics_explorer_cache';

const DEFAULT_RATE_INTERVAL = '1m';
const SCRAPE_CONFIG_CACHE_KEY = 'metadata:scrape_interval';

/**
 * Parses a Prometheus duration string (e.g., "15s", "1m", "5m") to seconds.
 */
function parseDurationToSeconds(duration: string): number | null {
  const match = duration.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 'ms':
      return value / 1000;
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return null;
  }
}

/**
 * Converts seconds to a Prometheus duration string suitable for rate().
 */
function secondsToDuration(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

/**
 * Computes the recommended rate interval based on scrape interval.
 * Uses the Prometheus team's heuristic: max(4 * scrape_interval, 1m).
 */
export function computeRateInterval(scrapeIntervalStr: string): string {
  const scrapeSeconds = parseDurationToSeconds(scrapeIntervalStr);
  if (scrapeSeconds === null) return DEFAULT_RATE_INTERVAL;

  const rateSeconds = Math.max(4 * scrapeSeconds, 60);
  return secondsToDuration(rateSeconds);
}

/**
 * Attempts to detect scrape interval from the Prometheus config API.
 * Falls back to default if the API is unavailable or the response is unparseable.
 */
export async function detectScrapeInterval(
  fetchConfig: () => Promise<any>,
  cache: MetricsExplorerCache
): Promise<string> {
  const cached = cache.get<string>(SCRAPE_CONFIG_CACHE_KEY, CACHE_TTL.METADATA);
  if (cached) return cached;

  try {
    const config = await fetchConfig();
    const globalScrapeInterval =
      config?.data?.yaml?.global?.scrape_interval ||
      config?.data?.global?.scrape_interval;

    if (globalScrapeInterval && typeof globalScrapeInterval === 'string') {
      const rateInterval = computeRateInterval(globalScrapeInterval);
      cache.set(SCRAPE_CONFIG_CACHE_KEY, rateInterval);
      return rateInterval;
    }
  } catch {
    // Config API not available — use default
  }

  cache.set(SCRAPE_CONFIG_CACHE_KEY, DEFAULT_RATE_INTERVAL);
  return DEFAULT_RATE_INTERVAL;
}
