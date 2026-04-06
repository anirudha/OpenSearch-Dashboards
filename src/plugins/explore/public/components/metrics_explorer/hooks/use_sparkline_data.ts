/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useOpenSearchDashboards } from '../../../../../opensearch_dashboards_react/public';
import { ExploreServices } from '../../../types';
import {
  getPrometheusClient,
  getDataConnectionId,
  getDataSourceMeta,
  executeWithConcurrencyLimit,
  PrometheusClient,
} from '../utils/prometheus_helpers';
import { PromQLQueryGenerator } from '../utils/promql_query_generator';
import { MetricsExplorerCache, CACHE_TTL } from '../utils/metrics_explorer_cache';
import { MetricInfo } from './use_metrics_list';

const SPARKLINE_CONCURRENCY = 5;
const SPARKLINE_BATCH_SIZE = 20;
const TIME_RANGE_DEBOUNCE_MS = 800;

export type SparklinePoint = [number, number]; // [timestamp, value]

export interface SparklineData {
  [metricName: string]: SparklinePoint[];
}

export interface UseSparklineDataResult {
  sparklines: SparklineData;
  loading: boolean;
}

/**
 * Fetches sparkline data for visible metrics.
 * Batches gauge metrics via regex matching, fetches counters/histograms individually.
 * Uses concurrency limiting and debounce on time range changes.
 */
export function useSparklineData(
  visibleMetrics: MetricInfo[],
  cache: MetricsExplorerCache,
  queryGenerator: PromQLQueryGenerator
): UseSparklineDataResult {
  const { services } = useOpenSearchDashboards<ExploreServices>();
  const [sparklines, setSparklines] = useState<SparklineData>({});
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const metricNames = useMemo(
    () => visibleMetrics.map((m) => m.name),
    [visibleMetrics]
  );

  const metricTypes = useMemo(() => {
    const types: Record<string, string | undefined> = {};
    for (const m of visibleMetrics) {
      types[m.name] = m.type;
    }
    return types;
  }, [visibleMetrics]);

  useEffect(() => {
    if (metricNames.length === 0) {
      setSparklines({});
      return;
    }

    // Debounce to handle time range changes
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      fetchSparklines();
    }, TIME_RANGE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };

    async function fetchSparklines() {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);

      try {
        const query = services.store.getState().query;
        const dataConnectionId = getDataConnectionId(query);
        const meta = getDataSourceMeta(query);

        if (!dataConnectionId) {
          setLoading(false);
          return;
        }

        const client = getPrometheusClient(services.data) as PrometheusClient & {
          queryRange: (
            dataConnectionId: string,
            query: string,
            timeRange: any,
            step?: string,
            meta?: Record<string, unknown>
          ) => Promise<any>;
        };
        const timeRange = services.data.query.timefilter.timefilter.getTime();

        const result: SparklineData = {};
        const tasks: Array<() => Promise<void>> = [];

        // Separate batchable (gauges) from non-batchable (counters, histograms)
        const batchable: string[] = [];
        const individual: string[] = [];

        for (const name of metricNames) {
          const t = metricTypes[name];
          if (!t || t === 'gauge' || t === 'unknown' || t === 'summary') {
            batchable.push(name);
          } else {
            individual.push(name);
          }
        }

        // Batch gauge queries
        for (let i = 0; i < batchable.length; i += SPARKLINE_BATCH_SIZE) {
          const batch = batchable.slice(i, i + SPARKLINE_BATCH_SIZE);
          const batchQuery = queryGenerator.generateBatch({
            metricNames: batch,
            metricTypes,
            labelFilters: {},
          });

          if (batchQuery) {
            tasks.push(async () => {
              if (controller.signal.aborted) return;

              const cacheKey = `sparkline:batch:${batch.join(',')}`;
              const data = await cache.dedupe(
                cacheKey,
                () => client.queryRange(dataConnectionId, batchQuery, timeRange, undefined, meta),
                CACHE_TTL.DATA
              );

              if (controller.signal.aborted) return;

              // Parse matrix results into per-metric sparklines
              if (data?.result) {
                for (const series of data.result) {
                  const metricName = series.metric?.__name__;
                  if (metricName && batch.includes(metricName)) {
                    result[metricName] = (series.values || []).map(
                      ([ts, val]: [number, string]) => [ts, parseFloat(val)] as SparklinePoint
                    );
                  }
                }
              }
            });
          }
        }

        // Individual queries for counters/histograms
        for (const name of individual) {
          tasks.push(async () => {
            if (controller.signal.aborted) return;

            const promql = queryGenerator.generate({
              metricName: name,
              metricType: metricTypes[name],
              labelFilters: {},
            });

            const cacheKey = `sparkline:${name}`;
            const data = await cache.dedupe(
              cacheKey,
              () => client.queryRange(dataConnectionId, promql, timeRange, undefined, meta),
              CACHE_TTL.DATA
            );

            if (controller.signal.aborted) return;

            if (data?.result?.[0]?.values) {
              result[name] = data.result[0].values.map(
                ([ts, val]: [number, string]) => [ts, parseFloat(val)] as SparklinePoint
              );
            }
          });
        }

        await executeWithConcurrencyLimit(tasks.map((t) => t), SPARKLINE_CONCURRENCY);

        if (!controller.signal.aborted) {
          setSparklines(result);
          setLoading(false);
        }
      } catch (err: any) {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
  }, [metricNames, metricTypes, services, cache, queryGenerator]);

  return { sparklines, loading };
}
