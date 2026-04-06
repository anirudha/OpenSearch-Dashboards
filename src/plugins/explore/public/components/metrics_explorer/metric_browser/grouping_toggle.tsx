/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { EuiButtonGroup } from '@elastic/eui';
import { GroupingMode } from '../utils/url_state_sync';

interface GroupingToggleProps {
  selected: GroupingMode;
  onChange: (mode: GroupingMode) => void;
}

const GROUPING_OPTIONS = [
  { id: 'prefix', label: 'Prefix' },
  { id: 'alphabetical', label: 'A-Z' },
];

/**
 * Toggle between metric grouping modes: prefix groups vs alphabetical.
 */
export const GroupingToggle: React.FC<GroupingToggleProps> = ({ selected, onChange }) => {
  return (
    <EuiButtonGroup
      legend="Metric grouping mode"
      options={GROUPING_OPTIONS}
      idSelected={selected}
      onChange={(id) => onChange(id as GroupingMode)}
      buttonSize="compressed"
      isFullWidth={false}
    />
  );
};
