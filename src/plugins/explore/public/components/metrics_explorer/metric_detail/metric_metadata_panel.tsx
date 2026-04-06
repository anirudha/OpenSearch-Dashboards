/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiBadge,
  EuiText,
  EuiSpacer,
} from '@elastic/eui';

interface MetricMetadataPanelProps {
  metricName: string;
  type?: string;
  help?: string;
  unit?: string;
}

const TYPE_COLORS: Record<string, string> = {
  counter: '#E6C220',
  gauge: '#54B399',
  histogram: '#D36086',
  summary: '#9170B8',
  unknown: '#98A2B3',
};

/**
 * Displays metric type badge, help text, and unit for the selected metric.
 */
export const MetricMetadataPanel: React.FC<MetricMetadataPanelProps> = ({
  metricName,
  type,
  help,
  unit,
}) => {
  return (
    <div>
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiText>
            <h3>{metricName}</h3>
          </EuiText>
        </EuiFlexItem>
        {type && (
          <EuiFlexItem grow={false}>
            <EuiBadge color={TYPE_COLORS[type] || TYPE_COLORS.unknown}>{type}</EuiBadge>
          </EuiFlexItem>
        )}
        {unit && unit !== '' && (
          <EuiFlexItem grow={false}>
            <EuiBadge color="hollow">{unit}</EuiBadge>
          </EuiFlexItem>
        )}
      </EuiFlexGroup>
      {help && (
        <>
          <EuiSpacer size="xs" />
          <EuiText size="s" color="subdued">
            {help}
          </EuiText>
        </>
      )}
      {!help && !type && (
        <>
          <EuiSpacer size="xs" />
          <EuiText size="s" color="subdued">
            No metadata available for this metric.
          </EuiText>
        </>
      )}
    </div>
  );
};
