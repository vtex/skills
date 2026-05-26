---
name: vtex-io-masterdata
description: "Apply when working with MasterData v2 entities, schemas, or MasterDataClient in VTEX IO apps, or when anyone designing or implementing a solution must scrutinize whether Master Data is the correct storage. The skill prompts hard questions: native Catalog or other VTEX stores, OMS, or an external database may be better; do not default to MD because it is convenient. Covers JSON Schema, CRUD, triggers, search and scroll, schema lifecycle, purchase-path avoidance, single source of truth, and BFF handoffs. Use for justified custom persistence while avoiding the 60-schema limit."
---

# MasterData v2 Integration

## When this skill applies

Use this skill when your VTEX IO app needs to store custom data (reviews, wishlists, form submissions, configuration records), query or filter that data, or set up automated workflows triggered by data changes—and when you must **justify** Master Data versus other VTEX or external stores.

- Defining data entities and JSON Schemas using the `masterdata` builder
- Performing CRUD operations through MasterDataClient (`ctx.clients.masterdata`)
- Configuring search, scroll, and indexing for efficient data retrieval
- Setting up Master Data triggers for automated workflows
- Managing schema lifecycle to avoid the 60-schema limit
- **Deciding** whether data belongs in **Catalog** (fields, **specifications**, unstructured SKU/product specs), **Master Data**, **native OMS/checkout** surfaces, or an **external** SQL/NoSQL/database
- Avoiding **synchronous** Master Data on the **purchase critical path** (cart, checkout, payment, placement) unless there is a **hard** performance and reliability case
- Preferring **one source of truth**—avoid **duplicating** order headers or OMS lists in Master Data for convenience; prefer **OMS** or a **BFF** with **caching** (see **Related skills**)

Do not use this skill for:

- General backend service patterns (use `vtex-io-service-apps` instead)
- GraphQL schema definitions (use `vtex-io-graphql-api` instead)
- Manifest and builder configuration (use `vtex-io-app-structure` instead)

## Decision rules

### Before you choose Master Data

Architects, developers, and anyone **designing or implementing** a solution should **think deeply** and **treat this section as a checklist to critique the default**: double-check that Master Data is the **right** persistence layer—not an automatic pick. The skill is written to **question** convenience-driven choices.

- **Purpose** — Master Data is a **document-oriented** store (similar in spirit to **document DBs** / DynamoDB-style access patterns). It is **one option** among many; choosing it because it is “there” or “cheap” without a **workload fit** review is a design smell.
- **Product-bound data** — If the information is fundamentally **about products or SKUs**, evaluate **Catalog** first: **specifications**, **unstructured product/SKU specifications**, and native catalog fields before creating a **parallel** MD entity that mirrors catalog truth.
- **Purchase path** — **Do not** place **synchronous** Master Data reads/writes in the **hot path** of **checkout** (cart mutation, payment, order placement) unless you have **evidence** (latency budget, failure modes). Prefer **native** commerce stores and **async** or **after-order** enrichment.
- **Orders and lists** — **Duplicating** **OMS** or **order** data into Master Data to power **My Orders** or similar **usually** fights **single source of truth**. Prefer **OMS APIs** (or **marketplace** protocols) behind a **BFF** or **IO** layer with **application caching** and correct **HTTP/path** semantics—not a second **order database** in MD “because it is easier.”
- **Exposing MD** — Master Data is **storage** only. Any **storefront** or **partner** access should go through a **service** that enforces **authentication**, **authorization**, and **rate limits**—typically **VTEX IO** or an external **BFF** following [headless-bff-architecture](../../../headless/skills/headless-bff-architecture/SKILL.md) patterns.
- **When MD fits** — After **storage fit** review, if MD remains appropriate, implement CRUD and schema discipline as below; combine with [vtex-io-application-performance](../vtex-io-application-performance/SKILL.md) and [vtex-io-service-paths-and-cdn](../vtex-io-service-paths-and-cdn/SKILL.md) when exposing HTTP or GraphQL from IO.

### Entity governance and hygiene

Before creating a new entity or extending an existing one, understand the landscape:

