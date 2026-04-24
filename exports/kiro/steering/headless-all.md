# Headless Front-End Development

# BFF Layer Design & Security

## When this skill applies

Use this skill when building or modifying any headless VTEX storefront that communicates with VTEX APIs — whether a custom storefront, mobile app, or kiosk.

- Setting up a BFF (Backend-for-Frontend) layer for a new headless project
- Deciding which VTEX APIs need server-side proxying vs direct frontend calls
- Implementing credential management (`VTEX_APP_KEY`, `VTEX_APP_TOKEN`, `VtexIdclientAutCookie`)
- Reviewing a headless architecture for security compliance

Do not use this skill for:
- Checkout-specific proxy logic and OrderForm management (use [`headless-checkout-proxy`](headless-headless-checkout-proxy.md))
- Search API integration details (use [`headless-intelligent-search`](headless-headless-intelligent-search.md))
- Caching and TTL strategy (use [`headless-caching-strategy`](headless-headless-caching-strategy.md))

## Decision rules

- A BFF layer is **mandatory** for every headless VTEX project. There is no scenario where a headless storefront can safely operate without one.
- Route all VTEX API calls through the BFF **except** Intelligent Search, which is the only API safe to call directly from the frontend.
- Use `VtexIdclientAutCookie` (stored server-side) for shopper-scoped API calls. Use `X-VTEX-API-AppKey`/`X-VTEX-API-AppToken` for machine-to-machine calls.
- Treat client-side exposure of `VTEX_APP_KEY`, `VTEX_APP_TOKEN`, `VtexIdclientAutCookie`, checkout cookies, or shopper/session tokens as a security violation — not as a recommendation or tradeoff. Use explicit wording such as “must not”, “never expose”, and “server-side only”, and avoid softer language such as “avoid”, “prefer”, or “ideally”.
- Classify APIs by their path: `/pub/` endpoints are public but most still need BFF proxying for session management; `/pvt/` endpoints are private and **must** go through BFF.
- Even public Checkout endpoints (`/api/checkout/pub/`) must be proxied through BFF for security — they handle sensitive personal data.
- Create separate API keys with minimal permissions for different BFF modules rather than sharing one key with broad access.

## Hard constraints

### Constraint: A BFF layer is mandatory for headless VTEX — no exceptions

Every headless VTEX storefront MUST have a server-side BFF layer. Client-side code MUST NOT make direct HTTP requests to private VTEX API endpoints. All private API calls must be routed through the BFF.

**Why this matters**

Private VTEX APIs require `X-VTEX-API-AppKey` and `X-VTEX-API-AppToken` headers. If the frontend calls these APIs directly, the credentials must be embedded in client-side code or transmitted to the browser, exposing them to any user who opens browser DevTools. Stolen API keys can be used to access order data, modify pricing, or perform destructive administrative actions.

**Detection**

If you see `fetch` or `axios` calls to `vtexcommercestable.com.br/api/checkout`, `/api/oms`, `/api/profile`, or any `/pvt/` endpoint in client-side code (files under `src/`, `public/`, `app/`, or any browser-executed bundle) → STOP immediately. These calls must be moved to the BFF.

**Correct**

```typescript
// Frontend code — calls BFF, not VTEX directly
async function getOrderDetails(orderId: string): Promise<Order> {
  const response = await fetch(`/api/bff/orders/${orderId}`, {
    credentials: "include", // sends session cookie to BFF
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch order: ${response.status}`);
  }

  return response.json();
}
```

**Wrong**

```typescript
// Frontend code — calls VTEX OMS API directly (SECURITY VULNERABILITY)
async function getOrderDetails(orderId: string): Promise<Order> {
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/oms/pvt/orders/${orderId}`,
    {
      headers: {
        "X-VTEX-API-AppKey": "vtexappkey-mystore-ABCDEF", // EXPOSED!
        "X-VTEX-API-AppToken": "eyJhbGciOi...", // EXPOSED!
      },
    }
  );
  return response.json();
}
```

---

### Constraint: VtexIdclientAutCookie MUST be managed server-side

The `VtexIdclientAutCookie` token MUST be stored in a secure server-side session (e.g., encrypted cookie, Redis session store) and MUST NOT be stored in `localStorage`, `sessionStorage`, or any client-accessible JavaScript variable.

**Why this matters**

The `VtexIdclientAutCookie` is a bearer token that authenticates all actions on behalf of a shopper — placing orders, viewing profile data, accessing payment information. If stored client-side, it can be stolen via XSS attacks, browser extensions, or shared/public computers. An attacker with this token can impersonate the shopper.

**Detection**

If you see `VtexIdclientAutCookie` referenced in `localStorage.setItem`, `sessionStorage.setItem`, or assigned to a JavaScript variable in client-side code → STOP immediately. The token must be managed exclusively server-side.

**Correct**

```typescript
// BFF route — stores VtexIdclientAutCookie in server-side session
import { Router, Request, Response } from "express";
import session from "express-session";

const router = Router();

// After VTEX login callback, extract and store token server-side
router.get("/auth/callback", async (req: Request, res: Response) => {
  const vtexAuthToken = req.cookies["VtexIdclientAutCookie"];

  if (!vtexAuthToken) {
    return res.status(401).json({ error: "Authentication failed" });
  }

  // Store in server-side session — never sent to frontend
  req.session.vtexAuthToken = vtexAuthToken;

  // Clear the cookie from the browser response
  res.clearCookie("VtexIdclientAutCookie");

  // Redirect to frontend with a secure session cookie
  res.redirect("/account");
});

// BFF proxy uses session token for VTEX API calls
router.get("/api/bff/profile", async (req: Request, res: Response) => {
  const vtexToken = req.session.vtexAuthToken;

  if (!vtexToken) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const response = await fetch(
    `https://${process.env.VTEX_ACCOUNT}.vtexcommercestable.com.br/api/checkout/pub/profiles`,
    {
      headers: {
        Cookie: `VtexIdclientAutCookie=${vtexToken}`,
      },
    }
  );

  const profile = await response.json();
  res.json(profile);
});
```

**Wrong**

```typescript
// Frontend code — stores auth token in localStorage (SECURITY VULNERABILITY)
function handleLoginCallback() {
  const params = new URLSearchParams(window.location.search);
  const vtexToken = params.get("authToken");

  // WRONG: token is now accessible to any JS on the page, including XSS payloads
  localStorage.setItem("VtexIdclientAutCookie", vtexToken!);
}

