/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  EuiBadge,
  EuiFlexGroup,
  EuiFlexItem,
  EuiText,
} from '@elastic/eui';

interface LabelFilterBarProps {
  filters: Record<string, string>;
  onRemove: (label: string) => void;
}

/**
 * Displays active label filters as dismissable badges.
 * Used for filtering metrics at the browser level.
 */
export const LabelFilterBar: React.FC<LabelFilterBarProps> = ({ filters, onRemove }) => {
  const entries = Object.entries(filters);
  if (entries.length === 0) return null;

  return (
    <EuiFlexGroup gutterSize="xs" alignItems="center" wrap responsive={false}>
      <EuiFlexItem grow={false}>
        <EuiText size="xs" color="subdued">
          Filters:
        </EuiText>
      </EuiFlexItem>
      {entries.map(([label, value]) => (
        <EuiFlexItem grow={false} key={label}>
          <EuiBadge
            color="hollow"
            iconType="cross"
            iconSide="right"
            iconOnClick={() => onRemove(label)}
            iconOnClickAriaLabel={`Remove filter ${label}=${value}`}
          >
            {label}={value}
          </EuiBadge>
        </EuiFlexItem>
      ))}
    </EuiFlexGroup>
  );
};
