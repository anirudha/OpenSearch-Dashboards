/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
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
import { EuiLoadingChart, EuiText } from '@elastic/eui';
import { SparklinePoint } from '../hooks/use_sparkline_data';

interface MetricFullChartProps {
  data: SparklinePoint[];
  metricName: string;
  metricType?: string;
  loading?: boolean;
}

/**
 * Full interactive chart for the metric detail view.
 * Uses area fill for gauges, line for rate-based metrics.
 */
export const MetricFullChart: React.FC<MetricFullChartProps> = ({
  data,
  metricName,
  metricType,
  loading,
}) => {
  const chartData = useMemo(
    () =>
      data.map(([timestamp, value]) => ({
        x: timestamp * 1000,
        y: value,
      })),
    [data]
  );

  if (loading) {
    return (
      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <EuiLoadingChart size="xl" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <EuiText color="subdued">No data in the selected time range</EuiText>
      </div>
    );
  }

  const useArea = metricType === 'gauge' || !metricType;
  const SeriesComponent = useArea ? AreaSeries : LineSeries;

  return (
    <Chart size={{ height: 300 }}>
      <Settings
        showLegend={false}
        theme={{
          chartMargins: { top: 10, bottom: 10, left: 10, right: 10 },
          areaSeriesStyle: {
            area: { opacity: 0.15 },
          },
        }}
      />
      <Axis
        id="time"
        position={Position.Bottom}
        showGridLines={false}
      />
      <Axis
        id="value"
        position={Position.Left}
        showGridLines
      />
      <SeriesComponent
        id={metricName}
        xScaleType={ScaleType.Time}
        yScaleType={ScaleType.Linear}
        xAccessor="x"
        yAccessors={['y']}
        data={chartData}
        curve={CurveType.CURVE_MONOTONE_X}
      />
    </Chart>
  );
};
