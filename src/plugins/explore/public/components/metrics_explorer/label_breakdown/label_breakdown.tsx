/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  EuiText,
  EuiLoadingSpinner,
  EuiEmptyPrompt,
  EuiButtonEmpty,
  EuiCallOut,
} from '@elastic/eui';
import { useMetricsExplorer } from '../metrics_explorer_context';
import { useLabelBreakdown } from '../hooks/use_label_breakdown';
import { LabelValueCard } from './label_value_card';
import { MetricsExplorerCache } from '../utils/metrics_explorer_cache';
import { PromQLQueryGenerator } from '../utils/promql_query_generator';

const cache = new MetricsExplorerCache();
const queryGenerator = new PromQLQueryGenerator();

/**
 * Label Breakdown — Level 3 of the Metrics Explorer drill-down.
 * Displays small-multiple charts for each value of the selected label.
 */
export const LabelBreakdown: React.FC = () => {
  const { state, actions } = useMetricsExplorer();

  const { values, loading, error, totalValues } = useLabelBreakdown(
    state.selectedMetric,
    state.selectedLabel,
    state.metricMetadata?.type,
    state.labelFilters,
    cache,
    queryGenerator
  );

  if (!state.selectedMetric || !state.selectedLabel) {
    return (
      <EuiEmptyPrompt
        iconType="metricsApp"
        title={<h3>No label selected</h3>}
        body={<p>Select a label from the metric detail view.</p>}
      />
    );
  }

  if (error) {
    return (
      <EuiEmptyPrompt
        iconType="alert"
        color="danger"
        title={<h3>Failed to load breakdown</h3>}
        body={<p>{error}</p>}
        actions={
          <EuiButtonEmpty onClick={() => actions.navigateBack()} iconType="arrowLeft">
            Back to detail
          </EuiButtonEmpty>
        }
      />
    );
  }

  if (loading) {
    return (
      <EuiEmptyPrompt
        icon={<EuiLoadingSpinner size="xl" />}
        title={<h3>Loading breakdown</h3>}
        body={
          <p>
            Fetching values for <strong>{state.selectedLabel}</strong>...
          </p>
        }
      />
    );
  }

  return (
    <div>
      <EuiText>
        <h3>
          {state.selectedMetric} by <strong>{state.selectedLabel}</strong>
        </h3>
      </EuiText>

      <EuiSpacer size="s" />

      {totalValues > 20 && (
        <>
          <EuiCallOut
            title={`Showing top 20 of ${totalValues} values`}
            color="warning"
            iconType="alert"
            size="s"
          />
          <EuiSpacer size="s" />
        </>
      )}

      {values.length === 0 ? (
        <EuiText color="subdued">
          No values found for label <strong>{state.selectedLabel}</strong>.
        </EuiText>
      ) : (
        <EuiFlexGroup gutterSize="m" wrap responsive>
          {values.map((item) => (
            <EuiFlexItem key={item.value} grow={false}>
              <LabelValueCard
                value={item.value}
                chartData={item.chartData}
                metricType={state.metricMetadata?.type}
              />
            </EuiFlexItem>
          ))}
        </EuiFlexGroup>
      )}
    </div>
  );
};
