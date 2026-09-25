This skill provides guidance for AI agents working with VTEX Custom VTEX IO Apps. Apply these constraints and patterns when assisting developers with apply when designing or implementing the runtime structure of a VTEX IO backend app under node/. Covers the Service entrypoint, typed context and state, service.json runtime configuration, and how routes, events, and GraphQL handlers are registered and executed. Use for structuring backend apps, defining runtime boundaries, or fixing execution-model issues in VTEX IO services.

# Service Runtime & Execution Model

## When this skill applies

Use this skill when the main decision is how a VTEX IO backend app runs inside the `node` builder: how the `Service` entrypoint is structured, how runtime configuration is declared, and how routes, events, or GraphQL handlers are registered into the service.

- Creating a new backend app under `node/`
- Structuring `node/index.ts` as the service entrypoint
- Defining typed `Context`, `State`, and params contracts for handlers
- Configuring `service.json` for timeout, memory, workers, and replicas
- Troubleshooting runtime issues caused by service registration or execution model mismatches
- Registering GraphQL handlers at the runtime level, while keeping schema and resolver design in a separate skill

Do not use this skill for:
- deciding the app contract in `manifest.json`
- designing custom clients or integration transport layers
- detailed HTTP route handler behavior
- event-specific business workflows
- GraphQL schema or resolver modeling beyond runtime registration

## Decision rules

- Treat `node/index.ts` as the runtime composition root of the backend app.
- Use the `Service` definition to register runtime surfaces such as routes, events, and GraphQL handlers, not to hold business logic directly.
- Keep runtime wiring explicit: context typing, client typing, route registration, and event registration should be visible at the service boundary.
- Put execution knobs such as timeout, ttl, memory, workers, and replica limits in `service.json`, not inside handler code.
- Use `service.json` to declare the runtime parameters the platform uses to execute the service, especially `memory`, `timeout`, `ttl`, `minReplicas`, `maxReplicas`, `workers`, `routes`, `events`, and `rateLimitPerReplica`.
- Use `routes` in `service.json` to expose HTTP entrypoints. Routes are private by default, so set `public: true` explicitly for routes that must be externally reachable.
- Use `smartcache: true` only on idempotent, cacheable routes where the same response can be safely reused across repeated requests. Avoid it on personalized, authenticated, or write-oriented endpoints.
- Use `events` in `service.json` to declare which event sources and handlers are part of the service runtime. Keep event registration in the runtime layer and event-specific business rules in dedicated event modules.
- Use `rateLimitPerReplica` to shape throughput per replica for requests and events. Set a global baseline only when the service needs it, then add small explicit overrides only for expensive routes or noisy event sources.
- Do not use `rateLimitPerReplica` as a substitute for redesigning expensive routes, queueing work, or moving slow operations to async processing.
- Keep handlers focused on request or event behavior; keep runtime structure focused on bootstrapping and registration.
- Model `Context`, `State`, and params types deliberately so middlewares and handlers share a stable contract. Apply the same typed `Context` and `State` to middlewares so they can safely manipulate `ctx.state`, `ctx.vtex`, and params without falling back to `any`.
- If a backend app starts mixing runtime wiring, client implementation, and business rules in the same file, split those concerns before expanding the service further.
- Although some authorization fields such as `routes.access` or `routes.policies` may live in `service.json`, they are primarily authorization concerns and belong in auth or security-focused skills rather than this runtime skill.

Runtime sizing heuristics:

- These ranges are intended for partner and account-level apps. Native VTEX core services may legitimately use much higher values such as thousands of MB of memory or hundreds of replicas, but those values should not be used as defaults for custom apps.

Suggested defaults:

- Start synchronous HTTP services with `timeout` between 10 and 30 seconds. For UX-facing routes, prefer 5 to 15 seconds.
- Start `memory` at 256 MB.
- Start `workers` at 1.
- Use `minReplicas: 2` as the default for installed apps, and reserve `minReplicas: 1` for linked-app development contexts where the platform allows it.
- Use `maxReplicas: 5` as the lowest practical starting point, since the documented minimum is `5`.
- Use `ttl` intentionally. In VTEX IO, `ttl` is measured in minutes, with platform defaults and limits that differ from `timeout`. For partner apps, start from the default `10` minutes and increase intentionally up to `60` only when reducing cold starts matters more than allowing idle instances to sleep sooner.

Scaling ranges and exceptions:

