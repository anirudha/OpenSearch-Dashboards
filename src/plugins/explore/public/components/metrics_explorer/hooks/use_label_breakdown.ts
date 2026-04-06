/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { useOpenSearchDashboards } from '../../../../../opensearch_dashboards_react/public';
import { ExploreServices } from '../../../types';
import {
  getPrometheusClient,
  getDataConnectionId,
  getDataSourceMeta,
  executeWithConcurrencyLimit,
} from '../utils/prometheus_helpers';
import { PromQLQueryGenerator } from '../utils/promql_query_generator';
import { MetricsExplorerCache, CACHE_TTL } from '../utils/metrics_explorer_cache';
import { SparklinePoint } from './use_sparkline_data';

const MAX_LABEL_VALUES = 20;
const BREAKDOWN_CONCURRENCY = 5;

export interface LabelValueData {
  value: string;
  chartData: SparklinePoint[];
}

export interface UseLabelBreakdownResult {
  values: LabelValueData[];
  loading: boolean;
  error: string | null;
  totalValues: number;
}

/**
 * Hook that fetches label values for a specific metric + label combination,
 * then fetches chart data for each value using topk(20) for server-side limiting.
 */
export function useLabelBreakdown(
  metricName: string | null,
  labelName: string | null,
  metricType: string | undefined,
  labelFilters: Record<string, string>,
  cache: MetricsExplorerCache,
  queryGenerator: PromQLQueryGenerator
): UseLabelBreakdownResult {
  const { services } = useOpenSearchDashboards<ExploreServices>();
  const [values, setValues] = useState<LabelValueData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalValues, setTotalValues] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!metricName || !labelName) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;

    async function fetchBreakdown() {
      setLoading(true);
      setError(null);

      try {
        const query = services.store.getState().query;
        const dataConnectionId = getDataConnectionId(query);
        const meta = getDataSourceMeta(query);

        if (!dataConnectionId) {
          setLoading(false);
          return;
        }

        const client = getPrometheusClient(services.data) as any;
        const timeRange = services.data.query.timefilter.timefilter.getTime();

        type SeriesArray = Array<Record<string, string>>;
        type QueryResult = { resultType: string; result: Array<{ metric: Record<string, string>; values: Array<[number, string]> }> };

        // Get label values scoped to this metric via /series API
        const seriesData = await cache.dedupe<SeriesArray>(
          `series:${metricName}:${dataConnectionId}`,
          () =>
            client.getSeries(
              dataConnectionId,
              `{__name__="${metricName}"}`,
              meta,
              timeRange
            ),
          CACHE_TTL.DATA
        );

        if (cancelled) return;

        // Extract unique values for the selected label
        const uniqueValues = new Set<string>();
        if (Array.isArray(seriesData)) {
          for (const series of seriesData) {
            const val = series[labelName!];
            if (val) uniqueValues.add(val);
          }
        }

        const allValues = Array.from(uniqueValues).sort();
        setTotalValues(allValues.length);

        // Take top N values (server-side topk handles ranking)
        const topValues = allValues.slice(0, MAX_LABEL_VALUES);

        // Fetch chart data for each value concurrently
        const result: LabelValueData[] = [];

        const tasks = topValues.map((value) => async () => {
          if (cancelled) return;

          const filters = { ...labelFilters, [labelName!]: value };
          const promql = queryGenerator.generate({
            metricName: metricName!,
            metricType,
            labelFilters: filters,
          });

          const cacheKey = `breakdown:${metricName}:${labelName}:${value}:${dataConnectionId}`;
          const chartResult = await cache.dedupe<QueryResult>(
            cacheKey,
            () => client.queryRange(dataConnectionId, promql, timeRange, undefined, meta),
            CACHE_TTL.DATA
          );

          if (cancelled) return;

          let chartData: SparklinePoint[] = [];
          if (chartResult?.result?.[0]?.values) {
            chartData = chartResult.result[0].values.map(
              ([ts, val]: [number, string]) => [ts, parseFloat(val)] as SparklinePoint
            );
          }

          result.push({ value, chartData });
        });

        await executeWithConcurrencyLimit(tasks, BREAKDOWN_CONCURRENCY);

        if (cancelled) return;

        // Sort by value to maintain consistent ordering
        result.sort((a, b) => a.value.localeCompare(b.value));

        setValues(result);
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'Failed to load label breakdown');
        setLoading(false);
      }
    }

    fetchBreakdown();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [metricName, labelName, metricType, labelFilters, services, cache, queryGenerator]);

  return { values, loading, error, totalValues };
}
