/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataPublicPluginStart, TimeRange } from '../../../../../data/public';

/**
 * Interface matching the PrometheusResourceClient methods we use.
 * Avoids importing the concrete class from query_enhancements.
 */
export interface PrometheusClient {
  getMetrics: (
    dataConnectionId: string,
    meta?: Record<string, unknown>,
    timeRange?: TimeRange
  ) => Promise<string[]>;
  getMetricMetadata: (
    dataConnectionId: string,
    meta?: Record<string, unknown>,
    metric?: string,
    timeRange?: TimeRange
  ) => Promise<Record<string, Array<{ type: string; unit: string; help: string }>>>;
  getLabels: (
    dataConnectionId: string,
    meta?: Record<string, unknown>,
    metric?: string,
    timeRange?: TimeRange
  ) => Promise<string[]>;
  getLabelValues: (
    dataConnectionId: string,
    meta?: Record<string, unknown>,
    label?: string,
    timeRange?: TimeRange
  ) => Promise<string[]>;
  getSeries: (
    dataConnectionId: string,
    match: string,
    meta?: Record<string, unknown>,
    timeRange?: TimeRange
  ) => Promise<Array<Record<string, string>>>;
  queryRange: (
    dataConnectionId: string,
    query: string,
    timeRange: TimeRange,
    step?: string,
    meta?: Record<string, unknown>
  ) => Promise<{
    resultType: string;
    result: Array<{
      metric: Record<string, string>;
      values: Array<[number, string]>;
    }>;
  }>;
}

/**
 * Get the Prometheus resource client from the data plugin.
 */
export function getPrometheusClient(data: DataPublicPluginStart): PrometheusClient {
  const client = data.resourceClientFactory.get<PrometheusClient>('prometheus');
  if (!client) {
    throw new Error('Prometheus resource client not found');
  }
  return client;
}

/**
 * Extract the data connection ID from the Redux query state.
 */
export function getDataConnectionId(query: { dataset?: { id?: string } }): string {
  return query.dataset?.id || '';
}

/**
 * Extract the data source meta from the Redux query state.
 */
export function getDataSourceMeta(
  query: { dataset?: { dataSource?: { meta?: unknown } } }
): Record<string, unknown> | undefined {
  return query.dataset?.dataSource?.meta as Record<string, unknown> | undefined;
}

/**
 * Execute tasks with a concurrency limit.
 */
export async function executeWithConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map((task) => task()));
    results.push(...batchResults);
  }
  return results;
}
