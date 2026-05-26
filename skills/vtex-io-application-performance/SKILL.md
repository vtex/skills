---
name: vtex-io-application-performance
description: "Apply when improving VTEX IO Node or .NET services for latency, throughput, and resilience: in-process LRU, VBase, stale-while-revalidate, AppSettings loading, request context, parallel client calls, and avoiding duplicate work. Covers application-level performance patterns that complement edge/CDN caching. Use when optimizing backends beyond route-level Cache-Control."
---

# VTEX IO application performance

## When this skill applies

Use this skill when you optimize **VTEX IO** backends (typically **Node** with `@vtex/api` / Koa-style middleware, or **.NET** services) for **performance and resilience**: **caching**, **deduplicating** work, **parallel I/O**, and **efficient** configuration loading—not only “add a cache.”

- Adding an **in-memory LRU** (per pod) for hot keys
- Adding **VBase** persistence for **shared** cache across pods, optionally with **stale-while-revalidate** (return stale, refresh in background)
- Loading **AppSettings** (or similar) **once** at startup or on a TTL refresh vs **every request**
- **Parallelizing** independent client calls (`Promise.all`) instead of serial waterfalls
- Passing **`ctx.clients`** (e.g. `vbase`) into **client helpers** or resolvers so caches are **testable** and **explicit**

Do not use this skill for:

- Choosing **`/_v/private`** vs public **paths** or **`Cache-Control`** at the edge → **vtex-io-service-paths-and-cdn**
- GraphQL **`@cacheControl`** field semantics only → **vtex-io-graphql-api**

## Decision rules

- **Layer 1 — LRU (in-process)** — Fastest; **lost** on cold start and **not shared** across replicas. Use bounded size + TTL for **hot** keys (organization, cost center, small config slices).
- **Layer 2 — VBase** — **Shared** across pods; platform data is **partitioned** by **account** / **workspace** like other IO resources. Pair with **hash** or `trySaveIfhashMatches` when the client supports concurrency-safe updates (see [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients)).
- **Stale-while-revalidate** — On **VBase hit** with expired **freshness**, return **stale** immediately and **revalidate** asynchronously (fetch origin → write VBase + LRU). Reduces tail latency vs blocking on origin every time.
- **TTL-only** — Simpler: cache until TTL expires, then **blocking** fetch. Prefer when **staleness** is unacceptable or origin is cheap.
- **AppSettings** — If values are **account-wide** and **rarely change**, load **once** (or refresh on interval) and hold in **module memory**; if **workspace-dependent** or **must** reflect admin changes quickly, use **per-request** read or **short TTL** cache. Never cache **secrets** in logs or global state without guardrails.
- **Context** — Use **`ctx.state`** for **per-request** deduplication (e.g. “already loaded org for this request”). Use **global** module cache only for **immutable** or **TTL-refreshed** app data; **account** and **workspace** live on **`ctx.vtex`**—always include them in **in-memory** cache keys when the same pod serves **multiple** tenants.
- **Parallel requests** — When resolvers need **independent** upstream calls, run them **in parallel**; combine only when outputs depend on each other.
- **Timeouts on every outbound call** — Every `ctx.clients` call and external HTTP request **must** have an explicit **timeout**. Use `@vtex/api` client options (`timeout`, `retries`, `exponentialTimeoutCoefficient`) to tune per-client behavior. Unbounded waits are the top cause of cascading failures in distributed systems.
- **Graceful degradation** — When an upstream is slow or down, **fail open** where the business allows (return cached/default data, skip optional enrichment) rather than blocking the response. Consider **circuit breaker** patterns for chronically failing dependencies.
- **Be deliberate with transactional data caching** — **Payment responses** and **active transaction state** must **never** be cached. For other transactional data (**order forms**, **cart simulations**, **session state**), the default is no cache, but **short-lived** caches (TTL < 5 min) can be acceptable when the consumer tolerates brief staleness. Confirm the use case explicitly before caching—long TTLs on transactional data create stale prices, phantom inventory, or inconsistent state.
- **Resolver chain deduplication** — When a resolver chain calls the **same** client method **multiple times** (e.g. `getCostCenter` in the resolver and again inside a helper), **deduplicate**: call once, pass the result through, or stash in `ctx.state`. Serial waterfalls of 7+ calls that could be 3 parallel + 1 sequential are the top performance sink.
- **Phased `Promise.all`** — Group independent calls into **parallel phases**. Phase 1: `Promise.all([getOrderForm(), getCostCenter(), getSession()])`. Phase 2 (depends on Phase 1): `getSkuMetadata()`. Phase 3 (depends on Phase 2): `generatePrice()`. Never `await` six calls sequentially when only two depend on each other.
- **Batch mutations** — When setting multiple values (e.g. `setManualPrice` per cart item), use `Promise.all` instead of a sequential loop. Each `await` in a loop adds a full round-trip.

