This skill provides guidance for AI agents working with VTEX Custom VTEX IO Apps. Apply these constraints and patterns when assisting developers with apply when deciding where and how a VTEX IO app should store and read data. Covers when to use app settings, configuration apps, Master Data, VBase, VTEX core APIs, or external stores, and how to avoid duplicating sources of truth or abusing configuration stores for operational data. Use for new data flows, caching decisions, refactors, or reviewing suspicious storage and access patterns in VTEX IO apps.

# Data Access & Storage Patterns

## When this skill applies

Use this skill when the main question is where data should live and how a VTEX IO app should read or write it.

- Designing new data flows for an IO app
- Deciding whether to use app settings, configuration apps, Master Data, VBase, or VTEX core APIs
- Reviewing code that reads or writes large, duplicated, or critical datasets
- Introducing caching layers or derived local views around existing APIs

Do not use this skill for:
- detailed Master Data schema or entity modeling
- app settings or configuration app schema design
- auth tokens or policies such as `AUTH_TOKEN`, `STORE_TOKEN`, or manifest permissions
- service runtime sizing or concurrency tuning

## Decision rules

### Choose the right home for each kind of data

- Use app settings or configuration apps for stable configuration managed by merchants or operators, such as feature flags, credentials, external base URLs, and behavior toggles.
- Use Master Data for structured custom business records that belong to the account and need validation, filtering, search, pagination, or lifecycle management.
- Use VBase for simple keyed documents, auxiliary snapshots, or cache-like JSON payloads that are usually read by key rather than searched broadly.
- Use VTEX core APIs when the data already belongs to a VTEX core domain such as orders, catalog, pricing, or logistics.
- Use external stores or external APIs when the data belongs to another system and VTEX IO is only integrating with it.

### Keep source of truth explicit

- Treat VTEX core APIs as the source of truth for core commerce domains such as orders, products, prices, inventory, and similar platform-owned data.
- Do not mirror complete orders, catalog records, prices, or inventories into Master Data or VBase unless there is a narrow derived use case with clear ownership.
- If an IO app needs a local copy, store only the minimal fields or derived view required for that app and rehydrate full details from the authoritative source when needed.
- Do not use app settings or configuration apps as generic operational data stores.

### Design reads and caches intentionally

- Prefer API-level filtering, pagination, field selection, and bounded reads instead of loading full datasets into Node and filtering in memory.
- Use caching only when repeated reads justify it and the cached view has clear invalidation or freshness rules.
- When a background job or event pipeline needs persistent processing state, store only the status and correlation data required for retries and idempotency.
- Keep long-lived logs, traces, or unbounded histories out of Master Data and VBase unless the use case explicitly requires a durable app-owned audit trail.

## Hard constraints

### Constraint: Configuration stores must not be used as operational data storage

App settings and configuration apps MUST represent configuration, not transactional records, unbounded lists, or frequently changing operational state.

**Why this matters**

Using configuration stores as data storage blurs system boundaries, makes workspace behavior harder to reason about, and breaks expectations for tools and flows that depend on settings being small and stable.

**Detection**

If you see arrays of records, logs, histories, orders, or other growing operational payloads inside `settingsSchema`, configuration app payloads, or settings-related APIs, STOP and move that data to Master Data, VBase, a core API, or an external store.

**Correct**

```json
{
  "settingsSchema": {
    "type": "object",
    "properties": {
      "enableModeration": {
        "type": "boolean"
      }
    }
  }
}
```

**Wrong**

```json
{
  "settingsSchema": {
    "type": "object",
    "properties": {
      "orders": {
        "type": "array"
      }
    }
  }
}
```

### Constraint: Core systems must remain the source of truth for their domains

VTEX core systems such as Orders, Catalog, Pricing, and Logistics MUST remain the primary source of truth for their own business domains.

**Why this matters**

Treating a local IO copy as the main store for core domains creates reconciliation drift, stale reads, and business decisions based on outdated data.

**Detection**

If an app stores full order payloads, product documents, inventory snapshots, or price tables in Master Data or VBase and then uses those copies as the main source for business decisions, STOP and redesign the flow around the authoritative upstream source.

**Correct**

