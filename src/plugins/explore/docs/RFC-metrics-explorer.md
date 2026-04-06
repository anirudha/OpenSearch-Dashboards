# RFC: Metrics Explorer — Queryless Metric Exploration for OpenSearch Dashboards

| Field | Value |
|-------|-------|
| **Status** | Draft |
| **Authors** | Anirudha Jadhav |
| **Created** | 2026-04-05 |
| **Updated** | 2026-04-05 |
| **Target Plugin** | `explore` (Metrics flavor) |
| **Issue** | _TBD_ |

---

## 1. Summary

This RFC proposes a new **"Explore" tab** within the Metrics flavor of the Explore plugin. It provides a queryless, visual metric exploration experience where users can browse, search, preview, and drill into Prometheus metrics without writing PromQL. The system auto-generates appropriate queries based on metric type, scrape interval, and user interactions.

**Design principles:**
- **Label-first browsing** — filter the entire metric catalog by label values (e.g., `job=api-server`) from Level 1, not just by metric name prefix
- **Cross-signal awareness** — architecture designed for showing correlated log/trace counts on metric cards (Phase 2)
- **Query Assist ready** — natural language metric exploration via existing ML pipeline (Phase 2)
- **Metric comparison** — multi-select and overlay metrics on a shared axis
- **Bridge to PromQL** — seamless transition from queryless exploration to manual PromQL editing via copy/open actions

---

## 2. Motivation

### 2.1 Problem

The current Metrics experience in OpenSearch Dashboards requires users to:

1. **Know metric names** — no browseable catalog of available metrics
2. **Write PromQL manually** — high barrier for non-expert users
3. **Understand metric types** — users must know when to apply `rate()` vs raw queries vs `histogram_quantile()`
4. **Explore one metric at a time** — no way to scan many metrics visually for anomalies

This is the equivalent of requiring SQL knowledge to browse a database — functional for experts but inaccessible for operators, SREs, and developers who need quick answers.

### 2.2 Current UI

The existing Metrics page offers:
- **PromQL editor** — manual query input with autocomplete
- **Table tab** — tabular results
- **Raw tab** — raw response data
- **Visualization tab** — chart rendering (after query execution)

All tabs require the user to first write and execute a PromQL query.

### 2.3 Industry Gap Analysis

Modern observability platforms have converged on queryless metric exploration as a standard capability. The table below compares common industry patterns against the current and proposed OpenSearch Dashboards experience:

| Capability | Industry Standard | **OSD Current** | **OSD Proposed** |
|---|---|---|---|
| Browse all metrics | Prefix grouping, tag-aware search | Manual query only | Prefix-grouped grid + label filtering |
| Queryless exploration | Zero-query, graphical, NLQ | None | Full (auto PromQL) |
| Sparkline previews | Grid of small multiples with stats | None | Sparkline grid with current value + change % |
| Auto query generation | Type-aware (counter/gauge/histogram) | None | Type + scrape-interval aware |
| Label breakdown | Click label → small multiples | Manual `by` clause | Click label → small multiples |
| Metric metadata | Type + help + unit display | None shown | Type + help + unit badges |
| Label-first filtering | Filter by tag/label values globally | None | Yes (`job=X`, `instance=Y`) |
| Metric comparison | Overlay 2+ metrics on shared axis | None | Multi-select overlay (max 4) |
| Cross-signal drill-down | Metrics → Logs/Traces pivot | None | Phase 2 (architecture ready) |
| AI/NLQ | Natural language to query | Query Assist (exists) | Phase 2 integration |

### 2.4 Goals

1. **Zero-query metric exploration** — browse and drill into metrics through clicks alone
2. **Incident-first design** — label-value filtering from Level 1 so SREs can scope to a service instantly
3. **Visual anomaly detection** — scan many metrics simultaneously via sparkline grids with change indicators
4. **Intelligent query generation** — auto-apply `rate()`, `histogram_quantile()` etc. based on metric type and detected scrape interval
5. **Progressive drill-down** — metric → labels → label values, with filter accumulation
6. **Seamless bridge to PromQL** — copy auto-generated queries or open in query editor at any point
7. **Safe by default** — cardinality guards, query timeouts, and degraded-mode design to prevent backend overload
8. **Extensible architecture** — pluggable query generator interface for future OpenTelemetry and non-Prometheus support

### 2.5 Non-Goals (for MVP)

- Natural language querying (existing Query Assist can be enhanced separately — Phase 2)
- Alerting integration
- Cross-signal correlation (metrics → logs/traces — Phase 2, extension points designed now)
- Dashboard export / bookmarking exploration trails

---

## 3. Design

### 3.1 User Experience

The Metrics Explorer is a three-level drill-down experience, all within a single "Explore" tab. URL state sync ensures exploration paths are shareable.