### VBase deep patterns

- **Per-entity keys, not blob keys** — Cache individual entities (e.g. `sku:{region}:{skuId}`) instead of composite blobs (e.g. `allSkus:{sortedCartSkuIds}`). Per-entity keys dramatically increase cache hit rates when items are added/removed.
- **Minimal DTOs** — Store only the fields the consumer needs (e.g. `{ skuId, mappedId, isSpecialItem }` at ~50 bytes) instead of the full API response (~10-50 KB per product). Reduces VBase storage, serialization time, and transfer size.
- **Sibling prewarming** — When a search API returns a product with 4 SKU variants, cache **all 4** individual SKUs even if only 1 was requested. The next request for a sibling is a VBase hit instead of an API call.
- **Pass `vbase` as a parameter** — Clients don't have direct access to other clients. Pass `ctx.clients.vbase` as a parameter to client methods or utilities that need it. This keeps code testable and explicit about dependencies.
- **VBase state machines** — For long-running operations (scans, imports, batch processing), use VBase as a state store with `current-operation.json` (lock + progress), heartbeat extensions, checkpoint/resume, and TTL-based lock expiry to prevent zombie locks.

### `service.json` tuning

- **`timeout`** — Maximum seconds before the platform kills a request. Set based on the longest expected operation; do not leave at the default if your resolver calls slow upstreams.
- **`memory`** — MB per worker. Increase if LRU caches or large payloads cause OOM; monitor actual usage before over-provisioning.
- **`workers`** — Concurrent request handlers per replica. More workers handle more concurrent requests but each shares the memory budget and in-process LRU.
- **`minReplicas` / `maxReplicas`** — Controls horizontal scaling under load. Note: **all pods scale to zero** when the app receives no requests for the duration of its `ttl` (max 60 minutes). `minReplicas` only governs the floor while traffic exists—it does **not** keep pods alive indefinitely. Design for cold starts: first request after idle spins up a new pod, so keep LRU warm-up cost low and avoid relying on in-memory state surviving idle periods.

### Tenancy and in-memory caches

Pods **can** be shared across accounts, but **every request is always scoped** to a specific **`{account, workspace}`** by the platform—`ctx.vtex.account` and `ctx.vtex.workspace` are set by the runtime, not by the developer. All platform APIs (**VBase**, app buckets, Master Data, etc.) **automatically partition data** by account/workspace, so their responses are tenant-safe by design. The **only** risk is **in-process** state: LRU caches, module-level `Map`s, or global variables that **you** manage—these are **not** partitioned by the platform and must be **keyed** explicitly with **`ctx.vtex.account`** and **`ctx.vtex.workspace`** (plus entity id) so **two** consecutive requests for **different** accounts on the **same pod** cannot read each other’s entries.

## Hard constraints

### Constraint: Do not store sensitive or tenant-specific data in module-level caches without tenant keys

**Global** or **module-level** maps must **not** store **PII**, **tokens**, or **authorization-sensitive** blobs keyed only by **user id** or **email** without **`account` and `workspace`** (and any other dimension needed for isolation).

**Why this matters** — Pods are **multi-tenant**: the same process may serve **many** accounts in sequence. **VBase** and similar APIs are **scoped** to the current account/workspace, but an **in-memory** `Map` is **your** responsibility. Missing **`account`/`workspace`** in the key risks **cross-tenant** reads from warm cache.

**Detection** — A module-scope `Map` keyed only by `userId` or `email`; or cache keys that **omit** `ctx.vtex.account` / `ctx.vtex.workspace` when the value is **tenant-specific**.

**Correct** — Build keys from **`ctx.vtex.account`**, **`ctx.vtex.workspace`**, and the entity id; **never** store **app tokens** in VBase/LRU as plain cache values; **prefer** `ctx.clients` and **platform** auth.

