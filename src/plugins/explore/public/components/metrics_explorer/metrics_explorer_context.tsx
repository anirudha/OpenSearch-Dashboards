/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useReducer, useMemo } from 'react';
import { ExplorerView, GroupingMode } from './utils/url_state_sync';

/** Per-level loading and error state */
export interface LevelStatus {
  loading: boolean;
  error: {
    message: string;
    retryable: boolean;
    action?: 'add-filters' | 'retry' | 'configure-datasource';
  } | null;
}

export interface MetricsExplorerState {
  currentView: ExplorerView;
  levelStatus: LevelStatus;
  searchQuery: string;
  groupingMode: GroupingMode;
  browserLabelFilters: Record<string, string>;
  selectedMetrics: string[]; // for comparison (max 4)
  selectedMetric: string | null;
  metricMetadata: { type: string; unit: string; help: string } | null;
  metricLabels: string[];
  selectedLabel: string | null;
  labelFilters: Record<string, string>;
}

const initialState: MetricsExplorerState = {
  currentView: 'browser',
  levelStatus: { loading: false, error: null },
  searchQuery: '',
  groupingMode: 'prefix',
  browserLabelFilters: {},
  selectedMetrics: [],
  selectedMetric: null,
  metricMetadata: null,
  metricLabels: [],
  selectedLabel: null,
  labelFilters: {},
};

type Action =
  | { type: 'SELECT_METRIC'; name: string }
  | { type: 'SELECT_LABEL'; name: string }
  | { type: 'ADD_LABEL_FILTER'; label: string; value: string }
  | { type: 'REMOVE_LABEL_FILTER'; label: string }
  | { type: 'ADD_BROWSER_LABEL_FILTER'; label: string; value: string }
  | { type: 'REMOVE_BROWSER_LABEL_FILTER'; label: string }
  | { type: 'TOGGLE_METRIC_SELECTION'; name: string }
  | { type: 'SET_GROUPING_MODE'; mode: GroupingMode }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_LEVEL_STATUS'; status: LevelStatus }
  | { type: 'SET_METRIC_METADATA'; metadata: MetricsExplorerState['metricMetadata'] }
  | { type: 'SET_METRIC_LABELS'; labels: string[] }
  | { type: 'NAVIGATE_BACK' }
  | { type: 'RESET' }
  | { type: 'SHOW_COMPARE' };

const MAX_COMPARE = 4;

function reducer(state: MetricsExplorerState, action: Action): MetricsExplorerState {
  switch (action.type) {
    case 'SELECT_METRIC':
      return {
        ...state,
        currentView: 'detail',
        selectedMetric: action.name,
        metricMetadata: null,
        metricLabels: [],
        selectedLabel: null,
        levelStatus: { loading: false, error: null },
      };

    case 'SELECT_LABEL':
      return {
        ...state,
        currentView: 'breakdown',
        selectedLabel: action.name,
        levelStatus: { loading: false, error: null },
      };

    case 'ADD_LABEL_FILTER':
      return {
        ...state,
        labelFilters: { ...state.labelFilters, [action.label]: action.value },
      };

    case 'REMOVE_LABEL_FILTER': {
      const { [action.label]: _, ...rest } = state.labelFilters;
      return { ...state, labelFilters: rest };
    }

    case 'ADD_BROWSER_LABEL_FILTER':
      return {
        ...state,
        browserLabelFilters: {
          ...state.browserLabelFilters,
          [action.label]: action.value,
        },
      };

    case 'REMOVE_BROWSER_LABEL_FILTER': {
      const { [action.label]: _, ...rest } = state.browserLabelFilters;
      return { ...state, browserLabelFilters: rest };
    }

    case 'TOGGLE_METRIC_SELECTION': {
      const idx = state.selectedMetrics.indexOf(action.name);
      if (idx >= 0) {
        return {
          ...state,
          selectedMetrics: state.selectedMetrics.filter((m) => m !== action.name),
        };
      }
      if (state.selectedMetrics.length >= MAX_COMPARE) return state;
      return {
        ...state,
        selectedMetrics: [...state.selectedMetrics, action.name],
      };
    }

    case 'SET_GROUPING_MODE':
      return { ...state, groupingMode: action.mode };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };

    case 'SET_LEVEL_STATUS':
      return { ...state, levelStatus: action.status };

    case 'SET_METRIC_METADATA':
      return { ...state, metricMetadata: action.metadata };

    case 'SET_METRIC_LABELS':
      return { ...state, metricLabels: action.labels };

    case 'SHOW_COMPARE':
      return { ...state, currentView: 'compare' };

    case 'NAVIGATE_BACK':
      switch (state.currentView) {
        case 'breakdown':
          return {
            ...state,
            currentView: 'detail',
            selectedLabel: null,
            levelStatus: { loading: false, error: null },
          };
        case 'detail':
          return {
            ...state,
            currentView: 'browser',
            selectedMetric: null,
            metricMetadata: null,
            metricLabels: [],
            levelStatus: { loading: false, error: null },
          };
        case 'compare':
          return {
            ...state,
            currentView: 'browser',
            levelStatus: { loading: false, error: null },
          };
        default:
          return state;
      }

    case 'RESET':
      return { ...initialState };

    default:
      return state;
  }
}