```
┌─────────────────────────────────────────────────────────┐
│ Breadcrumb:  All Metrics  >  http_requests_total  >  job│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Level 1: Metric Browser                                │
│  Level 2: Metric Detail    (+ Comparison overlay)       │
│  Level 3: Label Breakdown                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Only one level is rendered at a time. Users navigate forward by clicking, backward via breadcrumbs. State is encoded in URL query params for shareability.

#### Level 1 — Metric Browser

```
┌──────────────────────────────────────────────────────────────┐
│ Search metrics...             [Prefix ▾] [Suffix ▾]  [⚙]    │
│ Labels: [job=api-server ×] [instance=10.0.0.1:9100 ×] [+]   │
│ Group by: [● Prefix] [○ Alphabetical] [○ By label]           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ★ Recently viewed                                            │
│ ┌──────────────┐ ┌──────────────┐                            │
│ │http_requests │ │node_cpu_     │                            │
│ │_total        │ │seconds_total │                            │
│ └──────────────┘ └──────────────┘                            │
│                                                              │
│ ▾ http_ (12 metrics)                                 [□ All] │
│ ┌───────────────────┐ ┌───────────────────┐ ┌──────────────┐│
│ │☐ http_requests    │ │☐ http_response    │ │☐ http_dur... ││
│ │   _total          │ │   _size_bytes     │ │   _seconds   ││
│ │   counter         │ │   histogram       │ │   histogram  ││
│ │   ┄┄╱╲┄┄╱╲┄┄     │ │   ┄┄──╲╱──┄┄     │ │   ┄┄╱──╲┄╱┄ ││
│ │   142 req/s  ▲12% │ │   3.2 KB    ▼5%  │ │   89ms  ─0%  ││
│ └───────────────────┘ └───────────────────┘ └──────────────┘│
│                                                              │
│ ▾ node_ (24 metrics)                                         │
│ ...                                                          │
│                                                              │
│ [Compare selected (2)]                                       │
│                                                              │
│ ⚠ Showing 5,000 of 23,412 metrics. Add label filters or     │
│   refine search to see more.                                 │
└──────────────────────────────────────────────────────────────┘
```

**Key interactions:**
- **Label filter bar** — filter the entire metric catalog by `job`, `instance`, etc. Uses `/api/v1/series` with matchers. Critical for incident workflows: "show me all metrics for `job=api-server`"
- **Search** — debounced (300ms) client-side filter by substring/regex on already-loaded metrics
- **Grouping toggle** — prefix (default, handles both `_` and `.` delimiters), alphabetical, or by label value
- **Metric cards** — show name, type badge, sparkline, current value/rate, and change indicator (% vs previous period)
- **Multi-select checkboxes** — select 2-4 metrics, click "Compare selected" to overlay on shared chart
- **Recently viewed** — top section from localStorage, helping returning users resume work
- **Cardinality banner** — when metrics exceed 5,000, show warning + suggestion to add label filters
- **Sparklines load lazily** — Intersection Observer detects visible cards

#### Level 2 — Metric Detail

```
┌──────────────────────────────────────────────────────────────┐
│ ← Back    http_requests_total          [Copy PromQL] [Open]  │
│ counter · Tracks total HTTP requests · requests               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  rate(http_requests_total{job="api-server"}[1m])  (auto)     │
│ ┌──────────────────────────────────────────────────────┐     │
│ │                                                      │     │
│ │         ╱╲    ╱╲                                     │     │
│ │    ╱╲  ╱  ╲╱╱  ╲     ╱╲                             │     │
│ │ ──╱  ╲╱         ╲───╱  ╲───                         │     │
│ │                                                      │     │
│ │ 12:30    12:35    12:40    12:45    12:50            │     │
│ └──────────────────────────────────────────────────────┘     │
│                                                              │
│ Labels:                                                      │
│ ┌────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐           │
│ │  job   │ │ instance │ │ method │ │  handler  │           │
│ │  (3)   │ │   (5)    │ │  (4)   │ │   (12)    │           │
│ └────────┘ └──────────┘ └────────┘ └───────────┘           │
│                                                              │
│ ⚠ handler has 12 values (high cardinality)                   │
└──────────────────────────────────────────────────────────────┘
```

**Key interactions:**
- **Copy PromQL** button — copies the auto-generated query to clipboard
- **Open in Query tab** button — switches to the Table/Visualization tab with the PromQL pre-filled
- View auto-generated PromQL (informational, shows what's being queried including detected rate interval)
- See metric metadata: type badge, help text, unit
- Full-size interactive chart with time-range brush selection
- Click a label → navigate to Level 3
- Labels show cardinality count; high-cardinality labels show warning icon

#### Level 3 — Label Breakdown

```
┌──────────────────────────────────────────────────────────────┐
│ ← Back    http_requests_total  ▸  job    [Copy PromQL] [Open]│
│ Filters: [job=api-server ×] [instance=10.0.0.1:9100 ×]      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Breakdown by: job  (3 values)                                │
│                                                              │
│ ┌─────────────────────┐ ┌─────────────────────┐             │
│ │ job="api-server"     │ │ job="frontend"      │             │
│ │                      │ │                      │             │
│ │     ╱╲  ╱╲          │ │  ──────╲╱───        │             │
│ │ ╱╲╱╱  ╲╱  ╲╱╲       │ │                      │             │
│ │                      │ │                      │             │
│ │  avg: 142 req/s      │ │  avg: 89 req/s      │             │
│ └─────────────────────┘ └─────────────────────┘             │
│                                                              │
│ ┌─────────────────────┐                                      │
│ │ job="worker"        │                                      │
│ │                      │                                      │
│ │ ╱╲╱╲╱╲╱╲╱╲╱╲       │                                      │
│ │                      │                                      │
│ │  avg: 312 req/s      │                                      │
│ └─────────────────────┘                                      │
│                                                              │
│ Showing top 20 of 47 values by series count. [Show all]      │
└──────────────────────────────────────────────────────────────┘
```

**Key interactions:**
- **Copy PromQL** / **Open in Query tab** — available at every level
- Click a label value card → add as filter chip, stay on breakdown view
- Remove filter chips to broaden view
- Click a different label from the breadcrumb to pivot
- Breakdown uses `topk(20, ...)` in generated PromQL for server-side limiting
- "Show all" expands to full list with warning for high cardinality (>100 values)

#### Metric Comparison Overlay

When 2-4 metrics are selected via checkboxes at Level 1:

```
┌──────────────────────────────────────────────────────────────┐
│ Comparing 3 metrics                              [× Close]   │
│ [Copy PromQL]                                                │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐     │
│ │  ─── http_requests_total (rate)                      │     │
│ │  ─── http_errors_total (rate)                        │     │
│ │  ─── http_duration_seconds (p95)                     │     │
│ │                                                      │     │
│ │     ╱╲    ╱╲               ╱╲                        │     │
│ │ ──╱╱  ╲╱╱  ╲───   ───────╱  ╲───                   │     │
│ │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄                   │     │
│ │ ............╱╲...╱╲.........╱╲...                     │     │
│ │                                                      │     │
│ │ 12:30    12:35    12:40    12:45    12:50            │     │
│ └──────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