// Later, reads from localStorage and sends in header
async function getProfile() {
  const token = localStorage.getItem("VtexIdclientAutCookie"); // EXPOSED!
  return fetch("https://mystore.vtexcommercestable.com.br/api/checkout/pub/profiles", {
    headers: { Cookie: `VtexIdclientAutCookie=${token}` },
  });
}
```

---

### Constraint: API keys MUST NOT appear in client-side code

`VTEX_APP_KEY` and `VTEX_APP_TOKEN` values MUST only exist in server-side environment variables and MUST NOT be present in any file that is bundled, served, or accessible to the browser.

**Why this matters**

API keys grant programmatic access to the VTEX platform with the permissions of their associated role. Exposing them in frontend bundles, public directories, or client-side environment variables (e.g., `NEXT_PUBLIC_*`, `VITE_*`) allows anyone to extract them and make unauthorized API calls.

**Detection**

If you see `VTEX_APP_KEY`, `VTEX_APP_TOKEN`, `X-VTEX-API-AppKey`, or `X-VTEX-API-AppToken` in files under `src/`, `public/`, `app/` directories, or in environment variables prefixed with `NEXT_PUBLIC_`, `VITE_`, or `REACT_APP_` → STOP immediately. Move these to server-side-only environment variables.

**Correct**

```typescript
// BFF server code — reads keys from server-side env vars only
// File: server/vtex-client.ts (never bundled for browser)
import { Router, Request, Response } from "express";

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_APP_KEY = process.env.VTEX_APP_KEY!;
const VTEX_APP_TOKEN = process.env.VTEX_APP_TOKEN!;

const router = Router();

