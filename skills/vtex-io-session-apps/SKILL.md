---
name: vtex-io-session-apps
description: "Apply when building or debugging a VTEX IO session transform app (vtex.session integration). Covers namespace ownership, input-vs-output fields, transform ordering (DAG), public-as-input vs private-as-read model, cross-namespace propagation, configuration.json contracts, caching inside transforms, and frontend session consumption. Use when designing session-derived state for B2B, pricing, regionalization, or custom storefront context."
---

# VTEX IO session transform apps

## When this skill applies

Use this skill when your VTEX IO app integrates with the **VTEX session system** (`vtex.session`) to **derive**, **compute**, or **propagate** state that downstream transforms, the storefront, or checkout depend on.

- Building a **session transform** that computes custom fields from upstream session state (e.g. pricing context from an external backend, regionalization from org data)
- Declaring **input/output** fields in `vtex.session/configuration.json`
- Deciding which **namespace** your app should own and which it should **read from**
- Propagating values into **`public.*`** inputs so **native** transforms (profile, search, checkout) re-run
- Debugging **stale** session fields, **race conditions**, or **namespace collisions** between apps
- Designing **B2B** session flows where `storefront-permissions`, custom transforms, and checkout interact

Do not use this skill for:

- General IO backend patterns (use `vtex-io-service-apps`)
- Performance patterns outside session transforms (use `vtex-io-application-performance`)
- GraphQL schema or resolver design (use `vtex-io-graphql-api`)

## Decision rules

### Namespace ownership

- **Every session app owns exactly one output namespace** (or a small set of fields within one). The namespace name typically matches the app concept (e.g. `rona`, `myapp`, `storefront-permissions`).
- **Never write to another app's output namespace.** If `storefront-permissions` owns `storefront-permissions.organization`, your transform must **not** overwrite it—read it as an input instead.
- **Never duplicate** VTEX-owned fields (org, cost center, postal, country) into your namespace when they already exist in `storefront-permissions`, `profile`, `checkout`, or `store`. Your namespace should contain **only** data that comes from **your** backend or computation.

### `public` is input, private is read model

- **`public.*`** fields are an **input surface**: values the shopper or a flow sets so session transforms can run (e.g. geolocation, flags, UTMs, user intent). Do **not** treat `public.*` as the canonical read model in storefront code.
- **Private namespaces** (`profile`, `checkout`, `store`, `search`, `storefront-permissions`, your custom namespace) are the **read model**: computed outputs derived from inputs. Frontend components should read **private** namespace fields for business rules and display.
- If your transform must influence native apps (e.g. set a postal code derived from a cost center address), **update `public.*` input fields** that native apps declare as inputs—so the platform re-runs those upstream transforms and private outputs stay consistent. This is **input propagation**, not duplicating truth.

### Transform ordering (DAG)

- VTEX session runs transforms in a **directed acyclic graph** (DAG) based on declared input/output dependencies in each app's `vtex.session/configuration.json`.
- A transform runs when any of its **declared input fields** change. If you depend on `storefront-permissions.costcenter`, your transform runs **after** `storefront-permissions` outputs that field.
- **Order your dependencies carefully**: if your transform needs both `storefront-permissions` outputs and `profile` outputs, declare both as inputs so the platform schedules you after both.

### Caching inside transforms

- Session transforms execute on **every session change** that touches a declared input. They must be **fast**.
- Use **LRU** (in-process, per-worker) for hot lookups (org data, configuration, tokens) with short TTLs.
- Use **VBase stale-while-revalidate** for data that can tolerate brief staleness (external backend responses, computed mappings). Return stale immediately; revalidate in the background.
- Follow the same tenant-keying rules as any IO service: in-memory cache keys must include **`account`** and **`workspace`** (see `vtex-io-application-performance`).

### Frontend session consumption

- Storefront components should **request specific session items** via the `items=` query parameter (e.g. `items=rona.storeNumber,storefront-permissions.costcenter`).
- **Read** from the relevant **private** namespaces (`rona.*`, `storefront-permissions.*`, `profile.*`, etc.) for canonical state.
- **Write** to `public.*` only when setting **user intent** (e.g. selecting a location, switching a flag). Never write to `public.*` as a "cache" for values that private namespaces already provide.

## Hard constraints

### Constraint: Do not duplicate another app's output namespace fields into your namespace