#### Empty State & Onboarding

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌─────────────────────────────────────────────┐            │
│  │        Explore Your Metrics                  │            │
│  │                                             │            │
│  │  Browse, search, and drill into Prometheus  │            │
│  │  metrics without writing PromQL.            │            │
│  │                                             │            │
│  │  Start by:                                  │            │
│  │  - Searching for a metric name above        │            │
│  │  - Adding a label filter (e.g., job=...)    │            │
│  │  - Browsing the top metrics below           │            │
│  └─────────────────────────────────────────────┘            │
│                                                              │
│  Most Active Metrics (by series count)                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │http_requests │ │container_cpu │ │node_memory_  │        │
│  │_total (1.2k) │ │_usage (890)  │ │bytes (456)   │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                              │
│  ★ Recently Viewed                                           │
│  (No metrics viewed yet)                                     │
│                                                              │
│  ────────────────────────────────────────────────            │
│  No Prometheus connection?                                   │
│  → Configure a data connection in Management > Data Sources  │
└──────────────────────────────────────────────────────────────┘
```

**Onboarding flow:**
1. **No data connection** → setup guide link to Data Sources management
2. **Has connection, first visit** → "Most Active Metrics" section using `/api/v1/status/tsdb` `seriesCountByMetricName`, plus quick-start tips
3. **Returning user** → "Recently Viewed" from localStorage + "Most Active Metrics"
4. **Metrics loaded** → standard browser view with groups

### 3.2 Architecture

#### Component Hierarchy

```
MetricsExplorerTab (registered as tab, code-split via React.lazy)
  └── MetricsExplorerProvider (React context + URL state sync)
        └── MetricsExplorerContainer
              ├── BreadcrumbNav
              ├── [currentView === 'browser']  MetricBrowser
              │     ├── LabelFilterBar (shared across levels)
              │     ├── MetricSearchBar
              │     ├── GroupingToggle
              │     ├── RecentlyViewed
              │     ├── MostActiveMetrics (onboarding)
              │     ├── MetricGroup[]
              │     │     └── MetricCard[] (with checkbox)
              │     │           └── SparklineChart
              │     ├── ComparisonOverlay (when 2+ selected)
              │     └── CardinalityBanner
              ├── [currentView === 'detail']   MetricDetail
              │     ├── QueryActions (Copy PromQL / Open in editor)
              │     ├── MetricMetadataPanel
              │     ├── MetricFullChart
              │     └── LabelSelector
              └── [currentView === 'breakdown'] LabelBreakdown
                    ├── QueryActions
                    ├── LabelFilterBar
                    └── LabelValueCard[]
                          └── SparklineChart (reused)
```

#### Tab Contract: `isQueryDriven` Flag

The existing `TabDefinition` assumes all tabs consume shared Redux query results. The Metrics Explorer bypasses this — it owns its own data fetching. To prevent the framework from executing queries on tab switch:

```typescript
// Updated TabDefinition interface
export interface TabDefinition {
  // ... existing fields ...

  /**
   * When false, the tab manages its own data fetching and does not
   * participate in the shared query execution pipeline. The framework
   * will skip query execution on tab switch and will not pass
   * query/results/status props. Default: true.
   */
  isQueryDriven?: boolean;
}
```

The Metrics Explorer tab registers with `isQueryDriven: false`. The framework checks this flag before dispatching `executeTabQuery` on tab switch.

**Files to modify:**
- `src/plugins/explore/public/services/tab_registry/tab_registry_service.ts` — add `isQueryDriven` to interface
- `src/plugins/explore/public/application/utils/state_management/actions/query_actions.ts` — check flag before executing

#### State Management

The explorer uses a **local React context** with **URL state synchronization** for navigation state.

**URL sync rationale:** The state shape is only ~6 fields. Encoding in URL query params enables:
- Sharing exploration paths via Slack/email during incidents
- Browser back/forward navigation
- Bookmarking interesting drill-downs

```typescript
interface MetricsExplorerState {
  // Navigation
  currentView: 'browser' | 'detail' | 'breakdown' | 'compare';

  // Per-level loading/error state
  levelStatus: {
    loading: boolean;
    error: Error | null;
  };

  // Level 1 state
  searchQuery: string;
  groupingMode: 'prefix' | 'alphabetical' | 'label';
  browserLabelFilters: Record<string, string>;  // Level 1 label filtering
  selectedMetrics: string[];  // for comparison (max 4)

  // Level 2 state
  selectedMetric: string | null;
  metricMetadata: { type: string; unit: string; help: string } | null;
  metricLabels: string[];

  // Level 3 state
  selectedLabel: string | null;

  // Shared filters (accumulate across drill-downs)
  labelFilters: Record<string, string>;
}

