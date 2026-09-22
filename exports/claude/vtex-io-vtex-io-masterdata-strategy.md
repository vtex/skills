This skill provides guidance for AI agents working with VTEX Custom VTEX IO Apps. Apply these constraints and patterns when assisting developers with apply when deciding whether and how VTEX IO apps should use Master Data v2 for custom data. Covers entity boundaries, schema lifecycle, indexing strategy, and when Master Data is the right storage mechanism versus another data approach. Use for reviews, wishlists, forms, or other custom data modeling decisions in VTEX IO apps.

# Master Data Strategy

## When this skill applies

Use this skill when deciding whether Master Data v2 is the right mechanism for custom data in a VTEX IO app.

- Modeling reviews, wishlists, forms, or custom app records
- Choosing entity boundaries
- Planning schema indexing and lifecycle
- Reviewing long-term Master Data design

Do not use this skill for:
- low-level client usage details
- runtime or route structure
- app settings schemas
- frontend UI behavior

## Decision rules

- Use this skill once Master Data is a serious candidate storage mechanism. For the broader choice between Master Data, VBase, VTEX core APIs, and external stores, use `vtex-io-data-access-patterns`.
- Use Master Data for structured custom data that needs validation, indexing, and query support.
- Use the `masterdata` builder when this app introduces a new business entity, owns the data model, and wants the schema to be created and versioned as part of the app contract.
- Prefer using only the Master Data client when the entity and schema already exist and are shared or centrally managed, and this app only needs to read or write records without redefining the schema itself.
- For stable schemas that the app owns but should not be recreated or updated on every app version, keep the schema definition in code and use the Master Data client in a controlled setup path to create or update the schema only when needed.
- Remember that Master Data entities are account-scoped. Changing a shared entity or schema affects every app in that account that depends on it, so prefer client-only consumption when the schema is centrally managed.
- Keep entity boundaries intentional and aligned with the business concept being stored.
- Index fields that are actually used for filtering and search.
- Plan schema lifecycle explicitly to avoid schema sprawl.
- Consider data volume and retention from the start. If the dataset will grow unbounded and there is no retention or archival strategy, Master Data is likely not the right storage mechanism.
- Do not treat Master Data as an unbounded dumping ground for arbitrary payloads.
- Do not use Master Data as an unbounded log or event store for high-volume append-only data. Prefer dedicated logging or storage mechanisms when the main need is raw history rather than structured queries.
- Do not store secrets, credentials, or global app configuration in Master Data. Use app settings or configuration apps instead.
- Do not generate one entity or schema per account, workspace, or feature flag. Keep a stable entity name and distinguish tenants or environments through record fields when necessary.
- Be careful when tying schema evolution directly to app versioning through the `masterdata` builder. Frequent schema changes coupled to app releases can generate excessive schema updates, indexing changes, and long-term schema sprawl.

### Choosing between the `masterdata` builder and the Master Data client

There are three main ways for a VTEX IO app to work with Master Data:

- Owning the schema via the `masterdata` builder:
  - The app declares entities and schemas under `masterdata/` in the repository.
  - Schema fields, validation, and indexing evolve together with the app code.
  - Use this when the app is the primary owner of the data model, schema changes are relatively infrequent, and the schema should be rolled out as part of the app contract.

- Consuming an existing schema via the Master Data client only:
  - The app uses a Master Data client, but does not declare entities or schemas through the `masterdata` builder.
  - The app assumes a stable schema managed elsewhere and only reads or writes records that follow that contract.
  - Use this when the entity is shared across multiple apps or managed centrally, and this app should not redefine or fragment the schema across environments.

- Owning a stable schema definition in code and applying it through the client:
  - The app keeps a stable schema definition in code instead of `masterdata/` builder files.
  - A controlled setup path checks whether the schema exists and creates or updates it only when needed.
  - Use this when the app truly owns the schema, but should not couple schema rollout to every app version or every release pipeline step.

## Hard constraints

### Constraint: Master Data entities must have explicit schema boundaries

Each entity MUST represent a clear business concept and have a schema that matches its intended usage.

**Why this matters**

Weak entity boundaries create confusing queries, poor indexing choices, and schema drift.

**Detection**

If one entity mixes unrelated concepts or stores many unrelated record shapes, STOP and split the design.

**Correct**

```json
{
  "title": "review-schema-v1",
  "type": "object",
  "properties": {
    "productId": { "type": "string" },
    "userId": { "type": "string" },
    "rating": { "type": "number" },
    "approved": { "type": "boolean" }
  },
  "required": ["productId", "userId", "rating"],
  "v-indexed": ["productId", "userId", "approved"]
}
```

**Wrong**

```json
{
  "title": "everything-schema",
  "type": "object"
}
```

### Constraint: Indexed fields must match real query behavior

Fields used in filters or lookups MUST be indexed intentionally.

