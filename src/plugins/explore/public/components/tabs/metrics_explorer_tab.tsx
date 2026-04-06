/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MetricsExplorerProvider } from '../metrics_explorer/metrics_explorer_context';
import { MetricsExplorerContainer } from '../metrics_explorer/metrics_explorer_container';

/**
 * Metrics Explorer tab component.
 * Provides queryless, visual metric exploration with a three-level drill-down:
 *   Level 1: Metric Browser (search, filter, sparkline grid)
 *   Level 2: Metric Detail (full chart, metadata, labels)
 *   Level 3: Label Breakdown (small multiples by label value)
 */
export const MetricsExplorerTab: React.FC = () => {
  return (
    <div className="explore-metrics-explorer-tab tab-container" style={{ height: '100%' }}>
      <MetricsExplorerProvider>
        <MetricsExplorerContainer />
      </MetricsExplorerProvider>
    </div>
  );
};
