This skill provides guidance for AI agents working with VTEX Headless Front-End Development. Apply these constraints and patterns when assisting developers with apply when implementing caching logic, CDN configuration, or performance optimization for a headless VTEX storefront. Covers which VTEX APIs can be cached (Intelligent Search, Catalog) versus which must never be cached (Checkout, Profile, OMS), stale-while-revalidate patterns, cache invalidation, and BFF-level caching. Use for any headless project that needs TTL rules and caching strategy guidance.

# Caching & Performance for Headless VTEX

## When this skill applies

Use this skill when building or optimizing a headless VTEX storefront for performance. Proper caching is the single most impactful performance optimization for headless commerce.

- Configuring CDN or edge caching for Intelligent Search and Catalog APIs
- Adding BFF-level caching (in-memory or Redis) for frequently requested data
- Deciding which VTEX API responses can be cached and which must never be cached
- Implementing cache invalidation when catalog data changes

Do not use this skill for:
- BFF architecture and API routing decisions (use [`headless-bff-architecture`](../headless-bff-architecture/skill.md))
- Intelligent Search API integration specifics (use [`headless-intelligent-search`](../headless-intelligent-search/skill.md))
- Checkout proxy and OrderForm management (use [`headless-checkout-proxy`](../headless-checkout-proxy/skill.md))

## Decision rules

- Classify every VTEX API as cacheable or non-cacheable before implementing caching logic.
- **Cacheable** (public, read-only, non-personalized): Intelligent Search, Catalog public endpoints, top searches, autocomplete.
- **Non-cacheable** (transactional, personalized, sensitive): Checkout, Profile, OMS, Payments, Pricing private endpoints. These must NEVER be cached at any layer.
- Use `stale-while-revalidate` for the best freshness/performance balance — serve cached data instantly while refreshing in the background.
- Use moderate TTLs (2-15 minutes) combined with event-driven invalidation. Never set TTLs of hours/days without an invalidation mechanism.
- Cache by request URL/params only, not by user identity — catalog data is the same for all anonymous users in the same trade policy.
- Layer caching: CDN edge cache for direct frontend calls (Search), BFF cache (Redis/in-memory) for proxied catalog data.

Recommended TTLs:

| API | Recommended TTL | SWR |
|---|---|---|
| Intelligent Search (product_search) | 2-5 minutes | 60s |
| Catalog (category tree) | 5-15 minutes | 5 min |
| Intelligent Search (autocomplete) | 1-2 minutes | 30s |
| Intelligent Search (top searches) | 5-10 minutes | 2 min |
| Catalog (product details) | 5 minutes | 60s |

APIs that must NEVER be cached:

| API | Why |
|---|---|
| Checkout (`/api/checkout/`) | Cart data is per-user, changes with every action |
| Profile (`/api/profile-system/pvt/`) | Personal data, GDPR/LGPD sensitive |
| OMS (`/api/oms/pvt/orders`) | Order status changes, user-specific |
| Payments (`/api/payments/`) | Financial transactions, must always be real-time |
| Pricing private (`/api/pricing/pvt/`) | May have per-user pricing rules |

## Hard constraints

### Constraint: MUST cache public API data aggressively

Search results, catalog data, category trees, and other public read-only data MUST be cached at appropriate levels (CDN, BFF, or both). Without caching, every user request hits VTEX APIs directly.

**Why this matters**

Without caching, a headless storefront generates an API request for every single page view, search, and category browse. This quickly exceeds VTEX API rate limits (causing 429 errors and degraded service), adds 200-500ms of latency per request, and creates a poor shopper experience. A store with 10,000 concurrent users making uncached search requests will overwhelm any API.

**Detection**

If a headless storefront calls Intelligent Search or Catalog APIs without any caching layer (no CDN cache headers, no BFF cache, no `Cache-Control` headers) → STOP immediately. Caching must be implemented for all public, read-only API responses.

**Correct**