Your session transform must output **only** fields that come from **your** computation or backend. Copying identity, address, or org fields that `storefront-permissions`, `profile`, or `checkout` already own creates **two sources of truth** that diverge on partial failures.

**Why this matters** — When two namespaces contain the same fact (e.g. `costCenterId` in both your namespace and `storefront-permissions`), consumers read inconsistent values after a session that partially updated. Debug time skyrockets and race conditions appear.

**Detection** — Your transform's output includes fields like `organization`, `costcenter`, `postalCode`, `country` that mirror `storefront-permissions.*` or `profile.*` outputs. Or frontend reads the same logical field from two different namespaces.

**Correct** — Read `storefront-permissions.costcenter` as an input; use it to compute your backend-specific fields (e.g. `myapp.priceTable`, `myapp.storeNumber`); output **only** those derived fields.

```json
{
  "my-session-app": {
    "input": {
      "storefront-permissions": ["costcenter", "organization"]
    },
    "output": {
      "myapp": ["priceTable", "storeNumber"]
    }
  }
}
```

**Wrong** — Output duplicates of VTEX-owned fields.

```json
{
  "my-session-app": {
    "output": {
      "myapp": [
        "costcenter",
        "organization",
        "postalCode",
        "priceTable",
        "storeNumber"
      ]
    }
  }
}
```

### Constraint: Use input propagation to influence native transforms, not direct overwrites

When your transform derives a value (e.g. postal code from a cost center address) that native apps consume, set it as an **input** field those apps declare (typically `public.postalCode`, `public.country`)—**not** by writing directly to `checkout.postalCode` or `search.postalCode`.

**Why this matters** — Native transforms expect their **input** fields to change so they can recompute their **output** fields. Writing directly to their output namespaces bypasses recomputation and leaves stale derived state (e.g. `regionId` not updated, checkout address inconsistent).

**Detection** — Your transform declares output fields in namespaces owned by other apps (e.g. `output: { checkout: [...] }` or `output: { search: [...] }`). Or you PATCH session with values in a namespace you don't own.

**Correct** — Declare output in `public` for fields that native apps consume as inputs, verified against each native app's `vtex.session/configuration.json`.

```json
{
  "my-session-app": {
    "output": {
      "myapp": ["storeNumber", "priceTable"],
      "public": ["postalCode", "country", "state"]
    }
  }
}
```

**Wrong** — Writing to search or checkout output namespaces directly.

```json
{
  "my-session-app": {
    "output": {
      "myapp": ["storeNumber", "priceTable"],
      "checkout": ["postalCode", "country"],
      "search": ["facets"]
    }
  }
}
```

### Constraint: Frontend must read private namespaces, not `public`, for canonical business state

Storefront components and middleware must read session data from the **authoritative private namespace** (e.g. `storefront-permissions.organization`, `profile.email`, `myapp.priceTable`), not from `public.*` fields.

**Why this matters** — `public.*` fields are inputs that may be stale, user-set, or partial. Private namespace fields are the **computed** truth after all transforms have run. Reading `public.postalCode` instead of the profile- or checkout-derived value leads to displaying stale or inconsistent data.

**Detection** — React components or middleware that read `public.storeNumber`, `public.organization`, or `public.costCenter` for display or business logic instead of the corresponding private field.

**Correct**

```typescript
// Read from the authoritative namespace
const { data } = useSessionItems([
  "myapp.storeNumber",
  "myapp.priceTable",
  "storefront-permissions.costcenter",
  "storefront-permissions.organization",
]);
```

**Wrong**

```typescript
// Reading from public as if it were the source of truth
const { data } = useSessionItems([
  "public.storeNumber",
  "public.organization",
  "public.costCenter",
]);
```

## Preferred pattern

### `vtex.session/configuration.json`

Declare your transform's input dependencies and output fields:

```json
{
  "my-session-app": {
    "input": {
      "storefront-permissions": [
        "costcenter",
        "organization",
        "costCenterAddressId"
      ]
    },
    "output": {
      "myapp": ["storeNumber", "priceTable"]
    }
  }
}
```

### Transform handler

```typescript
// node/handlers/transform.ts
export async function transform(ctx: Context) {
  const { costcenter, organization } = parseSfpInputs(ctx.request.body);

  if (!costcenter) {
    ctx.body = { myapp: {} };
    return;
  }

  const costCenterData = await getCostCenterCached(ctx, costcenter);
  const pricing = await resolvePricing(ctx, costCenterData);

  ctx.body = {
    myapp: {
      storeNumber: pricing.storeNumber,
      priceTable: pricing.priceTable,
    },
  };
}
```

