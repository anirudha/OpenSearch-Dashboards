/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { EuiCallOut } from '@elastic/eui';

interface CardinalityBannerProps {
  totalCount: number;
  isCapped: boolean;
}

/**
 * Warning banner displayed when metric count exceeds the 5,000 cap.
 * Suggests using search or label filters to narrow results.
 */
export const CardinalityBanner: React.FC<CardinalityBannerProps> = ({ totalCount, isCapped }) => {
  if (!isCapped) return null;

  return (
    <EuiCallOut
      title={`Showing 5,000 of ${totalCount.toLocaleString()} metrics`}
      color="warning"
      iconType="alert"
      size="s"
    >
      <p>
        Use the search bar or add label filters to narrow your results.
      </p>
    </EuiCallOut>
  );
};
