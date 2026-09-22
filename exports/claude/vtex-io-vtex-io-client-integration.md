This skill provides guidance for AI agents working with VTEX Custom VTEX IO Apps. Apply these constraints and patterns when assisting developers with apply when designing or implementing how a VTEX IO backend app integrates with VTEX services or external APIs through @vtex/api and @vtex/clients. Covers choosing the correct client type, registering clients in IOClients, configuring InstanceOptions, and consuming integrations through ctx.clients. Use for custom client design, VTEX Core Commerce integrations, or reviewing backend code that should use VTEX IO client patterns instead of raw HTTP libraries.

# Client Integration & Service Access

## When this skill applies

Use this skill when the main decision is how a VTEX IO backend app should call VTEX services or external APIs through the VTEX IO client system.

- Creating custom clients under `node/clients/`
- Choosing between native clients from `@vtex/api` or `@vtex/clients` and a custom client
- Registering clients in `IOClients` and exposing them through `ctx.clients`
- Configuring `InstanceOptions` such as retries, timeout, headers, or caching
- Reviewing backend integrations that currently use raw HTTP libraries

Do not use this skill for:
- deciding the app contract in `manifest.json`
- structuring `node/index.ts` or tuning `service.json`
- designing GraphQL schema or resolver contracts
- modeling route authorization or security permissions
- building storefront or admin frontend integrations

## Decision rules

- Prefer native clients from `@vtex/api` or `@vtex/clients` when they already cover the target VTEX service. Common examples include clients for catalog, checkout, logistics, and OMS. Write a custom client only when no suitable native client or factory exists.
- Use `ExternalClient` primarily for non-VTEX external APIs. Avoid using it for VTEX-hosted endpoints such as `*.myvtex.com` or `*.vtexcommercestable.com.br` when a native client in `@vtex/clients`, `JanusClient`, or another documented higher-level VTEX client is available or more appropriate.
- Janus is VTEX's Core Commerce API gateway. Use `JanusClient` only when you need to call a VTEX Core Commerce API through Janus and no suitable native client from `@vtex/clients` already exists.
- Use `InfraClient` only for advanced integrations with VTEX IO infrastructure services under explicit documented guidance. In partner apps, prefer higher-level clients and factories such as `masterData` or `vbase` instead of extending `InfraClient` directly.
- Register every custom or native client in `node/clients/index.ts` through a `Clients` class that extends `IOClients`.
- Consume integrations through `ctx.clients`, never by instantiating client classes inside middlewares, resolvers, or event handlers.
- Keep clients focused on transport, request options, endpoint paths, and small response shaping. Keep business rules, authorization decisions, and orchestration outside the client.
- When building custom clients, always rely on the `IOContext` passed by VTEX IO such as `account`, `workspace`, and available auth tokens instead of hardcoding account names, workspaces, or environment-specific VTEX URLs.
- Configure shared `InstanceOptions` in the runtime client config, then use client-specific overrides only when an integration has clearly different needs.
- Use the `metric` option on important client calls so integrations can be tracked and monitored at the client layer, not only at the handler layer.
- Keep error normalization close to the client boundary, but avoid hiding relevant HTTP status codes or transport failures that are important for observability and debugging.
- When integrating with external services, confirm that the required outbound policies are declared in the app contract, but keep the detailed policy modeling in auth or app-contract skills.
- In rare migration or legacy scenarios, `ExternalClient` may temporarily be used against VTEX-hosted endpoints, but treat this as an exception. The long-term goal should be to move toward native clients or the proper documented VTEX client abstractions so routing, authentication, and observability stay consistent.

Client selection guide:

| Client type | Use when | Avoid when |
|---|---|---|
| `ExternalClient` | calling non-VTEX external APIs | VTEX-hosted APIs that already have a native client or Janus-based abstraction |
| `JanusClient` | calling VTEX Core Commerce APIs not yet wrapped by `@vtex/clients` | any VTEX service that already has a native client such as Catalog, Checkout, Logistics, or OMS |
| `InfraClient` | implementing advanced infra-style clients only under explicit documented guidance | general VTEX or external APIs in partner apps |

