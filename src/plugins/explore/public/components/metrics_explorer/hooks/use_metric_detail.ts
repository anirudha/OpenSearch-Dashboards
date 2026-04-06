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
} from '../utils/prometheus_helpers';
import { MetricsExplorerCache, CACHE_TTL } from '../utils/metrics_explorer_cache';
import { PromQLQueryGenerator } from '../utils/promql_query_generator';
import { SparklinePoint } from './use_sparkline_data';

export interface MetricDetailData {
  metadata: { type: string; help: string; unit: string } | null;
  labels: string[];
  chartData: SparklinePoint[];
}

export interface UseMetricDetailResult {
  data: MetricDetailData;
  loading: boolean;
  error: string | null;
}

/**
 * Hook that fetches metadata, labels (via /series), and chart data
 * for a single selected metric in parallel.
 */
export function useMetricDetail(
  metricName: string | null,
  labelFilters: Record<string, string>,
  cache: MetricsExplorerCache,
  queryGenerator: PromQLQueryGenerator
): UseMetricDetailResult {
  const { services } = useOpenSearchDashboards<ExploreServices>();
  const [data, setData] = useState<MetricDetailData>({
    metadata: null,
    labels: [],
    chartData: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!metricName) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;

    async function fetchDetail() {
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

        type MetadataMap = Record<string, Array<{ type: string; help: string; unit: string }>>;
        type SeriesArray = Array<Record<string, string>>;
        type QueryResult = { resultType: string; result: Array<{ metric: Record<string, string>; values: Array<[number, string]> }> };

        // Run three fetches in parallel: metadata, labels (via /series), chart data
        const [metadataResult, seriesResult, chartResult] = await Promise.all([
          // 1. Metadata
          cache.dedupe<MetadataMap>(
            `metadata:${metricName}:${dataConnectionId}`,
            () => client.getMetricMetadata(dataConnectionId, meta, metricName!, timeRange),
            CACHE_TTL.METADATA
          ),

          // 2. Labels via /series (scoped to metric — avoids cardinality bomb)
          cache.dedupe<SeriesArray>(
            `series:${metricName}:${dataConnectionId}`,
            () =>
              client.getSeries(
                dataConnectionId,
                `{__name__="${metricName!}"}`,
                meta,
                timeRange
              ),
            CACHE_TTL.DATA
          ),

          // 3. Chart data
          cache.dedupe<QueryResult>(
            `chart:${metricName}:${dataConnectionId}:${JSON.stringify(labelFilters)}`,
            () => {
              const promql = queryGenerator.generate({
                metricName: metricName!,
                metricType: undefined, // Will be refined after metadata loads
                labelFilters,
              });
              return client.queryRange(dataConnectionId, promql, timeRange, undefined, meta);
            },
            CACHE_TTL.DATA
          ),
        ]);

        if (cancelled) return;

        // Parse metadata
        let parsedMetadata: MetricDetailData['metadata'] = null;
        if (metadataResult?.[metricName!]?.[0]) {
          const entry = metadataResult[metricName!][0];
          parsedMetadata = { type: entry.type, help: entry.help, unit: entry.unit };
        }

        // Extract unique label names from series (excluding __name__)
        const labelSet = new Set<string>();
        if (Array.isArray(seriesResult)) {
          for (const series of seriesResult) {
            for (const key of Object.keys(series)) {
              if (key !== '__name__') {
                labelSet.add(key);
              }
            }
          }
        }
        const labels = Array.from(labelSet).sort();

        // Parse chart data
        let chartData: SparklinePoint[] = [];
        if (chartResult?.result?.[0]?.values) {
          chartData = chartResult.result[0].values.map(
            ([ts, val]: [number, string]) => [ts, parseFloat(val)] as SparklinePoint
          );
        }

        setData({ metadata: parsedMetadata, labels, chartData });

        // If we now have the type, re-fetch chart with type-aware query
        if (parsedMetadata?.type && parsedMetadata.type !== 'gauge') {
          const typedPromql = queryGenerator.generate({
            metricName: metricName!,
            metricType: parsedMetadata.type,
            labelFilters,
          });

          const typedChart = await cache.dedupe<QueryResult>(
            `chart:typed:${metricName}:${dataConnectionId}:${JSON.stringify(labelFilters)}`,
            () => client.queryRange(dataConnectionId, typedPromql, timeRange, undefined, meta),
            CACHE_TTL.DATA
          );

          if (cancelled) return;

          if (typedChart?.result?.[0]?.values) {
            setData((prev) => ({
              ...prev,
              chartData: typedChart.result[0].values.map(
                ([ts, val]: [number, string]) => [ts, parseFloat(val)] as SparklinePoint
              ),
            }));
          }
        }

        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'Failed to load metric detail');
        setLoading(false);
      }
    }

    fetchDetail();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [metricName, labelFilters, services, cache, queryGenerator]);

  return { data, loading, error };
}
