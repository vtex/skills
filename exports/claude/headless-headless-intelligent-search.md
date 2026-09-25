This skill provides guidance for AI agents working with VTEX Headless Front-End Development. Apply these constraints and patterns when assisting developers with apply when implementing search functionality, faceted navigation, or autocomplete in a headless VTEX storefront. Covers product_search, autocomplete_suggestions, facets, banners, correction_search, and top_searches endpoints, plus analytics event collection. Use for any custom frontend that integrates VTEX Intelligent Search API for product discovery and search result rendering.

# Intelligent Search API Integration

## When this skill applies

Use this skill when implementing product search, category browsing, autocomplete, or faceted filtering in a headless VTEX storefront.

- Building a search results page with product listings
- Implementing faceted navigation (category, brand, price, color filters)
- Adding autocomplete suggestions to a search input
- Wiring up search analytics events for Intelligent Search ranking

Do not use this skill for:
- BFF architecture and API routing decisions (use [`headless-bff-architecture`](../headless-bff-architecture/skill.md))
- Checkout or cart API integration (use [`headless-checkout-proxy`](../headless-checkout-proxy/skill.md))
- Caching strategy and TTL configuration (use [`headless-caching-strategy`](../headless-caching-strategy/skill.md))

## Decision rules

- Call Intelligent Search **directly from the frontend** — it is the ONE exception to the "everything through BFF" rule. It is fully public and requires no authentication.
- Do NOT proxy Intelligent Search through the BFF unless you have a specific need (e.g., server-side rendering). Proxying adds latency on a high-frequency operation.
- Always use the API's `sort` parameter and facet paths for filtering and sorting — never re-sort or re-filter results client-side.
- Always include `page` and `locale` parameters in every search request.
- When paginating beyond the first page, always reuse the `operator` and `fuzzy` values returned by the API from the first page — the API decides these values dynamically based on the search query.
- Always send analytics events to the Intelligent Search Events API — without them, search ranking degrades over time.

Search endpoints overview:

| Endpoint | Method | Purpose |
|---|---|---|
| `/product_search/{facets}` | GET | Search products by query and/or facets |
| `/facets/{facets}` | GET | Get available filters for a query |
| `/autocomplete_suggestions` | GET | Get term and product suggestions while typing |
| `/top_searches` | GET | Get the 10 most popular search terms |
| `/correction_search` | GET | Get spelling correction for a misspelled term |
| `/search_suggestions` | GET | Get suggested terms similar to the search term |
| `/banners/{facets}` | GET | Get banners configured for a query |

Facet combination rules:
- **Same facet type → OR (union)**: Selecting "Red" and "Blue" for color returns products matching either color
- **Different facet types → AND (intersection)**: Selecting "Red" color and "Nike" brand returns only red Nike products

## Hard constraints

### Constraint: MUST send analytics events to Intelligent Search Events API

Every headless search implementation MUST send analytics events to the Intelligent Search Events API - Headless. At minimum, send search impression events when results are displayed and click events when a product is selected from search results.

**Why this matters**

Intelligent Search uses machine learning to rank results based on user behavior. Without analytics events, the search engine has no behavioral data and cannot personalize or optimize results. Over time, search quality degrades compared to stores that send events. Additionally, VTEX Admin search analytics dashboards will show no data.

**Detection**

If a search implementation renders results from Intelligent Search but has no calls to `sp.vtex.com/event-api` or the Intelligent Search Events API → STOP immediately. Analytics events must be implemented alongside search.

**Correct**

```typescript
// search-analytics.ts — sends events to Intelligent Search Events API
const ACCOUNT_NAME = "mystore";
const EVENTS_URL = `https://sp.vtex.com/event-api/v1/${ACCOUNT_NAME}/event`;

interface SearchEvent {
  type: "search.query" | "search.click" | "search.add_to_cart";
  text: string;
  misspelled: boolean;
  match: number;
  operator: string;
  locale: string;
  agent: string;
  url: string;
  products?: Array<{ productId: string; position: number }>;
}

