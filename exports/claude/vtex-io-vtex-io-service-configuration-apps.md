This skill provides guidance for AI agents working with VTEX Custom VTEX IO Apps. Apply these constraints and patterns when assisting developers with apply when designing VTEX IO configuration apps with the configuration builder or when a service app must receive structured configuration through runtime context. Covers the separation between service apps and configuration apps, schema.json and configuration.json, settingsType, and reading injected configuration through ctx.vtex.settings. Use for shared service configuration, decoupled configuration lifecycle, or reviewing whether app settings should be replaced by a configuration app.

# Service Configuration Apps

## When this skill applies

Use this skill when a VTEX IO service should receive structured configuration from another app through the `configuration` builder instead of relying only on local app settings.

- Creating a configuration app with the `configuration` builder
- Exposing configuration entrypoints from a service app
- Sharing one configuration contract across multiple services or apps
- Separating configuration lifecycle from runtime app lifecycle
- Reading injected configuration through `ctx.vtex.settings`

Do not use this skill for:
- simple app-local configuration managed only through `settingsSchema`
- Store Framework block settings through `contentSchemas.json`
- generic service runtime wiring unrelated to configuration
- policy design beyond the configuration-specific permissions required

## Decision rules

- Treat the service app and the configuration app as separate responsibilities.
- The service app owns runtime (`node`, `graphql`, etc.), declares the `configuration` builder in `manifest.json`, defines `configuration/schema.json`, and reads injected values through `ctx.vtex.settings`.
- The configuration app does not own the service runtime. It should not declare `node` or `graphql` builders and usually has only the `configuration` builder.
- The configuration app points to the target service in the `configuration` field and provides concrete values in `<service-app>/configuration.json`.
- Use a configuration app when the configuration contract should live independently from the app that consumes it.
- Prefer a configuration app when multiple apps or services need to share the same configuration model.
- In service apps, expose configuration entrypoints explicitly through `settingsType: "workspace"` in `node/service.json` routes or events, or through `@settings` in GraphQL when the service should receive configuration from a configuration app.
- In configuration apps, the folder name under `configuration/` and the key in the `configuration` field should match the target service app ID, for example `shipping-service` in `vendor.shipping-service`.
- The shape of `configuration.json` must respect the JSON Schema declared by the service app.
- Read received configuration from `ctx.vtex.settings` inside the service runtime instead of making your own HTTP call just to fetch those values.
- Handlers and resolvers should cast or validate `ctx.vtex.settings` to match the configuration schema and apply defaults consistent with that schema.
- Treat configuration apps as a way to inject structured runtime configuration through VTEX IO context, not as a replacement for arbitrary operational data storage.
- Use `settingsSchema` when configuration is local to one app and should be edited directly in Apps > App Settings. Use configuration apps when the contract should be shared, versioned, or decoupled from the consuming app lifecycle.
- If a service configured through a configuration app fails to resolve workspace app configuration due to permissions, explicitly evaluate whether the manifest needs the `read-workspace-apps` policy for that scenario. Do not add this policy by default to unrelated services.
- For service configuration contracts, prefer closed schemas with `additionalProperties: false` and use `definitions` plus `$ref` when the structure becomes more complex.

## Hard constraints

### Constraint: Service apps must explicitly opt in to receiving configuration

A service app MUST declare where configuration can be injected, using `settingsType: "workspace"` in `node/service.json` routes or events, or the `@settings` directive in GraphQL.

**Why this matters**

Configuration apps do not magically apply to all service entrypoints. The service must explicitly mark which routes, events, or queries resolve runtime configuration.

**Detection**

If a service is expected to receive configuration but its routes, events, or GraphQL queries do not declare `settingsType` or `@settings`, STOP and expose the configuration boundary first.

**Correct**

```json
{
  "routes": {
    "status": {
      "path": "/_v/status/:code",
      "public": true,
      "settingsType": "workspace"
    }
  }
}
```

**Wrong**

```json
{
  "routes": {
    "status": {
      "path": "/_v/status/:code",
      "public": true
    }
  }
}
```

### Constraint: Configuration shape must be defined with explicit schema files

Configuration apps and the services they configure MUST use explicit schema files instead of implicit or undocumented payloads.

**Why this matters**

Without `configuration/schema.json` and matching `configuration.json` contracts, shared configuration becomes ambiguous and error-prone across apps.

**Detection**

If a configuration app is introduced without a clear schema file or the service accepts loosely defined configuration payloads, STOP and define the schema first.