**Why this matters**

Missing indexes lead to poor query behavior and unnecessary operational risk.

**Detection**

If queries depend on fields that are not represented in indexing strategy, STOP and align schema and access patterns.

**Correct**

```json
{
  "v-indexed": ["productId", "approved"]
}
```

**Wrong**

```json
{
  "v-indexed": []
}
```

### Constraint: Schema lifecycle must be managed explicitly

Master Data schema evolution MUST be planned with cleanup and versioning in mind.

**Why this matters**

Unmanaged schema growth creates long-term operational pain and can run into platform limits.

**Detection**

If schema versions are added with no lifecycle or cleanup plan, STOP and define that plan.

**Correct**

```text
review-schema-v1 -> review-schema-v2 with cleanup plan
```

**Wrong**

```text
review-schema-v1, v2, v3, v4, v5 with no cleanup strategy
```

Remember that changing indexed fields or field types can affect how existing documents are indexed and queried. When schema evolution is coupled to frequent app version changes, this risk increases.

### Constraint: Entity and schema names must remain stable across environments

Entity names and schema identifiers MUST remain stable across accounts, workspaces, and environments. Do not encode account names, workspaces, or rollout flags into the entity or schema name itself.

**Why this matters**

Per-account or per-workspace schema naming leads to schema sprawl, harder lifecycle management, and operational limits that are difficult to clean up later.

**Detection**

If the design proposes one entity or schema per workspace, per account, or per environment, STOP and redesign around stable names with scoped fields or records instead.

**Correct**

```text
review-schema-v1
RV
```

**Wrong**

```text
review-schema-brazil-master
RV_US_MASTER
```

Using one clearly managed schema for development and one for production can be acceptable when there is a deliberate plan to keep them synchronized. Avoid generating schema names per workspace, per account, or per feature flag.

## Preferred pattern

Use Master Data for structured custom records, index only what you query, and plan schema evolution deliberately.

Example: app owning a schema through the `masterdata` builder

- `masterdata/review-schema-v1.json` declares the schema and indexes for the `RV` entity.
- The app then uses a dedicated Master Data client to create and query `RV` documents.

```json
{
  "title": "review-schema-v1",
  "v-entity": "RV",
  "type": "object",
  "properties": {
    "productId": { "type": "string" },
    "userId": { "type": "string" },
    "rating": { "type": "number" },
    "approved": { "type": "boolean" }
  },
  "required": ["productId", "userId", "rating"],
  "v-indexed": ["productId", "userId", "approved"]
}
```

Example: app consuming an existing schema through the client only

- This app declares no `masterdata` builder files.
- It uses the Master Data client against an existing, stable `RV` entity managed elsewhere.

```typescript
await ctx.clients.masterdata.createDocument({
  dataEntity: 'RV',
  fields: {
    productId,
    userId,
    rating,
    approved: false,
  },
})
```

Example: app owning a stable schema in code and ensuring it exists through the client

- The app keeps a stable schema definition in code.
- A controlled setup path ensures the schema exists instead of relying on the `masterdata` builder for every rollout.

```typescript
const schema = {
  title: 'review-schema-v1',
  'v-entity': 'RV',
}

const existing = await ctx.clients.masterdata.getSchema('review-schema-v1')

if (!existing) {
  await ctx.clients.masterdata.createOrUpdateSchema('review-schema-v1', schema)
}
```

## Common failure modes

- Creating entities that are too broad.
- Querying on fields that are not indexed.
- Accumulating schema versions with no lifecycle plan.
- Using Master Data as a high-volume log or event sink without retention or archival strategy.
- Storing configuration, secrets, or cross-app shared settings in Master Data instead of using configuration-specific mechanisms.
- Generating per-account or per-workspace entities such as `RV_storeA_master` instead of using a stable entity like `RV` with scoped record fields.
- Relying on the `masterdata` builder for frequent schema changes tied to every app version, causing excessive schema updates and indexing side effects over time.

## Review checklist

- [ ] Is Master Data the right storage mechanism for this use case?
- [ ] Should this app own the schema through the `masterdata` builder, or just consume an existing stable schema through the client?
- [ ] Would a stable schema in code plus a controlled setup path be safer than coupling schema rollout to every app version?
- [ ] Does each entity represent a clear business concept?
- [ ] Are entity and schema names stable across workspaces and accounts?
- [ ] Are filtered fields indexed intentionally?
- [ ] Is there a schema lifecycle plan?
- [ ] If different schemas are used for development and production, is there a clear plan to keep them synchronized without creating schema sprawl?

## Related skills

- [`vtex-io-data-access-patterns`](../vtex-io-data-access-patterns/skill.md) - Use when deciding between Master Data, VBase, VTEX core APIs, or external stores for a given dataset

## Reference

- [Master Data](https://developers.vtex.com/docs/guides/master-data) - Platform data storage context