InstanceOptions heuristics:

- Start with small, explicit client defaults such as `retries: 2` and a request `timeout` between `1000` and `3000` milliseconds.
- Use small finite retry values such as `1` to `3` for idempotent operations.
- Avoid automatic retries on non-idempotent operations unless the upstream API explicitly documents safe idempotency behavior.
- Do not use high retry counts to hide upstream instability. Surface repeated failures clearly and handle them intentionally in the business layer.
- Prefer per-client headers and metrics instead of scattering header definitions through handlers.
- Use memory or disk cache options only when repeated reads justify it and the response can be safely reused.
- Keep auth setup inside the client constructor or factory configuration, not duplicated across handlers.

## Hard constraints

### Constraint: All service-to-service HTTP calls must go through VTEX IO clients

HTTP communication from a VTEX IO backend app MUST go through `@vtex/api` or `@vtex/clients` clients. Do not use raw libraries such as `axios`, `fetch`, `got`, or `node-fetch` for service integrations.

**Why this matters**

VTEX IO clients provide transport behavior that raw libraries bypass, including authentication context, retries, metrics, caching options, and infrastructure-aware request execution. Raw HTTP calls make integrations harder to observe and easier to misconfigure.

**Detection**

If you see `axios`, `fetch`, `got`, `node-fetch`, or direct ad hoc HTTP code in a VTEX IO backend service, STOP and replace it with an appropriate VTEX IO client pattern.

**Correct**

```typescript
import type { IOContext, InstanceOptions } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

export class WeatherClient extends ExternalClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('https://api.weather.com', context, {
      ...options,
      headers: {
        'X-VTEX-Account': context.account,
        'X-VTEX-Workspace': context.workspace,
        'X-Api-Key': process.env.WEATHER_API_KEY,
        ...options?.headers,
      },
    })
  }

  public getForecast(city: string) {
    return this.http.get(`/v1/forecast/${city}`, {
      metric: 'weather-forecast',
    })
  }
}
```

**Wrong**

```typescript
import axios from 'axios'

export async function getForecast(city: string) {
  const response = await axios.get(`https://api.weather.com/v1/forecast/${city}`, {
    headers: {
      'X-Api-Key': process.env.WEATHER_API_KEY,
    },
  })

  return response.data
}
```

### Constraint: Clients must be registered in IOClients and consumed through ctx.clients

Clients MUST be registered in the `Clients` class that extends `IOClients`, and middlewares, resolvers, or event handlers MUST access them through `ctx.clients`.

**Why this matters**

The VTEX IO client registry ensures the current request context, options, caching behavior, and instrumentation are applied consistently. Direct instantiation inside handlers bypasses that shared lifecycle and creates fragile integration code.

**Detection**

If you see `new MyClient(...)` inside a middleware, resolver, or event handler, STOP. Move the client into `node/clients/`, register it in `IOClients`, and consume it through `ctx.clients`.

**Correct**

```typescript
import { IOClients } from '@vtex/api'
import { Catalog } from '@vtex/clients'

export class Clients extends IOClients {
  public get catalog() {
    return this.getOrSet('catalog', Catalog)
  }
}
```

```typescript
export async function getSku(ctx: Context) {
  const sku = await ctx.clients.catalog.getSkuById(ctx.vtex.route.params.id)
  ctx.body = sku
}
```

**Wrong**

```typescript
import { Catalog } from '@vtex/clients'

export async function getSku(ctx: Context) {
  const catalog = new Catalog(ctx.vtex, {})
  const sku = await catalog.getSkuById(ctx.vtex.route.params.id)
  ctx.body = sku
}
```

### Constraint: Choose the narrowest client type that matches the integration boundary

Each integration MUST use the correct client abstraction for its boundary. Do not default every integration to `ExternalClient` or `JanusClient` when a more specific client type or native package already exists.

**Why this matters**

The client type communicates intent and shapes how authentication, URLs, and service boundaries are handled. Using the wrong abstraction makes the integration harder to understand and more likely to drift from VTEX IO conventions.

**Detection**

If the target is a VTEX Core Commerce API, STOP and check whether a native client from `@vtex/clients` or `JanusClient` is more appropriate than `ExternalClient`. If the target is VTEX-hosted, STOP and confirm that there is no more specific documented VTEX client abstraction before defaulting to `ExternalClient`.

**Correct**

```typescript
import type { IOContext, InstanceOptions } from '@vtex/api'
import { JanusClient } from '@vtex/api'

