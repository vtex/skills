This skill provides guidance for AI agents working with VTEX Custom VTEX IO Apps. Apply these constraints and patterns when assisting developers with apply when building backend service apps under node/ in a VTEX IO project or configuring service.json routes. Covers the Service class, middleware functions, ctx.clients pattern, JanusClient, ExternalClient, MasterDataClient, and IOClients registration. Use for implementing backend APIs, event handlers, or integrations that must use @vtex/api clients instead of raw HTTP libraries.

# Backend Service Apps & API Clients

## When this skill applies

Use this skill when developing a VTEX IO app that needs backend logic — REST API routes, GraphQL resolvers, event handlers, scheduled tasks, or integrations with VTEX Commerce APIs and external services.

- Building the Service entry point (`node/index.ts`) with typed context, clients, and state
- Creating and registering custom clients extending JanusClient or ExternalClient
- Using `ctx.clients` to access clients with built-in caching, retry, and metrics
- Configuring routes and middleware chains in service.json

Do not use this skill for:
- Manifest and builder configuration (use `vtex-io-app-structure` instead)
- GraphQL schema definitions (use `vtex-io-graphql-api` instead)
- React component development (use `vtex-io-react-apps` instead)

## Decision rules

- The Service class (`node/index.ts`) is the entry point for every VTEX IO backend app. It receives clients, routes (with middleware chains), GraphQL resolvers, and event handlers.
- Every middleware, resolver, and event handler receives `ctx` with: `ctx.clients` (registered clients), `ctx.state` (mutable per-request state), `ctx.vtex` (auth tokens, account info), `ctx.body` (request/response body).
- Use `JanusClient` for VTEX internal APIs (base URL: `https://{account}.vtexcommercestable.com.br`).
- Use `ExternalClient` for non-VTEX APIs (any URL you specify).
- Use `AppClient` for routes exposed by other VTEX IO apps.
- Use `MasterDataClient` for Master Data v2 CRUD operations.
- Register custom clients by extending `IOClients` — each client is lazily instantiated on first access via `this.getOrSet()`.
- Keep clients as thin data-access wrappers. Put business logic in middlewares or service functions.

Client hierarchy:

| Class | Use Case | Base URL |
|-------|----------|----------|
| `JanusClient` | Access VTEX internal APIs (Janus gateway) | `https://{account}.vtexcommercestable.com.br` |
| `ExternalClient` | Access external (non-VTEX) APIs | Any URL you specify |
| `AppClient` | Access routes exposed by other VTEX IO apps | `https://{workspace}--{account}.myvtex.com` |
| `InfraClient` | Access VTEX IO infrastructure services | Internal |
| `MasterDataClient` | Access Master Data v2 CRUD operations | VTEX API |

Architecture:

```text
Request → VTEX IO Runtime → Service
  ├── routes → middleware chain → ctx.clients.{name}.method()
  ├── graphql → resolvers → ctx.clients.{name}.method()
  └── events → handlers → ctx.clients.{name}.method()
                               │
                               ▼
                         Client (JanusClient / ExternalClient)
                               │
                               ▼
                    External Service / VTEX API
```

## Hard constraints

### Constraint: Use @vtex/api Clients — Never Raw HTTP Libraries

All HTTP communication from a VTEX IO service app MUST go through `@vtex/api` clients (JanusClient, ExternalClient, AppClient, or native clients from `@vtex/clients`). You MUST NOT use `axios`, `fetch`, `got`, `node-fetch`, or any other raw HTTP library.

**Why this matters**

VTEX IO clients provide automatic authentication header injection, built-in caching (disk and memory), retry with exponential backoff, timeout management, native metrics and billing tracking, and proper error handling. Raw HTTP libraries bypass all of these. Additionally, outbound traffic from VTEX IO is firewalled — only `@vtex/api` clients properly route through the infrastructure.

**Detection**

If you see `import axios from 'axios'`, `import fetch from 'node-fetch'`, `import got from 'got'`, `require('node-fetch')`, or any direct `fetch()` call in a VTEX IO service app, STOP. Replace with a proper client extending JanusClient or ExternalClient.

**Correct**

```typescript
import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

export class WeatherClient extends ExternalClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('https://api.weather.com', context, {
      ...options,
      headers: {
        'X-Api-Key': 'my-key',
        ...options?.headers,
      },
    })
  }

  public async getForecast(city: string): Promise<Forecast> {
    return this.http.get(`/v1/forecast/${city}`, {
      metric: 'weather-forecast',
    })
  }
}
```

