/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { EuiFlexGroup, EuiFlexItem, EuiButtonEmpty, EuiCopy } from '@elastic/eui';
import { PromQLQueryGenerator } from '../utils/promql_query_generator';

interface QueryActionsProps {
  metricName: string;
  metricType?: string;
  labelFilters: Record<string, string>;
  queryGenerator: PromQLQueryGenerator;
}

/**
 * Action buttons for the metric detail view:
 * - Copy PromQL: copies the generated query to clipboard
 * - Open in Editor: switches to the query editor tab with the generated query
 */
export const QueryActions: React.FC<QueryActionsProps> = ({
  metricName,
  metricType,
  labelFilters,
  queryGenerator,
}) => {
  const promql = queryGenerator.generate({
    metricName,
    metricType,
    labelFilters,
  });

  return (
    <EuiFlexGroup gutterSize="s" responsive={false}>
      <EuiFlexItem grow={false}>
        <EuiCopy textToCopy={promql}>
          {(copy) => (
            <EuiButtonEmpty size="xs" iconType="copy" onClick={copy}>
              Copy PromQL
            </EuiButtonEmpty>
          )}
        </EuiCopy>
      </EuiFlexItem>
    </EuiFlexGroup>
  );
};