export async function sendSearchEvent(event: SearchEvent): Promise<void> {
  try {
    await fetch(EVENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true, // ensures event is sent even during navigation
    });
  } catch (error) {
    // Analytics failures should not break the UI
    console.warn("Failed to send search event:", error);
  }
}

// Usage: call after rendering search results
function onSearchResultsRendered(query: string, products: Product[]): void {
  sendSearchEvent({
    type: "search.query",
    text: query,
    misspelled: false,
    match: products.length,
    operator: "and",
    locale: "en-US",
    agent: "my-headless-store",
    url: window.location.href,
    products: products.map((p, i) => ({
      productId: p.productId,
      position: i + 1,
    })),
  });
}
```

**Wrong**

```typescript
// Search works but NO analytics events are sent — search ranking degrades
async function searchProducts(query: string): Promise<Product[]> {
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/io/_v/api/intelligent-search/product_search/?query=${query}&locale=en-US`
  );
  const data = await response.json();
  return data.products;
  // Missing: no call to sendSearchEvent() — Intelligent Search cannot learn
}
```

---

### Constraint: MUST persist operator and fuzzy values across pagination

When paginating search results beyond the first page, you MUST reuse the `operator` and `fuzzy` values returned by the API in the first page response. The first request should send these as `null`, but subsequent pages must use the values from the initial response.

**Why this matters**

The Intelligent Search API dynamically determines the best `operator` and `fuzzy` values based on the query and available results. Using fixed values (like always `operator: "or"` or `fuzzy: "0"`) or forgetting to pass them on subsequent pages causes inconsistent results — page 2 may show products that don't match the criteria from page 1, or may miss valid results. This is a common source of poor search experience but is not well-documented by VTEX.

**Detection**

If pagination implementation does not store and reuse `operator`/`fuzzy` from the first page response → STOP immediately. Subsequent pages will return inconsistent results.

**Correct**

```typescript
// Properly manages operator/fuzzy across pagination
interface SearchState {
  query: string;
  page: number;
  count: number;
  locale: string;
  facets?: string;
  operator: string | null; // null for first page, then persisted
  fuzzy: string | null;    // null for first page, then persisted
}

async function searchProducts(state: SearchState): Promise<SearchResponse> {
  const { query, page, count, locale, facets = "", operator, fuzzy } = state;

  const params = new URLSearchParams({
    query,
    locale,
    page: String(page),
    count: String(count),
  });

  // Only add operator/fuzzy if this is not the first page
  if (operator !== null) params.set("operator", operator);
  if (fuzzy !== null) params.set("fuzzy", fuzzy);

  const baseUrl = `https://${ACCOUNT}.vtexcommercestable.com.br`;
  const facetPath = facets ? `/${facets}` : "";
  const url = `${baseUrl}/api/io/_v/api/intelligent-search/product_search${facetPath}?${params}`;

  const response = await fetch(url);
  const data = await response.json();

  // Store operator/fuzzy from response for next page
  if (page === 0) {
    state.operator = data.operator;
    state.fuzzy = data.fuzzy;
  }

  return data;
}

// Usage: first page
const state: SearchState = {
  query: "running shoes",
  page: 0,
  count: 24,
  locale: "en-US",
  operator: null, // API will decide
  fuzzy: null,    // API will decide
};

const firstPage = await searchProducts(state);

