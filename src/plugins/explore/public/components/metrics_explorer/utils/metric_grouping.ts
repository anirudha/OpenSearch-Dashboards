/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MetricGroup {
  prefix: string;
  metrics: string[];
}

/**
 * Extract the prefix from a metric name.
 * Handles both underscore-delimited (Prometheus: http_requests_total)
 * and dot-delimited (OpenTelemetry: otel.http.server.duration) naming.
 */
function extractPrefix(name: string): string {
  // Try underscore first (most common for Prometheus)
  const underscoreIdx = name.indexOf('_');
  if (underscoreIdx > 0) {
    return name.substring(0, underscoreIdx + 1);
  }

  // Try dot delimiter (OTel conventions)
  const dotIdx = name.indexOf('.');
  if (dotIdx > 0) {
    return name.substring(0, dotIdx + 1);
  }

  return name;
}

/**
 * Group metrics by their name prefix.
 * Returns groups sorted by prefix, each containing sorted metric names.
 */
export function groupByPrefix(metrics: string[]): MetricGroup[] {
  const groups = new Map<string, string[]>();

  for (const name of metrics) {
    const prefix = extractPrefix(name);
    const group = groups.get(prefix);
    if (group) {
      group.push(name);
    } else {
      groups.set(prefix, [name]);
    }
  }

  return Array.from(groups.entries())
    .map(([prefix, metricList]) => ({
      prefix,
      metrics: metricList.sort(),
    }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix));
}

/**
 * Group metrics alphabetically into letter-based groups.
 */
export function groupAlphabetically(metrics: string[]): MetricGroup[] {
  const sorted = [...metrics].sort();
  const groups = new Map<string, string[]>();

  for (const name of sorted) {
    const letter = name[0]?.toUpperCase() || '#';
    const group = groups.get(letter);
    if (group) {
      group.push(name);
    } else {
      groups.set(letter, [name]);
    }
  }

  return Array.from(groups.entries())
    .map(([prefix, metricList]) => ({ prefix, metrics: metricList }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix));
}

/**
 * Return metrics as a flat list (single group, no grouping).
 */
export function groupFlat(metrics: string[]): MetricGroup[] {
  return [{ prefix: 'All Metrics', metrics: [...metrics].sort() }];
}

/**
 * Group metrics based on the selected grouping mode.
 */
export function groupMetrics(
  metrics: string[],
  mode: 'prefix' | 'alphabetical' | 'label'
): MetricGroup[] {
  switch (mode) {
    case 'prefix':
      return groupByPrefix(metrics);
    case 'alphabetical':
      return groupAlphabetically(metrics);
    case 'label':
      // Label-based grouping is handled separately (requires series data)
      return groupFlat(metrics);
    default:
      return groupByPrefix(metrics);
  }
}