- **Native entities** — The platform manages entities like `CL` (clients), `AD` (addresses), `OD` (orders), `BK` (bookmarks), `AU` (auth), and others. **Never** create custom entities that duplicate native entity purposes. Know which entities exist before adding new ones.
- **Entity usage audit** — In accounts with dozens of custom entities, classify each by purpose: **logs/monitoring**, **cache/temporary**, **order extension**, **customer extension**, **marketing**, **CMS/content**, **integration/sync**, **auth/identity**, **logistics/geo**, or **custom business logic**. Entities in the **logs** or **cache** categories often indicate misuse—IO app logs belong in the logger, not MD; caches belong in VBase, not MD.
- **Critical path flag** — Identify whether an entity is used in **checkout**, **cart**, **payment**, or **login** flows. Entities on the critical path must meet strict latency and availability requirements. If an MD entity is on the critical path, question whether it should be there at all.
- **Document count awareness** — Use `REST-Content-Range` headers from `GET /search?_fields=id` with `REST-Range: resources=0-0` to efficiently count documents without fetching them. Large entities (100k+ docs) need `scrollDocuments`, pagination strategy, and potentially a BFF caching layer.

### Bulk operations and data migration

When importing, exporting, or migrating large datasets:

- **Validate before import** — Cross-reference import data against the authoritative source (e.g. catalog export for SKU validation, CL entity or user management API for email allowlists). Produce exception reports for invalid rows before touching MD.
- **JSONL payloads** — Generate one JSON object per MD document in a `.jsonl` file for bulk imports. This enables resumable, line-by-line processing.
- **Rate limiting** — MD APIs enforce rate limits. Use configurable delays between calls (e.g. 400ms) with exponential backoff on HTTP 429 responses.
- **Checkpoints** — For large imports (10k+ documents), persist progress to a checkpoint file (last successful document ID or line index). On failure or timeout, resume from the checkpoint instead of restarting.
- **Parallel with bounded concurrency** — Use a concurrency pool (e.g. `p-queue` with concurrency 5-10) for parallel `POST` or `PATCH` operations. Too much parallelism triggers rate limits; too little is slow.
- **Bulk delete before re-import** — When replacing all documents in an entity, use scroll + delete before import, or implement a separate delete pass with the same checkpoint and backoff patterns.
- **Schema alignment** — Ensure import payloads match the entity's JSON Schema exactly. Missing required fields or type mismatches cause silent validation failures.

### Implementation rules

- A **data entity** is a named collection of documents (analogous to a database table). A **JSON Schema** defines structure, validation, and indexing.
- When using the `masterdata` builder, entities are defined by folder structure: `masterdata/{entityName}/schema.json`. The builder creates entities named `{vendor}_{appName}_{entityName}`.
- Use `ctx.clients.masterdata` or `masterDataFor` from `@vtex/clients` for all CRUD operations — never direct REST calls.
- All fields used in `where` clauses MUST be declared in the schema's `v-indexed` array for efficient querying.
- Use `searchDocuments` for bounded result sets (known small size, max page size 100). Use `scrollDocuments` for large/unbounded result sets.
- The `masterdata` builder creates a new schema per app version. Clean up unused schemas to avoid the 60-schema-per-entity hard limit.

### `v-*` schema extensions (v-indexed, v-cache, v-security, v-triggers, etc.)

Master Data v2 extends standard JSON Schema with `v-*` properties that control indexing, caching, security, defaults, triggers, and schema inheritance. For the **complete reference** on each extension—when to use, when not to, and detailed configuration—see the [vtex-io-masterdata-strategy](../vtex-io-masterdata-strategy/SKILL.md) skill.

The essentials for IO app development:

- **`v-indexed`** — All fields used in `where` clauses **must** be listed here. Don't over-index; each index increases write latency.
- **`v-cache`** — Leave `true` (default) for read-heavy entities. Set `false` for high-write entities needing immediate read consistency.
- **`v-default-fields`** — Keep minimal. Controls what's returned when the caller omits `fields`.
- **`v-security`** — Set `allowGetAll: false` and never expose PII in `publicRead`/`publicFilter`.
- **`v-triggers`** — For simple automated actions (email, webhook). Use IO events for complex orchestration.

MasterDataClient methods:

| Method                              | Description                                          |
| ----------------------------------- | ---------------------------------------------------- |
| `getDocument`                       | Retrieve a single document by ID                     |
| `createDocument`                    | Create a new document, returns generated ID          |
| `createOrUpdateEntireDocument`      | Upsert a complete document                           |
| `createOrUpdatePartialDocument`     | Upsert partial fields (patch)                        |
| `updateEntireDocument`              | Replace all fields of an existing document           |
| `updatePartialDocument`             | Update specific fields only                          |
| `deleteDocument`                    | Delete a document by ID                              |
| `searchDocuments`                   | Search with filters, pagination, and field selection |
| `searchDocumentsWithPaginationInfo` | Search with total count metadata                     |
| `scrollDocuments`                   | Iterate over large result sets                       |

Search `where` clause syntax:

```text
where: "productId=12345 AND approved=true"
where: "rating>3"
where: "createdAt between 2025-01-01 AND 2025-12-31"
```

Architecture:

```text
VTEX IO App (node builder)
  │
  ├── ctx.clients.masterdata.createDocument()
  │       │
  │       ▼
  │   Master Data v2 API
  │       │
  │       ├── Validates against JSON Schema
  │       ├── Indexes declared fields
  │       └── Fires triggers (if conditions match)
  │             │
  │             ▼
  │         HTTP webhook / Email / Action
  │
  └── ctx.clients.masterdata.searchDocuments()
          │
          ▼
      Master Data v2 (reads indexed fields for efficient queries)
```

## Hard constraints

### Constraint: Use MasterDataClient — Never Direct REST Calls

All Master Data operations in VTEX IO apps MUST go through the MasterDataClient (`ctx.clients.masterdata`) or the `masterDataFor` factory from `@vtex/clients`. You MUST NOT make direct REST calls to `/api/dataentities/` endpoints.

**Why this matters**

The MasterDataClient handles authentication token injection, request routing, retry logic, caching, and proper error handling. Direct REST calls bypass all of these, requiring manual auth headers, pagination, and retry logic. When the VTEX auth token format changes, direct calls break while the client handles it transparently.

**Detection**

If you see direct HTTP calls to URLs matching `/api/dataentities/`, `api.vtex.com/api/dataentities`, or raw fetch/axios calls targeting Master Data endpoints, warn the developer to use `ctx.clients.masterdata` instead.

**Correct**

```typescript
// Using MasterDataClient through ctx.clients
export async function getReview(ctx: Context, next: () => Promise<void>) {
  const { id } = ctx.query;

  const review = await ctx.clients.masterdata.getDocument<Review>({
    dataEntity: "reviews",
    id: id as string,
    fields: [
      "id",
      "productId",
      "author",
      "rating",
      "title",
      "text",
      "approved",
    ],
  });

  ctx.status = 200;
  ctx.body = review;
  await next();
}
```

**Wrong**

```typescript
// Direct REST call to Master Data — bypasses client infrastructure
import axios from "axios";

export async function getReview(ctx: Context, next: () => Promise<void>) {
  const { id } = ctx.query;

  // No caching, no retry, no proper auth, no metrics
  const response = await axios.get(
    `https://api.vtex.com/api/dataentities/reviews/documents/${id}`,
    {
      headers: {
        "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY,
        "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN,
      },
    },
  );

  ctx.status = 200;
  ctx.body = response.data;
  await next();
}
```

---

### Constraint: Define JSON Schemas for All Data Entities

Every data entity your app uses MUST have a corresponding JSON Schema, either via the `masterdata` builder (recommended) or created via the Master Data API before the app is deployed.

**Why this matters**

Without a schema, Master Data stores documents as unstructured JSON. This means no field validation, no indexing (making search extremely slow on large datasets), no type safety, and no trigger support. Queries on unindexed fields perform full scans, which can time out or hit rate limits.

**Detection**

If the app creates or searches documents in a data entity but no JSON Schema exists for that entity (either in the `masterdata/` builder directory or via API), warn the developer to define a schema.

**Correct**

```json
{
  "$schema": "http://json-schema.org/schema#",
  "title": "review-schema-v1",
  "type": "object",
  "properties": {
    "productId": {
      "type": "string"
    },
    "author": {
      "type": "string"
    },
    "rating": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5
    },
    "title": {
      "type": "string",
      "maxLength": 200
    },
    "text": {
      "type": "string",
      "maxLength": 5000
    },
    "approved": {
      "type": "boolean"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time"
    }
  },
  "required": ["productId", "rating", "title", "text"],
  "v-default-fields": [
    "productId",
    "author",
    "rating",
    "title",
    "approved",
    "createdAt"
  ],
  "v-indexed": ["productId", "author", "approved", "rating", "createdAt"]
}
```

**Wrong**

```typescript
// Saving documents without any schema — no validation, no indexing
await ctx.clients.masterdata.createDocument({
  dataEntity: "reviews",
  fields: {
    productId: "12345",
    rating: "five", // String instead of number — no validation!
    title: 123, // Number instead of string — no validation!
  },
});