```typescript
// BFF route with in-memory cache for category tree
import { Router, Request, Response } from "express";

const router = Router();

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  staleAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): { data: T; isStale: boolean } | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;

  const now = Date.now();
  if (now > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return {
    data: entry.data,
    isStale: now > entry.staleAt,
  };
}

function setCache<T>(key: string, data: T, maxAgeMs: number, swrMs: number): void {
  const now = Date.now();
  cache.set(key, {
    data,
    staleAt: now + maxAgeMs,
    expiresAt: now + maxAgeMs + swrMs,
  });
}

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const CATALOG_BASE = `https://${VTEX_ACCOUNT}.vtexcommercestable.com.br/api/catalog_system/pub`;

// Category tree — cache for 15 minutes, SWR for 5 minutes
router.get("/categories", async (_req: Request, res: Response) => {
  const cacheKey = "category-tree";
  const cached = getCached<unknown>(cacheKey);

  if (cached && !cached.isStale) {
    res.set("X-Cache", "HIT");
    return res.json(cached.data);
  }

  // If stale, serve stale data and refresh in background
  if (cached && cached.isStale) {
    res.set("X-Cache", "STALE");
    res.json(cached.data);

    // Background refresh
    fetch(`${CATALOG_BASE}/category/tree/3`)
      .then((r) => r.json())
      .then((data) => setCache(cacheKey, data, 15 * 60 * 1000, 5 * 60 * 1000))
      .catch((err) => console.error("Background cache refresh failed:", err));
    return;
  }

  // Cache miss — fetch and cache
  try {
    const response = await fetch(`${CATALOG_BASE}/category/tree/3`);
    const data = await response.json();
    setCache(cacheKey, data, 15 * 60 * 1000, 5 * 60 * 1000);
    res.set("X-Cache", "MISS");
    res.json(data);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});
```

**Wrong**

```typescript
// No caching — every request hits VTEX directly
router.get("/categories", async (_req: Request, res: Response) => {
  // This fires on EVERY request — 10,000 users = 10,000 API calls
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/catalog_system/pub/category/tree/3`
  );
  const data = await response.json();
  res.json(data); // No cache headers, no BFF cache, no CDN cache
});
```

---

### Constraint: MUST NOT cache transactional or personal data

Responses from Checkout API, Profile API, OMS API, and Payments API MUST NOT be cached at any layer — not in the CDN, not in BFF memory, not in Redis, and not in browser cache.

**Why this matters**

Caching transactional data can cause catastrophic failures. A cached OrderForm means a shopper sees stale cart contents (wrong items, wrong prices). Cached profile data can leak one user's personal information to another user (especially behind shared caches). Cached order data shows stale statuses. Any of these is a security vulnerability, data privacy violation (GDPR/LGPD), or business logic failure.

**Detection**

If you see caching logic (Redis `set`, in-memory cache, `Cache-Control` headers with `max-age > 0`) applied to checkout, order, profile, or payment API responses → STOP immediately. These endpoints must always return fresh data.

**Correct**

```typescript
// BFF checkout route — explicitly no caching
import { Router, Request, Response } from "express";
import { vtexCheckout } from "../vtex-checkout-client";

export const checkoutRoutes = Router();

// Set no-cache headers for ALL checkout responses
checkoutRoutes.use((_req: Request, res: Response, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
  next();
});

checkoutRoutes.get("/cart", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  try {
    // Always fetch fresh — never cache
    const result = await vtexCheckout({
      path: `/api/checkout/pub/orderForm/${orderFormId}`,
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.vtexCookies = result.cookies;
    res.json(result.data);
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({ error: "Failed to fetch cart" });
  }
});
```

**Wrong**

```typescript
// CATASTROPHIC: Caching checkout data in Redis
import Redis from "ioredis";
const redis = new Redis();

checkoutRoutes.get("/cart", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;
  const cacheKey = `cart:${orderFormId}`;

  // WRONG: cached cart could have wrong items, old prices, or stale quantities
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json(JSON.parse(cached)); // Serving stale transactional data!
  }

  const result = await vtexCheckout({
    path: `/api/checkout/pub/orderForm/${orderFormId}`,
    cookies: req.session.vtexCookies || {},
  });

  // WRONG: caching cart data that changes with every user action
  await redis.setex(cacheKey, 300, JSON.stringify(result.data));
  res.json(result.data);
});
```

---

### Constraint: MUST implement cache invalidation strategy

Every caching implementation MUST have a clear invalidation strategy. Cached data must have appropriate TTLs and there must be a mechanism to force-invalidate cache when the underlying data changes.

**Why this matters**

Without invalidation, cached data becomes permanently stale. Products that are out of stock continue to appear available. Price changes don't reflect until the arbitrary TTL expires. New products are invisible. This leads to a poor shopper experience, failed orders (due to stale availability), and incorrect pricing.

**Detection**

If a caching implementation has no TTL (`max-age`, expiration time) or has very long TTLs (hours/days) without any invalidation mechanism → STOP immediately. All caches need bounded TTLs and ideally event-driven invalidation.

**Correct**

```typescript
// Cache with TTL + manual invalidation endpoint + event-driven invalidation
import { Router, Request, Response } from "express";

const router = Router();

// In-memory cache with TTL tracking
const productCache = new Map<string, { data: unknown; expiresAt: number }>();

function setProductCache(productId: string, data: unknown, ttlMs: number): void {
  productCache.set(productId, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

function getProductCache(productId: string): unknown | null {
  const entry = productCache.get(productId);
  if (!entry || Date.now() > entry.expiresAt) {
    productCache.delete(productId);
    return null;
  }
  return entry.data;
}

// Regular product endpoint with cache
router.get("/products/:productId", async (req: Request, res: Response) => {
  const { productId } = req.params;
  const cached = getProductCache(productId);

  if (cached) {
    return res.json(cached);
  }

  const response = await fetch(
    `https://${process.env.VTEX_ACCOUNT}.vtexcommercestable.com.br/api/catalog_system/pub/products/search?fq=productId:${productId}`
  );
  const data = await response.json();

  setProductCache(productId, data, 5 * 60 * 1000); // 5-minute TTL
  res.json(data);
});

