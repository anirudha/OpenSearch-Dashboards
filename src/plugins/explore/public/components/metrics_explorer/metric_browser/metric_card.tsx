/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback } from 'react';
import {
  EuiPanel,
  EuiFlexGroup,
  EuiFlexItem,
  EuiText,
  EuiToolTip,
  EuiBadge,
  EuiCheckbox,
} from '@elastic/eui';
import { SparklineChart } from './sparkline_chart';
import { SparklinePoint } from '../hooks/use_sparkline_data';

interface MetricCardProps {
  name: string;
  type?: string;
  help?: string;
  sparklineData?: SparklinePoint[];
  isSelected: boolean;
  onSelect: (name: string) => void;
  onToggleCompare: (name: string) => void;
  compareSelected: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  counter: '#E6C220',
  gauge: '#54B399',
  histogram: '#D36086',
  summary: '#9170B8',
  unknown: '#98A2B3',
};

/**
 * A single metric card in the browser grid.
 * Shows name, type badge, help tooltip, sparkline, and comparison checkbox.
 */
export const MetricCard: React.FC<MetricCardProps> = ({
  name,
  type,
  help,
  sparklineData,
  isSelected,
  onSelect,
  onToggleCompare,
  compareSelected,
}) => {
  const handleClick = useCallback(() => onSelect(name), [name, onSelect]);

  const handleCheckbox = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onToggleCompare(name);
    },
    [name, onToggleCompare]
  );

  // Compute current value and % change from sparkline
  let currentValue: string | null = null;
  let changePercent: string | null = null;

  if (sparklineData && sparklineData.length > 0) {
    const last = sparklineData[sparklineData.length - 1][1];
    currentValue = formatValue(last);

    if (sparklineData.length > 1) {
      const first = sparklineData[0][1];
      if (first !== 0) {
        const pct = ((last - first) / Math.abs(first)) * 100;
        changePercent = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
      }
    }
  }

  return (
    <EuiPanel
      paddingSize="s"
      hasShadow={false}
      hasBorder
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
      className={isSelected ? 'metricsExplorer__card--selected' : ''}
      role="button"
      tabIndex={0}
      aria-label={`View details for metric ${name}`}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiCheckbox
            id={`compare-${name}`}
            checked={compareSelected}
            onChange={handleCheckbox}
            aria-label={`Select ${name} for comparison`}
            onClick={(e) => e.stopPropagation()}
          />
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiFlexGroup gutterSize="xs" direction="column" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
                <EuiFlexItem grow={false}>
                  <EuiToolTip content={help || name} position="top">
                    <EuiText size="xs">
                      <strong>{name}</strong>
                    </EuiText>
                  </EuiToolTip>
                </EuiFlexItem>
                {type && (
                  <EuiFlexItem grow={false}>
                    <EuiBadge color={TYPE_COLORS[type] || TYPE_COLORS.unknown}>
                      {type}
                    </EuiBadge>
                  </EuiFlexItem>
                )}
              </EuiFlexGroup>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiFlexGroup gutterSize="xs" alignItems="center" direction="column" responsive={false}>
            <EuiFlexItem grow={false}>
              <SparklineChart data={sparklineData || []} width={140} height={32} />
            </EuiFlexItem>
            {currentValue && (
              <EuiFlexItem grow={false}>
                <EuiText size="xs" textAlign="right">
                  {currentValue}
                  {changePercent && (
                    <span
                      style={{
                        marginLeft: 4,
                        color: changePercent.startsWith('+') ? '#54B399' : '#D36086',
                        fontSize: '10px',
                      }}
                    >
                      {changePercent}
                    </span>
                  )}
                </EuiText>
              </EuiFlexItem>
            )}
          </EuiFlexGroup>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiPanel>
  );
};

/** Format a numeric value for display */
function formatValue(val: number): string {
  if (Math.abs(val) >= 1e9) return `${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
  if (Math.abs(val) >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  if (Number.isInteger(val)) return val.toString();
  return val.toFixed(2);
}