```typescript
// Pseudocode: in-memory key must mirror tenant scope (same pod, many accounts)
function cacheKey(ctx: Context, subjectId: string) {
  return `${ctx.vtex.account}:${ctx.vtex.workspace}:${subjectId}`;
}
```

**Wrong** — `globalUserCache.set(email, profile)` keyed **only** by **email**, with **no** `account`/`workspace` segment—**unsafe** on shared pods even though a later **VBase** read would be **account-scoped**, because **this** map is not partitioned by the platform.

### Constraint: Do not use fire-and-forget VBase writes in financial or idempotency-critical paths

When VBase serves as an **idempotency store** (e.g. payment connectors storing transaction state) or a **data-integrity store**, writes **must** be **awaited**. Fire-and-forget writes risk silent failure: a successful upstream operation (e.g. a charge) whose VBase record is lost causes a **duplicate** on the next retry.

For **payment connectors**, the first line of defense is the **acquirer/gateway idempotency feature**: pass the **VTEX `paymentId`** as the idempotency key to the external payment provider (e.g. via an `Idempotency-Key` HTTP header). This ensures the provider itself rejects duplicate charges even if VBase state is lost. VBase remains essential for local state tracking and for returning the correct response to VTEX Gateway retries, but the external idempotency key prevents the worst outcome (double charge) at the provider level.

**Why this matters** — VTEX Gateway **retries** payment calls with the same `paymentId`. If VBase write fails silently after a successful authorization and the acquirer has no idempotency key, the connector sends **another** payment request—causing a **duplicate charge**. With the acquirer idempotency key in place, the provider rejects the duplicate; without it, VBase is the only safeguard.

**Detection** — A VBase `saveJSON` or `saveOrUpdate` call **without** `await` in a payment, settlement, refund, or any flow where the stored value is the **only** record preventing re-execution. Also check whether the external payment call includes an idempotency key header.

**Correct** — Use acquirer idempotency key **and** await VBase writes.

```typescript
const { paymentId } = authorization

// Pass VTEX paymentId as idempotency key to the acquirer
const response = await ctx.clients.paymentProvider.authorize(paymentData, {
  headers: { 'Idempotency-Key': paymentId },
})

// Await VBase write for local state tracking
await ctx.clients.vbase.saveJSON<Transaction>('transactions', paymentId, transactionData)
return Authorizations.approve(authorization, { ... })
```

**Wrong** — No acquirer idempotency key and fire-and-forget VBase write.

```typescript
const { paymentId } = authorization
// No idempotency key to the acquirer + no await on VBase
const response = await ctx.clients.paymentProvider.authorize(paymentData)
ctx.clients.vbase.saveJSON('transactions', paymentId, transactionData)
return Authorizations.approve(authorization, { ... })
```

### Constraint: Be deliberate when caching transactional or near-real-time data

**Payment statuses** and **active transaction state** must **never** be cached—they are strictly real-time. For other transactional data like **order forms**, **cart simulations**, and **session state**, the default is **no cache**, but **short-lived caches** (e.g. 1–5 minutes) can be acceptable when the use case tolerates brief staleness. This is a **case-by-case** decision: explicitly confirm that the consumer can handle stale data for the chosen TTL before caching.

**Why this matters** — Serving a cached order form may show phantom items or stale prices. Caching payment responses could return a previous transaction's status. However, for read-heavy scenarios where the same data is requested repeatedly within seconds (e.g. a product listing page fetching simulation data for multiple components), a short-lived cache can dramatically reduce load on upstream APIs without meaningful user impact.

**Detection** — LRU or VBase keys like `orderForm:{id}`, `cartSim:{hash}`, `paymentResponse:{id}`, or `session:{token}` used for read-through caching **without** an explicit TTL decision or justification. Long TTLs (>5 min) on transactional data are almost always wrong. Any cache on payment responses or active transaction state is wrong.

**Correct** — Separate reference data (always cache) from transactional data (default no cache, short TTL only with explicit justification).

```typescript
// Reference data: cached (changes rarely)
const costCenter = await getCostCenterCached(ctx, costCenterId);
const sellerList = await getSellerListCached(ctx);

// Transactional data: default live, but short cache is acceptable if justified
const orderForm = await ctx.clients.checkout.orderForm();
const simulation = await ctx.clients.checkout.simulation(payload);

// Acceptable: short-lived cache for a read-heavy page (e.g. simulation results
// reused across multiple components within the same page render, TTL < 60s)
// Only after confirming staleness is acceptable for this specific consumer.
```

