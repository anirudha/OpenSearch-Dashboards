/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { MetricQueryGenerator } from './metric_query_generator';

/**
 * Escapes special regex characters in metric names for use in Prometheus match selectors.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSelector(
  metricName: string,
  labelFilters: Record<string, string>,
  options?: { breakdownLabel?: string }
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(labelFilters)) {
    parts.push(`${key}="${value}"`);
  }
  const filterStr = parts.join(', ');
  return filterStr ? `${metricName}{${filterStr}}` : metricName;
}

function wrapTopk(query: string, topk?: number, breakdownLabel?: string): string {
  if (!topk) return query;
  if (breakdownLabel) {
    return `topk(${topk}, ${query}) by (${breakdownLabel})`;
  }
  return `topk(${topk}, ${query})`;
}

/**
 * Default PromQL query generator.
 * Generates type-aware PromQL based on metric metadata.
 */
export class PromQLQueryGenerator implements MetricQueryGenerator {
  private rateInterval: string;

  constructor(rateInterval: string = '1m') {
    this.rateInterval = rateInterval;
  }

  setRateInterval(interval: string) {
    this.rateInterval = interval;
  }

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
  }): string {
    const { metricName, metricType, labelFilters, options } = params;
    const interval = options?.rateInterval || this.rateInterval;
    const quantile = options?.quantile ?? 0.95;
    const selector = buildSelector(metricName, labelFilters, options);

    let query: string;

    switch (metricType) {
      case 'counter':
        query = `rate(${selector}[${interval}])`;
        break;
      case 'histogram': {
        const bucketSelector = buildSelector(`${metricName}_bucket`, labelFilters, options);
        query = `histogram_quantile(${quantile}, rate(${bucketSelector}[${interval}]))`;
        break;
      }
      case 'gauge':
      case 'summary':
      case 'unknown':
      default:
        query = selector;
        break;
    }

    return wrapTopk(query, options?.topk, options?.breakdownLabel);
  }

  generateBatch(params: {
    metricNames: string[];
    metricTypes: Record<string, string | undefined>;
    labelFilters: Record<string, string>;
  }): string | null {
    const { metricNames, metricTypes, labelFilters } = params;

    // Can only batch gauges/unknowns/summaries — counters and histograms need rate()
    const batchable = metricNames.filter((name) => {
      const t = metricTypes[name];
      return !t || t === 'gauge' || t === 'unknown' || t === 'summary';
    });

    if (batchable.length === 0) return null;

    const escaped = batchable.map(escapeRegex);
    const nameRegex = escaped.join('|');

    const parts: string[] = [`__name__=~"${nameRegex}"`];
    for (const [key, value] of Object.entries(labelFilters)) {
      parts.push(`${key}="${value}"`);
    }

    return `{${parts.join(', ')}}`;
  }
}
