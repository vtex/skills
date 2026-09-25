This skill provides guidance for AI agents working with VTEX Custom VTEX IO Apps. Apply these constraints and patterns when assisting developers with apply when designing or implementing asynchronous processing in VTEX IO services through events, workers, and background handlers. Covers event handler structure, idempotency, retry-safe processing, and moving expensive work out of request-response routes. Use for event-driven integrations, delayed processing, or background jobs in VTEX IO apps.

# Events, Workers & Async Processing

## When this skill applies

Use this skill when a VTEX IO app needs to process work asynchronously through events, workers, or other background execution patterns.

- Consuming broadcasted events from other VTEX services
- Running background work that should not block HTTP responses
- Designing retry-safe handlers
- Processing batches or delayed jobs
- Building async integrations with external services

Do not use this skill for:
- defining HTTP route contracts
- designing GraphQL schemas or resolvers
- deciding app-level policies
- low-level client construction

## Decision rules

- Use events or workers when the work is expensive, retry-prone, or not required to complete inside a request-response cycle.
- VTEX uses an internal event broadcaster to deliver platform and app events to your service. The same broadcaster can route events published by your app to other handlers. Assume at-least-once delivery semantics in both directions: events can be retried or replayed, so handlers must be idempotent and safe under duplicates.
- Keep event handlers idempotent. The same event may be delivered more than once, so handlers must tolerate replay safely.
- Persist idempotency and processing state in an appropriate store, such as VBase for keyed markers or Master Data for structured records, so handlers can detect duplicates, completed work, and failures across retries.
- Declare events and workers explicitly in `service.json` so they are wired into the IO runtime, and keep their input contracts stable and explicit instead of relying on HTTP route assumptions.
- When you need to notify other apps or fan out work, publish events through the appropriate VTEX IO client or event mechanism instead of creating ad hoc HTTP callbacks just to simulate asynchronous delivery.
- To publish events through the VTEX IO event bus, apps often need the `colossus-fire-event` policy in `manifest.json`. Add other policies only when the app actually consumes those protected resources as well.
- Separate event ingestion from business orchestration when a handler grows beyond a small, clear unit of work.
- Treat retries as expected behavior, not exceptional behavior. Design handlers so repeated execution is safe.
- Keep background handlers explicit about side effects such as writes, external calls, or status transitions.
- For batch-oriented handlers, process items in small, explicit units and record status per item so that a single failing element does not hide progress on the rest of the batch.

## Hard constraints

### Constraint: Event handlers must be idempotent

Every event or background handler MUST tolerate duplicate execution without creating inconsistent side effects.

**Why this matters**

Async systems retry. Without idempotency, duplicate deliveries can create duplicated records, repeated partner calls, or invalid state transitions.

**Detection**

If the handler performs writes or external side effects without checking whether the work was already completed, STOP and add idempotency protection before proceeding.

**Correct**

```typescript
export async function handleOrderCreated(ctx: Context) {
  const { orderId } = ctx.body
  const alreadyProcessed = await ctx.clients.statusStore.hasProcessed(orderId)

  if (alreadyProcessed) {
    return
  }

  await ctx.clients.partnerApi.sendOrder(orderId)
  await ctx.clients.statusStore.markProcessed(orderId)
}
```

**Wrong**

```typescript
export async function handleOrderCreated(ctx: Context) {
  await ctx.clients.partnerApi.sendOrder(ctx.body.orderId)
}
```

### Constraint: Background work must not rely on request-only assumptions

Workers and event handlers MUST not depend on HTTP-only assumptions such as route params, immediate user interaction, or request-bound mutable state.

**Why this matters**

Async handlers run outside the route lifecycle. Reusing HTTP assumptions leads to missing context, brittle behavior, and accidental coupling between sync and async paths.

**Detection**

If an event handler expects request headers, route params, or a route-specific state shape, STOP and redesign the input contract so the handler receives explicit async data.

**Correct**

```typescript
export async function handleImport(ctx: Context) {
  const { importId, account } = ctx.body
  await ctx.clients.importApi.process(importId, account)
}
```

**Wrong**

```typescript
export async function handleImport(ctx: Context) {
  await ctx.clients.importApi.process(ctx.vtex.route.params.id, ctx.request.header.account)
}
```

### Constraint: Expensive async flows must surface partial failure clearly

Async handlers MUST make partial failures visible through state, logs, or durable markers instead of silently swallowing them.

**Why this matters**