// Manual invalidation endpoint (secured with API key)
router.post("/cache/invalidate", (req: Request, res: Response) => {
  const adminKey = req.headers["x-admin-key"];
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { productId, pattern } = req.body as { productId?: string; pattern?: string };

  if (productId) {
    productCache.delete(productId);
    return res.json({ invalidated: [productId] });
  }

  if (pattern === "all") {
    const count = productCache.size;
    productCache.clear();
    return res.json({ invalidated: count });
  }

  res.status(400).json({ error: "Provide productId or pattern" });
});

// Webhook endpoint for VTEX catalog change events
router.post("/webhooks/catalog-change", (req: Request, res: Response) => {
  const { productId } = req.body as { productId?: string };

  if (productId) {
    productCache.delete(productId);
    console.log(`Cache invalidated for product ${productId}`);
  }

  res.status(200).json({ received: true });
});

export default router;
```

**Wrong**

```typescript
// Cache with no TTL and no invalidation — data becomes permanently stale
const cache = new Map<string, unknown>();

router.get("/products/:productId", async (req: Request, res: Response) => {
  const { productId } = req.params;

  // Once cached, this data NEVER expires — price changes, stock updates are invisible
  if (cache.has(productId)) {
    return res.json(cache.get(productId));
  }

  const response = await fetch(`https://mystore.vtexcommercestable.com.br/api/catalog_system/pub/products/search?fq=productId:${productId}`);
  const data = await response.json();
  cache.set(productId, data); // No TTL! No invalidation! Stale forever!
  res.json(data);
});
```

## Preferred pattern

Cache layer architecture for a headless VTEX storefront:

```text
Frontend (Browser)
    │
    ├── Direct to CDN (Intelligent Search)
    │   └── CDN Edge Cache (TTL: 2-5 min, SWR: 60s)
    │       └── VTEX Intelligent Search API
    │
    └── BFF Endpoints
        │
        ├── Cacheable routes (catalog, category tree)
        │   └── BFF Cache Layer (Redis/in-memory)
        │       └── VTEX Catalog API
        │
        └── Non-cacheable routes (checkout, profile, orders)
            └── Direct proxy to VTEX (NO CACHING)