// URL encoding: ?view=detail&metric=http_requests_total&label=job&filters=job:api-server
// Only navigation-relevant fields go into URL; loading/error/metadata are transient
```

Context actions:
```typescript
interface MetricsExplorerActions {
  selectMetric(name: string): void;
  selectLabel(name: string): void;
  addLabelFilter(label: string, value: string): void;
  removeLabelFilter(label: string): void;
  addBrowserLabelFilter(label: string, value: string): void;
  removeBrowserLabelFilter(label: string): void;
  toggleMetricSelection(name: string): void;  // for comparison
  setGroupingMode(mode: 'prefix' | 'alphabetical' | 'label'): void;
  navigateBack(): void;
  reset(): void;
  copyPromQL(): void;
  openInQueryEditor(): void;
}
```

#### Data Flow

```
                    ┌──────────────────────────────┐
                    │   MetricQueryGenerator       │
                    │   (pluggable interface)       │
                    │                              │
                    │   ┌────────────────────────┐ │
                    │   │ PromQLQueryGenerator   │ │  (default impl)
                    │   │ - counter → rate()     │ │
                    │   │ - gauge → raw          │ │
                    │   │ - histogram → p95      │ │
                    │   │ - scrape-interval aware│ │
                    │   └────────────────────────┘ │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │   PrometheusResourceClient   │
                    │   + queryRange() (new)        │
                    │                              │
                    │   getMetrics() → capped 5k   │
                    │   getLabels()                │
                    │   getSeries() → scoped vals  │
                    │   getMetricMetadata()         │
                    │   queryRange() → sparklines  │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │   MetricsExplorerCache       │
                    │   - 60s TTL (data)           │
                    │   - 5min TTL (metadata)      │
                    │   - max 500 entries           │
                    │   - request deduplication     │
                    │   - AbortController support   │
                    └──────────────┬───────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                     │
   ┌──────────▼──────┐  ┌────────▼────────┐  ┌────────▼─────────┐
   │ useMetricsList  │  │ useMetricDetail │  │useLabelBreakdown │
   │                 │  │                 │  │                   │
   │ - debounced     │  │ - metadata +    │  │ - scoped via      │
   │   search        │  │   labels (||)   │  │   /series API     │
   │ - label filter  │  │ - auto PromQL   │  │ - topk(20) in     │
   │   via /series   │  │ - scrape detect │  │   generated query  │
   │ - 5k cap +      │  │ - fallback for  │  │ - concurrency     │
   │   banner        │  │   missing meta  │  │   limited          │
   └────────┬────────┘  └────────┬────────┘  └────────┬─────────┘
            │                    │                     │
   ┌────────▼────────┐  ┌───────▼─────────┐  ┌───────▼─────────┐
   │  MetricBrowser  │  │  MetricDetail   │  │ LabelBreakdown  │
   │  (Level 1)      │  │  (Level 2)      │  │ (Level 3)       │
   └─────────────────┘  └─────────────────┘  └─────────────────┘
```

#### Pluggable Query Generator

To support future OpenTelemetry and non-Prometheus data sources:

```typescript
// metric_query_generator.ts
export interface MetricQueryGenerator {
  /**
   * Generate a query for a single metric with optional label filters.
   */
  generate(params: {
    metricName: string;
    metricType: string | undefined;
    labelFilters: Record<string, string>;
    options?: {
      rateInterval?: string;
      quantile?: number;
      topk?: number;
      breakdownLabel?: string;
    };
  }): string;

  /**
   * Generate a batch query for multiple metrics (sparkline optimization).
   * Returns null if batching is not supported for the given metric types.
   */
  generateBatch?(params: {
    metricNames: string[];
    metricTypes: Record<string, string | undefined>;
    labelFilters: Record<string, string>;
  }): string | null;

  /**
   * Detect the optimal rate interval for this data source.
   * Returns interval string (e.g., "1m", "5m") or null if not applicable.
   */
  detectRateInterval?(): Promise<string | null>;
}

// promql_query_generator.ts — default implementation
export class PromQLQueryGenerator implements MetricQueryGenerator { ... }
```

#### PromQL Auto-Generation

The system inspects metric metadata to determine the metric type and **auto-detects scrape interval**:

**Scrape interval detection:**
1. Attempt: Call `/api/v1/status/config` → extract `global.scrape_interval`
2. Fallback: Use heuristic `max(4 * detected_interval, 1m)` based on sample spacing
3. Default: `1m` if detection fails
4. Cache: 10-minute TTL (scrape interval doesn't change at runtime)

| Metric Type | Generated PromQL | Rate Interval |
|---|---|---|
| `counter` | `rate(metric{filters}[$interval])` | Auto-detected (default `1m`) |
| `gauge` | `metric{filters}` | N/A |
| `histogram` | `histogram_quantile(0.95, rate(metric_bucket{filters}[$interval]))` | Auto-detected |
| `summary` | `metric{filters}` | N/A |
| `unknown` | `metric{filters}` | N/A (safe default) |

For **breakdown queries** (Level 3), wrap with `topk(20, ...)` to limit server-side:
```
topk(20, rate(http_requests_total{job="api-server"}[1m])) by (instance)
```

**Metadata fallback:** If `/api/v1/metadata` returns empty or 404 (common with some long-term storage backends), treat all metrics as `unknown` type and generate raw queries. Show a subtle info banner: "Metric type detection unavailable — showing raw values. Configure metadata endpoint for auto rate/histogram queries."

#### Sparkline Data Fetching

Fetching time-series data for many metrics simultaneously requires careful batching to avoid overwhelming the backend.

1. **Intersection Observer** — only fetch data for visible cards
2. **Regex batching for gauges/unknowns** — combine up to 10 metrics into a single query:
   ```
   {__name__=~"node_memory_MemAvailable|node_memory_MemFree|node_memory_Buffers"}
   ```
   This produces one HTTP request per 10 gauges instead of 10 separate requests.
3. **Individual queries for counters/histograms** — `rate()` and `histogram_quantile()` cannot be batched via regex. These use individual `queryRange` calls.
4. **New `queryRange` method** — add to `PrometheusResourceClient`:
   ```typescript
   queryRange(
     dataConnectionId: string,
     query: string,
     start: number, end: number, step: number,
     meta?: Record<string, unknown>,
     options?: { timeout?: number; maxSeries?: number }
   ): Promise<Array<{ metric: Record<string, string>; values: [number, number][] }>>
   ```
5. **Concurrency limit** — max 5 concurrent requests (reuse `executeWithConcurrencyLimit`)
6. **AbortController** — cancel in-flight sparkline requests on scroll or time range change
7. **Step calculation** — sparkline width is 200px, target ~100 datapoints:
   ```
   step = max(timeRange / 100, 4 * scrapeInterval, 15s)
   ```
8. **Query safety** — each sparkline query has a 15s timeout and `maxSeries: 10`

#### Cardinality Guards & Degraded Mode

| Scenario | Detection | Behavior |
|---|---|---|
| >5,000 metric names | `getMetrics()` result length | Show first 5k + warning banner: "Add label filters or refine search to see more" |
| >200,000 metric names (global-view) | Response size/time | Do NOT call `__name__/values` eagerly. Require at least one label filter or search term before loading. |
| High-cardinality label (>100 values) | Cardinality count from `/series` | Warning icon on label in Level 2. Level 3 uses `topk(20)` server-side. |
| Very high-cardinality label (>10,000) | Cardinality count | Block breakdown, show: "This label has 10,000+ values. Add filters to narrow down." |
| Metadata API unavailable | 404 / empty response | Treat all metrics as `unknown` type. Info banner. Cache negative result for 10min. |
| Backend unreachable | Network error / timeout | Per-level error state with retry button. Other levels remain functional. |
| Partial API failure | One of parallel calls fails | Show available data + error callout for failed section |

**Explicit error states per level:**
```typescript
interface LevelStatus {
  loading: boolean;
  error: {
    message: string;
    retryable: boolean;
    action?: 'add-filters' | 'retry' | 'configure-datasource';
  } | null;
}
```

### 3.3 Integration Points

#### Tab Registration

```typescript
// In register_tabs.ts, inside the Metrics flavor block
import React from 'react';
const MetricsExplorerTab = React.lazy(() =>
  import('../components/tabs/metrics_explorer_tab').then(m => ({ default: m.MetricsExplorerTab }))
);