- Use 128 to 256 MB for simpler IO-bound services, and move to 512 MB only when there is evidence of OOM, large payload processing, or heavier libraries.
- Increase `workers` to 2 to 4 only for high-throughput IO-bound workloads after measuring benefit. Avoid using more than 4 workers per instance as a default.
- Increase `maxReplicas` from `5` toward `10` only when public traffic or predictable peaks justify it. Treat values above 10 as exceptions that require explicit justification and monitoring in partner apps.
- Avoid `timeout` values above 60 seconds for HTTP routes; if more time is needed, redesign the flow as async work.
- Remember that `ttl` has a documented minimum of `10` minutes and maximum of `60` minutes. Use higher values intentionally to reduce cold starts on low-traffic or bursty services, and avoid treating `ttl` like a per-request timeout.
- For partner apps, `rateLimitPerReplica.perMinute` often starts in the `60` to `300` range for normal routes and in the `10` to `60` range for more expensive ones. `rateLimitPerReplica.concurrent` often starts between `1` and `5`.

## Hard constraints

### Constraint: The Service entrypoint must stay a runtime composition root

`node/index.ts` MUST define and export the VTEX IO service runtime structure, not become a catch-all file for business logic, data transformation, or transport implementation.

**Why this matters**

When the entrypoint mixes registration with business logic, the execution model becomes harder to reason about, handlers become tightly coupled, and changes to routes, events, or GraphQL surfaces become risky.

**Detection**

If `node/index.ts` contains large handler bodies, external API calls, complex branching, or data-mapping logic, STOP and move that logic into dedicated modules. Keep the entrypoint focused on typing and registration.

**Correct**

```typescript
import type { ClientsConfig, RecorderState, ServiceContext } from '@vtex/api'
import { Service } from '@vtex/api'
import { clients, Clients } from './clients'
import { routes } from './routes'

export interface State extends RecorderState {}

export type Context = ServiceContext<Clients, State>

const clientsConfig: ClientsConfig<Clients> = {
  implementation: clients,
  options: {},
}

export default new Service<Clients, State>({
  clients: clientsConfig,
  routes,
})
```

**Wrong**

```typescript
import { Service } from '@vtex/api'
import axios from 'axios'

export default new Service({
  routes: {
    reviews: async (ctx: any) => {
      const response = await axios.get('https://example.com/data')
      const transformed = response.data.items.map((item: any) => ({
        ...item,
        extra: true,
      }))

      ctx.body = transformed.filter((item: any) => item.active)
    },
  },
})
```

### Constraint: Runtime configuration must be expressed in `service.json`, not improvised in code

Resource and execution settings such as timeout, ttl, memory, workers, and replica behavior MUST be configured in `service.json` when the app depends on them.
`service.json` resides inside the `node/` folder and centralizes runtime parameters such as routes, events, memory, timeout, ttl, workers, replicas, and rate limits for this service.

**Why this matters**

These settings are part of the service runtime contract with the platform. Hiding them in assumptions or spreading them across code makes behavior harder to predict and can cause timeouts, cold-start churn, underprovisioning, or scaling mismatches. In VTEX IO, `ttl` is especially important because it is measured in minutes and influences how aggressively service infrastructure can go idle between requests.
Using the minimum `ttl` on low-traffic services can increase cold starts, because the platform is allowed to scale the service down more aggressively between bursts.

**Detection**

If the app depends on long-running work, concurrency, warm capacity, or specific route exposure behavior, STOP and verify that the relevant `service.json` settings are present and intentional. If the behavior is only implied in code comments or handler logic, move it into runtime configuration.

**Correct**

```json
{
  "memory": 256,
  "timeout": 30,
  "ttl": 10,
  "minReplicas": 2,
  "maxReplicas": 10,
  "workers": 4,
  "rateLimitPerReplica": {
    "perMinute": 300,
    "concurrent": 10
  },
  "routes": {
    "reviews": {
      "path": "/_v/api/reviews",
      "public": false
    }
  }
}
```

**Wrong**

```json
{
  "routes": {
    "reviews": {
      "path": "/_v/api/reviews"
    }
  }
}
```

This runtime configuration is incomplete for a service that depends on explicit timeout, concurrency, rate limiting, or replica behavior, and it leaves execution characteristics undefined.

### Constraint: Route exposure must be explicit in the runtime contract

Every HTTP route exposed by the service MUST be declared in `service.json` with an intentional visibility choice. Do not rely on implicit defaults when the route should be private or public.
Routes are private by default, so always set `public: true` explicitly when the route must be externally reachable.

**Why this matters**

Route visibility is part of the runtime contract of the service. If exposure is ambiguous, a route can be published with the wrong accessibility, which creates security risk for private handlers and integration failures for routes expected to be public.

**Detection**

If a route exists in the service runtime, STOP and verify that it is declared in `service.json` and that `public` matches the intended exposure. If the route is consumed only by trusted backoffice or app-to-app flows, default to checking that it is private before expanding access.

**Correct**

```json
{
  "routes": {
    "status": {
      "path": "/_v/status/health",
      "public": true,
      "smartcache": true
    },
    "reviews": {
      "path": "/_v/api/reviews",
      "public": false
    }
  }
}
```

