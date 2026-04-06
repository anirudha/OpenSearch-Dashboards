/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { EuiPanel, EuiText, EuiSpacer } from '@elastic/eui';
import {
  Chart,
  Settings,
  LineSeries,
  AreaSeries,
  ScaleType,
  Axis,
  Position,
  CurveType,
} from '@elastic/charts';
import { SparklinePoint } from '../hooks/use_sparkline_data';

interface LabelValueCardProps {
  value: string;
  chartData: SparklinePoint[];
  metricType?: string;
}

/**
 * Small-multiple card for a single label value in the breakdown view.
 */
export const LabelValueCard: React.FC<LabelValueCardProps> = ({
  value,
  chartData,
  metricType,
}) => {
  const data = chartData.map(([ts, val]) => ({ x: ts * 1000, y: val }));
  const useArea = metricType === 'gauge' || !metricType;
  const SeriesComponent = useArea ? AreaSeries : LineSeries;

  return (
    <EuiPanel paddingSize="s" hasShadow={false} hasBorder style={{ width: 280 }}>
      <EuiText size="xs">
        <strong>{value}</strong>
      </EuiText>
      <EuiSpacer size="xs" />
      {data.length > 0 ? (
        <Chart size={{ height: 100, width: 260 }}>
          <Settings
            showLegend={false}
            tooltip={{ type: 'none' }}
            theme={{
              chartMargins: { top: 4, bottom: 4, left: 4, right: 4 },
              areaSeriesStyle: { area: { opacity: 0.15 } },
            }}
          />
          <Axis id="time" position={Position.Bottom} showGridLines={false} hide />
          <Axis id="value" position={Position.Left} showGridLines={false} hide />
          <SeriesComponent
            id={value}
            xScaleType={ScaleType.Time}
            yScaleType={ScaleType.Linear}
            xAccessor="x"
            yAccessors={['y']}
            data={data}
            curve={CurveType.CURVE_MONOTONE_X}
          />
        </Chart>
      ) : (
        <div
          style={{
            height: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <EuiText size="xs" color="subdued">
            No data
          </EuiText>
        </div>
      )}
    </EuiPanel>
  );
};
