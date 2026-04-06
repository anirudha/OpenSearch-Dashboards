/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  EuiSpacer,
  EuiEmptyPrompt,
  EuiButtonEmpty,
  EuiHorizontalRule,
} from '@elastic/eui';
import { useMetricsExplorer } from '../metrics_explorer_context';
import { useMetricDetail } from '../hooks/use_metric_detail';
import { MetricMetadataPanel } from './metric_metadata_panel';
import { MetricFullChart } from './metric_full_chart';
import { LabelSelector } from './label_selector';
import { QueryActions } from './query_actions';
import { MetricsExplorerCache } from '../utils/metrics_explorer_cache';
import { PromQLQueryGenerator } from '../utils/promql_query_generator';

// Shared singletons
const cache = new MetricsExplorerCache();
const queryGenerator = new PromQLQueryGenerator();

/**
 * Metric Detail — Level 2 of the Metrics Explorer drill-down.
 * Shows full chart, metadata, labels, and query actions for a single metric.
 */
export const MetricDetail: React.FC = () => {
  const { state, actions } = useMetricsExplorer();

  const { data, loading, error } = useMetricDetail(
    state.selectedMetric,
    state.labelFilters,
    cache,
    queryGenerator
  );

  if (!state.selectedMetric) {
    return (
      <EuiEmptyPrompt
        iconType="metricsApp"
        title={<h3>No metric selected</h3>}
        body={<p>Select a metric from the browser to view its details.</p>}
      />
    );
  }

  if (error) {
    return (
      <EuiEmptyPrompt
        iconType="alert"
        color="danger"
        title={<h3>Failed to load metric</h3>}
        body={<p>{error}</p>}
        actions={
          <EuiButtonEmpty onClick={() => actions.navigateBack()} iconType="arrowLeft">
            Back to browser
          </EuiButtonEmpty>
        }
      />
    );
  }

  return (
    <div>
      {/* Metadata */}
      <MetricMetadataPanel
        metricName={state.selectedMetric}
        type={data.metadata?.type}
        help={data.metadata?.help}
        unit={data.metadata?.unit}
      />

      <EuiSpacer size="s" />

      {/* Query actions */}
      <QueryActions
        metricName={state.selectedMetric}
        metricType={data.metadata?.type}
        labelFilters={state.labelFilters}
        queryGenerator={queryGenerator}
      />

      <EuiSpacer size="m" />

      {/* Full chart */}
      <MetricFullChart
        data={data.chartData}
        metricName={state.selectedMetric}
        metricType={data.metadata?.type}
        loading={loading}
      />

      <EuiHorizontalRule margin="m" />

      {/* Label selector for drill-down */}
      <LabelSelector
        labels={data.labels}
        loading={loading}
        onSelectLabel={actions.selectLabel}
      />
    </div>
  );
};
