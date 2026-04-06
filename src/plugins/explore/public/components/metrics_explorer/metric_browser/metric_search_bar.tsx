/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useRef, useEffect } from 'react';
import { EuiFieldSearch } from '@elastic/eui';

interface MetricSearchBarProps {
  value: string;
  onChange: (query: string) => void;
  resultCount: number;
  totalCount: number;
}

const DEBOUNCE_MS = 250;

/**
 * Debounced search input for filtering metrics by name.
 */
export const MetricSearchBar: React.FC<MetricSearchBarProps> = ({
  value,
  onChange,
  resultCount,
  totalCount,
}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (newValue: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onChange(newValue);
      }, DEBOUNCE_MS);
    },
    [onChange]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <EuiFieldSearch
      placeholder={`Search ${totalCount} metrics...`}
      defaultValue={value}
      onChange={(e) => handleChange(e.target.value)}
      isClearable
      aria-label="Search metrics by name"
      fullWidth
    />
  );
};