**Correct**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$ref": "#/definitions/ServiceConfiguration",
  "definitions": {
    "ServiceConfiguration": {
      "type": "object",
      "properties": {
        "bank": {
          "type": "object",
          "properties": {
            "account": { "type": "string" },
            "workspace": { "type": "string", "default": "master" },
            "version": { "type": "string" },
            "kycVersion": { "type": "string" },
            "payoutVersion": { "type": "string" },
            "host": { "type": "string" }
          },
          "required": ["account", "version", "kycVersion", "payoutVersion", "host"],
          "additionalProperties": false
        }
      },
      "required": ["bank"],
      "additionalProperties": false
    }
  }
}
```

**Wrong**

```json
{
  "anything": true
}
```

### Constraint: Consuming apps must read injected configuration from runtime context, not by inventing extra fetches

When a service is configured through a configuration app, it MUST consume the injected values from `ctx.vtex.settings` instead of creating its own ad hoc HTTP call just to retrieve the same configuration.

**Why this matters**

The purpose of configuration apps is to let VTEX IO inject the structured configuration directly into service context. Adding a custom fetch layer on top creates unnecessary complexity and loses the main runtime advantage of the builder.

**Detection**

If a service already exposes `settingsType` or `@settings` but still performs its own backend fetch to retrieve the same configuration, STOP and move the read to `ctx.vtex.settings`.

**Correct**

```typescript
export async function handleStatus(ctx: Context) {
  const settings = ctx.vtex.settings
  const code = ctx.vtex.route.params.code

  const status = resolveStatus(code, settings)
  ctx.body = { status }
}
```

**Wrong**

```typescript
export async function handleStatus(ctx: Context) {
  const settings = await ctx.clients.partnerApi.getSettings()
  ctx.body = settings
}
```

## Preferred pattern

Model the service and the configuration app as separate contracts:

1. The service app exposes where configuration can be resolved.
2. The service app defines accepted structure in `configuration/schema.json`.
3. The configuration app declares the service as a builder and supplies values in `configuration.json`.
4. The service reads the injected configuration through `ctx.vtex.settings`.

Example: service app `vendor.shipping-service`

`manifest.json`:

```json
{
  "vendor": "vendor",
  "name": "shipping-service",
  "version": "1.0.0",
  "builders": {
    "node": "7.x",
    "configuration": "1.x"
  }
}
```

`configuration/schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$ref": "#/definitions/ShippingConfiguration",
  "definitions": {
    "ShippingConfiguration": {
      "type": "object",
      "properties": {
        "carrierApi": {
          "type": "object",
          "properties": {
            "baseUrl": { "type": "string" },
            "apiKey": { "type": "string", "format": "password" },
            "timeoutMs": { "type": "integer", "default": 3000 }
          },
          "required": ["baseUrl", "apiKey"],
          "additionalProperties": false
        }
      },
      "required": ["carrierApi"],
      "additionalProperties": false
    }
  }
}
```

Example: configuration app `vendor.shipping-config`

`manifest.json`:

```json
{
  "vendor": "vendor",
  "name": "shipping-config",
  "version": "1.0.0",
  "builders": {
    "configuration": "1.x"
  },
  "configuration": {
    "shipping-service": "1.x"
  }
}
```

`configuration/shipping-service/configuration.json`:

```json
{
  "carrierApi": {
    "baseUrl": "https://api.carrier.com",
    "apiKey": "secret-api-key-here",
    "timeoutMs": 5000
  }
}
```

Example: Node service consuming injected configuration

```typescript
export async function createShipment(ctx: Context, next: () => Promise<void>) {
  const settings = ctx.vtex.settings as {
    carrierApi: {
      baseUrl: string
      apiKey: string
      timeoutMs?: number
    }
  }

  const timeoutMs = settings.carrierApi.timeoutMs ?? 3000

  const response = await ctx.clients.carrier.createShipment({
    baseUrl: settings.carrierApi.baseUrl,
    apiKey: settings.carrierApi.apiKey,
    timeoutMs,
    payload: ctx.state.shipmentPayload,
  })

  ctx.body = response
  await next()
}
```

Example: GraphQL query using `@settings`

```graphql
type ShippingStatus {
  orderId: ID!
  status: String!
}

type Query {
  shippingStatus(orderId: ID!): ShippingStatus
    @settings(type: "workspace")
}
```

```typescript
export const resolvers = {
  Query: {
    shippingStatus: async (_: unknown, args: { orderId: string }, ctx: Context) => {
      const settings = ctx.vtex.settings as {
        carrierApi: { baseUrl: string; apiKey: string }
      }

      return ctx.clients.carrier.getStatus({
        baseUrl: settings.carrierApi.baseUrl,
        apiKey: settings.carrierApi.apiKey,
        orderId: args.orderId,
      })
    },
  },
}
```

Minimum working checklist for service configuration apps:

- [ ] The service app declares the `configuration` builder in `manifest.json`.
- [ ] The service app defines a valid `configuration/schema.json`.
- [ ] The configuration app provides `<service-app>/configuration.json` with values compatible with the schema.
- [ ] Service routes or events that need configuration declare `settingsType: "workspace"`.
- [ ] When the flow depends on workspace app resolution, the service manifest evaluates whether `read-workspace-apps` is required.

Use this approach when configuration should be shared, versioned, and injected by VTEX IO runtime rather than fetched ad hoc by service code.

## Common failure modes

- Using app settings when the real need is a shared configuration contract across apps.
- Creating configuration apps without explicit schema files.
- Forgetting `settingsType` or `@settings` in the service that should receive configuration.
- Fetching configuration over HTTP even though it is already injected in `ctx.vtex.settings`.
- Treating configuration apps as general-purpose operational storage.

## Review checklist

- [ ] Is a configuration app really needed instead of plain `settingsSchema`?
- [ ] Could this case be solved with local app settings and `settingsSchema` instead of a separate configuration app?
- [ ] Does the service explicitly opt in to configuration resolution with `settingsType` or `@settings`?
- [ ] When configuration is injected through service routes or events, is `settingsType: "workspace"` declared where needed?
- [ ] Is the configuration contract defined through `configuration/schema.json` and matched by `configuration.json`?
- [ ] Does the service read configuration from `ctx.vtex.settings` instead of inventing extra fetches?
- [ ] If the flow depends on reading installed workspace apps or their configuration, was `read-workspace-apps` evaluated intentionally instead of added by default?
- [ ] Does the configuration schema stay closed and explicit enough for a shared contract?
- [ ] Is the configuration contract clearly separate from operational data storage?

## Reference

- [Developing service configuration apps](https://developers.vtex.com/docs/guides/vtex-io-documentation-developing-service-configuration-apps) - Official guide for service and configuration apps
- [Builders](https://developers.vtex.com/docs/guides/vtex-io-documentation-builders) - Overview of the `configuration` builder
- [Service](https://developers.vtex.com/docs/guides/vtex-io-documentation-service) - Service configuration context for node and GraphQL services