export interface MetricsExplorerContextValue {
  state: MetricsExplorerState;
  dispatch: React.Dispatch<Action>;
  actions: {
    selectMetric: (name: string) => void;
    selectLabel: (name: string) => void;
    addLabelFilter: (label: string, value: string) => void;
    removeLabelFilter: (label: string) => void;
    addBrowserLabelFilter: (label: string, value: string) => void;
    removeBrowserLabelFilter: (label: string) => void;
    toggleMetricSelection: (name: string) => void;
    setGroupingMode: (mode: GroupingMode) => void;
    setSearchQuery: (query: string) => void;
    setLevelStatus: (status: LevelStatus) => void;
    setMetricMetadata: (metadata: MetricsExplorerState['metricMetadata']) => void;
    setMetricLabels: (labels: string[]) => void;
    showCompare: () => void;
    navigateBack: () => void;
    reset: () => void;
  };
}

const MetricsExplorerContext = createContext<MetricsExplorerContextValue | null>(null);

export const MetricsExplorerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const actions = useMemo(
    () => ({
      selectMetric: (name: string) => dispatch({ type: 'SELECT_METRIC', name }),
      selectLabel: (name: string) => dispatch({ type: 'SELECT_LABEL', name }),
      addLabelFilter: (label: string, value: string) =>
        dispatch({ type: 'ADD_LABEL_FILTER', label, value }),
      removeLabelFilter: (label: string) => dispatch({ type: 'REMOVE_LABEL_FILTER', label }),
      addBrowserLabelFilter: (label: string, value: string) =>
        dispatch({ type: 'ADD_BROWSER_LABEL_FILTER', label, value }),
      removeBrowserLabelFilter: (label: string) =>
        dispatch({ type: 'REMOVE_BROWSER_LABEL_FILTER', label }),
      toggleMetricSelection: (name: string) =>
        dispatch({ type: 'TOGGLE_METRIC_SELECTION', name }),
      setGroupingMode: (mode: GroupingMode) => dispatch({ type: 'SET_GROUPING_MODE', mode }),
      setSearchQuery: (query: string) => dispatch({ type: 'SET_SEARCH_QUERY', query }),
      setLevelStatus: (status: LevelStatus) => dispatch({ type: 'SET_LEVEL_STATUS', status }),
      setMetricMetadata: (metadata: MetricsExplorerState['metricMetadata']) =>
        dispatch({ type: 'SET_METRIC_METADATA', metadata }),
      setMetricLabels: (labels: string[]) => dispatch({ type: 'SET_METRIC_LABELS', labels }),
      showCompare: () => dispatch({ type: 'SHOW_COMPARE' }),
      navigateBack: () => dispatch({ type: 'NAVIGATE_BACK' }),
      reset: () => dispatch({ type: 'RESET' }),
    }),
    []
  );

  const value = useMemo(() => ({ state, dispatch, actions }), [state, actions]);

  return (
    <MetricsExplorerContext.Provider value={value}>{children}</MetricsExplorerContext.Provider>
  );
};

export function useMetricsExplorer(): MetricsExplorerContextValue {
  const ctx = useContext(MetricsExplorerContext);
  if (!ctx) {
    throw new Error('useMetricsExplorer must be used within MetricsExplorerProvider');
  }
  return ctx;
}
