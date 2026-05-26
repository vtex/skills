---
name: masterdata-storage-strategy
description: "Apply when deciding whether VTEX Master Data is the right storage for a given workload, designing JSON Schemas with v-indexed, v-cache, v-security, and v-triggers, planning entity capacity and lifecycle, or auditing existing Master Data usage. Covers when to use MD versus Catalog, OMS, VBase, or external databases, schema design best practices, indexing strategy, trigger patterns, and operational considerations. Use before creating any new Master Data entity."
---

# Master Data storage strategy

## When this skill applies

Use this skill **before creating any new Master Data entity** or when auditing existing usage. It helps you answer:

- Is Master Data the **right** storage for this data, or would Catalog, OMS, VBase, or an external database serve better?
- How should I design the **JSON Schema** for performance and security?
- Which fields should I **index** (`v-indexed`), and which should I **not**?
- Should I enable or disable **caching** (`v-cache`)?
- Do I need **triggers** (`v-triggers`), or is an event-driven IO approach better?
- How do I plan for **capacity** and **lifecycle** of schemas and documents?

Do not use this skill for:

- VTEX IO app integration patterns (MasterDataClient, `masterdata` builder, CRUD in code) — use `vtex-io-masterdata`
- Performance patterns for IO services (LRU, VBase caching layers) — use `vtex-io-application-performance`

## Decision rules

### When to use Master Data

Master Data is a good fit when **all** of the following are true:

1. **Document-oriented access** — Your data is naturally key-value or document-shaped (JSON documents with variable schemas). You query by indexed fields and retrieve full or partial documents.
2. **Platform-integrated** — You benefit from VTEX-native features: `v-triggers` for automated workflows, `v-security` for per-field public access, `v-indexed` for search/filter, and the `masterdata` builder for schema-as-code.
3. **Moderate volume** — Your entity will hold thousands to low millions of documents. MD handles this well with proper indexing.
4. **Not on the purchase critical path** — MD is not optimized for sub-10ms latency. Synchronous MD reads in checkout/cart/payment flows risk conversion if MD is slow.
5. **No better native fit** — The data doesn't belong in Catalog (product/SKU attributes), OMS (order data), CL/AD (customer profiles/addresses), or VBase (app-specific cache/state).

### When NOT to use Master Data

| Data type                          | Better storage                                     | Why                                                        |
| ---------------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| Product attributes, specifications | **Catalog** (specifications, unstructured specs)   | Native indexing, search integration, catalog APIs          |
| Order data, order history          | **OMS** (via OMS APIs + BFF cache)                 | Single source of truth; duplicating to MD creates drift    |
| Customer profiles, addresses       | **CL/AD native entities**                          | Platform-managed, already indexed and cached               |
| App-specific cache or temp state   | **VBase**                                          | Designed for per-app ephemeral storage, no schema overhead |
| Application logs, debug traces     | **`ctx.vtex.logger`**                              | Structured logging infrastructure, not a database          |
| High-throughput time-series data   | **External database** (SQL, NoSQL, time-series DB) | MD is not designed for millions of writes/day              |
| Relational data with joins         | **External SQL database**                          | MD has no join support; denormalize or use a relational DB |
| Data requiring strong consistency  | **External database**                              | MD is eventually consistent for indexed fields             |

### Schema design principles

- **One entity per concept** — Don't mix unrelated data in a single entity. Each entity should represent a clear business concept (e.g. `reviews`, `wishlists`, `legacyOrders`).
- **Index what you query** — Only fields in `v-indexed` can be used in `where` clauses. But **don't over-index**: each indexed field increases write latency and storage because the index is updated on every document change.
- **Minimal `v-default-fields`** — Return only the fields most consumers need by default. Large default payloads waste bandwidth.
- **`v-cache` matches the workload** — Leave `true` (default) for read-heavy entities. Set to `false` for entities with high write frequency where consumers need immediate consistency after writes.
- **`v-security` is explicit** — Set `allowGetAll: false` unless unauthenticated list access is intentional. Use `publicRead`, `publicWrite`, `publicFilter` only for fields that must be accessible without authentication.

### VTEX schema extensions (`v-*` fields) — reference

Master Data v2 extends standard JSON Schema with `v-*` properties that control indexing, caching, security, defaults, triggers, and schema inheritance. These are **VTEX-specific**; standard JSON Schema validators ignore them.

#### `v-indexed`

Array of field names that Master Data will create secondary indexes for.

