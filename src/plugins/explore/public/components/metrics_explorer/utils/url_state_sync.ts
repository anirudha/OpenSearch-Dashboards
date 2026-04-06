/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

export type ExplorerView = 'browser' | 'detail' | 'breakdown' | 'compare';
export type GroupingMode = 'prefix' | 'alphabetical' | 'label';

export interface ExplorerUrlState {
  view: ExplorerView;
  metric: string | null;
  label: string | null;
  filters: Record<string, string>;
  browserFilters: Record<string, string>;
  search: string;
  grouping: GroupingMode;
}

const PARAM_VIEW = 'me_view';
const PARAM_METRIC = 'me_metric';
const PARAM_LABEL = 'me_label';
const PARAM_FILTERS = 'me_filters';
const PARAM_BROWSER_FILTERS = 'me_bfilters';
const PARAM_SEARCH = 'me_search';
const PARAM_GROUPING = 'me_group';

/**
 * Encode a label filter map to a URL-safe string.
 * Format: "key1:value1,key2:value2"
 */
function encodeFilters(filters: Record<string, string>): string {
  return Object.entries(filters)
    .map(([k, v]) => `${encodeURIComponent(k)}:${encodeURIComponent(v)}`)
    .join(',');
}

/**
 * Decode a URL-safe filter string back to a map.
 */
function decodeFilters(str: string): Record<string, string> {
  if (!str) return {};
  const result: Record<string, string> = {};
  for (const pair of str.split(',')) {
    const [k, v] = pair.split(':').map(decodeURIComponent);
    if (k && v !== undefined) {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Encode explorer state into URL search params.
 */
export function encodeUrlState(state: ExplorerUrlState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.view !== 'browser') params.set(PARAM_VIEW, state.view);
  if (state.metric) params.set(PARAM_METRIC, state.metric);
  if (state.label) params.set(PARAM_LABEL, state.label);
  if (state.search) params.set(PARAM_SEARCH, state.search);
  if (state.grouping !== 'prefix') params.set(PARAM_GROUPING, state.grouping);

  const filterStr = encodeFilters(state.filters);
  if (filterStr) params.set(PARAM_FILTERS, filterStr);

  const bFilterStr = encodeFilters(state.browserFilters);
  if (bFilterStr) params.set(PARAM_BROWSER_FILTERS, bFilterStr);

  return params;
}

/**
 * Decode explorer state from URL search params.
 */
export function decodeUrlState(params: URLSearchParams): Partial<ExplorerUrlState> {
  const state: Partial<ExplorerUrlState> = {};

  const view = params.get(PARAM_VIEW);
  if (view === 'detail' || view === 'breakdown' || view === 'compare') {
    state.view = view;
  }

  const metric = params.get(PARAM_METRIC);
  if (metric) state.metric = metric;

  const label = params.get(PARAM_LABEL);
  if (label) state.label = label;

  const search = params.get(PARAM_SEARCH);
  if (search) state.search = search;

  const grouping = params.get(PARAM_GROUPING);
  if (grouping === 'alphabetical' || grouping === 'label') {
    state.grouping = grouping;
  }

  const filters = params.get(PARAM_FILTERS);
  if (filters) state.filters = decodeFilters(filters);

  const bFilters = params.get(PARAM_BROWSER_FILTERS);
  if (bFilters) state.browserFilters = decodeFilters(bFilters);

  return state;
}
