/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Chart,
  Settings,
  LineSeries,
  ScaleType,
} from '@elastic/charts';
import { SparklinePoint } from '../hooks/use_sparkline_data';

interface SparklineChartProps {
  data: SparklinePoint[];
  width?: number;
  height?: number;
  color?: string;
}

/**
 * Minimal sparkline chart for metric cards.
 * Uses @elastic/charts LineSeries without axes or decorations.
 */
export const SparklineChart: React.FC<SparklineChartProps> = ({
  data,
  width = 200,
  height = 40,
  color = '#006BB4',
}) => {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
          fontSize: 11,
        }}
      >
        No data
      </div>
    );
  }

  const chartData = data.map(([timestamp, value]) => ({
    x: timestamp * 1000, // Convert to milliseconds for @elastic/charts
    y: value,
  }));

  return (
    <Chart size={{ width, height }}>
      <Settings
        showLegend={false}
        tooltip={{ type: 'none' }}
        theme={{
          chartMargins: { top: 2, bottom: 2, left: 2, right: 2 },
          lineSeriesStyle: {
            line: { strokeWidth: 1.5 },
            point: { visible: false },
          },
          background: { color: 'transparent' },
        }}
      />
      <LineSeries
        id="sparkline"
        xScaleType={ScaleType.Time}
        yScaleType={ScaleType.Linear}
        xAccessor="x"
        yAccessors={['y']}
        data={chartData}
        color={color}
      />
    </Chart>
  );
};