router.get("/api/bff/orders/:orderId", async (req: Request, res: Response) => {
  const { orderId } = req.params;

  const response = await fetch(
    `https://${VTEX_ACCOUNT}.vtexcommercestable.com.br/api/oms/pvt/orders/${orderId}`,
    {
      headers: {
        "X-VTEX-API-AppKey": VTEX_APP_KEY,
        "X-VTEX-API-AppToken": VTEX_APP_TOKEN,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    return res.status(response.status).json({ error: "Failed to fetch order" });
  }

  const order = await response.json();
  res.json(order);
});

export default router;
```

**Wrong**

```typescript
// .env file with NEXT_PUBLIC_ prefix — exposed to browser bundle!
// NEXT_PUBLIC_VTEX_APP_KEY=vtexappkey-mystore-ABCDEF
// NEXT_PUBLIC_VTEX_APP_TOKEN=eyJhbGciOi...

// Frontend code reads exposed env vars
async function fetchOrders() {
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/oms/pvt/orders`,
    {
      headers: {
        "X-VTEX-API-AppKey": process.env.NEXT_PUBLIC_VTEX_APP_KEY!, // EXPOSED IN BUNDLE!
        "X-VTEX-API-AppToken": process.env.NEXT_PUBLIC_VTEX_APP_TOKEN!, // EXPOSED IN BUNDLE!
      },
    }
  );
  return response.json();
}
```

## Preferred pattern

Architecture overview — how requests flow through the BFF:

```text
Frontend (Browser/App)
    │
    ├── Direct call (OK): Intelligent Search API (public, read-only)
    │
    └── All other requests → BFF Layer (Node.js/Express)
                                │
                                ├── Injects VtexIdclientAutCookie from session
                                ├── Injects X-VTEX-API-AppKey / X-VTEX-API-AppToken
                                ├── Validates & sanitizes input
                                └── Proxies to VTEX APIs
                                        │
                                        ├── Checkout API (/api/checkout/pub/...)
                                        ├── OMS API (/api/oms/pvt/...)
                                        ├── Profile API (/api/profile-system/pvt/...)
                                        └── Other VTEX services
```

Minimal BFF server setup with session management:

```typescript
// server/index.ts
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import cors from "cors";
import { checkoutRoutes } from "./routes/checkout";
import { profileRoutes } from "./routes/profile";
import { ordersRoutes } from "./routes/orders";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours (matches VtexIdclientAutCookie TTL)
    },
  })
);

// Mount BFF routes
app.use("/api/bff/checkout", checkoutRoutes);
app.use("/api/bff/profile", profileRoutes);
app.use("/api/bff/orders", ordersRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`BFF server running on port ${PORT}`);
});
```

VTEX API client with credential injection for both auth types:

```typescript
// server/vtex-api-client.ts
const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_ENVIRONMENT = process.env.VTEX_ENVIRONMENT || "vtexcommercestable";
const VTEX_APP_KEY = process.env.VTEX_APP_KEY!;
const VTEX_APP_TOKEN = process.env.VTEX_APP_TOKEN!;

const BASE_URL = `https://${VTEX_ACCOUNT}.${VTEX_ENVIRONMENT}.com.br`;

interface VtexRequestOptions {
  path: string;
  method?: string;
  body?: unknown;
  authType: "app-key" | "user-token";
  userToken?: string;
}

export async function vtexRequest<T>(options: VtexRequestOptions): Promise<T> {
  const { path, method = "GET", body, authType, userToken } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (authType === "app-key") {
    headers["X-VTEX-API-AppKey"] = VTEX_APP_KEY;
    headers["X-VTEX-API-AppToken"] = VTEX_APP_TOKEN;
  } else if (authType === "user-token" && userToken) {
    headers["Cookie"] = `VtexIdclientAutCookie=${userToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(
      `VTEX API error: ${response.status} ${response.statusText} for ${method} ${path}`
    );
  }

  return response.json() as Promise<T>;
}
```

BFF route handler with session-based auth and input validation:

```typescript
// server/routes/orders.ts
import { Router, Request, Response } from "express";
import { vtexRequest } from "../vtex-api-client";

export const ordersRoutes = Router();

// Get order details — requires API key auth (private endpoint)
ordersRoutes.get("/:orderId", async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // Validate input
    if (!/^[a-zA-Z0-9-]+$/.test(orderId)) {
      return res.status(400).json({ error: "Invalid order ID format" });
    }

    // Optionally check user session for authorization
    const vtexToken = req.session.vtexAuthToken;
    if (!vtexToken) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const order = await vtexRequest({
      path: `/api/oms/pvt/orders/${orderId}`,
      authType: "app-key",
    });

    res.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});
```

Authentication flow with server-side token management:

```typescript
// server/routes/auth.ts
import { Router, Request, Response } from "express";

export const authRoutes = Router();

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_LOGIN_URL = `https://${VTEX_ACCOUNT}.myvtex.com/login`;
const FRONTEND_URL = process.env.FRONTEND_URL!;

// Redirect shopper to VTEX login page
authRoutes.get("/login", (_req: Request, res: Response) => {
  const returnUrl = `${FRONTEND_URL}/auth/callback`;
  res.redirect(`${VTEX_LOGIN_URL}?returnUrl=${encodeURIComponent(returnUrl)}`);
});

// Handle login callback — extract VtexIdclientAutCookie and store server-side
authRoutes.get("/callback", (req: Request, res: Response) => {
  const vtexToken = req.cookies["VtexIdclientAutCookie"];

  if (!vtexToken) {
    return res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  }

  // Store token in server-side session
  req.session.vtexAuthToken = vtexToken;

  // Clear the VTEX cookie from the browser
  res.clearCookie("VtexIdclientAutCookie");

  // Redirect to authenticated frontend page
  res.redirect(`${FRONTEND_URL}/account`);
});

// Logout — destroy session
authRoutes.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

// Check authentication status
authRoutes.get("/status", (req: Request, res: Response) => {
  res.json({
    authenticated: !!req.session.vtexAuthToken,
  });
});
```

## Common failure modes

- **Proxying Intelligent Search through BFF**: Routing every VTEX API call through the BFF, including Intelligent Search, adds unnecessary latency and server load. Intelligent Search is a public, read-only API designed for direct frontend consumption. Call it directly from the frontend.

  ```typescript
  // Frontend code — call Intelligent Search directly (this is correct!)
  async function searchProducts(query: string, from: number = 0, to: number = 19): Promise<SearchResult> {
    const baseUrl = `https://${STORE_ACCOUNT}.vtexcommercestable.com.br`;
    const response = await fetch(
      `${baseUrl}/api/io/_v/api/intelligent-search/product_search/?query=${encodeURIComponent(query)}&from=${from}&to=${to}&locale=en-US`,
    );
    return response.json();
  }
  ```

- **Sharing a single API key across all BFF operations**: Using one API key with broad permissions (e.g., Owner role) for all BFF operations means a compromised key grants access to every VTEX resource. Create separate API keys for different BFF modules with minimal required permissions.

  ```typescript
  // server/vtex-credentials.ts — separate keys per domain
  export const credentials = {
    oms: {
      appKey: process.env.VTEX_OMS_APP_KEY!,
      appToken: process.env.VTEX_OMS_APP_TOKEN!,
    },
    checkout: {
      appKey: process.env.VTEX_CHECKOUT_APP_KEY!,
      appToken: process.env.VTEX_CHECKOUT_APP_TOKEN!,
    },
    catalog: {
      appKey: process.env.VTEX_CATALOG_APP_KEY!,
      appToken: process.env.VTEX_CATALOG_APP_TOKEN!,
    },
  } as const;
  ```

- **Logging API credentials or auth tokens**: Logging request headers or full request objects during debugging inadvertently writes API keys or `VtexIdclientAutCookie` values to log files, which may be accessible to multiple team members or attackers. Sanitize all log output to strip sensitive headers before logging.

  ```typescript
  // server/middleware/request-logger.ts
  import { Request, Response, NextFunction } from "express";

  const SENSITIVE_HEADERS = [
    "x-vtex-api-appkey",
    "x-vtex-api-apptoken",
    "cookie",
    "authorization",
  ];

  export function requestLogger(req: Request, _res: Response, next: NextFunction) {
    const sanitizedHeaders = Object.fromEntries(
      Object.entries(req.headers).map(([key, value]) =>
        SENSITIVE_HEADERS.includes(key.toLowerCase())
          ? [key, "[REDACTED]"]
          : [key, value]
      )
    );

    console.log({
      method: req.method,
      path: req.path,
      headers: sanitizedHeaders,
      timestamp: new Date().toISOString(),
    });

    next();
  }
  ```

## Review checklist

- [ ] Is a BFF layer present? Every headless VTEX project requires one — no exceptions.
- [ ] Are all private VTEX API calls (`/pvt/` endpoints) routed through the BFF?
- [ ] Are `VTEX_APP_KEY` and `VTEX_APP_TOKEN` stored exclusively in server-side environment variables?
- [ ] Are API keys absent from any `NEXT_PUBLIC_*`, `VITE_*`, or `REACT_APP_*` environment variables?
- [ ] Is `VtexIdclientAutCookie` stored in a server-side session, not in `localStorage` or `sessionStorage`?
- [ ] Is Intelligent Search called directly from the frontend (not unnecessarily proxied through BFF)?
- [ ] Are separate API keys used for different BFF modules with minimal permissions?
- [ ] Are sensitive headers redacted from all log output?

## Reference

- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — Core architecture guide for building headless stores on VTEX
- [Headless authentication](https://developers.vtex.com/docs/guides/headless-authentication) — OAuth-based shopper authentication flow for headless implementations
- [API authentication using API keys](https://developers.vtex.com/docs/guides/api-authentication-using-api-keys) — How to use appKey/appToken pairs for machine authentication
- [API authentication using user tokens](https://developers.vtex.com/docs/guides/api-authentication-using-user-tokens) — How VtexIdclientAutCookie works and its scopes
- [Refresh token flow for headless implementations](https://developers.vtex.com/docs/guides/refresh-token-flow-for-headless-implementations) — How to refresh expired VtexIdclientAutCookie tokens
- [Best practices for using application keys](https://help.vtex.com/en/tutorial/best-practices-api-keys--7b6nD1VMHa49aI5brlOvJm) — VTEX security guidelines for API key management

---

# Caching & Performance for Headless VTEX

## When this skill applies

Use this skill when building or optimizing a headless VTEX storefront for performance. Proper caching is the single most impactful performance optimization for headless commerce.

- Configuring CDN or edge caching for Intelligent Search and Catalog APIs
- Adding BFF-level caching (in-memory or Redis) for frequently requested data
- Deciding which VTEX API responses can be cached and which must never be cached
- Implementing cache invalidation when catalog data changes

Do not use this skill for:
- BFF architecture and API routing decisions (use [`headless-bff-architecture`](headless-headless-bff-architecture.md))
- Intelligent Search API integration specifics (use [`headless-intelligent-search`](headless-headless-intelligent-search.md))
- Checkout proxy and OrderForm management (use [`headless-checkout-proxy`](headless-headless-checkout-proxy.md))

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

---

# Checkout API Proxy & OrderForm Management

## When this skill applies

Use this skill when building cart and checkout functionality for any headless VTEX storefront. Every cart and checkout operation must go through the BFF.

- Implementing cart creation, item add/update/remove operations
- Attaching profile, shipping, or payment data to an OrderForm
- Implementing the 3-step order placement flow (place → pay → process)
- Managing `orderFormId` and `CheckoutOrderFormOwnership` cookies server-side

Do not use this skill for:

- General BFF architecture and API routing (use [`headless-bff-architecture`](headless-headless-bff-architecture.md))
- Search API integration (use [`headless-intelligent-search`](headless-headless-intelligent-search.md))
- Caching strategy decisions (use [`headless-caching-strategy`](headless-headless-caching-strategy.md))

## Decision rules

- ALL Checkout API calls (`/api/checkout/...` on `vtexcommercestable.com.br`) MUST be proxied through the BFF. The Checkout API handles sensitive personal data (profile, address, payment-method selection).
- **PCI carve-out:** the Send payments information call to the VTEX Payment Gateway (`POST https://{account}.vtexpayments.com.br/api/pub/transactions/{tid}/payments`) MUST go directly from the browser/app to `vtexpayments.com.br` whenever it carries card data. The merchant BFF MUST NOT be in the card-data path. See the dedicated hard constraint below and [`payment-pci-security`](payment-payment-pci-security.md).
- Store `orderFormId` in a server-side session, never in `localStorage` or `sessionStorage`.
- Capture and forward `CheckoutOrderFormOwnership` and `checkout.vtex.com` cookies between the BFF and VTEX on every request.
- Validate all inputs server-side before forwarding to VTEX — never pass raw `req.body` directly.
- Execute the 3-step order placement flow (place order → send payment → process order) as a single synchronous user interaction within the **5-minute window**. Step 1 (place) and Step 3 (gateway callback) run in the BFF; Step 2 (send payment data to `vtexpayments.com.br`) runs in the browser per the PCI carve-out above.
- Always store and reuse the existing `orderFormId` from the session — only create a new cart when no `orderFormId` exists.

OrderForm attachment endpoints:

| Attachment        | Endpoint                                                | Purpose                           |
| ----------------- | ------------------------------------------------------- | --------------------------------- |
| items             | `POST .../orderForm/{id}/items`                         | Add, remove, or update cart items |
| clientProfileData | `POST .../orderForm/{id}/attachments/clientProfileData` | Customer profile info             |
| shippingData      | `POST .../orderForm/{id}/attachments/shippingData`      | Address and delivery option       |
| paymentData       | `POST .../orderForm/{id}/attachments/paymentData`       | Payment method selection          |
| marketingData     | `POST .../orderForm/{id}/attachments/marketingData`     | Coupons and UTM data              |

## Hard constraints

### Constraint: ALL Checkout API operations MUST go through BFF

Client-side code MUST NOT make direct HTTP requests to any VTEX Checkout API endpoint on `vtexcommercestable.com.br/api/checkout/...`. All Checkout API operations — cart creation, item management, profile updates, shipping, payment-method selection (`paymentData` attachment), order placement (`/transaction`), and order processing (`/gatewayCallback`) — must be proxied through the BFF.

This rule applies to the Checkout API only. The Send payments information call on `vtexpayments.com.br` is governed by the next constraint and goes the opposite way (browser-direct) for PCI reasons; do not generalize this rule to that endpoint.

**Why this matters**

Checkout endpoints handle sensitive personal data (email, address, phone, payment-method selection). Direct frontend calls expose the request/response flow to browser DevTools, extensions, and XSS attacks. Additionally, the BFF layer is needed to manage `VtexIdclientAutCookie` and `CheckoutOrderFormOwnership` cookies server-side, validate inputs, and prevent cart manipulation (e.g., price tampering).

**Detection**

If you see `fetch` or `axios` calls to `vtexcommercestable.com.br/api/checkout/...` in any client-side code (browser-executed JavaScript, frontend source files) → STOP immediately. All Checkout API calls must route through BFF endpoints.

**Correct**

```typescript
// Frontend — calls BFF endpoint, never VTEX directly
async function addItemToCart(
  skuId: string,
  quantity: number,
  seller: string,
): Promise<OrderForm> {
  const response = await fetch("/api/bff/cart/items", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skuId, quantity, seller }),
  });

  if (!response.ok) {
    throw new Error(`Failed to add item: ${response.status}`);
  }

  return response.json();
}
```

**Wrong**

```typescript
// Frontend — calls VTEX Checkout API directly (SECURITY VULNERABILITY)
async function addItemToCart(
  skuId: string,
  quantity: number,
  seller: string,
): Promise<OrderForm> {
  const orderFormId = localStorage.getItem("orderFormId"); // Also wrong: see next constraint
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/checkout/pub/orderForm/${orderFormId}/items`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderItems: [{ id: skuId, quantity, seller }],
      }),
    },
  );
  return response.json();
}
```

---

### Constraint: Card data MUST go directly from browser/app to vtexpayments.com.br — never through the BFF

The Send payments information call (`POST https://{account}.vtexpayments.com.br/api/pub/transactions/{tid}/payments?orderId={orderGroup}`) carries card data when the shopper pays with a credit, debit, or co-branded card. This call MUST originate from the shopper's browser or native app and MUST target `vtexpayments.com.br` directly. The BFF MUST NOT proxy this call when card data is involved, even with redaction, even with `appKey`/`appToken` on the server side, and even when only "tokenized" fields appear to be forwarded.

