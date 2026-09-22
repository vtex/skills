This skill provides guidance for AI agents working with VTEX Custom VTEX IO Apps. Apply these constraints and patterns when assisting developers with apply when working with GraphQL schema files in graphql/ or implementing resolvers in node/resolvers/ for VTEX IO apps. Covers schema.graphql definitions, @cacheControl and @auth directives, custom type definitions, and resolver registration in the Service class. Use for exposing data through GraphQL queries and mutations with proper cache control and authentication enforcement.

# GraphQL Schemas & Resolvers

## When this skill applies

Use this skill when your VTEX IO app needs to expose a GraphQL API — either for frontend React components to query, for other VTEX IO apps to consume, or for implementing custom data aggregation layers over VTEX Commerce APIs.

- Defining schemas in `.graphql` files in the `/graphql` directory
- Writing resolver functions in TypeScript in `/node/resolvers/`
- Configuring `@cacheControl` and `@auth` directives
- Wiring resolvers into the Service class

Do not use this skill for:
- Backend service structure and client system (use `vtex-io-service-apps` instead)
- Manifest and builder configuration (use `vtex-io-app-structure` instead)
- MasterData integration details (use `vtex-io-masterdata` instead)

## Decision rules

- The `graphql` builder processes `.graphql` files in `/graphql` and merges them into a single schema.
- Split definitions across multiple files for maintainability: `schema.graphql` for root types, `directives.graphql` for directive declarations, `types/*.graphql` for custom types.
- Use `@cacheControl(scope: PUBLIC, maxAge: SHORT|MEDIUM|LONG)` on all public Query fields. `PUBLIC` = shared CDN cache, `PRIVATE` = per-user cache.
- Use `@auth` on all Mutations and on Queries that return sensitive or user-specific data.
- Never use `@cacheControl` on Mutations.
- Resolver function keys in the Service entry point MUST exactly match the field names in `schema.graphql`.
- Always use `ctx.clients` in resolvers for data access — never raw HTTP calls.

Recommended directory structure:

```text
graphql/
├── schema.graphql        # Query and Mutation root type definitions
├── directives.graphql    # Custom directive declarations (@cacheControl, @auth)
└── types/
    ├── Review.graphql    # Custom type definitions
    └── Product.graphql   # One file per type for organization
```

Built-in directives:
- **`@cacheControl`**: `scope` (`PUBLIC`/`PRIVATE`), `maxAge` (`SHORT` 30s, `MEDIUM` 5min, `LONG` 1h)
- **`@auth`**: Enforces valid VTEX authentication token. Without it, unauthenticated users can call the endpoint.
- **`@smartcache`**: Automatically caches query results in VTEX infrastructure.

## Hard constraints

### Constraint: Declare the graphql Builder

Any app using `.graphql` schema files MUST declare the `graphql` builder in `manifest.json`. The `graphql` builder interprets the schema and registers it with the VTEX IO runtime.

**Why this matters**

Without the `graphql` builder declaration, the `/graphql` directory is completely ignored. Schema files will not be processed, resolvers will not be registered, and GraphQL queries will return "schema not found" errors. The app will link without errors but GraphQL will silently not work.

**Detection**

If you see `.graphql` files in a `/graphql` directory but the manifest does not include `"graphql": "1.x"` in `builders`, STOP and add the builder declaration.

**Correct**

```json
{
  "builders": {
    "node": "7.x",
    "graphql": "1.x"
  }
}
```

**Wrong**

```json
{
  "builders": {
    "node": "7.x"
  }
}
```

Missing `"graphql": "1.x"` — the `/graphql` directory with schema files is ignored. GraphQL queries return errors because no schema is registered. The app links successfully, masking the problem.

---

### Constraint: Use @cacheControl on Public Queries

All public-facing Query fields (those fetching data that is not user-specific) MUST include the `@cacheControl` directive with an appropriate `scope` and `maxAge`. Mutations MUST NOT use `@cacheControl`.

**Why this matters**

Without `@cacheControl`, every query hits your resolver on every request — no CDN caching, no edge caching, no shared caching. This leads to unnecessary load on VTEX infrastructure, slow response times, and potential rate limiting. For public product data, caching is critical for performance.

**Detection**

If a Query field returns public data (not user-specific) and does not have `@cacheControl`, warn the developer to add it. If a Mutation has `@cacheControl`, STOP and remove it.

**Correct**

```graphql
type Query {
  reviews(productId: String!, limit: Int): [Review]
    @cacheControl(scope: PUBLIC, maxAge: SHORT)

  productMetadata(slug: String!): ProductMetadata
    @cacheControl(scope: PUBLIC, maxAge: MEDIUM)

  myReviews: [Review]
    @cacheControl(scope: PRIVATE, maxAge: SHORT)
    @auth
}

type Mutation {
  createReview(review: ReviewInput!): Review @auth
}
```