- **Only** indexed fields can appear in `where` clauses for `searchDocuments` and `scrollDocuments`. Queries on non-indexed fields trigger **full document scans** that time out on large datasets.
- Each index is updated on **every** document write. Over-indexing increases write latency and storage cost proportionally.
- **When to index**: fields used in `where` filters, sort expressions, or `publicFilter`. **When not to index**: large text fields (`description`, `notes`), fields never queried, or fields only read by document ID (indexing adds no benefit for `getDocument`).

```json
{ "v-indexed": ["email", "status", "createdAt"] }
```

#### `v-cache`

Boolean (default `true`). Controls whether Master Data caches GET responses for individual documents.

- **`true` (default)** — Read-heavy entities benefit from caching. Most entities should leave this as default.
- **`false`** — Use for entities with **high write frequency** where consumers need **fresh reads** immediately after writes (e.g. real-time counters, configuration flags, session-like state).

```json
{ "v-cache": false }
```

#### `v-default-fields`

Array of field names returned when the caller does **not** specify a `fields` parameter in the API request.

- Keep this **minimal** — only the fields most consumers need by default.
- Reduces payload size for common queries.

```json
{ "v-default-fields": ["email", "status", "score", "createdAt"] }
```

#### `v-security`

Object controlling **unauthenticated** (public) access to fields. By default, all fields require authentication.

| Property       | Type       | Description                                                                                                   |
| -------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `allowGetAll`  | `boolean`  | If `true`, unauthenticated users can list all documents. **Default `false`; keep it off unless intentional.** |
| `publicRead`   | `string[]` | Fields readable without authentication                                                                        |
| `publicWrite`  | `string[]` | Fields writable without authentication                                                                        |
| `publicFilter` | `string[]` | Fields usable in `where` clauses without authentication (must also be in `v-indexed`)                         |

```json
{
  "v-security": {
    "allowGetAll": false,
    "publicRead": ["status", "displayName", "rating"],
    "publicWrite": [],
    "publicFilter": ["status"]
  }
}
```

**Never** include PII (email, phone, addresses), internal IDs, or business-sensitive data in `publicRead` or `publicFilter`.

#### `v-triggers`

Array of trigger objects that define automated actions executed when documents are created or updated and meet specified conditions.

| Property          | Type      | Description                                                                       |
| ----------------- | --------- | --------------------------------------------------------------------------------- |
| `name`            | `string`  | Unique trigger name                                                               |
| `active`          | `boolean` | Enable/disable the trigger                                                        |
| `condition`       | `string`  | `where`-style filter (e.g. `"approved=false"`, `"status=pending AND priority>3"`) |
| `action.type`     | `string`  | `"email"`, `"http"` (webhook), or `"action"`                                      |
| `action.provider` | `string`  | Email provider name (for email type)                                              |
| `action.uri`      | `string`  | Webhook URL (for http type)                                                       |
| `action.method`   | `string`  | HTTP method for webhook (for http type)                                           |
| `retry.times`     | `number`  | Retry count on failure                                                            |
| `retry.delay`     | `object`  | Delay between retries (e.g. `{ "addMinutes": 5 }`)                                |

```json
{
  "v-triggers": [
    {
      "name": "notify-on-creation",
      "active": true,
      "condition": "status=new",
      "action": {
        "type": "email",
        "provider": "default",
        "subject": "New record: {{title}}",
        "to": ["admin@mystore.com"],
        "body": "Record {{id}} created by {{author}}"
      },
      "retry": { "times": 3, "delay": { "addMinutes": 5 } }
    },
    {
      "name": "webhook-on-approval",
      "active": true,
      "condition": "approved=true",
      "action": {
        "type": "http",
        "uri": "https://my-integration.example.com/webhook",
        "method": "POST",
        "headers": { "X-Custom-Header": "value" }
      },
      "retry": { "times": 2, "delay": { "addMinutes": 10 } }
    }
  ]
}
```

#### `v-canonicalto`

URL pointing to another schema in the **same** entity for **schema inheritance**. The current schema inherits properties and constraints from the target.

```json
{
  "v-canonicalto": "https://{host}/api/dataentities/{entity}/schemas/{base-schema}"
}
```

#### `additionalProperties`

Standard JSON Schema property, but worth noting: set to `false` to **reject** fields not declared in `properties`. By default Master Data preserves extra fields without validation.

## Hard constraints

### Constraint: Index only fields used in where clauses or sort expressions

Every field in `v-indexed` creates a secondary index that is updated on **every** document write. Indexing fields that are never queried wastes write throughput and storage.

**Why this matters** — Over-indexing a high-write entity (e.g. indexing 15 fields when only 3 are queried) can double or triple write latency. On entities with millions of documents, unnecessary indexes also increase storage costs.