Background failures are harder to see than route failures. Without explicit failure signaling, operations teams cannot tell whether work was skipped, retried, or partially completed.

**Detection**

If the handler catches errors without recording failure state, logging enough context, or rethrowing when appropriate, STOP and make failure handling explicit.

**Correct**

```typescript
export async function handleSync(ctx: Context) {
  try {
    await ctx.clients.partnerApi.syncCatalog(ctx.body.catalogId)
    await ctx.clients.statusStore.markSuccess(ctx.body.catalogId)
  } catch (error) {
    await ctx.clients.statusStore.markFailure(ctx.body.catalogId)
    throw error
  }
}
```

**Wrong**

```typescript
export async function handleSync(ctx: Context) {
  try {
    await ctx.clients.partnerApi.syncCatalog(ctx.body.catalogId)
  } catch (_) {
    return
  }
}
```

## Preferred pattern

Recommended file layout:

```text
node/
├── events/
│   ├── index.ts
│   ├── catalog.ts
│   └── orders.ts
└── workers/
    └── sync.ts
```

Minimal async handler pattern:

```typescript
export async function handleCatalogChanged(ctx: Context) {
  const { skuId } = ctx.body
  const alreadyDone = await ctx.clients.syncState.isProcessed(skuId)

  if (alreadyDone) {
    return
  }

  await ctx.clients.catalogSync.syncSku(skuId)
  await ctx.clients.syncState.markProcessed(skuId)
}
```

Illustrative event publishing pattern:

```typescript
export async function broadcast(ctx: Context, next: () => Promise<void>) {
  const {
    clients: { events },
    body: { payload, senderAppId, clientAppId },
  } = ctx

  for (const row of payload as unknown[]) {
    await events.sendEvent(clientAppId, 'my-app.event-name', {
      data: row,
      senderAppId,
    })
  }

  await next()
}
```

Minimal manifest policy for event publishing:

```json
{
  "policies": [
    {
      "name": "colossus-fire-event"
    }
  ]
}
```

Use routes to acknowledge or trigger work, and use events or workers to perform slow, repeatable, and failure-aware processing.

Use storage intentionally for async state:

- VBase for simple idempotency markers keyed by an external identifier
- Master Data for structured processing records with status and timestamps

Treat the async payload as its own contract instead of reusing route-only assumptions from an HTTP request.

For fan-out or cross-app notifications, publish a small, well-defined event containing IDs and minimal metadata, then let downstream handlers fetch full details from the source of truth when needed instead of embedding large payloads or relying on custom callback URLs.

In development, use the Broadcaster app's `Notify Target Workspace` setting in Admin to route events to a specific workspace instead of inventing ad hoc public routes or test-only delivery flows. Handlers should still behave correctly regardless of which workspace receives the event.

## Common failure modes

- Treating event delivery as exactly-once instead of at-least-once.
- Reusing HTTP route assumptions inside workers or event handlers.
- Swallowing background errors without explicit failure state.
- Letting one event handler orchestrate too many unrelated side effects.
- Performing expensive work synchronously in routes instead of moving it to async processing.
- Logging full event payloads with secrets or tokens instead of using IDs and metadata for correlation.

## Review checklist

- [ ] Is async processing the right mechanism for this work?
- [ ] Is the handler idempotent under duplicate delivery?
- [ ] Is idempotency or processing state stored in an appropriate backend such as VBase or Master Data?
- [ ] Are events and workers declared explicitly in `service.json`?
- [ ] Are background inputs explicit and independent from HTTP route assumptions?
- [ ] Are failures surfaced clearly enough for retry and troubleshooting?
- [ ] For batch processing, is status visible per item or per small unit of work?
- [ ] Should large handlers be split into smaller async units or orchestration steps?

## Related skills

- [`vtex-io-data-access-patterns`](../vtex-io-data-access-patterns/skill.md) - Use when choosing where idempotency keys, sync state, or processing records should live
- [`vtex-io-observability-and-ops`](../vtex-io-observability-and-ops/skill.md) - Use when the main question is how async failures should be logged, measured, and monitored

## Reference

- [Service](https://developers.vtex.com/docs/guides/vtex-io-documentation-service) - Event declaration and service execution model
- [Node Builder](https://developers.vtex.com/docs/guides/vtex-io-documentation-node-builder) - Backend file structure for services
- [Broadcaster](https://developers.vtex.com/docs/apps/vtex.broadcaster) - Internal event delivery context and the `Notify Target Workspace` setting for development