```typescript
const order = await ctx.clients.oms.getOrder(orderId)

ctx.body = {
  orderId: order.orderId,
  status: order.status,
}
```

**Wrong**

```typescript
const cachedOrder = await ctx.clients.masterdata.getDocument({
  dataEntity: 'ORD',
  id: orderId,
})

ctx.body = cachedOrder
```

### Constraint: Data-heavy reads must avoid full scans and in-memory filtering

Large or growing datasets MUST be accessed through bounded queries, filters, pagination, or precomputed derived views instead of full scans and broad in-memory filtering.

**Why this matters**

Unbounded reads are inefficient, hard to scale, and easy to turn into fragile service behavior as the dataset grows.

**Detection**

If you see code that fetches entire collections from Master Data, VTEX APIs, or external stores and then filters or aggregates the result in Node for a normal request flow, STOP and redesign the access path.

**Correct**

```typescript
const documents = await ctx.clients.masterdata.searchDocuments({
  dataEntity: 'RV',
  fields: ['id', 'status'],
  where: 'status=approved',
  pagination: {
    page: 1,
    pageSize: 20,
  },
})
```

**Wrong**

```typescript
const allDocuments = await ctx.clients.masterdata.scrollDocuments({
  dataEntity: 'RV',
  fields: ['id', 'status'],
})

const approved = allDocuments.filter((doc) => doc.status === 'approved')
```

## Preferred pattern

Start every data design with four questions:

1. Whose data is this?
2. Who is the source of truth?
3. How will the app query it?
4. Does the app really need to store a local copy?

Then choose intentionally:

- app settings or configuration apps for stable configuration
- Master Data for structured custom records owned by the app domain
- VBase for simple keyed documents or cache-like payloads
- VTEX core APIs for authoritative commerce data
- external stores or APIs for data owned outside VTEX

If the app stores a local copy, keep it small, derived, and clearly secondary to the authoritative source.

## Common failure modes

- Using app settings as generic storage for records, histories, or large lists.
- Mirroring complete orders, products, or prices from VTEX core into Master Data or VBase as a parallel source of truth.
- Fetching entire datasets only to filter, sort, or aggregate them in memory for normal request flows.
- Using Master Data or VBase for unbounded debug logs or event dumps.
- Adding caches without clear freshness, invalidation, or ownership rules.
- Spreading ad hoc data access decisions across handlers instead of keeping source-of-truth and storage decisions explicit.

## Review checklist

- [ ] Is this data truly configuration, or should it live in Master Data, VBase, a core API, or an external system?
- [ ] Is the authoritative source of truth explicit?
- [ ] Is VTEX core being treated as authoritative for orders, catalog, prices, inventory, and similar domains?
- [ ] Is local storage limited to data the app truly owns or a narrow derived view?
- [ ] Are reads bounded with filters, field selection, and pagination where appropriate?
- [ ] Does any cache or local copy have clear freshness and invalidation rules?

## Related skills

- [`vtex-io-app-settings`](../vtex-io-app-settings/skill.md) - Use when the main decision is how to model app-level configuration
- [`vtex-io-service-configuration-apps`](../vtex-io-service-configuration-apps/skill.md) - Use when shared structured configuration should be injected through `ctx.vtex.settings`
- [`vtex-io-masterdata-strategy`](../vtex-io-masterdata-strategy/skill.md) - Use when the main decision is whether Master Data is the right storage mechanism and how to model it

## Reference

- [Master Data](https://developers.vtex.com/docs/guides/master-data) - Structured account-level custom data storage
- [VBase](https://developers.vtex.com/docs/guides/vbase) - Key-value storage and JSON blobs for VTEX IO apps
- [Calling VTEX commerce APIs using VTEX IO clients](https://developers.vtex.com/docs/guides/calling-commerce-apis-3-using-vtex-io-clients) - How to consume Orders, Catalog, Pricing, and other core APIs from VTEX IO
- [Configuring your app settings](https://developers.vtex.com/docs/guides/vtex-io-documentation-4-configuringyourappsettings) - App settings as configuration rather than operational storage
- [Creating an interface for your app settings](https://developers.vtex.com/docs/guides/vtex-io-documentation-creating-an-interface-for-your-app-settings) - Public versus private app settings and config boundaries
