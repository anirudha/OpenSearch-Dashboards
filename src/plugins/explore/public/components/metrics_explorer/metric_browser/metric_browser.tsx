/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useCallback } from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  EuiLoadingSpinner,
  EuiEmptyPrompt,
  EuiButtonEmpty,
  EuiText,
} from '@elastic/eui';
import { useMetricsExplorer } from '../metrics_explorer_context';
import { useMetricsList, MetricInfo } from '../hooks/use_metrics_list';
import { useSparklineData } from '../hooks/use_sparkline_data';
import { MetricSearchBar } from './metric_search_bar';
import { LabelFilterBar } from './label_filter_bar';
import { GroupingToggle } from './grouping_toggle';
import { CardinalityBanner } from './cardinality_banner';
import { MetricGroupComponent } from './metric_group';
import { ComparisonOverlay } from './comparison_overlay';
import { MetricsExplorerCache } from '../utils/metrics_explorer_cache';
import { PromQLQueryGenerator } from '../utils/promql_query_generator';

// Module-level singletons shared across re-renders
const cache = new MetricsExplorerCache();
const queryGenerator = new PromQLQueryGenerator();

/**
 * Metric Browser — Level 1 of the Metrics Explorer drill-down.
 * Searchable, filterable grid of metric cards with sparklines.
 */
export const MetricBrowser: React.FC = () => {
  const { state, actions } = useMetricsExplorer();

  const { metrics, groups, totalCount, isCapped, loading, error, refresh } = useMetricsList(
    state.searchQuery,
    state.groupingMode,
    state.browserLabelFilters,
    cache
  );

  // Build a lookup map for metric info
  const metricsMap = useMemo(() => {
    const map: Record<string, MetricInfo> = {};
    for (const m of metrics) {
      map[m.name] = m;
    }
    return map;
  }, [metrics]);

  // Get sparkline data for the first batch of visible metrics
  const visibleMetrics = useMemo(() => {
    // Only fetch sparklines for the first ~100 visible metrics to limit load
    return metrics.slice(0, 100);
  }, [metrics]);

  const { sparklines, loading: sparklineLoading } = useSparklineData(
    visibleMetrics,
    cache,
    queryGenerator
  );

  const handleRemoveCompareMetric = useCallback(
    (name: string) => actions.toggleMetricSelection(name),
    [actions]
  );

  const handleClearCompare = useCallback(() => {
    for (const name of state.selectedMetrics) {
      actions.toggleMetricSelection(name);
    }
  }, [actions, state.selectedMetrics]);

  if (loading && metrics.length === 0) {
    return (
      <EuiEmptyPrompt
        icon={<EuiLoadingSpinner size="xl" />}
        title={<h3>Loading metrics</h3>}
        body={<p>Fetching metric names and metadata...</p>}
      />
    );
  }

  if (error) {
    return (
      <EuiEmptyPrompt
        iconType="alert"
        color="danger"
        title={<h3>Failed to load metrics</h3>}
        body={<p>{error}</p>}
        actions={
          <EuiButtonEmpty onClick={refresh} iconType="refresh">
            Retry
          </EuiButtonEmpty>
        }
      />
    );
  }

  if (metrics.length === 0 && !loading) {
    return (
      <EuiEmptyPrompt
        iconType="search"
        title={<h3>No metrics found</h3>}
        body={
          state.searchQuery ? (
            <p>No metrics match "{state.searchQuery}". Try a different search term.</p>
          ) : (
            <p>No metrics are available from this data connection.</p>
          )
        }
      />
    );
  }

  return (
    <div>
      {/* Search and controls */}
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
        <EuiFlexItem>
          <MetricSearchBar
            value={state.searchQuery}
            onChange={actions.setSearchQuery}
            resultCount={metrics.length}
            totalCount={totalCount}
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <GroupingToggle selected={state.groupingMode} onChange={actions.setGroupingMode} />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty size="s" iconType="refresh" onClick={refresh}>
            Refresh
          </EuiButtonEmpty>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="s" />

      {/* Label filters */}
      <LabelFilterBar
        filters={state.browserLabelFilters}
        onRemove={actions.removeBrowserLabelFilter}
      />

      {/* Cardinality warning */}
      <CardinalityBanner totalCount={totalCount} isCapped={isCapped} />

      <EuiSpacer size="s" />

      {/* Result count */}
      <EuiText size="xs" color="subdued">
        Showing {metrics.length.toLocaleString()} metric{metrics.length !== 1 ? 's' : ''}
        {sparklineLoading && ' (loading sparklines...)'}
      </EuiText>

      <EuiSpacer size="s" />

      {/* Metric groups */}
      {groups.map((group) => (
        <React.Fragment key={group.prefix}>
          <MetricGroupComponent
            prefix={group.prefix}
            metricNames={group.metrics}
            metricsMap={metricsMap}
            sparklines={sparklines}
            selectedMetrics={state.selectedMetrics}
            onSelectMetric={actions.selectMetric}
            onToggleCompare={actions.toggleMetricSelection}
          />
          <EuiSpacer size="xs" />
        </React.Fragment>
      ))}

      {/* Comparison overlay */}
      <ComparisonOverlay
        selectedMetrics={state.selectedMetrics}
        sparklines={sparklines}
        onRemoveMetric={handleRemoveCompareMetric}
        onClear={handleClearCompare}
      />
    </div>
  );
};