**Detection** — Compare `v-indexed` fields with actual `where` clauses in the codebase. Any indexed field not referenced in a `where` or sort is likely unnecessary.

**Correct** — Index only the fields you filter or sort on.

```json
{
  "properties": {
    "email": { "type": "string" },
    "status": { "type": "string" },
    "score": { "type": "integer" },
    "notes": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "v-indexed": ["email", "status", "createdAt"]
}
```

**Wrong** — Indexing every field "just in case."

```json
{
  "properties": {
    "email": { "type": "string" },
    "status": { "type": "string" },
    "score": { "type": "integer" },
    "notes": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "v-indexed": ["email", "status", "score", "notes", "createdAt"]
}
```

### Constraint: Do not expose sensitive fields via v-security publicRead

The `v-security.publicRead` array makes fields accessible **without any authentication**. Never include PII (email, phone, addresses), internal IDs, or business-sensitive data in this list.

**Why this matters** — Public fields are accessible to anyone with the entity name and a document ID or search query. Exposing PII violates data protection regulations and creates security vulnerabilities.

**Detection** — Check `v-security.publicRead` and `publicFilter` for fields containing user data, internal references, or anything that should require authentication.

**Correct** — Expose only non-sensitive, display-oriented fields.

```json
{
  "v-security": {
    "allowGetAll": false,
    "publicRead": ["status", "displayName", "rating"],
    "publicWrite": [],
    "publicFilter": ["status"]
  }
}
```

**Wrong** — Exposing PII and internal fields publicly.

```json
{
  "v-security": {
    "allowGetAll": true,
    "publicRead": ["email", "phone", "cpf", "internalScore", "organizationId"],
    "publicWrite": ["email"],
    "publicFilter": ["email", "phone"]
  }
}
```

### Constraint: Respect the 60-schema-per-entity limit

Master Data v2 entities have a hard limit of **60 schemas**. The `masterdata` builder creates a **new schema per app version** linked or installed. Once the limit is reached, new versions fail to deploy.

**Why this matters** — During active development with frequent `vtex link` cycles, schemas accumulate quickly. Hitting the limit blocks deployment until old schemas are manually deleted.

**Detection** — Apps with many link/publish cycles. Check schema count via `GET /api/dataentities/{entity}/schemas`.

**Correct** — Periodically clean up unused schemas. Automate cleanup in CI/CD.

```bash
# List schemas to identify stale ones
curl "https://{account}.vtexcommercestable.com.br/api/dataentities/{entity}/schemas" \
  -H "X-VTEX-API-AppKey: {key}" -H "X-VTEX-API-AppToken: {token}"

# Delete unused schemas
curl -X DELETE "https://{account}.vtexcommercestable.com.br/api/dataentities/{entity}/schemas/{old-schema}" \
  -H "X-VTEX-API-AppKey: {key}" -H "X-VTEX-API-AppToken: {token}"
```

**Wrong** — Never cleaning up schemas during development until the limit blocks deployment.

## Preferred pattern

### Complete schema example with all VTEX extensions

```json
{
  "$schema": "http://json-schema.org/schema#",
  "title": "product-review-v1",
  "type": "object",
  "properties": {
    "productId": { "type": "string" },
    "author": { "type": "string" },
    "email": { "type": "string", "format": "email" },
    "rating": { "type": "integer", "minimum": 1, "maximum": 5 },
    "title": { "type": "string", "maxLength": 200 },
    "text": { "type": "string", "maxLength": 5000 },
    "approved": { "type": "boolean" },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "required": ["productId", "rating", "title", "text"],
  "v-indexed": ["productId", "approved", "rating", "createdAt"],
  "v-default-fields": [
    "productId",
    "author",
    "rating",
    "title",
    "approved",
    "createdAt"
  ],
  "v-cache": true,
  "v-security": {
    "allowGetAll": false,
    "publicRead": [
      "productId",
      "author",
      "rating",
      "title",
      "text",
      "approved"
    ],
    "publicWrite": [],
    "publicFilter": ["productId", "approved", "rating"]
  },
  "v-triggers": [
    {
      "name": "notify-moderator",
      "active": true,
      "condition": "approved=false",
      "action": {
        "type": "email",
        "provider": "default",
        "subject": "New review pending moderation",
        "to": ["moderator@mystore.com"],
        "body": "Review for product {{productId}} by {{author}}: {{title}}"
      },
      "retry": {
        "times": 3,
        "delay": { "addMinutes": 5 }
      }
    }
  ]
}
```