export class RatesAndBenefitsClient extends JanusClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(context, options)
  }
}
```

**Wrong**

```typescript
import type { IOContext, InstanceOptions } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

export class RatesAndBenefitsClient extends ExternalClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(`https://${context.account}.vtexcommercestable.com.br`, context, options)
  }
}
```

## Preferred pattern

Recommended file layout:

```text
node/
├── clients/
│   ├── index.ts
│   ├── catalog.ts
│   └── partnerApi.ts
├── middlewares/
│   └── getData.ts
└── index.ts
```

Register native and custom clients in one place:

```typescript
import { IOClients } from '@vtex/api'
import { Catalog } from '@vtex/clients'
import { PartnerApiClient } from './partnerApi'

export class Clients extends IOClients {
  public get catalog() {
    return this.getOrSet('catalog', Catalog)
  }

  public get partnerApi() {
    return this.getOrSet('partnerApi', PartnerApiClient)
  }
}
```

Create custom clients with explicit routes and options:

```typescript
import type { IOContext, InstanceOptions } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

export class PartnerApiClient extends ExternalClient {
  private routes = {
    order: (id: string) => `/orders/${id}`,
  }

  constructor(context: IOContext, options?: InstanceOptions) {
    super('https://partner.example.com', context, {
      ...options,
      retries: 2,
      timeout: 2000,
      headers: {
        'X-VTEX-Account': context.account,
        'X-VTEX-Workspace': context.workspace,
        ...options?.headers,
      },
    })
  }

  public getOrder(id: string) {
    return this.http.get(this.routes.order(id), {
      metric: 'partner-get-order',
    })
  }
}
```

Wire shared client options in the runtime:

```typescript
import type { ClientsConfig } from '@vtex/api'
import { Clients } from './clients'

const clients: ClientsConfig<Clients> = {
  implementation: Clients,
  options: {
    default: {
      retries: 2,
      timeout: 2000,
    },
  },
}
```

Use clients from handlers through `ctx.clients`:

```typescript
export async function getOrder(ctx: Context) {
  const order = await ctx.clients.partnerApi.getOrder(ctx.vtex.route.params.id)
  ctx.body = order
}
```

If a client file grows too large, split it by bounded integration domains and keep `node/clients/index.ts` as a small registry.

## Common failure modes

- Using `axios`, `fetch`, or other raw HTTP libraries in backend handlers instead of VTEX IO clients.
- Instantiating clients directly inside handlers instead of registering them in `IOClients`.
- Choosing `ExternalClient` when a native VTEX client or a more specific app client already exists.
- Putting business rules, validation, or orchestration into clients instead of keeping them as transport wrappers.
- Scattering headers, auth setup, and retry settings across handlers instead of centralizing them in the client or shared client config.
- Forgetting the outbound-access policy required for an external integration declared in a custom client.

## Review checklist

- [ ] Does each integration use the correct VTEX IO client abstraction?
- [ ] Are native clients from `@vtex/api` or `@vtex/clients` preferred when available?
- [ ] Are clients registered in `IOClients` and consumed through `ctx.clients`?
- [ ] Are raw HTTP libraries absent from the backend integration code?
- [ ] Are retries, timeouts, headers, and metrics configured in the client layer rather than scattered across handlers?
- [ ] Are business rules kept out of the client layer?

## Reference

- [Using Node Clients](https://developers.vtex.com/docs/guides/using-node-clients) - How to consume clients through `ctx.clients`
- [Developing Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-how-to-create-and-use-clients) - How to build custom clients with `@vtex/api`
- [Using VTEX IO clients](https://developers.vtex.com/docs/guides/calling-commerce-apis-3-using-vtex-io-clients) - How to use VTEX clients for Core Commerce APIs
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) - VTEX IO client architecture and native client catalog
