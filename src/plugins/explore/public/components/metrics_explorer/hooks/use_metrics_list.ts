/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useOpenSearchDashboards } from '../../../../../opensearch_dashboards_react/public';
import { ExploreServices } from '../../../types';
import {
  getPrometheusClient,
  getDataConnectionId,
  getDataSourceMeta,
} from '../utils/prometheus_helpers';
import { MetricsExplorerCache, CACHE_TTL } from '../utils/metrics_explorer_cache';
import { groupMetrics, MetricGroup } from '../utils/metric_grouping';
import { GroupingMode } from '../utils/url_state_sync';

const MAX_METRICS = 5000;

export interface MetricInfo {
  name: string;
  type?: string;
  help?: string;
  unit?: string;
}

export interface UseMetricsListResult {
  metrics: MetricInfo[];
  groups: MetricGroup[];
  totalCount: number;
  isCapped: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Hook that fetches the metric list and metadata, applies search/filter,
 * groups the results, and enforces the 5k cardinality cap.
 */
export function useMetricsList(
  searchQuery: string,
  groupingMode: GroupingMode,
  browserLabelFilters: Record<string, string>,
  cache: MetricsExplorerCache
): UseMetricsListResult {
  const { services } = useOpenSearchDashboards<ExploreServices>();
  const [allMetrics, setAllMetrics] = useState<string[]>([]);
  const [metadataMap, setMetadataMap] = useState<Record<string, MetricInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    cache.invalidateData();
    setRefreshKey((k) => k + 1);
  }, [cache]);

  // Fetch metric names and metadata
  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;

    async function fetchMetrics() {
      setLoading(true);
      setError(null);

      try {
        const query = services.store.getState().query;
        const dataConnectionId = getDataConnectionId(query);
        const meta = getDataSourceMeta(query);

        if (!dataConnectionId) {
          setAllMetrics([]);
          setLoading(false);
          return;
        }

        const client = getPrometheusClient(services.data);
        const timeRange = services.data.query.timefilter.timefilter.getTime();

        // Fetch metrics list (deduped + cached)
        const metricNames = await cache.dedupe<string[]>(
          `metrics:${dataConnectionId}`,
          () => client.getMetrics(dataConnectionId, meta, timeRange),
          CACHE_TTL.DATA
        );

        if (cancelled) return;

        // Fetch metadata (deduped + cached)
        const rawMetadata = await cache.dedupe(
          `metadata:all:${dataConnectionId}`,
          () => client.getMetricMetadata(dataConnectionId, meta, undefined, timeRange),
          CACHE_TTL.METADATA
        );

        if (cancelled) return;

        // Build metadata lookup
        const infoMap: Record<string, MetricInfo> = {};
        for (const name of metricNames) {
          const meta_entry = rawMetadata[name];
          infoMap[name] = {
            name,
            type: meta_entry?.[0]?.type,
            help: meta_entry?.[0]?.help,
            unit: meta_entry?.[0]?.unit,
          };
        }

        setAllMetrics(metricNames);
        setMetadataMap(infoMap);
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'Failed to fetch metrics');
        setLoading(false);
      }
    }

    fetchMetrics();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [services, cache, refreshKey]);

  // Filter and group
  const { filteredMetrics, groups, totalCount, isCapped } = useMemo(() => {
    let filtered = allMetrics;

    // Apply search filter
    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      filtered = filtered.filter((name) => name.toLowerCase().includes(lower));
    }

    const total = filtered.length;
    const capped = total > MAX_METRICS;

    // Cap at 5k
    if (capped) {
      filtered = filtered.slice(0, MAX_METRICS);
    }

    const grouped = groupMetrics(filtered, groupingMode);

    return {
      filteredMetrics: filtered,
      groups: grouped,
      totalCount: total,
      isCapped: capped,
    };
  }, [allMetrics, searchQuery, groupingMode]);

  const metrics = useMemo(
    () => filteredMetrics.map((name) => metadataMap[name] || { name }),
    [filteredMetrics, metadataMap]
  );

  return { metrics, groups, totalCount, isCapped, loading, error, refresh };
}