// Searching on unindexed fields — full table scan, will time out on large datasets
await ctx.clients.masterdata.searchDocuments({
  dataEntity: "reviews",
  where: "productId=12345", // productId is not indexed — very slow
  fields: ["id", "rating"],
  pagination: { page: 1, pageSize: 10 },
});
```

---

### Constraint: Manage Schema Versions to Avoid the 60-Schema Limit

Master Data v2 data entities have a limit of 60 schemas per entity. When using the `masterdata` builder, each app version linked or installed creates a new schema. You MUST delete unused schemas regularly.

**Why this matters**

Once the 60-schema limit is reached, the `masterdata` builder cannot create new schemas, and linking or installing new app versions will fail. This is a hard platform limit that cannot be increased.

**Detection**

If the app has been through many link/install cycles, warn the developer to check and clean up old schemas using the Delete Schema API.

**Correct**

```bash
# Periodically clean up unused schemas
# List schemas for the entity
curl -X GET "https://{account}.vtexcommercestable.com.br/api/dataentities/reviews/schemas" \
  -H "X-VTEX-API-AppKey: {appKey}" \
  -H "X-VTEX-API-AppToken: {appToken}"

# Delete old schemas that are no longer in use
curl -X DELETE "https://{account}.vtexcommercestable.com.br/api/dataentities/reviews/schemas/old-schema-name" \
  -H "X-VTEX-API-AppKey: {appKey}" \
  -H "X-VTEX-API-AppToken: {appToken}"
```

**Wrong**

```text
Never cleaning up schemas during development.
After 60 link cycles, the builder fails:
"Error: Maximum number of schemas reached for entity 'reviews'"
The app cannot be linked or installed until old schemas are deleted.
```

### Constraint: Do not use Master Data as a log, cache, or temporary store

Entities used for application **logging**, **caching** (IO app state, query results), or **temporary staging** data do not belong in Master Data. Use `ctx.vtex.logger` for logs, **VBase** for app-specific caches and temp state, and external log aggregation for audit trails.

**Why this matters** — Log and cache entities accumulate millions of documents, hit rate limits, make the entity unusable for legitimate queries, and waste storage. MD is not designed for high-write, high-volume, disposable data.

**Detection** — Entities with names like `LOG`, `cache`, `temp`, `staging`, `debug`, or entities whose document count grows unboundedly with traffic volume rather than business events.

**Correct**

```typescript
// Logs: use structured logger
ctx.vtex.logger.info({ action: "priceUpdate", skuId, newPrice });

// Cache: use VBase
await ctx.clients.vbase.saveJSON("my-cache", cacheKey, data);
```

**Wrong**

```typescript
// Using MD as a log store — creates millions of documents
await ctx.clients.masterdata.createDocument({
  dataEntity: "appLogs",
  fields: {
    level: "info",
    message: `Price updated for ${skuId}`,
    timestamp: new Date(),
  },
});
```

### Constraint: Do not create a parallel source of truth in Master Data without justification

Using Master Data to **mirror** data that already has a **system of record** in **OMS**, **Catalog**, or an **external ERP**—for example **order headers** for a custom list view, or **SKU attributes** that belong in **catalog specifications**—creates **drift**, **reconciliation** cost, and **incident** risk.

**Why this matters**

Two sources of truth disagree after partial failures, retries, or manual edits. Teams spend capacity syncing and debugging instead of **customer outcomes**.

**Detection**

New MD entities whose fields **duplicate** OMS order fields “for performance” without a **BFF cache** plan; **product** attributes stored in MD when **Catalog** specs would suffice; **scheduled jobs** to “fix” MD from OMS because they diverged.

**Correct**

```text
1. Identify the authoritative system (OMS, Catalog, partner API).
2. Read from that source via BFF or IO, with caching (application + HTTP semantics) as needed.
3. Use MD only for data without a native home or after explicit architecture sign-off.
```

**Wrong**

```text
"We store order snapshots in MD so the storefront is faster" while OMS remains canonical
and no reconciliation strategy exists — eventual inconsistency is guaranteed.
```

## Preferred pattern

Add the masterdata builder and policies:

```json
{
  "builders": {
    "node": "7.x",
    "graphql": "1.x",
    "masterdata": "1.x"
  },
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "api.vtex.com",
        "path": "/api/*"
      }
    },
    {
      "name": "ADMIN_DS"
    }
  ]
}
```

Define data entity schemas:

```json
{
  "$schema": "http://json-schema.org/schema#",
  "title": "review-schema-v1",
  "type": "object",
  "properties": {
    "productId": {
      "type": "string"
    },
    "author": {
      "type": "string"
    },
    "email": {
      "type": "string",
      "format": "email"
    },
    "rating": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5
    },
    "title": {
      "type": "string",
      "maxLength": 200
    },
    "text": {
      "type": "string",
      "maxLength": 5000
    },
    "approved": {
      "type": "boolean"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time"
    }
  },
  "required": ["productId", "rating", "title", "text"],
  "v-default-fields": [
    "productId",
    "author",
    "rating",
    "title",
    "approved",
    "createdAt"
  ],
  "v-indexed": ["productId", "author", "approved", "rating", "createdAt"],
  "v-cache": false
}
```

Set up the client with `masterDataFor`:

```typescript
// node/clients/index.ts
import { IOClients } from "@vtex/api";
import { masterDataFor } from "@vtex/clients";