**Wrong** — Long-lived cache on transactional data, or any cache on payment state.

```typescript
// Never cache payment responses or transaction status
const paymentCache = lru({ max: 1000, ttl: 300_000 });

// Avoid: long TTL on order form without explicit justification
const orderFormCache = lru({ max: 500, ttl: 600_000 }); // 10 min is too long
```

### Constraint: Do not block the purchase path on slow or unbounded cache refresh

**Stale-while-revalidate** or **origin** calls **must not** add **unbounded** latency to **checkout-critical** middleware if the platform SLA requires a fast response.

**Why this matters** — Blocking checkout on **optional** enrichment breaks **conversion** and **reliability**.

**Detection** — A **cart** or **payment** resolver **awaits** VBase refresh or **external** API before returning; **no** timeout or **fallback**.

**Correct** — Return **stale** or **default**; **enqueue** refresh; **fail open** where business rules allow.

**Wrong** — `await fetchHeavyPartner()` in the **hot path** with **no** timeout.

## Preferred pattern

1. **Classify** data: **reference data** (org, cost center, config, seller lists → cacheable) vs **transactional data** (order form, cart sim, payment → never cache) vs **user-private** (never in shared cache without encryption and keying).
2. **Choose** LRU only, VBase only, or **LRU → VBase → origin** (two-layer) for **read-heavy** reference data.
3. **Deduplicate** within a request: set **`ctx.state`** flags when a **resolver** chain might call the same loader twice.
4. **Parallelize** independent **`ctx.clients`** calls in **phased** `Promise.all` groups.
5. **Per-entity VBase keys** with minimal DTOs for high-cardinality data (SKUs, users, org records).
6. **Document** TTLs and **invalidation** (who writes, when refresh runs).

### Resolver chain optimization (before/after)

```typescript
// BEFORE: 7 sequential awaits, 2 duplicate calls
const settings = await getAppSettings(ctx); // 1
const session = await getSessions(ctx); // 2
const costCenter = await getCostCenter(ctx, ccId); // 3
const orderForm = await getOrderForm(ctx); // 4
const skus = await getSkuById(ctx, skuIds); // 5
const price = await generatePrice(ctx, costCenter); // 6 (calls getCostCenter AGAIN + getSession AGAIN)
for (const item of items) {
  await setManualPrice(ctx, item); // 7, 8, 9... (sequential loop)
}

// AFTER: 3 phases, no duplicates, parallel mutations
const settings = await getAppSettings(ctx);
const [session, costCenter, orderForm] = await Promise.all([
  getSessions(ctx),
  getCostCenter(ctx, ccId),
  getOrderForm(ctx),
]);
const skus = await getSkuMetadataBatch(ctx, skuIds); // per-entity VBase cache
const price = await generatePrice(ctx, costCenter, session); // reuse, no re-fetch
await Promise.all(items.map((item) => setManualPrice(ctx, item)));
```

### Per-entity VBase caching

```typescript
interface SkuMetadata {
  skuId: string;
  mappedSku: string | null;
  isSpecialItem: boolean;
}

async function getSkuMetadataBatch(
  ctx: Context,
  skuIds: string[],
): Promise<Map<string, SkuMetadata>> {
  const { vbase, search } = ctx.clients;
  const results = new Map<string, SkuMetadata>();

  // Phase 1: check VBase for each SKU in parallel
  const lookups = await Promise.allSettled(
    skuIds.map((id) => vbase.getJSON<SkuMetadata>("sku-metadata", `sku:${id}`)),
  );

  const missing: string[] = [];
  lookups.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value) {
      results.set(skuIds[i], result.value);
    } else {
      missing.push(skuIds[i]);
    }
  });

  if (missing.length === 0) return results;

  // Phase 2: fetch only missing SKUs from API
  const products = await search.getSkuById(missing);

  // Phase 3: cache ALL sibling SKUs (prewarm)
  for (const product of products) {
    for (const sku of product.items) {
      const metadata: SkuMetadata = {
        skuId: sku.itemId,
        mappedSku: extractMapping(sku),
        isSpecialItem: checkSpecial(sku),
      };
      results.set(sku.itemId, metadata);
      // Fire-and-forget for prewarming (not idempotency-critical)
      vbase
        .saveJSON("sku-metadata", `sku:${sku.itemId}`, metadata)
        .catch(() => {});
    }
  }

  return results;
}
```

