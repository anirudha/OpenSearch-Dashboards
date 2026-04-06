/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import {
  EuiPanel,
  EuiFlexGroup,
  EuiFlexItem,
  EuiButtonEmpty,
  EuiBadge,
} from '@elastic/eui';
import {
  Chart,
  Settings,
  LineSeries,
  ScaleType,
  Axis,
  Position,
} from '@elastic/charts';
import { SparklineData, SparklinePoint } from '../hooks/use_sparkline_data';

interface ComparisonOverlayProps {
  selectedMetrics: string[];
  sparklines: SparklineData;
  onRemoveMetric: (name: string) => void;
  onClear: () => void;
}

const COMPARISON_COLORS = ['#006BB4', '#54B399', '#D36086', '#9170B8'];

/**
 * Overlay chart showing multiple selected metrics for comparison.
 * Appears as a pinned panel at the bottom of the browser.
 */
export const ComparisonOverlay: React.FC<ComparisonOverlayProps> = ({
  selectedMetrics,
  sparklines,
  onRemoveMetric,
  onClear,
}) => {
  if (selectedMetrics.length === 0) return null;

  const seriesData = useMemo(() => {
    return selectedMetrics.map((name, idx) => {
      const points = sparklines[name] || [];
      return {
        name,
        color: COMPARISON_COLORS[idx % COMPARISON_COLORS.length],
        data: points.map(([ts, val]: SparklinePoint) => ({
          x: ts * 1000,
          y: val,
        })),
      };
    });
  }, [selectedMetrics, sparklines]);

  return (
    <EuiPanel paddingSize="s" hasShadow hasBorder={false} style={{ marginTop: 8 }}>
      <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
        <EuiFlexItem>
          <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
            {selectedMetrics.map((name, idx) => (
              <EuiFlexItem grow={false} key={name}>
                <EuiBadge
                  color={COMPARISON_COLORS[idx % COMPARISON_COLORS.length]}
                  iconType="cross"
                  iconSide="right"
                  iconOnClick={() => onRemoveMetric(name)}
                  iconOnClickAriaLabel={`Remove ${name} from comparison`}
                >
                  {name}
                </EuiBadge>
              </EuiFlexItem>
            ))}
          </EuiFlexGroup>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty size="xs" onClick={onClear}>
            Clear
          </EuiButtonEmpty>
        </EuiFlexItem>
      </EuiFlexGroup>

      <Chart size={{ height: 160 }}>
        <Settings
          showLegend={false}
          theme={{
            chartMargins: { top: 8, bottom: 8, left: 8, right: 8 },
          }}
        />
        <Axis id="time" position={Position.Bottom} showGridLines={false} />
        <Axis id="value" position={Position.Left} showGridLines />
        {seriesData.map((series) => (
          <LineSeries
            key={series.name}
            id={series.name}
            xScaleType={ScaleType.Time}
            yScaleType={ScaleType.Linear}
            xAccessor="x"
            yAccessors={['y']}
            data={series.data}
            color={series.color}
          />
        ))}
      </Chart>
    </EuiPanel>
  );
};