### Caching inside the transform

```typescript
// Two-layer cache: LRU (sub-ms) -> VBase (persistent, SWR) -> API
const costCenterLRU = new LRU<string, CostCenterData>({
  max: 1000,
  ttl: 600_000,
});

async function getCostCenterCached(ctx: Context, costCenterId: string) {
  const { account, workspace } = ctx.vtex;
  const key = `${account}:${workspace}:${costCenterId}`;

  const lruHit = costCenterLRU.get(key);
  if (lruHit) return lruHit;

  const result = await staleFromVBaseWhileRevalidate(
    ctx.clients.vbase,
    "cost-centers",
    costCenterId,
    () => fetchCostCenterFromAPI(ctx, costCenterId),
    { ttlMs: 1_800_000 },
  );

  costCenterLRU.set(key, result);
  return result;
}
```

### `service.json` route

```json
{
  "routes": {
    "transform": {
      "path": "/_v/my-session-app/session/transform",
      "public": true
    }
  }
}
```

### Session ecosystem awareness

When building a transform, map out the transform DAG for your store:

```text
authentication-session → impersonate-session → profile-session
profile-session → store-session → checkout-session
profile-session → search-session
authentication-session + checkout-session + impersonate-session → storefront-permissions
storefront-permissions → YOUR-TRANSFORM (reads SFP outputs)
```

Your transform sits at the **end** of whatever dependency chain it requires. Declaring inputs correctly ensures the platform schedules you **after** all upstream transforms.

## Common failure modes

- **Frontend writes B2B state via `updateSession`** — Instead of letting `storefront-permissions` + your transform compute B2B session fields, the frontend PATCHes them directly. This creates race conditions, partial state, and duplicated sources of truth.
- **Duplicating VTEX-owned fields** — Copying `costcenter`, `organization`, or `postalCode` into your namespace when they already live in `storefront-permissions` or `profile`.
- **Slow transforms without caching** — Calling external APIs on every transform invocation without LRU + VBase SWR. Transforms run on every session change that touches a declared input; they must be fast.
- **Reading `public.*` as source of truth** — Frontend components reading `public.organization` or `public.storeNumber` instead of the private namespace field, leading to stale or inconsistent display.
- **Writing to other apps' output namespaces** — Declaring output fields in `checkout`, `search`, or `storefront-permissions` namespaces you don't own, bypassing native transform recomputation.
- **Missing tenant keys in LRU** — In-memory cache for org or pricing data keyed only by entity ID without `account:workspace`, unsafe on multi-tenant shared pods.

## Review checklist

- [ ] Does the transform output **only** fields from its own computation/backend, not duplicates of other namespaces?
- [ ] Are **input** dependencies declared correctly in `vtex.session/configuration.json`?
- [ ] Are **output** fields limited to your own namespace (plus `public.*` inputs when propagation is needed)?
- [ ] Is `public.*` used **only** for input propagation, not as a second read model?
- [ ] Do frontend components read from **private** namespaces, not `public.*`, for business state?
- [ ] Are upstream API calls in the transform **cached** (LRU + VBase SWR) to keep transform latency low?
- [ ] Are in-memory cache keys scoped with `account:workspace` for multi-tenant safety?
- [ ] Is the transform order (DAG) correct—does it run after all its dependency transforms?
- [ ] Has `updateSession` been removed from frontend code for fields the transform computes?

## Related skills

- [vtex-io-application-performance](../vtex-io-application-performance/SKILL.md) — Caching layers and parallel I/O applicable inside transforms
- [vtex-io-service-paths-and-cdn](../vtex-io-service-paths-and-cdn/SKILL.md) — Route prefix for the transform endpoint
- [vtex-io-service-apps](../vtex-io-service-apps/SKILL.md) — Service class, clients, and middleware basics
- [vtex-io-app-contract](../vtex-io-app-contract/SKILL.md) — Manifest, builders, policies

## Reference

- [VTEX Session System](https://developers.vtex.com/docs/guides/vtex-io-documentation-using-the-session-manager) — Session manager overview and API
- [App Development](https://developers.vtex.com/docs/app-development) — VTEX IO app development hub
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — VBase, MasterData, and custom clients
- [Engineering Guidelines](https://developers.vtex.com/docs/guides/vtex-io-documentation-engineering-guidelines) — Scalability and IO development practices