```

CDN cache headers for Intelligent Search (edge function example):

```typescript
// cloudflare-worker.ts or similar edge function
async function handleSearchRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Only cache GET requests to Intelligent Search
  if (request.method !== "GET") {
    return fetch(request);
  }

  // Check CDN cache first
  const cacheKey = new Request(url.toString(), request);
  const cachedResponse = await caches.default.match(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Fetch from VTEX
  const response = await fetch(request);
  const responseClone = response.clone();

  // Add cache headers
  const cachedRes = new Response(responseClone.body, responseClone);
  cachedRes.headers.set(
    "Cache-Control",
    "public, max-age=120, stale-while-revalidate=60"
  );

  // Store in CDN cache
  await caches.default.put(cacheKey, cachedRes.clone());

  return cachedRes;
}
```

Redis-based BFF cache with stale-while-revalidate:

```typescript
// server/cache/redis-cache.ts
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

interface CacheOptions {
  ttlSeconds: number;
  swrSeconds?: number;
}

export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions
): Promise<{ data: T; cacheStatus: "HIT" | "STALE" | "MISS" }> {
  const { ttlSeconds, swrSeconds = 0 } = options;

  // Try to get from cache
  const cached = await redis.get(key);
  if (cached) {
    const ttl = await redis.ttl(key);
    const isStale = ttl <= swrSeconds;

    if (isStale && swrSeconds > 0) {
      // Serve stale, refresh in background
      fetcher()
        .then((freshData) =>
          redis.setex(key, ttlSeconds + swrSeconds, JSON.stringify(freshData))
        )
        .catch((err) => console.error(`Background refresh failed for ${key}:`, err));

      return { data: JSON.parse(cached) as T, cacheStatus: "STALE" };
    }

    return { data: JSON.parse(cached) as T, cacheStatus: "HIT" };
  }

  // Cache miss — fetch and store
  const data = await fetcher();
  await redis.setex(key, ttlSeconds + swrSeconds, JSON.stringify(data));

  return { data, cacheStatus: "MISS" };
}

export async function invalidateCache(pattern: string): Promise<number> {
  const keys = await redis.keys(pattern);
  if (keys.length === 0) return 0;
  return redis.del(...keys);
}
```

Applying cache strategy per route group:

```typescript
// server/middleware/cache-headers.ts
import { Request, Response, NextFunction } from "express";

export function cacheHeaders(type: "public" | "private" | "no-cache") {
  return (_req: Request, res: Response, next: NextFunction) => {
    switch (type) {
      case "public":
        res.set({
          "Cache-Control": "public, max-age=120, stale-while-revalidate=60",
          Vary: "Accept-Encoding",
        });
        break;
      case "private":
        res.set({
          "Cache-Control": "private, max-age=60",
          Vary: "Accept-Encoding, Cookie",
        });
        break;
      case "no-cache":
        res.set({
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "Surrogate-Control": "no-store",
        });
        break;
    }
    next();
  };
}

// server/index.ts — apply cache strategies per route group
import express from "express";
import { cacheHeaders } from "./middleware/cache-headers";
import catalogRoutes from "./routes/catalog";
import { checkoutRoutes } from "./routes/checkout";
import { orderRoutes } from "./routes/orders";
import { profileRoutes } from "./routes/profile";

const app = express();
app.use(express.json());

// Cacheable routes — public catalog data
app.use("/api/bff/catalog", cacheHeaders("public"), catalogRoutes);