This is the inverse of the previous constraint. Treating it as a generic "checkout" call and routing it through the BFF — as some agents do when applying the "all checkout through BFF" rule too broadly — is a PCI DSS violation, not a security improvement.

**Why this matters**

The merchant operating the headless storefront is rarely PCI DSS Level 1 certified. Routing card numbers, holder names, or CVV through the merchant's BFF places the BFF and every system it touches — application logs, APM/observability tools, reverse proxies, load balancers, error trackers — inside PCI scope. Operating a non-PCI environment that handles card data violates PCI DSS Requirements 3 and 4 and can result in fines from $5,000 to over $100,000 per month from card networks, mandatory forensic investigation costs, loss of card processing ability, and legal liability.

The browser → `vtexpayments.com.br` path is the PCI-compliant pattern: the VTEX Payment Gateway is PCI DSS Level 1 certified and is the only environment in this flow authorized to receive raw card data. The Send payments call is authenticated by the shopper's session cookies set by the previous Place Order step — no merchant credentials are needed on the BFF for this hop.

**Detection**

If you find any of the following in BFF / server-side code (`server/`, `bff/`, `api/`, route handlers, middleware, edge functions, lambdas), STOP immediately:

- A request from the BFF to `https://*.vtexpayments.com.br/api/pub/transactions/.../payments`,
- A handler that accepts `cardNumber`, `holderName`, `validationCode`, `csc`, `dueDate`, or full payment `fields` from the browser and forwards them to any VTEX endpoint,
- A "Payments client" / `ExternalClient` / `axios` instance that targets `vtexpayments.com.br` for the Send payments information endpoint.