interface Review {
  id: string;
  productId: string;
  author: string;
  email: string;
  rating: number;
  title: string;
  text: string;
  approved: boolean;
  createdAt: string;
}

export class Clients extends IOClients {
  public get reviews() {
    return this.getOrSet("reviews", masterDataFor<Review>("reviews"));
  }
}
```

Implement CRUD operations:

```typescript
// node/resolvers/reviews.ts
import type { ServiceContext } from "@vtex/api";
import type { Clients } from "../clients";

type Context = ServiceContext<Clients>;

export const queries = {
  reviews: async (
    _root: unknown,
    args: { productId: string; page?: number; pageSize?: number },
    ctx: Context,
  ) => {
    const { productId, page = 1, pageSize = 10 } = args;

    const results = await ctx.clients.reviews.search(
      { page, pageSize },
      [
        "id",
        "productId",
        "author",
        "rating",
        "title",
        "text",
        "createdAt",
        "approved",
      ],
      "", // sort
      `productId=${productId} AND approved=true`,
    );

    return results;
  },
};

export const mutations = {
  createReview: async (
    _root: unknown,
    args: {
      input: { productId: string; rating: number; title: string; text: string };
    },
    ctx: Context,
  ) => {
    const { input } = args;
    const email = ctx.vtex.storeUserEmail ?? "anonymous@store.com";

    const response = await ctx.clients.reviews.save({
      ...input,
      author: email.split("@")[0],
      email,
      approved: false,
      createdAt: new Date().toISOString(),
    });

    return ctx.clients.reviews.get(response.DocumentId, [
      "id",
      "productId",
      "author",
      "rating",
      "title",
      "text",
      "createdAt",
      "approved",
    ]);
  },

  deleteReview: async (_root: unknown, args: { id: string }, ctx: Context) => {
    await ctx.clients.reviews.delete(args.id);
    return true;
  },
};
```

Configure triggers (optional):

```json
{
  "name": "notify-moderator-on-new-review",
  "active": true,
  "condition": "approved=false",
  "action": {
    "type": "email",
    "provider": "default",
    "subject": "New review pending moderation",
    "to": ["moderator@mystore.com"],
    "body": "A new review has been submitted for product {{productId}} by {{author}}."
  },
  "retry": {
    "times": 3,
    "delay": { "addMinutes": 5 }
  }
}
```

Wire into Service:

```typescript
// node/index.ts
import type { ParamsContext, RecorderState } from "@vtex/api";
import { Service } from "@vtex/api";

import { Clients } from "./clients";
import { queries, mutations } from "./resolvers/reviews";