**Wrong**

```typescript
import axios from 'axios'

// This bypasses VTEX IO infrastructure entirely.
// No caching, no retries, no metrics, no auth token injection.
// Outbound requests may be blocked by the firewall.
export async function getForecast(city: string): Promise<Forecast> {
  const response = await axios.get(`https://api.weather.com/v1/forecast/${city}`, {
    headers: { 'X-Api-Key': 'my-key' },
  })
  return response.data
}
```

---

### Constraint: Access Clients via ctx.clients — Never Instantiate Directly

Clients MUST always be accessed through `ctx.clients.{clientName}` in middlewares, resolvers, and event handlers. You MUST NOT instantiate client classes directly with `new`.

**Why this matters**

The IOClients registry manages client lifecycle, ensuring proper initialization with the current request's IOContext (account, workspace, auth tokens). Direct instantiation creates clients without authentication context, without caching configuration, and without connection to the metrics pipeline.

**Detection**

If you see `new MyClient(...)` or `new ExternalClient(...)` inside a middleware or resolver, STOP. The client should be registered in the Clients class and accessed via `ctx.clients`.

**Correct**

```typescript
// node/clients/index.ts
import { IOClients } from '@vtex/api'
import { CatalogClient } from './catalogClient'

export class Clients extends IOClients {
  public get catalog() {
    return this.getOrSet('catalog', CatalogClient)
  }
}

// node/middlewares/getProduct.ts
export async function getProduct(ctx: Context, next: () => Promise<void>) {
  const { clients: { catalog } } = ctx
  const product = await catalog.getProductById(ctx.query.id)
  ctx.body = product
  ctx.status = 200
  await next()
}
```

**Wrong**

```typescript
// node/middlewares/getProduct.ts
import { CatalogClient } from '../clients/catalogClient'

export async function getProduct(ctx: Context, next: () => Promise<void>) {
  // Direct instantiation — no auth context, no caching, no metrics
  const catalog = new CatalogClient(ctx.vtex, {})
  const product = await catalog.getProductById(ctx.query.id)
  ctx.body = product
  ctx.status = 200
  await next()
}
```

---

### Constraint: Avoid Monolithic Service Apps

A single service app SHOULD NOT define more than 10 HTTP routes. If you need more, consider splitting into focused microservice apps.

**Why this matters**

VTEX IO apps run in containers with limited memory (max 512MB). A monolithic app with many routes increases memory usage, cold start time, and blast radius of failures. The VTEX IO platform is designed for small, focused apps that compose together.

**Detection**

If `service.json` defines more than 10 routes, warn the developer to consider splitting the app into smaller services. This is a soft limit — there may be valid exceptions.

**Correct**

```json
{
  "memory": 256,
  "timeout": 30,
  "routes": {
    "get-reviews": { "path": "/_v/api/reviews", "public": false },
    "get-review": { "path": "/_v/api/reviews/:id", "public": false },
    "create-review": { "path": "/_v/api/reviews", "public": false },
    "moderate-review": { "path": "/_v/api/reviews/:id/moderate", "public": false }
  }
}
```

**Wrong**

```json
{
  "memory": 512,
  "timeout": 60,
  "routes": {
    "route1": { "path": "/_v/api/reviews" },
    "route2": { "path": "/_v/api/reviews/:id" },
    "route3": { "path": "/_v/api/products" },
    "route4": { "path": "/_v/api/products/:id" },
    "route5": { "path": "/_v/api/orders" },
    "route6": { "path": "/_v/api/orders/:id" },
    "route7": { "path": "/_v/api/users" },
    "route8": { "path": "/_v/api/users/:id" },
    "route9": { "path": "/_v/api/categories" },
    "route10": { "path": "/_v/api/categories/:id" },
    "route11": { "path": "/_v/api/brands" },
    "route12": { "path": "/_v/api/inventory" }
  }
}
```

12 routes covering reviews, products, orders, users, categories, brands, and inventory — this should be 3-4 separate apps.

## Preferred pattern

Define custom clients:

```typescript
// node/clients/catalogClient.ts
import type { InstanceOptions, IOContext } from '@vtex/api'
import { JanusClient } from '@vtex/api'

