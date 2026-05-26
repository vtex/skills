# Custom VTEX IO Apps

Guide to building custom VTEX IO applications, covering builders, policies, `@vtex/api` clients, service patterns, and app development best practices. This track covers everything needed to build production-ready VTEX IO apps that extend the VTEX platform with custom functionality.

## Overview

VTEX IO is a serverless platform for building custom applications that extend VTEX Commerce. This track teaches developers how to scaffold VTEX IO apps, configure builders (`node`, `react`, `graphql`, `admin`, `pixel`, `messages`, `store`), declare policies for API access, implement backend services with the `Service` class and client system, build frontend React components and Store Framework blocks, expose APIs, and manage data and configuration safely.

The VTEX IO track is being reorganized into smaller, more decision-oriented skills. The current source files still reflect the older structure in some places, but the intended model is grouped as follows.

## Planned Grouping

### Group 1: Foundations

- `vtex-io-app-contract`
- `vtex-io-service-runtime`
- `vtex-io-client-integration`

### Group 2: API exposure

- `vtex-io-graphql-api`
- `vtex-io-http-routes`
- `vtex-io-events-and-workers`

### Group 3: Frontend

- `vtex-io-storefront-theme-app`
- `vtex-io-storefront-theme-versioning`
- `vtex-io-storefront-react`
- `vtex-io-admin-react`
- `vtex-io-render-runtime-and-blocks`

### Group 4: Data and config

- `vtex-io-app-settings`
- `vtex-io-masterdata-strategy`
- `vtex-io-data-access-patterns`

### Group 5: Security and operations

- `vtex-io-auth-and-policies`
- `vtex-io-security-boundaries`
- `vtex-io-observability-and-ops`

## Skills

The table below reflects the currently published VTEX IO skills in this repository. It will evolve toward the grouped structure above.