## Common failure modes

- **LRU unbounded** — Memory grows without **max** entries; pod **OOM**.
- **VBase without LRU** — Every request hits **VBase** for **hot** keys; **latency** and **cost** rise.
- **In-memory cache without tenant in key** — Same pod serves account A then B; **stale** or **wrong** row returned from module cache.
- **Serial awaits** — Three **independent** Janus calls **awaited** one after another; total latency = sum of all instead of max.
- **Duplicate calls in resolver chains** — `getCostCenter` called in the resolver and again inside a helper; `getSession` called twice in the same flow. Each duplicate adds a full round-trip.
- **Blob VBase keys** — Keying VBase by `sortedCartSkuIds` means adding 1 item to a cart of 10 requires a full re-fetch instead of 1 lookup.
- **Long-lived cache on transactional data** — Order forms or cart simulations cached with long TTLs without explicit justification; payment responses or transaction state cached at all.
- **Fire-and-forget writes in critical paths** — Unawaited VBase writes for idempotency stores; silent failure causes duplicates on retry.
- **No explicit timeouts** — Relying on default or infinite timeouts for upstream calls; one slow dependency stalls the whole request chain.
- **Global mutable singletons** — Module-level mutable objects (e.g. token cache metadata) modified by concurrent requests cause race conditions and incorrect behavior.
- **Treating AppSettings as real-time** — **Stale** admin change until **TTL** expires; **no** notification path.
- **`console.log` in hot paths** — Logging full response objects with template literals produces `[object Object]`; use `ctx.vtex.logger` with `JSON.stringify` and redact sensitive data.

## Review checklist

- [ ] Are **in-memory** cache keys built with **`account` + `workspace`** (and entity id) when values are tenant-specific?
- [ ] Is **LRU** bounded (max entries) and **TTL** defined?
- [ ] For **VBase**, is **stale-while-revalidate** or **TTL-only** behavior **explicit**?
- [ ] Are **independent** upstream calls **parallelized** (`Promise.all` phases) where safe?
- [ ] Are there **no duplicate calls** to the same client method within a resolver chain?
- [ ] Is **AppSettings** (or similar) **loaded** at the right **frequency** (once vs per request)?
- [ ] Is **checkout** or **payment** path **free** of **blocking** optional refreshes?
- [ ] Does every outbound call have an explicit **timeout** (via `@vtex/api` client options or equivalent)?
- [ ] For unreliable upstreams, is there a **degradation** path (cached fallback, skip, circuit breaker)?
- [ ] Are VBase writes **awaited** in financial or idempotency-critical paths?
- [ ] Is **payment/transaction state** always fetched live? For other transactional data (order form, cart sim), is any cache **short-lived** with explicit justification?
- [ ] Are VBase keys **per-entity** (not blob) for high-cardinality data like SKUs?
- [ ] Are `service.json` resource limits (`timeout`, `memory`, `workers`, `replicas`) tuned for the workload?
- [ ] Is logging done via `ctx.vtex.logger` (not `console.log`) with sensitive data redacted?

## Related skills

- [vtex-io-service-paths-and-cdn](../vtex-io-service-paths-and-cdn/SKILL.md) — Edge paths, cookies, CDN
- [vtex-io-session-apps](../vtex-io-session-apps/SKILL.md) — Session transforms (caching patterns apply inside transforms)
- [vtex-io-service-apps](../vtex-io-service-apps/SKILL.md) — Clients, middleware, Service
- [vtex-io-graphql-api](../vtex-io-graphql-api/SKILL.md) — GraphQL caching
- [vtex-io-app-contract](../vtex-io-app-contract/SKILL.md) — Manifest, policies

## Reference

- [VTEX IO Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — `vbase` client methods
- [Implementing cache in GraphQL APIs for IO apps](https://developers.vtex.com/docs/guides/implementing-cache-in-graphql-apis-for-io-apps) — SEGMENT cache and cookies
- [Engineering guidelines](https://developers.vtex.com/docs/guides/vtex-io-documentation-engineering-guidelines) — Scalability and IO development practices
- [App Development](https://developers.vtex.com/docs/app-development) — VTEX IO app development hub