**Wrong**

```graphql
type Query {
  reviews(productId: String!, limit: Int): [Review]

  myReviews: [Review]
}

type Mutation {
  createReview(review: ReviewInput!): Review
    @cacheControl(scope: PUBLIC, maxAge: LONG)
}
```

No cache control on queries (every request hits the resolver), missing `@auth` on user-specific data, and `@cacheControl` on a mutation (makes no sense).

---

### Constraint: Resolver Names Must Match Schema Fields

Resolver function keys in the Service entry point MUST exactly match the field names defined in `schema.graphql`. The resolver object structure must mirror the GraphQL type hierarchy.

**Why this matters**

The GraphQL runtime maps incoming queries to resolver functions by name. If the resolver key does not match the schema field name, the field will resolve to `null` without any error — a silent failure that is extremely difficult to debug.

**Detection**

If a schema field has no matching resolver key (or vice versa), STOP. Cross-check every Query and Mutation field against the resolver registration in `node/index.ts`.

**Correct**

```graphql
type Query {
  reviews(productId: String!): [Review]
  reviewById(id: ID!): Review
}
```

```typescript
// node/index.ts — resolver keys match schema field names exactly
export default new Service({
  graphql: {
    resolvers: {
      Query: {
        reviews: reviewsResolver,
        reviewById: reviewByIdResolver,
      },
    },
  },
})
```

**Wrong**

```typescript
// node/index.ts — resolver key "getReviews" does not match schema field "reviews"
export default new Service({
  graphql: {
    resolvers: {
      Query: {
        getReviews: reviewsResolver,    // Wrong! Schema says "reviews", not "getReviews"
        getReviewById: reviewByIdResolver, // Wrong! Schema says "reviewById"
      },
    },
  },
})
```

Both fields will silently resolve to null. No error in logs.

## Preferred pattern

Add the GraphQL builder to manifest:

```json
{
  "builders": {
    "node": "7.x",
    "graphql": "1.x"
  }
}
```

Define the schema:

```graphql
type Query {
  reviews(productId: String!, limit: Int, offset: Int): ReviewsResponse
    @cacheControl(scope: PUBLIC, maxAge: SHORT)

  review(id: ID!): Review
    @cacheControl(scope: PUBLIC, maxAge: SHORT)
}

type Mutation {
  createReview(input: ReviewInput!): Review @auth
  updateReview(id: ID!, input: ReviewInput!): Review @auth
  deleteReview(id: ID!): Boolean @auth
}
```

Define custom types:

```graphql
type Review {
  id: ID!
  productId: String!
  author: String!
  rating: Int!
  title: String!
  text: String!
  createdAt: String!
  approved: Boolean!
}

type ReviewsResponse {
  data: [Review!]!
  total: Int!
  hasMore: Boolean!
}

input ReviewInput {
  productId: String!
  rating: Int!
  title: String!
  text: String!
}
```

Declare directives:

```graphql
directive @cacheControl(
  scope: CacheControlScope
  maxAge: CacheControlMaxAge
) on FIELD_DEFINITION

enum CacheControlScope {
  PUBLIC
  PRIVATE
}

enum CacheControlMaxAge {
  SHORT
  MEDIUM
  LONG
}

directive @auth on FIELD_DEFINITION
directive @smartcache on FIELD_DEFINITION
```

Implement resolvers:

```typescript
// node/resolvers/reviews.ts
import type { ServiceContext } from '@vtex/api'
import type { Clients } from '../clients'

type Context = ServiceContext<Clients>

export const queries = {
  reviews: async (
    _root: unknown,
    args: { productId: string; limit?: number; offset?: number },
    ctx: Context
  ) => {
    const { productId, limit = 10, offset = 0 } = args
    const reviews = await ctx.clients.masterdata.searchDocuments<Review>({
      dataEntity: 'reviews',
      fields: ['id', 'productId', 'author', 'rating', 'title', 'text', 'createdAt', 'approved'],
      where: `productId=${productId} AND approved=true`,
      pagination: { page: Math.floor(offset / limit) + 1, pageSize: limit },
      schema: 'review-schema-v1',
    })

    return {
      data: reviews,
      total: reviews.length,
      hasMore: reviews.length === limit,
    }
  },

  review: async (
    _root: unknown,
    args: { id: string },
    ctx: Context
  ) => {
    return ctx.clients.masterdata.getDocument<Review>({
      dataEntity: 'reviews',
      id: args.id,
      fields: ['id', 'productId', 'author', 'rating', 'title', 'text', 'createdAt', 'approved'],
    })
  },
}

export const mutations = {
  createReview: async (
    _root: unknown,
    args: { input: ReviewInput },
    ctx: Context
  ) => {
    const { input } = args

    const documentResponse = await ctx.clients.masterdata.createDocument({
      dataEntity: 'reviews',
      fields: {
        ...input,
        author: ctx.vtex.storeUserEmail ?? 'anonymous',
        approved: false,
        createdAt: new Date().toISOString(),
      },
      schema: 'review-schema-v1',
    })

    return ctx.clients.masterdata.getDocument<Review>({
      dataEntity: 'reviews',
      id: documentResponse.DocumentId,
      fields: ['id', 'productId', 'author', 'rating', 'title', 'text', 'createdAt', 'approved'],
    })
  },

  deleteReview: async (
    _root: unknown,
    args: { id: string },
    ctx: Context
  ) => {
    await ctx.clients.masterdata.deleteDocument({
      dataEntity: 'reviews',
      id: args.id,
    })

    return true
  },
}
```