// Non-cacheable routes — transactional and personal data
app.use("/api/bff/checkout", cacheHeaders("no-cache"), checkoutRoutes);
app.use("/api/bff/orders", cacheHeaders("no-cache"), orderRoutes);
app.use("/api/bff/profile", cacheHeaders("no-cache"), profileRoutes);
```

## Common failure modes

- **Caching based on session or user identity**: Creating per-user caches for catalog data (e.g., keying product search results by user ID) multiplies storage by user count and eliminates the primary benefit of caching. Cache public API responses by request URL/params only. For trade-policy-specific pricing, include trade policy (not user ID) in the cache key.

  ```typescript
  // Cache key based on request parameters only — not user identity
  function buildCacheKey(path: string, params: Record<string, string>): string {
    const sortedParams = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    return `search:${path}:${sortedParams}`;
  }
  ```

- **Setting extremely long cache TTLs without invalidation**: TTLs of hours or days mean price changes, stock updates, and new products are invisible to shoppers. Use moderate TTLs (2-15 minutes) combined with event-driven invalidation and `stale-while-revalidate`.

  ```typescript
  // Moderate TTL with stale-while-revalidate
  const CACHE_CONFIG = {
    search: { ttlSeconds: 120, swrSeconds: 60 },      // 2 min + 1 min SWR
    categories: { ttlSeconds: 900, swrSeconds: 300 },  // 15 min + 5 min SWR
    product: { ttlSeconds: 300, swrSeconds: 60 },       // 5 min + 1 min SWR
    topSearches: { ttlSeconds: 600, swrSeconds: 120 },  // 10 min + 2 min SWR
  } as const;
  ```

- **No cache monitoring or observability**: Without measuring hit/miss/stale rates, you cannot tell if caching is effective or if TTLs are appropriate. Add `X-Cache` headers and track metrics in your observability platform.

  ```typescript
  // Add cache observability to every cached response
  interface CacheMetrics {
    hits: number;
    misses: number;
    stale: number;
  }

  const metrics: CacheMetrics = { hits: 0, misses: 0, stale: 0 };

  export function getCacheMetrics(): CacheMetrics & { hitRate: string } {
    const total = metrics.hits + metrics.misses + metrics.stale;
    const hitRate = total > 0 ? ((metrics.hits / total) * 100).toFixed(1) + "%" : "N/A";
    return { ...metrics, hitRate };
  }
  ```

## Review checklist

- [ ] Are all public, read-only API responses (Search, Catalog) cached at CDN and/or BFF level?
- [ ] Are transactional/personal API responses (Checkout, Profile, OMS, Payments) explicitly NOT cached with `no-store` headers?
- [ ] Do all caches have bounded TTLs (not permanent/infinite)?
- [ ] Is there a cache invalidation mechanism (TTL + event-driven or manual purge)?
- [ ] Are cache keys based on request parameters, not user identity?
- [ ] Is `stale-while-revalidate` used for the best freshness/performance balance?
- [ ] Are TTLs moderate (2-15 minutes) rather than extremely long (hours/days)?
- [ ] Is cache observability in place (X-Cache headers, hit/miss metrics)?

## Reference

- [How the cache works](https://help.vtex.com/en/docs/tutorials/understanding-how-the-cache-works) — VTEX native caching behavior and cache layer architecture
- [Cloud infrastructure](https://developers.vtex.com/docs/guides/cloud-infrastructure) — VTEX CDN, router, and caching infrastructure overview
- [Best practices for avoiding rate limit errors](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) — Caching as a strategy to avoid API rate limits
- [Implementing cache in GraphQL APIs for IO apps](https://developers.vtex.com/docs/guides/implementing-cache-in-graphql-apis-for-io-apps) — Cache patterns for VTEX IO (useful reference for cache scope concepts)
- [Intelligent Search API](https://developers.vtex.com/docs/api-reference/intelligent-search-api) — The primary cacheable API for headless storefronts
- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — General architecture for headless VTEX stores