export class CatalogClient extends JanusClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(context, {
      ...options,
      headers: {
        VtexIdclientAutCookie: context.authToken,
        ...options?.headers,
      },
    })
  }

  public async getProduct(productId: string): Promise<Product> {
    return this.http.get(`/api/catalog/pvt/product/${productId}`, {
      metric: 'catalog-get-product',
    })
  }

  public async listSkusByProduct(productId: string): Promise<Sku[]> {
    return this.http.get(`/api/catalog_system/pvt/sku/stockkeepingunitByProductId/${productId}`, {
      metric: 'catalog-list-skus',
    })
  }
}
```

Register clients in IOClients:

```typescript
// node/clients/index.ts
import { IOClients } from '@vtex/api'
import { CatalogClient } from './catalogClient'
import { ReviewStorageClient } from './reviewStorageClient'

export class Clients extends IOClients {
  public get catalog() {
    return this.getOrSet('catalog', CatalogClient)
  }

  public get reviewStorage() {
    return this.getOrSet('reviewStorage', ReviewStorageClient)
  }
}
```

Create middlewares using `ctx.clients` and `ctx.state`:

```typescript
// node/middlewares/getReviews.ts
import type { ServiceContext } from '@vtex/api'
import type { Clients } from '../clients'

type Context = ServiceContext<Clients>

export async function validateParams(ctx: Context, next: () => Promise<void>) {
  const { productId } = ctx.query

  if (!productId || typeof productId !== 'string') {
    ctx.status = 400
    ctx.body = { error: 'productId query parameter is required' }
    return
  }

  ctx.state.productId = productId
  await next()
}

export async function getReviews(ctx: Context, next: () => Promise<void>) {
  const { productId } = ctx.state
  const reviews = await ctx.clients.reviewStorage.getByProduct(productId)

  ctx.status = 200
  ctx.body = reviews
  await next()
}
```

Wire everything in the Service entry point:

```typescript
// node/index.ts
import type { ParamsContext, RecorderState } from '@vtex/api'
import { Service, method } from '@vtex/api'

import { Clients } from './clients'
import { validateParams, getReviews } from './middlewares/getReviews'
import { createReview } from './middlewares/createReview'
import { resolvers } from './resolvers'

export default new Service<Clients, RecorderState, ParamsContext>({
  clients: {
    implementation: Clients,
    options: {
      default: {
        retries: 2,
        timeout: 5000,
      },
      catalog: {
        retries: 3,
        timeout: 10000,
      },
    },
  },
  routes: {
    reviews: method({
      GET: [validateParams, getReviews],
      POST: [createReview],
    }),
  },
  graphql: {
    resolvers: {
      Query: resolvers.queries,
      Mutation: resolvers.mutations,
    },
  },
})
```

## Common failure modes

- **Using axios/fetch/got/node-fetch for HTTP calls**: These libraries bypass the entire VTEX IO infrastructure — no automatic auth token injection, no caching, no retry logic, no metrics. Outbound requests may also be blocked by the firewall. Create a proper client extending `ExternalClient` or `JanusClient` instead.
- **Putting business logic in clients**: Clients become bloated and hard to test. Keep clients as thin wrappers around HTTP calls. Put business logic in middlewares or dedicated service functions.
- **Direct client instantiation**: Using `new MyClient(...)` inside a middleware creates clients without auth context, caching, or metrics. Always access via `ctx.clients`.

## Review checklist

- [ ] Are all HTTP calls going through `@vtex/api` clients (no axios, fetch, got)?
- [ ] Are all clients accessed via `ctx.clients`, never instantiated with `new`?
- [ ] Are custom clients registered in the IOClients class?
- [ ] Does the Service entry point correctly wire clients, routes, resolvers, and events?
- [ ] Is business logic in middlewares/resolvers, not in client classes?
- [ ] Does `service.json` have reasonable route count (≤10)?
- [ ] Are client options (retries, timeout) configured appropriately?

## Reference

- [Services](https://developers.vtex.com/docs/guides/vtex-io-documentation-service) — Overview of VTEX IO backend service development
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — Native client list and client architecture overview
- [Developing Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-how-to-create-and-use-clients) — Step-by-step guide for creating custom JanusClient and ExternalClient
- [Using Node Clients](https://developers.vtex.com/docs/guides/using-node-clients) — How to use @vtex/api and @vtex/clients in middlewares and resolvers
- [Calling Commerce APIs](https://developers.vtex.com/docs/guides/calling-commerce-apis-1-getting-the-service-app-boilerplate) — Tutorial for building a service app that calls VTEX Commerce APIs
- [Best Practices for Avoiding Rate Limits](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) — Why clients with caching prevent rate-limit issues