### Triggers: when to use and when not to

**Use triggers when:**

- You need email notifications on document changes (e.g. moderation alerts)
- You need to call an external webhook when a document meets a condition
- The action is simple, fire-and-forget, and doesn't need complex error handling

**Do NOT use triggers when:**

- You need complex orchestration, retries with backoff, or error recovery — use IO events instead
- You need sub-second response to changes — triggers have built-in delay
- The action modifies other MD entities in a chain — risk of cascading trigger loops
- You need conditional logic more complex than a `where`-style filter

### Document counting without full fetch

Use the `REST-Content-Range` header to get document counts efficiently:

```bash
# Count documents without fetching them
curl "https://{account}.vtexcommercestable.com.br/api/dataentities/{entity}/search?_fields=id" \
  -H "REST-Range: resources=0-0" \
  -H "X-VTEX-API-AppKey: {key}" -H "X-VTEX-API-AppToken: {token}"
# Response header: REST-Content-Range: resources 0-0/12345
# The number after "/" is the total document count
```

### Search vs Scroll

| Use               | When                                                 | Max page size      |
| ----------------- | ---------------------------------------------------- | ------------------ |
| `searchDocuments` | Bounded result sets, UI pagination, known small size | 100 per page       |
| `scrollDocuments` | Large exports, bulk operations, unbounded iteration  | Configurable batch |

## Common failure modes

- **Over-indexing** — Indexing 10+ fields on a high-write entity. Every write updates all indexes, increasing latency and storage.
- **Missing indexes** — Querying on non-indexed fields triggers full scans. Works in dev with 100 docs, times out in production with 100k.
- **`v-cache: false` by default** — Disabling cache on read-heavy entities forces every GET to hit the database. Only disable for high-write entities.
- **`allowGetAll: true` with PII** — Unauthenticated users can list all documents including sensitive data.
- **Schema accumulation** — 60 schemas from development cycles blocks production deployments.
- **Trigger chains** — Trigger A modifies entity B, which has a trigger that modifies entity A — infinite loop.
- **MD as a log store** — Entities growing unboundedly with traffic volume. Use `ctx.vtex.logger` instead.
- **MD on critical path** — Synchronous MD read in checkout with no timeout or fallback.

## Review checklist

- [ ] Has a **storage fit review** been done? (MD vs Catalog vs OMS vs VBase vs external DB)
- [ ] Are **only queried fields** in `v-indexed`? No unnecessary indexes?
- [ ] Is `v-cache` set appropriately for the entity's read/write ratio?
- [ ] Does `v-security` restrict public access to non-sensitive fields only?
- [ ] Is `allowGetAll` set to `false` unless explicitly needed?
- [ ] Are triggers simple and non-chaining? No risk of trigger loops?
- [ ] Is there a **schema cleanup** strategy for the 60-schema limit?
- [ ] Is the entity **off** the purchase critical path (checkout, cart, payment)?
- [ ] For large datasets (100k+ docs), is `scrollDocuments` used instead of paginated search?
- [ ] Are `v-default-fields` minimal (not returning everything by default)?

## Related skills

- [vtex-io-masterdata](../../../vtex-io/skills/vtex-io-masterdata/SKILL.md) — IO app integration: MasterDataClient, `masterdata` builder, CRUD patterns
- [vtex-io-application-performance](../../../vtex-io/skills/vtex-io-application-performance/SKILL.md) — Caching layers and BFF patterns when exposing MD data
- [architecture-well-architected-commerce](../../../architecture/skills/architecture-well-architected-commerce/SKILL.md) — Cross-cutting storage and architecture principles

## Reference

- [Working with JSON Schemas in Master Data v2](https://developers.vtex.com/docs/guides/working-with-json-schemas-in-master-data-v2) — v-indexed, v-cache, v-security, v-triggers configuration
- [Master Data v2 Basics](https://developers.vtex.com/docs/guides/master-data-v2-basics) — Core concepts and data model
- [Master Data Schema Lifecycle](https://developers.vtex.com/docs/guides/master-data-schema-lifecycle) — Schema versioning and the 60-schema limit
- [Setting Up Triggers on Master Data v2](https://developers.vtex.com/docs/guides/setting-up-triggers-on-master-data-v2) — Trigger configuration and patterns
- [Master Data v2 API Reference](https://developers.vtex.com/docs/api-reference/master-data-api-v2#overview) — Complete API specification
- [Master Data v2 Document Saving Flow](https://developers.vtex.com/docs/guides/master-data-v2-document-saving-flow) — Validation, indexing, and trigger execution order
