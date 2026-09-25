This skill provides guidance for AI agents working with VTEX Custom VTEX IO Apps. Apply these constraints and patterns when assisting developers with apply when choosing which VTEX IO authentication token should back a request from a backend app. Covers `ctx.authToken`, `ctx.storeUserAuthToken`, `ctx.adminUserAuthToken`, `authMethod`, and how requester context should determine the identity used by VTEX clients. Use for deciding which identity talks to VTEX endpoints in storefront-backed requests, Admin actions, or app-level integrations that should avoid hardcoded VTEX credentials.

# Auth Tokens & Request Context

## When this skill applies

Use this skill when the main decision is which VTEX IO identity should authenticate a backend request to VTEX services.

- Choosing between `ctx.authToken`, `ctx.storeUserAuthToken`, and `ctx.adminUserAuthToken`
- Deciding whether a VTEX client call should use `AUTH_TOKEN`, `STORE_TOKEN`, or `ADMIN_TOKEN`
- Reviewing storefront and Admin integrations that should respect the current user identity
- Replacing hardcoded `appKey` and `appToken` usage inside a VTEX IO app

Do not use this skill for:
- deciding which policies belong in `manifest.json`
- modeling route-level authorization or resource-based policies
- choosing between `ExternalClient`, `JanusClient`, and other client abstractions
- browser-side login or session UX flows
- validating route input or deciding what data may cross the app boundary

## Decision rules

- Use this skill to decide which identity talks to VTEX endpoints, not what that identity is authorized to do.
- Use `AUTH_TOKEN` with `ctx.authToken` only for app-level operations that are not tied to a current shopper or Admin user.
- Use `STORE_TOKEN` with `ctx.storeUserAuthToken` whenever the action comes from storefront browsing or a shopper-triggered flow and the integration should respect shopper permissions.
- Use `ADMIN_TOKEN` with `ctx.adminUserAuthToken` whenever the action comes from an Admin interface and the integration should respect the logged-in Admin user's License Manager permissions.
- Prefer user tokens whenever they are available. The official guidance is to avoid app-token authentication when a store or Admin user token can represent the requester more accurately.
- If the corresponding user token is not present, fall back to `AUTH_TOKEN` only when the operation is truly app-scoped and does not depend on a current shopper or Admin identity.
- When using VTEX IO clients that accept `authMethod`, pass the token choice explicitly when the default app identity is not the right one for the request.
- When wrapping custom VTEX clients, propagate the matching auth token from `IOContext` at the client boundary instead of hardcoding credentials in handlers.
- Keep token choice aligned with the user journey: storefront flows should not silently escalate to app-level permissions, and Admin flows should not bypass the current Admin role context.
- `ADMIN_TOKEN` with `ctx.adminUserAuthToken` must remain server-side only and must never be exposed or proxied to browser clients.
- Treat token choice and policy design as separate concerns: this skill decides which identity is making the call, while auth-and-policies decides what that identity is allowed to do.
- Do not use `appKey` and `appToken` inside a VTEX IO app unless there is a documented exception outside the normal VTEX IO auth-token model.
- Never log raw tokens or return them in responses. Tokens are request secrets, and downstream callers should receive only business data.

Token selection at a glance:

| Token | Context field | Use when | Avoid when |
|---|---|---|---|
| `AUTH_TOKEN` | `ctx.authToken` | app-level jobs, service-to-service work, or operations not linked to a current user | a shopper or Admin user is already driving the action |
| `STORE_TOKEN` | `ctx.storeUserAuthToken` | storefront and shopper-triggered operations | backend jobs or Admin-only operations |
| `ADMIN_TOKEN` | `ctx.adminUserAuthToken` | Admin requests that must respect the current user's LM role | storefront flows or background app tasks |

## Hard constraints

### Constraint: User-driven requests must prefer user tokens over the app token

If a request is initiated by a current shopper or Admin user, the VTEX integration MUST use the corresponding user token instead of defaulting to the app token.

**Why this matters**

Using the app token for user-driven work widens permissions unnecessarily and disconnects the request from the real user context that should govern access.

**Detection**

If the code runs in a storefront or Admin request path and still uses `ctx.authToken` or implicit app-token behavior, STOP and verify whether `ctx.storeUserAuthToken` or `ctx.adminUserAuthToken` should be used instead.

**Correct**

```typescript
export class OmsClient extends JanusClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, {
      ...options,
      headers: {
        ...options?.headers,
        VtexIdclientAutCookie: ctx.storeUserAuthToken,
      },
    })
  }
}
```

**Wrong**

```typescript
export class OmsClient extends JanusClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, {
      ...options,
      headers: {
        ...options?.headers,
        VtexIdclientAutCookie: ctx.authToken,
      },
    })
  }
}
```

### Constraint: App tokens must be reserved for app-level operations that are not tied to a user

Use `ctx.authToken` only when the request is genuinely app-scoped and no current shopper or Admin identity should govern the action.

**Why this matters**

The app token carries the permissions declared in the app manifest. Using it for user-triggered actions can bypass the narrower shopper or Admin permission model that the platform expects.

