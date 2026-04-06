/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { EuiAccordion, EuiFlexGroup, EuiFlexItem, EuiBadge, EuiSpacer } from '@elastic/eui';
import { MetricCard } from './metric_card';
import { MetricInfo } from '../hooks/use_metrics_list';
import { SparklineData } from '../hooks/use_sparkline_data';

interface MetricGroupProps {
  prefix: string;
  metricNames: string[];
  metricsMap: Record<string, MetricInfo>;
  sparklines: SparklineData;
  selectedMetrics: string[];
  onSelectMetric: (name: string) => void;
  onToggleCompare: (name: string) => void;
}

/**
 * A collapsible group of metric cards, organized by prefix or letter.
 */
export const MetricGroupComponent: React.FC<MetricGroupProps> = ({
  prefix,
  metricNames,
  metricsMap,
  sparklines,
  selectedMetrics,
  onSelectMetric,
  onToggleCompare,
}) => {
  const buttonContent = (
    <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
      <EuiFlexItem grow={false}>
        <strong>{prefix}</strong>
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <EuiBadge color="hollow">{metricNames.length}</EuiBadge>
      </EuiFlexItem>
    </EuiFlexGroup>
  );

  return (
    <EuiAccordion
      id={`metric-group-${prefix}`}
      buttonContent={buttonContent}
      initialIsOpen={metricNames.length <= 20}
      paddingSize="s"
    >
      <EuiSpacer size="xs" />
      <EuiFlexGroup gutterSize="s" wrap responsive={false} direction="column">
        {metricNames.map((name) => {
          const info = metricsMap[name] || { name };
          return (
            <EuiFlexItem key={name} grow={false}>
              <MetricCard
                name={name}
                type={info.type}
                help={info.help}
                sparklineData={sparklines[name]}
                isSelected={false}
                onSelect={onSelectMetric}
                onToggleCompare={onToggleCompare}
                compareSelected={selectedMetrics.includes(name)}
              />
            </EuiFlexItem>
          );
        })}
      </EuiFlexGroup>
    </EuiAccordion>
  );
};