tabRegistry.registerTab({
  id: EXPLORE_METRICS_EXPLORER_TAB_ID,
  label: 'Explore',
  flavor: [ExploreFlavor.Metrics],
  order: 5,       // First tab (before Table at 10)
  supportedLanguages: ['PROMQL'],
  isQueryDriven: false,  // Explorer manages its own data
  component: MetricsExplorerTab,
});
```

#### Prometheus Client Access

Following the established pattern in `promql_tool_handlers.ts`:

```typescript
const client = services.data.resourceClientFactory.get<PrometheusResourceClient>('prometheus');
const connectionId = query.dataset?.id;
const meta = query.dataset?.dataSource?.meta;
const timeRange = services.data.query.timefilter.timefilter.getTime();
```

#### Label-Value Scoped Metric Fetching (Level 1)

Instead of unbounded `getMetrics()`, when label filters are present:

```typescript
// Use /series API with matchers to get metrics scoped to label values
const series = await client.getSeries(connectionId, '{job="api-server"}', meta, timeRange);
const metricNames = [...new Set(series.map(s => s.__name__))];
```

When no label filters are present, use `getMetrics()` with the 5,000 cap.

#### Label Value Fetching (Level 3)

Instead of unbounded `getLabelValues()`, use the `/series` API scoped to the specific metric:

```typescript
// Unbounded approach (avoided): /api/v1/label/pod/values → potentially millions of values
// Scoped approach (used): /api/v1/series?match[]={metric} → extract unique label values

const series = await client.getSeries(
  connectionId,
  `{__name__="${metricName}"}`,
  meta,
  timeRange
);
const labelValues = [...new Set(series.map(s => s[labelName]).filter(Boolean))];
```

This bounds the result to the cardinality of that specific metric (typically hundreds, not millions).

#### Time Range Integration

- Subscribe to time range changes via existing `useTimefilterSubscription` pattern
- **Debounce 800ms** on time range changes to prevent thundering herd during slider drag
- **AbortController** — cancel all in-flight requests when time range changes again
- Cache invalidation on time range change (except metadata cache at 5-min TTL)

#### Query Safety Limits

All auto-generated queries include safety parameters:

| Context | Timeout | Max Series | Additional |
|---|---|---|---|
| Sparkline (Level 1) | 15s | 10 | Coarse step |
| Full chart (Level 2) | 30s | 100 | Standard step |
| Breakdown (Level 3) | 30s | 20 | `topk(20, ...)` in query |
| Comparison | 30s | 40 | Max 4 metrics x 10 series |

#### Copy PromQL / Open in Editor

Available at Levels 2 and 3:

```typescript
// Copy to clipboard
const copyPromQL = () => {
  navigator.clipboard.writeText(generatedQuery);
  toasts.addSuccess('PromQL copied to clipboard');
};

