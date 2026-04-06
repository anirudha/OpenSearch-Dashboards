/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pluggable interface for generating metric queries.
 * Default implementation is PromQLQueryGenerator.
 * Future implementations can support OpenTelemetry or other query languages.
 */
export interface MetricQueryGenerator {
  /**
   * Generate a query for a single metric with optional label filters.
   */
  generate(params: {
    metricName: string;
    metricType: string | undefined;
    labelFilters: Record<string, string>;
    options?: {
      rateInterval?: string;
      quantile?: number;
      topk?: number;
      breakdownLabel?: string;
    };
  }): string;

  /**
   * Generate a batch query for multiple metrics (sparkline optimization).
   * Returns null if batching is not supported for the given metric types.
   */
  generateBatch?(params: {
    metricNames: string[];
    metricTypes: Record<string, string | undefined>;
    labelFilters: Record<string, string>;
  }): string | null;

  /**
   * Detect the optimal rate interval for this data source.
   * Returns interval string (e.g., "1m", "5m") or null if not applicable.
   */
  detectRateInterval?(): Promise<string | null>;
}
