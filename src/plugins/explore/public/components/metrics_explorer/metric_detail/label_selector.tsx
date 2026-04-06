/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiText,
  EuiSpacer,
  EuiLoadingSpinner,
} from '@elastic/eui';

interface LabelSelectorProps {
  labels: string[];
  loading: boolean;
  onSelectLabel: (label: string) => void;
}

/**
 * Clickable label list for drilling into label breakdown.
 * Each label leads to Level 3 (small multiples by label value).
 */
export const LabelSelector: React.FC<LabelSelectorProps> = ({
  labels,
  loading,
  onSelectLabel,
}) => {
  if (loading) {
    return (
      <EuiFlexGroup justifyContent="center" gutterSize="s">
        <EuiFlexItem grow={false}>
          <EuiLoadingSpinner size="m" />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiText size="s" color="subdued">Loading labels...</EuiText>
        </EuiFlexItem>
      </EuiFlexGroup>
    );
  }

  if (labels.length === 0) {
    return (
      <EuiText size="s" color="subdued">
        No labels found for this metric.
      </EuiText>
    );
  }

  return (
    <div>
      <EuiText size="s">
        <strong>Labels ({labels.length})</strong>
      </EuiText>
      <EuiSpacer size="xs" />
      <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
        {labels.map((label) => (
          <EuiFlexItem grow={false} key={label}>
            <EuiPanel
              paddingSize="s"
              hasShadow={false}
              hasBorder
              onClick={() => onSelectLabel(label)}
              style={{ cursor: 'pointer' }}
              role="button"
              tabIndex={0}
              aria-label={`Break down by ${label}`}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectLabel(label);
                }
              }}
            >
              <EuiText size="xs">{label}</EuiText>
            </EuiPanel>
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
    </div>
  );
};