| Skill | Description | Link |
|-------|-------------|------|
| **App Contract & Builder Boundaries** | Define manifest-level contract decisions such as builders, identity, dependencies, peer dependencies, and billing behavior. | [skills/vtex-io-app-contract/skill.md](skills/vtex-io-app-contract/skill.md) |
| **Service Runtime & Execution Model** | Structure `node/index.ts`, `service.json`, and runtime wiring for routes, events, handlers, and rate limits. | [skills/vtex-io-service-runtime/skill.md](skills/vtex-io-service-runtime/skill.md) |
| **Client Integration & Service Access** | Choose VTEX and external client abstractions, register `IOClients`, and consume integrations through `ctx.clients`. | [skills/vtex-io-client-integration/skill.md](skills/vtex-io-client-integration/skill.md) |
| **App Architecture & Manifest Configuration** | Configure `manifest.json` with builders, policies, dependencies, and `service.json` resource limits. Understand the app lifecycle (link, publish, deploy). | [skills/vtex-io-app-structure/skill.md](skills/vtex-io-app-structure/skill.md) |
| **Backend Service Apps & API Clients** | Build backend services using the Service class, implement middleware chains, register and use clients (JanusClient, ExternalClient, MasterDataClient), and configure routes in `service.json`. | [skills/vtex-io-service-apps/skill.md](skills/vtex-io-service-apps/skill.md) |
| **HTTP Routes & Handler Boundaries** | Design explicit HTTP endpoints, route handlers, middleware composition, request validation, and response contracts for VTEX IO services. | [skills/vtex-io-http-routes/skill.md](skills/vtex-io-http-routes/skill.md) |
| **Events, Workers & Async Processing** | Design asynchronous flows through events and workers with idempotency, retry-safe processing, and clear background failure handling. | [skills/vtex-io-events-and-workers/skill.md](skills/vtex-io-events-and-workers/skill.md) |
| **Service paths & CDN behavior** | Choose `public` vs `/_v/segment` vs `/_v/private` routes in `service.json`, align cookies and edge caching with data scope, and set HTTP cache headers safely. | [skills/vtex-io-service-paths-and-cdn/skill.md](skills/vtex-io-service-paths-and-cdn/skill.md) |
| **Application performance** | Improve latency and resilience with LRU, VBase, stale-while-revalidate, AppSettings loading, parallel client calls, resolver deduplication, per-entity VBase keys, and service.json tuning—plus rules on what must never be cached (transactional data) and when VBase writes must be awaited (financial flows). | [skills/vtex-io-application-performance/skill.md](skills/vtex-io-application-performance/skill.md) |
| **Session transform apps** | Build or debug session transforms: namespace ownership, input-vs-output fields, transform ordering (DAG), public-as-input vs private-as-read, cross-namespace propagation, and caching inside transforms for B2B, pricing, or regionalization context. | [skills/vtex-io-session-apps/skill.md](skills/vtex-io-session-apps/skill.md) |
| **Storefront Theme App** | Decide what a theme app owns: `store/blocks.json`, `store/routes.json`, `store/templates/`, `store/contentSchemas.json`, base-theme extension, and how block IDs from component apps are composed into pages. | [skills/vtex-io-storefront-theme-app/skill.md](skills/vtex-io-storefront-theme-app/skill.md) |
| **Storefront Theme Versioning, Install & Rollback** | Safely version, install, promote, and roll back a content-holding storefront app. Covers content keying by `vendor.app@MAJOR.x`, why a major bump leaves the new major with no merchant content and falls back to default theme content, the production-flag dev workspace install + `updateThemeIds` migration + smoke-test + promote workflow, the 3-way mine-wins merge that `vtex workspace promote` performs against `vtex.pages-graphql` VBase (with automatic per-minute backups in `userData_backup`), and emergency rollback. | [skills/vtex-io-storefront-theme-versioning/skill.md](skills/vtex-io-storefront-theme-versioning/skill.md) |
| **Storefront React Components** | Build shopper-facing VTEX IO React components with css-handles, storefront-safe rendering, and localized UI behavior. | [skills/vtex-io-storefront-react/skill.md](skills/vtex-io-storefront-react/skill.md) |
| **Admin React Interfaces** | Build VTEX Admin experiences with Styleguide, explicit operational states, and safe admin interaction patterns. | [skills/vtex-io-admin-react/skill.md](skills/vtex-io-admin-react/skill.md) |
| **Render Runtime & Block Registration** | Register and compose Store Framework blocks through `interfaces.json` and render-runtime contracts. | [skills/vtex-io-render-runtime-and-blocks/skill.md](skills/vtex-io-render-runtime-and-blocks/skill.md) |
| **Frontend React Components & Hooks** | Create React components in the `/react` directory, register them as Store Framework blocks via `interfaces.json`, configure Site Editor props with `contentSchemas.json`, and use VTEX Styleguide and css-handles. | [skills/vtex-io-react-apps/skill.md](skills/vtex-io-react-apps/skill.md) |
| **App Settings & Configuration Boundaries** | Model `settingsSchema`, merchant-configurable behavior, and safe settings consumption patterns. | [skills/vtex-io-app-settings/skill.md](skills/vtex-io-app-settings/skill.md) |
| **Service Configuration Apps** | Design configuration apps with the `configuration` builder and inject shared structured configuration through `ctx.vtex.settings`. | [skills/vtex-io-service-configuration-apps/skill.md](skills/vtex-io-service-configuration-apps/skill.md) |
| **Master Data Strategy** | Decide when Master Data is the right storage mechanism and how to design entity boundaries, indexing, and schema lifecycle. | [skills/vtex-io-masterdata-strategy/skill.md](skills/vtex-io-masterdata-strategy/skill.md) |
| **Data Access Patterns** | Decide where VTEX IO apps should store data, which system is the source of truth, and when to use settings, Master Data, VBase, core APIs, caches, or external stores. | [skills/vtex-io-data-access-patterns/skill.md](skills/vtex-io-data-access-patterns/skill.md) |
| **Messages & Internationalization** | Model translated copy through the `messages` builder, `/messages/*.json`, `context.json`, and VTEX IO message consumption patterns. | [skills/vtex-io-messages-and-i18n/skill.md](skills/vtex-io-messages-and-i18n/skill.md) |
| **GraphQL Schemas & Resolvers** | Define GraphQL schemas in `.graphql` files, write resolver functions, use `@cacheControl` and `@auth` directives, and wire resolvers into the Service class. | [skills/vtex-io-graphql-api/skill.md](skills/vtex-io-graphql-api/skill.md) |
| **MasterData v2 Integration** | Define data entities with JSON Schemas via the `masterdata` builder, perform CRUD through MasterDataClient, configure search/scroll, set up triggers, audit entity governance and bulk operations—and **challenge** whether Master Data is the right place at all. | [skills/vtex-io-masterdata/skill.md](skills/vtex-io-masterdata/skill.md) |
| **Auth Tokens & Request Context** | Choose between app, shopper, and Admin auth tokens and propagate the correct requester identity through VTEX clients. | [skills/vtex-io-auth-tokens-and-context/skill.md](skills/vtex-io-auth-tokens-and-context/skill.md) |
| **Authorization & Policy Design** | Decide which VTEX IO permissions and outbound-access rules an app needs, and keep policies explicit and minimal. | [skills/vtex-io-auth-and-policies/skill.md](skills/vtex-io-auth-and-policies/skill.md) |
| **Security Boundaries & Exposure Review** | Review trust boundaries, public versus private exposure, sensitive data handling, and tenant/context isolation in VTEX IO services. | [skills/vtex-io-security-boundaries/skill.md](skills/vtex-io-security-boundaries/skill.md) |
| **Observability & Operational Readiness** | Improve production visibility with better logging, metrics, failure surfacing, and rate-limit-aware operational guidance. | [skills/vtex-io-observability-and-ops/skill.md](skills/vtex-io-observability-and-ops/skill.md) |
| **rootPath for multi-binding** | Build IO apps that work correctly in multi-binding stores with path prefixes (e.g. `store.com/us/`). Extract rootPath from headers or runtime, prefix all generated URLs, and handle sanitization. | [skills/vtex-io-rootpath/skill.md](skills/vtex-io-rootpath/skill.md) |
| **Access control (RBAC)** | Secure IO app routes with role-based (`policies.json`) or resource-based (`service.json` policies) access control. VRN syntax for principals, `@auth` directive for GraphQL, and choosing the right policy type for apps vs users vs integrations. | [skills/vtex-io-rbac/skill.md](skills/vtex-io-rbac/skill.md) |