export default new Service<Clients, RecorderState, ParamsContext>({
  clients: {
    implementation: Clients,
    options: {
      default: {
        retries: 2,
        timeout: 5000,
      },
    },
  },
  graphql: {
    resolvers: {
      Query: queries,
      Mutation: mutations,
    },
  },
});
```

## Common failure modes

- **Direct REST calls to /api/dataentities/**: Using `axios` or `fetch` to call Master Data endpoints bypasses the client infrastructure — no auth, no caching, no retries. Use `ctx.clients.masterdata` or `masterDataFor` instead.
- **Searching without indexed fields**: Queries on non-indexed fields trigger full document scans. For large datasets, this causes timeouts and rate limit errors. Ensure all `where` clause fields are in the schema's `v-indexed` array.
- **Not paginating search results**: Master Data v2 has a maximum page size of 100 documents. Requesting more silently returns only up to the limit. Use proper pagination or `scrollDocuments` for large result sets.
- **Ignoring the 60-schema limit**: Each app version linked/installed creates a new schema. After 60 link cycles, the builder fails. Periodically clean up unused schemas via the Delete Schema API.
- **Using MD for logs or caches**: Entities that grow with traffic volume instead of business events. Millions of log or cache documents degrade the account's MD performance.
- **Bulk import without rate limiting**: Flooding MD with parallel writes triggers 429 errors and account-wide throttling. Always use bounded concurrency with backoff.
- **Import without validation**: Importing data without cross-referencing the catalog or user store leads to orphaned documents, broken references, and data that fails schema validation silently.
- **No checkpoint in bulk operations**: A 50k-document import that fails at document 30k must restart from zero without a checkpoint file.

## Review checklist

- [ ] Is the `masterdata` builder declared in `manifest.json`?
- [ ] Do all data entities have JSON Schemas with proper field definitions?
- [ ] Are all `where` clause fields declared in `v-indexed`?
- [ ] Are CRUD operations using `ctx.clients.masterdata` or `masterDataFor` (no direct REST calls)?
- [ ] Is pagination properly handled (max 100 per page, scroll for large sets)?
- [ ] Is there a plan for schema cleanup to avoid the 60-schema limit?
- [ ] Are required policies (`outbound-access`, `ADMIN_DS`) declared in the manifest?
- [ ] Was **Catalog** or native stores ruled in/out before MD for **product** or **order** data?
- [ ] Is MD **off** the **purchase critical path** unless explicitly justified?
- [ ] If exposing MD externally, is access through a **controlled** IO/BFF layer with **auth**?
- [ ] Is the entity **not** being used for **logging**, **caching**, or **temporary** data?
- [ ] For bulk operations, are **rate limiting**, **backoff**, and **checkpoints** implemented?
- [ ] Is import data **validated** against the authoritative source before writing to MD?
- [ ] Are **native entities** (CL, AD, OD, etc.) identified and not duplicated by custom entities?

## Related skills

- [vtex-io-masterdata-strategy](../vtex-io-masterdata-strategy/SKILL.md) — When to use MD, `v-*` schema extensions reference, indexing strategy, triggers, capacity planning
- [vtex-io-application-performance](../vtex-io-application-performance/SKILL.md) — IO performance patterns (cache layers, BFF-facing behavior)
- [vtex-io-service-paths-and-cdn](../vtex-io-service-paths-and-cdn/SKILL.md) — Public vs private routes for MD-backed APIs
- [vtex-io-session-apps](../vtex-io-session-apps/SKILL.md) — Session transforms that may read from or complement MD-stored state
- [architecture-well-architected-commerce](../../../architecture/skills/architecture-well-architected-commerce/SKILL.md) — Cross-cutting storage and pillar alignment
- [headless-bff-architecture](../../../headless/skills/headless-bff-architecture/SKILL.md) — BFF boundaries when MD is not accessed from IO

## Reference

- [Creating a Master Data v2 CRUD App](https://developers.vtex.com/docs/guides/create-master-data-crud-app) — Complete guide for building Master Data apps with the masterdata builder
- [Working with JSON Schemas in Master Data v2](https://developers.vtex.com/docs/guides/working-with-json-schemas-in-master-data-v2) — Schema structure, validation, and indexing configuration
- [Schema Lifecycle](https://developers.vtex.com/docs/guides/master-data-schema-lifecycle) — How schemas evolve and impact data entities over time
- [Setting Up Triggers on Master Data v2](https://developers.vtex.com/docs/guides/setting-up-triggers-on-master-data-v2) — Trigger configuration for automated workflows
- [Master Data v2 API Reference](https://developers.vtex.com/docs/api-reference/master-data-api-v2#overview) — Complete API reference for all Master Data v2 endpoints
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — MasterDataClient methods and usage in VTEX IO