Move that call to the browser/app. The BFF should instead return `transactionId`, `orderGroup`, and `merchantName` from the Place Order step so the frontend can post payment data directly to the Payment Gateway.

This rule applies even when:

- The merchant has a VTEX `appKey`/`appToken` with payment permissions — possessing the credentials does not grant PCI authorization.
- Only "tokenized" card fields are forwarded — token values still reference real card data and are in PCI scope.
- The BFF code "redacts" sensitive fields before logging — the request still transits the merchant infrastructure before redaction.
- The BFF runs on a private VPC with TLS — PCI scope is determined by what data passes through, not by how the network is configured.

**Correct**

```typescript
async function sendPaymentDataDirect(args: {
  account: string;
  transactionId: string;
  orderGroup: string;
  merchantName: string;
  paymentInformation: PaymentField[];
}): Promise<void> {
  const {
    account,
    transactionId,
    orderGroup,
    merchantName,
    paymentInformation,
  } = args;

  const response = await fetch(
    `https://${account}.vtexpayments.com.br/api/pub/transactions/${transactionId}/payments?orderId=${orderGroup}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        paymentInformation.map((p) => ({
          ...p,
          transaction: { id: transactionId, merchantName },
        })),
      ),
    },
  );

  if (!response.ok) {
    throw new Error(`Payment submission failed: ${response.status}`);
  }
}
```

**Wrong**

```typescript
const VTEX_APP_KEY = process.env.VTEX_APP_KEY!;
const VTEX_APP_TOKEN = process.env.VTEX_APP_TOKEN!;

