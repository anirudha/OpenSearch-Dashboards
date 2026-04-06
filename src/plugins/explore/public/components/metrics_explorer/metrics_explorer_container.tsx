/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense } from 'react';
import {
  EuiBreadcrumbs,
  EuiSpacer,
  EuiLoadingSpinner,
  EuiFlexGroup,
  EuiFlexItem,
} from '@elastic/eui';
import { useMetricsExplorer } from './metrics_explorer_context';
import { MetricBrowser } from './metric_browser/metric_browser';
import { MetricDetail } from './metric_detail/metric_detail';
import { LabelBreakdown } from './label_breakdown/label_breakdown';

export const MetricsExplorerContainer: React.FC = () => {
  const { state, actions } = useMetricsExplorer();

  const breadcrumbs = [];

  breadcrumbs.push({
    text: 'All Metrics',
    onClick:
      state.currentView !== 'browser'
        ? () => actions.reset()
        : undefined,
  });

  if (state.selectedMetric && (state.currentView === 'detail' || state.currentView === 'breakdown')) {
    breadcrumbs.push({
      text: state.selectedMetric,
      onClick:
        state.currentView === 'breakdown'
          ? () => actions.navigateBack()
          : undefined,
    });
  }

  if (state.selectedLabel && state.currentView === 'breakdown') {
    breadcrumbs.push({
      text: state.selectedLabel,
    });
  }

  const renderContent = () => {
    switch (state.currentView) {
      case 'detail':
        return <MetricDetail />;
      case 'breakdown':
        return <LabelBreakdown />;
      case 'compare':
      case 'browser':
      default:
        return <MetricBrowser />;
    }
  };

  return (
    <div className="metricsExplorer" style={{ padding: '0 16px', height: '100%', overflow: 'auto' }}>
      <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
        <EuiFlexItem>
          <nav aria-label="Exploration path">
            <EuiBreadcrumbs
              breadcrumbs={breadcrumbs}
              truncate={false}
              aria-label="Metrics exploration breadcrumb"
            />
          </nav>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="s" />
      <Suspense fallback={<EuiLoadingSpinner size="l" />}>
        {renderContent()}
      </Suspense>
    </div>
  );
};
