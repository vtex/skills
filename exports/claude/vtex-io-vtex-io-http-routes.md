This skill provides guidance for AI agents working with VTEX Custom VTEX IO Apps. Apply these constraints and patterns when assisting developers with apply when designing or implementing HTTP endpoints exposed by a VTEX IO backend service. Covers route boundaries, handler structure, middleware composition, request validation, and response modeling for service.json routes. Use for webhook endpoints, partner integrations, callback APIs, or reviewing VTEX IO handlers that should expose explicit HTTP contracts.

# HTTP Routes & Handler Boundaries

## When this skill applies

Use this skill when a VTEX IO service needs to expose explicit HTTP endpoints through `service.json` routes and implement the corresponding handlers under `node/`.

- Building callback or webhook endpoints
- Exposing integration endpoints for partners or backoffice flows
- Structuring route handlers and middleware chains
- Validating params, query strings, headers, or request bodies
- Standardizing response shape and status code behavior

Do not use this skill for:
- sizing or tuning the service runtime
- deciding app policies in `manifest.json`
- designing GraphQL APIs
- modeling async event or worker flows

## Decision rules

- Use HTTP routes when the integration needs explicit URL contracts, webhooks, or callback-style request-response behavior.
- In VTEX IO, `service.json` declares route IDs, paths, and exposure such as `public`, while the Node entrypoint wires those route IDs to handlers exported from `node/routes`. Middlewares are composed in code, not declared directly in `service.json`.
- Keep route handlers small and explicit. Route code should validate input, call domain or integration services, and shape the response.
- Put cross-cutting concerns such as validation, request normalization, or shared auth checks into middlewares instead of duplicating them across handlers.
- Define route params, query expectations, and body shape as close as possible to the handler boundary.
- Use consistent status codes and response structures for similar route families.
- For webhook or callback endpoints, follow the caller's documented expectations for status codes and error bodies, and keep responses small and deterministic to avoid ambiguous retries.
- Emit structured logs or metrics for critical routes so failures, latency, and integration health can be diagnosed without changing the handler contract.
- Prefer explicit route files grouped by bounded domain such as `routes/orders.ts` or `routes/catalog.ts`.
- Treat public routes as explicit external contracts. Do not expand a route to public use without reviewing validation, auth expectations, and response safety.

## Hard constraints

### Constraint: Route handlers must keep the HTTP contract explicit

Each route handler MUST make the request and response contract understandable at the handler boundary. Do not hide required params, body fields, or status code decisions deep inside unrelated services.

**Why this matters**

HTTP integrations depend on predictable contracts. When validation and response shaping are implicit or scattered, partner integrations become fragile and errors become harder to diagnose.

**Detection**

If the handler delegates immediately without validating required params, query values, headers, or request body shape, STOP and make the contract explicit before proceeding.

**Correct**

```typescript
export async function getOrder(ctx: Context, next: () => Promise<void>) {
  const { id } = ctx.vtex.route.params

  if (!id) {
    ctx.status = 400
    ctx.body = { message: 'Missing route param: id' }
    return
  }

  const order = await ctx.clients.partnerApi.getOrder(id)
  ctx.status = 200
  ctx.body = order
  await next()
}
```

**Wrong**

```typescript
export async function getOrder(ctx: Context) {
  ctx.body = await handleOrder(ctx)
}
```

### Constraint: Shared route concerns must live in middlewares, not repeated in every handler

Repeated concerns such as validation, request normalization, or common auth checks SHOULD be implemented as middlewares and composed through the route chain.

**Why this matters**

Duplicating the same checks in many handlers creates drift and inconsistent route behavior. Middleware keeps the HTTP surface easier to review and evolve.

**Detection**

If multiple handlers repeat the same body validation, header checks, or context preparation, STOP and extract a middleware before adding more duplication.

**Correct**

```typescript
export async function validateSignature(ctx: Context, next: () => Promise<void>) {
  const signature = ctx.request.header['x-signature']

  if (!signature) {
    ctx.status = 401
    ctx.body = { message: 'Missing signature' }
    return
  }

  await next()
}
```

**Wrong**

```typescript
export async function routeA(ctx: Context) {
  if (!ctx.request.header['x-signature']) {
    ctx.status = 401
    return
  }
}

export async function routeB(ctx: Context) {
  if (!ctx.request.header['x-signature']) {
    ctx.status = 401
    return
  }
}
```

### Constraint: HTTP routes should not absorb async or batch work that belongs in events or workers

Routes MUST keep request-response latency bounded. If a route triggers expensive, retry-prone, or batch-oriented work, move that work to an async flow and keep the route as a thin trigger or acknowledgment boundary.

**Why this matters**