## Recommended Learning Order

1. **Start with App Architecture** — Understand `manifest.json`, builders, and policies first. This is the foundation for all VTEX IO apps.
2. **Learn Backend Services** — Understand the Service class, clients, and middleware pattern for building backend logic.
3. **Service paths & application performance** — After you have routes, align **path patterns** with **cookies** and **edge caching**; add **LRU/VBase**, **parallel** fetches, **resolver deduplication**, and **efficient** AppSettings/context where needed. Understand what must never be cached (transactional data) and when VBase writes must be awaited.
4. **Add Frontend Components** — Learn how to build React components and register them as Store Framework blocks. For storefront-facing work, also learn how a theme app composes those blocks (`vtex-io-storefront-theme-app`) and how to safely change the installed theme version on `master` (`vtex-io-storefront-theme-versioning`).
5. **Expose GraphQL APIs** — Learn how to define schemas and resolvers for data access.
6. **Session transforms** — When your app needs to derive session state (B2B pricing, regionalization, custom context), learn namespace ownership, input propagation, and caching inside transforms.
7. **Store Custom Data** — Use Master Data v2 only after **scrutinizing** the storage choice: confirm MD fits the workload, audit entity governance, or use another VTEX surface or external DB.

## Planned Learning Flow

1. **Foundations** — Start with app contract, service runtime, and client integration.
2. **API exposure** — Choose between `graphql`, `http-routes`, and `events-and-workers` based on the integration shape.
3. **Frontend** — Split storefront React, admin React, and render/runtime concerns.
4. **Data and config** — Separate app settings, Master Data strategy, and general data access patterns.
5. **Security and operations** — Finish with auth, policy boundaries, and operational visibility.

## Choosing The API Exposure Skill

- Use `vtex-io-graphql-api` when frontend or app consumers need structured querying and typed aggregation.
- Use `vtex-io-http-routes` for explicit integration endpoints, callbacks, or webhook-style contracts.
- Use `vtex-io-events-and-workers` for asynchronous processing, retries, and work that should not block a request-response cycle.

## Key Constraints Summary