// Open in query editor tab
const openInQueryEditor = () => {
  // Update Redux query state with the generated PromQL
  dispatch(setQuery({ query: generatedQuery, language: 'PROMQL' }));
  // Switch to the Table tab
  dispatch(setActiveTab('metrics'));
  // Trigger query execution
  dispatch(executeQueries({ services }));
};
```

#### Charting

All charts use `@elastic/charts`, consistent with the rest of the application:

- **Sparklines**: `Chart` + `LineSeries` + `Settings` (minimal, no axes/tooltips, 200x40px for Level 1, 250x80px for Level 3)
- **Full chart**: `Chart` + `LineSeries` + `Axis` + `Settings` with brush selection, tooltips, legend
- **Comparison chart**: Multi-series `LineSeries` with dual Y-axis support for different units
- **Small multiples**: Same as sparklines but larger, with title and summary stat

#### Multi-Tenancy

Tenant isolation in shared, multi-tenant Prometheus-compatible backends relies on the existing datasource proxy configuration. The explorer does not inject tenant headers — these are handled at the data connection layer. Explicit tenant support is planned for Phase 2.

### 3.4 File Structure

```
src/plugins/explore/public/
  components/
    tabs/
      metrics_explorer_tab.tsx                    # Tab entry (code-split, registered in tab system)
    metrics_explorer/
      index.ts
      metrics_explorer_context.tsx                # Context + URL state sync
      metrics_explorer_container.tsx              # Top-level: breadcrumb + level routing + error boundary
      query_actions.tsx                           # Copy PromQL / Open in editor buttons
      metric_browser/
        metric_browser.tsx                        # Level 1 layout
        metric_search_bar.tsx                     # Search + debounced input
        label_filter_bar.tsx                      # Label-value filter chips (shared across levels)
        grouping_toggle.tsx                       # Prefix / alphabetical / by-label toggle
        recently_viewed.tsx                       # localStorage-backed recent metrics
        most_active_metrics.tsx                   # Onboarding: top metrics by series count
        cardinality_banner.tsx                    # Warning when >5k metrics
        metric_group.tsx                          # Collapsible prefix group
        metric_card.tsx                           # Card with checkbox, name, type, sparkline, stat
        sparkline_chart.tsx                       # Minimal @elastic/charts line chart (reused)
        comparison_overlay.tsx                    # Multi-metric overlay chart
        use_metrics_list.ts                       # Hook: fetch + filter + group + cap
        use_sparkline_data.ts                     # Hook: batched sparkline fetching
      metric_detail/
        metric_detail.tsx                         # Level 2 layout
        metric_metadata_panel.tsx                 # Type/help/unit badges + fallback state
        metric_full_chart.tsx                     # Full interactive chart
        label_selector.tsx                        # Clickable label list with cardinality badges
        use_metric_detail.ts                      # Hook: metadata + labels + chart data
      label_breakdown/
        label_breakdown.tsx                       # Level 3 layout
        label_value_card.tsx                      # Small-multiple card per value
        use_label_breakdown.ts                    # Hook: scoped via /series, topk in query
      utils/
        metric_query_generator.ts                 # Pluggable interface
        promql_query_generator.ts                 # Default PromQL implementation
        prometheus_helpers.ts                     # Client access + connection helpers
        metrics_explorer_cache.ts                 # TTL cache with deduplication + max entries
        scrape_interval_detector.ts               # Auto-detect scrape interval
        url_state_sync.ts                         # Encode/decode explorer state in URL
        metric_grouping.ts                        # Prefix grouping logic (handles _ and . delimiters)