Long-running HTTP handlers create poor integration behavior, timeout risk, and operational instability. VTEX IO services should separate immediate route contracts from background processing.

**Detection**

If a route performs large loops, batch imports, heavy retries, or work that is not required to complete before responding, STOP and redesign the flow around async processing.

**Correct**

```typescript
export async function triggerImport(ctx: Context) {
  await ctx.clients.importApi.enqueueImport(ctx.request.body)
  ctx.status = 202
  ctx.body = { accepted: true }
}
```

**Wrong**

```typescript
export async function triggerImport(ctx: Context) {
  for (const item of ctx.request.body.items) {
    await ctx.clients.importApi.importItem(item)
  }

  ctx.status = 200
}
```

## Preferred pattern

Recommended file layout:

```text
node/
├── routes/
│   ├── index.ts
│   ├── orders.ts
│   └── webhooks.ts
└── middlewares/
    ├── validateBody.ts
    └── validateSignature.ts
```

Wiring routes in VTEX IO services:

In VTEX IO, `service.json` declares route IDs and paths, the Node entrypoint registers a `routes` object in `new Service(...)`, and `node/routes/index.ts` maps each route ID to the final handler. Middlewares are composed in code, not declared directly in `service.json`.

```json
{
  "routes": {
    "orders-get": {
      "path": "/_v/orders/:id",
      "public": false
    },
    "reviews-create": {
      "path": "/_v/reviews",
      "public": false
    }
  }
}
```

```typescript
// node/index.ts
import type { ClientsConfig, RecorderState, ServiceContext } from '@vtex/api'
import { Service } from '@vtex/api'
import { Clients } from './clients'
import routes from './routes'

const clients: ClientsConfig<Clients> = {
  implementation: Clients,
  options: {
    default: {
      retries: 2,
      timeout: 800,
    },
  },
}

declare global {
  type Context = ServiceContext<Clients, RecorderState>
}

export default new Service<Clients, RecorderState>({
  clients,
  routes,
})
```

Minimal route pattern:

```typescript
// node/routes/index.ts
import type { RouteHandler } from '@vtex/api'
import { createReview } from './reviews'
import { getOrder } from './orders'

const routes: Record<string, RouteHandler> = {
  'orders-get': getOrder,
  'reviews-create': createReview,
}

export default routes
```

```typescript
// node/routes/orders.ts
import { compose } from 'koa-compose'
import { validateSignature } from '../middlewares/validateSignature'

async function rawGetOrder(ctx: Context, next: () => Promise<void>) {
  const { id } = ctx.vtex.route.params

  if (!id) {
    ctx.status = 400
    ctx.body = { message: 'Missing route param: id' }
    return
  }

  const order = await ctx.clients.partnerApi.getOrder(id)
  ctx.status = 200
  ctx.body = order

  await next()
}

export const getOrder = compose([validateSignature, rawGetOrder])
```

```typescript
export async function createReview(ctx: Context, next: () => Promise<void>) {
  const body = ctx.request.body

  if (!body?.productId) {
    ctx.status = 400
    ctx.body = { message: 'Missing productId' }
    return
  }

  const review = await ctx.clients.reviewApi.createReview(body)
  ctx.status = 201
  ctx.body = review
  await next()
}
```

Keep domain logic in services or integrations, and keep route handlers responsible for HTTP concerns such as validation, status codes, headers, and response shape.

## Common failure modes

- Hiding request validation inside unrelated services instead of making route expectations explicit.
- Repeating the same auth or normalization logic in many handlers instead of using middleware.
- Letting HTTP handlers perform long-running async or batch work.
- Returning inconsistent status codes or response shapes for similar endpoints.
- Expanding a route to public exposure without reviewing its trust boundary.

## Review checklist

- [ ] Is HTTP the right exposure mechanism for this contract?
- [ ] Are required params, headers, query values, and body fields validated at the route boundary?
- [ ] Are repeated concerns factored into middlewares?
- [ ] Does the handler stay small and focused on HTTP concerns?
- [ ] Should any part of the work move to async events or workers instead?

## Related skills

- [`vtex-io-events-and-workers`](../vtex-io-events-and-workers/skill.md) - Use when expensive or retry-prone work should move out of HTTP handlers into async flows
- [`vtex-io-auth-and-policies`](../vtex-io-auth-and-policies/skill.md) - Use when deciding which policies or access rules should protect HTTP routes

## Reference

- [Service](https://developers.vtex.com/docs/guides/vtex-io-documentation-service) - Route declaration and service exposure
- [Node Builder](https://developers.vtex.com/docs/guides/vtex-io-documentation-node-builder) - Backend file layout and route implementation context
- [Using Node Clients](https://developers.vtex.com/docs/guides/using-node-clients) - Client usage from route handlers