**Wrong**

```json
{
  "routes": {
    "reviews": {
      "path": "/_v/api/reviews"
    }
  }
}
```

This route leaves visibility implicit, so the runtime contract does not clearly communicate whether the endpoint is meant to be public or protected.

### Constraint: Typed context and state must match the handlers registered in the runtime

The service MUST define `Context`, `State`, and handler contracts that match the routes, events, or GraphQL handlers it registers.

**Why this matters**

Untyped or inconsistent runtime contracts make middleware composition fragile and allow handlers to rely on state or params that are never guaranteed to exist.

**Detection**

If middlewares or handlers use `ctx.state`, `ctx.clients`, `ctx.vtex`, or params fields without a shared typed contract, STOP and introduce or fix the runtime types before adding more handlers.

**Correct**

```typescript
import type { ParamsContext, RecorderState, ServiceContext } from '@vtex/api'

interface State extends RecorderState {
  reviewId?: string
}

type CustomContext = ServiceContext<Clients, State, ParamsContext>

export async function getReview(ctx: CustomContext) {
  ctx.state.reviewId = ctx.vtex.route.params.id
  ctx.body = { id: ctx.state.reviewId }
}
```

**Wrong**

```typescript
export async function getReview(ctx: any) {
  ctx.state.reviewId = ctx.params.review
  ctx.body = { id: ctx.state.missingField.value }
}
```

## Preferred pattern

Recommended file layout:

```text
node/
├── index.ts
├── clients/
│   └── index.ts
├── routes/
│   └── index.ts
├── events/
│   └── index.ts
├── graphql/
│   └── index.ts
└── middlewares/
    └── validate.ts
```

Minimal service runtime pattern:

```typescript
import type { ClientsConfig, RecorderState, ServiceContext } from '@vtex/api'
import { Service } from '@vtex/api'
import { clients, Clients } from './clients'
import { routes } from './routes'

export interface State extends RecorderState {}

export type Context = ServiceContext<Clients, State>

const clientsConfig: ClientsConfig<Clients> = {
  implementation: clients,
  options: {},
}

export default new Service<Clients, State>({
  clients: clientsConfig,
  routes,
})
```

Minimal `service.json` pattern:

```json
{
  "memory": 256,
  "timeout": 30,
  "ttl": 10,
  "minReplicas": 2,
  "maxReplicas": 5,
  "workers": 1,
  "rateLimitPerReplica": {
    "perMinute": 120,
    "concurrent": 4
  },
  "routes": {
    "status": {
      "path": "/_v/status/health",
      "public": true,
      "smartcache": true
    },
    "reviews": {
      "path": "/_v/api/reviews",
      "public": false
    }
  },
  "events": {
    "orderCreated": {
      "sender": "vtex.orders-broadcast",
      "topics": ["order-created"],
      "rateLimitPerReplica": {
        "perMinute": 60,
        "concurrent": 2
      }
    }
  }
}
```

Use the service entrypoint to compose runtime surfaces, then push business behavior into handlers, clients, and other focused modules.
If `routes/index.ts` or `events/index.ts` grows too large, split it by domain such as `routes/orders.ts` or `events/catalog.ts` and keep the index file as a small registry.

## Common failure modes

- Putting business logic directly into `node/index.ts`.
- Treating `service.json` as optional when runtime behavior depends on explicit resource settings.
- Setting `ttl` too low and causing the service to sleep too aggressively between bursts of traffic.
- Enabling `smartcache` on personalized or write-oriented routes and risking incorrect cache reuse across requests.
- Registering routes, events, or GraphQL handlers without a clear typed `Context` and `State`.
- Mixing runtime composition with client implementation details.
- Letting one service entrypoint accumulate unrelated responsibilities across HTTP, events, and GraphQL without clear module boundaries.

## Review checklist

- [ ] Is `node/index.ts` acting as a runtime composition root rather than a business-logic file?
- [ ] Are routes, events, and GraphQL handlers registered explicitly and cleanly?
- [ ] Does `service.json` express the runtime behavior the app actually depends on?
- [ ] Are `Context`, `State`, and params types shared consistently across handlers?
- [ ] Are runtime concerns separated from client implementation and business logic?

## Reference

- [Service](https://developers.vtex.com/docs/guides/vtex-io-documentation-service) - VTEX IO service runtime structure and registration
- [Service JSON](https://developers.vtex.com/docs/guides/vtex-io-documentation-service-json) - Runtime configuration for VTEX IO services
- [Node Builder](https://developers.vtex.com/docs/guides/vtex-io-documentation-node-builder) - Backend app structure under the `node` builder
- [Developing an App](https://developers.vtex.com/docs/guides/vtex-io-documentation-4-developing-an-app) - General backend app development flow