**Detection**

If a request originates from an Admin page, storefront interaction, or another user-facing workflow, STOP before using `ctx.authToken` and confirm that the action is truly app-level rather than user-scoped.

**Correct**

```typescript
export class RatesAndBenefitsClient extends JanusClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, {
      ...options,
      headers: {
        ...options?.headers,
        VtexIdclientAutCookie: ctx.authToken,
      },
    })
  }
}
```

**Wrong**

```typescript
export class AdminOrdersClient extends JanusClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, {
      ...options,
      headers: {
        ...options?.headers,
        VtexIdclientAutCookie: ctx.authToken,
      },
    })
  }
}
```

This is wrong when the client is used from an Admin flow that should respect the logged-in user's role.

### Constraint: VTEX IO apps must not hardcode VTEX API credentials when auth tokens are available

A VTEX IO app MUST use tokens from `IOContext` or `authMethod` instead of embedding `appKey`, `appToken`, or static VTEX credentials in source code or routine runtime configuration.

**Why this matters**

Hardcoded VTEX credentials are harder to rotate, easier to leak, and bypass the request-context model that VTEX IO clients already support.

**Detection**

If you see `X-VTEX-API-AppKey`, `X-VTEX-API-AppToken`, raw VTEX API credentials, or environment variables carrying permanent VTEX credentials inside a normal IO app integration, STOP and replace them with the correct auth-token flow unless there is a documented exception.

**Correct**

```typescript
await ctx.clients.catalog.getSkuById(id, {
  authMethod: 'ADMIN_TOKEN',
})
```

**Wrong**

```typescript
await fetch(`https://${ctx.vtex.account}.myvtex.com/api/catalog/pvt/stockkeepingunit/${id}`, {
  headers: {
    'X-VTEX-API-AppKey': process.env.VTEX_APP_KEY!,
    'X-VTEX-API-AppToken': process.env.VTEX_APP_TOKEN!,
  },
})
```

## Preferred pattern

Start from the requester context, choose the token identity that matches that requester, and keep the token propagation inside the client layer.

Minimal selection guide:

```text
storefront request -> STORE_TOKEN / ctx.storeUserAuthToken
admin request -> ADMIN_TOKEN / ctx.adminUserAuthToken
background app work -> AUTH_TOKEN / ctx.authToken
```

Pass the token explicitly when the client supports `authMethod`:

```typescript
await ctx.clients.orders.listOrders({
  authMethod: 'ADMIN_TOKEN',
})
```

```typescript
await ctx.clients.orders.listOrders({
  authMethod: 'STORE_TOKEN',
})
```

Or inject the matching token in a custom VTEX client:

```typescript
import type { IOContext, InstanceOptions } from '@vtex/api'
import { JanusClient } from '@vtex/api'

export class OmsClient extends JanusClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, {
      ...options,
      headers: {
        ...options?.headers,
        VtexIdclientAutCookie: ctx.adminUserAuthToken,
      },
    })
  }
}
```

Keep the decision close to the request boundary, then let downstream handlers and services depend on the correctly configured client rather than choosing tokens ad hoc in many places.

## Common failure modes

- Defaulting every VTEX request to `ctx.authToken`, even when a shopper or Admin user initiated the action.
- Using `ctx.authToken` in Admin pages and accidentally bypassing the current Admin user's License Manager role context.
- Using `ctx.authToken` in storefront flows that should be limited by shopper permissions.
- Hardcoding `appKey` and `appToken` in an IO app instead of using auth tokens from `IOContext`.
- Choosing the right token in one client method but forgetting to apply the same identity consistently across related calls.
- Mixing token choice with policy modeling and treating them as the same decision.
- Logging `ctx.authToken`, `ctx.storeUserAuthToken`, or `ctx.adminUserAuthToken` in plain text, or forwarding raw tokens to downstream services that do not need them.

## Review checklist

- [ ] Does each VTEX integration use the correct requester identity: shopper, Admin user, or app?
- [ ] Are `ctx.storeUserAuthToken` and `ctx.adminUserAuthToken` preferred when a user is actually driving the action?
- [ ] Is `ctx.authToken` used only for app-level operations that are not tied to a current user?
- [ ] Are hardcoded VTEX credentials absent from normal IO app integrations?
- [ ] Is token propagation centralized in the client layer or explicit `authMethod` usage rather than scattered across handlers?

## Related skills

- [`vtex-io-auth-and-policies`](../vtex-io-auth-and-policies/skill.md) - Use when the main choice is which permissions and policies the chosen identity should carry

## Reference

- [App authentication using auth tokens](https://developers.vtex.com/docs/guides/app-authentication-using-auth-tokens) - Official token model for `AUTH_TOKEN`, `STORE_TOKEN`, and `ADMIN_TOKEN`
- [Using VTEX IO clients](https://developers.vtex.com/docs/guides/calling-commerce-apis-3-using-vtex-io-clients) - Client usage patterns that complement token selection
- [Policies](https://developers.vtex.com/docs/guides/vtex-io-documentation-policies) - How app-token permissions relate to manifest-declared policies