```

**Files modified:**
- `src/plugins/explore/common/index.ts` — add `EXPLORE_METRICS_EXPLORER_TAB_ID` constant
- `src/plugins/explore/public/application/register_tabs.ts` — register the new tab with `isQueryDriven: false`
- `src/plugins/explore/public/services/tab_registry/tab_registry_service.ts` — add `isQueryDriven` to `TabDefinition`
- `src/plugins/explore/public/application/utils/state_management/actions/query_actions.ts` — check `isQueryDriven` before executing
- `src/plugins/query_enhancements/public/resources/prometheus_resource_client.ts` — add `queryRange()` method

---

## 4. Performance Considerations

| Concern | Mitigation |
|---|---|
| **Large metric catalogs (20k-200k names)** | 5k client-side cap + warning banner. Label filters use `/series` API to scope server-side. Global-view endpoints require at least one filter before loading. |
| **Sparkline N+1 requests** | Regex batching for gauges (10 per request). Individual queries for counters/histograms with 5-concurrent limit. AbortController on scroll. |
| **Thundering herd on time range change** | 800ms debounce + AbortController cancels in-flight requests. Cache invalidated only after debounce settles. |
| **High-cardinality labels** | Level 3 uses `/series` API scoped to metric (not unbounded `getLabelValues`). `topk(20)` in generated PromQL for server-side limiting. |
| **Memory from caching** | Max 500 cache entries. 60s TTL for data, 5min for metadata. LRU eviction. Request deduplication prevents duplicate in-flight requests. |
| **Bundle size (25+ new files)** | Code-split via `React.lazy()` at tab registration. Only loads when user opens Metrics Explore tab. |
| **Query safety** | All queries have explicit timeouts (15s sparklines, 30s detail). Max series limits per context. |

---

## 5. Accessibility

- All interactive elements keyboard-navigable (Tab/Enter/Escape)
- Metric cards are `<button role="option">` elements with `aria-label` including metric name, type, and current value
- Multi-select checkboxes have `aria-checked` state and group label
- Sparklines have `aria-hidden="true"` (decorative; data available in text as current value + change %)
- Breadcrumb navigation uses `<nav aria-label="Exploration path">`
- Color is never the sole indicator — type is shown as text badge, not just color
- Loading states announced via `aria-live="polite"` region
- Error states use `role="alert"` with descriptive messages
- Label filter bar uses combobox pattern with `aria-autocomplete`
- Axe-core accessibility audits included in test suite

---

## 6. Future Work (Phase 2+)

| Feature | Description | Priority |
|---|---|---|
| **Cross-signal correlation** | Show "Related logs: 1.2k" badge on metric cards when log data shares labels. Architecture designed in Phase 1 via extension points in `MetricCard`. | High |
| **Query Assist integration** | Natural language metric exploration via existing ML pipeline: "show me high-latency endpoints" | High |
| **Related metrics** | Surface metrics with shared labels or naming patterns | High |
| **Anomaly highlighting** | Flag metrics with unusual patterns in sparkline grid (2+ std dev spikes). Extension point in `MetricCard`. | Medium |
| **Export to dashboard** | Save current view as a dashboard panel | Medium |
| **Exploration history** | Full back/forward navigation stack with named bookmarks | Low |
| **Explicit multi-tenant support** | Inject tenant headers for multi-tenant Prometheus-compatible backends | Low |
| **OpenTelemetry metric support** | Implement `MetricQueryGenerator` for OTel metrics stored in OpenSearch | Low |

---

## 7. Testing Strategy

### Unit Tests
- `promql_query_generator.test.ts` — all metric types, with/without filters, scrape interval detection, topk wrapping
- `metric_query_generator.test.ts` — interface contract tests, pluggability
- `metrics_explorer_cache.test.ts` — TTL, LRU eviction, max entries, request deduplication, AbortController
- `metrics_explorer_context.test.tsx` — state transitions for all navigation actions, URL sync round-trip
- `metric_search_bar.test.tsx` — search filtering, debounce behavior
- `metric_grouping.test.ts` — prefix grouping with `_` and `.` delimiters, edge cases
- `url_state_sync.test.ts` — encode/decode, missing fields, invalid URLs
- `scrape_interval_detector.test.ts` — detection from config, fallback heuristic, caching

### Integration Tests
- Full drill-down flow: browser → select metric → detail → select label → breakdown → back
- Label filter flow: add `job=api-server` filter → metrics scoped → drill down → filter persists
- Comparison flow: select 2 metrics → compare overlay → copy PromQL
- Copy PromQL / Open in editor at Levels 2 and 3
- Time range change with debounce + request cancellation
- Empty states: no connection, no metrics, no labels, no data
- Error handling: API failures, timeouts, partial results, metadata unavailable
- Cardinality guards: >5k metrics banner, high-cardinality label warning, >10k block
- Tab switching: explorer state preserved in URL, query-driven tabs unaffected
- IntersectionObserver mock: sparklines only load for visible cards

### Performance Tests
- Render benchmark: 50+ metric cards with sparklines (target <100ms paint)
- Memory benchmark: navigate all 3 levels 10 times, verify no leak via snapshot comparison
- Network: verify regex batching produces expected request count (10 gauges = 1 request)

### Accessibility Tests
- Axe-core audit on all 3 levels + comparison overlay + empty state
- Keyboard navigation: Tab through all interactive elements, Enter to drill down, Escape to go back
- Screen reader: verify aria-labels and live regions announce state changes

### Manual Testing Checklist
- [ ] Navigate to Discover > Metrics — "Explore" is the first/default tab
- [ ] No Prometheus connection → setup guide shown
- [ ] First visit → "Most Active Metrics" onboarding section shown
- [ ] Metrics load and group by prefix; grouping toggle works
- [ ] Label filter bar: add `job=X` → metrics scoped to that job
- [ ] Search filters metrics in real-time (debounced)
- [ ] Sparklines render lazily on scroll, abort on fast scroll
- [ ] >5k metrics → cardinality warning banner shown
- [ ] Click metric → detail view with metadata and chart
- [ ] Metadata unavailable → graceful fallback, info banner
- [ ] Auto-generated PromQL uses correct rate interval
- [ ] Copy PromQL → clipboard contains correct query
- [ ] Open in Query tab → switches tab with PromQL pre-filled
- [ ] Click label → breakdown view with small multiples
- [ ] High-cardinality label → warning icon, topk(20) applied
- [ ] Filter chips accumulate and can be removed
- [ ] Select 2 metrics → "Compare selected" overlay renders
- [ ] Breadcrumb navigation works at all levels
- [ ] URL changes on navigation; pasting URL restores state
- [ ] Time range change → debounced refresh, no thundering herd
- [ ] Works with multiple Prometheus data connections
- [ ] Works with Prometheus-compatible long-term storage backends

---

## 8. Implementation Phases

### Phase 1: Foundation (Days 1-3)
- `TabDefinition.isQueryDriven` flag + framework check in query actions
- `MetricQueryGenerator` interface + `PromQLQueryGenerator` implementation + tests
- `prometheus_helpers.ts`, `metrics_explorer_cache.ts` (with dedup + max entries), `scrape_interval_detector.ts`
- `metrics_explorer_context.tsx` with URL state sync
- `MetricsExplorerTab` (code-split) + `MetricsExplorerContainer` + tab registration
- Constants in `common/index.ts`
- `queryRange()` method on `PrometheusResourceClient`

### Phase 2: Metric Browser — Level 1 (Days 4-7)
- `SparklineChart` component (reused across levels)
- `useMetricsList` hook (with 5k cap, label filter scoping via `/series`)
- `useSparklineData` hook (regex batching, concurrency limit, AbortController)
- `MetricSearchBar`, `LabelFilterBar`, `GroupingToggle`, `CardinalityBanner`
- `MetricCard` (with checkbox, sparkline, current value, change indicator)
- `MetricGroup` + `metric_grouping.ts` (handles `_` and `.` delimiters)
- `RecentlyViewed` + `MostActiveMetrics` (onboarding)
- `ComparisonOverlay` for multi-select

### Phase 3: Metric Detail — Level 2 (Days 8-9)
- `useMetricDetail` hook (parallel metadata + labels + chart, metadata fallback)
- `MetricMetadataPanel` (with unavailable fallback state)
- `MetricFullChart` using `@elastic/charts`
- `LabelSelector` (with cardinality badges + high-cardinality warning)
- `QueryActions` (Copy PromQL + Open in editor)

### Phase 4: Label Breakdown — Level 3 (Days 10-11)
- `useLabelBreakdown` hook (scoped via `/series`, `topk(20)` in query, concurrency limited)
- `LabelValueCard` + shared `LabelFilterBar`
- Error states for very high cardinality (>10k block)

### Phase 5: Polish & Hardening (Days 12-14)
- Breadcrumb navigation
- Loading/empty/error states for all levels
- Keyboard navigation + accessibility
- Performance tuning + axe-core audit
- Degraded-mode testing (no metadata, high cardinality, various backends)
- Documentation

---

## 9. Resolved Design Decisions

| # | Decision | Resolution | Rationale |
|---|----------|------------|-----------|
| 1 | Default tab order | First tab (order 5) | Lowest-barrier entry point for new users |
| 2 | Sparkline data source | Range queries with regex batching for gauges, individual for counters | Balances visual fidelity with backend load |
| 3 | Label cardinality cap | 20 via `topk()` server-side | "Show all" expands with warning >100; blocked >10k |
| 4 | Cache TTL | 60s data, 5min metadata | Max 500 entries with LRU; configurable setting deferred |
| 5 | Metric grouping | Multi-strategy toggle: prefix (`_` and `.`), alphabetical, by label | Supports Prometheus, OTel, and custom naming conventions |
| 6 | Rate interval | Auto-detected via `/api/v1/status/config` | Fallback: `max(4*scrape_interval, 1m)`, default `1m` |
| 7 | URL state | Included in MVP | 6 fields as query params; enables incident collaboration |
| 8 | Tab contract | `isQueryDriven: false` flag on `TabDefinition` | Framework skips query execution for explorer-style tabs |
| 9 | Level 1 label filtering | Via `/series` API with matchers | Critical for incident workflows — scope by service/instance |
| 10 | Metric comparison | MVP — checkbox multi-select (max 4) | Overlay chart at Level 1 for side-by-side correlation |
| 11 | PromQL bridge | MVP — Copy PromQL + Open in Query tab | Available at Levels 2 and 3 for power-user escape hatch |
| 12 | Query generation | `MetricQueryGenerator` interface | `PromQLQueryGenerator` as default; OTel support via new impl |
| 13 | Multi-tenancy | Relies on existing datasource proxy | Explicit tenant header injection planned for Phase 2 |

---

## 10. Design Review Summary

This design was reviewed by three principal engineers with the following perspectives. All critical and major findings have been incorporated into the design above.

### Architecture & Engineering Review

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | Critical | Tab contract mismatch — explorer bypasses query lifecycle | `isQueryDriven: boolean` flag on `TabDefinition` (Section 3.2) |
| 2 | Major | N+1 sparkline fetching problem | Regex batching for gauges, new `queryRange()`, concurrency cap (Section 3.2) |
| 3 | Major | No degraded-mode design | Explicit error states per level, cardinality guards table (Section 3.2) |
| 4 | Major | Query generation not pluggable | `MetricQueryGenerator` interface (Section 3.2) |
| 5 | Minor | Cache lacks deduplication and memory bounds | Max entries, LRU, request deduplication, AbortController (Section 3.2) |
| 6 | Minor | No code-splitting for 25+ new files | `React.lazy()` at registration (Section 3.3) |
| 7 | Minor | Testing gaps | Performance benchmarks, axe-core audits, IntersectionObserver mocks (Section 7) |
| 8 | Nit | State shape missing loading/error | `levelStatus` with typed error actions (Section 3.2) |

### Operational Reliability & Scalability Review

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | Critical | Unbounded metric name fetch on large backends | 5k cap + label filter scoping via `/series` (Section 3.2) |
| 2 | Critical | Label value fetch with no cardinality guard | Replaced with `/series` API scoped to metric (Section 3.3) |
| 3 | Major | Hardcoded rate interval | Auto-detect via config API, fallback heuristic (Section 3.2) |
| 4 | Major | Thundering herd on time range change | 800ms debounce + AbortController (Section 3.3) |
| 5 | Major | No query safety limits | Explicit timeouts, max series, `topk()` in breakdowns (Section 3.3) |
| 6 | Minor | Metadata API varies across backends | Graceful fallback, 5min cache, info banner (Section 3.2) |
| 7 | Minor | Multi-tenancy not addressed | Documented constraint, Phase 2 scope (Section 3.3) |
| 8 | Nit | Sparkline step calculation unspecified | Formula: `max(range/100, 4*scrapeInterval, 15s)` (Section 3.2) |

### UX Workflow & Metrics Domain Review

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | Critical | No label-value filtering at Level 1 | `LabelFilterBar` with `/series` API matchers (Section 3.1) |
| 2 | Major | No metric comparison workflow | Checkbox multi-select + `ComparisonOverlay` (Section 3.1) |
| 3 | Major | No escape hatch to query editor | Copy PromQL + Open in Query tab actions (Section 3.1, 3.3) |
| 4 | Major | No empty state or onboarding | Most Active Metrics, Recently Viewed, setup guide (Section 3.1) |
| 5 | Minor | Sparkline cards lack information scent | Current value/rate + change indicator on cards (Section 3.1) |
| 6 | Minor | Ephemeral state not shareable | URL state sync in MVP (Section 3.2) |
| 7 | Minor | Unclear differentiation | Label-first browsing, cross-signal architecture, comparison (Section 1) |
| 8 | Nit | Single grouping strategy too rigid | Multi-strategy toggle with `_` and `.` support (Section 3.1) |

---

## 11. References

- [Prometheus HTTP API](https://prometheus.io/docs/prometheus/latest/querying/api/) — Underlying metadata and query APIs
- [OpenSearch Observability](https://opensearch.org/docs/latest/observing-your-data/) — OpenSearch observability documentation
- Existing implementation pattern: `src/plugins/explore/public/application/utils/query_assist/promql_tool_handlers.ts`
- Tab registry: `src/plugins/explore/public/services/tab_registry/tab_registry_service.ts`
- Prometheus client: `src/plugins/query_enhancements/public/resources/prometheus_resource_client.ts`

---

_We welcome community feedback on this RFC. Please comment on the associated GitHub issue with your use cases, concerns, or suggestions._