paymentRoutes.post("/", async (req: Request, res: Response) => {
  const { transactionId, orderGroup, paymentInformation } = req.body as {
    transactionId: string;
    orderGroup: string;
    paymentInformation: Array<{
      paymentSystem: number;
      installments: number;
      value: number;
      fields: {
        cardNumber: string;
        holderName: string;
        validationCode: string;
        dueDate: string;
      };
    }>;
  };

  const url = `https://${process.env.VTEX_ACCOUNT}.vtexpayments.com.br/api/pub/transactions/${transactionId}/payments?orderId=${orderGroup}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-API-AppKey": VTEX_APP_KEY,
      "X-VTEX-API-AppToken": VTEX_APP_TOKEN,
    },
    body: JSON.stringify(paymentInformation),
  });

  res.json({ status: response.status });
});
```

---

### Constraint: orderFormId MUST be managed server-side

The `orderFormId` MUST be stored in a secure server-side session. It SHOULD NOT be stored in `localStorage`, `sessionStorage`, or exposed to the frontend in a way that allows direct VTEX API calls.

**Why this matters**

The `orderFormId` is the key to a customer's shopping cart and all data within it — profile information, shipping address, payment details. If exposed client-side, an attacker could use it to query VTEX directly and retrieve personal data, or manipulate the cart by adding/removing items through direct API calls bypassing any validation logic.

**Detection**

If you see `orderFormId` stored in `localStorage` or `sessionStorage` → STOP immediately. It should be managed in the BFF session.

**Correct**

```typescript
// BFF — manages orderFormId in server-side session
import { Router, Request, Response } from "express";
import { vtexCheckoutRequest } from "../vtex-api-client";

export const cartRoutes = Router();

// Get or create cart — orderFormId stays server-side
cartRoutes.get("/", async (req: Request, res: Response) => {
  try {
    let orderFormId = req.session.orderFormId;

    if (orderFormId) {
      // Retrieve existing cart
      const orderForm = await vtexCheckoutRequest({
        path: `/api/checkout/pub/orderForm/${orderFormId}`,
        method: "GET",
        cookies: req.session.vtexCookies,
      });
      return res.json(sanitizeOrderForm(orderForm));
    }

    // Create new cart
    const orderForm = await vtexCheckoutRequest({
      path: "/api/checkout/pub/orderForm",
      method: "GET",
      cookies: req.session.vtexCookies,
    });

    // Store orderFormId in session — never expose raw ID to frontend
    req.session.orderFormId = orderForm.orderFormId;
    req.session.vtexCookies = orderForm._cookies; // Store checkout cookies

    res.json(sanitizeOrderForm(orderForm));
  } catch (error) {
    console.error("Error getting cart:", error);
    res.status(500).json({ error: "Failed to get cart" });
  }
});

// Remove sensitive data before sending to frontend
function sanitizeOrderForm(
  orderForm: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized = { ...orderForm };
  delete sanitized._cookies;
  return sanitized;
}
```

**Wrong**

```typescript
// Frontend — stores orderFormId in localStorage (INSECURE)
async function getCart(): Promise<OrderForm> {
  let orderFormId = localStorage.getItem("orderFormId"); // EXPOSED to client

  if (!orderFormId) {
    const response = await fetch(
      "https://mystore.vtexcommercestable.com.br/api/checkout/pub/orderForm",
    );
    const data = await response.json();
    orderFormId = data.orderFormId;
    localStorage.setItem("orderFormId", orderFormId!); // Stored client-side!
  }

  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/checkout/pub/orderForm/${orderFormId}`,
  );
  return response.json();
}
```

---

### Constraint: MUST validate all inputs server-side before forwarding to VTEX

The BFF MUST validate all input data before forwarding requests to the VTEX Checkout API. This includes validating SKU IDs, quantities, email formats, address fields, and coupon codes.

**Why this matters**

Without server-side validation, malicious users can send crafted requests through the BFF to VTEX with invalid or manipulative data — negative quantities, SQL injection in text fields, or spoofed seller IDs. While VTEX has its own validation, defense-in-depth requires validating at the BFF layer to catch issues early and provide clear error messages.

**Detection**

If BFF route handlers pass `req.body` directly to VTEX API calls without any validation or sanitization → STOP immediately. All inputs must be validated before proxying.

**Correct**

```typescript
// BFF — validates inputs before forwarding to VTEX
import { Router, Request, Response } from "express";
import { vtexCheckoutRequest } from "../vtex-api-client";

export const cartItemsRoutes = Router();

interface AddItemRequest {
  skuId: string;
  quantity: number;
  seller: string;
}

function validateAddItemInput(body: unknown): body is AddItemRequest {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;

  return (
    typeof b.skuId === "string" &&
    /^\d+$/.test(b.skuId) &&
    typeof b.quantity === "number" &&
    Number.isInteger(b.quantity) &&
    b.quantity > 0 &&
    b.quantity <= 100 &&
    typeof b.seller === "string" &&
    /^[a-zA-Z0-9]+$/.test(b.seller)
  );
}

cartItemsRoutes.post("/", async (req: Request, res: Response) => {
  if (!validateAddItemInput(req.body)) {
    return res.status(400).json({
      error: "Invalid input",
      details:
        "skuId must be numeric, quantity must be 1-100, seller must be alphanumeric",
    });
  }

  const { skuId, quantity, seller } = req.body;
  const orderFormId = req.session.orderFormId;

  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  try {
    const orderForm = await vtexCheckoutRequest({
      path: `/api/checkout/pub/orderForm/${orderFormId}/items`,
      method: "POST",
      body: {
        orderItems: [{ id: skuId, quantity, seller }],
      },
      cookies: req.session.vtexCookies,
    });

    res.json(sanitizeOrderForm(orderForm));
  } catch (error) {
    console.error("Error adding item:", error);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});
```

**Wrong**

```typescript
// BFF — passes raw input to VTEX without validation (UNSAFE)
cartRoutes.post("/items", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;

  // No validation — attacker can send any payload
  const orderForm = await vtexCheckoutRequest({
    path: `/api/checkout/pub/orderForm/${orderFormId}/items`,
    method: "POST",
    body: req.body, // Raw, unvalidated input passed directly!
    cookies: req.session.vtexCookies,
  });

  res.json(orderForm);
});
```

## Preferred pattern

Request flow through the BFF for checkout operations:

```text
Frontend
    │
    └── POST /api/bff/cart/items/add  {skuId, quantity, seller}
            │
            BFF Layer
            │ 1. Validates input (skuId format, quantity > 0, seller exists)
            │ 2. Reads orderFormId from server-side session
            │ 3. Forwards CheckoutOrderFormOwnership cookie
            │ 4. Calls VTEX: POST /api/checkout/pub/orderForm/{id}/items
            │ 5. Updates session with new orderFormId if changed
            │ 6. Returns sanitized orderForm to frontend
            │
            VTEX Checkout API
```

VTEX Checkout API client with cookie management:

```typescript
// server/vtex-checkout-client.ts
const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_ENVIRONMENT = process.env.VTEX_ENVIRONMENT || "vtexcommercestable";
const BASE_URL = `https://${VTEX_ACCOUNT}.${VTEX_ENVIRONMENT}.com.br`;

interface CheckoutRequestOptions {
  path: string;
  method?: string;
  body?: unknown;
  cookies?: Record<string, string>;
  userToken?: string;
}

interface CheckoutResponse<T = unknown> {
  data: T;
  cookies: Record<string, string>;
}