- **`manifest.json` is mandatory** — Every VTEX IO app requires a valid manifest. Without it, the app cannot be linked, published, or deployed.
- **Builders must be declared in `manifest.json`** — Only declared builders are processed. Undeclared builders are ignored.
- **Policies are required for external access** — Declare policies for outbound-access (external URLs) and VTEX resources. Missing policies cause 403 Forbidden errors.
- **Always use `ctx.clients` for API access** — Never instantiate clients directly. The `ctx.clients` pattern provides caching, retry, and metrics.
- **Match route prefix to data scope** — Public vs `/_v/segment` vs `/_v/private` controls cookies and edge caching ([Service path patterns](https://developers.vtex.com/docs/guides/service-path-patterns)); do not CDN-cache private or auth-scoped JSON.
- **Layer application performance patterns deliberately** — LRU for hot keys, VBase for shared stale-while-revalidate, **tenant-scoped** in-memory keys (`account` + `workspace`) on shared pods. Every outbound call needs an **explicit timeout**; degrade gracefully when upstreams are slow. Never cache payment state or active transactions; other transactional data (order forms, cart simulations) may use short-lived caches (1–5 min) only with explicit justification. Await VBase writes in financial/idempotency-critical paths.
- **Session transforms: own your namespace** — Each session app owns its output namespace; never write to another app's output namespace. Use `public.*` for input propagation only, not as a read model. Frontend reads private namespaces for business state.
- **Use rootPath in multi-binding stores** — All generated URLs (links, redirects, canonicals, sitemaps) must include `rootPath` from `x-vtex-root-path` header (backend) or `useRuntime()` (frontend). Sanitize `"/"` to `""` to avoid double slashes.
- **Choose the correct access control type** — Role-based (`policies.json`) for app-to-app only; resource-based (`service.json` policies) when users or API keys need access. Deny policies override allow for overlapping principals.
- **Never use third-party UI libraries in admin apps** — Admin apps MUST use VTEX Styleguide. Third-party libraries break consistency and are not supported.
- **Use css-handles for storefront styling** — Never hardcode class names. Use `useCssHandles()` to expose safe CSS classes for customization.
- **Major version bumps on content-holding apps require an `updateThemeIds` migration** — `vtex.pages-graphql` keys merchant routes, templates, Site Editor edits, Pages, and Redirects by `vendor.app@MAJOR.x:template`. A major bump on any app that ships `store/blocks.json`, `store/routes.json`, `store/templates/`, or `store/contentSchemas.json` makes the previously authored content invisible to the resolver under the new major, so the storefront falls back to default `vtex.store-theme` content. The official fix is the `updateThemeIds` mutation in `vtex.pages-graphql@2.x`, run from the GraphQL Admin IDE in a production-flag dev workspace (`vtex use $name --production`) after `vtex install` of the new major and before `vtex workspace promote`. Smoke-test, then promote — see `vtex-io-storefront-theme-versioning`.
- **`vtex workspace promote` 3-way merges pages-graphql VBase, mine-wins** — Promote does not wipe master `vtex.pages-graphql` content. It runs `MineWinsConflictsResolver`: keys not touched by the dev workspace are preserved on master, conflicting keys are resolved in favor of the dev workspace, and `vtex.pages-graphql` writes per-minute `base`/`master`/`mine` snapshots to its `userData_backup` bucket whenever conflicts are resolved in production. Coordinate the rollout window so concurrent Site Editor edits in master are paused between `updateThemeIds` and promote.
- **Block IDs are scoped by the declaring app's installed major** — A block declared in `acme.product-widgets@0.x` is not the same block as one declared in `acme.product-widgets@5.x`, even with the same ID. Consumer themes must match the declaring app's installed major or the resolver returns `Missing block`.
- **Master Data has a 60-schema-per-entity hard limit** — Plan your schema versioning strategy to avoid hitting this limit.

## Related Tracks

- **For frontend-only approaches**, see [Track 1: FastStore Implementation & Customization](../faststore/index.md) — Use FastStore for pre-built storefront components.
- **For payment connectors**, see [Track 2: Payment Connector Development](../payment/index.md) — Build payment connectors as VTEX IO apps.
- **For marketplace integrations**, see [Track 4: Marketplace Integration](../marketplace/index.md) — Build marketplace connectors as VTEX IO apps.