Wire resolvers into the Service:

```typescript
// node/index.ts
import type { ParamsContext, RecorderState } from '@vtex/api'
import { Service } from '@vtex/api'

import { Clients } from './clients'
import { queries, mutations } from './resolvers/reviews'

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
})
```

Testing the GraphQL API after linking:

```graphql
query GetReviews {
  reviews(productId: "12345", limit: 5) {
    data {
      id
      author
      rating
      title
      text
      createdAt
    }
    total
    hasMore
  }
}

mutation CreateReview {
  createReview(input: {
    productId: "12345"
    rating: 5
    title: "Excellent product"
    text: "Really happy with this purchase."
  }) {
    id
    author
    createdAt
  }
}
```

## Common failure modes

- **Defining resolvers without matching schema fields**: The GraphQL runtime only exposes fields defined in the schema. Resolvers without matching fields are silently ignored. Conversely, schema fields without resolvers return `null`. Always define the schema first, then implement matching resolvers with identical names.
- **Querying external APIs directly in resolvers**: Using `fetch()` or `axios` bypasses the `@vtex/api` client system, losing caching, retries, metrics, and authentication. Always use `ctx.clients` in resolvers.
- **Missing @auth on mutation endpoints**: Without `@auth`, any anonymous user can call the mutation — a critical security vulnerability. Always add `@auth` to mutations and queries returning sensitive data.
- **Missing @cacheControl on public queries**: Every request hits the resolver without caching, causing unnecessary load and slow responses. Add appropriate cache directives to all public Query fields.

## Review checklist

- [ ] Is the `graphql` builder declared in `manifest.json`?
- [ ] Do all public Query fields have `@cacheControl` with appropriate scope and maxAge?
- [ ] Do all Mutations and sensitive Queries have `@auth`?
- [ ] Do resolver function keys exactly match schema field names?
- [ ] Are resolvers using `ctx.clients` for data access (no raw HTTP calls)?
- [ ] Are directive declarations present in `directives.graphql`?
- [ ] Is the resolver wired into the Service entry point under `graphql.resolvers`?

## Related skills

- [`vtex-io-service-apps`](../vtex-io-service-apps/skill.md) — Service app fundamentals needed for all GraphQL resolvers
- [`vtex-io-app-contract`](../vtex-io-app-contract/skill.md) — Manifest and builder configuration that GraphQL depends on
- [`vtex-io-masterdata`](../vtex-io-masterdata/skill.md) — MasterData integration commonly used as a data source in resolvers

## Reference

- [GraphQL in VTEX IO](https://developers.vtex.com/docs/guides/graphql-in-vtex-io) — Overview of GraphQL usage in the VTEX IO platform
- [GraphQL Builder](https://developers.vtex.com/docs/guides/vtex-io-documentation-graphql-builder) — Builder reference for schema processing and directory structure
- [Developing a GraphQL API in Service Apps](https://developers.vtex.com/docs/guides/developing-a-graphql-api-in-service-apps) — Step-by-step tutorial for building GraphQL APIs
- [Integrating an App with a GraphQL API](https://developers.vtex.com/docs/guides/integrating-an-app-with-a-graphql-api) — How to consume GraphQL APIs from other VTEX IO apps
- [GraphQL authorization in IO apps](https://developers.vtex.com/docs/guides/graphql-authorization-in-io-apps) — How to implement and use the `@auth` directive for protected GraphQL operations
- [Implementing cache in GraphQL APIs for IO apps](https://developers.vtex.com/docs/guides/implementing-cache-in-graphql-apis-for-io-apps) — How to implement and use the `@cacheControl` directive for GraphQL operations
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — How to use ctx.clients in resolvers for data access