// Usage: subsequent pages
state.page = 1;
const secondPage = await searchProducts(state); // reuses operator/fuzzy
```

**Wrong**

```typescript
// Using fixed operator/fuzzy values — causes bad results
async function searchProducts(query: string, page: number): Promise<SearchResponse> {
  const params = new URLSearchParams({
    query,
    locale: "en-US",
    page: String(page),
    count: "24",
    operator: "or", // WRONG: fixed value instead of API-provided
    fuzzy: "0",     // WRONG: fixed value instead of API-provided
  });

  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/io/_v/api/intelligent-search/product_search/?${params}`
  );
  return response.json();
}

// Or forgetting operator/fuzzy entirely on subsequent pages
async function searchProductsPage2(query: string): Promise<SearchResponse> {
  const params = new URLSearchParams({
    query,
    locale: "en-US",
    page: "1", // WRONG: no operator/fuzzy from first page
    count: "24",
  });
  // ...
}
```

---

### Constraint: Do NOT unnecessarily proxy Intelligent Search through BFF

Intelligent Search API requests SHOULD be made directly from the frontend. Do not route search traffic through the BFF unless you have a specific need (e.g., server-side rendering, adding custom business logic).

**Why this matters**

Intelligent Search is a public API that does not require authentication. Adding a BFF proxy layer introduces an additional network hop, increases latency on every search operation, adds server cost, and prevents the CDN from caching responses efficiently. Search queries are high-frequency operations — even 50ms of added latency impacts conversion.

**Detection**

If all Intelligent Search calls go through a BFF endpoint instead of directly to VTEX → note this to the developer. It is not a security issue but a performance concern. If there is no justification (like SSR), recommend direct frontend calls.

**Correct**

```typescript
// Frontend — calls Intelligent Search directly (no BFF needed)
const VTEX_SEARCH_BASE = `https://${ACCOUNT}.vtexcommercestable.com.br/api/io/_v/api/intelligent-search`;

export async function getAutocomplete(term: string, locale: string): Promise<AutocompleteResponse> {
  const params = new URLSearchParams({ query: term, locale });
  const response = await fetch(`${VTEX_SEARCH_BASE}/autocomplete_suggestions?${params}`);
  return response.json();
}

export async function getTopSearches(locale: string): Promise<TopSearchesResponse> {
  const params = new URLSearchParams({ locale });
  const response = await fetch(`${VTEX_SEARCH_BASE}/top_searches?${params}`);
  return response.json();
}

export async function getFacets(facetPath: string, query: string, locale: string): Promise<FacetsResponse> {
  const params = new URLSearchParams({ query, locale });
  const response = await fetch(`${VTEX_SEARCH_BASE}/facets/${facetPath}?${params}`);
  return response.json();
}
```

**Wrong**

```typescript
// BFF proxy for Intelligent Search — unnecessary overhead
// server/routes/search.ts
router.get("/api/bff/search", async (req, res) => {
  const { query, from, to, locale } = req.query;
  // This just forwards to VTEX with no added value
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/io/_v/api/intelligent-search/product_search/?query=${query}&from=${from}&to=${to}&locale=${locale}`
  );
  const data = await response.json();
  res.json(data); // Added latency for no benefit
});
```

## Preferred pattern

Data flow for Intelligent Search in a headless storefront:

```text
Frontend (Browser)
    │
    ├── GET /api/io/_v/api/intelligent-search/product_search/...
    │   └── Returns: products, pagination info, operator, fuzzy
    │
    ├── GET /api/io/_v/api/intelligent-search/facets/...
    │   └── Returns: available filters with counts
    │
    ├── GET /api/io/_v/api/intelligent-search/autocomplete_suggestions?query=...
    │   └── Returns: suggested terms + suggested products
    │
    └── POST https://sp.vtex.com/event-api/v1/{account}/event
        └── Sends: search impressions, clicks, add-to-cart events
```

Typed search API client for all endpoints:

```typescript
// lib/intelligent-search-client.ts
const ACCOUNT = "mystore";
const ENVIRONMENT = "vtexcommercestable";
const BASE_URL = `https://${ACCOUNT}.${ENVIRONMENT}.com.br/api/io/_v/api/intelligent-search`;

interface ProductSearchParams {
  query?: string;
  page: number;
  count?: number;
  locale: string;
  facets?: string;
  sort?: "price:asc" | "price:desc" | "orders:desc" | "name:asc" | "name:desc" | "release:desc" | "discount:desc";
  hideUnavailableItems?: boolean;
  operator?: string | null;
  fuzzy?: string | null;
  // Optional parameters
  simulationBehavior?: "default" | "skip" | "only1P";
}

interface ProductSearchResponse {
  products: Product[];
  recordsFiltered: number;
  // Pagination info
  pagination: {
    count: number;
    current: { index: number };
    before: Array<{ index: number }>;
    after: Array<{ index: number }>;
    perPage: number;
    next: { index: number } | null;
    previous: { index: number } | null;
    first: { index: number };
    last: { index: number };
  };
  // Search metadata to persist for next pages
  operator: string;
  fuzzy: string;
  // Spelling correction info
  correction?: {
    misspelled: boolean;
    text: string;
    correction: string;
  };
  // Search behavior
  translated: boolean;
  locale: string;
  query: string;
}

export async function productSearch(params: ProductSearchParams): Promise<ProductSearchResponse> {
  const { facets = "", operator, fuzzy, ...queryParams } = params;
  const searchParams = new URLSearchParams();

  if (queryParams.query) searchParams.set("query", queryParams.query);
  searchParams.set("page", String(queryParams.page));
  searchParams.set("locale", queryParams.locale);
  if (queryParams.count) searchParams.set("count", String(queryParams.count));
  if (queryParams.sort) searchParams.set("sort", queryParams.sort);
  if (queryParams.hideUnavailableItems) searchParams.set("hideUnavailableItems", "true");
  if (queryParams.simulationBehavior) searchParams.set("simulationBehavior", queryParams.simulationBehavior);
  
  // Only add operator/fuzzy if not null (i.e., not first page)
  if (operator !== null && operator !== undefined) searchParams.set("operator", operator);
  if (fuzzy !== null && fuzzy !== undefined) searchParams.set("fuzzy", fuzzy);

  const facetPath = facets ? `/${facets}` : "";
  const url = `${BASE_URL}/product_search${facetPath}?${searchParams}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }
  return response.json();
}
```

Response structure notes:

- **`operator` and `fuzzy`**: Must be stored from the first page and reused on subsequent pages. Also critical for analytics events.
- **`pagination`**: Contains rich pagination metadata including available pages before/after current
- **`correction.misspelled`**: Boolean indicating if the search term is misspelled. Must be sent accurately in analytics events.
- **`recordsFiltered`**: Total number of results matching the search (across all pages)
- **`products`**: Array of products for the current page only

Faceted navigation helper:

```typescript
// lib/facets.ts
export async function getFacets(
  facetPath: string,
  query: string,
  locale: string
): Promise<FacetsResponse> {
  const params = new URLSearchParams({ query, locale });
  const url = `${BASE_URL}/facets/${facetPath}?${params}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Facets fetch failed: ${response.status}`);
  }
  return response.json();
}

// Build facet path from selected filters
export function buildFacetPath(selectedFilters: Record<string, string[]>): string {
  const parts: string[] = [];
  for (const [key, values] of Object.entries(selectedFilters)) {
    for (const value of values) {
      parts.push(`${key}/${value}`);
    }
  }
  return parts.join("/");
}
```

Debounced autocomplete for search inputs:

```typescript
// lib/autocomplete.ts
export function createDebouncedAutocomplete(delayMs: number = 300) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debouncedAutocomplete(
    query: string,
    locale: string,
    callback: (suggestions: AutocompleteResponse) => void
  ): void {
    if (timeoutId) clearTimeout(timeoutId);

    if (query.length < 2) {
      callback({ searches: [] });
      return;
    }

    timeoutId = setTimeout(async () => {
      const params = new URLSearchParams({ query, locale });
      const response = await fetch(`${BASE_URL}/autocomplete_suggestions?${params}`);
      const suggestions = await response.json();
      callback(suggestions);
    }, delayMs);
  };
}
```

Full search orchestration with analytics:

```typescript
// search-page.ts — framework-agnostic search orchestration
import { productSearch } from "./lib/intelligent-search-client";
import { getFacets, buildFacetPath } from "./lib/facets";
import { createDebouncedAutocomplete } from "./lib/autocomplete";
import { sendSearchEvent } from "./search-analytics";

interface SearchState {
  query: string;
  page: number;
  count: number;
  locale: string;
  selectedFilters: Record<string, string[]>;
  operator: string | null;
  fuzzy: string | null;
  results: ProductSearchResponse | null;
  facets: FacetsResponse | null;
}

const state: SearchState = {
  query: "",
  page: 0,
  count: 24,
  locale: "en-US",
  selectedFilters: {},
  operator: null, // API decides on first page
  fuzzy: null,    // API decides on first page
  results: null,
  facets: null,
};

async function executeSearch(): Promise<void> {
  const facetPath = buildFacetPath(state.selectedFilters);

  const [searchResults, facetResults] = await Promise.all([
    productSearch({
      query: state.query,
      page: state.page,
      count: state.count,
      locale: state.locale,
      facets: facetPath,
      operator: state.operator,
      fuzzy: state.fuzzy,
    }),
    getFacets(facetPath, state.query, state.locale),
  ]);

  // Store operator/fuzzy from first page for subsequent pages
  if (state.page === 0) {
    state.operator = searchResults.operator;
    state.fuzzy = searchResults.fuzzy;
  }

  state.results = searchResults;
  state.facets = facetResults;

  // Send analytics event after results are rendered
  sendSearchEvent({
    type: "search.query",
    text: state.query,
    misspelled: searchResults.correction?.misspelled ?? false,
    match: searchResults.recordsFiltered,
    operator: searchResults.operator,
    locale: state.locale,
    agent: "my-headless-store",
    url: window.location.href,
    products: searchResults.products.map((p, i) => ({
      productId: p.productId,
      position: state.page * searchResults.products.length + i + 1,
    })),
  });
}

// Handle product click from search results — send click event
function onProductClick(productId: string, position: number): void {
  sendSearchEvent({
    type: "search.click",
    text: state.query,
    misspelled: false,
    match: state.results?.recordsFiltered ?? 0,
    operator: state.results?.operator ?? "and",
    locale: state.locale,
    agent: "my-headless-store",
    url: window.location.href,
    products: [{ productId, position }],
  });
}

// Handle page change
function goToPage(newPage: number): void {
  state.page = newPage;
  executeSearch(); // reuses operator/fuzzy from first page
}

// Handle new search (reset pagination state)
function newSearch(query: string): void {
  state.query = query;
  state.page = 0;
  state.operator = null; // reset for new search
  state.fuzzy = null;    // reset for new search
  executeSearch();
}
```

## Common failure modes

- **Not tracking `correction.misspelled` and `operator` fields for analytics**: The API returns `correction.misspelled` (boolean indicating if the term is misspelled) and `operator` fields that must be sent correctly in analytics events. These values are critical for the Intelligent Search machine learning to understand search quality and user behavior.

  ```typescript
  const response = await productSearch({ query: "red nike shoes", page: 0, locale: "en-US" });
  
  // Extract values from API response
  const isMisspelled = response.correction?.misspelled ?? false;
  const operatorUsed = response.operator; // "and" or "or"
  
  // CRITICAL: Send these exact values to analytics
  sendSearchEvent({
    type: "search.query",
    text: response.query,
    misspelled: isMisspelled,  // Must match API's correction.misspelled
    operator: operatorUsed,    // Must match API's operator value
    match: response.recordsFiltered,
    locale: state.locale,
    agent: "my-headless-store",
    url: window.location.href,
    products: response.products.map((p, i) => ({
      productId: p.productId,
      position: i + 1,
    })),
  });
  ```

- **Not sending the `locale` parameter**: Without `locale`, Intelligent Search may return results in the wrong language or fail to apply locale-specific relevance rules. Multi-language stores will display mixed-language results. Always include `locale` in every request.

  ```typescript
  // Always include locale in search parameters
  const params = new URLSearchParams({
    query: "shoes",
    locale: "en-US", // Required for correct language processing
    page: "0",
    count: "24",
  });
  ```

- **Using fixed operator/fuzzy values or forgetting to persist them**: Setting fixed values like `operator: "or"` or `fuzzy: "0"` for all requests, or not passing them at all on subsequent pages. The API dynamically determines these values on the first page — you must store and reuse them for pagination.

  ```typescript
  // Store operator/fuzzy from first page, reuse on subsequent pages
  let searchState = { operator: null, fuzzy: null };
  
  const firstPage = await productSearch({
    query: "shoes",
    page: 0,
    count: 24,
    locale: "en-US"
  });
  searchState.operator = firstPage.operator; // Store from API response
  searchState.fuzzy = firstPage.fuzzy;
  
  // Page 2 reuses these values
  const secondPage = await productSearch({
    query: "shoes",
    page: 1,
    count: 24,
    locale: "en-US",
    operator: searchState.operator, // Reuse from first page
    fuzzy: searchState.fuzzy,
  });
  ```

- **Assuming `/product_search` returns facets**: The `/product_search` endpoint returns only products and pagination info. To get available filters, you must call the separate `/facets` endpoint. Make parallel requests if you need both.

  ```typescript
  // Fetch products and facets in parallel
  const [products, filters] = await Promise.all([
    productSearch({ query: "shoes", page: 0, locale: "en-US" }),
    getFacets("", "shoes", "en-US"), // Separate call for filters
  ]);
  ```

- **Not using `hideUnavailableItems` when appropriate**: By default, the API may return out-of-stock products. For most storefronts, set `hideUnavailableItems: true` to filter them out at the API level rather than client-side.

  ```typescript
  const response = await productSearch({
    query: "shoes",
    page: 0,
    locale: "en-US",
    hideUnavailableItems: true, // Filter out-of-stock products
  });
  ```

- **Rebuilding search ranking logic client-side**: Fetching results and then re-sorting or re-filtering them in the frontend discards Intelligent Search's ranking intelligence. Client-side filtering only works on the current page, not the full catalog. Use the API's `sort` parameter and facet paths.

  ```typescript
  // Use API-level sorting — don't re-sort in the frontend
  const results = await productSearch({
    query: "shirt",
    sort: "price:asc", // API handles sorting across entire result set
    locale: "en-US",
    from: 0,
    to: 23,
    facets: "category-1/clothing/color/red", // API handles filtering across entire catalog
  });
  ```

## Review checklist

- [ ] Is Intelligent Search called directly from the frontend (not unnecessarily routed through BFF)?
- [ ] Does every search request include `page` and `locale` parameters?
- [ ] Are `operator` and `fuzzy` values stored from the first page and reused on subsequent pages?
- [ ] Are `correction.misspelled` and `operator` from the API response sent correctly in analytics events?
- [ ] Are analytics events sent to `sp.vtex.com/event-api` after search results render?
- [ ] Are click events sent when a user selects a product from search results?
- [ ] Is sorting done via the API's `sort` parameter rather than client-side re-sorting?
- [ ] Is filtering done via facet paths rather than client-side filtering?
- [ ] Is autocomplete debounced to avoid excessive API calls?
- [ ] Are filters fetched from the `/facets` endpoint (not assumed to come from `/product_search`)?
- [ ] Is `hideUnavailableItems` set to `true` for storefronts that should hide out-of-stock products?

## Reference

- [Headless catalog and search](https://developers.vtex.com/docs/guides/headless-catalog) — Overview of catalog browsing and search in headless stores
- [Intelligent Search API reference](https://developers.vtex.com/docs/api-reference/intelligent-search-api) — Complete API reference for all search endpoints
- [Intelligent Search Events API - Headless](https://developers.vtex.com/docs/api-reference/intelligent-search-events-api-headless) — Events API for sending analytics from headless implementations
- [Intelligent Search overview](https://help.vtex.com/en/docs/tutorials/intelligent-search-overview) — General overview of Intelligent Search capabilities
- [Search configuration](https://help.vtex.com/en/docs/tutorials/search-configuration) — How to configure searchable specifications, facet ordering, and other search settings
- [Autocomplete](https://help.vtex.com/en/docs/tutorials/autocomplete) — How autocomplete suggestions work in Intelligent Search