export async function vtexCheckout<T>(
  options: CheckoutRequestOptions,
): Promise<CheckoutResponse<T>> {
  const { path, method = "GET", body, cookies = {}, userToken } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  // Build cookie header from stored cookies
  const cookieParts: string[] = [];
  if (cookies["checkout.vtex.com"]) {
    cookieParts.push(`checkout.vtex.com=${cookies["checkout.vtex.com"]}`);
  }
  if (cookies["CheckoutOrderFormOwnership"]) {
    cookieParts.push(
      `CheckoutOrderFormOwnership=${cookies["CheckoutOrderFormOwnership"]}`,
    );
  }
  if (userToken) {
    cookieParts.push(`VtexIdclientAutCookie=${userToken}`);
  }
  if (cookieParts.length > 0) {
    headers["Cookie"] = cookieParts.join("; ");
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Checkout API error: ${response.status} for ${method} ${path}: ${errorBody}`,
    );
  }

  // Extract cookies from response for session storage
  const responseCookies: Record<string, string> = {};
  const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
  for (const setCookie of setCookieHeaders) {
    const [nameValue] = setCookie.split(";");
    const [name, value] = nameValue.split("=");
    if (name && value) {
      responseCookies[name.trim()] = value.trim();
    }
  }

  const data = (await response.json()) as T;
  return { data, cookies: { ...cookies, ...responseCookies } };
}
```

Cart management BFF routes:

```typescript
// server/routes/cart.ts
import { Router, Request, Response } from "express";
import { vtexCheckout } from "../vtex-checkout-client";

export const cartRoutes = Router();

// GET /api/bff/cart — get or create cart
cartRoutes.get("/", async (req: Request, res: Response) => {
  try {
    const result = await vtexCheckout<OrderForm>({
      path: req.session.orderFormId
        ? `/api/checkout/pub/orderForm/${req.session.orderFormId}`
        : "/api/checkout/pub/orderForm",
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.orderFormId = result.data.orderFormId;
    req.session.vtexCookies = result.cookies;

    res.json(result.data);
  } catch (error) {
    console.error("Error getting cart:", error);
    res.status(500).json({ error: "Failed to get cart" });
  }
});

// POST /api/bff/cart/items — add items to cart
cartRoutes.post("/items", async (req: Request, res: Response) => {
  const { items } = req.body as {
    items: Array<{ id: string; quantity: number; seller: string }>;
  };

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Items array is required" });
  }

  for (const item of items) {
    if (
      !item.id ||
      typeof item.quantity !== "number" ||
      item.quantity < 1 ||
      !item.seller
    ) {
      return res
        .status(400)
        .json({ error: "Each item must have id, quantity (>0), and seller" });
    }
  }

  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res
      .status(400)
      .json({ error: "No active cart. Call GET /api/bff/cart first." });
  }

  try {
    const result = await vtexCheckout<OrderForm>({
      path: `/api/checkout/pub/orderForm/${orderFormId}/items`,
      method: "POST",
      body: { orderItems: items },
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.vtexCookies = result.cookies;
    res.json(result.data);
  } catch (error) {
    console.error("Error adding items:", error);
    res.status(500).json({ error: "Failed to add items to cart" });
  }
});
```

Order placement — Steps 1 and 3 run in the BFF; Step 2 runs in the browser per the PCI carve-out. All 3 steps must complete within the **5-minute window**.

```typescript
// server/routes/order.ts — BFF handles Step 1 (place) and Step 3 (process) only.
// Step 2 (send payment data) runs in the browser; see the card-data carve-out constraint.
import { Router, Request, Response } from "express";
import { vtexCheckout } from "../vtex-checkout-client";

export const orderRoutes = Router();

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;

// POST /api/bff/order/place — Step 1: place order from existing cart.
// Returns the data the browser needs to call vtexpayments.com.br directly in Step 2.
orderRoutes.post("/place", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  try {
    const placeResult = await vtexCheckout<PlaceOrderResponse>({
      path: `/api/checkout/pub/orderForm/${orderFormId}/transaction`,
      method: "POST",
      body: { referenceId: orderFormId },
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    const { orders, orderGroup } = placeResult.data;
    if (!orders?.length) {
      return res
        .status(500)
        .json({ error: "Order placement returned no orders" });
    }

    const orderId = orders[0].orderId;
    const merchantTransaction =
      orders[0].transactionData.merchantTransactions[0];
    const transactionId = merchantTransaction?.transactionId;
    const merchantName = merchantTransaction?.merchantName ?? VTEX_ACCOUNT;

    req.session.pendingOrderGroup = orderGroup;

    res.json({
      account: VTEX_ACCOUNT,
      orderId,
      orderGroup,
      transactionId,
      merchantName,
    });
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ error: "Failed to place order" });
  }
});

// POST /api/bff/order/process — Step 3: process gateway callback after the
// browser has submitted payment data directly to vtexpayments.com.br in Step 2.
// Carries no card data; safe to run server-side.
orderRoutes.post("/process", async (req: Request, res: Response) => {
  const orderGroup = req.session.pendingOrderGroup;
  if (!orderGroup) {
    return res.status(400).json({ error: "No pending order to process" });
  }

  try {
    await vtexCheckout<unknown>({
      path: `/api/checkout/pub/gatewayCallback/${orderGroup}`,
      method: "POST",
      cookies: req.session.vtexCookies || {},
    });

    delete req.session.orderFormId;
    delete req.session.vtexCookies;
    delete req.session.pendingOrderGroup;

    res.json({ orderGroup, status: "processed" });
  } catch (error) {
    console.error("Error processing order:", error);
    res.status(500).json({ error: "Failed to process order" });
  }
});
```

```typescript
// frontend/checkout/placeOrder.ts — Step 2 runs in the browser.
// Card fields stay on the device; the BFF never sees them.
async function placeOrderWithCard(card: CardPaymentInformation) {
  const placeResp = await fetch("/api/bff/order/place", {
    method: "POST",
    credentials: "include",
  });
  const { account, orderGroup, transactionId, merchantName } =
    await placeResp.json();

  await fetch(
    `https://${account}.vtexpayments.com.br/api/pub/transactions/${transactionId}/payments?orderId=${orderGroup}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        { ...card, transaction: { id: transactionId, merchantName } },
      ]),
    },
  );

  await fetch("/api/bff/order/process", {
    method: "POST",
    credentials: "include",
  });
}
```

## Common failure modes

- **Creating a new cart on every page load**: Calling `GET /api/checkout/pub/orderForm` without an `orderFormId` on every page load creates a new empty cart each time, abandoning the previous one. Always store and reuse the `orderFormId` from the server-side session.

  ```typescript
  // Always check for existing orderFormId first
  cartRoutes.get("/", async (req: Request, res: Response) => {
    const orderFormId = req.session.orderFormId;

    const path = orderFormId
      ? `/api/checkout/pub/orderForm/${orderFormId}` // Retrieve existing cart
      : "/api/checkout/pub/orderForm"; // Create new cart only if none exists

    const result = await vtexCheckout<OrderForm>({
      path,
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.orderFormId = result.data.orderFormId;
    req.session.vtexCookies = result.cookies;
    res.json(result.data);
  });
  ```

- **Ignoring the 5-minute order processing window**: Placing an order (Step 1) but delaying payment or processing beyond 5 minutes causes VTEX to automatically cancel the order as `incomplete`. Execute Steps 1 → 2 → 3 sequentially and immediately as a single user interaction. Step 1 (place) and Step 3 (gateway callback) run in the BFF; Step 2 (send payment data) runs in the browser per the card-data carve-out above. Do not pause for additional UI between steps.

  ```typescript
  // Frontend orchestrates Place (BFF) → Pay (browser → vtexpayments.com.br) → Process (BFF)
  // on a single click, well within the 5-minute window.
  async function onPlaceOrderClick(card: CardPaymentInformation) {
    const { account, orderGroup, transactionId, merchantName } =
      await fetchJson("/api/bff/order/place", { method: "POST" });

    await sendPaymentDirectToGateway({
      account,
      transactionId,
      orderGroup,
      merchantName,
      card,
    });

    await fetchJson("/api/bff/order/process", { method: "POST" });
  }
  ```

- **Proxying `vtexpayments.com.br` payment submission through the BFF "for consistency"**: Routing the Send payments information call through the BFF feels symmetrical with the rest of the BFF mandate, and some agents add it to "centralize all VTEX calls". When card data is involved this is a PCI DSS violation, not a refactor. Keep Step 2 in the browser; the BFF should expose `/api/bff/order/place` (returns `transactionId`/`orderGroup`/`merchantName`) and `/api/bff/order/process` (calls `/gatewayCallback`) but never `/api/bff/order/payment` for card flows.

- **Exposing raw VTEX error messages to the frontend**: Forwarding VTEX API error responses directly to the frontend leaks internal details (account names, API paths, data structures). Map VTEX errors to user-friendly messages in the BFF and log the full error server-side.

  ```typescript
  // Map VTEX errors to safe, user-friendly messages
  function mapCheckoutError(
    vtexError: string,
    statusCode: number,
  ): { code: string; message: string } {
    if (statusCode === 400 && vtexError.includes("item")) {
      return {
        code: "INVALID_ITEM",
        message: "One or more items are unavailable",
      };
    }
    if (statusCode === 400 && vtexError.includes("address")) {
      return {
        code: "INVALID_ADDRESS",
        message: "Please check your shipping address",
      };
    }
    if (statusCode === 409) {
      return {
        code: "CART_CONFLICT",
        message: "Your cart was updated. Please review your items.",
      };
    }
    return {
      code: "CHECKOUT_ERROR",
      message: "An error occurred during checkout. Please try again.",
    };
  }
  ```

## Review checklist

- [ ] Are ALL Checkout API calls (`vtexcommercestable.com.br/api/checkout/...`) routed through the BFF (no direct frontend calls)?
- [ ] Is the Send payments information call (`vtexpayments.com.br/api/pub/transactions/{tid}/payments`) sent from the browser/app directly, NOT proxied through the BFF, when card data is involved?
- [ ] Are `cardNumber`, `holderName`, `validationCode`/`csc`, and `dueDate` absent from every BFF route handler and log statement?
- [ ] Does any reference to `vtexpayments.com.br` in the codebase appear only in browser/app code, never in `server/`, `bff/`, `api/`, or other backend directories?
- [ ] Is `orderFormId` stored in a server-side session, not in `localStorage` or `sessionStorage`?
- [ ] Are `CheckoutOrderFormOwnership` and `checkout.vtex.com` cookies captured from VTEX responses and forwarded on subsequent requests?
- [ ] Are all inputs validated server-side before forwarding to VTEX?
- [ ] Do all 3 order-placement steps (place → pay → process) execute as a single user interaction within the 5-minute window, with Steps 1 and 3 in the BFF and Step 2 in the browser direct to `vtexpayments.com.br`?
- [ ] Is the existing `orderFormId` reused from the session rather than creating a new cart on every page load?
- [ ] Are VTEX error responses sanitized before being sent to the frontend?

## Reference

- [Headless cart and checkout](https://developers.vtex.com/docs/guides/headless-cart-and-checkout) — Complete guide to implementing cart and checkout in headless stores
- [Checkout API reference](https://developers.vtex.com/docs/api-reference/checkout-api) — Full API reference for all Checkout endpoints
- [orderForm fields](https://developers.vtex.com/docs/guides/orderform-fields) — Detailed documentation of the OrderForm data structure
- [Creating a regular order from an existing cart](https://developers.vtex.com/docs/guides/creating-a-regular-order-from-an-existing-cart) — Step-by-step guide to the order placement flow
- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — General architecture for headless VTEX stores
- [Add cart items](https://developers.vtex.com/docs/guides/add-cart-items) — Guide to adding products to a shopping cart

---

# Intelligent Search API Integration

## When this skill applies

Use this skill when implementing product search, category browsing, autocomplete, or faceted filtering in a headless VTEX storefront.

- Building a search results page with product listings
- Implementing faceted navigation (category, brand, price, color filters)
- Adding autocomplete suggestions to a search input
- Wiring up search analytics events for Intelligent Search ranking

Do not use this skill for:
- BFF architecture and API routing decisions (use [`headless-bff-architecture`](headless-headless-bff-architecture.md))
- Checkout or cart API integration (use [`headless-checkout-proxy`](headless-headless-checkout-proxy.md))
- Caching strategy and TTL configuration (use [`headless-caching-strategy`](headless-headless-caching-strategy.md))

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
