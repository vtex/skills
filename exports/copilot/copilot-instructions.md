# VTEX Development Skills

These instructions provide guidance for AI-assisted VTEX platform development.

# Well-Architected Commerce & Solution Architecture

# Well-Architected Commerce on VTEX

## When this skill applies

Use this skill when the task is **cross-cutting** or **decision-oriented** across VTEX commerce capabilities — not when a single product skill already fully defines the work.

- Defining or reviewing **solution architecture** (storefront model + integrations + operations).
- Choosing between **native VTEX capabilities** and **custom services** (IO apps, external BFFs, middleware).
- Running an **architecture or readiness review** (security baseline, scalability posture, observability, delivery process).
- **Scoping** work that will span FastStore, Headless, VTEX IO, Marketplace, Payments and/or any other VTEX module.

**Do not** use this skill as a substitute for product skills when the task is already localized (e.g. “implement PPP refunds” → payment track; “Feed v3 vs Hook” → marketplace track).

### Three pillars (framework)

These pillars are the **Well-Architected Commerce** lens for every architecture choice. Summaries below follow the internal framework narrative; for **full objectives, core values, and critical areas of focus**, use the **Well-Architected Commerce MCP** (and your program’s canonical framework document).

#### Technical Foundation

**Objective:** A secure, reliable, compliant base that earns **trust**.

**Core values:** **Reliability** (consistent performance), **Trust** (transparent, accountable processes), **Integrity** (ethical handling of data, code, and resources).

**Critical areas (examples):** Advanced security (data protection, transaction security, threat awareness); reliable infrastructure (availability, scalability, recovery); compliance (regulations, audit trails, monitoring). **Continuous learning** keeps guidance current with technology and VTEX direction.

_Nothing in Future-proof or Operational Excellence relaxes this pillar._

#### Future-proof

**Objective:** Solutions that stay **adaptable** and **maintainable** as the business and platform evolve.

**Core values:** **Innovation** (current VTEX and industry best practices), **Simplicity** (the overarching value—minimum viable custom surface, whole-solution coherence), **Efficiency** (optimize effort and platform use).

**Critical areas (examples):** Scalable solutions; business and market adaptability; modular / compositional design; rapid deployment (agile delivery, CI/CD); **system integration** (VTEX-centric, API-first connectivity).

#### Operational Excellence

**Objective:** Run the program with **data-informed** decisions and **accountable** execution.

**Core values:** **Accuracy**, **Integrity**, **Accountability**, **Data-driven decision-making** (plus operational excellence as a discipline).

**Critical areas (examples):** Process optimization (efficiency, lean, automation); data-driven strategies (analytics, predictive insight, monitoring); performance improvement (VTEX insights, continuous monitoring, agility); **customer experience** (personalization, feedback, omnichannel).

### Routing to product tracks

Platform-specific **how** belongs in **product skills**, not in this meta-skill. After pillar alignment, use:

| Topic                                                                                                             | Track skill                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| VTEX IO **service paths**, edge/CDN behavior, `Cache-Control` vs data scope                                       | [vtex-io-service-paths-and-cdn](../../../vtex-io/skills/vtex-io-service-paths-and-cdn/skill.md)                          |
| VTEX IO **application performance** (caching layers, AppSettings, parallel fetches, tenant-scoped in-memory keys) | [vtex-io-application-performance](../../../vtex-io/skills/vtex-io-application-performance/skill.md)                      |
| **Master Data** storage fit (challenge whether MD is the right place), purchase path, BFF, single source of truth | [vtex-io-masterdata](../../../vtex-io/skills/vtex-io-masterdata/skill.md)                                                |
| **Marketplace** fulfillment, simulation, integration flow                                                         | [marketplace-fulfillment](../../../marketplace/skills/marketplace-fulfillment/skill.md) (and related marketplace skills) |

**Cross-cutting VTEX rules (still architecture-level):**

1. **Native and OOTB before VTEX IO** — Prefer **native VTEX capabilities** and **configuration** before a **VTEX IO** extension. **Use IO only when** there is **no** suitable native path; document **why not native** if IO is chosen anyway.

2. **Simplicity and commodities** — Prefer **platform-native** behaviors for **commodity** capabilities; reserve custom work for **differentiators** or **genuine gaps**, not for substituting process or ownership fixes.

3. **Integration discipline** — Prefer **fewer hops**, clear **ownership**, and **API-centric** design (see Future-proof system integration)—detailed patterns live in IO, headless, and marketplace skills.

## Decision rules

1. **Classify every major decision** under one or more **pillars** (see **Three pillars (framework)**). If a choice does not map to any pillar, question whether it is necessary.
2. **When extending the platform** (VTEX IO, Master Data, integrations), use the **Routing to product tracks** table—implement caching, paths, MD usage, and marketplace flows with those skills, and record how the choice supports **Future-proof** and **Operational Excellence** without weakening **Technical Foundation**.
3. **Prefer fewer integration hops** where custom code remains necessary: each hop adds failure modes and operational load. Additional services or backends are valid when they **isolate failure domains** or **clear team boundaries**, not by default.
4. **After architecture choices are clear**, assign execution to **product track skills** (see **Routing to product tracks** and **Related skills**). This skill sets direction; product skills enforce VTEX-specific contracts.
5. **Operational discipline** requires definable **metrics and ownership** (who runs it, how incidents are detected, how changes are released). Undocumented “best effort” operations violate **Operational Excellence** even if the design is lean.

## Hard constraints

### Constraint: Do not bypass Technical Foundation for speed

Security, credential handling, PCI scope, and private API access **must** follow VTEX and industry baselines. Architectural shortcuts that expose secrets, widen PCI scope, or call private APIs from untrusted clients are **never** acceptable tradeoffs for velocity.

**Why this matters** — Data breaches, fraud, and account compromise destroy customer trust and can invalidate compliance posture for the whole program.

**Detection** — If the design places `VTEX_APP_KEY`/`VTEX_APP_TOKEN`, raw card data, or shopper session tokens in browser code, public repos, or logs → **stop** and redesign using product skills (e.g. headless BFF, payment Secure Proxy).

**Correct** — Classify data and APIs; keep secrets and private calls server-side; reference PCI and authentication guides for the chosen integration style.

```text
Architecture decision log:
- Private VTEX APIs → server-side only (BFF or IO service).
- Card data → Payment Provider Protocol / Secure Proxy patterns only.
```

**Wrong** — “We will call Checkout OMS from the SPA for speed” or “store app token in NEXT_PUBLIC for dev convenience.”

### Constraint: Future-proof means justified complexity, not maximal decomposition

Every new service, queue, or datastore must have a **stated owner**, **failure mode**, and **reason** tied to a pillar (e.g. isolation, scale, regulatory boundary). Unbounded service proliferation violates the **Simplicity** core value.

**Why this matters** — Undocumented distributed systems become impossible to operate, debug, or upgrade; they increase cost and incident duration.

**Detection** — If a diagram adds a new box “for flexibility” without a pillar mapping → challenge it. If two services could be one VTEX IO app with clear modules → merge or defer.

**Correct** — Document: “Service X owns partner webhook translation; Technical Foundation: audit log; Future-proof: replaceable adapter; Ops: on-call rotation Z.”

```text
Before adding a service:
1. Which pillar(s) require it?
2. What fails if it is absent?
3. Can native/OOTB, existing BFF, or a minimal IO surface cover it?
```

**Wrong** — “Microservices architecture” as a default with no operational model or without VTEX integration constraints from product skills.

### Constraint: VTEX IO extension requires exhausted native/OOTB options

Choosing **VTEX IO** to implement a capability that **already exists** natively or OOTB (or could be met with configuration and standard integrations) **without** a documented exception rationale creates long-term cost, upgrade risk, and operational debt.

**Why this matters** — Duplicate implementations drift from platform evolution, break on upgrades, and consume engineering that should go to differentiation.

**Detection** — Proposal leads with “we will build an IO app for X” before listing **native/OOTB alternatives** considered. No written “why not native” when a Help Center or Developers guide describes a standard path.

**Correct** — Decision log entry: native/OOTB options evaluated → rejected because [specific gap] → IO scope minimized to that gap only.

```text
Native/OOTB check before IO:
1. What does VTEX ship for this (admin, module, API, partner app)?
2. If still building IO: what exactly cannot be done natively?
```

**Wrong** — “We always customize via IO” or “IO is simpler than learning native features” without evidence that native cannot meet the requirement.

### Constraint: Master Data is not a general-purpose or checkout-critical datastore

Using **Master Data** without understanding its **storage model, limits, and consistency**—or using it as the **default** store for all custom data, or on the **purchase critical path**—risks latency, reliability, and support issues at scale.

**Why this matters** — MD is optimized for documented entity patterns, not arbitrary OLTP in the middle of checkout; misuse impacts revenue and stability.

**Detection** — Synchronous order flow calls MD on every cart mutation; “put all custom fields in MD” with no schema discipline; MD chosen before catalog, profile, or OMS-native options are evaluated.

**Correct** — Follow [vtex-io-masterdata](../../../vtex-io/skills/vtex-io-masterdata/skill.md) (storage fit, catalog-first, BFF); entities scoped to justified use cases; **off critical path** or async patterns for non-essential MD access during purchase.

```text
Before MD for new data:
1. Can Catalog, Checkout, Profile, or another native store hold this?
2. Is access in the hot path of purchase? If yes, redesign or justify.
```

**Wrong** — “MD for everything” or blocking checkout on MD round-trips under peak load without hard performance proof.

## Preferred pattern

1. **Align the team** on the **three pillars (framework)** in-session; use the **Well-Architected Commerce MCP** when you need expanded framework wording or the latest narrative.
2. **Route** IO, MD, and marketplace concerns to the **Routing to product tracks** table—native/OOTB first; then scoped IO or MD with documented rationale.
3. **Separate differentiator from ops gap**: for each custom build, label **strategic differentiator** vs **process/operational fix**; if the latter, prefer process or native tooling before code.
4. **Produce a short decision log**: pillars addressed, native vs IO vs MD choices, “why not native” where applicable, open risks.
5. **Attach** the relevant **product track** guidance for each implementation stream (storefront, payments, IO, marketplace).
6. **Revisit** Operational Excellence: commodities on platform, team focus on support and differentiators, plus metrics, release process, and incident response **before** go-live.

## Common failure modes

- **Meta-skill overuse** — Spending architecture narrative on problems already fully specified by a product skill (e.g. PPP idempotency rules).
- **Pillar theater** — Labeling slides with three pillars without changing concrete decisions or ownership.
- **IO-default bias** — Reaching for VTEX IO before proving native/OOTB cannot satisfy the requirement; treating customization as the first step.
- **MD-as-Postgres** — Using Master Data for every entity without modeling, or coupling checkout to synchronous MD reads/writes.
- **Simplicity misunderstood** — Interpreting “simple architecture” as “one big IO app that does everything” instead of “minimum custom surface, maximum native leverage.”
- **Tech over process** — Automating or coding around broken operational workflows instead of fixing ownership, SLAs, or training.
- **Commodity customization** — Customer tech teams maintaining bespoke implementations of behaviors VTEX already provides as standard product, starving real differentiators.
- **Missing handoff** — Architecture doc with no pointers to **which** product skills and **which** official VTEX guides developers must follow.

## Review checklist

- [ ] Are **Technical Foundation** concerns (auth, secrets, PCI scope, private APIs) explicitly addressed?
- [ ] For each **VTEX IO** extension: was **native/OOTB** evaluated first, and is there a **written “why not native”** when IO was chosen?
- [ ] For **Master Data** use: does the team understand MD architecture (see Reference), and is MD **off the purchase critical path** unless strongly justified?
- [ ] Is each custom component labeled **differentiator** vs **operational/process gap**, and are process fixes considered before new code?
- [ ] Does **Future-proof** hold: each new service, queue, or datastore has **owner**, **failure mode**, and **pillar-based reason**; no unmotivated sprawl?
- [ ] Are **integration hops** minimized; are extra services justified by failure isolation or team boundaries?
- [ ] Does **Operational Excellence** show **commodities on the platform**, clear focus for support and differentiators, plus **metrics**, **monitoring**, and **release/incident ownership**?
- [ ] Has every implementation stream been mapped to a **product track skill**?
- [ ] Are official **VTEX docs** linked for areas that have platform-specific constraints?

## Related skills

- [vtex-io-service-paths-and-cdn](../../../vtex-io/skills/vtex-io-service-paths-and-cdn/skill.md) — `service.json` paths, edge/CDN and session behavior.
- [vtex-io-application-performance](../../../vtex-io/skills/vtex-io-application-performance/skill.md) — LRU/VBase, AppSettings, parallel fetches, tenant keys on shared pods.
- [vtex-io-app-contract](../../../vtex-io/skills/vtex-io-app-contract/skill.md) — IO manifest, builders, policies (use only after native/OOTB path is ruled out).
- [vtex-io-masterdata](../../../vtex-io/skills/vtex-io-masterdata/skill.md) — Master Data v2 storage-fit scrutiny, BFF, single source of truth.
- [headless-bff-architecture](../../../headless/skills/headless-bff-architecture/skill.md) — BFF and credential boundaries for headless.
- [payment-pci-security](../../../payment/skills/payment-pci-security/skill.md) — PCI and Secure Proxy constraints.
- [faststore-storefront](../../../faststore/skills/faststore-storefront/skill.md) — GraphQL extensions and data layer.
- [marketplace-order-hook](../../../marketplace/skills/marketplace-order-hook/skill.md) — Marketplace order integration patterns.

## Reference

- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — Storefront integration models and platform boundaries
- [Engineering best practices](https://developers.vtex.com/docs/guides/vtex-io-documentation-engineering-guidelines) — Scalability and IO development practices aligned with Technical Foundation
- [Working with JSON Schemas in Master Data v2](https://developers.vtex.com/docs/guides/working-with-json-schemas-in-master-data-v2) — MD storage model and schema behavior before choosing MD
- [Best practices for avoiding rate limit errors](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) — Reliable integration with VTEX APIs
- [PCI DSS compliance in VTEX](https://developers.vtex.com/docs/guides/payments-integration-pci-dss-compliance) — Payment security baseline
- [Best practices for using application keys](https://help.vtex.com/en/docs/tutorials/best-practices-api-keys) — API key hygiene and trust

---

# FastStore Implementation & Customization

# FastStore Storefront — Coding Rules

You are an experienced software engineer at VTEX. Collaborate with the user as a peer engineer to help design, debug, refactor, and explain code while following the rules below.

## Role & Objectives

- Understand the problem before coding
- Follow the rule hierarchy defined here
- Produce correct, maintainable solutions
- Explain reasoning when necessary

## Rule 1 — Safety & Correctness

- Never produce incorrect or misleading technical information
- If information is missing or ambiguous, ask the user for clarification before proceeding
- Do not invent APIs, libraries, or behavior
- Do not add new dependencies to the project if not requested to do it by the user
- **Do not use Next.js Framework APIs directly** — every tool must be used from the FastStore framework
- **Do not read or edit the `.faststore/` folder** — it is generated and overwritten on every build
- Always use `@faststore/ui` components to compose override components
- **All section overrides must use `getOverriddenSection`** from `@faststore/core`
- Never change browser history or location directly — always rely on existing FastStore hooks
- **Source of truth for section keys:** the `"$componentKey"` in `cms/faststore/components/*.jsonc` must match the **object key** in `<project_root>/src/components/index.tsx` (default export). Do not treat `cms/faststore/schema.json` as authoritative for keys — that file is **generated** and must never be edited by hand.
- Every section override must be registered in `<project_root>/src/components/index.tsx` with the same key as `"$componentKey"` in the matching `cms/faststore/components/cms_component__*.jsonc`.
- The file `<project_root>/src/components/index.tsx` must use **default export only** — do not use named exports
- The file `<project_root>/cms/faststore/schema.json` must not be edited. It is always regenerated by `vtex content generate-schema`
- **If the `.faststore/` directory gets into a broken state** (e.g., after a failed GraphQL optimization), delete it with `rm -rf .faststore` and restart `yarn dev`. The CLI regenerates it from scratch.
- **Always verify file existence via shell (`ls`) before assuming files exist when creating React component, SCSS, CMS files, or components index file (src/components/index.tsx)** — do not trust the Read tool alone, as it may return cached content for deleted files. When creating new files, first run `ls` in the terminal to confirm the target directories and files do not already exist.
- Before creating ANY new file (component, SCSS, CMS schema):

1. **MANDATORY**: Run `ls -la <directory>` to verify:
   - Directory structure exists
   - No conflicting files with same name
   - Correct location for file type
2. **For CMS components**: Check both `src/components/` AND `cms/faststore/components/`

Example workflow:

```bash
# Before creating DailyOffers component
ls -la src/components/DailyOffers  # Should not exist
ls -la cms/faststore/components | grep -i daily  # Check for existing
```

## Rule 2 — Requirement Adherence

- Follow the user's request exactly
- Use **TypeScript**
- All code must follow **React 18**
- Follow FastStore framework architecture — never work around it

## Rule 3 — Context Awareness

- Use all context provided by the user (code snippets, architecture, errors)
- Do not ignore relevant information
- Prefer components from `@faststore/components` or `@faststore/ui`

## Rule 4 — Minimalism

- Do not over-engineer
- Provide the simplest solution that satisfies the requirements

## Rule 5 — Explanation (When Useful)

- Briefly explain reasoning for complex decisions
- Focus on practical insights useful to another developer

## Code Output Rules

- Never create or modify code inside the `.faststore/` folder
- Use clear formatting that follows project configuration
- Include comments only when helpful
- Follow language idioms and conventions
- Prefer complete, runnable examples

### Stylesheet Rules

- All styling must use **SCSS** syntax in `.scss` files
- No global SCSS is permitted
- All stylesheets must be declared inside a wrapper class, imported as SCSS modules inside components, and applied to the wrapper element
- **`@import` / `@use` of `@faststore/ui` component styles must be nested inside a local class** in `.module.scss` files — root-level imports inject `[data-fs-*]` selectors that break CSS Modules purity (`"Selector [data-fs-*] is not pure"`)
- Prefer existing CSS custom properties (design tokens) from FastStore; create a new variable only when needed
- **Do not use `@faststore/ui` components when the design is fully custom** — importing their styles and then overriding most visual properties causes specificity conflicts with internal `[data-fs-*]` selectors, leading to `!important` escalation. Use native HTML elements with custom SCSS instead. Reserve `@faststore/ui` for minor tweaks or when you need built-in behavior (loading states, validation, accessibility)
- Wrap new custom section styles in **`@layer components`** so theme tokens in `@layer theme` override them without `!important` — matching the cascade order of native sections

### Prerequisite: VTEX CLI (global)

Assume **[VTEX CLI](https://developers.vtex.com/docs/guides/vtex-io-documentation-vtex-io-cli-install)** is installed globally. Use **`vtex` directly** (for example `vtex content …`). Do **not** document or suggest `npx vtex` for these flows.

### Headless CMS schema rule (no legacy `cms-sync`)

**Do not** recommend `yarn cms-sync`, `npm run cms-sync`, `faststore cms-sync`, or any other **legacy `cms-sync` flow** to publish or refresh the **Headless CMS** schema. For schema, the supported path is **`vtex content generate-schema`** and **`vtex content upload-schema`** (see below).

### CMS schema workflow — follow through in the same session

After **every** change to `cms/faststore/components/*.jsonc` or `cms/faststore/pages/*.jsonc`, complete this sequence **before considering the task done**:

1. **Generate** — from the project root, run:
   ```bash
   vtex content generate-schema -o cms/faststore/schema.json -b vtex.faststore4
   ```

2. **Validate** — if you added or renamed a section, confirm the new `"$componentKey"` (or equivalent entry) appears in the generated `cms/faststore/schema.json`. If it is missing, fix the JSONC or registration in `src/components/index.tsx` and regenerate — **never** patch `schema.json` manually.
3. **Upload** — in the **same session**, use the non-interactive command:
   ```bash
   # The CLI expects "faststore" as the schema suffix (not the storeId from discovery.config.js)
   # This results in $id = {discovery.storeId}.faststore (e.g., brandless.faststore)
   # Single quotes prevent Tcl from interpreting $id and other $ tokens in CLI output
   expect -c 'spawn vtex content upload-schema cms/faststore/schema.json; expect "store ID"; send "faststore\r"; expect -re "uploaded|confirm"; send "y\r"; expect -re "Are you sure|confirm"; send "y\r"; expect eof' 2>&1
   ```
4. **Report** — state clearly whether upload succeeded. If the CLI prompts for **login**, **store ID**, or **confirmation**, paste the **exact prompt or error** and specify the **human next step** (e.g. run `vtex login`, confirm the account matches `discovery.config.js` → `api.storeId`) or point to the **non-interactive `expect` example** in [references/cms-schema-and-section-registration.md](faststore-faststore-storefront-ref-cms-schema-and-section-registration.md).

**What upload does vs. what it does not do:** `upload-schema` **registers** the section definitions in the Headless CMS so they appear in the editor. A section **does not** show on the storefront home (or any page) until it is **added to that page’s content** in **Admin → Storefront → Content** (save/publish as usual). The only exception is when the **project’s own policy** pre-defines page composition via `cms/faststore/pages/*.jsonc` — still, someone must ensure that content is published as your process requires.

Canonical commands (project root):

```bash
vtex content generate-schema -o cms/faststore/schema.json -b vtex.faststore4
vtex content upload-schema cms/faststore/schema.json
```

## Workflow

Follow this process for every request:

1. **Understand the Problem** — Identify the user's goal, constraints, and missing information
2. **Analyze** — Determine the root problem and consider approaches
3. **Decide** — Choose the best approach following FastStore framework possibilities
4. **Provide** — Code + explanation (if needed) + alternatives (optional)
5. **Review** — After finishing, verify:
   - No code produced inside `.faststore/` folder
   - Code composed of `@faststore/components` atoms and molecules
   - If CMS JSONC or pages JSONC changed: `generate-schema` was run, `schema.json` was validated (new `$componentKey` when applicable), `upload-schema` was attempted in-session, and the outcome (success or exact CLI prompt/error + next step) was reported
   - For new CMS sections: it is clear that **Admin → Storefront → Content** (or project `pages` JSONC policy) is still required for the section to appear on a live page

## Response Format

When appropriate, structure responses as:

**Problem Understanding**
Short summary of what the user needs.

**Solution**
Code or steps.

**Explanation**
Why this solution works.

**Optional Improvements**
Better patterns, optimizations, etc.

## Reference Files

Load these on demand based on what the task requires. Do not load all of them upfront.

| File                                                                                                           | Load when…                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [references/project-structure-routes-and-config.md](faststore-faststore-storefront-ref-project-structure-routes-and-config.md)         | Mapping the repo: what belongs in `src/` vs generated `.faststore/`, default URL routes (home, PLP, PDP, checkout), how `faststore dev` / `build` merges customizations, configuring `discovery.config.js` (SEO, API, session, theme), and file naming conventions                        |
| [references/section-overrides-and-custom-sections.md](faststore-faststore-storefront-ref-section-overrides-and-custom-sections.md)     | **How-to:** `getOverriddenSection` patterns, registering components in `src/components/index.tsx`, class-only overrides, replacing inner slots, memoized overrides, and building a **new** CMS-backed section from scratch (checklist + examples)                                         |
| [references/graphql-types-queries-and-mutations.md](faststore-faststore-storefront-ref-graphql-types-queries-and-mutations.md)         | **Read-only API catalog:** built-in root `Query` / `Mutation` fields, enums (e.g. `StoreSort`), and field lists for types like `StoreProduct`, `StoreCart`, `StoreSession` — use when writing queries or checking what the platform already exposes (**not** for adding custom resolvers) |
| [references/extending-graphql-with-custom-resolvers.md](faststore-faststore-storefront-ref-extending-graphql-with-custom-resolvers.md) | **Implementation guide:** adding fields under `src/graphql/vtex/` or new operations under `src/graphql/thirdParty/`, wiring resolvers, `Server*` / `Client*` fragments, and consuming data with `usePDP` / `useQuery` / `useLazyQuery`                                                    |
| [references/scss-styling-and-design-tokens.md](faststore-faststore-storefront-ref-scss-styling-and-design-tokens.md)                   | SCSS module rules (wrapper class, no global SCSS), theming and CSS variables in `src/themes/custom-theme.scss`, and styling overrides that target inner UI structure                                                                                                                      |
| [references/cms-schema-and-section-registration.md](faststore-faststore-storefront-ref-cms-schema-and-section-registration.md)         | VTEX Headless CMS: `cms_component__*.jsonc` + `index.tsx` as source of truth, generated `schema.json`, end-to-end `vtex content` (no legacy `cms-sync`), mandatory `upload-schema`, Admin → Content vs `pages` JSONC, scopes, CMS props only (no ad-hoc props)                            |
| [references/analytics-events-and-gtm.md](faststore-faststore-storefront-ref-analytics-events-and-gtm.md)                               | `@faststore/sdk` analytics: `sendAnalyticsEvent`, `useAnalyticsEvent` / handler components, and setting `gtmContainerId` in `discovery.config.js`                                                                                                                                         |
| [references/injecting-head-scripts-and-meta-tags.md](faststore-faststore-storefront-ref-injecting-head-scripts-and-meta-tags.md)       | Custom `<head>` content via `src/scripts/ThirdPartyScripts.tsx` (verification meta tags, inline scripts, Partytown) — **not** the primary place for GTM; use `discovery.config.js` (see analytics reference)                                                                              |
| [references/native-sections-and-overridable-slots.md](faststore-faststore-storefront-ref-native-sections-and-overridable-slots.md)     | **Lookup only:** list of built-in global sections (e.g. `Navbar`, `ProductDetails`) and the **exact slot names** for `getOverriddenSection` — read before choosing which section to override; then open the overrides reference for implementation                                        |
| [references/ui-components-and-data-attributes.md](faststore-faststore-storefront-ref-ui-components-and-data-attributes.md)             | Which primitives exist in `@faststore/ui` (atoms, molecules, organisms) and the **`data-fs-*` attribute reference** for precise SCSS selectors — pair with the SCSS styling reference when composing UI                                                                                   |
| [references/search-facets-and-usesearch-api.md](faststore-faststore-storefront-ref-search-facets-and-usesearch-api.md)                 | Search and facets reference, common pitfalls, accessing search state, or toggling filters in PLP/Search custom sections                                                                                                                                                                   |

---

# Headless Front-End Development

# BFF Layer Design & Security

## When this skill applies

Use this skill when building or modifying any headless VTEX storefront that communicates with VTEX APIs — whether a custom storefront, mobile app, or kiosk.

- Setting up a BFF (Backend-for-Frontend) layer for a new headless project
- Deciding which VTEX APIs need server-side proxying vs direct frontend calls
- Implementing credential management (`VTEX_APP_KEY`, `VTEX_APP_TOKEN`, `VtexIdclientAutCookie`)
- Reviewing a headless architecture for security compliance

Do not use this skill for:
- Checkout-specific proxy logic and OrderForm management (use [`headless-checkout-proxy`](../headless-checkout-proxy/skill.md))
- Search API integration details (use [`headless-intelligent-search`](../headless-intelligent-search/skill.md))
- Caching and TTL strategy (use [`headless-caching-strategy`](../headless-caching-strategy/skill.md))

## Decision rules

- A BFF layer is **mandatory** for every headless VTEX project. There is no scenario where a headless storefront can safely operate without one.
- Route all VTEX API calls through the BFF **except** Intelligent Search, which is the only API safe to call directly from the frontend.
- Use `VtexIdclientAutCookie` (stored server-side) for shopper-scoped API calls. Use `X-VTEX-API-AppKey`/`X-VTEX-API-AppToken` for machine-to-machine calls.
- Treat client-side exposure of `VTEX_APP_KEY`, `VTEX_APP_TOKEN`, `VtexIdclientAutCookie`, checkout cookies, or shopper/session tokens as a security violation — not as a recommendation or tradeoff. Use explicit wording such as “must not”, “never expose”, and “server-side only”, and avoid softer language such as “avoid”, “prefer”, or “ideally”.
- Classify APIs by their path: `/pub/` endpoints are public but most still need BFF proxying for session management; `/pvt/` endpoints are private and **must** go through BFF.
- Even public Checkout endpoints (`/api/checkout/pub/`) must be proxied through BFF for security — they handle sensitive personal data.
- Create separate API keys with minimal permissions for different BFF modules rather than sharing one key with broad access.

## Hard constraints

### Constraint: A BFF layer is mandatory for headless VTEX — no exceptions

Every headless VTEX storefront MUST have a server-side BFF layer. Client-side code MUST NOT make direct HTTP requests to private VTEX API endpoints. All private API calls must be routed through the BFF.

**Why this matters**

Private VTEX APIs require `X-VTEX-API-AppKey` and `X-VTEX-API-AppToken` headers. If the frontend calls these APIs directly, the credentials must be embedded in client-side code or transmitted to the browser, exposing them to any user who opens browser DevTools. Stolen API keys can be used to access order data, modify pricing, or perform destructive administrative actions.

**Detection**

If you see `fetch` or `axios` calls to `vtexcommercestable.com.br/api/checkout`, `/api/oms`, `/api/profile`, or any `/pvt/` endpoint in client-side code (files under `src/`, `public/`, `app/`, or any browser-executed bundle) → STOP immediately. These calls must be moved to the BFF.

**Correct**

```typescript
// Frontend code — calls BFF, not VTEX directly
async function getOrderDetails(orderId: string): Promise<Order> {
  const response = await fetch(`/api/bff/orders/${orderId}`, {
    credentials: "include", // sends session cookie to BFF
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch order: ${response.status}`);
  }

  return response.json();
}
```

**Wrong**

```typescript
// Frontend code — calls VTEX OMS API directly (SECURITY VULNERABILITY)
async function getOrderDetails(orderId: string): Promise<Order> {
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/oms/pvt/orders/${orderId}`,
    {
      headers: {
        "X-VTEX-API-AppKey": "vtexappkey-mystore-ABCDEF", // EXPOSED!
        "X-VTEX-API-AppToken": "eyJhbGciOi...", // EXPOSED!
      },
    }
  );
  return response.json();
}
```

---

### Constraint: VtexIdclientAutCookie MUST be managed server-side

The `VtexIdclientAutCookie` token MUST be stored in a secure server-side session (e.g., encrypted cookie, Redis session store) and MUST NOT be stored in `localStorage`, `sessionStorage`, or any client-accessible JavaScript variable.

**Why this matters**

The `VtexIdclientAutCookie` is a bearer token that authenticates all actions on behalf of a shopper — placing orders, viewing profile data, accessing payment information. If stored client-side, it can be stolen via XSS attacks, browser extensions, or shared/public computers. An attacker with this token can impersonate the shopper.

**Detection**

If you see `VtexIdclientAutCookie` referenced in `localStorage.setItem`, `sessionStorage.setItem`, or assigned to a JavaScript variable in client-side code → STOP immediately. The token must be managed exclusively server-side.

**Correct**

```typescript
// BFF route — stores VtexIdclientAutCookie in server-side session
import { Router, Request, Response } from "express";
import session from "express-session";

const router = Router();

// After VTEX login callback, extract and store token server-side
router.get("/auth/callback", async (req: Request, res: Response) => {
  const vtexAuthToken = req.cookies["VtexIdclientAutCookie"];

  if (!vtexAuthToken) {
    return res.status(401).json({ error: "Authentication failed" });
  }

  // Store in server-side session — never sent to frontend
  req.session.vtexAuthToken = vtexAuthToken;

  // Clear the cookie from the browser response
  res.clearCookie("VtexIdclientAutCookie");

  // Redirect to frontend with a secure session cookie
  res.redirect("/account");
});

// BFF proxy uses session token for VTEX API calls
router.get("/api/bff/profile", async (req: Request, res: Response) => {
  const vtexToken = req.session.vtexAuthToken;

  if (!vtexToken) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const response = await fetch(
    `https://${process.env.VTEX_ACCOUNT}.vtexcommercestable.com.br/api/checkout/pub/profiles`,
    {
      headers: {
        Cookie: `VtexIdclientAutCookie=${vtexToken}`,
      },
    }
  );

  const profile = await response.json();
  res.json(profile);
});
```

**Wrong**

```typescript
// Frontend code — stores auth token in localStorage (SECURITY VULNERABILITY)
function handleLoginCallback() {
  const params = new URLSearchParams(window.location.search);
  const vtexToken = params.get("authToken");

  // WRONG: token is now accessible to any JS on the page, including XSS payloads
  localStorage.setItem("VtexIdclientAutCookie", vtexToken!);
}

// Later, reads from localStorage and sends in header
async function getProfile() {
  const token = localStorage.getItem("VtexIdclientAutCookie"); // EXPOSED!
  return fetch("https://mystore.vtexcommercestable.com.br/api/checkout/pub/profiles", {
    headers: { Cookie: `VtexIdclientAutCookie=${token}` },
  });
}
```

---

### Constraint: API keys MUST NOT appear in client-side code

`VTEX_APP_KEY` and `VTEX_APP_TOKEN` values MUST only exist in server-side environment variables and MUST NOT be present in any file that is bundled, served, or accessible to the browser.

**Why this matters**

API keys grant programmatic access to the VTEX platform with the permissions of their associated role. Exposing them in frontend bundles, public directories, or client-side environment variables (e.g., `NEXT_PUBLIC_*`, `VITE_*`) allows anyone to extract them and make unauthorized API calls.

**Detection**

If you see `VTEX_APP_KEY`, `VTEX_APP_TOKEN`, `X-VTEX-API-AppKey`, or `X-VTEX-API-AppToken` in files under `src/`, `public/`, `app/` directories, or in environment variables prefixed with `NEXT_PUBLIC_`, `VITE_`, or `REACT_APP_` → STOP immediately. Move these to server-side-only environment variables.

**Correct**

```typescript
// BFF server code — reads keys from server-side env vars only
// File: server/vtex-client.ts (never bundled for browser)
import { Router, Request, Response } from "express";

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_APP_KEY = process.env.VTEX_APP_KEY!;
const VTEX_APP_TOKEN = process.env.VTEX_APP_TOKEN!;

const router = Router();

router.get("/api/bff/orders/:orderId", async (req: Request, res: Response) => {
  const { orderId } = req.params;

  const response = await fetch(
    `https://${VTEX_ACCOUNT}.vtexcommercestable.com.br/api/oms/pvt/orders/${orderId}`,
    {
      headers: {
        "X-VTEX-API-AppKey": VTEX_APP_KEY,
        "X-VTEX-API-AppToken": VTEX_APP_TOKEN,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    return res.status(response.status).json({ error: "Failed to fetch order" });
  }

  const order = await response.json();
  res.json(order);
});

export default router;
```

**Wrong**

```typescript
// .env file with NEXT_PUBLIC_ prefix — exposed to browser bundle!
// NEXT_PUBLIC_VTEX_APP_KEY=vtexappkey-mystore-ABCDEF
// NEXT_PUBLIC_VTEX_APP_TOKEN=eyJhbGciOi...

// Frontend code reads exposed env vars
async function fetchOrders() {
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/oms/pvt/orders`,
    {
      headers: {
        "X-VTEX-API-AppKey": process.env.NEXT_PUBLIC_VTEX_APP_KEY!, // EXPOSED IN BUNDLE!
        "X-VTEX-API-AppToken": process.env.NEXT_PUBLIC_VTEX_APP_TOKEN!, // EXPOSED IN BUNDLE!
      },
    }
  );
  return response.json();
}
```

## Preferred pattern

Architecture overview — how requests flow through the BFF:

```text
Frontend (Browser/App)
    │
    ├── Direct call (OK): Intelligent Search API (public, read-only)
    │
    └── All other requests → BFF Layer (Node.js/Express)
                                │
                                ├── Injects VtexIdclientAutCookie from session
                                ├── Injects X-VTEX-API-AppKey / X-VTEX-API-AppToken
                                ├── Validates & sanitizes input
                                └── Proxies to VTEX APIs
                                        │
                                        ├── Checkout API (/api/checkout/pub/...)
                                        ├── OMS API (/api/oms/pvt/...)
                                        ├── Profile API (/api/profile-system/pvt/...)
                                        └── Other VTEX services
```

Minimal BFF server setup with session management:

```typescript
// server/index.ts
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import cors from "cors";
import { checkoutRoutes } from "./routes/checkout";
import { profileRoutes } from "./routes/profile";
import { ordersRoutes } from "./routes/orders";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(
  session({
    // Production BFFs are typically multi-replica. Configure a shared session
    // store (e.g. connect-redis, connect-memcached, a Postgres-backed store)
    // here — the default MemoryStore is per-pod and silently drops values such
    // as orderFormId and vtexAuthToken when requests are routed to a different
    // replica. For ephemeral cross-step values that the browser already sees
    // (e.g. orderGroup between Step 1 and Step 3 of order placement), prefer
    // passing them through the request body instead of writing them to the
    // session — see headless-checkout-proxy.
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours (matches VtexIdclientAutCookie TTL)
    },
  })
);

// Mount BFF routes
app.use("/api/bff/checkout", checkoutRoutes);
app.use("/api/bff/profile", profileRoutes);
app.use("/api/bff/orders", ordersRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`BFF server running on port ${PORT}`);
});
```

VTEX API client with credential injection for both auth types:

```typescript
// server/vtex-api-client.ts
const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_ENVIRONMENT = process.env.VTEX_ENVIRONMENT || "vtexcommercestable";
const VTEX_APP_KEY = process.env.VTEX_APP_KEY!;
const VTEX_APP_TOKEN = process.env.VTEX_APP_TOKEN!;

const BASE_URL = `https://${VTEX_ACCOUNT}.${VTEX_ENVIRONMENT}.com.br`;

interface VtexRequestOptions {
  path: string;
  method?: string;
  body?: unknown;
  authType: "app-key" | "user-token";
  userToken?: string;
}

export async function vtexRequest<T>(options: VtexRequestOptions): Promise<T> {
  const { path, method = "GET", body, authType, userToken } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (authType === "app-key") {
    headers["X-VTEX-API-AppKey"] = VTEX_APP_KEY;
    headers["X-VTEX-API-AppToken"] = VTEX_APP_TOKEN;
  } else if (authType === "user-token" && userToken) {
    headers["Cookie"] = `VtexIdclientAutCookie=${userToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(
      `VTEX API error: ${response.status} ${response.statusText} for ${method} ${path}`
    );
  }

  return response.json() as Promise<T>;
}
```

BFF route handler with session-based auth and input validation:

```typescript
// server/routes/orders.ts
import { Router, Request, Response } from "express";
import { vtexRequest } from "../vtex-api-client";

export const ordersRoutes = Router();

// Get order details — requires API key auth (private endpoint)
ordersRoutes.get("/:orderId", async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // Validate input
    if (!/^[a-zA-Z0-9-]+$/.test(orderId)) {
      return res.status(400).json({ error: "Invalid order ID format" });
    }

    // Optionally check user session for authorization
    const vtexToken = req.session.vtexAuthToken;
    if (!vtexToken) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const order = await vtexRequest({
      path: `/api/oms/pvt/orders/${orderId}`,
      authType: "app-key",
    });

    res.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});
```

Authentication flow with server-side token management:

```typescript
// server/routes/auth.ts
import { Router, Request, Response } from "express";

export const authRoutes = Router();

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_LOGIN_URL = `https://${VTEX_ACCOUNT}.myvtex.com/login`;
const FRONTEND_URL = process.env.FRONTEND_URL!;

// Redirect shopper to VTEX login page
authRoutes.get("/login", (_req: Request, res: Response) => {
  const returnUrl = `${FRONTEND_URL}/auth/callback`;
  res.redirect(`${VTEX_LOGIN_URL}?returnUrl=${encodeURIComponent(returnUrl)}`);
});

// Handle login callback — extract VtexIdclientAutCookie and store server-side
authRoutes.get("/callback", (req: Request, res: Response) => {
  const vtexToken = req.cookies["VtexIdclientAutCookie"];

  if (!vtexToken) {
    return res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  }

  // Store token in server-side session
  req.session.vtexAuthToken = vtexToken;

  // Clear the VTEX cookie from the browser
  res.clearCookie("VtexIdclientAutCookie");

  // Redirect to authenticated frontend page
  res.redirect(`${FRONTEND_URL}/account`);
});

// Logout — destroy session
authRoutes.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

// Check authentication status
authRoutes.get("/status", (req: Request, res: Response) => {
  res.json({
    authenticated: !!req.session.vtexAuthToken,
  });
});
```

## Common failure modes

- **Proxying Intelligent Search through BFF**: Routing every VTEX API call through the BFF, including Intelligent Search, adds unnecessary latency and server load. Intelligent Search is a public, read-only API designed for direct frontend consumption. Call it directly from the frontend.

  ```typescript
  // Frontend code — call Intelligent Search directly (this is correct!)
  async function searchProducts(query: string, from: number = 0, to: number = 19): Promise<SearchResult> {
    const baseUrl = `https://${STORE_ACCOUNT}.vtexcommercestable.com.br`;
    const response = await fetch(
      `${baseUrl}/api/io/_v/api/intelligent-search/product_search/?query=${encodeURIComponent(query)}&from=${from}&to=${to}&locale=en-US`,
    );
    return response.json();
  }
  ```

- **Sharing a single API key across all BFF operations**: Using one API key with broad permissions (e.g., Owner role) for all BFF operations means a compromised key grants access to every VTEX resource. Create separate API keys for different BFF modules with minimal required permissions.

  ```typescript
  // server/vtex-credentials.ts — separate keys per domain
  export const credentials = {
    oms: {
      appKey: process.env.VTEX_OMS_APP_KEY!,
      appToken: process.env.VTEX_OMS_APP_TOKEN!,
    },
    checkout: {
      appKey: process.env.VTEX_CHECKOUT_APP_KEY!,
      appToken: process.env.VTEX_CHECKOUT_APP_TOKEN!,
    },
    catalog: {
      appKey: process.env.VTEX_CATALOG_APP_KEY!,
      appToken: process.env.VTEX_CATALOG_APP_TOKEN!,
    },
  } as const;
  ```

- **Logging API credentials or auth tokens**: Logging request headers or full request objects during debugging inadvertently writes API keys or `VtexIdclientAutCookie` values to log files, which may be accessible to multiple team members or attackers. Sanitize all log output to strip sensitive headers before logging.

  ```typescript
  // server/middleware/request-logger.ts
  import { Request, Response, NextFunction } from "express";

  const SENSITIVE_HEADERS = [
    "x-vtex-api-appkey",
    "x-vtex-api-apptoken",
    "cookie",
    "authorization",
  ];

  export function requestLogger(req: Request, _res: Response, next: NextFunction) {
    const sanitizedHeaders = Object.fromEntries(
      Object.entries(req.headers).map(([key, value]) =>
        SENSITIVE_HEADERS.includes(key.toLowerCase())
          ? [key, "[REDACTED]"]
          : [key, value]
      )
    );

    console.log({
      method: req.method,
      path: req.path,
      headers: sanitizedHeaders,
      timestamp: new Date().toISOString(),
    });

    next();
  }
  ```

## Review checklist

- [ ] Is a BFF layer present? Every headless VTEX project requires one — no exceptions.
- [ ] Are all private VTEX API calls (`/pvt/` endpoints) routed through the BFF?
- [ ] Are `VTEX_APP_KEY` and `VTEX_APP_TOKEN` stored exclusively in server-side environment variables?
- [ ] Are API keys absent from any `NEXT_PUBLIC_*`, `VITE_*`, or `REACT_APP_*` environment variables?
- [ ] Is `VtexIdclientAutCookie` stored in a server-side session, not in `localStorage` or `sessionStorage`?
- [ ] Is Intelligent Search called directly from the frontend (not unnecessarily proxied through BFF)?
- [ ] Are separate API keys used for different BFF modules with minimal permissions?
- [ ] Are sensitive headers redacted from all log output?

## Reference

- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — Core architecture guide for building headless stores on VTEX
- [Headless authentication](https://developers.vtex.com/docs/guides/headless-authentication) — OAuth-based shopper authentication flow for headless implementations
- [API authentication using API keys](https://developers.vtex.com/docs/guides/api-authentication-using-api-keys) — How to use appKey/appToken pairs for machine authentication
- [API authentication using user tokens](https://developers.vtex.com/docs/guides/api-authentication-using-user-tokens) — How VtexIdclientAutCookie works and its scopes
- [Refresh token flow for headless implementations](https://developers.vtex.com/docs/guides/refresh-token-flow-for-headless-implementations) — How to refresh expired VtexIdclientAutCookie tokens
- [Best practices for using application keys](https://help.vtex.com/en/tutorial/best-practices-api-keys--7b6nD1VMHa49aI5brlOvJm) — VTEX security guidelines for API key management

---

# Caching & Performance for Headless VTEX

## When this skill applies

Use this skill when building or optimizing a headless VTEX storefront for performance. Proper caching is the single most impactful performance optimization for headless commerce.

- Configuring CDN or edge caching for Intelligent Search and Catalog APIs
- Adding BFF-level caching (in-memory or Redis) for frequently requested data
- Deciding which VTEX API responses can be cached and which must never be cached
- Implementing cache invalidation when catalog data changes

Do not use this skill for:
- BFF architecture and API routing decisions (use [`headless-bff-architecture`](../headless-bff-architecture/skill.md))
- Intelligent Search API integration specifics (use [`headless-intelligent-search`](../headless-intelligent-search/skill.md))
- Checkout proxy and OrderForm management (use [`headless-checkout-proxy`](../headless-checkout-proxy/skill.md))

## Decision rules

- Classify every VTEX API as cacheable or non-cacheable before implementing caching logic.
- **Cacheable** (public, read-only, non-personalized): Intelligent Search, Catalog public endpoints, top searches, autocomplete.
- **Non-cacheable** (transactional, personalized, sensitive): Checkout, Profile, OMS, Payments, Pricing private endpoints. These must NEVER be cached at any layer.
- Use `stale-while-revalidate` for the best freshness/performance balance — serve cached data instantly while refreshing in the background.
- Use moderate TTLs (2-15 minutes) combined with event-driven invalidation. Never set TTLs of hours/days without an invalidation mechanism.
- Cache by request URL/params only, not by user identity — catalog data is the same for all anonymous users in the same trade policy.
- Layer caching: CDN edge cache for direct frontend calls (Search), BFF cache (Redis/in-memory) for proxied catalog data.

Recommended TTLs:

| API | Recommended TTL | SWR |
|---|---|---|
| Intelligent Search (product_search) | 2-5 minutes | 60s |
| Catalog (category tree) | 5-15 minutes | 5 min |
| Intelligent Search (autocomplete) | 1-2 minutes | 30s |
| Intelligent Search (top searches) | 5-10 minutes | 2 min |
| Catalog (product details) | 5 minutes | 60s |

APIs that must NEVER be cached:

| API | Why |
|---|---|
| Checkout (`/api/checkout/`) | Cart data is per-user, changes with every action |
| Profile (`/api/profile-system/pvt/`) | Personal data, GDPR/LGPD sensitive |
| OMS (`/api/oms/pvt/orders`) | Order status changes, user-specific |
| Payments (`/api/payments/`) | Financial transactions, must always be real-time |
| Pricing private (`/api/pricing/pvt/`) | May have per-user pricing rules |

## Hard constraints

### Constraint: MUST cache public API data aggressively

Search results, catalog data, category trees, and other public read-only data MUST be cached at appropriate levels (CDN, BFF, or both). Without caching, every user request hits VTEX APIs directly.

**Why this matters**

Without caching, a headless storefront generates an API request for every single page view, search, and category browse. This quickly exceeds VTEX API rate limits (causing 429 errors and degraded service), adds 200-500ms of latency per request, and creates a poor shopper experience. A store with 10,000 concurrent users making uncached search requests will overwhelm any API.

**Detection**

If a headless storefront calls Intelligent Search or Catalog APIs without any caching layer (no CDN cache headers, no BFF cache, no `Cache-Control` headers) → STOP immediately. Caching must be implemented for all public, read-only API responses.

**Correct**

```typescript
// BFF route with in-memory cache for category tree
import { Router, Request, Response } from "express";

const router = Router();

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  staleAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): { data: T; isStale: boolean } | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;

  const now = Date.now();
  if (now > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return {
    data: entry.data,
    isStale: now > entry.staleAt,
  };
}

function setCache<T>(key: string, data: T, maxAgeMs: number, swrMs: number): void {
  const now = Date.now();
  cache.set(key, {
    data,
    staleAt: now + maxAgeMs,
    expiresAt: now + maxAgeMs + swrMs,
  });
}

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const CATALOG_BASE = `https://${VTEX_ACCOUNT}.vtexcommercestable.com.br/api/catalog_system/pub`;

// Category tree — cache for 15 minutes, SWR for 5 minutes
router.get("/categories", async (_req: Request, res: Response) => {
  const cacheKey = "category-tree";
  const cached = getCached<unknown>(cacheKey);

  if (cached && !cached.isStale) {
    res.set("X-Cache", "HIT");
    return res.json(cached.data);
  }

  // If stale, serve stale data and refresh in background
  if (cached && cached.isStale) {
    res.set("X-Cache", "STALE");
    res.json(cached.data);

    // Background refresh
    fetch(`${CATALOG_BASE}/category/tree/3`)
      .then((r) => r.json())
      .then((data) => setCache(cacheKey, data, 15 * 60 * 1000, 5 * 60 * 1000))
      .catch((err) => console.error("Background cache refresh failed:", err));
    return;
  }

  // Cache miss — fetch and cache
  try {
    const response = await fetch(`${CATALOG_BASE}/category/tree/3`);
    const data = await response.json();
    setCache(cacheKey, data, 15 * 60 * 1000, 5 * 60 * 1000);
    res.set("X-Cache", "MISS");
    res.json(data);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});
```

**Wrong**

```typescript
// No caching — every request hits VTEX directly
router.get("/categories", async (_req: Request, res: Response) => {
  // This fires on EVERY request — 10,000 users = 10,000 API calls
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/catalog_system/pub/category/tree/3`
  );
  const data = await response.json();
  res.json(data); // No cache headers, no BFF cache, no CDN cache
});
```

---

### Constraint: MUST NOT cache transactional or personal data

Responses from Checkout API, Profile API, OMS API, and Payments API MUST NOT be cached at any layer — not in the CDN, not in BFF memory, not in Redis, and not in browser cache.

**Why this matters**

Caching transactional data can cause catastrophic failures. A cached OrderForm means a shopper sees stale cart contents (wrong items, wrong prices). Cached profile data can leak one user's personal information to another user (especially behind shared caches). Cached order data shows stale statuses. Any of these is a security vulnerability, data privacy violation (GDPR/LGPD), or business logic failure.

**Detection**

If you see caching logic (Redis `set`, in-memory cache, `Cache-Control` headers with `max-age > 0`) applied to checkout, order, profile, or payment API responses → STOP immediately. These endpoints must always return fresh data.

**Correct**

```typescript
// BFF checkout route — explicitly no caching
import { Router, Request, Response } from "express";
import { vtexCheckout } from "../vtex-checkout-client";

export const checkoutRoutes = Router();

// Set no-cache headers for ALL checkout responses
checkoutRoutes.use((_req: Request, res: Response, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
  next();
});

checkoutRoutes.get("/cart", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  try {
    // Always fetch fresh — never cache
    const result = await vtexCheckout({
      path: `/api/checkout/pub/orderForm/${orderFormId}`,
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.vtexCookies = result.cookies;
    res.json(result.data);
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({ error: "Failed to fetch cart" });
  }
});
```

**Wrong**

```typescript
// CATASTROPHIC: Caching checkout data in Redis
import Redis from "ioredis";
const redis = new Redis();

checkoutRoutes.get("/cart", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;
  const cacheKey = `cart:${orderFormId}`;

  // WRONG: cached cart could have wrong items, old prices, or stale quantities
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json(JSON.parse(cached)); // Serving stale transactional data!
  }

  const result = await vtexCheckout({
    path: `/api/checkout/pub/orderForm/${orderFormId}`,
    cookies: req.session.vtexCookies || {},
  });

  // WRONG: caching cart data that changes with every user action
  await redis.setex(cacheKey, 300, JSON.stringify(result.data));
  res.json(result.data);
});
```

---

### Constraint: MUST implement cache invalidation strategy

Every caching implementation MUST have a clear invalidation strategy. Cached data must have appropriate TTLs and there must be a mechanism to force-invalidate cache when the underlying data changes.

**Why this matters**

Without invalidation, cached data becomes permanently stale. Products that are out of stock continue to appear available. Price changes don't reflect until the arbitrary TTL expires. New products are invisible. This leads to a poor shopper experience, failed orders (due to stale availability), and incorrect pricing.

**Detection**

If a caching implementation has no TTL (`max-age`, expiration time) or has very long TTLs (hours/days) without any invalidation mechanism → STOP immediately. All caches need bounded TTLs and ideally event-driven invalidation.

**Correct**

```typescript
// Cache with TTL + manual invalidation endpoint + event-driven invalidation
import { Router, Request, Response } from "express";

const router = Router();

// In-memory cache with TTL tracking
const productCache = new Map<string, { data: unknown; expiresAt: number }>();

function setProductCache(productId: string, data: unknown, ttlMs: number): void {
  productCache.set(productId, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

function getProductCache(productId: string): unknown | null {
  const entry = productCache.get(productId);
  if (!entry || Date.now() > entry.expiresAt) {
    productCache.delete(productId);
    return null;
  }
  return entry.data;
}

// Regular product endpoint with cache
router.get("/products/:productId", async (req: Request, res: Response) => {
  const { productId } = req.params;
  const cached = getProductCache(productId);

  if (cached) {
    return res.json(cached);
  }

  const response = await fetch(
    `https://${process.env.VTEX_ACCOUNT}.vtexcommercestable.com.br/api/catalog_system/pub/products/search?fq=productId:${productId}`
  );
  const data = await response.json();

  setProductCache(productId, data, 5 * 60 * 1000); // 5-minute TTL
  res.json(data);
});

// Manual invalidation endpoint (secured with API key)
router.post("/cache/invalidate", (req: Request, res: Response) => {
  const adminKey = req.headers["x-admin-key"];
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { productId, pattern } = req.body as { productId?: string; pattern?: string };

  if (productId) {
    productCache.delete(productId);
    return res.json({ invalidated: [productId] });
  }

  if (pattern === "all") {
    const count = productCache.size;
    productCache.clear();
    return res.json({ invalidated: count });
  }

  res.status(400).json({ error: "Provide productId or pattern" });
});

// Webhook endpoint for VTEX catalog change events
router.post("/webhooks/catalog-change", (req: Request, res: Response) => {
  const { productId } = req.body as { productId?: string };

  if (productId) {
    productCache.delete(productId);
    console.log(`Cache invalidated for product ${productId}`);
  }

  res.status(200).json({ received: true });
});

export default router;
```

**Wrong**

```typescript
// Cache with no TTL and no invalidation — data becomes permanently stale
const cache = new Map<string, unknown>();

router.get("/products/:productId", async (req: Request, res: Response) => {
  const { productId } = req.params;

  // Once cached, this data NEVER expires — price changes, stock updates are invisible
  if (cache.has(productId)) {
    return res.json(cache.get(productId));
  }

  const response = await fetch(`https://mystore.vtexcommercestable.com.br/api/catalog_system/pub/products/search?fq=productId:${productId}`);
  const data = await response.json();
  cache.set(productId, data); // No TTL! No invalidation! Stale forever!
  res.json(data);
});
```

## Preferred pattern

Cache layer architecture for a headless VTEX storefront:

```text
Frontend (Browser)
    │
    ├── Direct to CDN (Intelligent Search)
    │   └── CDN Edge Cache (TTL: 2-5 min, SWR: 60s)
    │       └── VTEX Intelligent Search API
    │
    └── BFF Endpoints
        │
        ├── Cacheable routes (catalog, category tree)
        │   └── BFF Cache Layer (Redis/in-memory)
        │       └── VTEX Catalog API
        │
        └── Non-cacheable routes (checkout, profile, orders)
            └── Direct proxy to VTEX (NO CACHING)
```

CDN cache headers for Intelligent Search (edge function example):

```typescript
// cloudflare-worker.ts or similar edge function
async function handleSearchRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Only cache GET requests to Intelligent Search
  if (request.method !== "GET") {
    return fetch(request);
  }

  // Check CDN cache first
  const cacheKey = new Request(url.toString(), request);
  const cachedResponse = await caches.default.match(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Fetch from VTEX
  const response = await fetch(request);
  const responseClone = response.clone();

  // Add cache headers
  const cachedRes = new Response(responseClone.body, responseClone);
  cachedRes.headers.set(
    "Cache-Control",
    "public, max-age=120, stale-while-revalidate=60"
  );

  // Store in CDN cache
  await caches.default.put(cacheKey, cachedRes.clone());

  return cachedRes;
}
```

Redis-based BFF cache with stale-while-revalidate:

```typescript
// server/cache/redis-cache.ts
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

interface CacheOptions {
  ttlSeconds: number;
  swrSeconds?: number;
}

export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions
): Promise<{ data: T; cacheStatus: "HIT" | "STALE" | "MISS" }> {
  const { ttlSeconds, swrSeconds = 0 } = options;

  // Try to get from cache
  const cached = await redis.get(key);
  if (cached) {
    const ttl = await redis.ttl(key);
    const isStale = ttl <= swrSeconds;

    if (isStale && swrSeconds > 0) {
      // Serve stale, refresh in background
      fetcher()
        .then((freshData) =>
          redis.setex(key, ttlSeconds + swrSeconds, JSON.stringify(freshData))
        )
        .catch((err) => console.error(`Background refresh failed for ${key}:`, err));

      return { data: JSON.parse(cached) as T, cacheStatus: "STALE" };
    }

    return { data: JSON.parse(cached) as T, cacheStatus: "HIT" };
  }

  // Cache miss — fetch and store
  const data = await fetcher();
  await redis.setex(key, ttlSeconds + swrSeconds, JSON.stringify(data));

  return { data, cacheStatus: "MISS" };
}

export async function invalidateCache(pattern: string): Promise<number> {
  const keys = await redis.keys(pattern);
  if (keys.length === 0) return 0;
  return redis.del(...keys);
}
```

Applying cache strategy per route group:

```typescript
// server/middleware/cache-headers.ts
import { Request, Response, NextFunction } from "express";

export function cacheHeaders(type: "public" | "private" | "no-cache") {
  return (_req: Request, res: Response, next: NextFunction) => {
    switch (type) {
      case "public":
        res.set({
          "Cache-Control": "public, max-age=120, stale-while-revalidate=60",
          Vary: "Accept-Encoding",
        });
        break;
      case "private":
        res.set({
          "Cache-Control": "private, max-age=60",
          Vary: "Accept-Encoding, Cookie",
        });
        break;
      case "no-cache":
        res.set({
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "Surrogate-Control": "no-store",
        });
        break;
    }
    next();
  };
}

// server/index.ts — apply cache strategies per route group
import express from "express";
import { cacheHeaders } from "./middleware/cache-headers";
import catalogRoutes from "./routes/catalog";
import { checkoutRoutes } from "./routes/checkout";
import { orderRoutes } from "./routes/orders";
import { profileRoutes } from "./routes/profile";

const app = express();
app.use(express.json());

// Cacheable routes — public catalog data
app.use("/api/bff/catalog", cacheHeaders("public"), catalogRoutes);

// Non-cacheable routes — transactional and personal data
app.use("/api/bff/checkout", cacheHeaders("no-cache"), checkoutRoutes);
app.use("/api/bff/orders", cacheHeaders("no-cache"), orderRoutes);
app.use("/api/bff/profile", cacheHeaders("no-cache"), profileRoutes);
```

## Common failure modes

- **Caching based on session or user identity**: Creating per-user caches for catalog data (e.g., keying product search results by user ID) multiplies storage by user count and eliminates the primary benefit of caching. Cache public API responses by request URL/params only. For trade-policy-specific pricing, include trade policy (not user ID) in the cache key.

  ```typescript
  // Cache key based on request parameters only — not user identity
  function buildCacheKey(path: string, params: Record<string, string>): string {
    const sortedParams = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    return `search:${path}:${sortedParams}`;
  }
  ```

- **Setting extremely long cache TTLs without invalidation**: TTLs of hours or days mean price changes, stock updates, and new products are invisible to shoppers. Use moderate TTLs (2-15 minutes) combined with event-driven invalidation and `stale-while-revalidate`.

  ```typescript
  // Moderate TTL with stale-while-revalidate
  const CACHE_CONFIG = {
    search: { ttlSeconds: 120, swrSeconds: 60 },      // 2 min + 1 min SWR
    categories: { ttlSeconds: 900, swrSeconds: 300 },  // 15 min + 5 min SWR
    product: { ttlSeconds: 300, swrSeconds: 60 },       // 5 min + 1 min SWR
    topSearches: { ttlSeconds: 600, swrSeconds: 120 },  // 10 min + 2 min SWR
  } as const;
  ```

- **No cache monitoring or observability**: Without measuring hit/miss/stale rates, you cannot tell if caching is effective or if TTLs are appropriate. Add `X-Cache` headers and track metrics in your observability platform.

  ```typescript
  // Add cache observability to every cached response
  interface CacheMetrics {
    hits: number;
    misses: number;
    stale: number;
  }

  const metrics: CacheMetrics = { hits: 0, misses: 0, stale: 0 };

  export function getCacheMetrics(): CacheMetrics & { hitRate: string } {
    const total = metrics.hits + metrics.misses + metrics.stale;
    const hitRate = total > 0 ? ((metrics.hits / total) * 100).toFixed(1) + "%" : "N/A";
    return { ...metrics, hitRate };
  }
  ```

## Review checklist

- [ ] Are all public, read-only API responses (Search, Catalog) cached at CDN and/or BFF level?
- [ ] Are transactional/personal API responses (Checkout, Profile, OMS, Payments) explicitly NOT cached with `no-store` headers?
- [ ] Do all caches have bounded TTLs (not permanent/infinite)?
- [ ] Is there a cache invalidation mechanism (TTL + event-driven or manual purge)?
- [ ] Are cache keys based on request parameters, not user identity?
- [ ] Is `stale-while-revalidate` used for the best freshness/performance balance?
- [ ] Are TTLs moderate (2-15 minutes) rather than extremely long (hours/days)?
- [ ] Is cache observability in place (X-Cache headers, hit/miss metrics)?

## Reference

- [How the cache works](https://help.vtex.com/en/docs/tutorials/understanding-how-the-cache-works) — VTEX native caching behavior and cache layer architecture
- [Cloud infrastructure](https://developers.vtex.com/docs/guides/cloud-infrastructure) — VTEX CDN, router, and caching infrastructure overview
- [Best practices for avoiding rate limit errors](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) — Caching as a strategy to avoid API rate limits
- [Implementing cache in GraphQL APIs for IO apps](https://developers.vtex.com/docs/guides/implementing-cache-in-graphql-apis-for-io-apps) — Cache patterns for VTEX IO (useful reference for cache scope concepts)
- [Intelligent Search API](https://developers.vtex.com/docs/api-reference/intelligent-search-api) — The primary cacheable API for headless storefronts
- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — General architecture for headless VTEX stores

---

# Checkout API Proxy & OrderForm Management

## When this skill applies

Use this skill when building cart and checkout functionality for any headless VTEX storefront. Every cart and checkout operation must go through the BFF.

- Implementing cart creation, item add/update/remove operations
- Attaching profile, shipping, or payment data to an OrderForm
- Implementing the 3-step order placement flow (place → pay → process)
- Managing `orderFormId` and `CheckoutOrderFormOwnership` cookies server-side

Do not use this skill for:

- General BFF architecture and API routing (use [`headless-bff-architecture`](../headless-bff-architecture/skill.md))
- Search API integration (use [`headless-intelligent-search`](../headless-intelligent-search/skill.md))
- Caching strategy decisions (use [`headless-caching-strategy`](../headless-caching-strategy/skill.md))

## Decision rules

- ALL Checkout API calls (`/api/checkout/...` on `vtexcommercestable.com.br`) MUST be proxied through the BFF. The Checkout API handles sensitive personal data (profile, address, payment-method selection).
- **PCI carve-out:** the Send payments information call to the VTEX Payment Gateway (`POST https://{account}.vtexpayments.com.br/api/pub/transactions/{tid}/payments`) MUST go directly from the browser/app to `vtexpayments.com.br` whenever it carries card data. The merchant BFF MUST NOT be in the card-data path. See the dedicated hard constraint below and [`payment-pci-security`](../../../payment/skills/payment-pci-security/skill.md).
- Store `orderFormId` in a server-side session, never in `localStorage` or `sessionStorage`.
- Capture and forward `CheckoutOrderFormOwnership` and `checkout.vtex.com` cookies between the BFF and VTEX on every request.
- Validate all inputs server-side before forwarding to VTEX — never pass raw `req.body` directly.
- Execute the 3-step order placement flow (place order → send payment → process order) as a single synchronous user interaction within the **5-minute window**. Step 1 (place) and Step 3 (gateway callback) run in the BFF; Step 2 (send payment data to `vtexpayments.com.br`) runs in the browser per the PCI carve-out above.
- Always store and reuse the existing `orderFormId` from the session — only create a new cart when no `orderFormId` exists.
- Pass intermediate flow values such as `orderGroup` between Step 1 (`/place`) and Step 3 (`/process`) **through the request body**, not through `req.session`. Production BFFs are typically multi-replica; `express-session`'s default `MemoryStore` (and any per-pod cache) loses the value when the two requests land on different pods, returning a misleading "no pending order to process" 400. If a shared session store (Redis, Memcached, database) is already required for `orderFormId`/`vtexCookies`, see the Hard constraint below for why the cross-step handoff still belongs in the request body — it stays correct under partial outages, sticky-routing failures, and replay/refresh after a tab reload.

OrderForm attachment endpoints:

| Attachment        | Endpoint                                                | Purpose                           |
| ----------------- | ------------------------------------------------------- | --------------------------------- |
| items             | `POST .../orderForm/{id}/items`                         | Add, remove, or update cart items |
| clientProfileData | `POST .../orderForm/{id}/attachments/clientProfileData` | Customer profile info             |
| shippingData      | `POST .../orderForm/{id}/attachments/shippingData`      | Address and delivery option       |
| paymentData       | `POST .../orderForm/{id}/attachments/paymentData`       | Payment method selection          |
| marketingData     | `POST .../orderForm/{id}/attachments/marketingData`     | Coupons and UTM data              |

## Hard constraints

### Constraint: ALL Checkout API operations MUST go through BFF

Client-side code MUST NOT make direct HTTP requests to any VTEX Checkout API endpoint on `vtexcommercestable.com.br/api/checkout/...`. All Checkout API operations — cart creation, item management, profile updates, shipping, payment-method selection (`paymentData` attachment), order placement (`/transaction`), and order processing (`/gatewayCallback`) — must be proxied through the BFF.

This rule applies to the Checkout API only. The Send payments information call on `vtexpayments.com.br` is governed by the next constraint and goes the opposite way (browser-direct) for PCI reasons; do not generalize this rule to that endpoint.

**Why this matters**

Checkout endpoints handle sensitive personal data (email, address, phone, payment-method selection). Direct frontend calls expose the request/response flow to browser DevTools, extensions, and XSS attacks. Additionally, the BFF layer is needed to manage `VtexIdclientAutCookie` and `CheckoutOrderFormOwnership` cookies server-side, validate inputs, and prevent cart manipulation (e.g., price tampering).

**Detection**

If you see `fetch` or `axios` calls to `vtexcommercestable.com.br/api/checkout/...` in any client-side code (browser-executed JavaScript, frontend source files) → STOP immediately. All Checkout API calls must route through BFF endpoints.

**Correct**

```typescript
// Frontend — calls BFF endpoint, never VTEX directly
async function addItemToCart(
  skuId: string,
  quantity: number,
  seller: string,
): Promise<OrderForm> {
  const response = await fetch("/api/bff/cart/items", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skuId, quantity, seller }),
  });

  if (!response.ok) {
    throw new Error(`Failed to add item: ${response.status}`);
  }

  return response.json();
}
```

**Wrong**

```typescript
// Frontend — calls VTEX Checkout API directly (SECURITY VULNERABILITY)
async function addItemToCart(
  skuId: string,
  quantity: number,
  seller: string,
): Promise<OrderForm> {
  const orderFormId = localStorage.getItem("orderFormId"); // Also wrong: see next constraint
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/checkout/pub/orderForm/${orderFormId}/items`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderItems: [{ id: skuId, quantity, seller }],
      }),
    },
  );
  return response.json();
}
```

---

### Constraint: Card data MUST go directly from browser/app to vtexpayments.com.br — never through the BFF

The Send payments information call (`POST https://{account}.vtexpayments.com.br/api/pub/transactions/{tid}/payments?orderId={orderGroup}`) carries card data when the shopper pays with a credit, debit, or co-branded card. This call MUST originate from the shopper's browser or native app and MUST target `vtexpayments.com.br` directly. The BFF MUST NOT proxy this call when card data is involved, even with redaction, even with `appKey`/`appToken` on the server side, and even when only "tokenized" fields appear to be forwarded.

This is the inverse of the previous constraint. Treating it as a generic "checkout" call and routing it through the BFF — as some agents do when applying the "all checkout through BFF" rule too broadly — is a PCI DSS violation, not a security improvement.

**Why this matters**

The merchant operating the headless storefront is rarely PCI DSS Level 1 certified. Routing card numbers, holder names, or CVV through the merchant's BFF places the BFF and every system it touches — application logs, APM/observability tools, reverse proxies, load balancers, error trackers — inside PCI scope. Operating a non-PCI environment that handles card data violates PCI DSS Requirements 3 and 4 and can result in fines from $5,000 to over $100,000 per month from card networks, mandatory forensic investigation costs, loss of card processing ability, and legal liability.

The browser → `vtexpayments.com.br` path is the PCI-compliant pattern: the VTEX Payment Gateway is PCI DSS Level 1 certified and is the only environment in this flow authorized to receive raw card data. The Send payments call is authenticated by the shopper's session cookies set by the previous Place Order step — no merchant credentials are needed on the BFF for this hop.

**Detection**

If you find any of the following in BFF / server-side code (`server/`, `bff/`, `api/`, route handlers, middleware, edge functions, lambdas), STOP immediately:

- A request from the BFF to `https://*.vtexpayments.com.br/api/pub/transactions/.../payments`,
- A handler that accepts `cardNumber`, `holderName`, `validationCode`, `csc`, `dueDate`, or full payment `fields` from the browser and forwards them to any VTEX endpoint,
- A "Payments client" / `ExternalClient` / `axios` instance that targets `vtexpayments.com.br` for the Send payments information endpoint.

Move that call to the browser/app. The BFF should instead return `transactionId`, `orderGroup`, and `merchantName` from the Place Order step so the frontend can post payment data directly to the Payment Gateway.

This rule applies even when:

- The merchant has a VTEX `appKey`/`appToken` with payment permissions — possessing the credentials does not grant PCI authorization.
- Only "tokenized" card fields are forwarded — token values still reference real card data and are in PCI scope.
- The BFF code "redacts" sensitive fields before logging — the request still transits the merchant infrastructure before redaction.
- The BFF runs on a private VPC with TLS — PCI scope is determined by what data passes through, not by how the network is configured.

**Correct**

```typescript
async function sendPaymentDataDirect(args: {
  account: string;
  transactionId: string;
  orderGroup: string;
  merchantName: string;
  paymentInformation: PaymentField[];
}): Promise<void> {
  const {
    account,
    transactionId,
    orderGroup,
    merchantName,
    paymentInformation,
  } = args;

  const response = await fetch(
    `https://${account}.vtexpayments.com.br/api/pub/transactions/${transactionId}/payments?orderId=${orderGroup}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        paymentInformation.map((p) => ({
          ...p,
          transaction: { id: transactionId, merchantName },
        })),
      ),
    },
  );

  if (!response.ok) {
    throw new Error(`Payment submission failed: ${response.status}`);
  }
}
```

**Wrong**

```typescript
const VTEX_APP_KEY = process.env.VTEX_APP_KEY!;
const VTEX_APP_TOKEN = process.env.VTEX_APP_TOKEN!;

paymentRoutes.post("/", async (req: Request, res: Response) => {
  const { transactionId, orderGroup, paymentInformation } = req.body as {
    transactionId: string;
    orderGroup: string;
    paymentInformation: Array<{
      paymentSystem: number;
      installments: number;
      value: number;
      fields: {
        cardNumber: string;
        holderName: string;
        validationCode: string;
        dueDate: string;
      };
    }>;
  };

  const url = `https://${process.env.VTEX_ACCOUNT}.vtexpayments.com.br/api/pub/transactions/${transactionId}/payments?orderId=${orderGroup}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-API-AppKey": VTEX_APP_KEY,
      "X-VTEX-API-AppToken": VTEX_APP_TOKEN,
    },
    body: JSON.stringify(paymentInformation),
  });

  res.json({ status: response.status });
});
```

---

### Constraint: orderFormId MUST be managed server-side

The `orderFormId` MUST be stored in a secure server-side session. It SHOULD NOT be stored in `localStorage`, `sessionStorage`, or exposed to the frontend in a way that allows direct VTEX API calls.

**Why this matters**

The `orderFormId` is the key to a customer's shopping cart and all data within it — profile information, shipping address, payment details. If exposed client-side, an attacker could use it to query VTEX directly and retrieve personal data, or manipulate the cart by adding/removing items through direct API calls bypassing any validation logic.

**Detection**

If you see `orderFormId` stored in `localStorage` or `sessionStorage` → STOP immediately. It should be managed in the BFF session.

**Correct**

```typescript
// BFF — manages orderFormId in server-side session
import { Router, Request, Response } from "express";
import { vtexCheckoutRequest } from "../vtex-api-client";

export const cartRoutes = Router();

// Get or create cart — orderFormId stays server-side
cartRoutes.get("/", async (req: Request, res: Response) => {
  try {
    let orderFormId = req.session.orderFormId;

    if (orderFormId) {
      // Retrieve existing cart
      const orderForm = await vtexCheckoutRequest({
        path: `/api/checkout/pub/orderForm/${orderFormId}`,
        method: "GET",
        cookies: req.session.vtexCookies,
      });
      return res.json(sanitizeOrderForm(orderForm));
    }

    // Create new cart
    const orderForm = await vtexCheckoutRequest({
      path: "/api/checkout/pub/orderForm",
      method: "GET",
      cookies: req.session.vtexCookies,
    });

    // Store orderFormId in session — never expose raw ID to frontend
    req.session.orderFormId = orderForm.orderFormId;
    req.session.vtexCookies = orderForm._cookies; // Store checkout cookies

    res.json(sanitizeOrderForm(orderForm));
  } catch (error) {
    console.error("Error getting cart:", error);
    res.status(500).json({ error: "Failed to get cart" });
  }
});

// Remove sensitive data before sending to frontend
function sanitizeOrderForm(
  orderForm: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized = { ...orderForm };
  delete sanitized._cookies;
  return sanitized;
}
```

**Wrong**

```typescript
// Frontend — stores orderFormId in localStorage (INSECURE)
async function getCart(): Promise<OrderForm> {
  let orderFormId = localStorage.getItem("orderFormId"); // EXPOSED to client

  if (!orderFormId) {
    const response = await fetch(
      "https://mystore.vtexcommercestable.com.br/api/checkout/pub/orderForm",
    );
    const data = await response.json();
    orderFormId = data.orderFormId;
    localStorage.setItem("orderFormId", orderFormId!); // Stored client-side!
  }

  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/checkout/pub/orderForm/${orderFormId}`,
  );
  return response.json();
}
```

---

### Constraint: Multi-step order flow handoffs MUST travel in the request body, not in `req.session`

Values that link `/place` (Step 1) and `/process` (Step 3) — most importantly `orderGroup`, but also any per-attempt `transactionId` or merchant context the frontend needs to echo back — MUST be returned by `/place` to the browser and sent back by the browser in the `/process` request body. The handler MUST NOT rely on `req.session.pendingOrderGroup` (or any per-pod cache) as the only source of truth for the in-flight order.

**Why this matters**

Production BFFs run multiple replicas (Kubernetes deployments, ECS services, lambdas behind an ALB, edge runtimes). `express-session` defaults to `MemoryStore`, which is per-pod, so a session value written on one pod is invisible to every other pod. Even with a shared session store (Redis, DynamoDB, Memcached), Step 1 and Step 3 fire as fast as the user can roundtrip through `vtexpayments.com.br`, so any partial Redis outage, write replication lag, sticky-routing failure, tab refresh, or session regeneration on login surfaces as `400 — no pending order to process`. From the shopper's point of view the order is paid (their card was charged in Step 2) but the storefront reports failure, and support has to reconcile by hand. The 5-minute order processing window leaves no time for retries.

`orderGroup` is not a secret. It already returns to the browser from Step 1 and is required by the direct browser → `vtexpayments.com.br` call in Step 2. Echoing it back in Step 3 is strictly less surface area than session-backed state. Authentication and ownership are still enforced server-side through the session-bound `vtexCookies`, `orderFormId`, and (when present) `vtexAuthToken` — the BFF never trusts `orderGroup` alone.

**Detection**

If you find any of the following in BFF / server-side checkout code, STOP immediately:

- Any read or write of `req.session.pendingOrderGroup`, `req.session.orderGroup`, `req.session.lastTransactionId`, or similar per-flow values written in `/place` and read in `/process`.
- A `/process` (or `/gatewayCallback`) handler whose only source of `orderGroup` is `req.session`, with no `req.body.orderGroup` fallback or validation.
- A frontend `placeOrder` flow that calls `/api/bff/order/process` with no body and no `orderGroup`, relying on the BFF to "remember" the order.
- Comments like "// rely on session to recover orderGroup" or commits that move `orderGroup` from request bodies into the session for "tidiness".

**Correct**

```typescript
orderRoutes.post("/place", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;
  if (!orderFormId) return res.status(400).json({ error: "No active cart" });

  const { data } = await vtexCheckout<PlaceOrderResponse>({
    path: `/api/checkout/pub/orderForm/${orderFormId}/transaction`,
    method: "POST",
    body: { referenceId: orderFormId },
    cookies: req.session.vtexCookies || {},
    userToken: req.session.vtexAuthToken,
  });

  res.json({
    account: process.env.VTEX_ACCOUNT,
    orderId: data.orders[0].orderId,
    orderGroup: data.orderGroup,
    transactionId: data.orders[0].transactionData.merchantTransactions[0].transactionId,
    merchantName: data.orders[0].transactionData.merchantTransactions[0].merchantName,
  });
});

orderRoutes.post("/process", async (req: Request, res: Response) => {
  const orderGroup =
    typeof req.body?.orderGroup === "string" ? req.body.orderGroup : undefined;
  if (!orderGroup || !/^[A-Za-z0-9-]+$/.test(orderGroup)) {
    return res.status(400).json({ error: "Missing or invalid orderGroup" });
  }
  if (!req.session.orderFormId) {
    return res.status(400).json({ error: "No active checkout session" });
  }

  await vtexCheckout({
    path: `/api/checkout/pub/gatewayCallback/${orderGroup}`,
    method: "POST",
    cookies: req.session.vtexCookies || {},
  });

  delete req.session.orderFormId;
  delete req.session.vtexCookies;
  res.json({ orderGroup, status: "processed" });
});
```

The matching browser flow — `/place` returns `orderGroup` and the browser echoes it back in the `/process` body — is shown in the Preferred pattern below.

**Wrong**

```typescript
orderRoutes.post("/place", async (req: Request, res: Response) => {
  // ... call /transaction ...
  req.session.pendingOrderGroup = orderGroup;
  res.json({ account, orderId, orderGroup, transactionId, merchantName });
});

orderRoutes.post("/process", async (req: Request, res: Response) => {
  // BUG: works in dev with one Node process and MemoryStore, returns
  // `400 — no pending order to process` the moment the load balancer routes
  // /place and /process to different replicas.
  const orderGroup = req.session.pendingOrderGroup;
  if (!orderGroup) {
    return res.status(400).json({ error: "No pending order to process" });
  }

  await vtexCheckout({
    path: `/api/checkout/pub/gatewayCallback/${orderGroup}`,
    method: "POST",
    cookies: req.session.vtexCookies || {},
  });

  delete req.session.pendingOrderGroup;
  res.json({ status: "processed" });
});
```

---

### Constraint: MUST validate all inputs server-side before forwarding to VTEX

The BFF MUST validate all input data before forwarding requests to the VTEX Checkout API. This includes validating SKU IDs, quantities, email formats, address fields, and coupon codes.

**Why this matters**

Without server-side validation, malicious users can send crafted requests through the BFF to VTEX with invalid or manipulative data — negative quantities, SQL injection in text fields, or spoofed seller IDs. While VTEX has its own validation, defense-in-depth requires validating at the BFF layer to catch issues early and provide clear error messages.

**Detection**

If BFF route handlers pass `req.body` directly to VTEX API calls without any validation or sanitization → STOP immediately. All inputs must be validated before proxying.

**Correct**

```typescript
// BFF — validates inputs before forwarding to VTEX
import { Router, Request, Response } from "express";
import { vtexCheckoutRequest } from "../vtex-api-client";

export const cartItemsRoutes = Router();

interface AddItemRequest {
  skuId: string;
  quantity: number;
  seller: string;
}

function validateAddItemInput(body: unknown): body is AddItemRequest {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;

  return (
    typeof b.skuId === "string" &&
    /^\d+$/.test(b.skuId) &&
    typeof b.quantity === "number" &&
    Number.isInteger(b.quantity) &&
    b.quantity > 0 &&
    b.quantity <= 100 &&
    typeof b.seller === "string" &&
    /^[a-zA-Z0-9]+$/.test(b.seller)
  );
}

cartItemsRoutes.post("/", async (req: Request, res: Response) => {
  if (!validateAddItemInput(req.body)) {
    return res.status(400).json({
      error: "Invalid input",
      details:
        "skuId must be numeric, quantity must be 1-100, seller must be alphanumeric",
    });
  }

  const { skuId, quantity, seller } = req.body;
  const orderFormId = req.session.orderFormId;

  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  try {
    const orderForm = await vtexCheckoutRequest({
      path: `/api/checkout/pub/orderForm/${orderFormId}/items`,
      method: "POST",
      body: {
        orderItems: [{ id: skuId, quantity, seller }],
      },
      cookies: req.session.vtexCookies,
    });

    res.json(sanitizeOrderForm(orderForm));
  } catch (error) {
    console.error("Error adding item:", error);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});
```

**Wrong**

```typescript
// BFF — passes raw input to VTEX without validation (UNSAFE)
cartRoutes.post("/items", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;

  // No validation — attacker can send any payload
  const orderForm = await vtexCheckoutRequest({
    path: `/api/checkout/pub/orderForm/${orderFormId}/items`,
    method: "POST",
    body: req.body, // Raw, unvalidated input passed directly!
    cookies: req.session.vtexCookies,
  });

  res.json(orderForm);
});
```

## Preferred pattern

Request flow through the BFF for checkout operations:

```text
Frontend
    │
    └── POST /api/bff/cart/items/add  {skuId, quantity, seller}
            │
            BFF Layer
            │ 1. Validates input (skuId format, quantity > 0, seller exists)
            │ 2. Reads orderFormId from server-side session
            │ 3. Forwards CheckoutOrderFormOwnership cookie
            │ 4. Calls VTEX: POST /api/checkout/pub/orderForm/{id}/items
            │ 5. Updates session with new orderFormId if changed
            │ 6. Returns sanitized orderForm to frontend
            │
            VTEX Checkout API
```

VTEX Checkout API client with cookie management:

```typescript
// server/vtex-checkout-client.ts
const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_ENVIRONMENT = process.env.VTEX_ENVIRONMENT || "vtexcommercestable";
const BASE_URL = `https://${VTEX_ACCOUNT}.${VTEX_ENVIRONMENT}.com.br`;

interface CheckoutRequestOptions {
  path: string;
  method?: string;
  body?: unknown;
  cookies?: Record<string, string>;
  userToken?: string;
}

interface CheckoutResponse<T = unknown> {
  data: T;
  cookies: Record<string, string>;
}

export async function vtexCheckout<T>(
  options: CheckoutRequestOptions,
): Promise<CheckoutResponse<T>> {
  const { path, method = "GET", body, cookies = {}, userToken } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  // Build cookie header from stored cookies
  const cookieParts: string[] = [];
  if (cookies["checkout.vtex.com"]) {
    cookieParts.push(`checkout.vtex.com=${cookies["checkout.vtex.com"]}`);
  }
  if (cookies["CheckoutOrderFormOwnership"]) {
    cookieParts.push(
      `CheckoutOrderFormOwnership=${cookies["CheckoutOrderFormOwnership"]}`,
    );
  }
  if (userToken) {
    cookieParts.push(`VtexIdclientAutCookie=${userToken}`);
  }
  if (cookieParts.length > 0) {
    headers["Cookie"] = cookieParts.join("; ");
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Checkout API error: ${response.status} for ${method} ${path}: ${errorBody}`,
    );
  }

  // Extract cookies from response for session storage
  const responseCookies: Record<string, string> = {};
  const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
  for (const setCookie of setCookieHeaders) {
    const [nameValue] = setCookie.split(";");
    const [name, value] = nameValue.split("=");
    if (name && value) {
      responseCookies[name.trim()] = value.trim();
    }
  }

  const data = (await response.json()) as T;
  return { data, cookies: { ...cookies, ...responseCookies } };
}
```

Cart management BFF routes:

```typescript
// server/routes/cart.ts
import { Router, Request, Response } from "express";
import { vtexCheckout } from "../vtex-checkout-client";

export const cartRoutes = Router();

// GET /api/bff/cart — get or create cart
cartRoutes.get("/", async (req: Request, res: Response) => {
  try {
    const result = await vtexCheckout<OrderForm>({
      path: req.session.orderFormId
        ? `/api/checkout/pub/orderForm/${req.session.orderFormId}`
        : "/api/checkout/pub/orderForm",
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.orderFormId = result.data.orderFormId;
    req.session.vtexCookies = result.cookies;

    res.json(result.data);
  } catch (error) {
    console.error("Error getting cart:", error);
    res.status(500).json({ error: "Failed to get cart" });
  }
});

// POST /api/bff/cart/items — add items to cart
cartRoutes.post("/items", async (req: Request, res: Response) => {
  const { items } = req.body as {
    items: Array<{ id: string; quantity: number; seller: string }>;
  };

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Items array is required" });
  }

  for (const item of items) {
    if (
      !item.id ||
      typeof item.quantity !== "number" ||
      item.quantity < 1 ||
      !item.seller
    ) {
      return res
        .status(400)
        .json({ error: "Each item must have id, quantity (>0), and seller" });
    }
  }

  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res
      .status(400)
      .json({ error: "No active cart. Call GET /api/bff/cart first." });
  }

  try {
    const result = await vtexCheckout<OrderForm>({
      path: `/api/checkout/pub/orderForm/${orderFormId}/items`,
      method: "POST",
      body: { orderItems: items },
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.vtexCookies = result.cookies;
    res.json(result.data);
  } catch (error) {
    console.error("Error adding items:", error);
    res.status(500).json({ error: "Failed to add items to cart" });
  }
});
```

Order placement — Steps 1 and 3 run in the BFF; Step 2 runs in the browser per the PCI carve-out. All 3 steps must complete within the **5-minute window**.

```typescript
// server/routes/order.ts — BFF handles Step 1 (place) and Step 3 (process) only.
// Step 2 (send payment data) runs in the browser; see the card-data carve-out constraint.
import { Router, Request, Response } from "express";
import { vtexCheckout } from "../vtex-checkout-client";

export const orderRoutes = Router();

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;

// POST /api/bff/order/place — Step 1: place order from existing cart.
// Returns the data the browser needs to call vtexpayments.com.br directly in
// Step 2 AND to call /api/bff/order/process in Step 3. The browser is the
// authority for `orderGroup` between Step 1 and Step 3 — the BFF does NOT
// stash it in `req.session`, because that would silently break in any
// multi-replica deployment whose session store is in-memory or sticky-routed.
orderRoutes.post("/place", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  try {
    const placeResult = await vtexCheckout<PlaceOrderResponse>({
      path: `/api/checkout/pub/orderForm/${orderFormId}/transaction`,
      method: "POST",
      body: { referenceId: orderFormId },
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    const { orders, orderGroup } = placeResult.data;
    if (!orders?.length) {
      return res
        .status(500)
        .json({ error: "Order placement returned no orders" });
    }

    const orderId = orders[0].orderId;
    const merchantTransaction =
      orders[0].transactionData.merchantTransactions[0];
    const transactionId = merchantTransaction?.transactionId;
    const merchantName = merchantTransaction?.merchantName ?? VTEX_ACCOUNT;

    res.json({
      account: VTEX_ACCOUNT,
      orderId,
      orderGroup,
      transactionId,
      merchantName,
    });
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ error: "Failed to place order" });
  }
});

// POST /api/bff/order/process — Step 3: process gateway callback after the
// browser has submitted payment data directly to vtexpayments.com.br in Step 2.
// Carries no card data; safe to run server-side. The browser passes back the
// same `orderGroup` it received from /place so the handler is stateless across
// replicas. The BFF still validates ownership through the session-bound
// orderFormId + checkout cookies before calling VTEX.
orderRoutes.post("/process", async (req: Request, res: Response) => {
  const orderGroup =
    typeof req.body?.orderGroup === "string" ? req.body.orderGroup : undefined;
  if (!orderGroup || !/^[A-Za-z0-9-]+$/.test(orderGroup)) {
    return res.status(400).json({ error: "Missing or invalid orderGroup" });
  }
  if (!req.session.orderFormId) {
    return res.status(400).json({ error: "No active checkout session" });
  }

  try {
    await vtexCheckout<unknown>({
      path: `/api/checkout/pub/gatewayCallback/${orderGroup}`,
      method: "POST",
      cookies: req.session.vtexCookies || {},
    });

    delete req.session.orderFormId;
    delete req.session.vtexCookies;

    res.json({ orderGroup, status: "processed" });
  } catch (error) {
    console.error("Error processing order:", error);
    res.status(500).json({ error: "Failed to process order" });
  }
});
```

```typescript
// frontend/checkout/placeOrder.ts — Step 2 runs in the browser.
// Card fields stay on the device; the BFF never sees them.
// Step 3 echoes `orderGroup` back to the BFF in the request body so it works
// the same way whether the BFF runs on one pod or fifty.
async function placeOrderWithCard(card: CardPaymentInformation) {
  const placeResp = await fetch("/api/bff/order/place", {
    method: "POST",
    credentials: "include",
  });
  const { account, orderGroup, transactionId, merchantName } =
    await placeResp.json();

  await fetch(
    `https://${account}.vtexpayments.com.br/api/pub/transactions/${transactionId}/payments?orderId=${orderGroup}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        { ...card, transaction: { id: transactionId, merchantName } },
      ]),
    },
  );

  await fetch("/api/bff/order/process", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderGroup }),
  });
}
```

## Common failure modes

- **Creating a new cart on every page load**: Calling `GET /api/checkout/pub/orderForm` without an `orderFormId` on every page load creates a new empty cart each time, abandoning the previous one. Always store and reuse the `orderFormId` from the server-side session.

  ```typescript
  // Always check for existing orderFormId first
  cartRoutes.get("/", async (req: Request, res: Response) => {
    const orderFormId = req.session.orderFormId;

    const path = orderFormId
      ? `/api/checkout/pub/orderForm/${orderFormId}` // Retrieve existing cart
      : "/api/checkout/pub/orderForm"; // Create new cart only if none exists

    const result = await vtexCheckout<OrderForm>({
      path,
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.orderFormId = result.data.orderFormId;
    req.session.vtexCookies = result.cookies;
    res.json(result.data);
  });
  ```

- **Ignoring the 5-minute order processing window**: Placing an order (Step 1) but delaying payment or processing beyond 5 minutes causes VTEX to automatically cancel the order as `incomplete`. Execute Steps 1 → 2 → 3 sequentially and immediately as a single user interaction. Step 1 (place) and Step 3 (gateway callback) run in the BFF; Step 2 (send payment data) runs in the browser per the card-data carve-out above. Do not pause for additional UI between steps.

  ```typescript
  // Frontend orchestrates Place (BFF) → Pay (browser → vtexpayments.com.br) → Process (BFF)
  // on a single click, well within the 5-minute window.
  async function onPlaceOrderClick(card: CardPaymentInformation) {
    const { account, orderGroup, transactionId, merchantName } =
      await fetchJson("/api/bff/order/place", { method: "POST" });

    await sendPaymentDirectToGateway({
      account,
      transactionId,
      orderGroup,
      merchantName,
      card,
    });

    await fetchJson("/api/bff/order/process", {
      method: "POST",
      body: { orderGroup },
    });
  }
  ```

- **Proxying `vtexpayments.com.br` payment submission through the BFF "for consistency"**: Routing the Send payments information call through the BFF feels symmetrical with the rest of the BFF mandate, and some agents add it to "centralize all VTEX calls". When card data is involved this is a PCI DSS violation, not a refactor. Keep Step 2 in the browser; the BFF should expose `/api/bff/order/place` (returns `transactionId`/`orderGroup`/`merchantName`) and `/api/bff/order/process` (calls `/gatewayCallback`) but never `/api/bff/order/payment` for card flows.

- **Storing `orderGroup` in `req.session` between `/place` and `/process`**: Writing `req.session.pendingOrderGroup` in Step 1 and reading it in Step 3 looks tidy and works in single-process local development. With `express-session`'s default `MemoryStore` (and any per-pod cache) a horizontally scaled BFF loses the value the moment the two requests land on different replicas, so `/process` returns `400 — no pending order to process` while the shopper's card has already been charged in Step 2. Return `orderGroup` from `/place` to the browser and require the browser to send it back in the `/process` body — see the dedicated hard constraint above. Even with a shared session store (Redis, Memcached, database) in place for `orderFormId`/`vtexCookies`, the cross-step handoff still belongs in the request body so the flow stays correct under partial outages, sticky-routing failures, replication lag, and tab refresh.

- **Exposing raw VTEX error messages to the frontend**: Forwarding VTEX API error responses directly to the frontend leaks internal details (account names, API paths, data structures). Map VTEX errors to user-friendly messages in the BFF and log the full error server-side.

  ```typescript
  // Map VTEX errors to safe, user-friendly messages
  function mapCheckoutError(
    vtexError: string,
    statusCode: number,
  ): { code: string; message: string } {
    if (statusCode === 400 && vtexError.includes("item")) {
      return {
        code: "INVALID_ITEM",
        message: "One or more items are unavailable",
      };
    }
    if (statusCode === 400 && vtexError.includes("address")) {
      return {
        code: "INVALID_ADDRESS",
        message: "Please check your shipping address",
      };
    }
    if (statusCode === 409) {
      return {
        code: "CART_CONFLICT",
        message: "Your cart was updated. Please review your items.",
      };
    }
    return {
      code: "CHECKOUT_ERROR",
      message: "An error occurred during checkout. Please try again.",
    };
  }
  ```

## Review checklist

- [ ] Are ALL Checkout API calls (`vtexcommercestable.com.br/api/checkout/...`) routed through the BFF (no direct frontend calls)?
- [ ] Is the Send payments information call (`vtexpayments.com.br/api/pub/transactions/{tid}/payments`) sent from the browser/app directly, NOT proxied through the BFF, when card data is involved?
- [ ] Are `cardNumber`, `holderName`, `validationCode`/`csc`, and `dueDate` absent from every BFF route handler and log statement?
- [ ] Does any reference to `vtexpayments.com.br` in the codebase appear only in browser/app code, never in `server/`, `bff/`, `api/`, or other backend directories?
- [ ] Is `orderFormId` stored in a server-side session, not in `localStorage` or `sessionStorage`?
- [ ] Are `CheckoutOrderFormOwnership` and `checkout.vtex.com` cookies captured from VTEX responses and forwarded on subsequent requests?
- [ ] Are all inputs validated server-side before forwarding to VTEX?
- [ ] Do all 3 order-placement steps (place → pay → process) execute as a single user interaction within the 5-minute window, with Steps 1 and 3 in the BFF and Step 2 in the browser direct to `vtexpayments.com.br`?
- [ ] Is the existing `orderFormId` reused from the session rather than creating a new cart on every page load?
- [ ] Is `orderGroup` returned by `/place` and sent back by the browser in the `/process` request body, instead of being stashed in `req.session.pendingOrderGroup` between the two BFF calls?
- [ ] Are VTEX error responses sanitized before being sent to the frontend?

## Reference

- [Headless cart and checkout](https://developers.vtex.com/docs/guides/headless-cart-and-checkout) — Complete guide to implementing cart and checkout in headless stores
- [Checkout API reference](https://developers.vtex.com/docs/api-reference/checkout-api) — Full API reference for all Checkout endpoints
- [orderForm fields](https://developers.vtex.com/docs/guides/orderform-fields) — Detailed documentation of the OrderForm data structure
- [Creating a regular order from an existing cart](https://developers.vtex.com/docs/guides/creating-a-regular-order-from-an-existing-cart) — Step-by-step guide to the order placement flow
- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — General architecture for headless VTEX stores
- [Add cart items](https://developers.vtex.com/docs/guides/add-cart-items) — Guide to adding products to a shopping cart

---

# Intelligent Search API Integration

## When this skill applies

Use this skill when implementing product search, category browsing, autocomplete, or faceted filtering in a headless VTEX storefront.

- Building a search results page with product listings
- Implementing faceted navigation (category, brand, price, color filters)
- Adding autocomplete suggestions to a search input
- Wiring up search analytics events for Intelligent Search ranking

Do not use this skill for:
- BFF architecture and API routing decisions (use [`headless-bff-architecture`](../headless-bff-architecture/skill.md))
- Checkout or cart API integration (use [`headless-checkout-proxy`](../headless-checkout-proxy/skill.md))
- Caching strategy and TTL configuration (use [`headless-caching-strategy`](../headless-caching-strategy/skill.md))

## Decision rules

- Call Intelligent Search **directly from the frontend** — it is the ONE exception to the "everything through BFF" rule. It is fully public and requires no authentication.
- Do NOT proxy Intelligent Search through the BFF unless you have a specific need (e.g., server-side rendering). Proxying adds latency on a high-frequency operation.
- Always use the API's `sort` parameter and facet paths for filtering and sorting — never re-sort or re-filter results client-side.
- Always include `page` and `locale` parameters in every search request.
- When paginating beyond the first page, always reuse the `operator` and `fuzzy` values returned by the API from the first page — the API decides these values dynamically based on the search query.
- Always send analytics events to the Intelligent Search Events API — without them, search ranking degrades over time.

Search endpoints overview:

| Endpoint | Method | Purpose |
|---|---|---|
| `/product_search/{facets}` | GET | Search products by query and/or facets |
| `/facets/{facets}` | GET | Get available filters for a query |
| `/autocomplete_suggestions` | GET | Get term and product suggestions while typing |
| `/top_searches` | GET | Get the 10 most popular search terms |
| `/correction_search` | GET | Get spelling correction for a misspelled term |
| `/search_suggestions` | GET | Get suggested terms similar to the search term |
| `/banners/{facets}` | GET | Get banners configured for a query |

Facet combination rules:
- **Same facet type → OR (union)**: Selecting "Red" and "Blue" for color returns products matching either color
- **Different facet types → AND (intersection)**: Selecting "Red" color and "Nike" brand returns only red Nike products

## Hard constraints

### Constraint: MUST send analytics events to Intelligent Search Events API

Every headless search implementation MUST send analytics events to the Intelligent Search Events API - Headless. At minimum, send search impression events when results are displayed and click events when a product is selected from search results.

**Why this matters**

Intelligent Search uses machine learning to rank results based on user behavior. Without analytics events, the search engine has no behavioral data and cannot personalize or optimize results. Over time, search quality degrades compared to stores that send events. Additionally, VTEX Admin search analytics dashboards will show no data.

**Detection**

If a search implementation renders results from Intelligent Search but has no calls to `sp.vtex.com/event-api` or the Intelligent Search Events API → STOP immediately. Analytics events must be implemented alongside search.

**Correct**

```typescript
// search-analytics.ts — sends events to Intelligent Search Events API
const ACCOUNT_NAME = "mystore";
const EVENTS_URL = `https://sp.vtex.com/event-api/v1/${ACCOUNT_NAME}/event`;

interface SearchEvent {
  type: "search.query" | "search.click" | "search.add_to_cart";
  text: string;
  misspelled: boolean;
  match: number;
  operator: string;
  locale: string;
  agent: string;
  url: string;
  products?: Array<{ productId: string; position: number }>;
}

export async function sendSearchEvent(event: SearchEvent): Promise<void> {
  try {
    await fetch(EVENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true, // ensures event is sent even during navigation
    });
  } catch (error) {
    // Analytics failures should not break the UI
    console.warn("Failed to send search event:", error);
  }
}

// Usage: call after rendering search results
function onSearchResultsRendered(query: string, products: Product[]): void {
  sendSearchEvent({
    type: "search.query",
    text: query,
    misspelled: false,
    match: products.length,
    operator: "and",
    locale: "en-US",
    agent: "my-headless-store",
    url: window.location.href,
    products: products.map((p, i) => ({
      productId: p.productId,
      position: i + 1,
    })),
  });
}
```

**Wrong**

```typescript
// Search works but NO analytics events are sent — search ranking degrades
async function searchProducts(query: string): Promise<Product[]> {
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/io/_v/api/intelligent-search/product_search/?query=${query}&locale=en-US`
  );
  const data = await response.json();
  return data.products;
  // Missing: no call to sendSearchEvent() — Intelligent Search cannot learn
}
```

---

### Constraint: MUST persist operator and fuzzy values across pagination

When paginating search results beyond the first page, you MUST reuse the `operator` and `fuzzy` values returned by the API in the first page response. The first request should send these as `null`, but subsequent pages must use the values from the initial response.

**Why this matters**

The Intelligent Search API dynamically determines the best `operator` and `fuzzy` values based on the query and available results. Using fixed values (like always `operator: "or"` or `fuzzy: "0"`) or forgetting to pass them on subsequent pages causes inconsistent results — page 2 may show products that don't match the criteria from page 1, or may miss valid results. This is a common source of poor search experience but is not well-documented by VTEX.

**Detection**

If pagination implementation does not store and reuse `operator`/`fuzzy` from the first page response → STOP immediately. Subsequent pages will return inconsistent results.

**Correct**

```typescript
// Properly manages operator/fuzzy across pagination
interface SearchState {
  query: string;
  page: number;
  count: number;
  locale: string;
  facets?: string;
  operator: string | null; // null for first page, then persisted
  fuzzy: string | null;    // null for first page, then persisted
}

async function searchProducts(state: SearchState): Promise<SearchResponse> {
  const { query, page, count, locale, facets = "", operator, fuzzy } = state;

  const params = new URLSearchParams({
    query,
    locale,
    page: String(page),
    count: String(count),
  });

  // Only add operator/fuzzy if this is not the first page
  if (operator !== null) params.set("operator", operator);
  if (fuzzy !== null) params.set("fuzzy", fuzzy);

  const baseUrl = `https://${ACCOUNT}.vtexcommercestable.com.br`;
  const facetPath = facets ? `/${facets}` : "";
  const url = `${baseUrl}/api/io/_v/api/intelligent-search/product_search${facetPath}?${params}`;

  const response = await fetch(url);
  const data = await response.json();

  // Store operator/fuzzy from response for next page
  if (page === 0) {
    state.operator = data.operator;
    state.fuzzy = data.fuzzy;
  }

  return data;
}

// Usage: first page
const state: SearchState = {
  query: "running shoes",
  page: 0,
  count: 24,
  locale: "en-US",
  operator: null, // API will decide
  fuzzy: null,    // API will decide
};

const firstPage = await searchProducts(state);

// Usage: subsequent pages
state.page = 1;
const secondPage = await searchProducts(state); // reuses operator/fuzzy
```

**Wrong**

```typescript
// Using fixed operator/fuzzy values — causes bad results
async function searchProducts(query: string, page: number): Promise<SearchResponse> {
  const params = new URLSearchParams({
    query,
    locale: "en-US",
    page: String(page),
    count: "24",
    operator: "or", // WRONG: fixed value instead of API-provided
    fuzzy: "0",     // WRONG: fixed value instead of API-provided
  });

  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/io/_v/api/intelligent-search/product_search/?${params}`
  );
  return response.json();
}

// Or forgetting operator/fuzzy entirely on subsequent pages
async function searchProductsPage2(query: string): Promise<SearchResponse> {
  const params = new URLSearchParams({
    query,
    locale: "en-US",
    page: "1", // WRONG: no operator/fuzzy from first page
    count: "24",
  });
  // ...
}
```

---

### Constraint: Do NOT unnecessarily proxy Intelligent Search through BFF

Intelligent Search API requests SHOULD be made directly from the frontend. Do not route search traffic through the BFF unless you have a specific need (e.g., server-side rendering, adding custom business logic).

**Why this matters**

Intelligent Search is a public API that does not require authentication. Adding a BFF proxy layer introduces an additional network hop, increases latency on every search operation, adds server cost, and prevents the CDN from caching responses efficiently. Search queries are high-frequency operations — even 50ms of added latency impacts conversion.

**Detection**

If all Intelligent Search calls go through a BFF endpoint instead of directly to VTEX → note this to the developer. It is not a security issue but a performance concern. If there is no justification (like SSR), recommend direct frontend calls.

**Correct**

```typescript
// Frontend — calls Intelligent Search directly (no BFF needed)
const VTEX_SEARCH_BASE = `https://${ACCOUNT}.vtexcommercestable.com.br/api/io/_v/api/intelligent-search`;

export async function getAutocomplete(term: string, locale: string): Promise<AutocompleteResponse> {
  const params = new URLSearchParams({ query: term, locale });
  const response = await fetch(`${VTEX_SEARCH_BASE}/autocomplete_suggestions?${params}`);
  return response.json();
}

export async function getTopSearches(locale: string): Promise<TopSearchesResponse> {
  const params = new URLSearchParams({ locale });
  const response = await fetch(`${VTEX_SEARCH_BASE}/top_searches?${params}`);
  return response.json();
}

export async function getFacets(facetPath: string, query: string, locale: string): Promise<FacetsResponse> {
  const params = new URLSearchParams({ query, locale });
  const response = await fetch(`${VTEX_SEARCH_BASE}/facets/${facetPath}?${params}`);
  return response.json();
}
```

**Wrong**

```typescript
// BFF proxy for Intelligent Search — unnecessary overhead
// server/routes/search.ts
router.get("/api/bff/search", async (req, res) => {
  const { query, from, to, locale } = req.query;
  // This just forwards to VTEX with no added value
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/io/_v/api/intelligent-search/product_search/?query=${query}&from=${from}&to=${to}&locale=${locale}`
  );
  const data = await response.json();
  res.json(data); // Added latency for no benefit
});
```

## Preferred pattern

Data flow for Intelligent Search in a headless storefront:

```text
Frontend (Browser)
    │
    ├── GET /api/io/_v/api/intelligent-search/product_search/...
    │   └── Returns: products, pagination info, operator, fuzzy
    │
    ├── GET /api/io/_v/api/intelligent-search/facets/...
    │   └── Returns: available filters with counts
    │
    ├── GET /api/io/_v/api/intelligent-search/autocomplete_suggestions?query=...
    │   └── Returns: suggested terms + suggested products
    │
    └── POST https://sp.vtex.com/event-api/v1/{account}/event
        └── Sends: search impressions, clicks, add-to-cart events
```

Typed search API client for all endpoints:

```typescript
// lib/intelligent-search-client.ts
const ACCOUNT = "mystore";
const ENVIRONMENT = "vtexcommercestable";
const BASE_URL = `https://${ACCOUNT}.${ENVIRONMENT}.com.br/api/io/_v/api/intelligent-search`;

interface ProductSearchParams {
  query?: string;
  page: number;
  count?: number;
  locale: string;
  facets?: string;
  sort?: "price:asc" | "price:desc" | "orders:desc" | "name:asc" | "name:desc" | "release:desc" | "discount:desc";
  hideUnavailableItems?: boolean;
  operator?: string | null;
  fuzzy?: string | null;
  // Optional parameters
  simulationBehavior?: "default" | "skip" | "only1P";
}

interface ProductSearchResponse {
  products: Product[];
  recordsFiltered: number;
  // Pagination info
  pagination: {
    count: number;
    current: { index: number };
    before: Array<{ index: number }>;
    after: Array<{ index: number }>;
    perPage: number;
    next: { index: number } | null;
    previous: { index: number } | null;
    first: { index: number };
    last: { index: number };
  };
  // Search metadata to persist for next pages
  operator: string;
  fuzzy: string;
  // Spelling correction info
  correction?: {
    misspelled: boolean;
    text: string;
    correction: string;
  };
  // Search behavior
  translated: boolean;
  locale: string;
  query: string;
}

export async function productSearch(params: ProductSearchParams): Promise<ProductSearchResponse> {
  const { facets = "", operator, fuzzy, ...queryParams } = params;
  const searchParams = new URLSearchParams();

  if (queryParams.query) searchParams.set("query", queryParams.query);
  searchParams.set("page", String(queryParams.page));
  searchParams.set("locale", queryParams.locale);
  if (queryParams.count) searchParams.set("count", String(queryParams.count));
  if (queryParams.sort) searchParams.set("sort", queryParams.sort);
  if (queryParams.hideUnavailableItems) searchParams.set("hideUnavailableItems", "true");
  if (queryParams.simulationBehavior) searchParams.set("simulationBehavior", queryParams.simulationBehavior);
  
  // Only add operator/fuzzy if not null (i.e., not first page)
  if (operator !== null && operator !== undefined) searchParams.set("operator", operator);
  if (fuzzy !== null && fuzzy !== undefined) searchParams.set("fuzzy", fuzzy);

  const facetPath = facets ? `/${facets}` : "";
  const url = `${BASE_URL}/product_search${facetPath}?${searchParams}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }
  return response.json();
}
```

Response structure notes:

- **`operator` and `fuzzy`**: Must be stored from the first page and reused on subsequent pages. Also critical for analytics events.
- **`pagination`**: Contains rich pagination metadata including available pages before/after current
- **`correction.misspelled`**: Boolean indicating if the search term is misspelled. Must be sent accurately in analytics events.
- **`recordsFiltered`**: Total number of results matching the search (across all pages)
- **`products`**: Array of products for the current page only

Faceted navigation helper:

```typescript
// lib/facets.ts
export async function getFacets(
  facetPath: string,
  query: string,
  locale: string
): Promise<FacetsResponse> {
  const params = new URLSearchParams({ query, locale });
  const url = `${BASE_URL}/facets/${facetPath}?${params}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Facets fetch failed: ${response.status}`);
  }
  return response.json();
}

// Build facet path from selected filters
export function buildFacetPath(selectedFilters: Record<string, string[]>): string {
  const parts: string[] = [];
  for (const [key, values] of Object.entries(selectedFilters)) {
    for (const value of values) {
      parts.push(`${key}/${value}`);
    }
  }
  return parts.join("/");
}
```

Debounced autocomplete for search inputs:

```typescript
// lib/autocomplete.ts
export function createDebouncedAutocomplete(delayMs: number = 300) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debouncedAutocomplete(
    query: string,
    locale: string,
    callback: (suggestions: AutocompleteResponse) => void
  ): void {
    if (timeoutId) clearTimeout(timeoutId);

    if (query.length < 2) {
      callback({ searches: [] });
      return;
    }

    timeoutId = setTimeout(async () => {
      const params = new URLSearchParams({ query, locale });
      const response = await fetch(`${BASE_URL}/autocomplete_suggestions?${params}`);
      const suggestions = await response.json();
      callback(suggestions);
    }, delayMs);
  };
}
```

Full search orchestration with analytics:

```typescript
// search-page.ts — framework-agnostic search orchestration
import { productSearch } from "./lib/intelligent-search-client";
import { getFacets, buildFacetPath } from "./lib/facets";
import { createDebouncedAutocomplete } from "./lib/autocomplete";
import { sendSearchEvent } from "./search-analytics";

interface SearchState {
  query: string;
  page: number;
  count: number;
  locale: string;
  selectedFilters: Record<string, string[]>;
  operator: string | null;
  fuzzy: string | null;
  results: ProductSearchResponse | null;
  facets: FacetsResponse | null;
}

const state: SearchState = {
  query: "",
  page: 0,
  count: 24,
  locale: "en-US",
  selectedFilters: {},
  operator: null, // API decides on first page
  fuzzy: null,    // API decides on first page
  results: null,
  facets: null,
};

async function executeSearch(): Promise<void> {
  const facetPath = buildFacetPath(state.selectedFilters);

  const [searchResults, facetResults] = await Promise.all([
    productSearch({
      query: state.query,
      page: state.page,
      count: state.count,
      locale: state.locale,
      facets: facetPath,
      operator: state.operator,
      fuzzy: state.fuzzy,
    }),
    getFacets(facetPath, state.query, state.locale),
  ]);

  // Store operator/fuzzy from first page for subsequent pages
  if (state.page === 0) {
    state.operator = searchResults.operator;
    state.fuzzy = searchResults.fuzzy;
  }

  state.results = searchResults;
  state.facets = facetResults;

  // Send analytics event after results are rendered
  sendSearchEvent({
    type: "search.query",
    text: state.query,
    misspelled: searchResults.correction?.misspelled ?? false,
    match: searchResults.recordsFiltered,
    operator: searchResults.operator,
    locale: state.locale,
    agent: "my-headless-store",
    url: window.location.href,
    products: searchResults.products.map((p, i) => ({
      productId: p.productId,
      position: state.page * searchResults.products.length + i + 1,
    })),
  });
}

// Handle product click from search results — send click event
function onProductClick(productId: string, position: number): void {
  sendSearchEvent({
    type: "search.click",
    text: state.query,
    misspelled: false,
    match: state.results?.recordsFiltered ?? 0,
    operator: state.results?.operator ?? "and",
    locale: state.locale,
    agent: "my-headless-store",
    url: window.location.href,
    products: [{ productId, position }],
  });
}

// Handle page change
function goToPage(newPage: number): void {
  state.page = newPage;
  executeSearch(); // reuses operator/fuzzy from first page
}

// Handle new search (reset pagination state)
function newSearch(query: string): void {
  state.query = query;
  state.page = 0;
  state.operator = null; // reset for new search
  state.fuzzy = null;    // reset for new search
  executeSearch();
}
```

## Common failure modes

- **Not tracking `correction.misspelled` and `operator` fields for analytics**: The API returns `correction.misspelled` (boolean indicating if the term is misspelled) and `operator` fields that must be sent correctly in analytics events. These values are critical for the Intelligent Search machine learning to understand search quality and user behavior.

  ```typescript
  const response = await productSearch({ query: "red nike shoes", page: 0, locale: "en-US" });
  
  // Extract values from API response
  const isMisspelled = response.correction?.misspelled ?? false;
  const operatorUsed = response.operator; // "and" or "or"
  
  // CRITICAL: Send these exact values to analytics
  sendSearchEvent({
    type: "search.query",
    text: response.query,
    misspelled: isMisspelled,  // Must match API's correction.misspelled
    operator: operatorUsed,    // Must match API's operator value
    match: response.recordsFiltered,
    locale: state.locale,
    agent: "my-headless-store",
    url: window.location.href,
    products: response.products.map((p, i) => ({
      productId: p.productId,
      position: i + 1,
    })),
  });
  ```

- **Not sending the `locale` parameter**: Without `locale`, Intelligent Search may return results in the wrong language or fail to apply locale-specific relevance rules. Multi-language stores will display mixed-language results. Always include `locale` in every request.

  ```typescript
  // Always include locale in search parameters
  const params = new URLSearchParams({
    query: "shoes",
    locale: "en-US", // Required for correct language processing
    page: "0",
    count: "24",
  });
  ```

- **Using fixed operator/fuzzy values or forgetting to persist them**: Setting fixed values like `operator: "or"` or `fuzzy: "0"` for all requests, or not passing them at all on subsequent pages. The API dynamically determines these values on the first page — you must store and reuse them for pagination.

  ```typescript
  // Store operator/fuzzy from first page, reuse on subsequent pages
  let searchState = { operator: null, fuzzy: null };
  
  const firstPage = await productSearch({
    query: "shoes",
    page: 0,
    count: 24,
    locale: "en-US"
  });
  searchState.operator = firstPage.operator; // Store from API response
  searchState.fuzzy = firstPage.fuzzy;
  
  // Page 2 reuses these values
  const secondPage = await productSearch({
    query: "shoes",
    page: 1,
    count: 24,
    locale: "en-US",
    operator: searchState.operator, // Reuse from first page
    fuzzy: searchState.fuzzy,
  });
  ```

- **Assuming `/product_search` returns facets**: The `/product_search` endpoint returns only products and pagination info. To get available filters, you must call the separate `/facets` endpoint. Make parallel requests if you need both.

  ```typescript
  // Fetch products and facets in parallel
  const [products, filters] = await Promise.all([
    productSearch({ query: "shoes", page: 0, locale: "en-US" }),
    getFacets("", "shoes", "en-US"), // Separate call for filters
  ]);
  ```

- **Not using `hideUnavailableItems` when appropriate**: By default, the API may return out-of-stock products. For most storefronts, set `hideUnavailableItems: true` to filter them out at the API level rather than client-side.

  ```typescript
  const response = await productSearch({
    query: "shoes",
    page: 0,
    locale: "en-US",
    hideUnavailableItems: true, // Filter out-of-stock products
  });
  ```

- **Rebuilding search ranking logic client-side**: Fetching results and then re-sorting or re-filtering them in the frontend discards Intelligent Search's ranking intelligence. Client-side filtering only works on the current page, not the full catalog. Use the API's `sort` parameter and facet paths.

  ```typescript
  // Use API-level sorting — don't re-sort in the frontend
  const results = await productSearch({
    query: "shirt",
    sort: "price:asc", // API handles sorting across entire result set
    locale: "en-US",
    from: 0,
    to: 23,
    facets: "category-1/clothing/color/red", // API handles filtering across entire catalog
  });
  ```

## Review checklist

- [ ] Is Intelligent Search called directly from the frontend (not unnecessarily routed through BFF)?
- [ ] Does every search request include `page` and `locale` parameters?
- [ ] Are `operator` and `fuzzy` values stored from the first page and reused on subsequent pages?
- [ ] Are `correction.misspelled` and `operator` from the API response sent correctly in analytics events?
- [ ] Are analytics events sent to `sp.vtex.com/event-api` after search results render?
- [ ] Are click events sent when a user selects a product from search results?
- [ ] Is sorting done via the API's `sort` parameter rather than client-side re-sorting?
- [ ] Is filtering done via facet paths rather than client-side filtering?
- [ ] Is autocomplete debounced to avoid excessive API calls?
- [ ] Are filters fetched from the `/facets` endpoint (not assumed to come from `/product_search`)?
- [ ] Is `hideUnavailableItems` set to `true` for storefronts that should hide out-of-stock products?

## Reference

- [Headless catalog and search](https://developers.vtex.com/docs/guides/headless-catalog) — Overview of catalog browsing and search in headless stores
- [Intelligent Search API reference](https://developers.vtex.com/docs/api-reference/intelligent-search-api) — Complete API reference for all search endpoints
- [Intelligent Search Events API - Headless](https://developers.vtex.com/docs/api-reference/intelligent-search-events-api-headless) — Events API for sending analytics from headless implementations
- [Intelligent Search overview](https://help.vtex.com/en/docs/tutorials/intelligent-search-overview) — General overview of Intelligent Search capabilities
- [Search configuration](https://help.vtex.com/en/docs/tutorials/search-configuration) — How to configure searchable specifications, facet ordering, and other search settings
- [Autocomplete](https://help.vtex.com/en/docs/tutorials/autocomplete) — How autocomplete suggestions work in Intelligent Search

---

# Marketplace Integration

# Catalog & SKU Integration

## When this skill applies

Use this skill when building a seller connector that needs to push product catalog data into a VTEX marketplace, handle SKU approval workflows, or keep prices and inventory synchronized.

- Building the Change Notification flow to register and update SKUs
- Implementing the SKU suggestion lifecycle (send → pending → approved/denied)
- Mapping product data to the VTEX catalog schema
- Synchronizing prices and inventory via notification endpoints

Do not use this skill for:
- Marketplace-side catalog operations (direct Catalog API writes)
- Order fulfillment or invoice handling (see `marketplace-fulfillment`)
- Rate limiting patterns in isolation (see `marketplace-rate-limiting`)

## Decision rules

VTEX exposes two `POST` routes under `api/catalog_system/pvt/skuseller/changenotification`. They are **not** interchangeable — the path shape tells the platform which identifier you are sending.

| Route | Path pattern | Meaning |
| ----- | ------------ | ------- |
| Change notification **with marketplace SKU ID** | `.../changenotification/{skuId}` | `{skuId}` is the **SKU ID in the marketplace catalog** (VTEX). There is **no** `sellerId` in the URL. |
| Change notification **with seller ID and seller SKU ID** | `.../changenotification/{sellerId}/{skuId}` | `{sellerId}` is the seller account on the marketplace; `{skuId}` is the **seller's own SKU code** (the same ID used in `PUT` SKU Suggestion paths). |

**Seller connector integrations** MUST use the **second** route. Official docs sometimes mix descriptions between these two — trust the **URL shape**: the seller-scoped flow always uses **two** path segments after `changenotification/`.

SKU suggestions (`PUT`/`GET`) must go to `https://api.vtex.com/{accountName}/suggestions/{sellerId}/{sellerSkuId}`, not the store hostname. The same App Key and App Token apply. Do not build suggestion URLs using `{account}.vtexcommercestable.com.br/api/catalog_system/pvt/sku/seller/...` — that is a different Catalog System surface.

- For **seller-side** catalog integration, use `POST /api/catalog_system/pvt/skuseller/changenotification/{sellerId}/{sellerSkuId}` (seller Id in the marketplace account + **seller’s SKU ID**). A **200 OK** means the SKU already exists in the marketplace for that seller (update path); a **404 Not Found** means it does not (send a SKU suggestion). Do **not** use `POST .../changenotification/{skuId}` with the seller’s SKU code — that single-segment route expects the **marketplace** SKU ID.
- Use `POST .../changenotification/{skuId}` only when the identifier you have is the **VTEX marketplace** SKU ID (no seller segment in the path).
- Use **`PUT`** on [`/suggestions/{sellerId}/{sellerSkuId}`](https://developers.vtex.com/docs/api-reference/marketplace-apis-suggestions#put-/suggestions/-sellerId-/-sellerSkuId-) under **`https://api.vtex.com/{accountName}`** (Send SKU Suggestion) to register or update pending suggestions. The seller does not own the catalog — every new SKU must go through the suggestion/approval workflow.
- Use separate notification endpoints for price and inventory: `POST /notificator/{sellerId}/changenotification/{sellerSkuId}/price` and `POST /notificator/{sellerId}/changenotification/{sellerSkuId}/inventory`. The path segment after `changenotification/` is the **seller SKU ID** (the seller’s own SKU code — the same identifier used in suggestions and seller-scoped catalog flows), not the marketplace VTEX SKU ID. Reference docs may label this segment `skuId`; read it as **sellerSkuId** in seller-connector integrations.
- After price/inventory notifications, the marketplace calls the seller's **Fulfillment Simulation** endpoint (`POST /pvt/orderForms/simulation`). This endpoint must respond within **2.5 seconds** or the product is considered unavailable.
- Suggestions can only be updated while in "pending" state. Once approved or denied, the seller cannot modify them.

**Architecture/Data Flow**:

```text
Seller                          VTEX Marketplace
  │                                    │
  │─── POST changenotification ──────▶│
  │◀── 200 (exists) or 404 (new) ────│
  │                                    │
  │─── PUT Send SKU Suggestion ──────▶│  (if 404)
  │                                    │── Pending in Received SKUs
  │                                    │── Marketplace approves/denies
  │                                    │
  │─── POST price notification ──────▶│
  │◀── POST fulfillment simulation ───│  (marketplace fetches data)
  │─── Response with price/stock ────▶│
```

## Hard constraints

### Constraint: Use SKU Integration API, Not Direct Catalog API

External sellers MUST use the Change Notification + SKU Suggestion flow to integrate SKUs. Direct Catalog API writes (`POST /api/catalog/pvt/product` or `POST /api/catalog/pvt/stockkeepingunit`) are for marketplace-side operations only.

**Why this matters**

The seller does not own the catalog. Direct catalog writes will fail with 403 Forbidden or create orphaned entries that bypass the approval workflow. The suggestion mechanism ensures marketplace quality control.

**Detection**

If you see direct Catalog API calls for product/SKU creation (e.g., `POST /api/catalog/pvt/product`, `POST /api/catalog/pvt/stockkeepingunit`) from a seller integration → warn that the SKU Integration API should be used instead.

**Correct**

```typescript
import axios, { AxiosInstance } from "axios";

interface SkuSuggestion {
  ProductName: string;
  SkuName: string;
  ImageUrl: string;
  ProductDescription: string;
  BrandName: string;
  CategoryFullPath: string;
  EAN: string;
  Height: number;
  Width: number;
  Length: number;
  WeightKg: number;
  SkuSpecifications: Array<{
    FieldName: string;
    FieldValues: string[];
  }>;
}

async function integrateSellerSku(
  client: AxiosInstance,
  marketplaceAccount: string,
  sellerId: string,
  sellerSkuId: string,
  skuData: SkuSuggestion
): Promise<void> {
  const storeBaseUrl = `https://${marketplaceAccount}.vtexcommercestable.com.br`;
  const suggestionUrl = `https://api.vtex.com/${marketplaceAccount}/suggestions/${sellerId}/${sellerSkuId}`;

  // Step 1: Seller-scoped change notification (Catalog API — store host)
  try {
    await client.post(
      `${storeBaseUrl}/api/catalog_system/pvt/skuseller/changenotification/${sellerId}/${sellerSkuId}`
    );
    // 200 OK — SKU exists, marketplace will fetch updates via fulfillment simulation
    console.log(`SKU ${sellerSkuId} exists in marketplace, update triggered`);
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      // 404 — SKU not found, send suggestion
      console.log(`SKU ${sellerSkuId} not found, sending suggestion`);
      await client.put(suggestionUrl, skuData);
      console.log(`SKU suggestion sent for ${sellerSkuId}`);
    } else {
      throw error;
    }
  }
}
```

**Wrong**

```typescript
// WRONG: Marketplace-SKU-only path with the seller's SKU code (misroutes the notification).
// .../changenotification/{skuId} expects the VTEX marketplace SKU ID, not sellerSkuId.
await client.post(
  `https://${marketplaceAccount}.vtexcommercestable.com.br/api/catalog_system/pvt/skuseller/changenotification/${sellerSkuId}`
);

// WRONG: SKU Suggestion on the store host + Catalog path — public contract is api.vtex.com + /suggestions/...
await client.put(
  `https://${marketplaceAccount}.vtexcommercestable.com.br/api/catalog_system/pvt/sku/seller/${sellerId}/suggestion/${sellerSkuId}`,
  skuData
);

// WRONG: Seller writing directly to marketplace catalog — bypasses suggestion/approval; expect 403
async function createSkuDirectly(
  client: AxiosInstance,
  marketplaceAccount: string,
  productData: Record<string, unknown>
): Promise<void> {
  // Direct catalog write — sellers don't have permission for this
  await client.post(
    `https://${marketplaceAccount}.vtexcommercestable.com.br/api/catalog/pvt/product`,
    productData
  );
  // Will fail: 403 Forbidden — seller lacks catalog write permissions
  // Will fail: 403 Forbidden — seller lacks catalog write permissions
}
```

---

### Constraint: Handle Rate Limiting on Catalog Notifications

All catalog notification calls MUST implement 429 handling with exponential backoff. Batch notifications MUST be throttled to respect VTEX API rate limits.

**Why this matters**

The Change Notification endpoint is rate-limited. Sending bulk notifications without throttling will trigger 429 responses and temporarily block the seller's API access, stalling the entire integration.

**Detection**

If you see catalog notification calls without 429 handling or retry logic → STOP and add rate limiting. If you see a tight loop sending notifications without delays → warn about rate limiting.

**Correct**

```typescript
async function batchNotifySkus(
  client: AxiosInstance,
  baseUrl: string,
  sellerId: string,
  sellerSkuIds: string[],
  concurrency: number = 5,
  delayMs: number = 200
): Promise<void> {
  const results: Array<{ sellerSkuId: string; status: "exists" | "new" | "error" }> = [];

  for (let i = 0; i < sellerSkuIds.length; i += concurrency) {
    const batch = sellerSkuIds.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map(async (sellerSkuId) => {
        try {
          await client.post(
            `${baseUrl}/api/catalog_system/pvt/skuseller/changenotification/${sellerId}/${sellerSkuId}`
          );
          return { sellerSkuId, status: "exists" as const };
        } catch (error: unknown) {
          if (
            error instanceof Error &&
            "response" in error &&
            (error as { response?: { status?: number } }).response?.status === 404
          ) {
            return { sellerSkuId, status: "new" as const };
          }
          if (
            error instanceof Error &&
            "response" in error &&
            (error as { response?: { status?: number; headers?: Record<string, string> } })
              .response?.status === 429
          ) {
            const retryAfter = parseInt(
              (error as { response: { headers: Record<string, string> } }).response.headers[
                "retry-after"
              ] || "60",
              10
            );
            console.warn(`Rate limited. Waiting ${retryAfter}s before retry.`);
            await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
            return { sellerSkuId, status: "error" as const };
          }
          throw error;
        }
      })
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }

    // Throttle between batches
    if (i + concurrency < sellerSkuIds.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
```

**Wrong**

```typescript
// WRONG: No rate limiting, no error handling, tight loop
async function notifyAllSkus(
  client: AxiosInstance,
  baseUrl: string,
  sellerId: string,
  sellerSkuIds: string[]
): Promise<void> {
  // Fires all requests simultaneously — will trigger 429 rate limits
  await Promise.all(
    sellerSkuIds.map((sellerSkuId) =>
      client.post(
        `${baseUrl}/api/catalog_system/pvt/skuseller/changenotification/${sellerId}/${sellerSkuId}`
      )
    )
  );
}
```

---

### Constraint: Handle Suggestion Lifecycle States

Sellers MUST check the suggestion state before attempting updates. Suggestions can only be updated while in pending state.

**Why this matters**

Attempting to update an already-approved or denied suggestion will fail silently or create duplicate entries. An approved suggestion becomes an SKU owned by the marketplace.

**Detection**

If you see SKU suggestion updates without checking current suggestion status → warn about suggestion lifecycle handling.

**Correct**

```typescript
async function updateSkuSuggestion(
  client: AxiosInstance,
  marketplaceAccount: string,
  sellerId: string,
  sellerSkuId: string,
  updatedData: Record<string, unknown>
): Promise<boolean> {
  const suggestionUrl = `https://api.vtex.com/${marketplaceAccount}/suggestions/${sellerId}/${sellerSkuId}`;

  // Check current suggestion status before updating
  try {
    const response = await client.get(suggestionUrl);

    const suggestion = response.data;
    if (suggestion.Status === "Pending") {
      // Safe to update — suggestion hasn't been processed yet
      await client.put(suggestionUrl, updatedData);
      return true;
    }

    // Already approved or denied — cannot update
    console.warn(
      `SKU ${sellerSkuId} suggestion is ${suggestion.Status}, cannot update. ` +
        `Use changenotification to update existing SKUs.`
    );
    return false;
  } catch {
    // Suggestion may not exist — send as new
    await client.put(suggestionUrl, updatedData);
    return true;
  }
}
```

**Wrong**

```typescript
// WRONG: Blindly sending suggestion update without checking state
async function blindUpdateSuggestion(
  client: AxiosInstance,
  marketplaceAccount: string,
  sellerId: string,
  sellerSkuId: string,
  data: Record<string, unknown>
): Promise<void> {
  // If the suggestion was already approved, this fails silently
  // or creates a duplicate that confuses the marketplace operator
  await client.put(
    `https://api.vtex.com/${marketplaceAccount}/suggestions/${sellerId}/${sellerSkuId}`,
    data
  );
}
```

## Preferred pattern

### Set Up the Seller Connector Client

Create an authenticated HTTP client for communicating with the VTEX marketplace.

```typescript
import axios, { AxiosInstance } from "axios";

interface SellerConnectorConfig {
  marketplaceAccount: string;
  sellerId: string;
  appKey: string;
  appToken: string;
}

function createMarketplaceClient(config: SellerConnectorConfig): AxiosInstance {
  return axios.create({
    // Catalog System routes (e.g. changenotification) use the store host.
    baseURL: `https://${config.marketplaceAccount}.vtexcommercestable.com.br`,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-VTEX-API-AppKey": config.appKey,
      "X-VTEX-API-AppToken": config.appToken,
    },
    timeout: 10000,
  });
}

// Use the same headers for PUT/GET on https://api.vtex.com/{account}/suggestions/...
// (pass a full URL on the same axios instance, or set baseURL to https://api.vtex.com/{account} for suggestion-only calls).
```

### Implement the Change Notification Flow

Handle both the "exists" (200) and "new" (404) scenarios from the changenotification endpoint.

```typescript
interface CatalogNotificationResult {
  skuId: string;
  action: "updated" | "suggestion_sent" | "error";
  error?: string;
}

async function notifyAndSync(
  client: AxiosInstance,
  marketplaceAccount: string,
  sellerId: string,
  sellerSkuId: string,
  skuData: SkuSuggestion
): Promise<CatalogNotificationResult> {
  const suggestionUrl = `https://api.vtex.com/${marketplaceAccount}/suggestions/${sellerId}/${sellerSkuId}`;

  try {
    await client.post(
      `/api/catalog_system/pvt/skuseller/changenotification/${sellerId}/${sellerSkuId}`
    );
    // SKU exists — marketplace will call fulfillment simulation to get updates
    return { skuId: sellerSkuId, action: "updated" };
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      try {
        await client.put(suggestionUrl, skuData);
        return { skuId: sellerSkuId, action: "suggestion_sent" };
      } catch (suggestionError: unknown) {
        const message = suggestionError instanceof Error ? suggestionError.message : "Unknown error";
        return { skuId: sellerSkuId, action: "error", error: message };
      }
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return { skuId: sellerSkuId, action: "error", error: message };
  }
}
```

### Implement the Fulfillment Simulation Endpoint

The marketplace calls this endpoint on the seller's side to retrieve current price and inventory data after a notification.

```typescript
import { RequestHandler } from "express";

interface SimulationItem {
  id: string;
  quantity: number;
  seller: string;
}

interface SimulationRequest {
  items: SimulationItem[];
  postalCode?: string;
  country?: string;
}

interface SimulationResponseItem {
  id: string;
  requestIndex: number;
  quantity: number;
  seller: string;
  price: number;
  listPrice: number;
  sellingPrice: number;
  priceValidUntil: string;
  availability: string;
  merchantName: string;
}

const fulfillmentSimulationHandler: RequestHandler = async (req, res) => {
  const { items, postalCode, country }: SimulationRequest = req.body;

  const responseItems: SimulationResponseItem[] = await Promise.all(
    items.map(async (item, index) => {
      // Fetch current price and inventory from your system
      const skuInfo = await getSkuFromLocalCatalog(item.id);

      return {
        id: item.id,
        requestIndex: index,
        quantity: Math.min(item.quantity, skuInfo.availableQuantity),
        seller: item.seller,
        price: skuInfo.price,
        listPrice: skuInfo.listPrice,
        sellingPrice: skuInfo.sellingPrice,
        priceValidUntil: new Date(Date.now() + 3600000).toISOString(),
        availability: skuInfo.availableQuantity > 0 ? "available" : "unavailable",
        merchantName: "sellerAccountName",
      };
    })
  );

  // CRITICAL: Must respond within 2.5 seconds or products show as unavailable
  res.json({
    items: responseItems,
    postalCode: postalCode ?? "",
    country: country ?? "",
  });
};

async function getSkuFromLocalCatalog(skuId: string): Promise<{
  price: number;
  listPrice: number;
  sellingPrice: number;
  availableQuantity: number;
}> {
  // Replace with your actual catalog/inventory lookup
  return {
    price: 9990,
    listPrice: 12990,
    sellingPrice: 9990,
    availableQuantity: 15,
  };
}
```

### Notify Price and Inventory Changes

Send separate notifications for price and inventory updates. The `{sellerSkuId}` segment in the URL is the **seller’s SKU identifier** (same code you use in your catalog and in `changenotification/{sellerId}/{sellerSkuId}` / suggestions). Do not pass the marketplace’s internal VTEX SKU ID here unless your integration is explicitly keyed that way.

```typescript
async function notifyPriceChange(
  client: AxiosInstance,
  sellerId: string,
  sellerSkuId: string
): Promise<void> {
  await client.post(
    `/notificator/${sellerId}/changenotification/${sellerSkuId}/price`
  );
}

async function notifyInventoryChange(
  client: AxiosInstance,
  sellerId: string,
  sellerSkuId: string
): Promise<void> {
  await client.post(
    `/notificator/${sellerId}/changenotification/${sellerSkuId}/inventory`
  );
}

async function syncPriceAndInventory(
  client: AxiosInstance,
  sellerId: string,
  sellerSkuIds: string[]
): Promise<void> {
  for (const sellerSkuId of sellerSkuIds) {
    await notifyPriceChange(client, sellerId, sellerSkuId);
    await notifyInventoryChange(client, sellerId, sellerSkuId);

    // Throttle to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
```

### Complete Example

```typescript
import axios from "axios";

async function runCatalogSync(): Promise<void> {
  const config: SellerConnectorConfig = {
    marketplaceAccount: "mymarketplace",
    sellerId: "externalseller01",
    appKey: process.env.VTEX_APP_KEY!,
    appToken: process.env.VTEX_APP_TOKEN!,
  };

  const client = createMarketplaceClient(config);

  // Fetch SKUs that need syncing from your system
  const skusToSync = await getLocalSkusNeedingSync();

  for (const sku of skusToSync) {
    const skuSuggestion: SkuSuggestion = {
      ProductName: sku.productName,
      SkuName: sku.skuName,
      ImageUrl: sku.imageUrl,
      ProductDescription: sku.description,
      BrandName: sku.brand,
      CategoryFullPath: sku.categoryPath,
      EAN: sku.ean,
      Height: sku.height,
      Width: sku.width,
      Length: sku.length,
      WeightKg: sku.weight,
      SkuSpecifications: sku.specifications,
    };

    const result = await notifyAndSync(
      client,
      config.marketplaceAccount,
      config.sellerId,
      sku.sellerSkuId,
      skuSuggestion
    );

    console.log(`SKU ${sku.sellerSkuId}: ${result.action}`);

    // Throttle between SKU operations
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Sync prices and inventory for all active SKUs (seller SKU IDs)
  const activeSellerSkuIds = skusToSync.map((s) => s.sellerSkuId);
  await syncPriceAndInventory(client, config.sellerId, activeSellerSkuIds);
}

async function getLocalSkusNeedingSync(): Promise<
  Array<{
    sellerSkuId: string;
    productName: string;
    skuName: string;
    imageUrl: string;
    description: string;
    brand: string;
    categoryPath: string;
    ean: string;
    height: number;
    width: number;
    length: number;
    weight: number;
    specifications: Array<{ FieldName: string; FieldValues: string[] }>;
  }>
> {
  // Replace with your actual data source
  return [];
}
```

## Common failure modes

- **Calling the single-segment change notification with the seller’s SKU ID.** `POST .../changenotification/{skuId}` resolves the **marketplace** SKU ID. Passing the seller’s catalog code there will not match the intended SKU and breaks the integration flow. Seller connectors must use `POST .../changenotification/{sellerId}/{sellerSkuId}`. If public API reference text describes `sellerId` in the body but shows a one-segment URL, treat that as a documentation mismatch and follow the path shape above.

- **Polling for suggestion status in tight loops.** Suggestion approval is a manual or semi-automatic marketplace process that can take minutes to days. Tight polling wastes API quota and may trigger rate limits that block the entire integration. Use a scheduled job (cron) to check suggestion statuses periodically (e.g., every 15-30 minutes), or implement a webhook-based notification system.

- **Ignoring the fulfillment simulation timeout.** The seller's fulfillment simulation endpoint performs complex database queries or external API calls that exceed the response time limit. VTEX marketplaces wait a maximum of **2.5 seconds** for a fulfillment simulation response. After that, the product is considered unavailable/inactive and won't appear in the storefront or checkout. Pre-cache price and inventory data using in-memory or Redis cache with event-driven updates so the simulation endpoint responds instantly.

```typescript
import { RequestHandler } from "express";

// Correct: Cache-first approach for fast fulfillment simulation
const cachedPriceInventory = new Map<string, {
  price: number;
  listPrice: number;
  sellingPrice: number;
  availableQuantity: number;
  updatedAt: number;
}>();

const fastFulfillmentSimulation: RequestHandler = async (req, res) => {
  const { items } = req.body;

  const responseItems = items.map((item: SimulationItem, index: number) => {
    const cached = cachedPriceInventory.get(item.id);

    if (!cached) {
      return {
        id: item.id,
        requestIndex: index,
        quantity: 0,
        availability: "unavailable",
      };
    }

    return {
      id: item.id,
      requestIndex: index,
      quantity: Math.min(item.quantity, cached.availableQuantity),
      price: cached.price,
      listPrice: cached.listPrice,
      sellingPrice: cached.sellingPrice,
      availability: cached.availableQuantity > 0 ? "available" : "unavailable",
    };
  });

  // Responds in < 50ms from cache
  res.json({ items: responseItems });
};
```

## Review checklist

- [ ] Is the Change Notification + SKU Suggestion flow used (not direct Catalog API writes)?
- [ ] Does catalog change notification use `.../changenotification/{sellerId}/{sellerSkuId}` (not the single-segment marketplace-SKU route with a seller SKU code)?
- [ ] Does the integration handle both 200 (exists) and 404 (new) responses from changenotification?
- [ ] Are SKU suggestion updates guarded by a status check (only update while "Pending")?
- [ ] Are `PUT`/`GET` suggestion calls sent to `https://api.vtex.com/{account}/suggestions/{sellerId}/{sellerSkuId}`, not to the store hostname?
- [ ] Are batch catalog notifications throttled with 429 handling and exponential backoff?
- [ ] Does the fulfillment simulation endpoint respond within **2.5 seconds**?
- [ ] Are price and inventory notifications sent via the correct `/notificator/{sellerId}/changenotification/{sellerSkuId}/price|inventory` paths (seller SKU ID in the path)?
- [ ] Are placeholder values (account names, seller IDs, API keys) replaced with real values?

## Reference

- [External Seller Connector Guide](https://developers.vtex.com/docs/guides/external-seller-integration-connector) — Complete integration flow for external sellers connecting to VTEX marketplaces
- [Change notification (marketplace SKU ID)](https://developers.vtex.com/docs/api-reference/catalog-api#post-/api/catalog_system/pvt/skuseller/changenotification/-skuId-) — `POST .../changenotification/{skuId}`; path uses **marketplace** SKU ID only
- [Change notification (seller ID and seller SKU ID)](https://developers.vtex.com/docs/api-reference/catalog-api#post-/api/catalog_system/pvt/skuseller/changenotification/-sellerId-/-skuId-) — `POST .../changenotification/{sellerId}/{skuId}`; **use this for seller connector catalog integration**
- [Send SKU Suggestion (`PUT /suggestions/{sellerId}/{sellerSkuId}`)](https://developers.vtex.com/docs/api-reference/marketplace-apis-suggestions#put-/suggestions/-sellerId-/-sellerSkuId-) — base URL `https://api.vtex.com/{accountName}`
- [Marketplace API — Suggestions](https://developers.vtex.com/docs/api-reference/marketplace-apis-suggestions) — full Suggestions API reference
- [Marketplace API - Manage Suggestions (guide)](https://developers.vtex.com/docs/guides/marketplace-api#manage-suggestions) — narrative guide for SKU suggestions workflow
- [Catalog Management for VTEX Marketplace](https://developers.vtex.com/docs/guides/external-seller-integration-vtex-marketplace-operation) — Marketplace-side catalog operations and SKU approval workflows

---

# Fulfillment, simulation, orders & OMS follow-up

## When this skill applies

Use this skill when building an **External Seller** integration: VTEX forwards availability, shipping, checkout simulation, and order placement to **your** fulfillment base URL, and you call the marketplace **OMS** APIs for invoice and tracking after dispatch.

- Implementing **`POST /pvt/orderForms/simulation`** (indexation and/or checkout — with or without customer context)
- Implementing **`POST /pvt/orders`** (order placement — create **reservation**; return **`orderId`** = reservation id in your system)
- Handling **`POST /pvt/orders/{sellerOrderId}/fulfill`** (order dispatch after approval — path uses the **same** id you returned as `orderId` at placement)
- Sending invoice notifications via `POST /api/oms/pvt/orders/{marketplaceOrderId}/invoice` (marketplace order id in the path)
- Updating tracking via `PATCH /api/oms/pvt/orders/{marketplaceOrderId}/invoice/{invoiceNumber}`
- Implementing partial invoicing for split shipments

Do not use this skill for:
- Catalog or SKU synchronization (see `marketplace-catalog-sync`)
- Order event consumption via Feed/Hook (see `marketplace-order-hook`)
- General API rate limiting (see `marketplace-rate-limiting`)

## Decision rules

### External Seller protocol (implemented on the seller host)

- **Fulfillment simulation** — `POST /pvt/orderForms/simulation`. VTEX calls it during **product indexation** and during **checkout**. Requests may include **only** `items` (and optionally query params), or the **full** checkout context: `items`, `postalCode`, `country`, `clientProfileData`, `shippingData`, `selectedSla`, etc. Without postal code / profile (typical indexation), the response must still state whether each item is **available**. With full context, return **`items`**, **`logisticsInfo`** (one entry per requested item), **`postalCode`**, **`country`**, and set **`allowMultipleDeliveries`** to `true` as required by the contract. **`items[].id`** is the **seller SKU id**; **`items[].seller`** is the **seller id** on the marketplace account.
- **Response shape** — Each `logisticsInfo[]` row aligns with a requested item (`itemIndex`). Include **`slas[]`** with all delivery options (home delivery and **pickup-in-point** when applicable), **`deliveryChannels[]`** with per-channel stock, **`shipsTo`**, and **`stockBalance`**. SLA fields include `price` (shipping per item, in cents), `shippingEstimate` / `shippingEstimateDate` (e.g. `5bd`, `30m`). Pickup SLAs must include **`pickupStoreInfo`** (address, `friendlyName`, etc.).
- **SLA** — The simulation handler must respond within **2.5 seconds** or the offer is treated as unavailable.
- **Order placement** — `POST /pvt/orders` with a **JSON array** of orders. For each order, create a **reservation** in your system. The **response** must be the same structure with an added **`orderId`** on each order: that value is your **reservation id** and becomes the **`sellerOrderId`** in later protocol calls (e.g. authorize fulfillment path parameter).
- **Order dispatch (authorize fulfillment)** — After marketplace approval, VTEX calls `POST /pvt/orders/{sellerOrderId}/fulfill` where **`sellerOrderId`** equals the **`orderId`** you returned at placement. Body includes **`marketplaceOrderId`** and **`marketplaceOrderGroup`**. Convert the reservation to a firm order in your system; response body includes `date`, `marketplaceOrderId`, **`orderId`** (seller reference), `receipt`.

### OMS APIs (seller → marketplace)

- Send invoices via `POST /api/oms/pvt/orders/{marketplaceOrderId}/invoice`. Required fields: `type`, `invoiceNumber`, `invoiceValue` (in cents), `issuanceDate`, and `items` array. Path **`marketplaceOrderId`** is the VTEX marketplace order id, not your reservation id.
- Use `type: "Output"` for sales invoices (shipment) and `type: "Input"` for return invoices.
- Send tracking **separately** after the carrier provides it, using `PATCH /api/oms/pvt/orders/{marketplaceOrderId}/invoice/{invoiceNumber}`.
- For split shipments, send **one invoice per package** with only the items in that package. Each `invoiceValue` must reflect only its items.
- Once an order is invoiced, it cannot be canceled without first sending a return invoice (`type: "Input"`).
- The fulfillment simulation endpoint must respond within **2.5 seconds** or the product is considered unavailable.

**Architecture / data flow (high level)**:

```text
VTEX Checkout / indexation          External Seller                    VTEX OMS (marketplace)
       │                                   │                                   │
       │── POST /pvt/orderForms/simulation ▶│  Price, stock, SLAs               │
       │◀── 200 + items + logisticsInfo ───│                                   │
       │                                   │                                   │
       │── POST /pvt/orders (array) ───────▶│  Create reservation               │
       │◀── same + orderId (reservation) ─│                                   │
       │                                   │                                   │
       │── POST /pvt/orders/{id}/fulfill ──▶│  Commit / pick pack               │
       │◀── date, marketplaceOrderId, ... ─│                                   │
       │                                   │── POST .../invoice ────────────────▶│
       │                                   │── PATCH .../invoice/{n} ─────────▶│
```

## Hard constraints

### Constraint: Marketplace order ID in OMS paths

Any `{orderId}` in **`/api/oms/pvt/orders/{orderId}/...`** MUST be the **VTEX marketplace order id** (OMS), not the **`orderId`** you returned at **`POST /pvt/orders`** (reservation id). Map `marketplaceOrderId` from the protocol (placement payload, fulfill body, or events) before calling invoice or tracking APIs.

**Why this matters**

Using the reservation id in OMS URLs fails to match the marketplace order; invoices and tracking never attach to the customer order.

**Detection**

If the same variable is used for both `POST /pvt/orders` response `orderId` and `POST .../oms/.../invoice` without mapping → STOP.

**Correct**

```typescript
// reservationId from your POST /pvt/orders response; marketplaceOrderId from VTEX payload
await omsClient.post(`/api/oms/pvt/orders/${marketplaceOrderId}/invoice`, payload);
```

**Wrong**

```typescript
await omsClient.post(`/api/oms/pvt/orders/${reservationId}/invoice`, payload);
```

---

### Constraint: Fulfillment simulation contract and latency

The seller MUST implement **`POST /pvt/orderForms/simulation`** to return a valid **`items`** array for every request. When the request includes checkout context (e.g. `postalCode`, `clientProfileData`, `shippingData`), the response MUST include aligned **`logisticsInfo`**, **`slas`** for all relevant modes (including pickup when offered), and **`allowMultipleDeliveries`: true** where required. The handler MUST complete within **2.5 seconds**.

**Why this matters**

Incomplete `logisticsInfo` or missing SLAs break checkout shipping selection. Slow responses mark offers unavailable and hurt conversion.

**Detection**

If simulation returns only `items` with prices but omits `logisticsInfo` when the request had `shippingData` → warn. If p95 latency approaches 2s without caching → warn.

**Correct**

```typescript
// Pseudocode: branch on whether checkout context is present
if (hasCheckoutContext(req.body)) {
  return res.json({
    country: req.body.country,
    items: pricedItems,
    logisticsInfo: buildLogisticsPerItem(pricedItems, req.body),
    postalCode: req.body.postalCode,
    allowMultipleDeliveries: true,
  });
}
return res.json({ items: availabilityOnlyItems /* + minimal logistics if required */ });
```

**Wrong**

```typescript
// WRONG: Full checkout body but response omits logisticsInfo / SLAs
res.json({ items: pricedItemsOnly });
```

---

### Constraint: Order placement must return seller `orderId` (reservation)

**`POST /pvt/orders`** accepts a **JSON array** of orders. The response MUST be the same orders with **`orderId`** set on each element to your **reservation identifier** (seller system). VTEX uses that value as **`sellerOrderId`** in **`POST /pvt/orders/{sellerOrderId}/fulfill`**.

**Why this matters**

Omitting or reusing a fake `orderId` breaks the link between marketplace order flow and your reservation and prevents dispatch from routing correctly.

**Detection**

If the handler returns 200 without adding `orderId`, or returns a single object instead of an array → warn.

**Correct**

```typescript
app.post("/pvt/orders", (req, res) => {
  const orders = req.body as Array<Record<string, unknown>>;
  const out = orders.map((order) => {
    const reservationId = createReservation(order);
    return { ...order, orderId: reservationId, followUpEmail: "" };
  });
  res.json(out);
});
```

**Wrong**

```typescript
app.post("/pvt/orders", (req, res) => {
  createReservation(req.body);
  res.status(200).send(); // WRONG: missing orderId echo
});
```

---

### Constraint: Send Correct Invoice Format with All Required Fields

The invoice notification MUST include `type`, `invoiceNumber`, `invoiceValue`, `issuanceDate`, and `items` array. The `invoiceValue` MUST be in cents. The `items` array MUST match the items in the order.

**Why this matters**

Missing required fields cause the API to reject the invoice with 400 Bad Request, leaving the order stuck in "handling" status. Incorrect `invoiceValue` (e.g., using dollars instead of cents) causes financial discrepancies in marketplace reconciliation.

**Detection**

If you see an invoice notification payload missing `invoiceNumber`, `invoiceValue`, `issuanceDate`, or `items` → warn about missing required fields. If `invoiceValue` appears to be in dollars (e.g., `99.90` instead of `9990`) → warn about cents conversion.

**Correct**

```typescript
import axios, { AxiosInstance } from "axios";

interface InvoiceItem {
  id: string;
  quantity: number;
  price: number; // in cents
}

interface InvoicePayload {
  type: "Output" | "Input";
  invoiceNumber: string;
  invoiceValue: number; // total in cents
  issuanceDate: string; // ISO 8601
  invoiceUrl?: string;
  invoiceKey?: string;
  courier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  items: InvoiceItem[];
}

async function sendInvoiceNotification(
  client: AxiosInstance,
  marketplaceOrderId: string,
  invoice: InvoicePayload
): Promise<void> {
  // Validate required fields before sending
  if (!invoice.invoiceNumber) {
    throw new Error("invoiceNumber is required");
  }
  if (!invoice.invoiceValue || invoice.invoiceValue <= 0) {
    throw new Error("invoiceValue must be a positive number in cents");
  }
  if (!invoice.issuanceDate) {
    throw new Error("issuanceDate is required");
  }
  if (!invoice.items || invoice.items.length === 0) {
    throw new Error("items array is required and must not be empty");
  }

  // Warn if invoiceValue looks like it's in dollars instead of cents
  if (invoice.invoiceValue < 100 && invoice.items.length > 0) {
    console.warn(
      `Warning: invoiceValue ${invoice.invoiceValue} seems very low. ` +
        `Ensure it's in cents (e.g., 9990 for $99.90).`
    );
  }

  await client.post(`/api/oms/pvt/orders/${marketplaceOrderId}/invoice`, invoice);
}

// Example usage:
async function invoiceOrder(
  client: AxiosInstance,
  marketplaceOrderId: string
): Promise<void> {
  await sendInvoiceNotification(client, marketplaceOrderId, {
    type: "Output",
    invoiceNumber: "NFE-2026-001234",
    invoiceValue: 15990, // $159.90 in cents
    issuanceDate: new Date().toISOString(),
    invoiceUrl: "https://invoices.example.com/NFE-2026-001234.pdf",
    invoiceKey: "35260614388220000199550010000012341000012348",
    items: [
      { id: "123", quantity: 1, price: 9990 },
      { id: "456", quantity: 2, price: 3000 },
    ],
  });
}
```

**Wrong**

```typescript
// WRONG: Missing required fields, value in dollars instead of cents
async function sendBrokenInvoice(
  client: AxiosInstance,
  marketplaceOrderId: string
): Promise<void> {
  await client.post(`/api/oms/pvt/orders/${marketplaceOrderId}/invoice`, {
    // Missing 'type' field — API may reject or default incorrectly
    invoiceNumber: "001234",
    invoiceValue: 159.9, // WRONG: dollars, not cents — causes financial mismatch
    // Missing 'issuanceDate' — API will reject with 400
    // Missing 'items' — API cannot match invoice to order items
  });
}
```

---

### Constraint: Update Tracking Promptly After Shipping

Tracking information MUST be sent as soon as the carrier provides it. Use `PATCH /api/oms/pvt/orders/{marketplaceOrderId}/invoice/{invoiceNumber}` to add tracking to an existing invoice.

**Why this matters**

Late tracking updates prevent customers from seeing shipment status in the marketplace. The order remains in "invoiced" state instead of progressing to "delivering" and then "delivered". This generates customer support tickets and damages seller reputation.

**Detection**

If you see tracking information being batched for daily updates instead of sent in real-time → warn about prompt tracking updates. If tracking is included in the initial invoice call but the carrier hasn't provided it yet (hardcoded/empty values) → warn.

**Correct**

```typescript
interface TrackingUpdate {
  courier: string;
  trackingNumber: string;
  trackingUrl?: string;
  isDelivered?: boolean;
}

async function updateOrderTracking(
  client: AxiosInstance,
  marketplaceOrderId: string,
  invoiceNumber: string,
  tracking: TrackingUpdate
): Promise<void> {
  await client.patch(
    `/api/oms/pvt/orders/${marketplaceOrderId}/invoice/${invoiceNumber}`,
    tracking
  );
}

// Send tracking as soon as carrier provides it
async function onCarrierPickup(
  client: AxiosInstance,
  marketplaceOrderId: string,
  invoiceNumber: string,
  carrierData: { name: string; trackingId: string; trackingUrl: string }
): Promise<void> {
  await updateOrderTracking(client, marketplaceOrderId, invoiceNumber, {
    courier: carrierData.name,
    trackingNumber: carrierData.trackingId,
    trackingUrl: carrierData.trackingUrl,
  });
  console.log(
    `Tracking updated for marketplace order ${marketplaceOrderId}: ${carrierData.trackingId}`
  );
}

// Update delivery status when confirmed
async function onDeliveryConfirmed(
  client: AxiosInstance,
  marketplaceOrderId: string,
  invoiceNumber: string
): Promise<void> {
  await updateOrderTracking(client, marketplaceOrderId, invoiceNumber, {
    courier: "",
    trackingNumber: "",
    isDelivered: true,
  });
  console.log(`Marketplace order ${marketplaceOrderId} marked as delivered`);
}
```

**Wrong**

```typescript
// WRONG: Sending empty/fake tracking data with the invoice
async function invoiceWithFakeTracking(
  client: AxiosInstance,
  marketplaceOrderId: string
): Promise<void> {
  await client.post(`/api/oms/pvt/orders/${marketplaceOrderId}/invoice`, {
    type: "Output",
    invoiceNumber: "NFE-001",
    invoiceValue: 9990,
    issuanceDate: new Date().toISOString(),
    items: [{ id: "123", quantity: 1, price: 9990 }],
    // WRONG: Hardcoded tracking — carrier hasn't picked up yet
    courier: "TBD",
    trackingNumber: "PENDING",
    trackingUrl: "",
  });
  // Customer sees "PENDING" as tracking number — useless information
}
```

---

### Constraint: Handle Partial Invoicing for Split Shipments

For orders shipped in multiple packages, each shipment MUST have its own invoice with only the items included in that package. The `invoiceValue` MUST reflect only the items in that particular shipment.

**Why this matters**

Sending a single invoice for the full order value when only partial items are shipped causes financial discrepancies. The marketplace cannot reconcile payments correctly, and the order status may not progress properly.

**Detection**

If you see a single invoice being sent with the full order value for partial shipments → warn about partial invoicing. If the items array doesn't match the actual items being shipped → warn.

**Correct**

```typescript
interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number; // per unit in cents
}

interface Shipment {
  items: OrderItem[];
  invoiceNumber: string;
}

async function sendPartialInvoices(
  client: AxiosInstance,
  marketplaceOrderId: string,
  shipments: Shipment[]
): Promise<void> {
  for (const shipment of shipments) {
    // Calculate value for only the items in this shipment
    const shipmentValue = shipment.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );

    await sendInvoiceNotification(client, marketplaceOrderId, {
      type: "Output",
      invoiceNumber: shipment.invoiceNumber,
      invoiceValue: shipmentValue,
      issuanceDate: new Date().toISOString(),
      items: shipment.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
      })),
    });

    console.log(
      `Partial invoice ${shipment.invoiceNumber} sent for marketplace order ${marketplaceOrderId}: ` +
        `${shipment.items.length} items, value=${shipmentValue}`
    );
  }
}

// Example: Order with 3 items shipped in 2 packages
await sendPartialInvoices(client, "vtex-marketplace-order-id-12345", [
  {
    invoiceNumber: "NFE-001-A",
    items: [
      { id: "sku-1", name: "Laptop", quantity: 1, price: 250000 },
    ],
  },
  {
    invoiceNumber: "NFE-001-B",
    items: [
      { id: "sku-2", name: "Mouse", quantity: 1, price: 5000 },
      { id: "sku-3", name: "Keyboard", quantity: 1, price: 12000 },
    ],
  },
]);
```

**Wrong**

```typescript
// WRONG: Sending full order value for partial shipment
async function wrongPartialInvoice(
  client: AxiosInstance,
  marketplaceOrderId: string,
  totalOrderValue: number,
  shippedItems: OrderItem[]
): Promise<void> {
  await client.post(`/api/oms/pvt/orders/${marketplaceOrderId}/invoice`, {
    type: "Output",
    invoiceNumber: "NFE-001-A",
    invoiceValue: totalOrderValue, // WRONG: Full order value, not partial
    issuanceDate: new Date().toISOString(),
    items: shippedItems.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      price: item.price,
    })),
    // invoiceValue doesn't match sum of items — financial mismatch
  });
}
```

## Preferred pattern

### Implement fulfillment simulation

Register **`POST /pvt/orderForms/simulation`**. Parse **`items[]`** (`id` = seller SKU, `seller` = seller id on marketplace). If the body has **no** `postalCode` / `clientProfileData`, treat as **indexation**: return availability (and minimal logistics if your contract requires it). If the body includes **checkout** fields, build **`logisticsInfo`** per `itemIndex`, populate **`slas`** (delivery + pickup-in-point with `pickupStoreInfo` when applicable), **`deliveryChannels`**, **`stockBalance`**, set **`country`** / **`postalCode`**, and **`allowMultipleDeliveries`: true**. Keep CPU and I/O bounded so you stay **under 2.5s**.

```typescript
import { RequestHandler } from "express";

const fulfillmentSimulation: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const items = body.items as Array<{ id: string; quantity: number; seller: string }>;
  const hasCheckoutContext = Boolean(body.postalCode && body.shippingData);

  const pricedItems = await priceAndStockForItems(items);

  if (!hasCheckoutContext) {
    res.json({ items: pricedItems, logisticsInfo: minimalLogistics(pricedItems) });
    return;
  }

  res.json({
    country: body.country,
    postalCode: body.postalCode,
    items: pricedItems,
    logisticsInfo: buildFullLogistics(pricedItems, body),
    allowMultipleDeliveries: true,
  });
};

function minimalLogistics(
  pricedItems: Array<{ id: string; requestIndex: number }>
): unknown[] {
  return pricedItems.map((_, i) => ({
    itemIndex: i,
    quantity: 1,
    shipsTo: ["USA"],
    slas: [],
    stockBalance: "",
    deliveryChannels: [{ id: "delivery", stockBalance: "" }],
  }));
}

function buildFullLogistics(
  pricedItems: Array<{ id: string; requestIndex: number }>,
  _checkoutBody: unknown
): unknown[] {
  // Replace with SLA / carrier rules derived from checkoutBody
  return pricedItems.map((_, i) => ({
    itemIndex: i,
    quantity: 1,
    shipsTo: ["USA"],
    slas: [],
    stockBalance: 0,
    deliveryChannels: [],
  }));
}

async function priceAndStockForItems(
  items: Array<{ id: string; quantity: number; seller: string }>
): Promise<Array<Record<string, unknown>>> {
  return items.map((item, requestIndex) => ({
    id: item.id,
    quantity: item.quantity,
    seller: item.seller,
    measurementUnit: "un",
    merchantName: null,
    price: 0,
    priceTags: [],
    priceValidUntil: null,
    requestIndex,
    unitMultiplier: 1,
    attachmentOfferings: [],
  }));
}
```

### Implement order placement (reservation)

Register **`POST /pvt/orders`**. Body is an **array**. Persist each order as a **reservation**; respond with the **same** objects plus **`orderId`** (reservation key) and typically **`followUpEmail`**. That **`orderId`** is what VTEX passes as **`sellerOrderId`** on **`POST /pvt/orders/{sellerOrderId}/fulfill`**.

```typescript
import { RequestHandler } from "express";

function createReservation(_order: Record<string, unknown>): string {
  return `res-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const orderPlacement: RequestHandler = (req, res) => {
  const orders = req.body as Array<Record<string, unknown>>;
  const out = orders.map((order) => ({
    ...order,
    orderId: createReservation(order),
    followUpEmail: "",
  }));
  res.json(out);
};
```

### Implement the Authorize Fulfillment Endpoint

The marketplace calls this endpoint when payment is approved.

```typescript
import express, { RequestHandler } from "express";

interface FulfillOrderRequest {
  marketplaceOrderId: string;
  marketplaceOrderGroup: string;
}

interface OrderMapping {
  /** Same id returned as orderId from POST /pvt/orders (reservation) */
  sellerOrderId: string;
  marketplaceOrderId: string;
  items: OrderItem[];
  status: string;
}

// Store for order mappings — use a real database in production
const orderStore = new Map<string, OrderMapping>();

const authorizeFulfillmentHandler: RequestHandler = async (req, res) => {
  const sellerOrderId = req.params.sellerOrderId;
  const { marketplaceOrderId, marketplaceOrderGroup }: FulfillOrderRequest = req.body;

  console.log(
    `Fulfillment authorized: reservation=${sellerOrderId}, marketplaceOrder=${marketplaceOrderId}, group=${marketplaceOrderGroup}`
  );

  // Store the marketplace order ID mapping
  const order = orderStore.get(sellerOrderId);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  order.marketplaceOrderId = marketplaceOrderId;
  order.status = "fulfillment_authorized";
  orderStore.set(sellerOrderId, order);

  // Trigger fulfillment process asynchronously
  enqueueFulfillment(sellerOrderId).catch(console.error);

  res.status(200).json({
    date: new Date().toISOString(),
    marketplaceOrderId,
    // Echo seller reservation id (same as path param / placement orderId)
    orderId: sellerOrderId,
    receipt: null,
  });
};

async function enqueueFulfillment(sellerOrderId: string): Promise<void> {
  console.log(`Enqueued fulfillment for ${sellerOrderId}`);
}

const app = express();
app.use(express.json());
app.post("/pvt/orders/:sellerOrderId/fulfill", authorizeFulfillmentHandler);
```

### Send Invoice After Fulfillment

Once the order is packed and the invoice is generated, send the invoice notification.

```typescript
async function fulfillAndInvoice(
  client: AxiosInstance,
  order: OrderMapping
): Promise<void> {
  // Generate invoice from your invoicing system
  const invoice = await generateInvoice(order);

  // Send invoice notification to VTEX marketplace
  await sendInvoiceNotification(client, order.marketplaceOrderId, {
    type: "Output",
    invoiceNumber: invoice.number,
    invoiceValue: invoice.totalCents,
    issuanceDate: invoice.issuedAt.toISOString(),
    invoiceUrl: invoice.pdfUrl,
    invoiceKey: invoice.accessKey,
    items: order.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      price: item.price,
    })),
  });

  console.log(
    `Invoice ${invoice.number} sent for order ${order.marketplaceOrderId}`
  );
}

async function generateInvoice(order: OrderMapping): Promise<{
  number: string;
  totalCents: number;
  issuedAt: Date;
  pdfUrl: string;
  accessKey: string;
}> {
  const totalCents = order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  return {
    number: `NFE-${Date.now()}`,
    totalCents,
    issuedAt: new Date(),
    pdfUrl: `https://invoices.example.com/NFE-${Date.now()}.pdf`,
    accessKey: "35260614388220000199550010000012341000012348",
  };
}
```

### Send Tracking When Carrier Picks Up

```typescript
async function handleCarrierPickup(
  client: AxiosInstance,
  marketplaceOrderId: string,
  invoiceNumber: string,
  carrier: { name: string; trackingId: string; trackingUrl: string }
): Promise<void> {
  await updateOrderTracking(client, marketplaceOrderId, invoiceNumber, {
    courier: carrier.name,
    trackingNumber: carrier.trackingId,
    trackingUrl: carrier.trackingUrl,
  });

  console.log(
    `Tracking ${carrier.trackingId} sent for marketplace order ${marketplaceOrderId}`
  );
}
```

### Confirm Delivery

```typescript
async function handleDeliveryConfirmation(
  client: AxiosInstance,
  marketplaceOrderId: string,
  invoiceNumber: string
): Promise<void> {
  await client.patch(
    `/api/oms/pvt/orders/${marketplaceOrderId}/invoice/${invoiceNumber}`,
    {
      isDelivered: true,
      courier: "",
      trackingNumber: "",
    }
  );

  console.log(`Marketplace order ${marketplaceOrderId} marked as delivered`);
}
```

### Complete Example

```typescript
import axios, { AxiosInstance } from "axios";

function createMarketplaceClient(
  accountName: string,
  appKey: string,
  appToken: string
): AxiosInstance {
  return axios.create({
    baseURL: `https://${accountName}.vtexcommercestable.com.br`,
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-API-AppKey": appKey,
      "X-VTEX-API-AppToken": appToken,
    },
    timeout: 10000,
  });
}

async function completeFulfillmentFlow(
  client: AxiosInstance,
  order: OrderMapping
): Promise<void> {
  // 1. Fulfill and invoice
  await fulfillAndInvoice(client, order);

  // 2. When carrier picks up, send tracking
  const carrierData = await waitForCarrierPickup(order.sellerOrderId);
  const invoice = await getLatestInvoice(order.sellerOrderId);

  await handleCarrierPickup(
    client,
    order.marketplaceOrderId,
    invoice.number,
    carrierData
  );

  // 3. When delivered, confirm
  await waitForDeliveryConfirmation(order.sellerOrderId);
  await handleDeliveryConfirmation(
    client,
    order.marketplaceOrderId,
    invoice.number
  );
}

async function waitForCarrierPickup(
  sellerOrderId: string
): Promise<{ name: string; trackingId: string; trackingUrl: string }> {
  // Replace with actual carrier integration
  return {
    name: "Correios",
    trackingId: "BR123456789",
    trackingUrl: "https://tracking.example.com/BR123456789",
  };
}

async function getLatestInvoice(
  sellerOrderId: string
): Promise<{ number: string }> {
  // Replace with actual invoice lookup
  return { number: `NFE-${sellerOrderId}` };
}

async function waitForDeliveryConfirmation(
  sellerOrderId: string
): Promise<void> {
  // Replace with actual delivery confirmation logic
  console.log(`Waiting for delivery confirmation: ${sellerOrderId}`);
}
```

## Common failure modes

- **Treating indexation simulation like checkout.** The same endpoint receives **minimal** bodies (no customer location) during indexation and **rich** bodies during checkout. Returning checkout-grade `logisticsInfo` for minimal calls can be unnecessary work; returning **only** prices for checkout calls **without** SLAs and `logisticsInfo` breaks shipping selection.

- **Omitting `orderId` on order placement.** VTEX expects an **array** response echoing each order with **`orderId`** set to your reservation. Empty 200 responses or missing `orderId` strand the order pipeline.

- **Using reservation `orderId` in OMS invoice URLs.** After placement, you must use **`marketplaceOrderId`** from the protocol when calling **`/api/oms/pvt/orders/...`**. Confusing the two ids produces 404 or silent failure on invoice/tracking.

- **Sending invoice before fulfillment authorization.** The seller sends an invoice notification immediately when the order is placed, before receiving the Authorize Fulfillment callback from the marketplace. Payment may still be pending or under review. Invoicing before authorization can result in the invoice being rejected or the order being in an inconsistent state. Only send the invoice after receiving `POST /pvt/orders/{sellerOrderId}/fulfill`.

- **Not handling return invoices for cancellation.** A seller tries to cancel an invoiced order by calling the Cancel Order endpoint directly without first sending a return invoice. Once an order is in "invoiced" status, it cannot be canceled without a return invoice (`type: "Input"`). The Cancel Order API will reject the request.

```typescript
// Correct: Send return invoice before canceling an invoiced order
async function cancelInvoicedOrder(
  client: AxiosInstance,
  marketplaceOrderId: string,
  originalItems: InvoiceItem[],
  originalInvoiceValue: number
): Promise<void> {
  // Step 1: Send return invoice (type: "Input")
  await sendInvoiceNotification(client, marketplaceOrderId, {
    type: "Input", // Return invoice
    invoiceNumber: `RET-${Date.now()}`,
    invoiceValue: originalInvoiceValue,
    issuanceDate: new Date().toISOString(),
    items: originalItems,
  });

  // Step 2: Now cancel the order
  await client.post(
    `/api/marketplace/pvt/orders/${marketplaceOrderId}/cancel`,
    { reason: "Customer requested return" }
  );
}
```

- **Fulfillment simulation exceeding the 2.5-second timeout.** The seller's fulfillment simulation endpoint performs complex database queries or external API calls that exceed the response time limit. VTEX marketplaces wait a maximum of **2.5 seconds** for a fulfillment simulation response. After that, the product is considered unavailable/inactive and won't appear in the storefront or checkout. Pre-cache price and inventory data.

## Review checklist

- [ ] Does **`POST /pvt/orderForms/simulation`** handle both minimal (indexation) and checkout-shaped requests, returning **`logisticsInfo`** and **`slas`** when context is present?
- [ ] Does **`POST /pvt/orders`** accept an array and return each order with **`orderId`** (reservation id)?
- [ ] Does **`POST /pvt/orders/{sellerOrderId}/fulfill`** read **`marketplaceOrderId`** and **`marketplaceOrderGroup`** and match **`sellerOrderId`** to the reservation from placement?
- [ ] Are OMS **`/invoice`** and **`PATCH .../invoice`** calls using **`marketplaceOrderId`**, not the reservation id?
- [ ] Does the seller only begin physical fulfillment after receiving the Authorize Fulfillment callback?
- [ ] For **IO/BFF** connectors: are **caching** and **route** choices aligned with **vtex-io** skills (simulation **SLA**, data **scope**)?
- [ ] Does the invoice payload include all required fields (`type`, `invoiceNumber`, `invoiceValue`, `issuanceDate`, `items`)?
- [ ] Is `invoiceValue` in cents (not dollars)?
- [ ] Is tracking sent separately after the carrier provides real data (not hardcoded placeholders)?
- [ ] For split shipments, does each invoice cover only its package's items and value?
- [ ] Is cancellation of invoiced orders handled via return invoice (`type: "Input"`) first?
- [ ] Does the fulfillment simulation endpoint respond within **2.5 seconds**?

## Reference

- [External Seller integration guide](https://developers.vtex.com/docs/guides/external-seller-integration-connector) — End-to-end seller connector (fulfillment URL, orders, invoicing)
- [Marketplace Protocol — External seller fulfillment](https://developers.vtex.com/docs/api-reference/marketplace-protocol-external-seller-fulfillment) — Simulation, order placement, authorize fulfillment, and related endpoints
- [External Seller Connector — Order invoicing](https://developers.vtex.com/docs/guides/external-seller-integration-connector#order-invoicing) — When and how to notify invoices to the marketplace OMS
- [Order Invoice Notification API](https://developers.vtex.com/docs/api-reference/orders-api#post-/api/oms/pvt/orders/-orderId-/invoice) — `POST` invoice to OMS (`orderId` in path = marketplace order)
- [Update Order Tracking API](https://developers.vtex.com/docs/api-reference/orders-api#patch-/api/oms/pvt/orders/-orderId-/invoice/-invoiceNumber-) — `PATCH` tracking on an invoice
- [Order Flow and Status](https://help.vtex.com/en/docs/tutorials/order-flow-and-status) — Order status lifecycle

VTEX also maintains an open **reference implementation** for the External Seller service under the **`vtex-apps/external-seller-example`** GitHub repository (useful as a scaffold; align behavior with the official protocol docs above).

---

# Order Integration & Webhooks

## When this skill applies

Use this skill when building an integration that needs to react to order status changes in a VTEX marketplace — such as syncing orders to an ERP, triggering fulfillment workflows, or sending notifications to external systems.

- Configuring Feed v3 or Hook for order updates
- Choosing between Feed (pull) and Hook (push) delivery models
- Validating webhook authentication and processing events idempotently
- Handling the complete order status lifecycle

Do not use this skill for:
- Catalog or SKU synchronization (see `marketplace-catalog-sync`)
- Invoice and tracking submission (see `marketplace-fulfillment`)
- General API rate limiting (see `marketplace-rate-limiting`)

## Decision rules

- Use **Hook (push)** for high-performance middleware that needs real-time order updates. Your endpoint must respond with HTTP 200 within 5000ms.
- Use **Feed (pull)** for ERPs or systems with limited throughput where you control the consumption pace. Events persist in a queue until committed.
- Use **Feed as a backup** alongside Hook to catch events missed during downtime.
- Use **FromWorkflow** filter when you only need to react to order status changes (simpler, most common).
- Use **FromOrders** filter when you need to filter by any order property using JSONata expressions (e.g., by sales channel).
- The two filter types are **mutually exclusive**. Using both in the same configuration request returns `409 Conflict`.
- Each appKey can configure only one feed and one hook. Different users sharing the same appKey access the same feed/hook.

| | Feed | Hook |
|---|---|---|
| Model | Pull (active) | Push (reactive) |
| Scalability | You control volume | Must handle any volume |
| Reliability | Events persist in queue | Must be always available |
| Best for | ERPs with limited throughput | High-performance middleware |

**Hook Notification Payload**:

```json
{
  "Domain": "Marketplace",
  "OrderId": "v40484048naf-01",
  "State": "payment-approved",
  "LastChange": "2019-07-29T23:17:30.0617185Z",
  "Origin": {
    "Account": "accountABC",
    "Key": "vtexappkey-keyEDF"
  }
}
```

The payload contains only the order ID and state — not the full order data. Your integration must call `GET /api/oms/pvt/orders/{orderId}` to retrieve complete order details.

**Architecture/Data Flow**:

```text
VTEX OMS                           Your Integration
   │                                       │
   │── Order status change ──────────────▶│  (Hook POST to your URL)
   │                                       │── Validate auth headers
   │                                       │── Check idempotency (orderId + State)
   │◀── GET /api/oms/pvt/orders/{id} ─────│  (Fetch full order)
   │── Full order data ──────────────────▶│
   │                                       │── Process order
   │◀── HTTP 200 ─────────────────────────│  (Must respond within 5000ms)
```

## Hard constraints

### Constraint: Validate Webhook Authentication

Your hook endpoint MUST validate the authentication headers sent by VTEX before processing any event. The `Origin.Account` and `Origin.Key` fields in the payload must match your expected values.

**Why this matters**

Without auth validation, any actor can send fake order events to your endpoint, triggering unauthorized fulfillment actions, data corruption, or financial losses.

**Detection**

If you see a hook endpoint handler that processes events without checking `Origin.Account`, `Origin.Key`, or custom headers → STOP and add authentication validation.

**Correct**

```typescript
import { RequestHandler } from "express";

interface HookPayload {
  Domain: string;
  OrderId: string;
  State: string;
  LastChange: string;
  Origin: {
    Account: string;
    Key: string;
  };
}

interface HookConfig {
  expectedAccount: string;
  expectedAppKey: string;
  customHeaderKey: string;
  customHeaderValue: string;
}

function createHookHandler(config: HookConfig): RequestHandler {
  return async (req, res) => {
    const payload: HookPayload = req.body;

    // Handle VTEX ping during hook configuration
    if (payload && "hookConfig" in payload) {
      res.status(200).json({ success: true });
      return;
    }

    // Validate Origin credentials
    if (
      payload.Origin?.Account !== config.expectedAccount ||
      payload.Origin?.Key !== config.expectedAppKey
    ) {
      console.error("Unauthorized hook event", {
        receivedAccount: payload.Origin?.Account,
        receivedKey: payload.Origin?.Key,
      });
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Validate custom header (configured during hook setup)
    if (req.headers[config.customHeaderKey.toLowerCase()] !== config.customHeaderValue) {
      console.error("Invalid custom header");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Process the event
    await processOrderEvent(payload);
    res.status(200).json({ success: true });
  };
}

async function processOrderEvent(payload: HookPayload): Promise<void> {
  console.log(`Processing order ${payload.OrderId} in state ${payload.State}`);
}
```

**Wrong**

```typescript
// WRONG: No authentication validation — accepts events from anyone
const unsafeHookHandler: RequestHandler = async (req, res) => {
  const payload: HookPayload = req.body;

  // Directly processing without checking Origin or headers
  // Any actor can POST fake events and trigger unauthorized actions
  await processOrderEvent(payload);
  res.status(200).json({ success: true });
};
```

---

### Constraint: Process Events Idempotently

Your integration MUST process order events idempotently. Use the combination of `OrderId` + `State` + `LastChange` as a deduplication key to prevent duplicate processing.

**Why this matters**

VTEX may deliver the same hook notification multiple times (at-least-once delivery). Without idempotency, duplicate processing can result in double fulfillment, duplicate invoices, or inconsistent state.

**Detection**

If you see an order event handler without an `orderId` duplicate check or deduplication mechanism → warn about idempotency. If the handler directly mutates state without checking if the event was already processed → warn.

**Correct**

```typescript
interface ProcessedEvent {
  orderId: string;
  state: string;
  lastChange: string;
  processedAt: Date;
}

// In-memory store for example — use Redis or database in production
const processedEvents = new Map<string, ProcessedEvent>();

function buildDeduplicationKey(payload: HookPayload): string {
  return `${payload.OrderId}:${payload.State}:${payload.LastChange}`;
}

async function idempotentProcessEvent(payload: HookPayload): Promise<boolean> {
  const deduplicationKey = buildDeduplicationKey(payload);

  // Check if this exact event was already processed
  if (processedEvents.has(deduplicationKey)) {
    console.log(`Event already processed: ${deduplicationKey}`);
    return false; // Skip — already handled
  }

  // Mark as processing (with TTL in production)
  processedEvents.set(deduplicationKey, {
    orderId: payload.OrderId,
    state: payload.State,
    lastChange: payload.LastChange,
    processedAt: new Date(),
  });

  try {
    await handleOrderStateChange(payload.OrderId, payload.State);
    return true;
  } catch (error) {
    // Remove from processed set so it can be retried
    processedEvents.delete(deduplicationKey);
    throw error;
  }
}

async function handleOrderStateChange(orderId: string, state: string): Promise<void> {
  switch (state) {
    case "ready-for-handling":
      await startOrderFulfillment(orderId);
      break;
    case "handling":
      await updateOrderInERP(orderId, "in_progress");
      break;
    case "invoiced":
      await confirmOrderShipped(orderId);
      break;
    case "cancel":
      await cancelOrderInERP(orderId);
      break;
    default:
      console.log(`Unhandled state: ${state} for order ${orderId}`);
  }
}

async function startOrderFulfillment(orderId: string): Promise<void> {
  console.log(`Starting fulfillment for ${orderId}`);
}

async function updateOrderInERP(orderId: string, status: string): Promise<void> {
  console.log(`Updating ERP: ${orderId} → ${status}`);
}

async function confirmOrderShipped(orderId: string): Promise<void> {
  console.log(`Confirming shipment for ${orderId}`);
}

async function cancelOrderInERP(orderId: string): Promise<void> {
  console.log(`Canceling order ${orderId} in ERP`);
}
```

**Wrong**

```typescript
// WRONG: No deduplication — processes every event even if already handled
async function processWithoutIdempotency(payload: HookPayload): Promise<void> {
  // If VTEX sends the same event twice, this creates duplicate records
  await database.insert("fulfillment_tasks", {
    orderId: payload.OrderId,
    state: payload.State,
    createdAt: new Date(),
  });

  // Duplicate fulfillment task created — items may ship twice
  await triggerFulfillment(payload.OrderId);
}

async function triggerFulfillment(orderId: string): Promise<void> {
  console.log(`Fulfilling ${orderId}`);
}

const database = {
  insert: async (table: string, data: Record<string, unknown>) => {
    console.log(`Inserting into ${table}:`, data);
  },
};
```

---

### Constraint: Handle All Order Statuses

Your integration MUST handle all possible order statuses, including `Status Null`. Unrecognized statuses must be logged but not crash the integration.

**Why this matters**

VTEX documents warn that `Status Null` may be unidentified and end up being mapped as another status, potentially leading to errors. Missing a status in your handler can cause orders to get stuck or lost.

**Detection**

If you see a status handler that only covers 2-3 statuses without a default/fallback case → warn about incomplete status handling.

**Correct**

```typescript
type OrderStatus =
  | "order-created"
  | "order-completed"
  | "on-order-completed"
  | "payment-pending"
  | "waiting-for-order-authorization"
  | "approve-payment"
  | "payment-approved"
  | "payment-denied"
  | "request-cancel"
  | "waiting-for-seller-decision"
  | "authorize-fulfillment"
  | "order-create-error"
  | "order-creation-error"
  | "window-to-cancel"
  | "ready-for-handling"
  | "start-handling"
  | "handling"
  | "invoice-after-cancellation-deny"
  | "order-accepted"
  | "invoiced"
  | "cancel"
  | "canceled";

async function handleAllStatuses(orderId: string, state: string): Promise<void> {
  switch (state) {
    case "ready-for-handling":
    case "start-handling":
      await notifyWarehouse(orderId, "prepare");
      break;

    case "handling":
      await updateFulfillmentStatus(orderId, "in_progress");
      break;

    case "invoiced":
      await markAsShipped(orderId);
      break;

    case "cancel":
    case "canceled":
    case "request-cancel":
      await handleCancellation(orderId, state);
      break;

    case "payment-approved":
      await confirmPaymentReceived(orderId);
      break;

    case "payment-denied":
      await handlePaymentFailure(orderId);
      break;

    default:
      // CRITICAL: Log unknown statuses instead of crashing
      console.warn(`Unknown or unhandled order status: "${state}" for order ${orderId}`);
      await logUnhandledStatus(orderId, state);
      break;
  }
}

async function notifyWarehouse(orderId: string, action: string): Promise<void> {
  console.log(`Warehouse notification: ${orderId} → ${action}`);
}
async function updateFulfillmentStatus(orderId: string, status: string): Promise<void> {
  console.log(`Fulfillment status: ${orderId} → ${status}`);
}
async function markAsShipped(orderId: string): Promise<void> {
  console.log(`Shipped: ${orderId}`);
}
async function handleCancellation(orderId: string, state: string): Promise<void> {
  console.log(`Cancellation: ${orderId} (${state})`);
}
async function confirmPaymentReceived(orderId: string): Promise<void> {
  console.log(`Payment received: ${orderId}`);
}
async function handlePaymentFailure(orderId: string): Promise<void> {
  console.log(`Payment failed: ${orderId}`);
}
async function logUnhandledStatus(orderId: string, state: string): Promise<void> {
  console.log(`UNHANDLED: ${orderId} → ${state}`);
}
```

**Wrong**

```typescript
// WRONG: Only handles 2 statuses, no fallback for unknown statuses
async function incompleteHandler(orderId: string, state: string): Promise<void> {
  if (state === "ready-for-handling") {
    await startOrderFulfillment(orderId);
  } else if (state === "invoiced") {
    await confirmOrderShipped(orderId);
  }
  // All other statuses silently ignored — orders get lost
  // "cancel" events never processed — canceled orders still ship
  // "Status Null" could be misinterpreted
}
```

## Preferred pattern

### Configure the Hook

Set up the hook with appropriate filters and your endpoint URL.

```typescript
import axios, { AxiosInstance } from "axios";

interface HookSetupConfig {
  accountName: string;
  appKey: string;
  appToken: string;
  hookUrl: string;
  hookHeaderKey: string;
  hookHeaderValue: string;
  filterStatuses: string[];
}

async function configureOrderHook(config: HookSetupConfig): Promise<void> {
  const client: AxiosInstance = axios.create({
    baseURL: `https://${config.accountName}.vtexcommercestable.com.br`,
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-API-AppKey": config.appKey,
      "X-VTEX-API-AppToken": config.appToken,
    },
  });

  const hookConfig = {
    filter: {
      type: "FromWorkflow",
      status: config.filterStatuses,
    },
    hook: {
      url: config.hookUrl,
      headers: {
        [config.hookHeaderKey]: config.hookHeaderValue,
      },
    },
  };

  await client.post("/api/orders/hook/config", hookConfig);
  console.log("Hook configured successfully");
}

// Example usage:
await configureOrderHook({
  accountName: "mymarketplace",
  appKey: process.env.VTEX_APP_KEY!,
  appToken: process.env.VTEX_APP_TOKEN!,
  hookUrl: "https://my-integration.example.com/vtex/order-hook",
  hookHeaderKey: "X-Integration-Secret",
  hookHeaderValue: process.env.HOOK_SECRET!,
  filterStatuses: [
    "ready-for-handling",
    "start-handling",
    "handling",
    "invoiced",
    "cancel",
  ],
});
```

### Build the Hook Endpoint with Auth and Idempotency

```typescript
import express from "express";

const app = express();
app.use(express.json());

const hookConfig: HookConfig = {
  expectedAccount: process.env.VTEX_ACCOUNT_NAME!,
  expectedAppKey: process.env.VTEX_APP_KEY!,
  customHeaderKey: "X-Integration-Secret",
  customHeaderValue: process.env.HOOK_SECRET!,
};

app.post("/vtex/order-hook", createHookHandler(hookConfig));

// The createHookHandler and idempotentProcessEvent functions
// from the Hard constraints section above handle auth + deduplication
```

### Fetch Full Order Data and Process

After receiving the hook notification, fetch the complete order data for processing.

```typescript
interface VtexOrder {
  orderId: string;
  status: string;
  items: Array<{
    id: string;
    productId: string;
    name: string;
    quantity: number;
    price: number;
    sellingPrice: number;
  }>;
  clientProfileData: {
    email: string;
    firstName: string;
    lastName: string;
    document: string;
  };
  shippingData: {
    address: {
      postalCode: string;
      city: string;
      state: string;
      country: string;
      street: string;
      number: string;
    };
    logisticsInfo: Array<{
      itemIndex: number;
      selectedSla: string;
      shippingEstimate: string;
    }>;
  };
  totals: Array<{
    id: string;
    name: string;
    value: number;
  }>;
  value: number;
}

async function fetchAndProcessOrder(
  client: AxiosInstance,
  orderId: string,
  state: string
): Promise<void> {
  const response = await client.get<VtexOrder>(
    `/api/oms/pvt/orders/${orderId}`
  );
  const order = response.data;

  switch (state) {
    case "ready-for-handling":
      await createFulfillmentTask({
        orderId: order.orderId,
        items: order.items.map((item) => ({
          skuId: item.id,
          name: item.name,
          quantity: item.quantity,
        })),
        shippingAddress: order.shippingData.address,
        estimatedDelivery: order.shippingData.logisticsInfo[0]?.shippingEstimate,
      });
      break;

    case "cancel":
      await cancelFulfillmentTask(order.orderId);
      break;

    default:
      console.log(`Order ${orderId}: state=${state}, no action needed`);
  }
}

async function createFulfillmentTask(task: Record<string, unknown>): Promise<void> {
  console.log("Creating fulfillment task:", task);
}

async function cancelFulfillmentTask(orderId: string): Promise<void> {
  console.log("Canceling fulfillment task:", orderId);
}
```

### Implement Feed as Fallback

Use Feed v3 as a backup to catch any events the hook might miss during downtime.

```typescript
async function pollFeedAsBackup(client: AxiosInstance): Promise<void> {
  const feedResponse = await client.get<Array<{
    eventId: string;
    handle: string;
    domain: string;
    state: string;
    orderId: string;
    lastChange: string;
  }>>("/api/orders/feed");

  const events = feedResponse.data;

  if (events.length === 0) {
    return; // No events in queue
  }

  const handlesToCommit: string[] = [];

  for (const event of events) {
    try {
      await fetchAndProcessOrder(client, event.orderId, event.state);
      handlesToCommit.push(event.handle);
    } catch (error) {
      console.error(`Failed to process feed event for ${event.orderId}:`, error);
      // Don't commit failed events — they'll return to the queue after visibility timeout
    }
  }

  // Commit successfully processed events
  if (handlesToCommit.length > 0) {
    await client.post("/api/orders/feed", {
      handles: handlesToCommit,
    });
  }
}

// Run feed polling on a schedule (e.g., every 2 minutes)
setInterval(async () => {
  try {
    const client = createVtexClient();
    await pollFeedAsBackup(client);
  } catch (error) {
    console.error("Feed polling error:", error);
  }
}, 120000); // 2 minutes

function createVtexClient(): AxiosInstance {
  return axios.create({
    baseURL: `https://${process.env.VTEX_ACCOUNT_NAME}.vtexcommercestable.com.br`,
    headers: {
      "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY!,
      "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN!,
    },
  });
}
```

### Complete Example

```typescript
import express from "express";
import axios, { AxiosInstance } from "axios";

// 1. Configure hook
async function setupIntegration(): Promise<void> {
  await configureOrderHook({
    accountName: process.env.VTEX_ACCOUNT_NAME!,
    appKey: process.env.VTEX_APP_KEY!,
    appToken: process.env.VTEX_APP_TOKEN!,
    hookUrl: `${process.env.BASE_URL}/vtex/order-hook`,
    hookHeaderKey: "X-Integration-Secret",
    hookHeaderValue: process.env.HOOK_SECRET!,
    filterStatuses: [
      "ready-for-handling",
      "handling",
      "invoiced",
      "cancel",
    ],
  });
}

// 2. Start webhook server
const app = express();
app.use(express.json());

const hookHandler = createHookHandler({
  expectedAccount: process.env.VTEX_ACCOUNT_NAME!,
  expectedAppKey: process.env.VTEX_APP_KEY!,
  customHeaderKey: "X-Integration-Secret",
  customHeaderValue: process.env.HOOK_SECRET!,
});

app.post("/vtex/order-hook", hookHandler);

// 3. Health check for VTEX ping
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

// 4. Start feed polling as backup
setInterval(async () => {
  try {
    const client = createVtexClient();
    await pollFeedAsBackup(client);
  } catch (error) {
    console.error("Feed backup polling error:", error);
  }
}, 120000);

app.listen(3000, () => {
  console.log("Order integration running on port 3000");
  setupIntegration().catch(console.error);
});
```

## Common failure modes

- **Using List Orders API instead of Feed/Hook.** The `GET /api/oms/pvt/orders` endpoint depends on indexing, which can lag behind real-time updates. It's slower, less reliable, and more likely to hit rate limits when polled frequently. Feed v3 runs before indexing and doesn't depend on it. Use Feed v3 or Hook for order change detection; use List Orders only for ad-hoc queries.

- **Blocking hook response with long processing.** VTEX requires the hook endpoint to respond with HTTP 200 within **5000ms**. If processing takes longer (e.g., ERP sync, complex database writes), VTEX considers the delivery failed and retries with increasing delays. Repeated failures can lead to hook deactivation. Acknowledge the event immediately, then process asynchronously via a queue.

```typescript
import { RequestHandler } from "express";

// Correct: Acknowledge immediately, process async
const asyncHookHandler: RequestHandler = async (req, res) => {
  const payload: HookPayload = req.body;

  // Validate auth (fast operation)
  if (!validateAuth(payload, req.headers)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Enqueue for async processing (fast operation)
  await enqueueOrderEvent(payload);

  // Respond immediately — well within 5000ms
  res.status(200).json({ received: true });
};

function validateAuth(
  payload: HookPayload,
  headers: Record<string, unknown>
): boolean {
  return (
    payload.Origin?.Account === process.env.VTEX_ACCOUNT_NAME &&
    headers["x-integration-secret"] === process.env.HOOK_SECRET
  );
}

async function enqueueOrderEvent(payload: HookPayload): Promise<void> {
  // Use a message queue (SQS, RabbitMQ, Redis, etc.)
  console.log(`Enqueued order event: ${payload.OrderId}`);
}
```

## Review checklist

- [ ] Is the correct delivery model chosen (Feed for controlled throughput, Hook for real-time)?
- [ ] Does the hook endpoint validate `Origin.Account`, `Origin.Key`, and custom headers?
- [ ] Is event processing idempotent using `OrderId` + `State` + `LastChange` as deduplication key?
- [ ] Does the status handler cover all order statuses with a default/fallback case?
- [ ] Does the hook endpoint respond within **5000ms** (using async processing for heavy work)?
- [ ] Is Feed v3 configured as a backup to catch missed hook events?
- [ ] Are filter types not mixed (FromWorkflow and FromOrders are mutually exclusive)?

## Reference

- [Feed v3 Guide](https://developers.vtex.com/docs/guides/orders-feed) — Complete guide to Feed and Hook configuration, filter types, and best practices
- [Orders API - Feed v3 Endpoints](https://developers.vtex.com/docs/api-reference/orders-api#get-/api/orders/feed) — API reference for feed retrieval and commit
- [Hook Configuration API](https://developers.vtex.com/docs/api-reference/orders-api#post-/api/orders/hook/config) — API reference for creating and updating hook configuration
- [Orders Overview](https://developers.vtex.com/docs/guides/orders-overview) — Overview of the VTEX Orders module
- [Order Flow and Status](https://help.vtex.com/en/docs/tutorials/order-flow-and-status) — Complete list of order statuses and transitions
- [ERP Integration - Set Up Order Integration](https://developers.vtex.com/docs/guides/erp-integration-set-up-order-integration) — Guide for integrating order feed with back-office systems

---

# API Rate Limiting & Resilience

## When this skill applies

Use this skill when building any integration that calls VTEX APIs — catalog sync, order processing, price/inventory updates, or fulfillment operations — and needs to handle rate limits gracefully without losing data or degrading performance.

- Implementing retry logic with exponential backoff and jitter
- Reading and reacting to VTEX rate limit headers (`Retry-After`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- Building circuit breakers for high-throughput integrations
- Controlling request throughput with queuing

Do not use this skill for:
- Catalog-specific synchronization logic (see `marketplace-catalog-sync`)
- Order event consumption and processing (see `marketplace-order-hook`)
- Invoice and tracking submission (see `marketplace-fulfillment`)

## Decision rules

- Always implement **exponential backoff with jitter** on 429 responses. Formula: `delay = min(maxDelay, baseDelay * 2^attempt) * (0.5 + random(0, 0.5))`.
- Always **read the `Retry-After` header** on 429 responses. Use the greater of the `Retry-After` value and the calculated backoff delay.
- Use a **circuit breaker** when a service consistently fails (e.g., after 5 consecutive failures), to prevent cascading failures and give the service time to recover.
- Use a **request queue** to control throughput and avoid bursts that trigger rate limits.
- Monitor `X-RateLimit-Remaining` **proactively** on successful responses and slow down before hitting 429.
- VTEX rate limits vary by API:
  - **Pricing API**: PUT/POST: 40 requests/second/account with 1000 burst credits. DELETE: 16 requests/second/account with 300 burst credits.
  - **Catalog API**: Varies by endpoint; no published fixed limits.
  - **Orders API**: Subject to general platform limits; VTEX recommends 1-minute backoff on 429.
- **Burst Credits**: When you exceed the rate limit, excess requests consume burst credits (1 credit per excess request). When burst credits reach 0, the request is blocked with 429. Credits refill over time at the same rate as the route's limit when the route is not being used.

**Rate Limit Response Headers**:

| Header | Description |
|---|---|
| `Retry-After` | Seconds to wait before retrying (present on 429 responses) |
| `X-RateLimit-Remaining` | Number of requests remaining in the current window |
| `X-RateLimit-Reset` | Timestamp (seconds) when the rate limit window resets |

**Architecture/Data Flow**:

```text
Your Integration                          VTEX API
      │                                       │
      │── Request ──────────────────────────▶│
      │◀── 200 OK ─────────────────────────│  (success)
      │                                       │
      │── Request ──────────────────────────▶│
      │◀── 429 + Retry-After: 30 ──────────│  (rate limited)
      │                                       │
      │   [Wait: max(Retry-After, backoff)]   │
      │   [backoff = base * 2^attempt * jitter]│
      │                                       │
      │── Retry ───────────────────────────▶│
      │◀── 200 OK ─────────────────────────│  (success)
```

## Hard constraints

### Constraint: Implement Exponential Backoff on 429 Responses

When receiving a 429 response, the integration MUST wait before retrying using exponential backoff with jitter. The wait time MUST respect the `Retry-After` header when present.

**Why this matters**

Immediate retries after a 429 will be rejected again and consume burst credits faster, leading to prolonged blocking. Without jitter, all clients retry simultaneously after the window resets, causing another rate limit spike (thundering herd).

**Detection**

If you see immediate retry on 429 (no delay, no backoff) → STOP and implement exponential backoff. If you see retry logic without reading the `Retry-After` header → warn that the header should be respected. If you see `while(true)` retry loops or `setInterval` with intervals less than 5 seconds → warn about tight loops.

**Correct**

```typescript
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
};

/**
 * Calculates exponential backoff delay with full jitter.
 *
 * Formula: min(maxDelay, baseDelay * 2^attempt) * random(0.5, 1.0)
 *
 * The jitter prevents thundering herd when multiple clients
 * are rate-limited simultaneously.
 */
function calculateBackoffWithJitter(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const boundedDelay = Math.min(maxDelayMs, exponentialDelay);
  // Full jitter: random value between 50% and 100% of the bounded delay
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.floor(boundedDelay * jitter);
}

/**
 * Executes an API request with automatic retry on 429 responses.
 * Respects the Retry-After header and applies exponential backoff with jitter.
 */
async function requestWithRetry<T>(
  client: AxiosInstance,
  config: AxiosRequestConfig,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<AxiosResponse<T>> {
  let lastError: AxiosError | undefined;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await client.request<T>(config);
    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) {
        throw error;
      }

      lastError = error;
      const status = error.response?.status;

      // Only retry on 429 (rate limited) and 503 (circuit breaker)
      if (status !== 429 && status !== 503) {
        throw error;
      }

      if (attempt === retryConfig.maxRetries) {
        break; // Exhausted retries
      }

      // Respect Retry-After header if present (value is in seconds)
      const retryAfterHeader = error.response?.headers?.["retry-after"];
      const retryAfterMs = retryAfterHeader
        ? parseInt(retryAfterHeader, 10) * 1000
        : 0;

      // Use the greater of Retry-After or calculated backoff
      const backoffMs = calculateBackoffWithJitter(
        attempt,
        retryConfig.baseDelayMs,
        retryConfig.maxDelayMs
      );
      const delayMs = Math.max(retryAfterMs, backoffMs);

      console.warn(
        `Rate limited (${status}). Retry ${attempt + 1}/${retryConfig.maxRetries} ` +
          `in ${delayMs}ms (Retry-After: ${retryAfterHeader ?? "none"}, ` +
          `backoff: ${backoffMs}ms)`
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError ?? new Error("Request failed after all retries");
}
```

**Wrong**

```typescript
// WRONG: Immediate retry without backoff or Retry-After respect
async function retryImmediately<T>(
  client: AxiosInstance,
  config: AxiosRequestConfig,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await client.request<T>(config);
      return response.data;
    } catch (error: unknown) {
      // Retries immediately — will hit 429 again and drain burst credits
      // Does not read Retry-After header — ignores server guidance
      console.log(`Retry ${i + 1}...`);
      // No delay at all — thundering herd when multiple instances retry
    }
  }
  throw new Error("Failed after retries");
}
```

---

### Constraint: Respect the Retry-After Header

When a 429 response includes a `Retry-After` header, the integration MUST wait at least the specified number of seconds before retrying. The backoff delay should be the maximum of the calculated backoff and the `Retry-After` value.

**Why this matters**

The `Retry-After` header is the server's explicit instruction on when it will accept requests again. Ignoring it results in requests being rejected until the specified time has passed, wasting bandwidth and potentially extending the block period.

**Detection**

If you see retry logic that does not read or use the `Retry-After` header value → warn that the header should be checked. If the retry delay is always a fixed value regardless of the header → warn.

**Correct**

```typescript
function getRetryDelayMs(error: AxiosError, attempt: number): number {
  const retryAfterHeader = error.response?.headers?.["retry-after"];

  // Parse Retry-After (could be seconds or HTTP-date)
  let retryAfterMs = 0;
  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds)) {
      retryAfterMs = seconds * 1000;
    } else {
      // HTTP-date format
      const retryDate = new Date(retryAfterHeader).getTime();
      retryAfterMs = Math.max(0, retryDate - Date.now());
    }
  }

  // Calculate backoff with jitter
  const backoffMs = calculateBackoffWithJitter(attempt, 1000, 60000);

  // Use the larger value — respect server guidance
  return Math.max(retryAfterMs, backoffMs);
}
```

**Wrong**

```typescript
// WRONG: Fixed 1-second retry ignoring Retry-After header
async function fixedRetry<T>(
  client: AxiosInstance,
  config: AxiosRequestConfig
): Promise<T> {
  try {
    const response = await client.request<T>(config);
    return response.data;
  } catch {
    // Always waits 1 second regardless of Retry-After header
    // If Retry-After says 60 seconds, this will fail again and again
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const response = await client.request<T>(config);
    return response.data;
  }
}
```

---

### Constraint: No Tight Retry Loops

Integrations MUST NOT use `while(true)` loops for retrying or `setInterval`/`setTimeout` with intervals less than 5 seconds for polling VTEX APIs.

**Why this matters**

Tight loops generate excessive requests that quickly exhaust rate limits, degrade VTEX platform performance for all users, and can make the VTEX Admin unavailable for the account. VTEX explicitly warns that excessive 429 errors can make Admin unavailable.

**Detection**

If you see `while(true)` or `for(;;)` retry patterns without adequate delays → warn about tight loops. If you see `setInterval` with intervals less than 5000ms for API calls → warn about polling frequency.

**Correct**

```typescript
// Correct: Controlled polling with adequate intervals
async function pollWithBackpressure(
  client: AxiosInstance,
  intervalMs: number = 30000 // 30 seconds minimum
): Promise<void> {
  const poll = async (): Promise<void> => {
    try {
      const response = await client.get("/api/orders/feed");
      const events = response.data;

      if (events.length > 0) {
        await processEvents(events);
        await commitEvents(
          client,
          events.map((e: { handle: string }) => e.handle)
        );
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        const retryAfter = parseInt(
          error.response.headers["retry-after"] || "60",
          10
        );
        console.warn(`Rate limited, waiting ${retryAfter}s`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return;
      }
      console.error("Polling error:", error);
    }

    // Schedule next poll
    setTimeout(poll, intervalMs);
  };

  // Start polling
  await poll();
}

async function processEvents(events: unknown[]): Promise<void> {
  console.log(`Processing ${events.length} events`);
}

async function commitEvents(client: AxiosInstance, handles: string[]): Promise<void> {
  await client.post("/api/orders/feed", { handles });
}
```

**Wrong**

```typescript
// WRONG: Tight loop with no backpressure
async function tightLoop(client: AxiosInstance): Promise<void> {
  while (true) {
    try {
      const response = await client.get("/api/orders/feed");
      await processEvents(response.data);
    } catch {
      // Immediate retry — no delay, burns through rate limits
      continue;
    }
  }
}

// WRONG: setInterval with 1-second polling
setInterval(async () => {
  // 1 request/second = 3600/hour — will trigger rate limits quickly
  const client = createClient();
  await client.get("/api/catalog_system/pvt/sku/stockkeepingunitids");
}, 1000);

function createClient(): AxiosInstance {
  return axios.create({ baseURL: "https://account.vtexcommercestable.com.br" });
}
```

## Preferred pattern

### Create a Rate-Limit-Aware HTTP Client

Wrap your HTTP client with automatic retry logic.

```typescript
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

interface RateLimitedClientConfig {
  accountName: string;
  appKey: string;
  appToken: string;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

function createRateLimitedClient(config: RateLimitedClientConfig): {
  client: AxiosInstance;
  request: <T>(requestConfig: AxiosRequestConfig) => Promise<AxiosResponse<T>>;
} {
  const client = axios.create({
    baseURL: `https://${config.accountName}.vtexcommercestable.com.br`,
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-API-AppKey": config.appKey,
      "X-VTEX-API-AppToken": config.appToken,
    },
    timeout: 30000,
  });

  const retryConfig: RetryConfig = {
    maxRetries: config.maxRetries ?? 5,
    baseDelayMs: config.baseDelayMs ?? 1000,
    maxDelayMs: config.maxDelayMs ?? 60000,
  };

  return {
    client,
    request: <T>(requestConfig: AxiosRequestConfig) =>
      requestWithRetry<T>(client, requestConfig, retryConfig),
  };
}
```

### Implement a Circuit Breaker

Prevent cascading failures when a service is consistently failing.

```typescript
enum CircuitState {
  CLOSED = "CLOSED",     // Normal operation — requests flow through
  OPEN = "OPEN",         // Service failing — requests blocked
  HALF_OPEN = "HALF_OPEN", // Testing recovery — one request allowed
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeMs: number = 30000,
    private readonly halfOpenSuccessThreshold: number = 3
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.recoveryTimeMs) {
        throw new Error(
          `Circuit breaker is OPEN. Retry after ${this.recoveryTimeMs}ms.`
        );
      }
      // Transition to half-open for a test request
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        console.log("Circuit breaker: CLOSED (recovered)");
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.warn(
        `Circuit breaker: OPEN after ${this.failureCount} failures`
      );
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}
```

### Implement a Request Queue

Queue requests to control throughput and avoid bursts.

```typescript
interface QueuedRequest<T> {
  config: AxiosRequestConfig;
  resolve: (value: AxiosResponse<T>) => void;
  reject: (error: Error) => void;
}

class RequestQueue {
  private queue: Array<QueuedRequest<unknown>> = [];
  private processing: boolean = false;
  private readonly requestsPerSecond: number;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    private readonly client: {
      request: <T>(config: AxiosRequestConfig) => Promise<AxiosResponse<T>>;
    },
    requestsPerSecond: number = 10,
    circuitBreaker?: CircuitBreaker
  ) {
    this.requestsPerSecond = requestsPerSecond;
    this.circuitBreaker = circuitBreaker ?? new CircuitBreaker();
  }

  async enqueue<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return new Promise<AxiosResponse<T>>((resolve, reject) => {
      this.queue.push({
        config,
        resolve: resolve as (value: AxiosResponse<unknown>) => void,
        reject,
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const delayBetweenRequests = 1000 / this.requestsPerSecond;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;

      try {
        const result = await this.circuitBreaker.execute(() =>
          this.client.request(request.config)
        );
        request.resolve(result);
      } catch (error) {
        request.reject(error instanceof Error ? error : new Error(String(error)));
      }

      // Throttle between requests
      if (this.queue.length > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayBetweenRequests)
        );
      }
    }

    this.processing = false;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}
```

### Monitor Rate Limit Headers Proactively

Read rate limit headers to slow down before hitting 429.

```typescript
import { AxiosResponse } from "axios";

interface RateLimitInfo {
  remaining: number | null;
  resetAt: number | null;
  retryAfter: number | null;
}

function parseRateLimitHeaders(response: AxiosResponse): RateLimitInfo {
  return {
    remaining: response.headers["x-ratelimit-remaining"]
      ? parseInt(response.headers["x-ratelimit-remaining"], 10)
      : null,
    resetAt: response.headers["x-ratelimit-reset"]
      ? parseInt(response.headers["x-ratelimit-reset"], 10) * 1000
      : null,
    retryAfter: response.headers["retry-after"]
      ? parseInt(response.headers["retry-after"], 10) * 1000
      : null,
  };
}

async function adaptiveRequest<T>(
  client: AxiosInstance,
  config: AxiosRequestConfig,
  queue: RequestQueue
): Promise<AxiosResponse<T>> {
  const response = await queue.enqueue<T>(config);
  const rateInfo = parseRateLimitHeaders(response);

  // Proactively slow down when remaining requests are low
  if (rateInfo.remaining !== null && rateInfo.remaining < 10) {
    console.warn(
      `Rate limit approaching: ${rateInfo.remaining} requests remaining. ` +
        `Slowing down.`
    );
    // Add extra delay to reduce pressure
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return response;
}
```

### Complete Example

```typescript
import axios from "axios";

async function buildResilientIntegration(): Promise<void> {
  const { client, request } = createRateLimitedClient({
    accountName: process.env.VTEX_ACCOUNT_NAME!,
    appKey: process.env.VTEX_APP_KEY!,
    appToken: process.env.VTEX_APP_TOKEN!,
    maxRetries: 5,
    baseDelayMs: 1000,
    maxDelayMs: 60000,
  });

  const circuitBreaker = new CircuitBreaker(
    5,     // Open after 5 failures
    30000, // Wait 30s before testing recovery
    3      // Close after 3 successful half-open requests
  );

  const queue = new RequestQueue({ request }, 10, circuitBreaker);

  // Example: Batch update prices with rate limiting
  const skuIds = ["sku-1", "sku-2", "sku-3", "sku-4", "sku-5"];

  for (const skuId of skuIds) {
    try {
      const response = await queue.enqueue({
        method: "POST",
        url: `/notificator/seller01/changenotification/${skuId}/price`,
      });

      const rateInfo = parseRateLimitHeaders(response);
      if (rateInfo.remaining !== null && rateInfo.remaining < 5) {
        console.warn("Approaching rate limit, adding delay");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Circuit breaker is OPEN")) {
        console.error("Circuit breaker open — pausing all requests");
        await new Promise((resolve) => setTimeout(resolve, 30000));
      } else {
        console.error(`Failed to update price for ${skuId}:`, error);
      }
    }
  }
}
```

## Common failure modes

- **Fixed retry delay without jitter.** Using a fixed delay (e.g., always 5 seconds) instead of exponential backoff with jitter causes the "thundering herd" problem: all rate-limited clients retry simultaneously, creating another burst that triggers rate limiting again. Use exponential backoff with random jitter so retries are spread across time.

```typescript
// Correct: Exponential backoff with jitter
function getRetryDelay(attempt: number): number {
  const baseDelay = 1000;
  const maxDelay = 60000;
  const exponential = baseDelay * Math.pow(2, attempt);
  const bounded = Math.min(maxDelay, exponential);
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.floor(bounded * jitter);
}

// attempt 0: ~500-1000ms
// attempt 1: ~1000-2000ms
// attempt 2: ~2000-4000ms
// attempt 3: ~4000-8000ms
// attempt 4: ~8000-16000ms
```

- **No proactive rate management.** Only handling 429 errors reactively (after being rate limited) instead of monitoring rate limit headers to slow down proactively. By the time you receive a 429, you've already lost burst credits. Monitor `X-RateLimit-Remaining` on successful responses and reduce request rate when remaining quota is low.

```typescript
// Correct: Proactive rate management
async function proactiveRateManagement(
  client: AxiosInstance,
  requests: AxiosRequestConfig[]
): Promise<void> {
  let delayBetweenRequests = 100; // Start at 100ms between requests

  for (const config of requests) {
    const response = await requestWithRetry(client, config);
    const rateInfo = parseRateLimitHeaders(response);

    // Proactively adjust speed based on remaining quota
    if (rateInfo.remaining !== null) {
      if (rateInfo.remaining < 5) {
        delayBetweenRequests = 5000; // Slow down significantly
      } else if (rateInfo.remaining < 20) {
        delayBetweenRequests = 1000; // Moderate slowdown
      } else {
        delayBetweenRequests = 100; // Normal speed
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delayBetweenRequests));
  }
}
```

## Review checklist

- [ ] Is exponential backoff with jitter implemented for 429 responses?
- [ ] Is the `Retry-After` header read and respected on 429 responses?
- [ ] Are there no tight retry loops (`while(true)`, `setInterval` < 5 seconds)?
- [ ] Is a circuit breaker in place for consistently failing services?
- [ ] Are `X-RateLimit-Remaining` headers monitored proactively to slow down before hitting limits?
- [ ] Are the correct numeric thresholds used (maxRetries: 5, baseDelayMs: 1000, maxDelayMs: 60000)?
- [ ] Are Pricing API limits respected (40 req/s PUT/POST, 16 req/s DELETE, burst credits)?

## Reference

- [Best Practices for Avoiding Rate Limit Errors](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) — Official VTEX guide on rate limit management and best practices
- [Handling Errors and Exceptions](https://developers.vtex.com/docs/guides/handling-errors-and-exceptions) — VTEX guide on error handling including 429 and 5xx responses
- [API Response Status Codes](https://developers.vtex.com/docs/guides/api-response-codes) — Complete list of VTEX API response codes and their meanings
- [Pricing API Overview - Rate Limits](https://developers.vtex.com/docs/guides/pricing-api-overview) — Specific rate limit documentation for the Pricing API including burst credits
- [Feed v3 - Best Practices](https://developers.vtex.com/docs/guides/orders-feed) — Rate limiting recommendations for order feed integrations
- [How to Load Test a Store](https://developers.vtex.com/docs/guides/how-to-load-test-a-store) — VTEX documentation on rate limiting behavior, 429 responses, and circuit breakers

---

# Master Data Storage & Schema Design

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

- [vtex-io-masterdata](../../../vtex-io/skills/vtex-io-masterdata/skill.md) — IO app integration: MasterDataClient, `masterdata` builder, CRUD patterns
- [vtex-io-application-performance](../../../vtex-io/skills/vtex-io-application-performance/skill.md) — Caching layers and BFF patterns when exposing MD data
- [architecture-well-architected-commerce](../../../architecture/skills/architecture-well-architected-commerce/skill.md) — Cross-cutting storage and architecture principles

## Reference

- [Working with JSON Schemas in Master Data v2](https://developers.vtex.com/docs/guides/working-with-json-schemas-in-master-data-v2) — v-indexed, v-cache, v-security, v-triggers configuration
- [Master Data v2 Basics](https://developers.vtex.com/docs/guides/master-data-v2-basics) — Core concepts and data model
- [Master Data Schema Lifecycle](https://developers.vtex.com/docs/guides/master-data-schema-lifecycle) — Schema versioning and the 60-schema limit
- [Setting Up Triggers on Master Data v2](https://developers.vtex.com/docs/guides/setting-up-triggers-on-master-data-v2) — Trigger configuration and patterns
- [Master Data v2 API Reference](https://developers.vtex.com/docs/api-reference/master-data-api-v2#overview) — Complete API specification
- [Master Data v2 Document Saving Flow](https://developers.vtex.com/docs/guides/master-data-v2-document-saving-flow) — Validation, indexing, and trigger execution order

---

# Payment Connector Development

# Asynchronous Payment Flows & Callbacks

## When this skill applies

Use this skill when:
- Implementing a payment connector that supports Boleto Bancário, Pix, bank transfers, or redirect-based flows
- Working with any payment method where the acquirer does not return a final status synchronously
- Handling `callbackUrl` notification or retry flows
- Managing the Gateway's 7-day automatic retry cycle for `undefined` status payments
- Implementing redirect-based authentication flows (e.g., PayPal, 3DS redirects) where the user leaves the VTEX checkout and returns after completing payment on an external site

Do not use this skill for:
- PPP endpoint contracts and response shapes — use [`payment-provider-protocol`](../payment-provider-protocol/skill.md)
- `paymentId`/`requestId` idempotency and state machine logic — use [`payment-idempotency`](../payment-idempotency/skill.md)
- PCI compliance and Secure Proxy card handling — use [`payment-pci-security`](../payment-pci-security/skill.md)

## Decision rules

- If the acquirer cannot return a final status synchronously, the payment method is async — return `status: "undefined"`.
- Common async methods: Boleto Bancário (`BankInvoice`), Pix, bank transfers, redirect-based auth.
- Common sync methods: credit cards, debit cards with instant authorization.
- **Without VTEX IO**: the `callbackUrl` is a notification endpoint — POST the updated status with `X-VTEX-API-AppKey`/`X-VTEX-API-AppToken` headers.
- **With VTEX IO**: the `callbackUrl` is a retry endpoint — POST to it (no payload) to trigger the Gateway to re-call POST `/payments`. The `callbackUrl` format is typically `https://{account}.vtexpayments.com.br/payment-provider/transactions/{txId}/payments/{paymentId}/retry`. A POST to this URL with body `{ paymentId }` makes the Gateway re-call your `authorize()` method.
- Always preserve the `X-VTEX-signature` query parameter in the `callbackUrl` — never strip or modify it.
- **`inboundRequestsUrl` is server-to-server only (POST)** — it does NOT support browser GET redirects. If your payment flow requires the user's browser to redirect back (e.g., PayPal, 3DS), you must create a custom public route. See the "Redirect-based flows" constraint below.
- For asynchronous methods, `delayToCancel` MUST reflect the actual validity of the payment method, not the 7‑day internal Gateway retry window:
  - Pix: between 900 and 3600 seconds (15–60 minutes), aligned with QR code expiration.
  - BankInvoice (Boleto): aligned with the invoice due date / payment deadline configured in the provider.
  - Other async methods: aligned with the provider's documented expiry SLA.

## Hard constraints

### Constraint: MUST return `undefined` for async payment methods

For any payment method where authorization does not complete synchronously (Boleto, Pix, bank transfer, redirect-based auth), the Create Payment response MUST use `status: "undefined"`. The connector MUST NOT return `"approved"` or `"denied"` until the payment is actually confirmed or rejected by the acquirer.

**Why this matters**
Returning `"approved"` for an unconfirmed payment tells the Gateway the money has been collected. The order is released for fulfillment immediately. If the customer never actually pays (e.g., never scans the Pix QR code), the merchant ships products without payment. Returning `"denied"` prematurely cancels a payment that might still be completed.

**Detection**
If the Create Payment handler returns `status: "approved"` or `status: "denied"` for an asynchronous payment method (Boleto, Pix, bank transfer, redirect), STOP. Async methods must return `"undefined"` and resolve via callback.

**Correct**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  const asyncMethods = ["BankInvoice", "Pix"];
  const isAsync = asyncMethods.includes(paymentMethod);

  if (isAsync) {
    const pending = await acquirer.initiateAsyncPayment(req.body);

    // Store payment and callbackUrl for later notification
    await store.save(paymentId, {
      paymentId,
      status: "undefined",
      callbackUrl,
      acquirerReference: pending.reference,
    });

    res.status(200).json({
      paymentId,
      status: "undefined",  // Correct: payment is pending
      authorizationId: pending.authorizationId ?? null,
      nsu: pending.nsu ?? null,
      tid: pending.tid ?? null,
      acquirer: "MyProvider",
      code: "PENDING",
      message: "Awaiting customer action",
      delayToAutoSettle: 21600,
      delayToAutoSettleAfterAntifraud: 1800,
      delayToCancel: computeDelayToCancel(paymentMethod, pending),
      paymentUrl: pending.qrCodeUrl ?? pending.boletoUrl ?? undefined,
    });

    return;
  }

  // Synchronous methods (credit card) can return final status
  const result = await acquirer.authorizeSyncPayment(req.body);

  res.status(200).json({
    paymentId,
    status: result.status,  // "approved" or "denied" is OK for sync
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: result.code ?? null,
    message: result.message ?? null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  });
}

const PIX_MIN_DELAY = 900;   // 15 minutes
const PIX_MAX_DELAY = 3600;  // 60 minutes

function computeDelayToCancel(paymentMethod: string, pending: any): number {
  if (paymentMethod === "Pix") {
    // Use provider QR TTL but clamp to 15–60 minutes
    const providerTtlSeconds = pending.pixTtlSeconds ?? 1800; // default 30 min
    return Math.min(Math.max(providerTtlSeconds, PIX_MIN_DELAY), PIX_MAX_DELAY);
  }

  if (paymentMethod === "BankInvoice") {
    // Example: seconds until boleto due date
    const now = Date.now();
    const dueDate = new Date(pending.dueDate).getTime();
    const diffSeconds = Math.max(Math.floor((dueDate - now) / 1000), 0);
    return diffSeconds;
  }

  // Other async methods: follow provider SLA if provided
  if (pending.expirySeconds) {
    return pending.expirySeconds;
  }

  // Conservative fallback: 24h
  return 86400;
}
```

**Wrong**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod } = req.body;

  // WRONG: Creating a Pix charge and immediately returning "approved"
  // The customer hasn't scanned the QR code yet — no money collected
  const pixCharge = await acquirer.createPixCharge(req.body);

  res.status(200).json({
    paymentId,
    status: "approved",  // WRONG — Pix hasn't been paid yet!
    authorizationId: pixCharge.id,
    nsu: null,
    tid: null,
    acquirer: "MyProvider",
    code: null,
    message: null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  });
}
```

### Constraint: MUST use callbackUrl from request — never hardcode

The connector MUST use the exact `callbackUrl` provided in the Create Payment request body, including all query parameters (`X-VTEX-signature`, etc.). The connector MUST NOT hardcode callback URLs or construct them manually.

**Why this matters**
The `callbackUrl` contains transaction-specific authentication tokens (`X-VTEX-signature`) that the Gateway uses to validate the callback. A hardcoded or modified URL will be rejected by the Gateway, leaving the payment stuck in `undefined` status forever. The URL format may also change between environments (production vs sandbox).

**Detection**
If the connector hardcodes a callback URL string, constructs the URL manually, or strips query parameters from the `callbackUrl`, warn the developer. The `callbackUrl` must be stored and used exactly as received.

**Correct**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, callbackUrl } = req.body;

  // Store the exact callbackUrl from the request
  await store.save(paymentId, {
    paymentId,
    status: "undefined",
    callbackUrl,  // Stored exactly as received, including query params
  });

  // Return async "undefined" response (see previous constraint)
  res.status(200).json({
    paymentId,
    status: "undefined",
    authorizationId: null,
    nsu: null,
    tid: null,
    acquirer: "MyProvider",
    code: "PENDING",
    message: "Awaiting customer action",
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 86400,
  });
}

// When the acquirer webhook arrives, use the stored callbackUrl
async function handleAcquirerWebhook(req: Request, res: Response): Promise<void> {
  const { paymentReference, status } = req.body;

  const payment = await store.findByAcquirerRef(paymentReference);
  if (!payment) {
    res.status(404).send();
    return;
  }

  const pppStatus = status === "paid" ? "approved" : "denied";

  // Update local state first
  await store.updateStatus(payment.paymentId, pppStatus);

  // Use the EXACT stored callbackUrl — do not modify it
  await fetch(payment.callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY!,
      "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN!,
    },
    body: JSON.stringify({
      paymentId: payment.paymentId,
      status: pppStatus,
    }),
  });

  res.status(200).send();
}
```

**Wrong**
```typescript
// WRONG: Hardcoding callback URL — ignores X-VTEX-signature and environment
async function handleAcquirerWebhook(req: Request, res: Response): Promise<void> {
  const { paymentReference, status } = req.body;
  const payment = await store.findByAcquirerRef(paymentReference);

  // WRONG — hardcoded URL, missing X-VTEX-signature authentication
  await fetch("https://mystore.vtexpayments.com.br/api/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentId: payment.paymentId,
      status: status === "paid" ? "approved" : "denied",
    }),
  });

  res.status(200).send();
}
```

### Constraint: `inboundRequestsUrl` is server-to-server only — redirect flows need a custom public route

The `inboundRequestsUrl` provided by the PPP only accepts **POST requests from servers**. Browser GET redirects (e.g., user returning from PayPal, 3DS, or any external checkout) will receive a **400 Bad Request** from this URL.

For redirect-based payment flows, the connector MUST create a custom public route in the VTEX IO app to receive the browser redirect, then trigger the Gateway retry via the stored `callbackUrl`.

**Why this matters**

Many payment providers (PayPal, MercadoPago, bank redirects, 3DS) require the user's browser to redirect back to the merchant after completing payment. If the connector uses `inboundRequestsUrl` as the redirect target, the user sees a 400 error and the payment is never confirmed. This is a common and frustrating failure mode that is not documented in the standard PPP or PPF documentation.

**Detection**

If the connector uses `inboundRequestsUrl` as a `return_url` or `redirect_url` for an external payment provider that redirects the user's browser, STOP. Create a custom public route instead.

**Correct — custom route for redirect callback**

Step 1: Add the route in `service.json` (project root):

```json
{
  "memory": 256,
  "ttl": 10,
  "timeout": 10,
  "minReplicas": 2,
  "maxReplicas": 10,
  "routes": {
    "providerCallback": {
      "path": "/_v/my-connector/callback",
      "public": true
    }
  }
}
```

Step 2: Register the handler in `node/index.ts`:

```typescript
import { PaymentProviderService } from '@vtex/payment-provider'
import MyConnector from './connector'
import { Clients } from './clients'
import { callbackHandler } from './handlers/callback'

export default new PaymentProviderService({
  connector: MyConnector,
  clients: {
    implementation: Clients,
    options: { default: { retries: 2, timeout: 15000 } },
  },
  routes: {
    providerCallback: callbackHandler,
  },
})
```

Step 3: Implement the handler that receives the browser GET, updates state, and triggers the Gateway retry:

```typescript
// node/handlers/callback.ts
export async function callbackHandler(ctx: Context) {
  const { paymentId, cancel } = ctx.query
  const { vbase } = ctx.clients

  // Load the stored payment record
  const payment = await vbase.getJSON<PaymentRecord>('payments', paymentId as string)

  if (!payment) {
    ctx.status = 404
    ctx.body = 'Payment not found'
    return
  }

  // Update status based on user action
  if (cancel === 'true') {
    payment.status = 'user-cancelled'
  } else {
    payment.status = 'user-returned'
  }
  await vbase.saveJSON('payments', paymentId as string, payment)

  // Trigger Gateway retry — POST to the stored callbackUrl
  // This makes the Gateway re-call authorize(), which will read the updated status
  await fetch(payment.callbackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentId }),
  })

  // Redirect user back to VTEX checkout
  const returnUrl = payment.returnUrl || `https://${ctx.vtex.account}.myvtex.com/checkout`
  ctx.redirect(returnUrl)
}
```

Step 4: In `authorize()`, use the custom route as the return URL for the external provider:

```typescript
// Inside the PaymentProvider subclass
async authorize(authorization: AuthorizationRequest) {
  const vtexCtx = (this.context as any).vtex as { account: string; workspace: string }
  const account = vtexCtx?.account || ''
  const workspace = vtexCtx?.workspace || 'master'
  const workspacePrefix = workspace !== 'master' ? `${workspace}--` : ''
  const callbackBase = `https://${workspacePrefix}${account}.myvtex.com/_v/my-connector/callback`

  // Use YOUR custom route as the return URL — not inboundRequestsUrl
  const returnUrl = `${callbackBase}?paymentId=${authorization.paymentId}`
  const cancelUrl = `${callbackBase}?paymentId=${authorization.paymentId}&cancel=true`

  // Create the payment at the external provider with these URLs
  const externalOrder = await this.clients.psp.createOrder({
    amount: authorization.value,
    return_url: returnUrl,
    cancel_url: cancelUrl,
  })

  // Store the callbackUrl and return undefined status with paymentUrl
  await this.vbase.saveJSON('payments', authorization.paymentId, {
    status: 'pending',
    callbackUrl: authorization.callbackUrl,
    returnUrl: authorization.returnUrl,
    externalOrderId: externalOrder.id,
  })

  return {
    paymentId: authorization.paymentId,
    status: 'undefined',
    paymentUrl: externalOrder.checkoutUrl,  // User is redirected here
    // ... other required fields
  }
}
```

**Wrong**

```typescript
// WRONG — using inboundRequestsUrl as browser redirect target
async authorize(authorization: AuthorizationRequest) {
  const externalOrder = await this.clients.psp.createOrder({
    amount: authorization.value,
    // inboundRequestsUrl only accepts POST from servers — browser GET returns 400
    return_url: authorization.inboundRequestsUrl,
  })

  return {
    paymentId: authorization.paymentId,
    status: 'undefined',
    paymentUrl: externalOrder.checkoutUrl,
  }
}
```

### Constraint: MUST be ready for repeated Create Payment calls (idempotent, but status can evolve)

The connector MUST handle the Gateway calling Create Payment (POST `/payments`) with the same `paymentId` multiple times during the retry window. Each call MUST not create a new charge at the acquirer, must return a response based on the locally persisted state for that `paymentId`, and must reflect the current status (`"undefined"`, `"approved"`, or `"denied"`) which may have changed after a callback.

Idempotency is about side effects on the acquirer: the first call creates the charge, retries MUST NOT call the acquirer again. For async methods, the response status may legitimately evolve from `"undefined"` to `"approved"` or `"denied"`, but only because your local store was updated by the webhook.

**Why this matters**
The Gateway retries `POST /payments` for `undefined` payments automatically for up to 7 days. If the connector treats each call as a new payment, it will create duplicate charges at the acquirer. If the connector always returns the original `"undefined"` response without checking for an updated status, the Gateway never learns that the payment was approved, and eventually cancels it.

**Detection**
If the Create Payment handler does not check for an existing `paymentId` before calling the acquirer, or always returns the original response without looking at the current status in storage, the agent MUST stop and guide the developer to implement proper idempotency with status evolution based on stored state only.

**Correct**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  // Check for existing payment — may have been updated via callback
  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    // Do NOT call the acquirer again.
    // Return a response derived from the current stored state.
    res.status(200).json({
      ...existing.response,
      status: existing.status,  // Reflect the latest state: "undefined" | "approved" | "denied"
    });
    return;
  }

  // First time — call the acquirer once
  const asyncMethods = ["BankInvoice", "Pix"];
  const isAsync = asyncMethods.includes(paymentMethod);

  const acquirerResult = await acquirer.authorize(req.body);

  const initialStatus = isAsync ? "undefined" : acquirerResult.status;

  const response = {
    paymentId,
    status: initialStatus,
    authorizationId: acquirerResult.authorizationId ?? null,
    nsu: acquirerResult.nsu ?? null,
    tid: acquirerResult.tid ?? null,
    acquirer: "MyProvider",
    code: acquirerResult.code ?? null,
    message: acquirerResult.message ?? null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: isAsync
      ? computeDelayToCancel(paymentMethod, acquirerResult)
      : 21600,
    ...(acquirerResult.paymentUrl
      ? { paymentUrl: acquirerResult.paymentUrl }
      : {}),
  };

  await store.save(paymentId, {
    paymentId,
    status: initialStatus,
    response,
    callbackUrl,
    acquirerReference: acquirerResult.reference,
  });

  res.status(200).json(response);
}
```

**Wrong**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  // WRONG: No idempotency — every retry hits the acquirer again
  const result = await acquirer.authorize(req.body);

  res.status(200).json({
    paymentId,
    status: result.status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: null,
    message: null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  });
}
```

### Constraint: MUST align `delayToCancel` with payment validity (not always 7 days)

For asynchronous methods, the `delayToCancel` field in the Create Payment response MUST represent how long that payment is considered valid for the shopper. It defines when the Gateway is allowed to automatically cancel payments that never reached a final status.

Rules:
- Pix: `delayToCancel` MUST be between 900 and 3600 seconds (15–60 minutes). This value MUST match the QR code validity configured on the provider.
- BankInvoice (Boleto): `delayToCancel` MUST be computed from the configured due date / payment deadline (for example, seconds until invoice due date). It MUST NOT be hardcoded to 7 days just to "match" the Gateway's internal retry window.
- Other async methods: `delayToCancel` MUST follow the expiry SLA defined by the provider (hours or days, as applicable). It MUST NEVER exceed the actual validity of the underlying payment from the provider's perspective.

The 7‑day window is an internal Gateway safety limit for retries on `undefined` status. It does not mean every async method should use `delayToCancel = 604800`.

**Why this matters**
For Pix, using a multi‑day `delayToCancel` keeps orders stuck in "Authorizing" with expired QR codes, creating poor UX and operational noise. For Boleto, cancelling before the real due date loses sales; cancelling much later creates reconciliation risk and "zombie" orders. Misaligned `delayToCancel` breaks the consistency between the provider's notion of a valid payment and when VTEX auto‑cancels the payment.

**Detection**
If the connector always uses `delayToCancel = 604800` for any async method, or sets `delayToCancel` greater than the Pix or Boleto validity window, the agent MUST warn that `delayToCancel` is misconfigured.

**Correct**

(See the `computeDelayToCancel` function in the "MUST return undefined" example above.)

**Wrong**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  const isAsync = ["BankInvoice", "Pix"].includes(paymentMethod);

  if (isAsync) {
    const pending = await acquirer.initiateAsyncPayment(req.body);

    await store.save(paymentId, {
      paymentId,
      status: "undefined",
      callbackUrl,
      acquirerReference: pending.reference,
    });

    res.status(200).json({
      paymentId,
      status: "undefined",
      authorizationId: pending.authorizationId ?? null,
      nsu: pending.nsu ?? null,
      tid: pending.tid ?? null,
      acquirer: "MyProvider",
      code: "PENDING",
      message: "Awaiting customer action",
      delayToAutoSettle: 21600,
      delayToAutoSettleAfterAntifraud: 1800,
      // WRONG: hardcoded 7 days for every async method
      delayToCancel: 604800,
      paymentUrl: pending.qrCodeUrl ?? pending.boletoUrl ?? undefined,
    });

    return;
  }

  // ...
}
```

## Preferred pattern

Data flow for non-VTEX IO (notification callback):

```text
1. Gateway → POST /payments → Connector (returns status: "undefined")
2. Acquirer webhook → Connector (payment confirmed)
3. Connector → POST callbackUrl (with X-VTEX-API-AppKey/AppToken headers)
4. Gateway updates payment status to approved/denied
```

Data flow for VTEX IO (retry callback):

```text
1. Gateway → POST /payments → Connector (returns status: "undefined")
2. Acquirer webhook → Connector (payment confirmed)
3. Connector → POST callbackUrl (retry, no payload)
4. Gateway → POST /payments → Connector (returns status: "approved"/"denied")
```

Data flow for redirect-based flows on VTEX IO:

```text
1. Gateway → POST /payments → Connector (returns status: "undefined" + paymentUrl)
2. Checkout redirects user to paymentUrl (external provider)
3. User completes payment on external site
4. External provider redirects user's browser to custom route (/_v/connector/callback?paymentId=...)
5. Custom route handler updates VBase status, POSTs to callbackUrl
6. Gateway → POST /payments → Connector (reads updated status, returns "approved"/"denied")
7. Custom route redirects user back to VTEX checkout
```

Status evolution in VBase for redirect flows:

```text
pending → (user completes on external site) → user-returned → (authorize re-called) → approved
pending → (user cancels on external site)   → user-cancelled → (authorize re-called) → denied
```

Classify payment methods:

```typescript
const ASYNC_PAYMENT_METHODS = new Set([
  "BankInvoice",   // Boleto Bancário
  "Pix",           // Pix instant payments
]);

function isAsyncPaymentMethod(paymentMethod: string): boolean {
  return ASYNC_PAYMENT_METHODS.has(paymentMethod);
}
```

Acquirer webhook handler with callback notification (non-VTEX IO):

```typescript
async function handleAcquirerWebhook(req: Request, res: Response): Promise<void> {
  const webhookData = req.body;
  const acquirerRef = webhookData.transactionId;

  const payment = await store.findByAcquirerRef(acquirerRef);
  if (!payment || !payment.callbackUrl) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  const pppStatus = webhookData.status === "paid" ? "approved" : "denied";

  // Update local state FIRST
  await store.updateStatus(payment.paymentId, pppStatus);

  // Notify the Gateway via callbackUrl with retry logic
  await notifyGateway(payment.callbackUrl, {
    paymentId: payment.paymentId,
    status: pppStatus,
  });

  res.status(200).json({ received: true });
}
```

Callback retry with exponential backoff:

```typescript
async function notifyGateway(callbackUrl: string, payload: object): Promise<void> {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY!,
          "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN!,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) return;
      console.error(`Callback attempt ${attempt + 1} failed: ${response.status}`);
    } catch (error) {
      console.error(`Callback attempt ${attempt + 1} error:`, error);
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, attempt)));
    }
  }

  // All retries failed — Gateway will still retry via /payments as safety net
  console.error("All callback retries exhausted. Relying on Gateway retry.");
}
```

## Common failure modes

- **Synchronous approval of async payments** — Returning `status: "approved"` for Pix or Boleto because the QR code or slip was generated successfully. Generating a QR code is not the same as receiving payment. The order ships without money collected.
- **Using `inboundRequestsUrl` as a browser redirect target** — The `inboundRequestsUrl` only accepts server-to-server POST. Browser GET redirects (from PayPal, 3DS, etc.) return 400 Bad Request. Create a custom public route (`/_v/{connector}/callback`) instead.
- **Ignoring the callbackUrl** — Not storing the `callbackUrl` from the Create Payment request and relying entirely on the Gateway's automatic retries. The retry interval increases over time, causing long delays between payment and order approval. Worst case: the 7-day window expires and the payment is cancelled even though the customer paid.
- **Hardcoding callback URLs** — Constructing callback URLs manually instead of using the one from the request, stripping the `X-VTEX-signature` parameter. The Gateway rejects the callback and the payment stays stuck in `undefined`.
- **No retry logic for failed callbacks** — Calling the `callbackUrl` once and silently dropping the notification on failure. The Gateway never learns the payment was approved, and the payment sits in `undefined` until the next retry or is auto-cancelled.
- **Returning stale status on retries** — Always returning the original `undefined` response without checking if the status was updated via callback. The Gateway never sees the `approved` status and eventually cancels the payment.
- **Misaligned `delayToCancel`** — Using 7 days for Pix, leaving expired QR codes with orders stuck in "Authorizing". Using arbitrary values for Boleto that do not match invoice due dates.
- **Missing `service.json` or route registration for custom callback** — The custom route exists in code but is not declared in `service.json` or not passed via `routes` in `PaymentProviderService`, so VTEX IO never exposes it.
- **Wrong `this.context` access for building callback URLs** — Using `this.context.account` instead of `this.context.vtex.account` in the PPF. See the [`payment-provider-framework`](../payment-provider-framework/skill.md) skill for the correct IOContext access pattern.

## Review checklist

- [ ] Do async payment methods (Boleto, Pix) return `status: "undefined"` in Create Payment?
- [ ] Is the `callbackUrl` stored exactly as received from the request (including all query params)?
- [ ] Does the webhook handler update local state before calling the `callbackUrl`?
- [ ] Is `X-VTEX-signature` preserved in the `callbackUrl` when calling it?
- [ ] Are `X-VTEX-API-AppKey` and `X-VTEX-API-AppToken` headers included in notification callbacks (non-VTEX IO)?
- [ ] Is there retry logic with exponential backoff for failed callback calls?
- [ ] Does the Create Payment handler check for an existing `paymentId`, avoid calling the acquirer again for retries, and return a response derived from the current stored state (status may evolve from `"undefined"` to `"approved"`/`"denied"` after callback)?
- [ ] For Pix, is `delayToCancel` between 900 and 3600 seconds (15–60 minutes), aligned with QR code validity?
- [ ] For BankInvoice (Boleto), does `delayToCancel` reflect the real payment deadline / due date configured in the provider?
- [ ] For other async methods, is `delayToCancel` aligned with the provider's documented expiry SLA (and never greater than the actual payment validity)?
- [ ] For redirect-based flows: is a custom public route used instead of `inboundRequestsUrl`?
- [ ] Is the custom route declared in `service.json` and registered in `PaymentProviderService` routes?
- [ ] Does the redirect handler update state in VBase, POST to callbackUrl, and redirect the user back to checkout?

## Related skills

- [`payment-provider-framework`](../payment-provider-framework/skill.md) — PPF IO wiring, `service.json`, custom routes, IOContext access, and `PaymentProviderService` configuration
- [`payment-provider-protocol`](../payment-provider-protocol/skill.md) — Endpoint contracts and response shapes
- [`payment-idempotency`](../payment-idempotency/skill.md) — `paymentId`/`requestId` idempotency and state machine
- [`payment-pci-security`](../payment-pci-security/skill.md) — PCI compliance and Secure Proxy

## Reference

- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Detailed explanation of the `undefined` status, callback URL notification and retry flows, and the 7-day retry window
- [Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows) — Authorization flow documentation including async retry mechanics and callback URL behavior for VTEX IO vs non-VTEX IO
- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Endpoint-level implementation guide with callbackUrl and returnUrl usage
- [Pix: Instant Payments in Brazil](https://developers.vtex.com/docs/guides/payments-integration-pix-instant-payments-in-brazil) — Pix-specific async flow implementation including QR code generation and callback handling
- [Callback URL Signature Authentication](https://help.vtex.com/en/announcements/2024-05-03-callback-url-signature-authentication-token) — Mandatory X-VTEX-signature requirement for callback URL authentication (effective June 2024)
- [Payment Provider Protocol API Reference](https://developers.vtex.com/docs/api-reference/payment-provider-protocol) — Full API specification with callbackUrl field documentation

---

# Idempotency & Duplicate Prevention

## When this skill applies

Use this skill when:
- Implementing any PPP endpoint handler that processes payments, cancellations, captures, or refunds
- Ensuring repeated Gateway calls with the same identifiers produce identical results without re-processing
- Building a payment state machine to prevent invalid transitions (e.g., capturing a cancelled payment)
- Handling the Gateway's 7-day retry window for `undefined` status payments

Do not use this skill for:
- PPP endpoint response shapes and HTTP methods — use [`payment-provider-protocol`](../payment-provider-protocol/skill.md)
- Async callback URL notification logic — use [`payment-async-flow`](../payment-async-flow/skill.md)
- PCI compliance and Secure Proxy — use [`payment-pci-security`](../payment-pci-security/skill.md)

## Decision rules

- Use `paymentId` as the idempotency key for Create Payment — every call with the same `paymentId` must return the same result.
- Use `requestId` as the idempotency key for Cancel, Capture, and Refund operations.
- If the Gateway sends a second Create Payment with the same `paymentId`, return the stored response without calling the acquirer again.
- Async payment methods (Boleto, Pix) MUST return `status: "undefined"` — never `"approved"` until the acquirer confirms.
- A payment moves through defined states: `undefined` → `approved` → `settled`, or `undefined` → `denied`, or `approved` → `cancelled`. Enforce valid transitions only.
- Use a persistent data store (PostgreSQL, DynamoDB, VBase for VTEX IO) — never in-memory storage that is lost on restart.

## Hard constraints

### Constraint: MUST use paymentId as idempotency key for Create Payment

The connector MUST check for an existing record with the given `paymentId` before processing a new payment. If a record exists, return the stored response without calling the acquirer again.

**Why this matters**
The VTEX Gateway retries Create Payment requests with `undefined` status for up to 7 days. Without idempotency on `paymentId`, each retry creates a new charge at the acquirer, resulting in duplicate charges to the customer. This is a financial loss and a critical production incident.

**Detection**
If the Create Payment handler does not check for an existing `paymentId` before processing, STOP. The handler must query the data store for the `paymentId` first.

**Correct**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  // Check for existing payment — idempotency guard
  const existingPayment = await paymentStore.findByPaymentId(paymentId);
  if (existingPayment) {
    // Return the exact same response — no new acquirer call
    res.status(200).json(existingPayment.response);
    return;
  }

  // First time seeing this paymentId — process with acquirer
  const result = await acquirer.authorize(req.body);

  const response = {
    paymentId,
    status: result.status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: result.code ?? null,
    message: result.message ?? null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  };

  // Store the response for future idempotent lookups
  await paymentStore.save(paymentId, { request: req.body, response });

  res.status(200).json(response);
}
```

**Wrong**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  // No idempotency check — every call hits the acquirer
  // If the Gateway retries this (which it will for undefined status),
  // the customer gets charged multiple times
  const result = await acquirer.authorize(req.body);

  res.status(200).json({
    paymentId,
    status: result.status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: null,
    message: null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  });
}
```

### Constraint: MUST return identical response for duplicate requests

When the connector receives a Create Payment request with a `paymentId` that already exists in the data store, it MUST return the exact stored response. It MUST NOT create a new record, generate new identifiers, or re-process the payment.

**Why this matters**
The Gateway uses the response fields (`authorizationId`, `tid`, `nsu`, `status`) to track the transaction. If a retry returns different values, the Gateway loses track of the original transaction, causing reconciliation failures and potential double settlements.

**Detection**
If the handler creates a new database record or generates new identifiers when it finds an existing `paymentId`, STOP. The handler must return the previously stored response verbatim.

**Correct**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  const existing = await paymentStore.findByPaymentId(paymentId);
  if (existing) {
    // Return the EXACT stored response — same authorizationId, tid, nsu, status
    res.status(200).json(existing.response);
    return;
  }

  // ... process new payment and store response
}
```

**Wrong**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  const existing = await paymentStore.findByPaymentId(paymentId);
  if (existing) {
    // WRONG: Generating new identifiers for an existing payment
    // The Gateway will see different tid/nsu and lose track of the transaction
    const newTid = generateNewTid();
    res.status(200).json({
      ...existing.response,
      tid: newTid,  // Different from original — breaks reconciliation
      nsu: generateNewNsu(),
    });
    return;
  }

  // ... process new payment
}
```

### Constraint: MUST NOT approve async payments synchronously

If a payment method is asynchronous (e.g., Boleto, Pix, bank redirect), the Create Payment response MUST return `status: "undefined"`. It MUST NOT return `status: "approved"` or `status: "denied"` until the payment is actually confirmed or rejected by the acquirer.

**Why this matters**
Returning `approved` for an async method tells the Gateway the payment is confirmed before the customer has actually paid. The order ships, but no money was collected. The merchant loses the product and the revenue. The correct flow is to return `undefined` and use the `callbackUrl` to notify the Gateway when the payment is confirmed.

**Detection**
If the Create Payment handler returns `status: "approved"` or `status: "denied"` for an asynchronous payment method (Boleto, Pix, bank transfer, redirect-based), STOP. Async methods must return `"undefined"` and use callbacks.

**Correct**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  const isAsyncMethod = ["BankInvoice", "Pix"].includes(paymentMethod);

  if (isAsyncMethod) {
    const pending = await acquirer.initiateAsyncPayment(req.body);

    await paymentStore.save(paymentId, {
      status: "undefined",
      callbackUrl,
      acquirerRef: pending.reference,
    });

    res.status(200).json({
      paymentId,
      status: "undefined",  // Correct for async
      authorizationId: pending.authorizationId ?? null,
      nsu: pending.nsu ?? null,
      tid: pending.tid ?? null,
      acquirer: "MyProvider",
      code: "ASYNC-PENDING",
      message: "Awaiting customer payment",
      delayToAutoSettle: 21600,
      delayToAutoSettleAfterAntifraud: 1800,
      delayToCancel: 604800,  // 7 days for async
      paymentUrl: pending.paymentUrl,
    });
    return;
  }

  // Sync methods can return approved/denied immediately
  // ...
}
```

**Wrong**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod } = req.body;

  // WRONG: Approving a Pix payment synchronously
  // The customer hasn't paid yet — the order will ship without payment
  const result = await acquirer.createPixCharge(req.body);

  res.status(200).json({
    paymentId,
    status: "approved",  // WRONG — Pix is async, should be "undefined"
    authorizationId: result.authorizationId ?? null,
    nsu: null,
    tid: null,
    acquirer: "MyProvider",
    code: null,
    message: null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  });
}
```

## Preferred pattern

Payment state store with idempotency support:

```typescript
interface PaymentRecord {
  paymentId: string;
  status: "undefined" | "approved" | "denied" | "cancelled" | "settled" | "refunded";
  response: Record<string, unknown>;
  callbackUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface OperationRecord {
  requestId: string;
  paymentId: string;
  operation: "cancel" | "capture" | "refund";
  response: Record<string, unknown>;
  createdAt: Date;
}
```

Idempotent Create Payment with state machine:

```typescript
const store = new PaymentStore();

async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  // Idempotency check
  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    res.status(200).json(existing.response);
    return;
  }

  const isAsync = ["BankInvoice", "Pix"].includes(paymentMethod);
  const result = await acquirer.process(req.body);

  const status = isAsync ? "undefined" : result.status;
  const response = {
    paymentId,
    status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: result.code ?? null,
    message: result.message ?? null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: isAsync ? 604800 : 21600,
    ...(result.paymentUrl ? { paymentUrl: result.paymentUrl } : {}),
  };

  await store.save(paymentId, {
    paymentId, status, response, callbackUrl,
    createdAt: new Date(), updatedAt: new Date(),
  });

  res.status(200).json(response);
}
```

Idempotent Cancel with `requestId` guard and state validation:

```typescript
async function cancelPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.params;
  const { requestId } = req.body;

  // Operation idempotency check
  const existingOp = await store.findOperation(requestId);
  if (existingOp) {
    res.status(200).json(existingOp.response);
    return;
  }

  // State machine validation
  const payment = await store.findByPaymentId(paymentId);
  if (!payment || !["undefined", "approved"].includes(payment.status)) {
    res.status(200).json({
      paymentId,
      cancellationId: null,
      code: "cancel-failed",
      message: `Cannot cancel payment in ${payment?.status ?? "unknown"} state`,
      requestId,
    });
    return;
  }

  const result = await acquirer.cancel(paymentId);
  const response = {
    paymentId,
    cancellationId: result.cancellationId ?? null,
    code: result.code ?? null,
    message: result.message ?? "Successfully cancelled",
    requestId,
  };

  await store.updateStatus(paymentId, "cancelled");
  await store.saveOperation(requestId, {
    requestId, paymentId, operation: "cancel", response, createdAt: new Date(),
  });

  res.status(200).json(response);
}
```

## Common failure modes

- **Processing duplicate payments** — Calling the acquirer for every Create Payment request without checking if the `paymentId` already exists. The Gateway retries `undefined` payments for up to 7 days, so a single $100 payment can result in hundreds of duplicate charges.
- **Synchronous approval of async payment methods** — Returning `status: "approved"` immediately for Boleto or Pix before the customer has actually paid. The order ships without payment collected.
- **Losing state between retries** — Storing payment state in memory (`Map`, local variable) instead of a persistent database. On process restart, all state is lost and the next retry creates a duplicate charge.
- **Generating new identifiers for duplicate requests** — Returning different `tid`, `nsu`, or `authorizationId` values when the Gateway retries with the same `paymentId`. This breaks Gateway reconciliation and can cause double settlements.
- **Ignoring requestId on Cancel/Capture/Refund** — Not checking `requestId` before processing operations, causing duplicate cancellations or refunds when the Gateway retries.

## Review checklist

- [ ] Does the Create Payment handler check the data store for an existing `paymentId` before calling the acquirer?
- [ ] Are stored responses returned verbatim for duplicate `paymentId` requests?
- [ ] Do Cancel, Capture, and Refund handlers check for existing `requestId` before processing?
- [ ] Is the payment state machine enforced (e.g., cannot capture a cancelled payment)?
- [ ] Do async payment methods (Boleto, Pix) return `status: "undefined"` instead of `"approved"`?
- [ ] Is payment state stored in a persistent database (not in-memory)?
- [ ] Are `delayToCancel` values extended for async methods (e.g., 604800 seconds = 7 days)?

## Related skills

- [`payment-provider-protocol`](../payment-provider-protocol/skill.md) — Endpoint contracts and response shapes
- [`payment-async-flow`](../payment-async-flow/skill.md) — Callback URL notification and the 7-day retry window
- [`payment-pci-security`](../payment-pci-security/skill.md) — PCI compliance and Secure Proxy
- [`vtex-io-application-performance`](../../../vtex-io/skills/vtex-io-application-performance/skill.md) — VBase write correctness (await in critical paths), per-client timeout/retry config, and caching rules for IO-based connectors

## Reference

- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Official guide explaining idempotency requirements for Cancel, Capture, and Refund operations
- [Developing a Payment Connector for VTEX](https://help.vtex.com/en/docs/tutorials/developing-a-payment-connector-for-vtex) — Help Center guide with idempotency implementation steps using paymentId and VBase
- [Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows) — Detailed authorization, capture, and cancellation flow documentation including retry behavior
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Protocol overview including callback URL retry mechanics and 7-day retry window
- [Payment Provider Protocol API Reference](https://developers.vtex.com/docs/api-reference/payment-provider-protocol) — Full API specification with requestId and paymentId field definitions

---

# PCI Compliance & Secure Proxy

## When this skill applies

Use this skill when:

- Building a payment connector that accepts credit cards, debit cards, or co-branded cards
- The connector needs to process card data or communicate with an acquirer
- Determining whether Secure Proxy is required for the hosting environment
- Auditing a connector for PCI DSS compliance (data storage, logging, transmission)

Do not use this skill for:

- PPP endpoint contracts and response shapes — use [`payment-provider-protocol`](../payment-provider-protocol/skill.md)
- Idempotency and duplicate prevention — use [`payment-idempotency`](../payment-idempotency/skill.md)
- Async payment flows (Boleto, Pix) and callbacks — use [`payment-async-flow`](../payment-async-flow/skill.md)

## Decision rules

- If the connector is hosted in a non-PCI environment (including all VTEX IO apps), it MUST use Secure Proxy.
- If the connector has PCI DSS certification (AOC signed by a QSA), it can call the acquirer directly with raw card data.
- Check for `secureProxyUrl` in the Create Payment request — if present, Secure Proxy is active and MUST be used.
- **`secureProxyUrl` is only present in the Create Payment (authorize) request.** Cancel, capture, settle, and refund operations do not carry card data and do not receive this field. Post-authorization calls go directly to the PSP API using credentials and `outbound-access` policies — this does not reduce PCI compliance because no card data is involved in those operations.
- Card tokens (`numberToken`, `holderToken`, `cscToken`) are only valid when sent through the `secureProxyUrl` — the proxy replaces them with real data before forwarding to the acquirer.
- Only `card.bin` (first 6 digits), `card.numberLength`, and `card.expiration` may be stored. Everything else is forbidden.
- Card data must never appear in logs, databases, files, caches, error trackers, or APM tools — even in development.

## Hard constraints

### Constraint: MUST use secureProxyUrl for non-PCI environments

If the connector is hosted in a non-PCI environment (including all VTEX IO apps), it MUST use the `secureProxyUrl` from the Create Payment request to communicate with the acquirer. It MUST NOT call the acquirer directly with raw card data. If a `secureProxyUrl` field is present in the request, Secure Proxy is active and MUST be used.

**Why this matters**
Non-PCI environments are not authorized to handle raw card data. Calling the acquirer directly bypasses the Gateway's secure data handling, violating PCI DSS. This can result in data breaches, massive fines ($100K+ per month), loss of card processing ability, and legal liability.

**Detection**
If the connector calls an acquirer endpoint directly (without going through `secureProxyUrl`) when `secureProxyUrl` is present in the request, STOP immediately. All acquirer communication must go through the Secure Proxy.

**Correct**

```typescript
async function createPaymentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { paymentId, secureProxyUrl, card } = req.body;

  if (secureProxyUrl) {
    // Non-PCI: Route through Secure Proxy
    const acquirerResponse = await fetch(secureProxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PROVIDER-Forward-To": "https://api.acquirer.com/v2/payments",
        "X-PROVIDER-Forward-MerchantId": process.env.ACQUIRER_MERCHANT_ID!,
        "X-PROVIDER-Forward-MerchantKey": process.env.ACQUIRER_MERCHANT_KEY!,
      },
      body: JSON.stringify({
        orderId: paymentId,
        payment: {
          cardNumber: card.numberToken, // Token, not real number
          holder: card.holderToken, // Token, not real name
          securityCode: card.cscToken, // Token, not real CVV
          expirationMonth: card.expiration.month,
          expirationYear: card.expiration.year,
        },
      }),
    });

    const result = await acquirerResponse.json();
    // Build and return PPP response...
  }
}
```

**Wrong**

```typescript
async function createPaymentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { paymentId, secureProxyUrl, card } = req.body;

  // WRONG: Calling acquirer directly, bypassing Secure Proxy
  // This connector is non-PCI but handles card data as if it were PCI-certified
  const acquirerResponse = await fetch("https://api.acquirer.com/v2/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      MerchantId: process.env.ACQUIRER_MERCHANT_ID!,
    },
    body: JSON.stringify({
      orderId: paymentId,
      payment: {
        // These are tokens but sent directly to acquirer — acquirer can't read tokens!
        // And if raw data were here, this would be a PCI violation
        cardNumber: card.numberToken,
        holder: card.holderToken,
        securityCode: card.cscToken,
      },
    }),
  });

  // This request will fail: acquirer receives tokens instead of real card data
  // And the Secure Proxy was completely bypassed
}
```

### Constraint: Secure Proxy applies ONLY to card authorization — not to post-auth operations

The `secureProxyUrl` field is present **only in the Create Payment request** (card authorization). Cancel, capture (settle), and refund requests do **not** include `secureProxyUrl` because they do not involve card data — they reference the transaction by `tid`, `authorizationId`, or `paymentId`.

Post-authorization calls MUST go directly to the PSP API using an `ExternalClient` with API credentials, authorized via `outbound-access` policies in `manifest.json`.

**Why this matters**

Attempting to route cancel/capture/refund through Secure Proxy will fail because `secureProxyUrl` is `undefined` in those requests. Architecturally, there is no PCI concern — only the authorization carries sensitive card data. Agents and developers who assume all PSP communication must go through Secure Proxy waste significant time debugging `undefined` proxy URLs.

**Detection**

If cancel, capture, or refund handlers reference `secureProxyUrl`, use `SecureExternalClient`, or attempt to route through Secure Proxy, STOP. Use `ExternalClient` with direct API calls for post-auth operations.

**Correct — two-client architecture**

```typescript
// Authorization (Create Payment) — via Secure Proxy
import { SecureExternalClient } from "@vtex/payment-provider";

export class PspSecureClient extends SecureExternalClient {
  public async authorize(data: object, secureProxyUrl: string) {
    return this.http.post("/payments", data, {
      secureProxy: secureProxyUrl,
    } as any);
  }
}

// Cancel, Capture, Refund — direct API calls
import { ExternalClient } from "@vtex/api";

export class PspClient extends ExternalClient {
  public async capture(tid: string, amount: number) {
    return this.http.post(
      `/payments/${tid}/capture`,
      { amount },
      {
        headers: { "X-API-Key": "..." },
      },
    );
  }
}
```

**Wrong**

```typescript
// WRONG — trying to use SecureExternalClient for all operations
async settle(request: SettlementRequest) {
  // secureProxyUrl does not exist on SettlementRequest — this is undefined
  await this.secureClient.capture(request.tid, request.value, request.secureProxyUrl)
}
```

### Constraint: Headless storefront BFFs MUST NOT proxy card data to vtexpayments.com.br

In a headless storefront, the Send payments information call (`POST https://{account}.vtexpayments.com.br/api/pub/transactions/{tid}/payments`) MUST originate from the shopper's browser or native app. The merchant's BFF (Node, Next.js route handler, edge function, lambda, reverse proxy, or any server-side component) MUST NOT receive card fields from the browser and MUST NOT forward them to the Payment Gateway, even with redaction, even with `appKey`/`appToken` on the server side, and even when only "tokenized" fields appear to be forwarded.

This constraint extends the same PCI principle that drives Secure Proxy: a non-PCI environment is not allowed to handle card data. For payment connectors that environment is the IO app; for headless storefronts it is the merchant BFF. The destination differs — Secure Proxy protects the connector → acquirer path, the browser → `vtexpayments.com.br` pattern protects the storefront → Payment Gateway path — but the rule is identical: keep raw card data inside the certified perimeter.

**Why this matters**

The merchant operating the headless storefront is rarely PCI DSS Level 1 certified. Routing card numbers, holder names, or CVV through the merchant's BFF places the BFF and every system it touches (application logs, APM, reverse proxies, load balancers, error trackers) inside PCI scope. Operating a non-PCI environment that handles card data violates PCI DSS Requirements 3 and 4 and can result in fines from $5,000 to over $100,000 per month from card networks, mandatory forensic investigation costs, loss of card processing ability, class-action exposure, and criminal liability in some jurisdictions.

The VTEX Payment Gateway (`vtexpayments.com.br`) is PCI DSS Level 1 certified. The browser → Payment Gateway path keeps card data inside the certified perimeter; the merchant BFF stays out of the card-data flow entirely. The Send payments information endpoint is authenticated by the shopper's session cookies set during the previous Place Order step — no merchant credentials are required for this hop.

**Detection**

If you find any of the following in BFF / server-side code (`server/`, `bff/`, `api/`, route handlers, middleware, edge functions, lambdas), STOP immediately:

- A request from the BFF to `https://*.vtexpayments.com.br/api/pub/transactions/.../payments`,
- A handler that accepts `cardNumber`, `holderName`, `validationCode`, `csc`, `dueDate`, or full payment `fields` from the browser,
- A "Payments client" / `ExternalClient` / `axios` instance on the server pointing at `vtexpayments.com.br` for the Send payments information endpoint.

The BFF should expose `/api/bff/order/place` (returns `transactionId`, `orderGroup`, `merchantName`) and `/api/bff/order/process` (calls `/api/checkout/pub/gatewayCallback/{orderGroup}` — no card data) but never an endpoint that forwards card fields to `vtexpayments.com.br`.

**Correct**

```typescript
async function sendPaymentDataDirect(args: {
  account: string;
  transactionId: string;
  orderGroup: string;
  merchantName: string;
  paymentInformation: PaymentField[];
}): Promise<void> {
  const {
    account,
    transactionId,
    orderGroup,
    merchantName,
    paymentInformation,
  } = args;

  const response = await fetch(
    `https://${account}.vtexpayments.com.br/api/pub/transactions/${transactionId}/payments?orderId=${orderGroup}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        paymentInformation.map((p) => ({
          ...p,
          transaction: { id: transactionId, merchantName },
        })),
      ),
    },
  );

  if (!response.ok) {
    throw new Error(`Payment submission failed: ${response.status}`);
  }
}
```

**Wrong**

```typescript
const VTEX_APP_KEY = process.env.VTEX_APP_KEY!;
const VTEX_APP_TOKEN = process.env.VTEX_APP_TOKEN!;

paymentRoutes.post("/", async (req: Request, res: Response) => {
  const { transactionId, orderGroup, paymentInformation } = req.body as {
    transactionId: string;
    orderGroup: string;
    paymentInformation: Array<{
      paymentSystem: number;
      installments: number;
      value: number;
      fields: {
        cardNumber: string;
        holderName: string;
        validationCode: string;
        dueDate: string;
      };
    }>;
  };

  const url = `https://${process.env.VTEX_ACCOUNT}.vtexpayments.com.br/api/pub/transactions/${transactionId}/payments?orderId=${orderGroup}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-API-AppKey": VTEX_APP_KEY,
      "X-VTEX-API-AppToken": VTEX_APP_TOKEN,
    },
    body: JSON.stringify(paymentInformation),
  });

  res.json({ status: response.status });
});
```

### Constraint: MUST NOT store raw card data

The connector MUST NOT store the full card number (PAN), CVV/CSC, cardholder name, or any card token values in any persistent storage — database, file system, cache, session store, or any other durable medium. Card data must only exist in memory during the request lifecycle.

**Why this matters**
Storing raw card data violates PCI DSS Requirement 3. A data breach exposes customers to fraud. Consequences include fines of $5,000–$100,000 per month from card networks, mandatory forensic investigation costs ($50K+), loss of ability to process cards, class-action lawsuits, and criminal liability in some jurisdictions.

**Detection**
If the code writes card number, CVV, cardholder name, or token values to a database, file, cache (Redis, VBase), or any persistent store, STOP immediately. Only `card.bin` (first 6 digits) and `card.numberLength` may be stored.

**Correct**

```typescript
async function createPaymentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { paymentId, card, secureProxyUrl } = req.body;

  // Only store non-sensitive card metadata
  await paymentStore.save(paymentId, {
    paymentId,
    cardBin: card.bin, // First 6 digits — safe to store
    cardNumberLength: card.numberLength, // Length — safe to store
    cardExpMonth: card.expiration.month, // Expiration — safe to store
    cardExpYear: card.expiration.year,
    // DO NOT store: card.numberToken, card.holderToken, card.cscToken
  });

  // Use card tokens only in-memory for the Secure Proxy call
  const acquirerResult = await callAcquirerViaProxy(secureProxyUrl, card);

  // Return response — card data is now out of scope
  res.status(200).json(buildResponse(paymentId, acquirerResult));
}
```

**Wrong**

```typescript
async function createPaymentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { paymentId, card } = req.body;

  // CRITICAL PCI VIOLATION: Storing full card data in database
  await database.query(
    `INSERT INTO payments (payment_id, card_number, cvv, holder_name)
     VALUES ($1, $2, $3, $4)`,
    [paymentId, card.number, card.csc, card.holder],
  );
  // This single line can result in:
  // - $100K/month fines from card networks
  // - Mandatory forensic audit ($50K+)
  // - Loss of card processing ability
  // - Criminal liability
}
```

### Constraint: MUST NOT log sensitive card data

The connector MUST NOT log card numbers, CVV/CSC values, cardholder names, or token values to any logging system — console, file, monitoring service, error tracker, or APM tool. Even in debug mode. Even in development.

**Why this matters**
Logs are typically stored in plaintext, retained for extended periods, and accessible to many team members. Card data in logs is a PCI DSS violation and a data breach. Log aggregation services (Datadog, Splunk, CloudWatch) may store data across multiple regions, amplifying the breach scope.

**Detection**
If the code contains `console.log`, `console.error`, `logger.info`, `logger.debug`, or any logging call that includes `card.number`, `card.csc`, `card.holder`, `card.numberToken`, `card.holderToken`, `card.cscToken`, or the full request body without redaction, STOP immediately. Redact or omit all sensitive fields before logging.

**Correct**

```typescript
async function createPaymentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { paymentId, card, paymentMethod, value } = req.body;

  // Safe logging — only non-sensitive fields
  console.log("Processing payment", {
    paymentId,
    paymentMethod,
    value,
    cardBin: card?.bin, // First 6 digits only — safe
    cardNumberLength: card?.numberLength, // Safe
  });

  // NEVER log the full request body for payment requests
  // It contains card tokens or raw card data
}

function redactSensitiveFields(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const redacted = { ...body };
  if (redacted.card && typeof redacted.card === "object") {
    const card = redacted.card as Record<string, unknown>;
    redacted.card = {
      bin: card.bin,
      numberLength: card.numberLength,
      expiration: card.expiration,
      // All other fields redacted
    };
  }
  return redacted;
}
```

**Wrong**

```typescript
async function createPaymentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  // CRITICAL PCI VIOLATION: Logging the entire request body
  // This includes card number, CVV, holder name, and/or token values
  console.log("Payment request received:", JSON.stringify(req.body));

  // ALSO WRONG: Logging specific card fields
  console.log("Card number:", req.body.card.number);
  console.log("CVV:", req.body.card.csc);
  console.log("Card holder:", req.body.card.holder);

  // ALSO WRONG: Logging tokens (they reference real card data)
  console.log("Card token:", req.body.card.numberToken);
}
```

## Preferred pattern

Secure Proxy data flow:

```text
1. Gateway → POST /payments (with secureProxyUrl + tokenized card data) → Connector
2. Connector → POST secureProxyUrl (tokens in body, X-PROVIDER-Forward-To: acquirer URL) → Gateway
3. Gateway replaces tokens with real card data → POST acquirer URL → Acquirer
4. Acquirer → response → Gateway → Connector
5. Connector → Create Payment response → Gateway
```

Post-authorization data flow (no Secure Proxy):

```text
1. Gateway → POST /payments/{id}/settlements → Connector
2. Connector → POST acquirer API directly (tid + amount, no card data) → Acquirer
3. Acquirer → response → Connector
4. Connector → Settlement response → Gateway
```

Detect Secure Proxy mode:

```typescript
interface CreatePaymentRequest {
  paymentId: string;
  value: number;
  currency: string;
  paymentMethod: string;
  card?: {
    holder?: string; // Raw (PCI) or absent (Secure Proxy)
    holderToken?: string; // Token (Secure Proxy only)
    number?: string; // Raw (PCI) or absent (Secure Proxy)
    numberToken?: string; // Token (Secure Proxy only)
    bin: string; // Always present — first 6 digits
    numberLength: number; // Always present
    csc?: string; // Raw (PCI) or absent (Secure Proxy)
    cscToken?: string; // Token (Secure Proxy only)
    expiration: { month: string; year: string };
  };
  secureProxyUrl?: string; // Present when Secure Proxy is active
  secureProxyTokensURL?: string; // For custom token operations
  callbackUrl: string;
  miniCart: Record<string, unknown>;
}

function isSecureProxyActive(req: CreatePaymentRequest): boolean {
  return !!req.secureProxyUrl;
}
```

Build acquirer request using tokens or raw values:

```typescript
function buildAcquirerRequest(paymentReq: CreatePaymentRequest) {
  const card = paymentReq.card!;

  return {
    merchantOrderId: paymentReq.paymentId,
    payment: {
      // Use tokens if Secure Proxy, raw values if PCI-certified
      cardNumber: card.numberToken ?? card.number!,
      holder: card.holderToken ?? card.holder!,
      securityCode: card.cscToken ?? card.csc!,
      expirationDate: `${card.expiration.month}/${card.expiration.year}`,
      amount: paymentReq.value,
    },
  };
}
```

Call acquirer through Secure Proxy with proper headers:

```typescript
async function callAcquirerViaProxy(
  secureProxyUrl: string,
  acquirerRequest: object,
): Promise<AcquirerResponse> {
  const response = await fetch(secureProxyUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      // X-PROVIDER-Forward-To tells the proxy where to send the request
      "X-PROVIDER-Forward-To": process.env.ACQUIRER_API_URL!,
      // Custom headers for the acquirer — prefix is stripped by the proxy
      "X-PROVIDER-Forward-MerchantId": process.env.ACQUIRER_MERCHANT_ID!,
      "X-PROVIDER-Forward-MerchantKey": process.env.ACQUIRER_MERCHANT_KEY!,
    },
    body: JSON.stringify(acquirerRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Secure Proxy call failed: ${response.status} ${errorText}`,
    );
  }

  return response.json() as Promise<AcquirerResponse>;
}

// For PCI-certified environments, call acquirer directly
async function callAcquirerDirect(
  acquirerRequest: object,
): Promise<AcquirerResponse> {
  const response = await fetch(process.env.ACQUIRER_API_URL!, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      MerchantId: process.env.ACQUIRER_MERCHANT_ID!,
      MerchantKey: process.env.ACQUIRER_MERCHANT_KEY!,
    },
    body: JSON.stringify(acquirerRequest),
  });

  return response.json() as Promise<AcquirerResponse>;
}
```

Safe logging utility:

```typescript
function safePaymentLog(label: string, body: Record<string, unknown>): void {
  const safe = {
    paymentId: body.paymentId,
    paymentMethod: body.paymentMethod,
    value: body.value,
    currency: body.currency,
    orderId: body.orderId,
    hasCard: !!body.card,
    hasSecureProxy: !!body.secureProxyUrl,
    cardBin: (body.card as Record<string, unknown>)?.bin,
    // Everything else is intentionally omitted
  };

  console.log(label, JSON.stringify(safe));
}
```

## Common failure modes

- **Direct card handling in non-PCI environment** — Calling the acquirer API directly without using the Secure Proxy. The acquirer receives tokens (e.g., `#vtex#token#d799bae#number#`) instead of real card numbers and rejects the transaction. Even if raw data were available, transmitting it from a non-PCI environment is a PCI DSS violation.
- **Using Secure Proxy for cancel/capture/refund** — These operations do not receive `secureProxyUrl` and do not carry card data. Attempting to route them through Secure Proxy fails because the URL is `undefined`. Use `ExternalClient` with direct API calls for post-auth operations.
- **Storing full card numbers (PANs)** — Persisting the full card number in a database for "reference" or "reconciliation". A single breach of this data can result in $100K/month fines, mandatory forensic audits, and permanent loss of card processing ability.
- **Logging card details for debugging** — Adding `console.log(req.body)` or `console.log(card)` to troubleshoot payment issues and forgetting to remove it. Card data ends up in log files, monitoring dashboards, and log aggregation services. This is a PCI violation even in development.
- **Stripping X-PROVIDER-Forward headers** — Sending requests to the Secure Proxy without the `X-PROVIDER-Forward-To` header. The proxy does not know where to forward the request and returns an error.
- **Storing token values** — Writing `card.numberToken`, `card.holderToken`, or `card.cscToken` to a database or cache, treating them as "safe" because they are tokens. Tokens reference real card data and must not be persisted.

## Review checklist

- [ ] Does the connector use `secureProxyUrl` when it is present in the Create Payment request?
- [ ] Is `SecureExternalClient` used **only** for Create Payment (authorize), not for cancel/capture/refund?
- [ ] Do post-auth operations (cancel, capture, refund) use `ExternalClient` with direct API calls?
- [ ] Is `X-PROVIDER-Forward-To` set to the acquirer's API URL in Secure Proxy calls?
- [ ] Are custom acquirer headers prefixed with `X-PROVIDER-Forward-` when going through the proxy?
- [ ] Is only `card.bin`, `card.numberLength`, and `card.expiration` stored in the database?
- [ ] Are card numbers, CVV, holder names, and token values excluded from all log statements?
- [ ] Is there a redaction utility for safely logging payment request data?
- [ ] Does the connector support both Secure Proxy (non-PCI) and direct (PCI-certified) modes?
- [ ] Are error responses logged without including the acquirer request body (which contains tokens)?

## Related skills

- [`payment-provider-framework`](../payment-provider-framework/skill.md) — PPF IO wiring, two-client pattern (`SecureExternalClient` + `ExternalClient`), and `outbound-access` policies
- [`payment-provider-protocol`](../payment-provider-protocol/skill.md) — Endpoint contracts and response shapes
- [`payment-idempotency`](../payment-idempotency/skill.md) — `paymentId`/`requestId` idempotency and state machine
- [`payment-async-flow`](../payment-async-flow/skill.md) — Async payment methods, callbacks, and the 7-day retry window

## Reference

- [Secure Proxy](https://developers.vtex.com/docs/guides/payments-integration-secure-proxy) — Complete Secure Proxy documentation including flow diagrams, request/response examples, custom tokens, and supported JsonLogic operators
- [PCI DSS Compliance](https://developers.vtex.com/docs/guides/payments-integration-pci-dss-compliance) — PCI certification requirements, AOC submission process, and when Secure Proxy is mandatory
- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Endpoint implementation guide including Create Payment request body with secureProxyUrl and tokenized card fields
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Protocol overview including PCI prerequisites and Secure Proxy requirements
- [Payment Provider Framework](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-framework) — VTEX IO framework for payment connectors (Secure Proxy mandatory for all IO apps)
- [PCI Security Standards Council](https://www.pcisecuritystandards.org/) — Official PCI DSS requirements and compliance documentation

---

# Payment Provider Framework (VTEX IO)

## When this skill applies

Use this skill when:
- Creating or maintaining a payment connector implemented as a VTEX IO app (not a standalone HTTP service you host yourself)
- Wiring `@vtex/payment-provider`, `PaymentProvider`, and `PaymentProviderService` in `node/index.ts`
- Configuring the `paymentProvider` builder, `configuration.json` (payment methods, `customFields`, feature flags)
- Implementing `this.retry(request)` for Gateway retry semantics on IO
- Extending `SecureExternalClient` and passing `secureProxy` on requests for card flows on IO
- Testing via payment affiliation, workspaces, beta/stable releases, the VTEX App Store, and VTEX homologation

Do not use this skill for:
- PPP HTTP contracts, response field-by-field requirements, and the nine endpoints in the abstract — use [`payment-provider-protocol`](../payment-provider-protocol/skill.md)
- Idempotency and duplicate `paymentId` handling — use [`payment-idempotency`](../payment-idempotency/skill.md)
- Async `undefined` status, `callbackUrl` notification vs retry (IO vs non-IO) — use [`payment-async-flow`](../payment-async-flow/skill.md)
- PCI rules, logging, and token semantics beyond IO wiring — use [`payment-pci-security`](../payment-pci-security/skill.md)

## Decision rules

- **PPF on IO**: "Payment Provider Framework is the VTEX IO–based way to build payment connectors." The app uses IO infrastructure; API routes, request/response types, and Secure Proxy are integrated per VTEX guides. Start from the example app described in the official Payment Provider Framework documentation.
- **Prerequisites**: Follow implementation prerequisites in the Payment Provider Protocol article and the guide on integrating a new payment provider on VTEX.
- **Dependencies**: In the app `node` folder, add `@vtex/payment-provider` (for example `1.x` in `package.json`). Keep `@vtex/api` in `devDependencies` (for example `6.x`); linking may bump it beyond `6.x`, which is acceptable. If types break, delete `node_modules` and `yarn.lock` in the project root and in `node`, then run `yarn install -f` in both.
- **`paymentProvider` builder**: In `manifest.json`, include `"paymentProvider": "1.x"` next to `node` so policies for Payment Gateway callbacks and PPP routes apply.
- **`configuration.json`**: Declare `paymentMethods` so the builder can implement them without re-declaring everything on `/manifest`. Use names matching the List Payment Provider Manifest API reference; only invent a new name when the method is genuinely new. New methods in Admin may require a support ticket.
- **`PaymentProvider`**: One class method per PPP route; TypeScript enforces shapes — see Payment Flow endpoints in the API reference.
- **`PaymentProviderService`**: Registers default routes `/manifest`, `/payments`, `/settlements`, `/refunds`, `/cancellations`, `/inbound`; pass extra `routes` / `clients` when needed.
- **Overriding `/manifest`**: Only with an approved use case — open a ticket. See the Preferred pattern section for an example route override shape.
- **Configurable options**: Use `configuration.json` / builder options for flags such as `implementsOAuth`, `implementsSplit`, `usesProviderHeadersName`, `usesBankInvoiceEnglishName`, `usesSecureProxy`, `requiresDocument`, `acceptSplitPartialRefund`, `usesAutoSettleOptions`. Set `name` and rely on auto-generated `serviceUrl` on IO unless documented otherwise. **Do not invent fields** — unknown keys (such as `usesTestSuite`) cause builder validation errors. See the "configuration.json schema" constraint below for the canonical list and `customFields` format.
- **Gateway retry**: In PPF, call `this.retry(request)` where the protocol requires retry — see the Payment authorization section in the PPP article.
- **Card data on IO**: "Prefer `SecureExternalClient` with `secureProxy: secureProxyUrl` from Create Payment; destination must be allowlisted." Supported `Content-Type` values for Secure Proxy: `application/json` and `application/x-www-form-urlencoded` only. **Important:** only the Create Payment (authorize) request carries `secureProxyUrl`. Post-authorization operations (cancel, capture, refund) do not transport card data and must call the PSP API directly via `ExternalClient` with credentials and `outbound-access` policies.
- **Checkout testing**: Account must be allowed for IO connectors (ticket with app name and account). Publish beta, install on `master`, wait ~1 hour, open affiliation URL, enable test mode and workspace, configure payment condition (~10 minutes), place test order; then stable + homologation.
- **Publication**: Configure `billingOptions` per the Billing Options guide; submit via Submitting your app. Prepare homologation artifacts (connector app name, partner contact, production endpoint, allowed accounts, new methods/flows) per the Integrating a new payment provider on VTEX guide (SLA often ~30 days).
- **Updates**: Ship changes in a new beta, re-test affiliations, then stable; re-homologate if required.

## Hard constraints

### Constraint: Builder-Hub uses TypeScript 3.9.7 — code and dependencies MUST be compatible

The `vtex.builder-hub` compiles IO apps with **TypeScript 3.9.7**. It also **ignores `skipLibCheck: true`** in `tsconfig.json` — every `.d.ts` file in `node_modules` is type-checked. This means that even if your own code is valid, a transitive dependency shipping modern `.d.ts` syntax will break the build with hundreds of errors unrelated to your code.

**Why this matters**

Agents and developers regularly produce code with TS 4.x+ syntax or install the latest `@types/*` packages. The build fails with cryptic errors in files the developer never touched, causing many wasted iterations.

**Prohibited syntax (incompatible with TS 3.9.7)**

| Syntax | Minimum TS version | Example |
|---|---|---|
| Template literal types | 4.1 | `` type X = `${string}/${string}` `` |
| Typed catch clause | 4.0 | `catch (error: any)` |
| `override` keyword | 4.3 | `override method()` in classes |
| `import type ... = require()` | 4.5 | `import type X = require("pkg")` |
| `satisfies` operator | 4.9 | `obj satisfies Type` |

**Correct catch block pattern**

```typescript
// CORRECT — TS 3.9.7 compatible
try {
  // ...
} catch (error) {
  const err = error as any
  console.log(err.message)
}

// WRONG — TS 4.0+ only
try {
  // ...
} catch (error: any) {
  console.log(error.message)
}
```

**Unused variables are errors, not warnings.** The builder-hub treats declared-but-unused variables as compilation errors. Avoid destructuring fields you do not use:

```typescript
// WRONG — if callbackUrl is not used, build fails
const { paymentId, callbackUrl, value } = authorization

// CORRECT
const { paymentId, value } = authorization
```

**Safe dependency versions (compatible with TS 3.9.7)**

Use `resolutions` in `node/package.json` to pin transitive dependencies to versions that do not ship modern `.d.ts` syntax. The `**/<package>` pattern pins nested copies too.

```json
{
  "dependencies": {
    "@vtex/payment-provider": "1.x"
  },
  "devDependencies": {
    "@vtex/api": "6.50.1",
    "@types/node": "12.20.55",
    "@types/express-serve-static-core": "4.17.2",
    "@types/express": "4.17.10",
    "@types/serve-static": "1.15.0",
    "@opentelemetry/api": "1.0.4",
    "typescript": "3.9.7"
  },
  "resolutions": {
    "@types/node": "12.20.55",
    "@types/express-serve-static-core": "4.17.2",
    "@types/express": "4.17.10",
    "@types/serve-static": "1.15.0",
    "@opentelemetry/api": "1.0.4",
    "**/@types/express-serve-static-core": "4.17.2",
    "**/@types/koa": "2.15.0"
  }
}
```

| Package | Safe version | First broken version | Reason |
|---|---|---|---|
| `@types/node` | `12.20.55` | `13.x+` (some APIs) | Modern syntax in `.d.ts` |
| `@types/express-serve-static-core` | `4.17.2` | `4.17.13+` | Template literal types |
| `@types/express` | `4.17.10` | `4.17.11+` | Depends on `@types/express-serve-static-core@^4.17.18` |
| `@types/koa` | `2.15.0` | `3.x` | `import type ... = require()` |
| `@opentelemetry/api` | `1.0.4` | Newer versions | TS 4.x syntax |
| `@types/serve-static` | `1.15.0` | Newer versions | Transitive dependency issues |

**Diagnosing new broken packages:** if the build fails with errors in `.d.ts` files from `node_modules`, identify the package from the error path, test older versions until you find one without modern syntax, and add it to both `devDependencies` and `resolutions` (with `**/<package>` pattern).

**Detection**

If the generated code uses any syntax from the table above, or if `package.json` lacks `resolutions` for type packages, STOP and fix before attempting `vtex link`.

### Constraint: `configuration.json` must use only valid schema fields and correct `customFields` format

The `paymentProvider` builder validates `configuration.json` against a strict schema. Unknown fields cause build errors. The `customFields[].options` array for `select` type fields must use `text` and `value` keys — never `label`.

**Why this matters**

Invalid fields like `usesTestSuite` or `useAntifraud` (if not in the current schema) cause immediate `vtex link` failure. Using `label` instead of `text` in select options silently breaks the Admin UI or fails validation.

**Canonical fields** (verify against current VTEX documentation):

`name` (required), `serviceUrl` (auto on IO), `implementsOAuth`, `implementsSplit`, `usesProviderHeadersName`, `usesBankInvoiceEnglishName`, `usesSecureProxy`, `requiresDocument`, `acceptSplitPartialRefund`, `usesAutoSettleOptions`, `paymentMethods`, `customFields`.

**Fields known to break the build:** `usesTestSuite` (does not exist in the schema).

**Correct customFields with select**

```json
{
  "name": "AcmePayConnector",
  "usesAutoSettleOptions": true,
  "paymentMethods": [
    { "name": "Visa", "allowsSplit": "onCapture" }
  ],
  "customFields": [
    {
      "name": "Environment",
      "type": "select",
      "options": [
        { "text": "Sandbox", "value": "sandbox" },
        { "text": "Production", "value": "production" }
      ]
    }
  ]
}
```

**Wrong customFields**

```json
{
  "customFields": [
    {
      "name": "Environment",
      "type": "select",
      "options": [
        { "label": "Sandbox", "value": "sandbox" }
      ]
    }
  ]
}
```

**Detection**

If `configuration.json` contains keys not in the canonical list, or uses `label` instead of `text` in select options, STOP and fix before build.

### Constraint: Declare the `paymentProvider` builder and a real connector identity in `configuration.json`

IO connectors MUST include the `paymentProvider` builder in `manifest.json` and a `paymentProvider/configuration.json` with a non-placeholder `name` and accurate `paymentMethods`. Do not ship the literal placeholder `"MyConnector"` (or equivalent) as production configuration.

**Why this matters**

Without the builder, PPP routes and Gateway policies are not wired. A placeholder name breaks Admin, affiliations, and homologation.

**Detection**

If `manifest.json` lacks `paymentProvider`, or `configuration.json` still uses example placeholder names, stop and fix before publishing.

**Correct**

```json
{
  "name": "PartnerAcmeCard",
  "paymentMethods": [
    { "name": "Visa", "allowsSplit": "onCapture" },
    { "name": "BankInvoice", "allowsSplit": "onAuthorize" }
  ]
}
```

**Wrong**

```json
{
  "name": "MyConnector",
  "paymentMethods": []
}
```

### Constraint: Register PPP routes only through `PaymentProviderService` with a `PaymentProvider` implementation

The service MUST wrap a class extending `PaymentProvider` from `@vtex/payment-provider` so standard PPP paths are registered. Do not hand-roll the same route surface without the package unless VTEX explicitly prescribes an alternative.

**Why this matters**

Missed or mismatched routes break Gateway calls and homologation; the package keeps handlers aligned with the protocol.

**Detection**

If `node/index.ts` exposes PPP paths manually and does not instantiate `PaymentProviderService` with the connector class, reconcile with the documented pattern.

**Correct**

```typescript
import { PaymentProviderService } from "@vtex/payment-provider";
import { YourPaymentConnector } from "./connector";

export default new PaymentProviderService({
  connector: YourPaymentConnector,
});
```

**Wrong**

```typescript
// Ad-hoc router only — no PaymentProviderService / PaymentProvider base
export default someCustomRouterWithoutPPPPackage;
```

### Constraint: `PaymentProviderService` `clients` field requires `{ implementation, options }` — not the class directly

When passing custom `IOClients` to `PaymentProviderService`, the `clients` field expects an object with `implementation` (the class) and `options` (retry/timeout config), following the `ServiceConfig` interface from `@vtex/api`. Passing the class directly causes a runtime error.

**Why this matters**

This is a common mistake that produces a confusing runtime error instead of a clear type error, since the PPF types may not enforce this strictly.

**Correct**

```typescript
import { PaymentProviderService } from '@vtex/payment-provider'
import MyConnector from './connector'
import { Clients } from './clients'

export default new PaymentProviderService({
  connector: MyConnector,
  clients: {
    implementation: Clients,
    options: {
      default: {
        retries: 2,
        timeout: 15000,
      },
    },
  },
})
```

**Wrong**

```typescript
export default new PaymentProviderService({
  connector: MyConnector,
  clients: Clients,  // WRONG — expects { implementation, options }
})
```

### Constraint: Use `this.retry(request)` for Gateway retry on IO

Where the PPP flow requires retry semantics on IO, handlers MUST invoke `this.retry(request)` as specified in the protocol — not a custom retry helper that bypasses the framework.

**Why this matters**

"The Gateway expects framework-driven retry behavior; omitting it causes inconsistent authorization and settlement behavior."

**Detection**

Search payment handlers for protocol retry cases; if retries are implemented without `this.retry`, fix before release.

**Correct**

```typescript
// Inside a PaymentProvider subclass method, when the protocol requires retry:
return this.retry(request);
```

**Wrong**

```typescript
// Re-implementing gateway retry with setTimeout/fetch instead of this.retry
await fetch(callbackUrl, { method: "POST", body: JSON.stringify(payload) });
```

### Constraint: Forward card authorization calls through Secure Proxy on IO with allowlisted destinations

For card flows on IO with `usesSecureProxy` behavior, proxied HTTP calls MUST go through `SecureExternalClient` (or equivalent VTEX pattern), MUST pass `secureProxy` set to the `secureProxyUrl` from the payment request, and MUST target a VTEX-allowlisted PCI endpoint. Only `application/json` or `application/x-www-form-urlencoded` bodies are supported. If `usesSecureProxy` is false, the provider must be PCI-certified and supply AOC for `serviceUrl` per VTEX.

**Why this matters**

"Skipping Secure Proxy or wrong content types breaks PCI scope, proxy validation, or acquirer integration — blocking homologation or exposing card data incorrectly."

**Detection**

Inspect client code for POSTs that include card tokens without `secureProxy` in the request config, or destinations not registered with VTEX.

**Correct**

```typescript
import { SecureExternalClient, CardAuthorization } from "@vtex/payment-provider";
import type { InstanceOptions, IOContext, RequestConfig } from "@vtex/api";

export class MyPCICertifiedClient extends SecureExternalClient {
  constructor(protected context: IOContext, options?: InstanceOptions) {
    super("https://pci-certified.example.com", context, options);
  }

  public authorize = (cardRequest: CardAuthorization) =>
    this.http.post(
      "authorize",
      {
        holder: cardRequest.holderToken,
        number: cardRequest.numberToken,
        expiration: cardRequest.expiration,
        csc: cardRequest.cscToken,
      },
      {
        headers: { Authorization: "Bearer ..." },
        secureProxy: cardRequest.secureProxyUrl,
      } as RequestConfig
    );
}
```

**Wrong**

```typescript
// Direct outbound call with raw card fields and no secureProxy
await http.post("https://acquirer.example/pay", { pan, cvv, expiry });
```

### Constraint: Only Create Payment receives `secureProxyUrl` — post-auth operations call the PSP directly

The `secureProxyUrl` field is present **only in the Create Payment (authorize) request**. Cancel, capture, and refund operations do not carry card data and do not receive `secureProxyUrl`. These operations must call the PSP API directly using an `ExternalClient` (from `@vtex/api`) with API credentials, protected by `outbound-access` policies in `manifest.json`.

**Why this matters**

Attempting to use `SecureExternalClient` or `secureProxyUrl` in cancel/capture/refund handlers will fail because the field is `undefined` in those requests. This is not a PCI concern — these operations only reference transaction IDs, not card data.

**Detection**

If cancel, capture, or refund handlers reference `secureProxyUrl` or use `SecureExternalClient`, STOP. These must use `ExternalClient` with direct HTTP calls to the PSP.

**Correct — two client pattern**

```typescript
// clients/pspSecure.ts — for authorization only (via Secure Proxy)
import { SecureExternalClient } from "@vtex/payment-provider";
import type { InstanceOptions, IOContext } from "@vtex/api";

export class PspSecureClient extends SecureExternalClient {
  constructor(ctx: IOContext, opts?: InstanceOptions) {
    super("https://api.psp.com", ctx, opts);
  }

  public async authorize(data: object, secureProxyUrl: string) {
    return this.http.post("/v1/payments", data, {
      secureProxy: secureProxyUrl,
    } as any)
  }
}

// clients/psp.ts — for cancel, capture, refund (direct calls)
import { ExternalClient } from "@vtex/api";
import type { InstanceOptions, IOContext } from "@vtex/api";

export class PspClient extends ExternalClient {
  constructor(ctx: IOContext, opts?: InstanceOptions) {
    super("https://api.psp.com", ctx, opts);
  }

  public async capture(transactionId: string, amount: number) {
    return this.http.post(`/v1/payments/${transactionId}/capture`, { amount })
  }

  public async cancel(transactionId: string) {
    return this.http.post(`/v1/payments/${transactionId}/cancel`, {})
  }

  public async refund(transactionId: string, amount: number) {
    return this.http.post(`/v1/payments/${transactionId}/refund`, { amount })
  }
}
```

**Wrong**

```typescript
// WRONG — trying to use SecureExternalClient for capture
async settle(settlement: SettlementRequest) {
  const client = this.context.clients.pspSecure as PspSecureClient
  // secureProxyUrl is undefined here — this will fail
  await client.capture(settlement.tid, settlement.value, settlement.secureProxyUrl)
}
```

### Constraint: Do not access `.http` on client instances from outside the client class

The `http` property on `ExternalClient` and `SecureExternalClient` is `protected`. Calling `client.http.post(...)` from the `PaymentProvider` subclass causes a TypeScript compilation error in the builder-hub.

**Why this matters**

This is a frequent mistake when developers try to make HTTP calls from the connector class instead of through the client's public methods. The builder-hub enforces `protected` access and fails the build.

**Detection**

If the connector code accesses `.http` on a client instance (e.g., `this.context.clients.myClient.http.post(...)`), STOP. Expose a public method in the client subclass instead.

**Correct**

```typescript
// Inside the client class — this.http is accessible (protected = same class)
export class PspClient extends ExternalClient {
  public async capturePayment(tid: string, amount: number) {
    return this.http.post(`/v1/payments/${tid}/capture`, { amount })
  }
}

// Inside the connector — call the public method
async settle(settlement: SettlementRequest) {
  const clients = this.context.clients as any as { psp: PspClient }
  return clients.psp.capturePayment(settlement.tid, settlement.value)
}
```

**Wrong**

```typescript
// Inside the connector — .http is protected, build fails
async settle(settlement: SettlementRequest) {
  const clients = this.context.clients as any as { psp: PspClient }
  return clients.psp.http.post(`/v1/capture`, { amount: settlement.value })
  //                  ^^^^ TS error: Property 'http' is protected
}
```

## Preferred pattern

### Project file structure

```text
/
├── manifest.json                          # App identity, builders, policies
├── paymentProvider/
│   └── configuration.json                 # Payment methods, connector options
├── service.json                           # Runtime config (memory, timeout, replicas, custom routes)
└── node/
    ├── package.json                       # Dependencies WITH resolutions for TS 3.9.7
    ├── tsconfig.json                      # TypeScript config (skipLibCheck ignored by builder)
    ├── yarn.lock                          # REQUIRED — builder rejects build without it
    ├── index.ts                           # Entry point: exports PaymentProviderService
    ├── connector.ts                       # Class extending PaymentProvider
    ├── clients/
    │   ├── index.ts                       # IOClients with getOrSet
    │   ├── psp.ts                         # ExternalClient for direct PSP calls (cancel/capture/refund)
    │   └── pspSecure.ts                   # SecureExternalClient for card authorization via Secure Proxy
    └── typings/
        └── psp.ts                         # TypeScript interfaces
```

**Critical file notes:**
- **`yarn.lock`** in `node/` is **required** — the builder rejects the build without it. Do not add it to `.vtexignore`.
- **`service.json`** goes in the **project root**, not inside `node/`.
- **`configuration.json`** goes inside `paymentProvider/`, not in the root.

### `manifest.json` builders and policies

```json
{
  "builders": {
    "node": "7.x",
    "paymentProvider": "1.x"
  },
  "policies": [
    { "name": "vbase-read-write" },
    { "name": "outbound-access", "attrs": { "host": "api.psp.com", "path": "/*" } },
    { "name": "outbound-access", "attrs": { "host": "api.sandbox.psp.com", "path": "/*" } }
  ]
}
```

Note: `vbase-read-write` policy is required if you use VBase for state storage. Without it, `vbase.saveJSON()` returns 403.

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "es2019",
    "module": "commonjs",
    "lib": ["es2019"],
    "outDir": "./dist",
    "rootDir": ".",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "**/node_modules", "dist"]
}
```

Note: the builder-hub overrides `outDir`, `rootDir`, and `paths` with its own values. **`skipLibCheck: true` is ignored** — all `.d.ts` files are checked. Use `resolutions` in `package.json` to control dependency type versions instead.

### IOClients registration

```typescript
import { IOClients } from '@vtex/api'
import { PspClient } from './psp'
import { PspSecureClient } from './pspSecure'

export class Clients extends IOClients {
  public get psp(): PspClient {
    return this.getOrSet('psp', PspClient)
  }

  public get pspSecure(): PspSecureClient {
    return this.getOrSet('pspSecure', PspSecureClient)
  }
}
```

### Accessing custom clients and IOContext in the connector

```typescript
import { PaymentProvider } from '@vtex/payment-provider'
import type { Clients } from './clients'

export default class MyConnector extends PaymentProvider {
  // IOContext is at this.context.vtex, NOT this.context directly
  private get account(): string {
    const vtexCtx = (this.context as any).vtex as { account: string; workspace: string }
    return vtexCtx?.account || ''
  }

  private get workspace(): string {
    const vtexCtx = (this.context as any).vtex as { account: string; workspace: string }
    return vtexCtx?.workspace || 'master'
  }

  // Custom clients require a cast
  private get clients() {
    return this.context.clients as any as {
      psp: Clients['psp']
      pspSecure: Clients['pspSecure']
      vbase: import('@vtex/api').VBase
    }
  }

  // VBase is available directly
  private get vbase() {
    return this.context.clients.vbase
  }
}
```

### PaymentProviderService with clients, custom routes, and service.json

```typescript
// node/index.ts
import { PaymentProviderService } from '@vtex/payment-provider'
import MyConnector from './connector'
import { Clients } from './clients'

export default new PaymentProviderService({
  connector: MyConnector,
  clients: {
    implementation: Clients,
    options: {
      default: {
        retries: 2,
        timeout: 15000,
      },
    },
  },
  // Optional: custom routes (e.g., for redirect callbacks)
  // routes: {
  //   myCallback: myCallbackHandler,
  // },
})
```

When using custom routes, register them in `service.json` at the project root:

```json
{
  "memory": 256,
  "ttl": 10,
  "timeout": 10,
  "minReplicas": 2,
  "maxReplicas": 10,
  "routes": {
    "myCallback": {
      "path": "/_v/my-connector/callback",
      "public": true
    }
  }
}
```

The PPF builder merges its own routes (PPP endpoints) with yours — you do not need to re-declare the standard PPP routes.

### Credentials via affiliation

The PPF maps affiliation headers to connector properties automatically:

| VTEX Header | Connector Property | Typical Use |
|---|---|---|
| `X-PROVIDER-API-AppKey` | `this.apiKey` | PSP Client ID / API Key |
| `X-PROVIDER-API-AppToken` | `this.appToken` | PSP Client Secret / API Token |

`this.isTestSuite` indicates whether the transaction is a test (sandbox).

Custom settings from `customFields` in `configuration.json` are available via the authorization object in each request (the exact access pattern depends on the PPF version — check the types in `@vtex/payment-provider`).

### PPF response helpers — what each helper fills automatically

When using `Authorizations`, `Settlements`, and `Refunds` helpers from `@vtex/payment-provider`:

| Helper | Auto-filled from request | Do NOT pass in second argument |
|---|---|---|
| `Authorizations.approve(auth, { ... })` | `paymentId` | — |
| `Authorizations.deny(auth, { ... })` | `paymentId` | `nsu` (not part of deny type) |
| `Settlements.approve(settle, { settleId })` | `paymentId`, `value` | `value` (already merged from request) |
| `Refunds.approve(refund, { refundId })` | `paymentId`, `value` | `value` (already merged from request) |

To add `delayToCancel` with `approveCard` when the strict type omits it, use a spread with type assertion:

```typescript
// TS 3.9.7 compatible
const baseResponse = Authorizations.approve(authorization, {
  authorizationId: result.authorizationId,
  nsu: result.nsu,
  tid: result.tid,
  acquirer: 'MyPSP',
  code: '200',
  message: 'Approved',
})
const response = {
  ...baseResponse,
  delayToCancel: 21600,
  delayToAutoSettle: 21600,
  delayToAutoSettleAfterAntifraud: 1800,
} as any
return response
```

### PSP integration checklist (provider-agnostic)

Before wiring the PSP client:
1. Open the PSP's **API Explorer / OpenAPI spec** and identify the **base URL per environment** (test/live).
2. Do not **duplicate** version or path segments between `baseURL` and the operation path (e.g., if the base is `https://checkout-test.psp.com/v71`, the path for payments is `/payments`, not `/v71/payments`).
3. Validate with a test call (e.g., create payment) before closing the connector implementation.
4. If the PSP requires an OAuth token, implement **in-memory caching** of the access token — the VTEX Gateway has a **2-second timeout** on some flows and sequential token + API calls will exceed it.

```typescript
// Simple in-memory token cache (TS 3.9.7 compatible)
const tokenCache: Record<string, { token: string; expiresAt: number }> = {}

function getCachedToken(clientId: string): string | null {
  const entry = tokenCache[clientId]
  if (entry && Date.now() < entry.expiresAt) return entry.token
  return null
}

function setCachedToken(clientId: string, token: string, expiresIn: number): void {
  tokenCache[clientId] = {
    token,
    expiresAt: Date.now() + (expiresIn - 300) * 1000,
  }
}
```

### Affiliation URL pattern for testing

```text
https://{account}.myvtex.com/admin/affiliations/connector/Vtex.PaymentGateway.Connectors.PaymentProvider.PaymentProviderConnector_{connector-name}/
```

Replace `{connector-name}` with `${vendor}-${appName}-${appMajor}` (example: `vtex-payment-provider-example-v1`).

Testing flow summary: publish beta (for example `vendor.app@0.1.0-beta` — see Making your app publicly available documentation), install on `master`, wait ~1 hour, open affiliation, under **Payment Control** enable **Enable test mode** and set **Workspace** (often `master`), add a payment condition, wait ~10 minutes, place order; then deploy stable and complete homologation.

Replace all example vendor names, endpoints, and credentials with values for your real app before production.

## Common failure modes

- Missing `paymentProvider` builder or empty/wrong `paymentMethods` so `/manifest` and Admin do not list methods correctly.
- **Build fails with hundreds of TS errors in `node_modules/.d.ts` files** — missing `resolutions` in `package.json` to pin type packages to TS 3.9.7-compatible versions.
- **`skipLibCheck: true` has no effect** — the builder-hub ignores it. Use `resolutions` instead.
- **`catch (error: any)` or other TS 4.x+ syntax** in connector code — use the TS 3.9.7 compatible patterns.
- **`configuration.json` with invalid fields** (`usesTestSuite`, invented keys) — causes builder validation error.
- **`customFields` select options using `label` instead of `text`** — breaks Admin UI or fails validation.
- **Missing `yarn.lock`** in the `node/` directory — builder rejects the build.
- **`service.json` placed inside `node/`** instead of the project root.
- **`clients: Clients`** passed directly to `PaymentProviderService` instead of `{ implementation: Clients, options: {...} }`.
- **Accessing `client.http.post(...)` from the connector** — `http` is `protected`; expose public methods in the client class.
- **Using `SecureExternalClient` for cancel/capture/refund** — only Create Payment carries `secureProxyUrl`; post-auth uses `ExternalClient`.
- **Accessing `this.context.account`** instead of `this.context.vtex.account` — the IOContext is nested under `.vtex`.
- Type or install drift (`@vtex/api` / `@vtex/payment-provider`) without the clean reinstall path in root and `node`.
- Skipping `this.retry(request)` and duplicating retry with ad-hoc HTTP — Gateway behavior diverges from PPP.
- Card calls without `secureProxy`, wrong `Content-Type`, or non-allowlisted destination — Secure Proxy or PCI review fails.
- Testing without account allowlisting, without sellable products, or without waiting for master install / payment condition propagation.
- Overriding `/manifest` without VTEX approval or leaving stale `x-provider-app` after a major version bump.
- Homologation ticket missing production endpoint, allowed accounts, or purchase-flow details.
- **`vtex link --no-watch` hides compilation errors** — prefer watch mode to see full error output.
- **`vtex link` on `master` workspace fails** — use a dev workspace (`vtex use dev-workspace`).
- **Missing `vbase-read-write` policy** in `manifest.json` — `vbase.saveJSON()` returns 403.
- **Duplicate path segments in PSP base URL** — e.g., `/checkout/v71/v71/payments` when the version is already in the base URL.

## Review checklist

- [ ] Is the connector an IO app using `PaymentProvider` + `PaymentProviderService` (not only a standalone middleware guide)?
- [ ] Do `manifest.json` and `paymentProvider/configuration.json` match the real connector name and supported methods?
- [ ] Does `configuration.json` use only valid schema fields? Are `customFields` select options using `text` (not `label`)?
- [ ] Does `package.json` include `resolutions` pinning `@types/*` and other packages to TS 3.9.7-compatible versions?
- [ ] Is all code compatible with TS 3.9.7? (no `catch (e: any)`, no template literal types, no `override`, no `satisfies`)
- [ ] Is `yarn.lock` present in `node/` and not in `.vtexignore`?
- [ ] Is `service.json` in the project root (not inside `node/`)?
- [ ] Is `PaymentProviderService` instantiated with `clients: { implementation, options }` (not the class directly)?
- [ ] Do client classes expose public methods instead of relying on `this.http` access from outside?
- [ ] Is `SecureExternalClient` used only for Create Payment (authorize), and `ExternalClient` for cancel/capture/refund?
- [ ] Are optional manifest overrides ticket-approved and are `handler` / headers / `x-provider-app` correct?
- [ ] Does every route implementation align with types in `@vtex/payment-provider` and with payment-provider-protocol for response shapes?
- [ ] Are Gateway retries implemented with `this.retry(request)` where required?
- [ ] Do card flows use `SecureExternalClient` (or equivalent) with `secureProxy: secureProxyUrl` and allowlisted destinations?
- [ ] Has beta/staging testing followed affiliation, test mode, workspace, and payment condition steps before stable?
- [ ] Are billing, App Store submission, and homologation prerequisites documented in the internal release checklist?
- [ ] Does `manifest.json` include `vbase-read-write` and `outbound-access` policies for the PSP hosts?

## Related skills

- [`payment-provider-protocol`](../payment-provider-protocol/skill.md) — PPP endpoints, HTTP methods, and response shapes
- [`payment-idempotency`](../payment-idempotency/skill.md) — `paymentId` / `requestId` and retries
- [`payment-async-flow`](../payment-async-flow/skill.md) — `undefined` status, `callbackUrl` (IO retry vs notification), and redirect-based flows
- [`payment-pci-security`](../payment-pci-security/skill.md) — PCI and Secure Proxy semantics beyond IO wiring

## Reference

- [Payment Provider Framework](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-framework) — Official PPF guide (includes getting started and example app)
- [Payment Provider Protocol API overview](https://developers.vtex.com/docs/guides/payment-provider-protocol-api-overview)
- [Secure Proxy](https://developers.vtex.com/docs/guides/payments-integration-secure-proxy)
- [PCI DSS compliance (payments)](https://developers.vtex.com/docs/guides/payments-integration-pci-dss-compliance)
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/tutorial/payment-provider-protocol--RdsT2spdq80MMwwOeEq0m)
- [Integrating a new payment provider on VTEX](https://developers.vtex.com/docs/guides/integrating-a-new-payment-provider-on-vtex)

---

# PPP Endpoint Implementation

## When this skill applies

Use this skill when:
- Building a new payment connector middleware that integrates a PSP with the VTEX Payment Gateway
- Implementing, debugging, or extending any of the 9 PPP endpoints
- Preparing a connector for VTEX Payment Provider Test Suite homologation

Do not use this skill for:
- Idempotency and duplicate prevention logic — use [`payment-idempotency`](../payment-idempotency/skill.md)
- Async payment flows and callback URLs — use [`payment-async-flow`](../payment-async-flow/skill.md)
- PCI compliance and Secure Proxy card handling — use [`payment-pci-security`](../payment-pci-security/skill.md)

## Decision rules

- The connector MUST implement all 6 payment-flow endpoints: Manifest, Create Payment, Cancel, Capture/Settle, Refund, Inbound Request.
- The configuration flow (3 endpoints: Create Auth Token, Provider Auth Redirect, Get Credentials) is optional but recommended for merchant onboarding.
- All endpoints must be served over HTTPS on port 443 with TLS 1.2.
- The connector must respond in under 5 seconds during homologation tests and under 20 seconds in production.
- The provider must be PCI-DSS certified or use Secure Proxy for card payments.
- The Gateway initiates all calls. The middleware never calls the Gateway except via `callbackUrl` (async notifications) and Secure Proxy (card data forwarding).

## Hard constraints

### Constraint: Implement all required payment flow endpoints

The connector MUST implement all six payment-flow endpoints: GET `/manifest`, POST `/payments`, POST `/payments/{paymentId}/cancellations`, POST `/payments/{paymentId}/settlements`, POST `/payments/{paymentId}/refunds`, and POST `/payments/{paymentId}/inbound-request/{action}`.

**Why this matters**
The VTEX Payment Provider Test Suite validates every endpoint during homologation. Missing endpoints cause test failures and the connector will not be approved. At runtime, the Gateway expects all endpoints — a missing cancel endpoint means payments cannot be voided.

**Detection**
If the connector router/handler file does not define handlers for all 6 payment-flow paths, STOP and add the missing endpoints before proceeding.

**Correct**
```typescript
import { Router } from "express";

const router = Router();

// All 6 payment-flow endpoints implemented
router.get("/manifest", manifestHandler);
router.post("/payments", createPaymentHandler);
router.post("/payments/:paymentId/cancellations", cancelPaymentHandler);
router.post("/payments/:paymentId/settlements", capturePaymentHandler);
router.post("/payments/:paymentId/refunds", refundPaymentHandler);
router.post("/payments/:paymentId/inbound-request/:action", inboundRequestHandler);

export default router;
```

**Wrong**
```typescript
import { Router } from "express";

const router = Router();

// Missing manifest, inbound-request, and refund endpoints
// This will fail homologation and break runtime operations
router.post("/payments", createPaymentHandler);
router.post("/payments/:paymentId/cancellations", cancelPaymentHandler);
router.post("/payments/:paymentId/settlements", capturePaymentHandler);

export default router;
```

### Constraint: Return correct HTTP status codes and response shapes

Each endpoint MUST return the exact response shape documented in the PPP API. Create Payment MUST return `paymentId`, `status`, `authorizationId`, `tid`, `nsu`, `acquirer`, `code`, `message`, `delayToAutoSettle`, `delayToAutoSettleAfterAntifraud`, and `delayToCancel`. Cancel MUST return `paymentId`, `cancellationId`, `code`, `message`, `requestId`. Capture MUST return `paymentId`, `settleId`, `value`, `code`, `message`, `requestId`. Refund MUST return `paymentId`, `refundId`, `value`, `code`, `message`, `requestId`.

**Why this matters**
The Gateway parses these fields programmatically. Missing fields cause deserialization errors and the Gateway treats the payment as failed. Incorrect `delayToAutoSettle` values cause payments to auto-cancel or auto-capture at wrong times.

**Detection**
If a response object is missing any of the required fields for its endpoint, STOP and add the missing fields.

**Correct**
```typescript
interface CreatePaymentResponse {
  paymentId: string;
  status: "approved" | "denied" | "undefined";
  authorizationId: string | null;
  nsu: string | null;
  tid: string | null;
  acquirer: string | null;
  code: string | null;
  message: string | null;
  delayToAutoSettle: number;
  delayToAutoSettleAfterAntifraud: number;
  delayToCancel: number;
  paymentUrl?: string;
}

async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, value, currency, paymentMethod, card, callbackUrl } = req.body;

  const result = await processPaymentWithAcquirer(req.body);

  const response: CreatePaymentResponse = {
    paymentId,
    status: result.status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyAcquirer",
    code: result.code ?? null,
    message: result.message ?? null,
    delayToAutoSettle: 21600,    // 6 hours in seconds
    delayToAutoSettleAfterAntifraud: 1800, // 30 minutes in seconds
    delayToCancel: 21600,         // 6 hours in seconds
  };

  res.status(200).json(response);
}
```

**Wrong**
```typescript
// Missing required fields — Gateway will reject this response
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const result = await processPaymentWithAcquirer(req.body);

  // Missing: authorizationId, nsu, tid, acquirer, code, message,
  // delayToAutoSettle, delayToAutoSettleAfterAntifraud, delayToCancel
  res.status(200).json({
    paymentId: req.body.paymentId,
    status: result.status,
  });
}
```

### Constraint: Manifest must declare all supported payment methods

The GET `/manifest` endpoint MUST return a `paymentMethods` array listing every payment method the connector supports, with the correct `name` and `allowsSplit` configuration for each.

**Why this matters**
The Gateway reads the manifest to determine which payment methods are available. If a method is missing, merchants cannot configure it in the VTEX Admin. An incorrect `allowsSplit` value causes split payment failures.

**Detection**
If the manifest handler returns an empty `paymentMethods` array or hardcodes methods the provider does not actually support, STOP and fix the manifest.

**Correct**
```typescript
async function manifestHandler(_req: Request, res: Response): Promise<void> {
  const manifest = {
    paymentMethods: [
      { name: "Visa", allowsSplit: "onCapture" },
      { name: "Mastercard", allowsSplit: "onCapture" },
      { name: "American Express", allowsSplit: "onCapture" },
      { name: "BankInvoice", allowsSplit: "onAuthorize" },
      { name: "Pix", allowsSplit: "disabled" },
    ],
  };

  res.status(200).json(manifest);
}
```

**Wrong**
```typescript
// Empty manifest — no payment methods will appear in the Admin
async function manifestHandler(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ paymentMethods: [] });
}
```

## Preferred pattern

Architecture overview:

```text
Shopper → VTEX Checkout → VTEX Payment Gateway → [Your Connector Middleware] → Acquirer/PSP
                                ↕
                    Configuration Flow (Admin)
```

Recommended TypeScript interfaces for all endpoint contracts:

```typescript
// --- Manifest ---
interface ManifestResponse {
  paymentMethods: Array<{
    name: string;
    allowsSplit: "onCapture" | "onAuthorize" | "disabled";
  }>;
}

// --- Create Payment ---
interface CreatePaymentRequest {
  reference: string;
  orderId: string;
  transactionId: string;
  paymentId: string;
  paymentMethod: string;
  value: number;
  currency: string;
  installments: number;
  card?: {
    holder: string;
    number: string;
    csc: string;
    expiration: { month: string; year: string };
  };
  miniCart: Record<string, unknown>;
  callbackUrl: string;
  returnUrl?: string;
}

interface CreatePaymentResponse {
  paymentId: string;
  status: "approved" | "denied" | "undefined";
  authorizationId: string | null;
  nsu: string | null;
  tid: string | null;
  acquirer: string | null;
  code: string | null;
  message: string | null;
  delayToAutoSettle: number;
  delayToAutoSettleAfterAntifraud: number;
  delayToCancel: number;
  paymentUrl?: string;
}

// --- Cancel Payment ---
interface CancelPaymentResponse {
  paymentId: string;
  cancellationId: string | null;
  code: string | null;
  message: string | null;
  requestId: string;
}

// --- Capture/Settle Payment ---
interface CapturePaymentResponse {
  paymentId: string;
  settleId: string | null;
  value: number;
  code: string | null;
  message: string | null;
  requestId: string;
}

// --- Refund Payment ---
interface RefundPaymentResponse {
  paymentId: string;
  refundId: string | null;
  value: number;
  code: string | null;
  message: string | null;
  requestId: string;
}

// --- Inbound Request ---
interface InboundResponse {
  requestId: string;
  paymentId: string;
  responseData: {
    statusCode: number;
    contentType: string;
    content: string;
  };
}
```

Complete payment flow router with all 6 endpoints:

```typescript
import { Router, Request, Response } from "express";

const router = Router();

router.get("/manifest", async (_req: Request, res: Response) => {
  res.status(200).json({
    paymentMethods: [
      { name: "Visa", allowsSplit: "onCapture" },
      { name: "Mastercard", allowsSplit: "onCapture" },
      { name: "Pix", allowsSplit: "disabled" },
    ],
  });
});

router.post("/payments", async (req: Request, res: Response) => {
  const body: CreatePaymentRequest = req.body;
  const result = await processWithAcquirer(body);

  const response: CreatePaymentResponse = {
    paymentId: body.paymentId,
    status: result.status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: result.code ?? null,
    message: result.message ?? null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  };
  res.status(200).json(response);
});

router.post("/payments/:paymentId/cancellations", async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const { requestId } = req.body;
  const result = await cancelWithAcquirer(paymentId);

  res.status(200).json({
    paymentId,
    cancellationId: result.cancellationId ?? null,
    code: result.code ?? null,
    message: result.message ?? "Successfully cancelled",
    requestId,
  });
});

router.post("/payments/:paymentId/settlements", async (req: Request, res: Response) => {
  const body = req.body;
  const result = await captureWithAcquirer(body.paymentId, body.value);

  res.status(200).json({
    paymentId: body.paymentId,
    settleId: result.settleId ?? null,
    value: result.capturedValue ?? body.value,
    code: result.code ?? null,
    message: result.message ?? null,
    requestId: body.requestId,
  });
});

router.post("/payments/:paymentId/refunds", async (req: Request, res: Response) => {
  const body = req.body;
  const result = await refundWithAcquirer(body.paymentId, body.value);

  res.status(200).json({
    paymentId: body.paymentId,
    refundId: result.refundId ?? null,
    value: result.refundedValue ?? body.value,
    code: result.code ?? null,
    message: result.message ?? null,
    requestId: body.requestId,
  });
});

router.post("/payments/:paymentId/inbound-request/:action", async (req: Request, res: Response) => {
  const body = req.body;
  const result = await handleInbound(body);

  res.status(200).json({
    requestId: body.requestId,
    paymentId: body.paymentId,
    responseData: {
      statusCode: 200,
      contentType: "application/json",
      content: JSON.stringify(result),
    },
  });
});

export default router;
```

Configuration flow endpoints (optional, for merchant onboarding):

```typescript
import { Router, Request, Response } from "express";

const configRouter = Router();

// 1. POST /authorization/token
configRouter.post("/authorization/token", async (req: Request, res: Response) => {
  const { applicationId, returnUrl } = req.body;
  const token = await generateAuthorizationToken(applicationId, returnUrl);
  res.status(200).json({ applicationId, token });
});

// 2. GET /authorization/redirect
configRouter.get("/authorization/redirect", async (req: Request, res: Response) => {
  const { token } = req.query;
  const providerLoginUrl = buildProviderLoginUrl(token as string);
  res.redirect(302, providerLoginUrl);
});

// 3. GET /authorization/credentials
configRouter.get("/authorization/credentials", async (req: Request, res: Response) => {
  const { authorizationCode } = req.query;
  const credentials = await exchangeCodeForCredentials(authorizationCode as string);
  res.status(200).json({
    applicationId: "vtex",
    appKey: credentials.appKey,
    appToken: credentials.appToken,
  });
});

export default configRouter;
```

## Common failure modes

- **Partial endpoint implementation** — Implementing only Create Payment and Capture while skipping Manifest, Cancel, Refund, and Inbound Request. The Test Suite tests all endpoints and will fail homologation. At runtime, the Gateway cannot cancel or refund payments.
- **Incorrect HTTP methods** — Using POST for the Manifest endpoint or GET for Create Payment. The Gateway sends specific HTTP methods; mismatched handlers return 404 or 405.
- **Missing or zero delay values** — Omitting `delayToAutoSettle`, `delayToAutoSettleAfterAntifraud`, or `delayToCancel` from the Create Payment response, or setting them to zero. This causes immediate auto-capture or auto-cancel, leading to premature settlement or lost payments.
- **Incomplete response shapes** — Returning only `paymentId` and `status` without `authorizationId`, `tid`, `nsu`, `acquirer`, etc. The Gateway deserializes all fields and treats missing ones as failures.

## Review checklist

- [ ] Are all 6 payment-flow endpoints implemented (Manifest, Create Payment, Cancel, Capture, Refund, Inbound Request)?
- [ ] Does each endpoint return the complete response shape with all required fields?
- [ ] Does the Manifest declare all payment methods the provider actually supports?
- [ ] Are the correct HTTP methods used (GET for Manifest, POST for everything else)?
- [ ] Are `delayToAutoSettle`, `delayToAutoSettleAfterAntifraud`, and `delayToCancel` set to sensible non-zero values?
- [ ] Is the connector served over HTTPS on port 443 with TLS 1.2?
- [ ] Does the connector respond within 5 seconds for test suite and 20 seconds in production?
- [ ] Are configuration flow endpoints implemented if merchant self-onboarding is needed?

## Related skills

- [`payment-idempotency`](../payment-idempotency/skill.md) — Idempotency keys (`paymentId`, `requestId`) and state machine for duplicate prevention
- [`payment-async-flow`](../payment-async-flow/skill.md) — Async payment methods, `callbackUrl`, and the 7-day retry window
- [`payment-pci-security`](../payment-pci-security/skill.md) — PCI compliance, Secure Proxy, and card data handling
- [`vtex-io-application-performance`](../../../vtex-io/skills/vtex-io-application-performance/skill.md) — Per-client timeout/retry tuning, VBase correctness constraints, and structured logging for IO-based payment connectors

## Reference

- [Payment Provider Protocol Overview](https://developers.vtex.com/docs/guides/payment-provider-protocol-api-overview) — API overview with endpoint requirements, common parameters, and test suite info
- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Step-by-step guide covering all 9 endpoints with request/response examples
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — High-level protocol explanation including payment flow diagrams and callback URL usage
- [Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows) — Authorization, capture, and cancellation flow details
- [Payment Provider Protocol API Reference](https://developers.vtex.com/docs/api-reference/payment-provider-protocol) — Full OpenAPI specification for all PPP endpoints
- [Integrating a New Payment Provider on VTEX](https://developers.vtex.com/docs/guides/integrating-a-new-payment-provider-on-vtex) — End-to-end integration guide from development to homologation

---

# sales-app

# Sales App Extensibility

## When this skill applies

Use this skill when building, customizing, or deploying extensions for VTEX Sales App.

- Adding features to the cart page (promotions, loyalty, services)
- Adding features to the Product Detail Page (badges, recommendations, warranties)
- Adding features to the menu (user profile, navigation, metrics)
- Integrating external APIs into Sales App extensions
- Generating, scaffolding, or validating extension code for Sales App

Do not use this skill for:
- Regular FastStore storefront customization (use `faststore-storefront`)
- Building VTEX IO apps (use `vtex-io-*` skills)
- Sales App core development or framework modifications

### Prerequisite: FastStore project

The project root must contain: `biome.json`, `faststore.json`, `package.json`, `tsconfig.json`, `turbo.json`.

If any are missing, **STOP**. The user must install FastStore first:

```bash
npx @vtex/fsp-cli init
# Prompt: "What is the application name?" → enter name or press Enter for default
cd <application-name> && yarn
```

Documentation: https://beta.fast.store/getting-started

### Prerequisite: Sales App module

Inside the FastStore project, a Sales App workspace must exist (typically at `packages/sales-app`) with `src/`, `package.json`, and `tsconfig.json`. Check root `package.json` `"workspaces"` for a path containing `sales-app`. If missing, **STOP**:

```bash
yarn add @vtex/sales-app -D -W
npx fsp create
# Prompts: account name → "Sales App" → path (default or custom)
# Then add the path to root package.json "workspaces" array
yarn install
```

Documentation: https://beta.fast.store/sales-app/setting-up

**Do NOT proceed to discovery or code generation until both prerequisites are confirmed.**

## Decision rules

Follow the mandatory 7-step workflow (Steps 0–6) in order. Do not skip steps.

| Step | Purpose | Gate |
|------|---------|------|
| 0 | Check prerequisites | FastStore + Sales App installed → proceed; otherwise STOP |
| 1 | Discovery | Understand what the user wants to build |
| 2 | Requirements & Plan | Map requirements → generate plan → **wait for user approval** |
| 3 | Code Generation & Validation | Generate `Component.tsx` + `Component.css` (plain CSS, never `.module.css`) + `index.tsx` → validate |
| 4 | Documentation | Generate `docs/<ExtensionName>.md` explaining the extension |
| 5 | Local Testing | Provide dev commands and URLs |
| 6 | Build & Deploy | Build command → deployment guide |

### Extension point selection

| Extension Point | Category | Available Hooks | Layout Shift |
|----------------|----------|----------------|--------------|
| `cart.cart-list.after` | Cart | useCart, useExtension | No |
| `cart.cart-item.after` | Cart | useCart, useCartItem, useExtension | Yes |
| `cart.order-summary.after` | Cart | useCart, useExtension | Yes |
| `pdp.sidebar.before` | PDP | usePDP, useCart, useExtension | Yes |
| `pdp.sidebar.after` | PDP | usePDP, useCart, useExtension | Yes |
| `pdp.content.after` | PDP | usePDP, useCart, useExtension | Yes |
| `menu.item` | Menu | useExtension | No |
| `menu.drawer-content` | Menu | useCurrentUser, useExtension | No |

### Hook availability

- **useCart** → all cart + PDP extensions
- **useCartItem** → `cart.cart-item.after` only
- **useCurrentUser** → `menu.drawer-content` only
- **usePDP** → PDP extensions only
- **useExtension** → all extension points

### Template selection

- No API + no hooks → **simple template**
- No API + hooks → **hook template**
- API + no auth → **API template**
- API + VTEX IO proxy → **IO proxy template** (recommended)
- API + direct auth → **direct auth template** (insecure, warn user)
- API doc provided → generate TypeScript interfaces from extracted response shapes; no API doc → use `${DATA_INTERFACE}` placeholder

### API authentication strategy

1. **Recommended: VTEX IO Proxy App** — IO app stores keys server-side. Extension uses `credentials: 'include'` with a **relative path** (`/_v/my-api/data`).
2. **Insecure: Direct Auth** — Keys in frontend code, visible in browser. Testing/development only.

## Hard constraints

### Constraint: Component must return JSX.Element, never null

`defineExtensions` expects `ExtensionPointComponent` which returns `Element`, not `Element | null`.

**Why this matters**
Returning `null` causes a TypeScript compilation error. The build will fail.

**Detection**
`return null` in any component registered with `defineExtensions`.

**Correct**

```typescript
export function MyExtension(): JSX.Element {
  if (!data) return (<></>);
  return <div>{data.value}</div>;
}
```

**Wrong**

```typescript
export function MyExtension(): JSX.Element | null {
  if (!data) return null;
  return <div>{data.value}</div>;
}
```

### Constraint: Guard optional properties before use

`CartItem.manualPrice` (number | undefined), `CartItem.productRefId` (string | undefined), `CartItem.attachments` (Attachment[] | undefined) must be guarded.

**Why this matters**
TypeScript strict mode rejects accessing possibly-undefined values.

**Detection**
`item.manualPrice`, `item.productRefId`, or `item.attachments` without `?.`, `??`, `&&`, or `!= null`.

**Correct**

```typescript
const price = item.manualPrice ?? item.sellingPrice;
const refId = item.productRefId ?? 'N/A';
const count = item.attachments?.length ?? 0;
```

**Wrong**

```typescript
const price = item.manualPrice;
const refId = item.productRefId.toUpperCase();
const count = item.attachments.length;
```

### Constraint: useCartItem().item may be undefined

`item` from `useCartItem()` is `CartItem | undefined`.

**Why this matters**
Accessing properties on `undefined` causes a runtime crash.

**Detection**
Destructured `item` from `useCartItem()` used without `if (!item)` guard.

**Correct**

```typescript
const { item } = useCartItem();
if (!item) return (<></>);
return <div>{item.name}</div>;
```

**Wrong**

```typescript
const { item } = useCartItem();
return <div>{item.name}</div>;
```

### Constraint: defineExtensions is required in index.tsx

Entry point must use `defineExtensions` from `@vtex/sales-app`.

**Why this matters**
Without it, the build succeeds but no extensions render.

**Detection**
Missing `defineExtensions` import or call in `index.tsx`.

**Correct**

```typescript
import { defineExtensions } from '@vtex/sales-app';
import { MyExtension } from './components/MyExtension';
export default defineExtensions({ 'cart.cart-list.after': MyExtension });
```

**Wrong**

```typescript
import { MyExtension } from './components/MyExtension';
export default { 'cart.cart-list.after': MyExtension };
```

### Constraint: Extension point names must match exactly

IDs are a fixed set. Non-existent names silently fail.

**Why this matters**
The extension renders nowhere. No build error — invisible at runtime.

**Detection**
Any name not in: `cart.cart-list.after`, `cart.cart-item.after`, `cart.order-summary.after`, `pdp.sidebar.before`, `pdp.sidebar.after`, `pdp.content.after`, `menu.item`, `menu.drawer-content`.

**Correct**

```typescript
defineExtensions({ 'cart.cart-list.after': MyExtension });
```

**Wrong**

```typescript
defineExtensions({ 'cart.list.after': MyExtension });
```

### Constraint: Hooks must be used in compatible extension points

Each hook has an `available_in` restriction.

**Why this matters**
Hook context is only mounted for specific extension points. Using elsewhere throws runtime errors.

**Detection**
`useCartItem` in PDP/menu. `useCurrentUser` in cart. `usePDP` in menu/cart-list.

**Correct**

```typescript
// useCartItem in cart.cart-item.after ✓
defineExtensions({ 'cart.cart-item.after': ItemWarranty });
```

**Wrong**

```typescript
// useCartItem in pdp.sidebar.after ✗ — will fail at runtime
defineExtensions({ 'pdp.sidebar.after': ItemWarranty });
```

## Preferred pattern

### Workflow overview

**Step 0** — Check FastStore + Sales App prerequisites. STOP if missing.

**Step 1** — Discovery. Detect use case from keywords, ask follow-up questions, determine API auth strategy. If the user provides API documentation (URL, OpenAPI/Swagger file, Markdown, or inline text), ingest it to extract endpoint details and response shapes — skip the equivalent manual questions. Validate extracted information with the user. Load the [discovery reference](sales-app-sales-app-extensibility-ref-discovery-and-use-cases.md) for detailed question flows and the API Documentation Ingestion section.

**Step 2** — Map requirements to extension point + hooks + template. Present plan listing the files to be created: `components/<ComponentName>.tsx`, `components/<ComponentName>.css` (plain CSS — **never** `.module.css`), and `index.tsx`. Wait for approval.

**Step 3** — Generate `<ComponentName>.tsx`, `<ComponentName>.css` (plain CSS, **never** `.module.css`), and `index.tsx`.

Required references for this step (load before generating):
- [code-templates-and-patterns.md](sales-app-sales-app-extensibility-ref-code-templates-and-patterns.md) — all component templates, the CSS template (with the full Sales App design system inlined: tokens, typography, spacing, responsive), the `index.tsx` template, type generation rules, and the custom fetch hook pattern.
- [extension-points-hooks-and-types.md](sales-app-sales-app-extensibility-ref-extension-points-hooks-and-types.md) — hook return types and TypeScript definitions.
- [static-analysis-rules.md](sales-app-sales-app-extensibility-ref-static-analysis-rules.md) — sandbox security, CSS containment, and React performance rules from `@vtex/fsp-analyzer`. Run these checks on all generated files.
- [design-guidelines.md](sales-app-sales-app-extensibility-ref-design-guidelines.md) — load when the extension renders any UI text (sentence case rule) or uses icons (Phosphor Icons).

If API documentation was ingested in Step 1, generate TypeScript interfaces from the extracted response shapes and use them in the component instead of the `${DATA_INTERFACE}` placeholder. If the extension calls 2+ endpoints, extract fetch logic into custom hook(s). Validate against the 12-point checklist in code-templates-and-patterns.md. Fix all violations before presenting code; surface warnings to the user.

**Step 4** — Generate `docs/<ExtensionName>.md` inside the Sales App package (create the `docs/` folder if needed). Load the [documentation template reference](sales-app-sales-app-extensibility-ref-documentation-template.md) for the required 9-section structure and the markdown skeleton to fill in.

**Step 5** — Provide local dev commands and test URLs. Load the [dev/build/deploy reference](sales-app-sales-app-extensibility-ref-local-dev-build-and-deploy.md).

**Step 6** — Build command and deployment guide. Load the [dev/build/deploy reference](sales-app-sales-app-extensibility-ref-local-dev-build-and-deploy.md).

## Reference Files

Load these on demand based on what the task requires. Do not load all of them upfront.

| File | Load when… |
|------|-----------|
| [references/extension-points-hooks-and-types.md](sales-app-sales-app-extensibility-ref-extension-points-hooks-and-types.md) | Choosing an extension point, selecting hooks, looking up TypeScript types (`CartItem`, `ProductSku`, `Totalizers`, `Attachment`), or checking hook return values and availability per extension point |
| [references/code-templates-and-patterns.md](sales-app-sales-app-extensibility-ref-code-templates-and-patterns.md) | Generating extension code — simple, hook, API, IO Proxy, or Direct Auth templates; **CSS template with the full Sales App design system inlined (tokens, typography, spacing, responsive)**; `index.tsx` with `defineExtensions`; hook initialization; validation checklist |
| [references/discovery-and-use-cases.md](sales-app-sales-app-extensibility-ref-discovery-and-use-cases.md) | Running Step 1 (Discovery) — use case detection keywords, follow-up questions, API auth decision tree, IO Proxy vs Direct Auth flow |
| [references/local-dev-build-and-deploy.md](sales-app-sales-app-extensibility-ref-local-dev-build-and-deploy.md) | Running Steps 5–6 — dev server commands, test URLs, build command, common build errors, FastStore WebOps deployment, monitoring, rollback |
| [references/static-analysis-rules.md](sales-app-sales-app-extensibility-ref-static-analysis-rules.md) | Validating generated code (Step 3) — sandbox security, CSS containment, and React performance rules from `@vtex/fsp-analyzer`; full rule catalog with violation IDs, detection patterns, and correct/wrong examples |
| [references/design-guidelines.md](sales-app-sales-app-extensibility-ref-design-guidelines.md) | Writing UI text (sentence case rule) or using icons (Phosphor Icons). **CSS-related design rules — tokens, typography, spacing, responsive — are inlined directly in the CSS template inside code-templates-and-patterns.md, so this file is not needed for CSS generation.** |
| [references/documentation-template.md](sales-app-sales-app-extensibility-ref-documentation-template.md) | Writing the `docs/<ExtensionName>.md` file in Step 4 — the 9-section structure and markdown skeleton |

## Common failure modes

- **Skipping prerequisite checks** — Generating code without FastStore/Sales App installed. Always confirm both before Step 1.
- **Not presenting plan** — User may want a different approach. Always confirm at Step 2 before generating code.
- **Skipping documentation** — Extension generated without `docs/<ExtensionName>.md`. Load documentation-template.md for the required structure.
- **Inventing API response types** — Generated interface doesn't match actual API. If documentation was provided, derive types from it; if not, ask the user for a sample JSON response.
- **Ignoring provided API documentation** — User provided a URL or file but agent asked manual questions anyway. Always check for documentation first and use the API Documentation Ingestion flow.
- **Inline fetch with 2+ endpoints** — Multiple `fetch` calls inside the component body. Extract into custom hook(s) in `hooks/use{Purpose}.ts`.
- **Placing code outside packages/sales-app/src/** — Files outside this path are not included in the build.

> Code-level violations (DOM APIs, Node imports, eval, CSS containment, React performance, design tokens) are enforced by `@vtex/fsp-analyzer` and caught during Step 3 validation. See [static-analysis-rules.md](sales-app-sales-app-extensibility-ref-static-analysis-rules.md) and [design-guidelines.md](sales-app-sales-app-extensibility-ref-design-guidelines.md).

## Review checklist

**Workflow gates**
- [ ] FastStore installed (biome.json, faststore.json, package.json, tsconfig.json, turbo.json)?
- [ ] Sales App module installed (src/, package.json, tsconfig.json in sales-app directory)?
- [ ] Discovery completed and use case identified?
- [ ] Execution plan approved by user?
- [ ] Extension point is valid (from the 8-point reference)?
- [ ] Hooks compatible with chosen extension point?
- [ ] Documentation generated at `docs/<ExtensionName>.md` (9 sections, using documentation-template.md)?
- [ ] If API documentation was provided, TypeScript interfaces match the documented response shape?
- [ ] If 2+ API endpoints used, fetch logic extracted into custom hook(s) in `hooks/`?
- [ ] Build passes: `yarn fsp build {account} sales-app`?
- [ ] Tested locally: `yarn fsp dev {account}`?

**TypeScript / runtime guards** (not caught by fsp-analyzer)
- [ ] Component returns JSX.Element, never null?
- [ ] Optional properties guarded (manualPrice, productRefId, attachments)?
- [ ] useCartItem().item checked for undefined?
- [ ] defineExtensions configured in index.tsx?

> All other code-level rules (sandbox APIs, CSS containment, React performance, design tokens) are enforced by `@vtex/fsp-analyzer` and checked during Step 3. See [static-analysis-rules.md](sales-app-sales-app-extensibility-ref-static-analysis-rules.md) and [design-guidelines.md](sales-app-sales-app-extensibility-ref-design-guidelines.md).

## Related skills

- `faststore-storefront` — storefront customization outside Sales App
- `vtex-io-app-contract` — building VTEX IO proxy apps for secure API integration

## Reference

- Sales App setup: https://beta.fast.store/sales-app/setting-up
- FastStore getting started: https://beta.fast.store/getting-started
- VTEX Sales App documentation: https://help.vtex.com/en/tracks/instore-getting-started-and-setting-up
- VTEX IO app development: https://developers.vtex.com/docs/guides/vtex-io-documentation-developing-an-app

---

# Custom VTEX IO Apps

# Admin React Interfaces

## When this skill applies

Use this skill when building administrative React interfaces for VTEX Admin experiences.

- Settings pages
- Moderation tools
- Internal dashboards
- Operational forms and tables

Do not use this skill for:
- storefront components
- render-runtime blocks
- route authorization design
- backend service structure

## Decision rules

- Use VTEX official design systems for admin interfaces.
- Prefer `vtex.styleguide` as the default choice for VTEX IO admin apps published to customers.
- Accept `@vtex/shoreline` as an official VTEX design system, especially in internal back-office contexts.
- Prefer core Styleguide layout patterns such as `Layout`, `PageHeader`, and `PageBlock` for page composition.
- Prefer Styleguide building blocks for common admin needs: `Table`, `Input`, `Dropdown`, `Toggle`, `Tabs`, `Modal`, `Spinner`, and `Alert`.
- Keep admin screens focused on operational clarity rather than storefront styling concerns.
- Prefer explicit loading, empty, and error states for data-heavy admin pages.
- Use button loading states and toast-based feedback for async actions so users can tell when a mutation starts, succeeds, or fails.
- Prefer internationalized messages over hardcoded admin copy so labels and feedback can stay consistent across stores and locales.
- Use tables, forms, filters, and feedback patterns that align with VTEX Admin conventions.
- Prefer official design system components over custom clickable `div` or `span` patterns so focus behavior, keyboard navigation, and accessibility attributes remain correct by default.
- For large lists and tables, prefer pagination and server-side filtering over loading everything into the browser and filtering in memory.
- For search and filtering, prefer the search and filter patterns offered by the official design systems instead of inventing custom control behavior.
- Keep labels, messages, and action copy in a single language per app and avoid mixing tones or languages on the same screen.
- In forms, keep actions consistent: use a primary save action, an optional secondary cancel action when appropriate, and explicit feedback after submit.

## Hard constraints

### Constraint: Admin UIs must use VTEX design systems

Admin panel components MUST use VTEX official design systems.

**Why this matters**

VTEX Admin has a consistent design language. VTEX official design systems preserve that consistency, while generic third-party UI libraries create inconsistent visuals, styling conflicts, and review problems.

**Detection**

If you see Material UI, Chakra, Ant Design, or another generic third-party UI system in an admin app, STOP and replace it with VTEX design system patterns. Do not flag `@vtex/shoreline` as third-party.

**Correct**

```tsx
import { Layout, PageHeader, PageBlock, Table } from 'vtex.styleguide'
```

```tsx
import { Button, Table, EmptyState } from '@vtex/shoreline'
```

**Wrong**

```tsx
import { DataGrid } from '@material-ui/data-grid'
```

### Constraint: Admin screens must expose loading, empty, and error states

Operational interfaces MUST make data state visible to the user.

**Why this matters**

Admin users need reliable operational feedback. Silent blank screens are harder to support and diagnose than explicit states.

**Detection**

If a page loads remote data but renders nothing meaningful on loading, empty, or error cases, STOP and add explicit UI states.

**Correct**

```tsx
if (loading) {
  return (
    <PageBlock>
      <Spinner />
    </PageBlock>
  )
}

if (error) {
  return (
    <PageBlock>
      <Alert type="error">Failed to load data. Please try again.</Alert>
    </PageBlock>
  )
}
```

**Wrong**

```tsx
return <Table items={data?.items ?? []} />
```

### Constraint: Admin actions must provide explicit user feedback

Mutations in admin screens MUST report success, failure, or pending state clearly.

**Why this matters**

Operational actions affect real store configuration and data. Users need immediate feedback to avoid repeated or ambiguous actions.

**Detection**

If a button triggers a write action with no feedback on result, STOP and add explicit feedback.

**Correct**

```tsx
<Button isLoading={saving}>Save</Button>
showToast({ message: 'Settings saved successfully' })
```

**Wrong**

```tsx
<Button onClick={save}>Save</Button>
```

### Constraint: Data-heavy admin screens must stay bounded and navigable

Lists, tables, and search-heavy admin screens MUST use bounded rendering patterns such as pagination and should prefer server-side filtering when the API supports it.

**Why this matters**

Admin pages often deal with operational datasets that grow over time. Rendering too many rows at once or filtering only in memory creates poor performance and brittle UX.

**Detection**

If a page renders very large collections without pagination, or loads the full dataset into the browser just to filter locally, STOP and add bounded navigation or server-side filtering.

**Correct**

```tsx
<Table items={items} />
<Pagination currentItemFrom={1} currentItemTo={10} totalItems={120} />
```

**Wrong**

```tsx
const filtered = allItems.filter(matchesSearch)
return <Table items={filtered} />
```

### Constraint: Interactive controls must use accessible semantics

Admin interactions MUST use accessible controls and should prefer official design system components instead of custom clickable non-semantic elements.

**Why this matters**

Keyboard navigation, focus handling, and screen-reader behavior are part of baseline admin usability. Non-semantic clickable elements make accessibility regressions much more likely.

**Detection**

If you see clickable `div` or `span` elements being used as primary controls where a button, link, or design system component should be used, STOP and replace them.

**Correct**

```tsx
<Button variation="primary">Save</Button>
```

**Wrong**

```tsx
<div onClick={save}>Save</div>
```

## Admin builder structure

Admin pages in VTEX IO are exposed through the Admin builder:

- Use the `admin/` folder to declare navigation and routes.
- Use `admin/navigation.json` to define sections, subsections, and Admin navigation paths.
- Use `admin/routes.json` to map each Admin path to a React component implemented under `react/`.
- Use the `react/` folder to implement the page components used by Admin routes.

Practical rules:

- Each entry in `admin/routes.json` should point to a real component in `react/`.
- The route `path` should stay aligned with the navigation structure declared in `admin/navigation.json`.
- Page components should use VTEX Admin layout patterns such as `Layout`, `PageHeader`, and `PageBlock`, or official Shoreline equivalents in internal contexts.

### Example: navigation.json structure

`admin/navigation.json`:

```json
[
  {
    "section": "storeSettings",
    "subSection": "storeFront",
    "subSectionItems": [
      {
        "labelId": "admin/my-settings.navigation.title",
        "path": "/admin/app/my-settings"
      }
    ]
  }
]
```

Main fields:

- `section` / `subSection`: define where the link appears in the Admin navigation tree.
- `subSectionItems[].path`: should match the `path` declared in `admin/routes.json`.
- `titleId` / `labelId`: message IDs used to internationalize navigation labels.
- `adminVersion`: optional and only needed for compatibility between legacy and newer Admin experiences. Do not use it in the default example for new apps.

### Example: tying Admin builder to a React page

`admin/routes.json`:

```json
{
  "admin.app.my-settings": {
    "component": "MySettingsPage",
    "path": "/admin/app/my-settings"
  }
}
```

`react/MySettingsPage.tsx`:

```tsx
import React from 'react'
import { Layout, PageHeader, PageBlock } from 'vtex.styleguide'

const MySettingsPage: React.FC = () => (
  <Layout pageHeader={<PageHeader title="My settings" />}>
    <PageBlock>
      {/* Page content goes here */}
    </PageBlock>
  </Layout>
)

export default MySettingsPage
```

## Preferred pattern

Use VTEX design systems to keep operational state explicit and optimize for clarity over ornamental UI.
Use `PageHeader` and `PageBlock` with Styleguide where appropriate, or equivalent official Shoreline patterns in internal contexts. Use `Spinner`/`Alert`/`EmptyState` for data states and `showToast` plus button loading states for async feedback.
Use paginated tables for large datasets, prefer server-side filtering when possible, and keep form actions consistent with primary save and optional cancel behavior.

## Common failure modes

- Using third-party UI libraries in admin apps.
- Omitting loading, empty, or error states.
- Triggering mutations without visible feedback.
- Rendering large tables without pagination or filtering everything only in memory.
- Building clickable controls with non-semantic elements instead of accessible buttons or links.
- Mixing languages or inconsistent copy style on the same admin screen.

## Review checklist

- [ ] Does the screen use VTEX official design systems (Styleguide or Shoreline), not generic UI libs?
- [ ] Does the page use `PageHeader` and `PageBlock` layout patterns where appropriate (or Shoreline equivalents)?
- [ ] Are loading, empty, and error states explicit?
- [ ] Are large tables or lists paginated and filtered in a scalable way?
- [ ] Are write actions safe and visible?
- [ ] Are interactive controls using accessible semantics instead of clickable non-semantic elements?
- [ ] Are labels and feedback messages internationalized instead of hardcoded?
- [ ] Is the app using one consistent language and tone for labels and actions?
- [ ] Does the UI look and behave like a VTEX Admin tool?

## Reference

- [Admin apps](https://developers.vtex.com/docs/guides/vtex-io-documentation-admin-builder) - Admin builder context
- [Shoreline repository](https://github.com/vtex/shoreline) - Official VTEX Shoreline design system repository
- [Shoreline docs](https://admin-ui.vercel.app/) - Shoreline component and design system documentation

---

# App Contract & Builder Boundaries

## When this skill applies

Use this skill when the main decision is about what a VTEX IO app is, what capabilities it declares, and which integration boundaries it publishes through `manifest.json`.

- Creating a new VTEX IO app and defining its initial contract
- Adding or removing builders to match app capabilities
- Choosing between `dependencies` and `peerDependencies`
- Deciding whether a capability belongs in the current app or should move to another app
- Troubleshooting link or publish failures caused by manifest-level contract issues

Do not use this skill for:
- service runtime behavior such as `service.json`, memory, workers, or route exposure
- HTTP handler implementation, middleware composition, or event processing
- GraphQL schema, resolver, or data-fetching implementation
- storefront, admin, or render-runtime frontend behavior
- policy modeling and security boundary enforcement

## Decision rules

- Treat `manifest.json` as the app contract. It declares identity, builders, dependencies, peer dependencies, and high-level capabilities that other apps or the platform rely on.
- Add a builder only when the app truly owns that capability. Builders are not placeholders for future work.
- Keep the contract narrow. If a manifest starts to represent unrelated concerns, split those concerns into separate apps instead of creating a catch-all app.
- Use `dependencies` only for apps that can be safely auto-installed as part of the current app contract. Use `peerDependencies` for apps that must already exist in the environment, remain externally managed, or declare `billingOptions`.
- Keep naming and versioning publishable: `vendor`, `name`, and `version` must form a stable identity that can be linked, published, and consumed safely.
- Keep `billingOptions` aligned with the commercial contract of the app. If the app has billing implications, declare them explicitly in the manifest rather than leaving pricing behavior implicit.
- Apps that declare `billingOptions` cannot be consumed through `dependencies`. If the current app requires a billable app, model that relationship with `peerDependencies` and require manual installation by the account or edition owner.
- Edition apps are compositions of app contracts, not exceptions to them. Keep each underlying app contract explicit, narrow, and semver-safe so composition stays predictable across host environments.
- `manifest.json` can also declare app-level permissions and configuration surfaces, but detailed policy modeling belongs in security-focused skills and detailed `settingsSchema` design belongs in app-settings skills.

This is not an exhaustive list of builders; see the official Builders docs for the full catalog.

Builder ownership reference:

| Builder | Own this builder when the app contract includes |
|---------|--------------------------------------------------|
| `node` | backend runtime capability owned by this app |
| `graphql` | GraphQL schema exposure owned by this app |
| `react` | React bundles owned by this app |
| `admin` | Admin UI surfaces owned by this app |
| `store` | Store Framework block registration owned by this app |
| `messages` | localized message bundles owned by this app |
| `pixel` | storefront pixel injection owned by this app |
| `masterdata` | Master Data schema assets owned by this app |

Contract boundary heuristic:
1. If the capability is shipped, versioned, and maintained with this app, declare its builder here.
2. If the capability is only consumed from another app, declare a dependency instead of duplicating the builder.
3. If the capability introduces a separate runtime, security model, or release cadence, consider splitting it into another app.

## Hard constraints

### Constraint: Every shipped capability must be declared in the manifest contract

If the app ships a processable VTEX IO capability, `manifest.json` MUST declare the corresponding builder. Do not rely on folder presence alone, and do not assume VTEX IO infers capabilities from the repository structure.
Symmetrically, do not declare builders for capabilities that are not actually shipped by this app.

**Why this matters**

VTEX IO compiles and links apps based on declared builders, not on intent. If the builder is missing, the platform ignores that capability and the app contract becomes misleading. The app may link partially while the expected feature is absent.

**Detection**

If you see a maintained `/node`, `/react`, `/graphql`, `/admin`, `/store`, `/messages`, `/pixel`, or `/masterdata` directory, STOP and verify that the matching builder exists in `manifest.json`. If the builder exists but the capability does not, STOP and remove the builder or move the capability back into scope.

**Correct**

```json
{
  "vendor": "acme",
  "name": "reviews-platform",
  "version": "0.4.0",
  "builders": {
    "node": "7.x",
    "graphql": "1.x",
    "messages": "1.x"
  }
}
```

**Wrong**

```json
{
  "vendor": "acme",
  "name": "reviews-platform",
  "version": "0.4.0",
  "builders": {
    "messages": "1.x"
  }
}
```

The app ships backend and GraphQL capabilities but declares only `messages`, so the runtime contract is incomplete and the platform ignores the missing builders.

### Constraint: App identity and versioning must stay publishable and semver-safe

The `vendor`, `name`, and `version` fields MUST identify a valid VTEX IO app contract. Use kebab-case for the app name, keep the vendor consistent with ownership, and use full semantic versioning.

**Why this matters**

Consumers, workspaces, and release flows rely on app identity stability. Invalid names or incomplete versions break linking and publishing, while identity drift creates unsafe upgrades and hard-to-debug dependency mismatches.

**Detection**

If you see uppercase characters, underscores, non-semver versions, or vendor/name changes mixed into unrelated work, STOP and validate whether the change is intentional and release-safe.

**Correct**

```json
{
  "vendor": "acme",
  "name": "order-status-dashboard",
  "version": "2.1.0"
}
```

**Wrong**

```json
{
  "vendor": "AcmeTeam",
  "name": "Order_Status_Dashboard",
  "version": "2.1"
}
```

This identity is not safely publishable because the name is not kebab-case and the version is not valid semver.

### Constraint: Dependencies and peerDependencies must express installation intent correctly

Use `dependencies` only for apps that this app should install as part of its contract and that can be auto-installed safely. Use `peerDependencies` for apps that must already be present in the environment, should remain externally managed, or declare `billingOptions`.

**Why this matters**

This is the core contract boundary between your app and the rest of the VTEX IO workspace. Misclassifying a relationship causes broken installations, hidden coupling, and environment-specific behavior that only appears after link or publish. In particular, builder-hub rejects dependencies on apps that declare `billingOptions`.

**Detection**

If the app requires another app to function in every environment, STOP and confirm whether it belongs in `dependencies` or `peerDependencies`. If the target app declares `billingOptions`, STOP and move it to `peerDependencies`. If the app only integrates with a platform capability, host app, edition-managed app, or paid app that the account is expected to manage manually, STOP and keep it out of `dependencies`.

**Correct**

```json
{
  "dependencies": {
    "vtex.search-graphql": "0.x"
  },
  "peerDependencies": {
    "vtex.store": "2.x",
    "vtex.paid-app-example": "1.x"
  }
}
```

**Wrong**

```json
{
  "dependencies": {
    "vtex.store": "2.x",
    "vtex.paid-app-example": "1.x"
  },
  "peerDependencies": {}
}
```

This contract hard-installs a host app that should usually be externally managed and also attempts to auto-install a billable app, which builder-hub rejects.

## Preferred pattern

Start by deciding the smallest useful contract for the app, then declare only the identity and builders required for that contract.

Recommended manifest for a focused service-plus-GraphQL app:

```json
{
  "vendor": "acme",
  "name": "reviews-platform",
  "version": "0.1.0",
  "title": "Reviews Platform",
  "description": "VTEX IO app that owns review APIs and review GraphQL exposure",
  "builders": {
    "node": "7.x",
    "graphql": "1.x",
    "messages": "1.x"
  },
  "billingOptions": {
    "type": "free"
  },
  "dependencies": {
    "vtex.search-graphql": "0.x"
  },
  "peerDependencies": {
    "vtex.store": "2.x"
  }
}
```

Recommended contract split:

```text
reviews-platform/
├── manifest.json        # identity, builders, dependencies, peerDependencies
├── node/                # backend capability owned by this app
├── graphql/             # GraphQL capability owned by this app
└── messages/            # app-owned translations

reviews-storefront/
├── manifest.json        # separate release surface for storefront concerns
├── react/
└── store/
```

Use this split when the backend/API contract and the storefront contract have different ownership, release cadence, or integration boundaries.

## Common failure modes

- Declaring builders for aspirational capabilities that the app does not yet own, which makes the contract broader than the real implementation.
- Using one large manifest to represent backend runtime, frontend rendering, settings, policies, and integration concerns that should be separated into multiple skills or apps.
- Putting host-level apps in `dependencies` when they should remain `peerDependencies`.
- Pinning exact dependency versions instead of major-version ranges such as `0.x`, `1.x`, or `3.x`.
- Treating `manifest.json` as a dumping ground for runtime or security details that belong in more specific skills.
- Modeling `settingsSchema` here instead of using this skill only to decide whether app-level configuration belongs in the contract at all.

## Review checklist

- [ ] Does the manifest describe only capabilities this app actually owns and ships?
- [ ] Does every shipped capability have a matching builder declaration?
- [ ] Is the app identity publishable: valid `vendor`, kebab-case `name`, and full semver `version`?
- [ ] If the app has billing behavior, is `billingOptions` explicit and aligned with the app contract?
- [ ] Are `dependencies` and `peerDependencies` separated by installation intent?
- [ ] Would splitting the contract into two apps reduce unrelated concerns or release coupling?
- [ ] Are runtime, route, GraphQL implementation, frontend, and security details kept out of this skill?

## Reference

- [Manifest](https://developers.vtex.com/docs/guides/vtex-io-documentation-manifest) - Complete reference for `manifest.json` fields
- [Builders](https://developers.vtex.com/docs/guides/vtex-io-documentation-builders) - Builder catalog and capability mapping
- [Dependencies](https://developers.vtex.com/docs/guides/vtex-io-documentation-dependencies) - Dependency and peer dependency behavior in VTEX IO
- [Billing Options](https://developers.vtex.com/docs/guides/vtex-io-documentation-manifest#billingoptions) - How app billing behavior is declared in the manifest
- [Creating the New App](https://developers.vtex.com/docs/guides/vtex-io-documentation-3-creating-the-new-app) - App initialization flow and manifest basics

---

# App Settings & Configuration Boundaries

## When this skill applies

Use this skill when deciding or implementing how a VTEX IO app should expose configurable settings.

- Defining `settingsSchema`
- Adding merchant-configurable app behavior
- Reviewing whether configuration belongs in app settings or custom data
- Reading and validating settings in app code

Do not use this skill for:
- runtime infrastructure settings in `service.json`
- Master Data entity design
- policy declaration details
- route auth modeling

## Decision rules

- Use app settings for stable configuration that merchants or operators should be able to manage explicitly.
- Use `settingsSchema` for app-level configuration managed through VTEX Admin, and use `store/contentSchemas.json` for Store Framework block configuration that varies by page or block instance.
- If the value is global for the app or account, it usually belongs in `settingsSchema`. If it varies per page, block, or theme composition, it usually belongs in `contentSchemas.json`.
- Do not use app settings as a substitute for high-volume operational data storage.
- Use JSON Schema explicitly with `properties`, `required`, `default`, `enum`, `format`, and related constraints instead of a generic root `type: object` only.
- Use `settingsSchema.access: "public"` only for non-sensitive values that are intentionally safe to expose to frontend code through `publicSettingsForApp`.
- If `access` is omitted, do not assume frontend GraphQL consumers can read the settings. Public frontend access must be an explicit choice.
- Use app settings for API keys, tokens, and secrets instead of hardcoding them in the codebase.
- Never expose secrets from app settings directly in HTTP responses, GraphQL responses, HTML, or browser-side props.
- Never expose secrets from app settings in logs either.
- For sensitive fields such as API keys or passwords, keep them as `type: "string"` and consider marking them with `format: "password"`. Some platform consumers, such as Apps GraphQL when using `hidePasswords`, may use this metadata to mask values in responses. Do not rely on this as the only security layer: secrets must still be treated as backend-only and never exposed in responses or logs.
- UI-specific hints such as `ui:widget: "password"` may be supported by some renderers, but they are not part of the core JSON Schema guarantees. Do not assume the standard VTEX Admin App Settings UI will enforce them.
- Read backend settings through `ctx.clients.apps.getAppSettings(ctx.vtex.appId ?? process.env.VTEX_APP_ID)` and centralize normalization or validation in a helper instead of spreading ad hoc access patterns through handlers.
- When reading or saving this app's own settings at runtime, use the correct app identifier such as `process.env.VTEX_APP_ID` or `ctx.vtex.appId` and rely on the app token plus standard app-settings permissions. Do not declare extra License Manager policies in `manifest.json` or add workspace-wide policies such as `read-workspace-apps` or undocumented policies such as `write-workspace-apps` just to "fix" a 403.
- Pixel apps that need configuration should also consume settings through `ctx.clients.apps.getAppSettings(...)` on the backend side of the pixel app. If a value must be available to injected JavaScript, expose only non-sensitive fields through `access: "public"` and `publicSettingsForApp`, keeping secrets strictly on the server side.
- Make code resilient to missing or incomplete settings by validating or applying defaults at the consumption boundary.
- Never assume settings are identical across accounts or workspaces. Each workspace may have different app configuration during development, rollout, or debugging.

Settings vs configuration builder:

- Use `settingsSchema` when the configuration is specific to this app and the merchant is expected to edit it in Apps > App Settings.
- Consider a separate app using the `configuration` builder when the configuration contract needs to be shared across multiple apps, managed separately from the runtime app lifecycle, or injected directly into service context through `ctx.vtex.settings`.
- Prefer a configuration app when the main goal is structured service configuration delivered through VTEX IO runtime context, instead of settings fetched ad hoc by the app itself.

## Hard constraints

### Constraint: Configurable app behavior must have a schema

Merchant-configurable settings MUST be modeled through an explicit schema instead of ad hoc unvalidated objects.

**Why this matters**

Without a schema, configuration becomes ambiguous, harder to validate, and easier to break across environments.

**Detection**

If code depends on app-level configuration but no schema or validation contract exists, STOP and define it first.

**Correct**

```json
{
  "settingsSchema": {
    "title": "My App Settings",
    "type": "object",
    "properties": {
      "enableModeration": {
        "title": "Enable moderation",
        "type": "boolean",
        "default": false,
        "description": "If true, new content will require approval before going live."
      },
      "apiKey": {
        "title": "External API key",
        "type": "string",
        "minLength": 1,
        "description": "API key for the external moderation service.",
        "format": "password"
      },
      "mode": {
        "title": "Mode",
        "type": "string",
        "enum": ["sandbox", "production"],
        "default": "sandbox"
      }
    },
    "required": ["apiKey"]
  }
}
```

**Wrong**

```typescript
const settings = ctx.state.anything
```

### Constraint: Sensitive settings must stay backend-only and must not be exposed to the frontend

Secrets stored in app settings such as API keys, tokens, or passwords MUST be treated as backend-only configuration.

**Why this matters**

App settings are a natural place for secrets, but exposing them in HTTP responses, GraphQL payloads, HTML, or frontend props turns configuration into a security leak.

**Detection**

If a route, resolver, or frontend-facing response returns raw settings or includes sensitive fields from settings, STOP and move the external call or secret usage fully to the backend boundary.

**Correct**

```typescript
const { apiKey } = await ctx.clients.apps.getAppSettings(
  ctx.vtex.appId ?? process.env.VTEX_APP_ID
)
const result = await externalClient.fetchData({ apiKey })

ctx.body = result
```

**Wrong**

```typescript
const settings = await ctx.clients.apps.getAppSettings(
  ctx.vtex.appId ?? process.env.VTEX_APP_ID
)
ctx.body = settings
```

### Constraint: Public app settings access must never expose sensitive configuration

If `settingsSchema.access` is set to `public`, the exposed settings MUST contain only values that are safe to ship to frontend code through `publicSettingsForApp`.

**Why this matters**

`access: "public"` is a delivery choice, not a security control. Once settings are publicly exposed, storefront or frontend code can read them, so secrets and backend-only configuration must never be included there.

**Detection**

If a settings schema marks access as public and includes API keys, tokens, passwords, or any value intended only for backend integrations, STOP and keep those settings private.

**Correct**

```json
{
  "settingsSchema": {
    "title": "Public Storefront Settings",
    "type": "object",
    "access": "public",
    "properties": {
      "bannerText": {
        "title": "Banner text",
        "type": "string"
      }
    }
  }
}
```

**Wrong**

```json
{
  "settingsSchema": {
    "title": "My App Settings",
    "type": "object",
    "access": "public",
    "properties": {
      "apiKey": {
        "title": "External API key",
        "type": "string",
        "format": "password"
      }
    }
  }
}
```

### Constraint: Settings must not be used as operational data storage

App settings MUST represent configuration, not high-volume mutable records.

**Why this matters**

Settings are for configuration boundaries, not for transactional or large-scale operational data.

**Detection**

If a proposed setting stores records that behave like orders, reviews, logs, or queue items, STOP and move that concern to a more appropriate data mechanism.

**Correct**

```json
{
  "enableModeration": true
}
```

**Wrong**

```json
{
  "allReviews": []
}
```

### Constraint: Code must validate or default settings at the consumption boundary

Settings-dependent code MUST tolerate missing or incomplete values safely.

**Why this matters**

Configuration can drift across workspaces and accounts. Code that assumes every setting is present becomes fragile.

**Detection**

If code reads settings and assumes required fields always exist with no validation or defaults, STOP and make the dependency explicit.

**Correct**

```typescript
const rawSettings = await ctx.clients.apps.getAppSettings(
  ctx.vtex.appId ?? process.env.VTEX_APP_ID
)
const settings = normalizeSettings(rawSettings)
const enabled = settings.enableModeration ?? false
```

**Wrong**

```typescript
const enabled = settings.enableModeration.value
```

## Preferred pattern

Use settings for stable, merchant-managed configuration, define them with explicit JSON Schema properties, and validate or normalize them where they are consumed.
For secrets, keep the read and the external call on the backend and return only the business result to the frontend.
Use frontend GraphQL access only for intentionally public settings, and keep backend-only settings behind `getAppSettings(...)`.

## Common failure modes

- Using settings as operational storage.
- Using only `type: object` without explicit `properties` and validation details.
- Reading settings without defaults or validation.
- Exposing raw settings or secrets to the frontend.
- Marking settings as `access: "public"` when they contain backend-only or sensitive values.
- Logging settings or secrets in plain text.
- Hardcoding API keys or tokens instead of storing them in app settings.
- Adding workspace-level policies such as `read-workspace-apps` or invalid policies such as `write-workspace-apps` as a generic workaround for app settings permission errors, instead of validating the correct appId and standard app-settings permissions.
- Using `settingsSchema` when the requirement is really block-level Store Framework configuration.
- Creating schemas that are too broad or vague.

## Review checklist

- [ ] Does this data really belong in app settings?
- [ ] Does the `settingsSchema` declare explicit `properties` with clear types and `required` only where necessary?
- [ ] Are sensitive fields represented safely, for example as `string` fields with `format: "password"`, knowing that some consumers such as Apps GraphQL with `hidePasswords` may use that metadata to mask the output?
- [ ] Does the consuming code validate or default missing values?
- [ ] Are secrets kept backend-only and never exposed to the frontend?
- [ ] If `access: "public"` is used, are all exposed settings intentionally safe for frontend consumption?
- [ ] Is the settings surface small and intentional?

## Reference

- [Manifest](https://developers.vtex.com/docs/guides/vtex-io-documentation-manifest) - App configuration contract
- [Creating an interface for your app settings](https://developers.vtex.com/docs/guides/vtex-io-documentation-creating-an-interface-for-your-app-settings) - `settingsSchema`, `access`, frontend queries, and backend settings consumption
- [Configuring your app settings](https://developers.vtex.com/docs/guides/vtex-io-documentation-4-configuringyourappsettings) - Pixel app example for consuming app settings in VTEX IO

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

- [vtex-io-service-paths-and-cdn](../vtex-io-service-paths-and-cdn/skill.md) — Edge paths, cookies, CDN
- [vtex-io-session-apps](../vtex-io-session-apps/skill.md) — Session transforms (caching patterns apply inside transforms)
- [vtex-io-service-apps](../vtex-io-service-apps/skill.md) — Clients, middleware, Service
- [vtex-io-graphql-api](../vtex-io-graphql-api/skill.md) — GraphQL caching
- [vtex-io-app-contract](../vtex-io-app-contract/skill.md) — Manifest, policies

## Reference

- [VTEX IO Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — `vbase` client methods
- [Implementing cache in GraphQL APIs for IO apps](https://developers.vtex.com/docs/guides/implementing-cache-in-graphql-apis-for-io-apps) — SEGMENT cache and cookies
- [Engineering guidelines](https://developers.vtex.com/docs/guides/vtex-io-documentation-engineering-guidelines) — Scalability and IO development practices
- [App Development](https://developers.vtex.com/docs/app-development) — VTEX IO app development hub

---

# Authorization & Policy Design

## When this skill applies

Use this skill when a VTEX IO app needs explicit permissions to call external services, consume VTEX resources, or expose access-controlled behavior.

- Adding an external API integration
- Consuming VTEX resources that require declared permissions
- Reviewing whether a route or client needs policy changes
- Tightening app permissions around an existing integration

Do not use this skill for:
- service runtime tuning
- HTTP handler structure
- frontend UI authorization behavior
- broader trust-boundary or sensitive-data modeling
- choosing between `AUTH_TOKEN`, `STORE_TOKEN`, and `ADMIN_TOKEN`

## Decision rules

- Treat `manifest.json` policies as explicit declarations of what the app is allowed to access.
- Use this skill to decide what the app is authorized to do, not which runtime token identity should make the call.
- Add only the policies required for the integrations and resources the app actually uses.
- Use License Manager policies when the app needs access to VTEX platform resources protected by LM resource keys.
- Use app policies such as `"vendor.app-name:policy-name"` when the app consumes resources or operations exposed by another VTEX IO app through role-based policies.
- Use `outbound-access` when the app needs to call external HTTP services or URLs that are not covered by License Manager or app policies.
- Prefer narrowly scoped outbound-access declarations over wildcard hosts or paths.
- When exposing your own routes or operations, define access on the server side through resource-based policies, route protections, or auth directives instead of assuming consumers will declare something in their own manifest.
- A VRN (VTEX Resource Name) is the internal identifier format VTEX uses for resources and identities. Role-based policies use `resources` expressed as VRNs, and resource-based policies use `principals` expressed as VRNs.
- Use VRNs only where the platform expects them, especially in `service.json` resource-based policies or when interpreting authorization errors. Do not generate VRNs in `manifest.json` for consumer-side policy declarations.
- In resource-based policies, multiple `principals` are evaluated as alternatives, and explicit `deny` rules override `allow` rules.
- When exposing your own role-based policies, keep them minimal and operation-specific rather than broad catch-all permissions.
- Review policy requirements when adding a new client, external integration, or service route that depends on protected access.
- Keep route implementation and policy declaration aligned: if a route depends on a protected integration, make sure the permission boundary is visible and intentional.

Policy types at a glance:

- License Manager policy:

```json
{
  "policies": [
    { "name": "Sku.aspx" }
  ]
}
```

- App policy:

```json
{
  "policies": [
    { "name": "vtex.messages:graphql-translate-messages" }
  ]
}
```

- Outbound-access policy:

```json
{
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "partner.example.com",
        "path": "/api/*"
      }
    }
  ]
}
```

- Resource-based route policy with app principal VRN:

```json
{
  "routes": {
    "privateStatus": {
      "path": "/_v/private/status/:code",
      "public": false,
      "policies": [
        {
          "effect": "allow",
          "actions": ["POST"],
          "principals": [
            "vrn:apps:*:my-sponsor-account:*:app/vendor.partner-app@0.x"
          ]
        }
      ]
    }
  }
}
```

This route allows a specific IO app principal. Other apps remain denied by default because they do not match any allow rule.

- Resource-based route policy with VTEX ID principal VRN:

```json
{
  "routes": {
    "status": {
      "path": "/_v/status/:code",
      "public": false,
      "policies": [
        {
          "effect": "allow",
          "actions": ["POST"],
          "principals": [
            "vrn:vtex.vtex-id:-:bibi:-:user/vtexappkey-mcc77-HBXYAE"
          ]
        },
        {
          "effect": "deny",
          "actions": ["POST"],
          "principals": [
            "vrn:vtex.vtex-id:-:bibi:-:user/*@vtex.com"
          ]
        }
      ]
    }
  }
}
```

This is an advanced pattern for integrations that identify callers through a specific VTEX ID principal, including appkey-based contracts. Prefer app VRNs for IO-to-IO access when the caller is another VTEX IO app. VTEX IO auth tokens such as `AUTH_TOKEN`, `STORE_TOKEN`, and `ADMIN_TOKEN` play a different role: they authenticate requests to VTEX services and help preserve requester context, but they do not automatically replace route-level resource policies based on VRN principals.

## Hard constraints

### Constraint: Every protected integration must have an explicit supporting policy

If a client or route depends on access controlled by License Manager policies, role-based app policies, or `outbound-access`, the app MUST declare the corresponding permission explicitly in `manifest.json`. Resources protected by resource-based policies define access on the server side and do not require consumer apps to declare additional policies just for that server-side enforcement.

**Why this matters**

Without the required policy, the code may be correct but the platform will still block the access at runtime, leading to failures that are hard to debug from handler code alone.

**Detection**

If you see a new external host, VTEX resource, or protected capability being consumed, STOP and verify that the required consumer-side policy exists before merging the code. If the app is exposing a protected route or operation, STOP and confirm that the access rule is also enforced on the server side.

**Correct**

```json
{
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "partner.example.com",
        "path": "/api/*"
      }
    }
  ]
}
```

**Wrong**

```json
{
  "policies": []
}
```

### Constraint: Outbound policies must follow least privilege

Outbound-access policies MUST be scoped as narrowly as practical for the target host and path.

**Why this matters**

Broad outbound rules increase risk, make reviews harder, and allow integrations to expand silently beyond their intended surface.

**Detection**

If you see wildcard hosts or overly broad paths when the integration uses a much smaller surface, STOP and narrow the declaration.

**Correct**

```json
{
  "name": "outbound-access",
  "attrs": {
    "host": "partner.example.com",
    "path": "/orders/*"
  }
}
```

**Wrong**

```json
{
  "name": "outbound-access",
  "attrs": {
    "host": "*",
    "path": "/*"
  }
}
```

### Constraint: Policy changes must be reviewed together with the behavior they enable

When a policy is added or widened, the route or integration behavior that depends on it MUST be reviewed in the same change.

**Why this matters**

Permissions are meaningful only in context. Reviewing a policy change without the code that consumes it makes overreach and hidden side effects easier to miss.

**Detection**

If a PR changes `manifest.json` permissions without showing the relevant route, client, or integration code, STOP and request the linked behavior before approving.

**Correct**

```json
{
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "partner.example.com",
        "path": "/orders/*"
      }
    }
  ]
}
```

**Wrong**

```json
{
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "partner.example.com",
        "path": "/api/*"
      }
    }
  ]
}
```

This broader policy alone does not explain why the app needs the expanded access.

## Preferred pattern

Start from the client or route behavior, identify the minimal access needed, and declare only that permission in `manifest.json`. When the app exposes protected routes or operations, define the resource-based access rule on the server side as part of the same review.

Example pattern:

```json
{
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "partner.example.com",
        "path": "/orders/*"
      }
    }
  ]
}
```

Review permissions whenever integrations change, not only when policy errors appear in runtime.

## Common failure modes

- Forgetting the outbound-access policy for a new external integration.
- Using an outbound-access policy when the real requirement is a License Manager resource key or an app policy exposed by another VTEX IO app.
- Using wildcard hosts or paths when a narrower declaration would work.
- Assuming consumer apps must declare manifest policies for resources that are actually enforced through resource-based policies on the server side.
- Adding permissions without reviewing the route or client behavior they enable.
- Treating policy failures as code bugs instead of permission bugs.
- Treating a `403` that names a VRN resource or principal as a handler bug instead of an authorization or policy-mapping problem.

## Review checklist

- [ ] Does every protected integration have an explicit policy?
- [ ] Is the policy type correct for the access pattern: License Manager, app policy, or outbound-access?
- [ ] Are outbound-access rules narrow enough for the real integration surface?
- [ ] If the app exposes protected routes or operations, is server-side access control defined explicitly as well?
- [ ] Is the policy change reviewed together with the route or client that needs it?
- [ ] Are wildcard permissions avoided unless strictly necessary?

## Reference

- [Policies](https://developers.vtex.com/docs/guides/vtex-io-documentation-policies) - Policy types and manifest declaration
- [Accessing external resources within a VTEX IO app](https://developers.vtex.com/docs/guides/accessing-external-resources-within-a-vtex-io-app) - Outbound-access policy guidance
- [Policies from License Manager](https://developers.vtex.com/docs/guides/policies-from-license-manager) - License Manager resource keys and policy usage
- [Controlling access to app resources](https://developers.vtex.com/docs/guides/controlling-access-to-app-resources) - Role-based and resource-based access for your own app resources
- [VTEX Resource Name (VRN)](https://developers.vtex.com/docs/guides/vtex-io-documentation-vrn) - How VTEX expresses resources and principals in policies
- [Manifest](https://developers.vtex.com/docs/guides/vtex-io-documentation-manifest) - App contract and permission declaration

---

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

---

# Client Integration & Service Access

## When this skill applies

Use this skill when the main decision is how a VTEX IO backend app should call VTEX services or external APIs through the VTEX IO client system.

- Creating custom clients under `node/clients/`
- Choosing between native clients from `@vtex/api` or `@vtex/clients` and a custom client
- Registering clients in `IOClients` and exposing them through `ctx.clients`
- Configuring `InstanceOptions` such as retries, timeout, headers, or caching
- Reviewing backend integrations that currently use raw HTTP libraries

Do not use this skill for:
- deciding the app contract in `manifest.json`
- structuring `node/index.ts` or tuning `service.json`
- designing GraphQL schema or resolver contracts
- modeling route authorization or security permissions
- building storefront or admin frontend integrations

## Decision rules

- Prefer native clients from `@vtex/api` or `@vtex/clients` when they already cover the target VTEX service. Common examples include clients for catalog, checkout, logistics, and OMS. Write a custom client only when no suitable native client or factory exists.
- Use `ExternalClient` primarily for non-VTEX external APIs. Avoid using it for VTEX-hosted endpoints such as `*.myvtex.com` or `*.vtexcommercestable.com.br` when a native client in `@vtex/clients`, `JanusClient`, or another documented higher-level VTEX client is available or more appropriate.
- Janus is VTEX's Core Commerce API gateway. Use `JanusClient` only when you need to call a VTEX Core Commerce API through Janus and no suitable native client from `@vtex/clients` already exists.
- Use `InfraClient` only for advanced integrations with VTEX IO infrastructure services under explicit documented guidance. In partner apps, prefer higher-level clients and factories such as `masterData` or `vbase` instead of extending `InfraClient` directly.
- Register every custom or native client in `node/clients/index.ts` through a `Clients` class that extends `IOClients`.
- Consume integrations through `ctx.clients`, never by instantiating client classes inside middlewares, resolvers, or event handlers.
- Keep clients focused on transport, request options, endpoint paths, and small response shaping. Keep business rules, authorization decisions, and orchestration outside the client.
- When building custom clients, always rely on the `IOContext` passed by VTEX IO such as `account`, `workspace`, and available auth tokens instead of hardcoding account names, workspaces, or environment-specific VTEX URLs.
- Configure shared `InstanceOptions` in the runtime client config, then use client-specific overrides only when an integration has clearly different needs.
- Use the `metric` option on important client calls so integrations can be tracked and monitored at the client layer, not only at the handler layer.
- Keep error normalization close to the client boundary, but avoid hiding relevant HTTP status codes or transport failures that are important for observability and debugging.
- When integrating with external services, confirm that the required outbound policies are declared in the app contract, but keep the detailed policy modeling in auth or app-contract skills.
- In rare migration or legacy scenarios, `ExternalClient` may temporarily be used against VTEX-hosted endpoints, but treat this as an exception. The long-term goal should be to move toward native clients or the proper documented VTEX client abstractions so routing, authentication, and observability stay consistent.

Client selection guide:

| Client type | Use when | Avoid when |
|---|---|---|
| `ExternalClient` | calling non-VTEX external APIs | VTEX-hosted APIs that already have a native client or Janus-based abstraction |
| `JanusClient` | calling VTEX Core Commerce APIs not yet wrapped by `@vtex/clients` | any VTEX service that already has a native client such as Catalog, Checkout, Logistics, or OMS |
| `InfraClient` | implementing advanced infra-style clients only under explicit documented guidance | general VTEX or external APIs in partner apps |

InstanceOptions heuristics:

- Start with small, explicit client defaults such as `retries: 2` and a request `timeout` between `1000` and `3000` milliseconds.
- Use small finite retry values such as `1` to `3` for idempotent operations.
- Avoid automatic retries on non-idempotent operations unless the upstream API explicitly documents safe idempotency behavior.
- Do not use high retry counts to hide upstream instability. Surface repeated failures clearly and handle them intentionally in the business layer.
- Prefer per-client headers and metrics instead of scattering header definitions through handlers.
- Use memory or disk cache options only when repeated reads justify it and the response can be safely reused.
- Keep auth setup inside the client constructor or factory configuration, not duplicated across handlers.

## Hard constraints

### Constraint: All service-to-service HTTP calls must go through VTEX IO clients

HTTP communication from a VTEX IO backend app MUST go through `@vtex/api` or `@vtex/clients` clients. Do not use raw libraries such as `axios`, `fetch`, `got`, or `node-fetch` for service integrations.

**Why this matters**

VTEX IO clients provide transport behavior that raw libraries bypass, including authentication context, retries, metrics, caching options, and infrastructure-aware request execution. Raw HTTP calls make integrations harder to observe and easier to misconfigure.

**Detection**

If you see `axios`, `fetch`, `got`, `node-fetch`, or direct ad hoc HTTP code in a VTEX IO backend service, STOP and replace it with an appropriate VTEX IO client pattern.

**Correct**

```typescript
import type { IOContext, InstanceOptions } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

export class WeatherClient extends ExternalClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('https://api.weather.com', context, {
      ...options,
      headers: {
        'X-VTEX-Account': context.account,
        'X-VTEX-Workspace': context.workspace,
        'X-Api-Key': process.env.WEATHER_API_KEY,
        ...options?.headers,
      },
    })
  }

  public getForecast(city: string) {
    return this.http.get(`/v1/forecast/${city}`, {
      metric: 'weather-forecast',
    })
  }
}
```

**Wrong**

```typescript
import axios from 'axios'

export async function getForecast(city: string) {
  const response = await axios.get(`https://api.weather.com/v1/forecast/${city}`, {
    headers: {
      'X-Api-Key': process.env.WEATHER_API_KEY,
    },
  })

  return response.data
}
```

### Constraint: Clients must be registered in IOClients and consumed through ctx.clients

Clients MUST be registered in the `Clients` class that extends `IOClients`, and middlewares, resolvers, or event handlers MUST access them through `ctx.clients`.

**Why this matters**

The VTEX IO client registry ensures the current request context, options, caching behavior, and instrumentation are applied consistently. Direct instantiation inside handlers bypasses that shared lifecycle and creates fragile integration code.

**Detection**

If you see `new MyClient(...)` inside a middleware, resolver, or event handler, STOP. Move the client into `node/clients/`, register it in `IOClients`, and consume it through `ctx.clients`.

**Correct**

```typescript
import { IOClients } from '@vtex/api'
import { Catalog } from '@vtex/clients'

export class Clients extends IOClients {
  public get catalog() {
    return this.getOrSet('catalog', Catalog)
  }
}
```

```typescript
export async function getSku(ctx: Context) {
  const sku = await ctx.clients.catalog.getSkuById(ctx.vtex.route.params.id)
  ctx.body = sku
}
```

**Wrong**

```typescript
import { Catalog } from '@vtex/clients'

export async function getSku(ctx: Context) {
  const catalog = new Catalog(ctx.vtex, {})
  const sku = await catalog.getSkuById(ctx.vtex.route.params.id)
  ctx.body = sku
}
```

### Constraint: Choose the narrowest client type that matches the integration boundary

Each integration MUST use the correct client abstraction for its boundary. Do not default every integration to `ExternalClient` or `JanusClient` when a more specific client type or native package already exists.

**Why this matters**

The client type communicates intent and shapes how authentication, URLs, and service boundaries are handled. Using the wrong abstraction makes the integration harder to understand and more likely to drift from VTEX IO conventions.

**Detection**

If the target is a VTEX Core Commerce API, STOP and check whether a native client from `@vtex/clients` or `JanusClient` is more appropriate than `ExternalClient`. If the target is VTEX-hosted, STOP and confirm that there is no more specific documented VTEX client abstraction before defaulting to `ExternalClient`.

**Correct**

```typescript
import type { IOContext, InstanceOptions } from '@vtex/api'
import { JanusClient } from '@vtex/api'

export class RatesAndBenefitsClient extends JanusClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(context, options)
  }
}
```

**Wrong**

```typescript
import type { IOContext, InstanceOptions } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

export class RatesAndBenefitsClient extends ExternalClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(`https://${context.account}.vtexcommercestable.com.br`, context, options)
  }
}
```

## Preferred pattern

Recommended file layout:

```text
node/
├── clients/
│   ├── index.ts
│   ├── catalog.ts
│   └── partnerApi.ts
├── middlewares/
│   └── getData.ts
└── index.ts
```

Register native and custom clients in one place:

```typescript
import { IOClients } from '@vtex/api'
import { Catalog } from '@vtex/clients'
import { PartnerApiClient } from './partnerApi'

export class Clients extends IOClients {
  public get catalog() {
    return this.getOrSet('catalog', Catalog)
  }

  public get partnerApi() {
    return this.getOrSet('partnerApi', PartnerApiClient)
  }
}
```

Create custom clients with explicit routes and options:

```typescript
import type { IOContext, InstanceOptions } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

export class PartnerApiClient extends ExternalClient {
  private routes = {
    order: (id: string) => `/orders/${id}`,
  }

  constructor(context: IOContext, options?: InstanceOptions) {
    super('https://partner.example.com', context, {
      ...options,
      retries: 2,
      timeout: 2000,
      headers: {
        'X-VTEX-Account': context.account,
        'X-VTEX-Workspace': context.workspace,
        ...options?.headers,
      },
    })
  }

  public getOrder(id: string) {
    return this.http.get(this.routes.order(id), {
      metric: 'partner-get-order',
    })
  }
}
```

Wire shared client options in the runtime:

```typescript
import type { ClientsConfig } from '@vtex/api'
import { Clients } from './clients'

const clients: ClientsConfig<Clients> = {
  implementation: Clients,
  options: {
    default: {
      retries: 2,
      timeout: 2000,
    },
  },
}
```

Use clients from handlers through `ctx.clients`:

```typescript
export async function getOrder(ctx: Context) {
  const order = await ctx.clients.partnerApi.getOrder(ctx.vtex.route.params.id)
  ctx.body = order
}
```

If a client file grows too large, split it by bounded integration domains and keep `node/clients/index.ts` as a small registry.

## Common failure modes

- Using `axios`, `fetch`, or other raw HTTP libraries in backend handlers instead of VTEX IO clients.
- Instantiating clients directly inside handlers instead of registering them in `IOClients`.
- Choosing `ExternalClient` when a native VTEX client or a more specific app client already exists.
- Putting business rules, validation, or orchestration into clients instead of keeping them as transport wrappers.
- Scattering headers, auth setup, and retry settings across handlers instead of centralizing them in the client or shared client config.
- Forgetting the outbound-access policy required for an external integration declared in a custom client.

## Review checklist

- [ ] Does each integration use the correct VTEX IO client abstraction?
- [ ] Are native clients from `@vtex/api` or `@vtex/clients` preferred when available?
- [ ] Are clients registered in `IOClients` and consumed through `ctx.clients`?
- [ ] Are raw HTTP libraries absent from the backend integration code?
- [ ] Are retries, timeouts, headers, and metrics configured in the client layer rather than scattered across handlers?
- [ ] Are business rules kept out of the client layer?

## Reference

- [Using Node Clients](https://developers.vtex.com/docs/guides/using-node-clients) - How to consume clients through `ctx.clients`
- [Developing Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-how-to-create-and-use-clients) - How to build custom clients with `@vtex/api`
- [Using VTEX IO clients](https://developers.vtex.com/docs/guides/calling-commerce-apis-3-using-vtex-io-clients) - How to use VTEX clients for Core Commerce APIs
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) - VTEX IO client architecture and native client catalog

---

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

---

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

---

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

---

# HTTP Routes & Handler Boundaries

## When this skill applies

Use this skill when a VTEX IO service needs to expose explicit HTTP endpoints through `service.json` routes and implement the corresponding handlers under `node/`.

- Building callback or webhook endpoints
- Exposing integration endpoints for partners or backoffice flows
- Structuring route handlers and middleware chains
- Validating params, query strings, headers, or request bodies
- Standardizing response shape and status code behavior

Do not use this skill for:
- sizing or tuning the service runtime
- deciding app policies in `manifest.json`
- designing GraphQL APIs
- modeling async event or worker flows

## Decision rules

- Use HTTP routes when the integration needs explicit URL contracts, webhooks, or callback-style request-response behavior.
- In VTEX IO, `service.json` declares route IDs, paths, and exposure such as `public`, while the Node entrypoint wires those route IDs to handlers exported from `node/routes`. Middlewares are composed in code, not declared directly in `service.json`.
- Keep route handlers small and explicit. Route code should validate input, call domain or integration services, and shape the response.
- Put cross-cutting concerns such as validation, request normalization, or shared auth checks into middlewares instead of duplicating them across handlers.
- Define route params, query expectations, and body shape as close as possible to the handler boundary.
- Use consistent status codes and response structures for similar route families.
- For webhook or callback endpoints, follow the caller's documented expectations for status codes and error bodies, and keep responses small and deterministic to avoid ambiguous retries.
- Emit structured logs or metrics for critical routes so failures, latency, and integration health can be diagnosed without changing the handler contract.
- Prefer explicit route files grouped by bounded domain such as `routes/orders.ts` or `routes/catalog.ts`.
- Treat public routes as explicit external contracts. Do not expand a route to public use without reviewing validation, auth expectations, and response safety.

## Hard constraints

### Constraint: Route handlers must keep the HTTP contract explicit

Each route handler MUST make the request and response contract understandable at the handler boundary. Do not hide required params, body fields, or status code decisions deep inside unrelated services.

**Why this matters**

HTTP integrations depend on predictable contracts. When validation and response shaping are implicit or scattered, partner integrations become fragile and errors become harder to diagnose.

**Detection**

If the handler delegates immediately without validating required params, query values, headers, or request body shape, STOP and make the contract explicit before proceeding.

**Correct**

```typescript
export async function getOrder(ctx: Context, next: () => Promise<void>) {
  const { id } = ctx.vtex.route.params

  if (!id) {
    ctx.status = 400
    ctx.body = { message: 'Missing route param: id' }
    return
  }

  const order = await ctx.clients.partnerApi.getOrder(id)
  ctx.status = 200
  ctx.body = order
  await next()
}
```

**Wrong**

```typescript
export async function getOrder(ctx: Context) {
  ctx.body = await handleOrder(ctx)
}
```

### Constraint: Shared route concerns must live in middlewares, not repeated in every handler

Repeated concerns such as validation, request normalization, or common auth checks SHOULD be implemented as middlewares and composed through the route chain.

**Why this matters**

Duplicating the same checks in many handlers creates drift and inconsistent route behavior. Middleware keeps the HTTP surface easier to review and evolve.

**Detection**

If multiple handlers repeat the same body validation, header checks, or context preparation, STOP and extract a middleware before adding more duplication.

**Correct**

```typescript
export async function validateSignature(ctx: Context, next: () => Promise<void>) {
  const signature = ctx.request.header['x-signature']

  if (!signature) {
    ctx.status = 401
    ctx.body = { message: 'Missing signature' }
    return
  }

  await next()
}
```

**Wrong**

```typescript
export async function routeA(ctx: Context) {
  if (!ctx.request.header['x-signature']) {
    ctx.status = 401
    return
  }
}

export async function routeB(ctx: Context) {
  if (!ctx.request.header['x-signature']) {
    ctx.status = 401
    return
  }
}
```

### Constraint: HTTP routes should not absorb async or batch work that belongs in events or workers

Routes MUST keep request-response latency bounded. If a route triggers expensive, retry-prone, or batch-oriented work, move that work to an async flow and keep the route as a thin trigger or acknowledgment boundary.

**Why this matters**

Long-running HTTP handlers create poor integration behavior, timeout risk, and operational instability. VTEX IO services should separate immediate route contracts from background processing.

**Detection**

If a route performs large loops, batch imports, heavy retries, or work that is not required to complete before responding, STOP and redesign the flow around async processing.

**Correct**

```typescript
export async function triggerImport(ctx: Context) {
  await ctx.clients.importApi.enqueueImport(ctx.request.body)
  ctx.status = 202
  ctx.body = { accepted: true }
}
```

**Wrong**

```typescript
export async function triggerImport(ctx: Context) {
  for (const item of ctx.request.body.items) {
    await ctx.clients.importApi.importItem(item)
  }

  ctx.status = 200
}
```

## Preferred pattern

Recommended file layout:

```text
node/
├── routes/
│   ├── index.ts
│   ├── orders.ts
│   └── webhooks.ts
└── middlewares/
    ├── validateBody.ts
    └── validateSignature.ts
```

Wiring routes in VTEX IO services:

In VTEX IO, `service.json` declares route IDs and paths, the Node entrypoint registers a `routes` object in `new Service(...)`, and `node/routes/index.ts` maps each route ID to the final handler. Middlewares are composed in code, not declared directly in `service.json`.

```json
{
  "routes": {
    "orders-get": {
      "path": "/_v/orders/:id",
      "public": false
    },
    "reviews-create": {
      "path": "/_v/reviews",
      "public": false
    }
  }
}
```

```typescript
// node/index.ts
import type { ClientsConfig, RecorderState, ServiceContext } from '@vtex/api'
import { Service } from '@vtex/api'
import { Clients } from './clients'
import routes from './routes'

const clients: ClientsConfig<Clients> = {
  implementation: Clients,
  options: {
    default: {
      retries: 2,
      timeout: 800,
    },
  },
}

declare global {
  type Context = ServiceContext<Clients, RecorderState>
}

export default new Service<Clients, RecorderState>({
  clients,
  routes,
})
```

Minimal route pattern:

```typescript
// node/routes/index.ts
import type { RouteHandler } from '@vtex/api'
import { createReview } from './reviews'
import { getOrder } from './orders'

const routes: Record<string, RouteHandler> = {
  'orders-get': getOrder,
  'reviews-create': createReview,
}

export default routes
```

```typescript
// node/routes/orders.ts
import { compose } from 'koa-compose'
import { validateSignature } from '../middlewares/validateSignature'

async function rawGetOrder(ctx: Context, next: () => Promise<void>) {
  const { id } = ctx.vtex.route.params

  if (!id) {
    ctx.status = 400
    ctx.body = { message: 'Missing route param: id' }
    return
  }

  const order = await ctx.clients.partnerApi.getOrder(id)
  ctx.status = 200
  ctx.body = order

  await next()
}

export const getOrder = compose([validateSignature, rawGetOrder])
```

```typescript
export async function createReview(ctx: Context, next: () => Promise<void>) {
  const body = ctx.request.body

  if (!body?.productId) {
    ctx.status = 400
    ctx.body = { message: 'Missing productId' }
    return
  }

  const review = await ctx.clients.reviewApi.createReview(body)
  ctx.status = 201
  ctx.body = review
  await next()
}
```

Keep domain logic in services or integrations, and keep route handlers responsible for HTTP concerns such as validation, status codes, headers, and response shape.

## Common failure modes

- Hiding request validation inside unrelated services instead of making route expectations explicit.
- Repeating the same auth or normalization logic in many handlers instead of using middleware.
- Letting HTTP handlers perform long-running async or batch work.
- Returning inconsistent status codes or response shapes for similar endpoints.
- Expanding a route to public exposure without reviewing its trust boundary.

## Review checklist

- [ ] Is HTTP the right exposure mechanism for this contract?
- [ ] Are required params, headers, query values, and body fields validated at the route boundary?
- [ ] Are repeated concerns factored into middlewares?
- [ ] Does the handler stay small and focused on HTTP concerns?
- [ ] Should any part of the work move to async events or workers instead?

## Related skills

- [`vtex-io-events-and-workers`](../vtex-io-events-and-workers/skill.md) - Use when expensive or retry-prone work should move out of HTTP handlers into async flows
- [`vtex-io-auth-and-policies`](../vtex-io-auth-and-policies/skill.md) - Use when deciding which policies or access rules should protect HTTP routes

## Reference

- [Service](https://developers.vtex.com/docs/guides/vtex-io-documentation-service) - Route declaration and service exposure
- [Node Builder](https://developers.vtex.com/docs/guides/vtex-io-documentation-node-builder) - Backend file layout and route implementation context
- [Using Node Clients](https://developers.vtex.com/docs/guides/using-node-clients) - Client usage from route handlers

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
- **Exposing MD** — Master Data is **storage** only. Any **storefront** or **partner** access should go through a **service** that enforces **authentication**, **authorization**, and **rate limits**—typically **VTEX IO** or an external **BFF** following [headless-bff-architecture](../../../headless/skills/headless-bff-architecture/skill.md) patterns.
- **When MD fits** — After **storage fit** review, if MD remains appropriate, implement CRUD and schema discipline as below; combine with [vtex-io-application-performance](../vtex-io-application-performance/skill.md) and [vtex-io-service-paths-and-cdn](../vtex-io-service-paths-and-cdn/skill.md) when exposing HTTP or GraphQL from IO.

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

Master Data v2 extends standard JSON Schema with `v-*` properties that control indexing, caching, security, defaults, triggers, and schema inheritance. For the **complete reference** on each extension—when to use, when not to, and detailed configuration—see the [vtex-io-masterdata-strategy](../vtex-io-masterdata-strategy/skill.md) skill.

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

- [vtex-io-masterdata-strategy](../vtex-io-masterdata-strategy/skill.md) — When to use MD, `v-*` schema extensions reference, indexing strategy, triggers, capacity planning
- [vtex-io-application-performance](../vtex-io-application-performance/skill.md) — IO performance patterns (cache layers, BFF-facing behavior)
- [vtex-io-service-paths-and-cdn](../vtex-io-service-paths-and-cdn/skill.md) — Public vs private routes for MD-backed APIs
- [vtex-io-session-apps](../vtex-io-session-apps/skill.md) — Session transforms that may read from or complement MD-stored state
- [architecture-well-architected-commerce](../../../architecture/skills/architecture-well-architected-commerce/skill.md) — Cross-cutting storage and pillar alignment
- [headless-bff-architecture](../../../headless/skills/headless-bff-architecture/skill.md) — BFF boundaries when MD is not accessed from IO

## Reference

- [Creating a Master Data v2 CRUD App](https://developers.vtex.com/docs/guides/create-master-data-crud-app) — Complete guide for building Master Data apps with the masterdata builder
- [Working with JSON Schemas in Master Data v2](https://developers.vtex.com/docs/guides/working-with-json-schemas-in-master-data-v2) — Schema structure, validation, and indexing configuration
- [Schema Lifecycle](https://developers.vtex.com/docs/guides/master-data-schema-lifecycle) — How schemas evolve and impact data entities over time
- [Setting Up Triggers on Master Data v2](https://developers.vtex.com/docs/guides/setting-up-triggers-on-master-data-v2) — Trigger configuration for automated workflows
- [Master Data v2 API Reference](https://developers.vtex.com/docs/api-reference/master-data-api-v2#overview) — Complete API reference for all Master Data v2 endpoints
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — MasterDataClient methods and usage in VTEX IO

---

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

---

# Messages & Internationalization

## When this skill applies

Use this skill when a VTEX IO app needs translated copy instead of hardcoded strings.

- Adding localized UI text to storefront or Admin apps
- Creating or updating `/messages/*.json` translation files
- Defining message keys in `context.json`
- Reviewing React, Admin, or backend code that currently hardcodes user-facing copy
- Integrating app-specific translations with `vtex.messages`

Do not use this skill for:
- general UI layout or component composition
- authorization, policies, or auth tokens
- service runtime sizing
- choosing between HTTP, GraphQL, and event-driven APIs

## Decision rules

- Use the `messages` builder and translation files for user-facing copy instead of hardcoding labels, button text, or UI messages in source code.
- Keep translation keys stable, explicit, and scoped to the app domain instead of generic keys such as `title` or `button`. The exact format may vary, but keys should remain specific, descriptive, and clearly owned by the app.
- Prefix message IDs according to their UI surface or domain, for example `store/...` for storefront messages and `admin/...` for Admin or Site Editor messages, so keys stay organized and do not collide across contexts.
- Define message keys in `/messages/context.json` so VTEX IO can discover and manage the app’s translation surface. Keep it as a flat map of `messageId -> description` and include the keys the app actually uses.
- Keep translated message payloads small and app-focused. Do not turn the messages system into a general content store.
- In React or Admin UIs, prefer message IDs and localization helpers over literal copy in JSX.
- In backend or GraphQL flows, translate only when the app boundary truly needs localized text; otherwise return stable machine-oriented data and let the caller localize the presentation.
- Use app-level overrides of `vtex.messages` only when the app truly needs to customize translation behavior or message resolution beyond normal app-local message files.

## Hard constraints

### Constraint: User-facing strings must come from the messages infrastructure

User-facing strings MUST come from the messages infrastructure instead of being hardcoded in components, handlers, or resolvers.

**Why this matters**

Hardcoded copy breaks localization, makes message review harder, and creates inconsistent behavior across storefront, Admin, and backend flows.

**Detection**

If you see labels, buttons, headings, alerts, or other user-facing text embedded directly in JSX or backend response formatting for a localized app, STOP and move that copy to message files.

**Correct**

```tsx
<FormattedMessage id="admin/my-app.save" />
```

**Wrong**

```tsx
<button>Save</button>
```

### Constraint: Message keys must be declared and organized explicitly

Message keys MUST be app-scoped and represented in the app’s message configuration instead of being invented ad hoc in code.

**Why this matters**

Unstructured keys become hard to maintain, collide across app areas, and make message ownership unclear.

**Detection**

If code introduces new message IDs with no corresponding translation files or `context.json` entry, STOP and add the message contract explicitly.

**Correct**

```json
{
  "admin/my-app.save": "Save"
}
```

**Wrong**

```json
{
  "save": "Save"
}
```

### Constraint: The messages system must not be used as a general content or configuration store

Translation files MUST contain localized copy, not operational configuration, secrets, or large content payloads.

**Why this matters**

The messages infrastructure is designed for translated strings. Using it for other data creates maintenance confusion and mixes localization concerns with configuration or content storage.

**Detection**

If message files contain API URLs, credentials, business rules, or long structured content blobs, STOP and move that data to app settings, configuration apps, or a content-specific mechanism.

**Correct**

```json
{
  "store/my-app.emptyState.title": "No records found"
}
```

**Wrong**

```json
{
  "apiBaseUrl": "https://partner.example.com",
  "featureFlags": {
    "betaMode": true
  }
}
```

## Preferred pattern

Recommended file layout:

```text
.
├── messages/
│   ├── context.json
│   ├── en.json
│   └── pt.json
└── react/
    └── components/
        └── SaveButton.tsx
```

Minimal messages setup:

```json
// messages/context.json
{
  "admin/my-app.save": "Label for the save action in the admin settings page"
}
```

```json
// messages/en.json
{
  "admin/my-app.save": "Save",
  "store/my-app.emptyState.title": "No records found"
}
```

```json
// messages/pt.json
{
  "admin/my-app.save": "Salvar"
}
```

```tsx
import { FormattedMessage } from 'react-intl'

export function SaveButton() {
  return <FormattedMessage id="admin/my-app.save" />
}
```

Backend or GraphQL translation pattern:

```graphql
scalar IOMessage

type ProductLabel {
  id: ID
  label: IOMessage
}

type Query {
  productLabel(id: ID!): ProductLabel
}
```

```typescript
export const resolvers = {
  Query: {
    productLabel: async (_: unknown, { id }: { id: string }) => {
      return {
        id,
        label: {
          content: 'store/my-app.product-label',
          description: 'Label for product badge',
          from: 'en-US',
        },
      }
    },
  },
}
```

Keep a complete `en.json` as the default fallback, even when the app’s main audience uses another locale, so the messages system has a stable base for resolution and auto-translation behavior.

Use translated IDs in code, keep translation files explicit, and centralize user-facing copy in the messages system instead of scattering literals through the app.

## Common failure modes

- Hardcoding user-facing strings in JSX, resolvers, or handler responses.
- Adding new message IDs in code without updating `context.json` or the message files.
- Using generic or collision-prone keys such as `title`, `save`, or `button`.
- Storing configuration values or non-localized business payloads in message files.
- Treating `vtex.messages` overrides as the default path instead of app-local message management.

## Review checklist

- [ ] Are user-facing strings sourced from the messages infrastructure instead of hardcoded in code?
- [ ] Are message keys explicit, app-scoped, and declared consistently?
- [ ] Does `context.json` reflect the translation surface used by the app?
- [ ] Are message files limited to localized copy rather than configuration or operational data?
- [ ] Is any customization of `vtex.messages` truly necessary for this app?

## Related skills

- [`vtex-io-storefront-react`](../vtex-io-storefront-react/skill.md) - Use when the main question is storefront component structure and shopper-facing UI behavior
- [`vtex-io-admin-react`](../vtex-io-admin-react/skill.md) - Use when the main question is Admin UI structure and operational interaction patterns
- [`vtex-io-graphql-api`](../vtex-io-graphql-api/skill.md) - Use when the main question is GraphQL schema and resolver design rather than translation infrastructure

## Reference

- [Messages](https://developers.vtex.com/docs/apps/vtex.messages) - VTEX messages app and runtime translation behavior
- [Overwriting the Messages app](https://developers.vtex.com/docs/guides/vtex-io-documentation-overwriting-the-messages-app) - How app-specific overrides of `vtex.messages` work

---

# Observability & Operational Readiness

## When this skill applies

Use this skill when a VTEX IO service needs better production visibility, troubleshooting behavior, or operational safety.

- Adding metrics to important client calls or flows
- Improving logs for routes, workers, or integrations
- Surfacing failures clearly for operations and support
- Reviewing whether a service is ready for production
- Monitoring rate-limit-sensitive integrations

Do not use this skill for:
- app policy declaration
- trust-boundary modeling
- frontend analytics or browser monitoring
- route contract design by itself

## Decision rules

- Log enough structured context to debug failures, but do not log secrets or sensitive payloads.
- Use `ctx.vtex.logger` with appropriate log levels such as `info`, `warn`, and `error` instead of `console.log`, so logs are properly collected and searchable in the VTEX logging stack.
- Treat `ctx.vtex.logger` as the native platform logging mechanism. If a partner needs to forward logs to its own logging system, prefer doing that through a dedicated integration app or client instead of replacing the VTEX logger pattern inside every service.
- Use client-level metrics on important downstream calls so integration behavior is visible below the handler layer.
- Choose metric names that reflect the integration and operation, such as `partner-get-order` or `partner-sync-catalog`, so counts, latency, and error rates can be tracked over time.
- Make failures observable at the point where they happen. Do not swallow errors silently in routes, events, or workers.
- For rate-limit-sensitive APIs, combine short timeouts, backoff-aware retries, and caching of frequent reads to reduce burst pressure and avoid hitting hard limits.
- Review whether expensive or fragile flows expose enough operational signals before releasing them.

## Hard constraints

### Constraint: Important failures must be visible in logs, metrics, or durable state

Routes, event handlers, and workers MUST not hide important failures from operators.

**Why this matters**

If failures disappear silently, the service becomes impossible to diagnose under real traffic and retries.

**Detection**

If an error is caught and ignored without logging, metric emission, or explicit failure state, STOP and surface the failure.

**Correct**

```typescript
try {
  await ctx.clients.partnerApi.sendOrder(orderId)
} catch (error) {
  ctx.vtex.logger.error({
    message: 'Failed to send order to partner',
    orderId,
    account: ctx.vtex.account,
    routeId: ctx.vtex.route?.id,
  })
  throw error
}
```

**Wrong**

```typescript
try {
  await ctx.clients.partnerApi.sendOrder(orderId)
} catch (_) {
  return
}
```

### Constraint: Metrics should be attached to important integration calls

Client calls that are operationally important SHOULD include `metric` so request behavior can be tracked consistently.

**Why this matters**

Without metrics, integration failures and latency patterns are much harder to isolate from generic route behavior.

**Detection**

If a key downstream integration call has no `metric` and operations depend on it, STOP and add a meaningful metric name.

**Correct**

```typescript
return this.http.get(`/orders/${id}`, {
  metric: 'partner-get-order',
})
```

**Wrong**

```typescript
return this.http.get(`/orders/${id}`)
```

### Constraint: Logs must stay useful without leaking sensitive data

Logs MUST contain enough context to debug production behavior, but MUST NOT include secrets, tokens, or unnecessarily sensitive payloads.

**Why this matters**

Operational logs are only valuable if they are safe to retain and inspect. Sensitive logging creates security risk while still failing to guarantee useful diagnosis.

**Detection**

If a log line includes tokens, auth headers, raw personal payloads, or entire downstream responses, STOP and sanitize the log.

**Correct**

```typescript
ctx.vtex.logger.info({
  message: 'Partner sync started',
  orderId,
  account: ctx.vtex.account,
})
```

**Wrong**

```typescript
ctx.vtex.logger.info({
  message: 'Partner sync started',
  body: ctx.request.body,
  auth: ctx.request.header.authorization,
})
```

## Preferred pattern

Operationally healthy VTEX IO services should:

- emit metrics for important client calls so counts, latency, and error rates are visible
- log failures with enough structured context such as domain IDs, account, and `routeId`
- avoid silent error swallowing
- sanitize sensitive data before logging
- review retries, caching, and throughput with rate-limit behavior in mind

Use observability to shorten diagnosis time, not just to create more logs.

## Common failure modes

- Catching and ignoring errors in async flows.
- Logging too little context to diagnose production incidents.
- Logging too much sensitive data.
- Omitting metrics from important integration calls.
- Treating rate-limit failures as isolated bugs instead of operational signals.

## Review checklist

- [ ] Are important failures visible to operators?
- [ ] Do key integrations emit useful metrics?
- [ ] Are logs structured and safe?
- [ ] Are retries, caching, and rate-limit behavior considered together?
- [ ] Would someone on call be able to diagnose this flow from the available signals?

## Reference

- [Using Node Clients](https://developers.vtex.com/docs/guides/using-node-clients) - Client usage patterns relevant to metrics and retries
- [Best practices for avoiding rate-limit errors](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) - Operational guidance for stable integrations

---

# VTEX IO access control (RBAC)

## When this skill applies

Use this skill when you need to **control who can access** your VTEX IO app's routes and resources:

- Deciding between **role-based** (`policies.json`) and **resource-based** (`service.json` policies) access control
- Securing **REST endpoints** so only specific apps, users, or API keys can call them
- Setting up **GraphQL authorization** with the `@auth` directive
- Understanding **VRN** (VTEX Resource Name) syntax for declaring principals
- Debugging **403 Forbidden** errors caused by missing or misconfigured policies

Do not use this skill for:

- General service architecture (use `vtex-io-service-apps`)
- PCI compliance and payment security (use `payment-pci-security`)
- Route prefix and CDN behavior (use `vtex-io-service-paths-and-cdn`)

## Decision rules

### Role-based vs resource-based policies

|                            | Role-based (`policies.json`)                                            | Resource-based (`service.json` policies)                                   |
| -------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Who can call?**          | Only other IO apps (by themselves or on behalf of other apps)           | Apps, users, and integrations (API keys)                                   |
| **API types**              | GraphQL and REST                                                        | REST only                                                                  |
| **How callers get access** | Must declare required policies in their `manifest.json`                 | No policy declaration needed; just call with auth token                    |
| **Where configured**       | `policies.json` in app root                                             | `policies` array inside route definition in `service.json`                 |
| **Use when**               | Exposing GraphQL endpoints; exposing REST endpoints for app-to-app only | Controlling access for users, API keys, or specific apps to REST endpoints |

### Choosing the right approach

- **GraphQL endpoints** → Use **role-based** policies (`policies.json`) **and/or** the **`@auth` directive** in the schema for user-level authorization.
- **REST endpoint called only by other IO apps** → Use **role-based** policies (`policies.json`). Consuming apps must declare the policy in their `manifest.json`.
- **REST endpoint called by users or API keys** → Use **resource-based** policies in `service.json`. Set the route as `"public": false` and define principals.
- **Public REST endpoint (no auth)** → Set `"public": true` in `service.json`. No policies needed, but be aware this means **anyone** can call it.

### VRN syntax

VRNs (VTEX Resource Names) identify resources and principals:

```text
vrn:{service}:{region}:{account}:{workspace}:{path}
```

- **Apps**: `vrn:apps:*:*:*:app/{vendor}.{app-name}@{version}`
- **Users**: `vrn:vtex.vtex-id:*:*:*:user/{email}`
- **API keys**: `vrn:vtex.vtex-id:*:*:*:user/vtexappkey-{account}-{hash}`
- **Wildcards**: `*` matches any value in a segment. `app/*` matches all apps. `user/*@gmail.com` matches all Gmail users.

## Hard constraints

### Constraint: Use resource-based policies when users or API keys need access

Role-based policies only work for **app-to-app** communication. If users (admin or storefront) or integrations (API keys) need to call your endpoint, you **must** use resource-based policies in `service.json` with the route set to `"public": false`.

**Why this matters** — Setting up a role-based policy for a route that users or API keys call results in 403 Forbidden for those callers, because role-based policies don't evaluate user/integration tokens.

**Detection** — A private route that should be callable by admin users or external integrations, but only has `policies.json` configuration and no `policies` array in `service.json`.

**Correct** — Resource-based policy in `service.json` for user/integration access.

```json
{
  "routes": {
    "orders": {
      "path": "/_v/private/my-app/orders",
      "public": false,
      "policies": [
        {
          "effect": "allow",
          "actions": ["GET", "POST"],
          "principals": [
            "vrn:vtex.vtex-id:*:*:*:user/*@mycompany.com",
            "vrn:apps:*:*:*:app/partner.integration-app@*"
          ]
        }
      ]
    }
  }
}
```

**Wrong** — Only `policies.json` for a route that users need.

```json
// policies.json — this only covers app-to-app, not users
[
  {
    "name": "access-orders",
    "statements": [
      {
        "effect": "allow",
        "actions": ["GET"],
        "resources": ["vrn:my-app:*:*:*:/_v/private/my-app/orders"]
      }
    ]
  }
]
// Users calling this route still get 403
```

### Constraint: Deny policies take precedence over allow policies

When resource-based policies have overlapping principals between an `allow` and a `deny` rule, the **deny** always wins. Be careful with wildcards in allow rules that intersect with specific deny rules.

**Why this matters** — A broad `allow` for `app/*` combined with a specific `deny` for `app/vendor.bad-app@*` correctly blocks `bad-app`. But the reverse—a broad `deny` with a specific `allow`—blocks everything including what you wanted to allow.

**Detection** — Multiple policy entries for the same route with conflicting effects and overlapping principals.

**Correct** — Allow broadly, deny specifically.

```json
{
  "policies": [
    {
      "effect": "allow",
      "actions": ["POST"],
      "principals": ["vrn:apps:*:*:*:app/*"]
    },
    {
      "effect": "deny",
      "actions": ["POST"],
      "principals": ["vrn:apps:*:*:*:app/untrusted.app@*"]
    }
  ]
}
```

**Wrong** — Deny broadly, try to allow specifically (the allow is overridden).

```json
{
  "policies": [
    {
      "effect": "deny",
      "actions": ["POST"],
      "principals": ["vrn:apps:*:*:*:app/*"]
    },
    {
      "effect": "allow",
      "actions": ["POST"],
      "principals": ["vrn:apps:*:*:*:app/trusted.app@*"]
    }
  ]
}
```

## Preferred pattern

### Role-based policy (`policies.json`)

```json
[
  {
    "name": "resolve-graphql",
    "description": "Allows apps to resolve GraphQL requests",
    "statements": [
      {
        "effect": "allow",
        "actions": ["POST"],
        "resources": [
          "vrn:vtex.store-graphql:{{region}}:{{account}}:{{workspace}}:/_v/graphql"
        ]
      }
    ]
  }
]
```

The consuming app declares the policy in its `manifest.json`:

```json
{
  "policies": [
    {
      "name": "resolve-graphql"
    }
  ]
}
```

### Resource-based policy for mixed access

```json
{
  "routes": {
    "webhook": {
      "path": "/_v/private/my-app/webhook",
      "public": false,
      "policies": [
        {
          "effect": "allow",
          "actions": ["POST"],
          "principals": [
            "vrn:apps:*:*:*:app/vtex.orders-broadcast@*",
            "vrn:vtex.vtex-id:*:*:*:user/vtexappkey-myaccount-*"
          ]
        }
      ]
    }
  }
}
```

### GraphQL `@auth` directive

For GraphQL endpoints, use the `@auth` directive for user-level authorization:

```graphql
type Query {
  orders: [Order] @auth(productCode: "10", resourceCode: "list-orders")
  adminSettings: Settings
    @auth(productCode: "10", resourceCode: "admin-settings")
}

type Mutation {
  updateSettings(input: SettingsInput!): Settings
    @auth(productCode: "10", resourceCode: "admin-settings")
}
```

The `@auth` directive checks the caller's License Manager role for the specified `productCode` and `resourceCode`.

## Common failure modes

- **403 for users on role-based routes** — Route only has `policies.json`; users and API keys get 403 because role-based policies don't apply to them.
- **Overly broad `public: true`** — Route set to public when it should be private. Anyone can call it without auth.
- **Missing policy in consumer manifest** — App tries to call a role-based protected route but didn't declare the policy in its `manifest.json`. Results in 403.
- **VRN typo** — Misspelled vendor, app name, or principal format in VRN. Silently fails to match, resulting in 403.
- **Wildcard in deny** — Broad deny with `app/*` blocks all apps including trusted ones. Deny takes precedence.
- **No `@auth` on GraphQL mutations** — Mutations that modify data accessible without role checks.

## Review checklist

- [ ] Is the access control type (role-based vs resource-based) correct for the callers (apps vs users/integrations)?
- [ ] Are private routes set to `"public": false` with appropriate policies?
- [ ] Are VRNs correctly formatted for the principal type (apps, users, API keys)?
- [ ] Do consuming apps declare required role-based policies in their `manifest.json`?
- [ ] Are deny rules used carefully (they override allow rules for intersecting principals)?
- [ ] Do GraphQL mutations have `@auth` directives with correct `productCode` and `resourceCode`?
- [ ] Are wildcard principals scoped as narrowly as possible?

## Related skills

- [vtex-io-service-apps](../vtex-io-service-apps/skill.md) — Service class, clients, and route configuration
- [vtex-io-app-contract](../vtex-io-app-contract/skill.md) — Manifest, builders, and policy declarations
- [vtex-io-graphql-api](../vtex-io-graphql-api/skill.md) — GraphQL schema and `@auth` directive details
- [vtex-io-service-paths-and-cdn](../vtex-io-service-paths-and-cdn/skill.md) — Route prefix patterns

## Reference

- [Controlling Access to App Resources](https://developers.vtex.com/docs/guides/controlling-access-to-app-resources) — Role-based and resource-based policies, VRN syntax, principal types
- [App Authentication Using Auth Tokens](https://developers.vtex.com/docs/guides/app-authentication-using-auth-tokens) — Auth token types for app-to-app and user-to-app communication
- [GraphQL Authorization in IO Apps](https://developers.vtex.com/docs/guides/graphql-authorization-in-io-apps) — @auth directive usage
- [VTEX IO VRN](https://developers.vtex.com/docs/guides/vtex-io-documentation-vrn) — VTEX Resource Name format and examples

---

# Frontend React Components & Hooks

## When this skill applies

Use this skill when building VTEX IO frontend apps using the `react` builder — creating React components that integrate with Store Framework as theme blocks, configuring `interfaces.json`, setting up `contentSchemas.json` for Site Editor, and applying styling patterns.

- Creating custom storefront components (product displays, forms, banners)
- Building admin panel interfaces with VTEX Styleguide
- Registering components as Store Framework blocks
- Exposing component props in Site Editor via `contentSchemas.json`
- Applying `css-handles` for safe storefront styling

Do not use this skill for:
- Backend service implementation (use `vtex-io-service-apps` instead)
- GraphQL schema and resolver development (use `vtex-io-graphql-api` instead)
- Manifest and builder configuration (use `vtex-io-app-structure` instead)

## Decision rules

- Every visible storefront element is a **block**. Blocks are declared in theme JSON and map to React components via **interfaces**.
- `interfaces.json` (in `/store`) maps block names to React component files: `"component"` is the file name in `/react` (without extension), `"allowed"` lists child blocks, `"composition"` controls how children work (`"children"` or `"blocks"`).
- Each exported component MUST have a root-level file in `/react` that re-exports it. The builder resolves `"component": "ProductReviews"` to `react/ProductReviews.tsx`.
- For **storefront** components, use `vtex.css-handles` for styling (not inline styles, not global CSS).
- For **admin** components, use `vtex.styleguide` — the official VTEX Admin component library. No third-party UI libraries.
- Use `contentSchemas.json` in `/store` to make component props editable in Site Editor (JSON Schema format).
- Use `react-intl` and the `messages` builder for i18n — never hardcode user-facing strings.
- Fetch data via GraphQL queries (`useQuery` from `react-apollo`), never via direct API calls from the browser.

Architecture:

```text
Store Theme (JSON blocks)
  └── declares "product-reviews" block with props
        │
        ▼
interfaces.json → maps "product-reviews" to "ProductReviews" component
        │
        ▼
react/ProductReviews.tsx → React component renders
        │
        ├── useCssHandles() → CSS classes for styling
        ├── useQuery() → GraphQL data fetching
        └── useProduct() / useOrderForm() → Store Framework context hooks
```

## Hard constraints

### Constraint: Declare Interfaces for All Storefront Blocks

Every React component that should be usable as a Store Framework block MUST have a corresponding entry in `store/interfaces.json`. Without the interface declaration, the block cannot be referenced in theme JSON files.

**Why this matters**

The store builder resolves block names to React components through `interfaces.json`. If a component has no interface, it is invisible to Store Framework and will not render on the storefront.

**Detection**

If a React component in `/react` is intended for storefront use but has no matching entry in `store/interfaces.json`, warn the developer. The component will compile but never render.

**Correct**

```json
{
  "product-reviews": {
    "component": "ProductReviews",
    "composition": "children",
    "allowed": ["product-review-item"]
  },
  "product-review-item": {
    "component": "ReviewItem"
  }
}
```

```tsx
// react/ProductReviews.tsx
import ProductReviews from './components/ProductReviews'

export default ProductReviews
```

**Wrong**

```tsx
// react/ProductReviews.tsx exists but NO store/interfaces.json entry
// The component compiles fine but cannot be used in any theme.
// Adding <product-reviews /> in a theme JSON will produce:
// "Block 'product-reviews' not found"
import ProductReviews from './components/ProductReviews'

export default ProductReviews
```

---

### Constraint: Use VTEX Styleguide for Admin UIs

Admin panel components (apps using the `admin` builder) MUST use VTEX Styleguide (`vtex.styleguide`) for UI elements. You MUST NOT use third-party UI libraries like Material UI, Chakra UI, or Ant Design in admin apps.

**Why this matters**

VTEX Admin has a consistent design language enforced by Styleguide. Third-party UI libraries produce inconsistent visuals, may conflict with the Admin's global CSS, and add unnecessary bundle size. Apps submitted to the VTEX App Store with non-Styleguide admin UIs will fail review.

**Detection**

If you see imports from `@material-ui`, `@chakra-ui/react`, `@chakra-ui`, `antd`, or `@ant-design` in an admin app, warn the developer to use `vtex.styleguide` instead.

**Correct**

```tsx
// react/admin/ReviewModeration.tsx
import React, { useState } from 'react'
import {
  Layout,
  PageHeader,
  Table,
  Button,
  Tag,
  Modal,
  Input,
} from 'vtex.styleguide'

interface Review {
  id: string
  author: string
  rating: number
  text: string
  status: 'pending' | 'approved' | 'rejected'
}

function ReviewModeration() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  const tableSchema = {
    properties: {
      author: { title: 'Author', width: 200 },
      rating: { title: 'Rating', width: 100 },
      text: { title: 'Review Text' },
      status: {
        title: 'Status',
        width: 150,
        cellRenderer: ({ cellData }: { cellData: string }) => (
          <Tag type={cellData === 'approved' ? 'success' : 'error'}>
            {cellData}
          </Tag>
        ),
      },
    },
  }

  return (
    <Layout fullWidth pageHeader={<PageHeader title="Review Moderation" />}>
      <Table
        items={reviews}
        schema={tableSchema}
        density="medium"
      />
    </Layout>
  )
}

export default ReviewModeration
```

**Wrong**

```tsx
// react/admin/ReviewModeration.tsx
import React from 'react'
import { DataGrid } from '@material-ui/data-grid'
import { Button } from '@material-ui/core'

// Material UI components will look inconsistent in the VTEX Admin,
// conflict with global styles, and inflate bundle size.
// This app will fail VTEX App Store review.
function ReviewModeration() {
  return (
    <div>
      <DataGrid rows={[]} columns={[]} />
      <Button variant="contained" color="primary">Approve</Button>
    </div>
  )
}
```

---

### Constraint: Export Components from react/ Root Level

Every Store Framework block component MUST have a root-level export file in the `/react` directory that matches the `component` value in `interfaces.json`. The actual implementation can live in subdirectories, but the root file must exist.

**Why this matters**

The react builder resolves components by looking for files at the root of `/react`. If `interfaces.json` declares `"component": "ProductReviews"`, the builder looks for `react/ProductReviews.tsx`. Without this root export file, the component will not be found and the block will fail to render.

**Detection**

If `interfaces.json` references a component name that does not have a matching file at the root of `/react`, STOP and create the export file.

**Correct**

```tsx
// react/ProductReviews.tsx — root-level export file
import ProductReviews from './components/ProductReviews/index'

export default ProductReviews
```

```tsx
// react/components/ProductReviews/index.tsx — actual implementation
import React from 'react'
import { useCssHandles } from 'vtex.css-handles'

const CSS_HANDLES = ['container', 'title', 'list'] as const

interface Props {
  title: string
  maxReviews: number
}

function ProductReviews({ title, maxReviews }: Props) {
  const handles = useCssHandles(CSS_HANDLES)
  return (
    <div className={handles.container}>
      <h2 className={handles.title}>{title}</h2>
      {/* ... */}
    </div>
  )
}

export default ProductReviews
```

**Wrong**

```text
react/components/ProductReviews/index.tsx exists but
react/ProductReviews.tsx does NOT exist.
The builder cannot find the component.
Error: "Could not find component ProductReviews"
```

## Preferred pattern

Create the React component inside a subdirectory:

```tsx
// react/components/ProductReviews/index.tsx
import React, { useMemo } from 'react'
import { useQuery } from 'react-apollo'
import { useProduct } from 'vtex.product-context'
import { useCssHandles } from 'vtex.css-handles'

import GET_REVIEWS from '../../graphql/getReviews.graphql'
import ReviewItem from './ReviewItem'

const CSS_HANDLES = [
  'reviewsContainer',
  'reviewsTitle',
  'reviewsList',
  'averageRating',
  'emptyState',
] as const

interface Props {
  title?: string
  showAverage?: boolean
  maxReviews?: number
}

function ProductReviews({
  title = 'Customer Reviews',
  showAverage = true,
  maxReviews = 10,
}: Props) {
  const handles = useCssHandles(CSS_HANDLES)
  const productContext = useProduct()
  const productId = productContext?.product?.productId

  const { data, loading, error } = useQuery(GET_REVIEWS, {
    variables: { productId, limit: maxReviews },
    skip: !productId,
  })

  const averageRating = useMemo(() => {
    if (!data?.reviews?.length) return 0

    const sum = data.reviews.reduce(
      (acc: number, review: { rating: number }) => acc + review.rating,
      0
    )

    return (sum / data.reviews.length).toFixed(1)
  }, [data])

  if (loading) return <div className={handles.reviewsContainer}>Loading...</div>
  if (error) return null

  return (
    <div className={handles.reviewsContainer}>
      <h2 className={handles.reviewsTitle}>{title}</h2>

      {showAverage && data?.reviews?.length > 0 && (
        <div className={handles.averageRating}>
          Average: {averageRating} / 5
        </div>
      )}

      {data?.reviews?.length === 0 ? (
        <p className={handles.emptyState}>No reviews yet.</p>
      ) : (
        <ul className={handles.reviewsList}>
          {data.reviews.map((review: { id: string; author: string; rating: number; text: string }) => (
            <ReviewItem key={review.id} review={review} />
          ))}
        </ul>
      )}
    </div>
  )
}

export default ProductReviews
```

Root export file:

```tsx
// react/ProductReviews.tsx
import ProductReviews from './components/ProductReviews'

export default ProductReviews
```

Block interface:

```json
{
  "product-reviews": {
    "component": "ProductReviews",
    "composition": "children",
    "allowed": ["product-review-form"],
    "render": "client"
  }
}
```

Site Editor schema:

```json
{
  "definitions": {
    "ProductReviews": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "title": "Section Title",
          "description": "Title displayed above the reviews list",
          "default": "Customer Reviews"
        },
        "showAverage": {
          "type": "boolean",
          "title": "Show average rating",
          "default": true
        },
        "maxReviews": {
          "type": "number",
          "title": "Maximum reviews",
          "default": 10,
          "enum": [5, 10, 20, 50]
        }
      }
    }
  }
}
```

Using the component in a Store Framework theme:

```json
{
  "store.product": {
    "children": [
      "product-images",
      "product-name",
      "product-price",
      "buy-button",
      "product-reviews"
    ]
  },
  "product-reviews": {
    "props": {
      "title": "What Our Customers Say",
      "showAverage": true,
      "maxReviews": 20
    }
  }
}
```

## Common failure modes

- **Importing third-party UI libraries for admin apps**: Using `@material-ui/core`, `@chakra-ui/react`, or `antd` conflicts with VTEX Admin's global CSS, produces inconsistent visuals, and will fail App Store review. Use `vtex.styleguide` instead.
- **Directly calling APIs from React components**: Using `fetch()` or `axios` exposes authentication tokens to the client and bypasses CORS restrictions. Use GraphQL queries that resolve server-side via `useQuery` from `react-apollo`.
- **Hardcoded strings without i18n**: Components with hardcoded strings only work in one language. Use the `messages` builder and `react-intl` for internationalization.
- **Missing root-level export file**: If `interfaces.json` references `"component": "ProductReviews"` but `react/ProductReviews.tsx` doesn't exist, the block silently fails to render.

## Review checklist

- [ ] Does every storefront block have a matching entry in `store/interfaces.json`?
- [ ] Does every `interfaces.json` component have a root-level export file in `/react`?
- [ ] Are admin apps using `vtex.styleguide` (no third-party UI libraries)?
- [ ] Are storefront components using `css-handles` for styling?
- [ ] Is data fetched via GraphQL (`useQuery`), not direct API calls?
- [ ] Are user-facing strings using `react-intl` and the `messages` builder?
- [ ] Is `contentSchemas.json` defined for Site Editor-editable props?

## Reference

- [Developing Custom Storefront Components](https://developers.vtex.com/docs/guides/vtex-io-documentation-developing-custom-storefront-components) — Guide for building Store Framework components
- [Interfaces](https://developers.vtex.com/docs/guides/vtex-io-documentation-interface) — How interfaces map blocks to React components
- [React Builder](https://developers.vtex.com/docs/guides/vtex-io-documentation-react-builder) — React builder configuration and directory structure
- [Making a Custom Component Available in Site Editor](https://developers.vtex.com/docs/guides/vtex-io-documentation-making-a-custom-component-available-in-site-editor) — contentSchemas.json and Site Editor integration
- [Store Framework](https://developers.vtex.com/docs/guides/store-framework) — Overview of the block-based storefront system
- [Using Components](https://developers.vtex.com/docs/guides/store-framework-using-components) — How to use native and custom components in themes
- [VTEX Styleguide](https://styleguide.vtex.com/) — Official component library for VTEX Admin UIs

---

# Render Runtime & Block Registration

## When this skill applies

Use this skill when a VTEX IO storefront component needs to be exposed to Store Framework as a block.

- Registering components in `store/interfaces.json`
- Mapping block names to React components
- Defining block composition and allowed children
- Reviewing whether a component is correctly wired into theme JSON

Do not use this skill for:
- shopper-facing component internals
- admin interfaces
- backend service or route design
- policy modeling

## Decision rules

- Every block visible to Store Framework must be registered in `store/interfaces.json`.
- Keep block names, component mapping, and composition explicit.
- The block ID used as the key in `store/interfaces.json`, for example `product-reviews`, is the same ID that storefront themes reference under `blocks` in `store/*.json`.
- The `component` field should map to the React entry name under `react/`, such as `ProductReviews`, or a nested path such as `product/ProductReviews` when the app structure is hierarchical.
- Use `composition` intentionally when the block needs an explicit child model. `children` means the component renders nested blocks through `props.children`, while `blocks` means the block exposes named block slots controlled by Store Framework.
- `composition` is optional. For many simple blocks, declaring `component` and, when needed, `allowed` is enough.
- Use this skill for the render/runtime contract, and use storefront/admin skills for the component implementation itself.

## Hard constraints

### Constraint: Storefront blocks must be declared in interfaces.json

Every React component intended for Store Framework use MUST have a corresponding `interfaces.json` entry.

**Why this matters**

Without the interface declaration, the component cannot be referenced from theme JSON.

**Detection**

If a storefront React component is intended to be used as a block but has no matching interface entry, STOP and add it first.

**Correct**

```json
{
  "product-reviews": {
    "component": "ProductReviews"
  }
}
```

**Wrong**

```tsx
// react/ProductReviews.tsx exists with no interfaces.json mapping
```

### Constraint: Component mapping must resolve to real React entry files

The `component` field in `interfaces.json` MUST map to a real exported React entry file.

**Why this matters**

Broken mapping silently disconnects block contracts from implementation.

**Detection**

If an interface points to a component name with no corresponding React entry file, STOP and fix the mapping.

**Correct**

```json
{
  "product-reviews": {
    "component": "ProductReviews"
  }
}
```

**Wrong**

```json
{
  "product-reviews": {
    "component": "MissingComponent"
  }
}
```

### Constraint: Block composition must be intentional

Composition and allowed child blocks MUST match the component's actual layout and runtime expectations.

**Why this matters**

Incorrect composition contracts make theme usage brittle and confusing.

**Detection**

If `allowed` or `composition` do not reflect how the component is supposed to receive children, STOP and correct the block contract.

**Correct**

```json
{
  "product-reviews": {
    "component": "ProductReviews",
    "composition": "children",
    "allowed": ["product-review-item"]
  }
}
```

**Wrong**

```json
{
  "product-reviews": {
    "component": "ProductReviews",
    "composition": "blocks",
    "allowed": []
  }
}
```

## Preferred pattern

Keep block contracts explicit in `interfaces.json` and keep block implementation concerns separate from render-runtime registration.

Minimal block lifecycle:

```json
// store/interfaces.json
{
  "product-reviews": {
    "component": "ProductReviews",
    "composition": "children",
    "allowed": ["product-review-item"]
  },
  "product-review-item": {
    "component": "ProductReviewItem"
  }
}
```

```json
// store/home.json
{
  "store.home": {
    "blocks": ["product-reviews"]
  }
}
```

```tsx
// react/ProductReviews.tsx
export default function ProductReviews() {
  return <div>...</div>
}
```

This wiring makes the block name visible in the theme, maps it to a real React entry, and keeps composition rules explicit at the render-runtime boundary.

## Common failure modes

- Forgetting to register a storefront component as a block.
- Mapping block names to missing React entry files.
- Using the wrong composition model.

## Review checklist

- [ ] Is the block declared in `interfaces.json`?
- [ ] Does the component mapping resolve correctly?
- [ ] Are composition and allowed children intentional?
- [ ] Is runtime registration clearly separated from component internals?

## Reference

- [Store Framework](https://developers.vtex.com/docs/guides/vtex-io-documentation-store-framework) - Block and theme context

---

# VTEX IO rootPath for multi-binding stores

## When this skill applies

Use this skill when building VTEX IO apps that must work in stores with **multi-binding** configurations—typically **cross-border** stores where multiple bindings share a single domain with **path prefixes** (e.g. `store.com/us/`, `store.com/br/`, `store.com/mx/`).

- Your app generates **URLs** (links, redirects, API endpoints, canonical URLs) that must include the binding's path prefix
- Your app loads **assets** (images, scripts, stylesheets) that break when the store uses a sub-path binding
- Your **backend routes** need to construct URLs for sitemaps, canonical links, or cross-binding references
- You're debugging **404s** or **wrong links** that only appear in multi-binding stores but work fine in single-binding

Do not use this skill for:

- Single-binding stores with a dedicated domain per locale (no path prefix needed)
- General IO backend patterns (use `vtex-io-service-apps`)
- CDN/edge caching configuration (use `vtex-io-service-paths-and-cdn`)

## Decision rules

- **Single-domain multi-binding** (e.g. `store.com/us/`, `store.com/br/`) → `rootPath` is **required**. Every generated URL must be prefixed with the binding's root path.
- **Multi-domain single-binding** (e.g. `store.us`, `store.com.br`) → `rootPath` is typically **empty** or `/`. URLs work without prefixing, but code should still handle `rootPath` gracefully (use it if non-empty, skip if empty).
- **Backend (Node)** → The platform sends the binding's path prefix in the `x-vtex-root-path` request header. Your app needs an **early middleware** (typically called `prepare`) that reads this header, sanitizes it, and stores it on `ctx.state.rootPath`. Once set up, all downstream handlers read `ctx.state.rootPath` directly. The middleware must also set `Vary: x-vtex-root-path` so CDN caching works correctly per binding.
- **Frontend (React)** → Use `useRuntime().rootPath` from `vtex.render-runtime` to get the current binding's path prefix in components.
- **Always prefix, never hardcode** — Never hardcode a path prefix like `/us/`. Always use the runtime-provided `rootPath` so the same code works across all bindings.

## Hard constraints

### Constraint: Always use rootPath when constructing URLs in multi-binding stores

Every URL your app generates—links, redirects, API endpoints, canonical URLs, sitemap entries—must include the `rootPath` prefix when the store uses path-based bindings.

**Why this matters** — Without `rootPath`, a link to `/my-account/orders` in the `/br/` binding points to the wrong binding (or 404s). Sitemaps with unprefixed URLs break SEO by pointing search engines to the wrong locale. Redirects without the prefix send users to the default binding instead of their current one.

**Detection** — URLs constructed as string literals (e.g. `/${slug}`) without prepending `rootPath`. Or `navigate()` calls that omit the `rootPath` prefix.

**Correct** — Prepend rootPath (parsed by prepare middleware) to all generated paths.

```typescript
// Backend: use ctx.state.rootPath (parsed by prepare middleware)
const { rootPath, forwardedHost } = ctx.state;

const canonicalUrl = `https://${forwardedHost}${rootPath}/product/${slug}`;
const sitemapEntry = `${rootPath}/${categoryPath}`;
```

```tsx
// Frontend: use runtime hook
import { useRuntime } from "vtex.render-runtime";

const MyLink = ({ slug }: { slug: string }) => {
  const { rootPath } = useRuntime();
  return <a href={`${rootPath}/product/${slug}`}>View product</a>;
};
```

**Wrong** — Hardcoded paths without rootPath.

```typescript
// Backend: missing rootPath — breaks in multi-binding
const canonicalUrl = `https://${host}/product/${slug}`

// Frontend: hardcoded path
const MyLink = ({ slug }: { slug: string }) => {
  return <a href={`/product/${slug}`}>View product</a>
}
```

### Constraint: Sanitize rootPath to avoid double slashes

When `rootPath` is `"/"` (single-binding or default binding), using it directly produces double slashes in URLs (e.g. `//product/shoes`). Normalize: if `rootPath === "/"`, treat it as `""`.

**Why this matters** — Double slashes in URLs cause redirect loops, broken canonical URLs, and SEO penalties. Some CDN layers treat `//path` differently from `/path`.

**Detection** — URL construction that concatenates `rootPath + "/" + path` without checking for `rootPath === "/"`.

**Correct**

```typescript
// In the prepare middleware, sanitize before storing on state:
let rootPath = ctx.get("x-vtex-root-path");
if (rootPath && !rootPath.startsWith("/")) {
  rootPath = `/${rootPath}`;
}
if (rootPath === "/") {
  rootPath = "";
}
ctx.state.rootPath = rootPath;

// Downstream: ctx.state.rootPath is already sanitized
const { rootPath } = ctx.state;
const url = `${rootPath}/${path}`;
```

**Wrong**

```typescript
const rootPath = ctx.get("x-vtex-root-path") || "/";
const url = `${rootPath}/${path}`; // Produces "//path" for default binding
```

## Preferred pattern

### State interface with rootPath

Declare `rootPath` and related binding state on your `State` interface so all handlers have typed access:

```typescript
// node/typings.d.ts
declare global {
  interface State extends RecorderState {
    binding: Binding;
    rootPath: string;
    forwardedHost: string;
    forwardedPath: string;
    isCrossBorder: boolean;
    matchingBindings: Binding[];
  }

  type Context = ServiceContext<Clients, State>;
}
```

### Prepare middleware (parses rootPath from header)

Wire a `prepare` middleware early in every route's middleware chain. It reads the `x-vtex-root-path` header, sanitizes it, resolves the current binding, and sets `Vary` headers so the CDN caches responses per binding:

```typescript
// node/middlewares/prepare.ts
const FORWARDED_HOST_HEADER = "x-forwarded-host";
const VTEX_ROOT_PATH_HEADER = "x-vtex-root-path";

export async function prepare(ctx: Context, next: () => Promise<void>) {
  const forwardedHost = ctx.get(FORWARDED_HOST_HEADER);

  let rootPath = ctx.get(VTEX_ROOT_PATH_HEADER);

  // Defend against malformed root path — must start with /
  if (rootPath && !rootPath.startsWith("/")) {
    rootPath = `/${rootPath}`;
  }

  // Normalize "/" to "" to avoid double slashes in URL construction
  if (rootPath === "/") {
    rootPath = "";
  }

  const [forwardedPath] = ctx.get("x-forwarded-path").split("?");

  ctx.state = {
    ...ctx.state,
    forwardedHost,
    forwardedPath,
    rootPath,
    // ... resolve binding, matchingBindings, etc.
  };

  await next();

  // Vary on these headers so CDN caches separate responses per binding
  ctx.vary(FORWARDED_HOST_HEADER);
  ctx.vary(VTEX_ROOT_PATH_HEADER);
}
```

Downstream handlers then use `ctx.state.rootPath` directly — no header parsing needed:

```typescript
// node/middlewares/generateSitemap.ts
export async function generateSitemap(ctx: Context, next: () => Promise<void>) {
  const { rootPath, binding } = ctx.state;
  const canonicalUrl = `https://${ctx.state.forwardedHost}${rootPath}/${slug}`;
  // ...
}
```

### Frontend utility

```tsx
import { useRuntime } from "vtex.render-runtime";

function usePrefixedPath(path: string): string {
  const { rootPath = "" } = useRuntime();
  const prefix = rootPath === "/" ? "" : rootPath;
  return `${prefix}${path.startsWith("/") ? path : `/${path}`}`;
}
```

### Binding-aware API calls from frontend

```tsx
const { rootPath, binding } = useRuntime();
// binding.id — current binding ID
// binding.canonicalBaseAddress — e.g. "store.com/br"
// rootPath — e.g. "/br"

// When calling backend APIs, the platform handles rootPath automatically
// for IO-internal calls. For external URLs or custom redirects, prefix manually.
```

## Common failure modes

- **Links break in multi-binding** — Navigation links constructed without `rootPath` send users to the wrong binding or 404.
- **Sitemap has wrong URLs** — Sitemap generator omits `rootPath`, causing search engines to index unprefixed URLs that resolve to the default binding.
- **Double slashes** — `rootPath === "/"` concatenated with `/path` produces `//path`. Normalize to empty string.
- **Hardcoded locale paths** — Using `/us/` or `/br/` instead of dynamic `rootPath`. Breaks when bindings are reconfigured.
- **Backend ignores header** — Node service constructs URLs without reading `x-vtex-root-path`, producing wrong canonicals in multi-binding.
- **Missing Vary header** — Response doesn't set `Vary: x-vtex-root-path` and `Vary: x-forwarded-host`, causing the CDN to serve the same cached response for different bindings.

## Review checklist

- [ ] Does the app have a `prepare` middleware that reads `x-vtex-root-path` into `ctx.state.rootPath` (backend) or use `useRuntime()` (frontend)?
- [ ] Does the response set `Vary: x-vtex-root-path` and `Vary: x-forwarded-host` so CDN caches per binding?
- [ ] Are **all** generated URLs (links, redirects, canonicals, sitemaps) prefixed with `rootPath`?
- [ ] Is `rootPath === "/"` normalized to `""` to avoid double slashes?
- [ ] Are there **no** hardcoded locale path prefixes (e.g. `/us/`, `/br/`)?
- [ ] Does the app work correctly in both single-binding and multi-binding stores?

## Related skills

- [vtex-io-service-paths-and-cdn](../vtex-io-service-paths-and-cdn/skill.md) — Route prefixes and CDN behavior
- [vtex-io-service-apps](../vtex-io-service-apps/skill.md) — Backend middleware patterns
- [vtex-io-react-apps](../vtex-io-react-apps/skill.md) — Frontend component patterns

## Reference

- [Cross-Border Store Content Internationalization](https://developers.vtex.com/docs/guides/cross-border-custom-urls-1) — Multi-binding setup for cross-border stores
- [Service Path Patterns](https://developers.vtex.com/docs/guides/service-path-patterns) — Public, segment, and private path prefixes
- [App Development](https://developers.vtex.com/docs/app-development) — VTEX IO app development hub

---

# Security Boundaries & Exposure Review

## When this skill applies

Use this skill when the main question is whether a VTEX IO route, integration, or service boundary is safe.

- Reviewing public versus private route exposure
- Validating external input at service boundaries
- Handling tokens, account context, or sensitive payloads
- Avoiding cross-account, cross-workspace, or cross-user leakage
- Hardening integrations that expose or consume sensitive data

Do not use this skill for:
- policy declaration syntax in `manifest.json`
- service runtime sizing
- logging and observability strategy
- frontend browser security concerns
- deciding which VTEX auth token should call an endpoint

## Decision rules

- Use this skill to decide what data and input may safely cross the app boundary, not which policies or tokens authorize the call.
- Treat every public route as an explicit trust boundary.
- In `service.json`, changing a route from `public: false` to `public: true` is a boundary change and should trigger explicit security review.
- Use `public: true` for routes that must be callable from outside VTEX IO, such as partner webhooks or externally consumed integration endpoints. Treat them as internet-exposed boundaries.
- Use `public: false` for routes that are meant only for VTEX internal flows or other IO apps, but do not treat them as implicitly safe. They still require validation and scoped assumptions.
- A route with `public: true` in `service.json` is reachable from outside the app as long as the account domain is accessible. Do not rely on obscure paths or internal-looking URLs as a security measure.
- Validate external input as early as possible, before it reaches domain logic or downstream integrations.
- For webhook-style routes, validate both structure and authenticity, for example through required fields plus a shared secret or signature header, before calling downstream clients.
- Do not assume a request is safe because it originated from another VTEX service or internal-looking route path.
- Keep account, workspace, and user context explicit when a service reads or writes scoped data.
- When data or behavior must be restricted to a specific workspace, check `ctx.vtex.workspace` explicitly and reject calls from other workspaces.
- Never expose more data than the caller needs. Shape responses intentionally instead of returning raw downstream payloads.
- Keep secrets, tokens, and security-sensitive headers out of logs and route responses.
- Do not use `console.log` or `console.error` in production routes or services. Use `ctx.vtex.logger` for application logging with structured objects, and only use a dedicated external logging client when the app intentionally forwards logs to a partner-owned system.
- Avoid exposing debug or diagnostic routes that return internal configuration, secrets, or full downstream payloads. If such routes are strictly necessary, keep them non-public and limited to minimal, non-sensitive information.
- Use this skill to decide what may cross the boundary, and use `vtex-io-auth-and-policies` to decide how that boundary is authorized and protected.

## Related skills

- [`vtex-io-auth-and-policies`](../vtex-io-auth-and-policies/skill.md) - Use when the main decision is how route or resource access will be authorized
- [`vtex-io-auth-tokens-and-context`](../vtex-io-auth-tokens-and-context/skill.md) - Use when the main decision is which runtime identity should call VTEX endpoints

## Hard constraints

### Constraint: Public routes must validate untrusted input at the boundary

Any route exposed beyond a tightly controlled internal boundary MUST validate incoming data before calling domain logic or downstream clients.

**Why this matters**

Unvalidated input at public boundaries creates the fastest path to abuse, bad writes, and accidental downstream failures.

**Detection**

If a public route forwards body fields, params, or headers directly into business logic or client calls without validation, STOP and add validation first.

**Correct**

```typescript
export async function webhook(ctx: Context) {
  const body = ctx.request.body

  if (!body?.eventId || !body?.type) {
    ctx.status = 400
    ctx.body = { message: 'Invalid payload' }
    return
  }

  await ctx.clients.partnerApi.handleWebhook(body)
  ctx.status = 202
}
```

**Wrong**

```typescript
export async function webhook(ctx: Context) {
  await ctx.clients.partnerApi.handleWebhook(ctx.request.body)
  ctx.status = 202
}
```

### Constraint: Sensitive data must not cross route boundaries by accident

Routes and integrations MUST not leak tokens, internal headers, raw downstream payloads, or data that belongs to another account, workspace, or user context.

**Why this matters**

Boundary leaks are hard to detect once deployed and can expose information far beyond the intended caller scope.

**Detection**

If a route returns raw downstream responses, logs secrets, or mixes contexts without explicit filtering, STOP and narrow the output before proceeding.

**Correct**

```typescript
ctx.body = {
  orderId: order.id,
  status: order.status,
}
```

**Wrong**

```typescript
ctx.body = order
```

### Constraint: Trust boundaries must stay explicit when services call each other

When one service calls another, the receiving boundary MUST still be treated as a real security boundary with explicit validation and scoped assumptions.

**Why this matters**

Internal service-to-service traffic can still carry malformed or overbroad data. Assuming “internal means trusted” leads to fragile security posture and cross-context leakage.

**Detection**

If a service accepts data from another service without validating format, scope, or account/workspace context, STOP and make those checks explicit.

**Correct**

```typescript
if (ctx.vtex.account !== expectedAccount) {
  ctx.status = 403
  return
}
```

**Wrong**

```typescript
await processPartnerPayload(ctx.request.body)
```

## Preferred pattern

Security review should start at the boundary:

1. Who can call this route or trigger this integration?
2. What data enters the system?
3. What must be validated immediately?
4. What data leaves the system?
5. Could account, workspace, or user context leak across the boundary?

Use minimal request and response shapes, explicit validation, and scoped context checks to keep boundaries safe.

## Common failure modes

- Treating public routes like trusted internal handlers.
- Returning raw downstream payloads that expose more data than necessary.
- Logging secrets or security-sensitive headers.
- Using `console.log` in handlers instead of `ctx.vtex.logger`, making logs less structured and increasing the risk of leaking sensitive data.
- Mixing account or workspace context without explicit checks.
- Assuming service-to-service traffic is inherently safe.

## Review checklist

- [ ] Is the trust boundary clear?
- [ ] Are external inputs validated before reaching domain or integration logic?
- [ ] Is the response shape intentionally minimal?
- [ ] Are sensitive values kept out of logs and responses?
- [ ] Could account, workspace, or user context leak across this boundary?

## Reference

- [Service](https://developers.vtex.com/docs/guides/vtex-io-documentation-service) - Route exposure and service behavior
- [Policies](https://developers.vtex.com/docs/guides/vtex-io-documentation-policies) - Authorization-related declaration context

---

# Backend Service Apps & API Clients

## When this skill applies

Use this skill when developing a VTEX IO app that needs backend logic — REST API routes, GraphQL resolvers, event handlers, scheduled tasks, or integrations with VTEX Commerce APIs and external services.

- Building the Service entry point (`node/index.ts`) with typed context, clients, and state
- Creating and registering custom clients extending JanusClient or ExternalClient
- Using `ctx.clients` to access clients with built-in caching, retry, and metrics
- Configuring routes and middleware chains in service.json

Do not use this skill for:
- Manifest and builder configuration (use `vtex-io-app-structure` instead)
- GraphQL schema definitions (use `vtex-io-graphql-api` instead)
- React component development (use `vtex-io-react-apps` instead)

## Decision rules

- The Service class (`node/index.ts`) is the entry point for every VTEX IO backend app. It receives clients, routes (with middleware chains), GraphQL resolvers, and event handlers.
- Every middleware, resolver, and event handler receives `ctx` with: `ctx.clients` (registered clients), `ctx.state` (mutable per-request state), `ctx.vtex` (auth tokens, account info), `ctx.body` (request/response body).
- Use `JanusClient` for VTEX internal APIs (base URL: `https://{account}.vtexcommercestable.com.br`).
- Use `ExternalClient` for non-VTEX APIs (any URL you specify).
- Use `AppClient` for routes exposed by other VTEX IO apps.
- Use `MasterDataClient` for Master Data v2 CRUD operations.
- Register custom clients by extending `IOClients` — each client is lazily instantiated on first access via `this.getOrSet()`.
- Keep clients as thin data-access wrappers. Put business logic in middlewares or service functions.

Client hierarchy:

| Class | Use Case | Base URL |
|-------|----------|----------|
| `JanusClient` | Access VTEX internal APIs (Janus gateway) | `https://{account}.vtexcommercestable.com.br` |
| `ExternalClient` | Access external (non-VTEX) APIs | Any URL you specify |
| `AppClient` | Access routes exposed by other VTEX IO apps | `https://{workspace}--{account}.myvtex.com` |
| `InfraClient` | Access VTEX IO infrastructure services | Internal |
| `MasterDataClient` | Access Master Data v2 CRUD operations | VTEX API |

Architecture:

```text
Request → VTEX IO Runtime → Service
  ├── routes → middleware chain → ctx.clients.{name}.method()
  ├── graphql → resolvers → ctx.clients.{name}.method()
  └── events → handlers → ctx.clients.{name}.method()
                               │
                               ▼
                         Client (JanusClient / ExternalClient)
                               │
                               ▼
                    External Service / VTEX API
```

## Hard constraints

### Constraint: Use @vtex/api Clients — Never Raw HTTP Libraries

All HTTP communication from a VTEX IO service app MUST go through `@vtex/api` clients (JanusClient, ExternalClient, AppClient, or native clients from `@vtex/clients`). You MUST NOT use `axios`, `fetch`, `got`, `node-fetch`, or any other raw HTTP library.

**Why this matters**

VTEX IO clients provide automatic authentication header injection, built-in caching (disk and memory), retry with exponential backoff, timeout management, native metrics and billing tracking, and proper error handling. Raw HTTP libraries bypass all of these. Additionally, outbound traffic from VTEX IO is firewalled — only `@vtex/api` clients properly route through the infrastructure.

**Detection**

If you see `import axios from 'axios'`, `import fetch from 'node-fetch'`, `import got from 'got'`, `require('node-fetch')`, or any direct `fetch()` call in a VTEX IO service app, STOP. Replace with a proper client extending JanusClient or ExternalClient.

**Correct**

```typescript
import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

export class WeatherClient extends ExternalClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('https://api.weather.com', context, {
      ...options,
      headers: {
        'X-Api-Key': 'my-key',
        ...options?.headers,
      },
    })
  }

  public async getForecast(city: string): Promise<Forecast> {
    return this.http.get(`/v1/forecast/${city}`, {
      metric: 'weather-forecast',
    })
  }
}
```

**Wrong**

```typescript
import axios from 'axios'

// This bypasses VTEX IO infrastructure entirely.
// No caching, no retries, no metrics, no auth token injection.
// Outbound requests may be blocked by the firewall.
export async function getForecast(city: string): Promise<Forecast> {
  const response = await axios.get(`https://api.weather.com/v1/forecast/${city}`, {
    headers: { 'X-Api-Key': 'my-key' },
  })
  return response.data
}
```

---

### Constraint: Access Clients via ctx.clients — Never Instantiate Directly

Clients MUST always be accessed through `ctx.clients.{clientName}` in middlewares, resolvers, and event handlers. You MUST NOT instantiate client classes directly with `new`.

**Why this matters**

The IOClients registry manages client lifecycle, ensuring proper initialization with the current request's IOContext (account, workspace, auth tokens). Direct instantiation creates clients without authentication context, without caching configuration, and without connection to the metrics pipeline.

**Detection**

If you see `new MyClient(...)` or `new ExternalClient(...)` inside a middleware or resolver, STOP. The client should be registered in the Clients class and accessed via `ctx.clients`.

**Correct**

```typescript
// node/clients/index.ts
import { IOClients } from '@vtex/api'
import { CatalogClient } from './catalogClient'

export class Clients extends IOClients {
  public get catalog() {
    return this.getOrSet('catalog', CatalogClient)
  }
}

// node/middlewares/getProduct.ts
export async function getProduct(ctx: Context, next: () => Promise<void>) {
  const { clients: { catalog } } = ctx
  const product = await catalog.getProductById(ctx.query.id)
  ctx.body = product
  ctx.status = 200
  await next()
}
```

**Wrong**

```typescript
// node/middlewares/getProduct.ts
import { CatalogClient } from '../clients/catalogClient'

export async function getProduct(ctx: Context, next: () => Promise<void>) {
  // Direct instantiation — no auth context, no caching, no metrics
  const catalog = new CatalogClient(ctx.vtex, {})
  const product = await catalog.getProductById(ctx.query.id)
  ctx.body = product
  ctx.status = 200
  await next()
}
```

---

### Constraint: Avoid Monolithic Service Apps

A single service app SHOULD NOT define more than 10 HTTP routes. If you need more, consider splitting into focused microservice apps.

**Why this matters**

VTEX IO apps run in containers with limited memory (max 512MB). A monolithic app with many routes increases memory usage, cold start time, and blast radius of failures. The VTEX IO platform is designed for small, focused apps that compose together.

**Detection**

If `service.json` defines more than 10 routes, warn the developer to consider splitting the app into smaller services. This is a soft limit — there may be valid exceptions.

**Correct**

```json
{
  "memory": 256,
  "timeout": 30,
  "routes": {
    "get-reviews": { "path": "/_v/api/reviews", "public": false },
    "get-review": { "path": "/_v/api/reviews/:id", "public": false },
    "create-review": { "path": "/_v/api/reviews", "public": false },
    "moderate-review": { "path": "/_v/api/reviews/:id/moderate", "public": false }
  }
}
```

**Wrong**

```json
{
  "memory": 512,
  "timeout": 60,
  "routes": {
    "route1": { "path": "/_v/api/reviews" },
    "route2": { "path": "/_v/api/reviews/:id" },
    "route3": { "path": "/_v/api/products" },
    "route4": { "path": "/_v/api/products/:id" },
    "route5": { "path": "/_v/api/orders" },
    "route6": { "path": "/_v/api/orders/:id" },
    "route7": { "path": "/_v/api/users" },
    "route8": { "path": "/_v/api/users/:id" },
    "route9": { "path": "/_v/api/categories" },
    "route10": { "path": "/_v/api/categories/:id" },
    "route11": { "path": "/_v/api/brands" },
    "route12": { "path": "/_v/api/inventory" }
  }
}
```

12 routes covering reviews, products, orders, users, categories, brands, and inventory — this should be 3-4 separate apps.

## Preferred pattern

Define custom clients:

```typescript
// node/clients/catalogClient.ts
import type { InstanceOptions, IOContext } from '@vtex/api'
import { JanusClient } from '@vtex/api'

export class CatalogClient extends JanusClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(context, {
      ...options,
      headers: {
        VtexIdclientAutCookie: context.authToken,
        ...options?.headers,
      },
    })
  }

  public async getProduct(productId: string): Promise<Product> {
    return this.http.get(`/api/catalog/pvt/product/${productId}`, {
      metric: 'catalog-get-product',
    })
  }

  public async listSkusByProduct(productId: string): Promise<Sku[]> {
    return this.http.get(`/api/catalog_system/pvt/sku/stockkeepingunitByProductId/${productId}`, {
      metric: 'catalog-list-skus',
    })
  }
}
```

Register clients in IOClients:

```typescript
// node/clients/index.ts
import { IOClients } from '@vtex/api'
import { CatalogClient } from './catalogClient'
import { ReviewStorageClient } from './reviewStorageClient'

export class Clients extends IOClients {
  public get catalog() {
    return this.getOrSet('catalog', CatalogClient)
  }

  public get reviewStorage() {
    return this.getOrSet('reviewStorage', ReviewStorageClient)
  }
}
```

Create middlewares using `ctx.clients` and `ctx.state`:

```typescript
// node/middlewares/getReviews.ts
import type { ServiceContext } from '@vtex/api'
import type { Clients } from '../clients'

type Context = ServiceContext<Clients>

export async function validateParams(ctx: Context, next: () => Promise<void>) {
  const { productId } = ctx.query

  if (!productId || typeof productId !== 'string') {
    ctx.status = 400
    ctx.body = { error: 'productId query parameter is required' }
    return
  }

  ctx.state.productId = productId
  await next()
}

export async function getReviews(ctx: Context, next: () => Promise<void>) {
  const { productId } = ctx.state
  const reviews = await ctx.clients.reviewStorage.getByProduct(productId)

  ctx.status = 200
  ctx.body = reviews
  await next()
}
```

Wire everything in the Service entry point:

```typescript
// node/index.ts
import type { ParamsContext, RecorderState } from '@vtex/api'
import { Service, method } from '@vtex/api'

import { Clients } from './clients'
import { validateParams, getReviews } from './middlewares/getReviews'
import { createReview } from './middlewares/createReview'
import { resolvers } from './resolvers'

export default new Service<Clients, RecorderState, ParamsContext>({
  clients: {
    implementation: Clients,
    options: {
      default: {
        retries: 2,
        timeout: 5000,
      },
      catalog: {
        retries: 3,
        timeout: 10000,
      },
    },
  },
  routes: {
    reviews: method({
      GET: [validateParams, getReviews],
      POST: [createReview],
    }),
  },
  graphql: {
    resolvers: {
      Query: resolvers.queries,
      Mutation: resolvers.mutations,
    },
  },
})
```

## Common failure modes

- **Using axios/fetch/got/node-fetch for HTTP calls**: These libraries bypass the entire VTEX IO infrastructure — no automatic auth token injection, no caching, no retry logic, no metrics. Outbound requests may also be blocked by the firewall. Create a proper client extending `ExternalClient` or `JanusClient` instead.
- **Putting business logic in clients**: Clients become bloated and hard to test. Keep clients as thin wrappers around HTTP calls. Put business logic in middlewares or dedicated service functions.
- **Direct client instantiation**: Using `new MyClient(...)` inside a middleware creates clients without auth context, caching, or metrics. Always access via `ctx.clients`.

## Review checklist

- [ ] Are all HTTP calls going through `@vtex/api` clients (no axios, fetch, got)?
- [ ] Are all clients accessed via `ctx.clients`, never instantiated with `new`?
- [ ] Are custom clients registered in the IOClients class?
- [ ] Does the Service entry point correctly wire clients, routes, resolvers, and events?
- [ ] Is business logic in middlewares/resolvers, not in client classes?
- [ ] Does `service.json` have reasonable route count (≤10)?
- [ ] Are client options (retries, timeout) configured appropriately?

## Reference

- [Services](https://developers.vtex.com/docs/guides/vtex-io-documentation-service) — Overview of VTEX IO backend service development
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — Native client list and client architecture overview
- [Developing Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-how-to-create-and-use-clients) — Step-by-step guide for creating custom JanusClient and ExternalClient
- [Using Node Clients](https://developers.vtex.com/docs/guides/using-node-clients) — How to use @vtex/api and @vtex/clients in middlewares and resolvers
- [Calling Commerce APIs](https://developers.vtex.com/docs/guides/calling-commerce-apis-1-getting-the-service-app-boilerplate) — Tutorial for building a service app that calls VTEX Commerce APIs
- [Best Practices for Avoiding Rate Limits](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) — Why clients with caching prevent rate-limit issues

---

# Service Configuration Apps

## When this skill applies

Use this skill when a VTEX IO service should receive structured configuration from another app through the `configuration` builder instead of relying only on local app settings.

- Creating a configuration app with the `configuration` builder
- Exposing configuration entrypoints from a service app
- Sharing one configuration contract across multiple services or apps
- Separating configuration lifecycle from runtime app lifecycle
- Reading injected configuration through `ctx.vtex.settings`

Do not use this skill for:
- simple app-local configuration managed only through `settingsSchema`
- Store Framework block settings through `contentSchemas.json`
- generic service runtime wiring unrelated to configuration
- policy design beyond the configuration-specific permissions required

## Decision rules

- Treat the service app and the configuration app as separate responsibilities.
- The service app owns runtime (`node`, `graphql`, etc.), declares the `configuration` builder in `manifest.json`, defines `configuration/schema.json`, and reads injected values through `ctx.vtex.settings`.
- The configuration app does not own the service runtime. It should not declare `node` or `graphql` builders and usually has only the `configuration` builder.
- The configuration app points to the target service in the `configuration` field and provides concrete values in `<service-app>/configuration.json`.
- Use a configuration app when the configuration contract should live independently from the app that consumes it.
- Prefer a configuration app when multiple apps or services need to share the same configuration model.
- In service apps, expose configuration entrypoints explicitly through `settingsType: "workspace"` in `node/service.json` routes or events, or through `@settings` in GraphQL when the service should receive configuration from a configuration app.
- In configuration apps, the folder name under `configuration/` and the key in the `configuration` field should match the target service app ID, for example `shipping-service` in `vendor.shipping-service`.
- The shape of `configuration.json` must respect the JSON Schema declared by the service app.
- Read received configuration from `ctx.vtex.settings` inside the service runtime instead of making your own HTTP call just to fetch those values.
- Handlers and resolvers should cast or validate `ctx.vtex.settings` to match the configuration schema and apply defaults consistent with that schema.
- Treat configuration apps as a way to inject structured runtime configuration through VTEX IO context, not as a replacement for arbitrary operational data storage.
- Use `settingsSchema` when configuration is local to one app and should be edited directly in Apps > App Settings. Use configuration apps when the contract should be shared, versioned, or decoupled from the consuming app lifecycle.
- If a service configured through a configuration app fails to resolve workspace app configuration due to permissions, explicitly evaluate whether the manifest needs the `read-workspace-apps` policy for that scenario. Do not add this policy by default to unrelated services.
- For service configuration contracts, prefer closed schemas with `additionalProperties: false` and use `definitions` plus `$ref` when the structure becomes more complex.

## Hard constraints

### Constraint: Service apps must explicitly opt in to receiving configuration

A service app MUST declare where configuration can be injected, using `settingsType: "workspace"` in `node/service.json` routes or events, or the `@settings` directive in GraphQL.

**Why this matters**

Configuration apps do not magically apply to all service entrypoints. The service must explicitly mark which routes, events, or queries resolve runtime configuration.

**Detection**

If a service is expected to receive configuration but its routes, events, or GraphQL queries do not declare `settingsType` or `@settings`, STOP and expose the configuration boundary first.

**Correct**

```json
{
  "routes": {
    "status": {
      "path": "/_v/status/:code",
      "public": true,
      "settingsType": "workspace"
    }
  }
}
```

**Wrong**

```json
{
  "routes": {
    "status": {
      "path": "/_v/status/:code",
      "public": true
    }
  }
}
```

### Constraint: Configuration shape must be defined with explicit schema files

Configuration apps and the services they configure MUST use explicit schema files instead of implicit or undocumented payloads.

**Why this matters**

Without `configuration/schema.json` and matching `configuration.json` contracts, shared configuration becomes ambiguous and error-prone across apps.

**Detection**

If a configuration app is introduced without a clear schema file or the service accepts loosely defined configuration payloads, STOP and define the schema first.

**Correct**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$ref": "#/definitions/ServiceConfiguration",
  "definitions": {
    "ServiceConfiguration": {
      "type": "object",
      "properties": {
        "bank": {
          "type": "object",
          "properties": {
            "account": { "type": "string" },
            "workspace": { "type": "string", "default": "master" },
            "version": { "type": "string" },
            "kycVersion": { "type": "string" },
            "payoutVersion": { "type": "string" },
            "host": { "type": "string" }
          },
          "required": ["account", "version", "kycVersion", "payoutVersion", "host"],
          "additionalProperties": false
        }
      },
      "required": ["bank"],
      "additionalProperties": false
    }
  }
}
```

**Wrong**

```json
{
  "anything": true
}
```

### Constraint: Consuming apps must read injected configuration from runtime context, not by inventing extra fetches

When a service is configured through a configuration app, it MUST consume the injected values from `ctx.vtex.settings` instead of creating its own ad hoc HTTP call just to retrieve the same configuration.

**Why this matters**

The purpose of configuration apps is to let VTEX IO inject the structured configuration directly into service context. Adding a custom fetch layer on top creates unnecessary complexity and loses the main runtime advantage of the builder.

**Detection**

If a service already exposes `settingsType` or `@settings` but still performs its own backend fetch to retrieve the same configuration, STOP and move the read to `ctx.vtex.settings`.

**Correct**

```typescript
export async function handleStatus(ctx: Context) {
  const settings = ctx.vtex.settings
  const code = ctx.vtex.route.params.code

  const status = resolveStatus(code, settings)
  ctx.body = { status }
}
```

**Wrong**

```typescript
export async function handleStatus(ctx: Context) {
  const settings = await ctx.clients.partnerApi.getSettings()
  ctx.body = settings
}
```

## Preferred pattern

Model the service and the configuration app as separate contracts:

1. The service app exposes where configuration can be resolved.
2. The service app defines accepted structure in `configuration/schema.json`.
3. The configuration app declares the service as a builder and supplies values in `configuration.json`.
4. The service reads the injected configuration through `ctx.vtex.settings`.

Example: service app `vendor.shipping-service`

`manifest.json`:

```json
{
  "vendor": "vendor",
  "name": "shipping-service",
  "version": "1.0.0",
  "builders": {
    "node": "7.x",
    "configuration": "1.x"
  }
}
```

`configuration/schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$ref": "#/definitions/ShippingConfiguration",
  "definitions": {
    "ShippingConfiguration": {
      "type": "object",
      "properties": {
        "carrierApi": {
          "type": "object",
          "properties": {
            "baseUrl": { "type": "string" },
            "apiKey": { "type": "string", "format": "password" },
            "timeoutMs": { "type": "integer", "default": 3000 }
          },
          "required": ["baseUrl", "apiKey"],
          "additionalProperties": false
        }
      },
      "required": ["carrierApi"],
      "additionalProperties": false
    }
  }
}
```

Example: configuration app `vendor.shipping-config`

`manifest.json`:

```json
{
  "vendor": "vendor",
  "name": "shipping-config",
  "version": "1.0.0",
  "builders": {
    "configuration": "1.x"
  },
  "configuration": {
    "shipping-service": "1.x"
  }
}
```

`configuration/shipping-service/configuration.json`:

```json
{
  "carrierApi": {
    "baseUrl": "https://api.carrier.com",
    "apiKey": "secret-api-key-here",
    "timeoutMs": 5000
  }
}
```

Example: Node service consuming injected configuration

```typescript
export async function createShipment(ctx: Context, next: () => Promise<void>) {
  const settings = ctx.vtex.settings as {
    carrierApi: {
      baseUrl: string
      apiKey: string
      timeoutMs?: number
    }
  }

  const timeoutMs = settings.carrierApi.timeoutMs ?? 3000

  const response = await ctx.clients.carrier.createShipment({
    baseUrl: settings.carrierApi.baseUrl,
    apiKey: settings.carrierApi.apiKey,
    timeoutMs,
    payload: ctx.state.shipmentPayload,
  })

  ctx.body = response
  await next()
}
```

Example: GraphQL query using `@settings`

```graphql
type ShippingStatus {
  orderId: ID!
  status: String!
}

type Query {
  shippingStatus(orderId: ID!): ShippingStatus
    @settings(type: "workspace")
}
```

```typescript
export const resolvers = {
  Query: {
    shippingStatus: async (_: unknown, args: { orderId: string }, ctx: Context) => {
      const settings = ctx.vtex.settings as {
        carrierApi: { baseUrl: string; apiKey: string }
      }

      return ctx.clients.carrier.getStatus({
        baseUrl: settings.carrierApi.baseUrl,
        apiKey: settings.carrierApi.apiKey,
        orderId: args.orderId,
      })
    },
  },
}
```

Minimum working checklist for service configuration apps:

- [ ] The service app declares the `configuration` builder in `manifest.json`.
- [ ] The service app defines a valid `configuration/schema.json`.
- [ ] The configuration app provides `<service-app>/configuration.json` with values compatible with the schema.
- [ ] Service routes or events that need configuration declare `settingsType: "workspace"`.
- [ ] When the flow depends on workspace app resolution, the service manifest evaluates whether `read-workspace-apps` is required.

Use this approach when configuration should be shared, versioned, and injected by VTEX IO runtime rather than fetched ad hoc by service code.

## Common failure modes

- Using app settings when the real need is a shared configuration contract across apps.
- Creating configuration apps without explicit schema files.
- Forgetting `settingsType` or `@settings` in the service that should receive configuration.
- Fetching configuration over HTTP even though it is already injected in `ctx.vtex.settings`.
- Treating configuration apps as general-purpose operational storage.

## Review checklist

- [ ] Is a configuration app really needed instead of plain `settingsSchema`?
- [ ] Could this case be solved with local app settings and `settingsSchema` instead of a separate configuration app?
- [ ] Does the service explicitly opt in to configuration resolution with `settingsType` or `@settings`?
- [ ] When configuration is injected through service routes or events, is `settingsType: "workspace"` declared where needed?
- [ ] Is the configuration contract defined through `configuration/schema.json` and matched by `configuration.json`?
- [ ] Does the service read configuration from `ctx.vtex.settings` instead of inventing extra fetches?
- [ ] If the flow depends on reading installed workspace apps or their configuration, was `read-workspace-apps` evaluated intentionally instead of added by default?
- [ ] Does the configuration schema stay closed and explicit enough for a shared contract?
- [ ] Is the configuration contract clearly separate from operational data storage?

## Reference

- [Developing service configuration apps](https://developers.vtex.com/docs/guides/vtex-io-documentation-developing-service-configuration-apps) - Official guide for service and configuration apps
- [Builders](https://developers.vtex.com/docs/guides/vtex-io-documentation-builders) - Overview of the `configuration` builder
- [Service](https://developers.vtex.com/docs/guides/vtex-io-documentation-service) - Service configuration context for node and GraphQL services

---

# VTEX IO service paths and CDN behavior

## When this skill applies

Use this skill when you define or change **`service.json` routes** for a VTEX IO backend and need the edge (CDN) to pass the **right cookies** and apply the **right caching** for that endpoint’s data.

- Choosing between **public**, **segment** (`/_v/segment/...`), and **private** (`/_v/private/...`) path prefixes for a route
- Setting **`Cache-Control`** (and related headers) on HTTP responses so **public** cache behavior matches **data scope** (anonymous vs segment vs authenticated shopper)
- Explaining why a route **does not** receive `vtex_session` or `vtex_segment` cookies
- Troubleshooting **CloudFront** or edge behavior when cookies are missing (see official troubleshooting)

Do not use this skill for:

- Application-level LRU caches, VBase, or stale-while-revalidate orchestration → use **vtex-io-application-performance**
- GraphQL field-level `@cacheControl` only → use **vtex-io-graphql-api** alongside this skill

## Decision rules

- Paths are declared in **`service.json`** under `routes`. The **prefix** you choose (`/yourPath`, `/_v/segment/yourPath`, `/_v/private/yourPath`) controls **cookie forwarding** and **whether VTEX may cache the service response at the edge**—see the [Service path patterns](https://developers.vtex.com/docs/guides/service-path-patterns) table.
- **Public** (`{yourPath}`): **No guarantee** the app receives request cookies. The edge **may cache** responses when possible. Use for **non-user-specific** data (e.g. static reference data that is safe to share across shoppers).
- **Segment** (`/_v/segment/{yourPath}`): The app receives **`vtex_segment`**. The edge caches **per segment**. Use when the response depends on **segment** (currency, region, sales channel, etc.) but **not** on authenticated identity.
- **Private** (`/_v/private/{yourPath}`): The app receives **`vtex_segment`** and **`vtex_session`**. The edge **does not cache** the service response. Use for **identity- or session-scoped** data (orders, addresses, profile).
- **`Cache-Control` on responses** must align with **classification**: never signal **CDN/shared cache** for payloads that embed **secrets**, **per-user** data, or **authorization** decisions unless the contract is explicitly designed for that (e.g. immutable public assets). When in doubt, prefer **private paths** and **no-store / private** cache directives for shopper-specific JSON.
- Read [Sessions System overview](https://developers.vtex.com/docs/guides/sessions-system-overview) for how cookies relate to paths and sessions.

## Hard constraints

### Constraint: Do not use a public or segment-cached path for private or auth-scoped payloads

Routes that return **authenticated shopper data**, **PII**, or **authorization-sensitive** JSON **must not** rely on **public** paths or **edge-cached** responses that could serve one user’s data to another.

**Why this matters** — The edge may cache or route without the session context you expect; misclassified data can leak across users or segments.

**Detection** — A route under a **public** path returns **order history**, **addresses**, **tokens**, or **account-specific** fields; or **`Cache-Control`** suggests long-lived public caching for such payloads.

**Correct** — Use `/_v/private/...` for the route (or a pattern that receives `vtex_session`), and set **appropriate** `Cache-Control` (e.g. `private, no-store` for JSON APIs that are not cacheable). Note: the **path prefix** (`/_v/private/`) controls **CDN and cookie** behavior; the `"public": true` field controls **whether VTEX auth tokens are required** to call the route—these are **orthogonal**.

```json
{
  "routes": {
    "myOrders": {
      "path": "/_v/private/my-app/orders",
      "public": true
    }
  }
}
```

**Wrong** — Exposing `GET /my-app/orders` as a **public** path (no `/_v/private/` or `/_v/segment/` prefix) and returning **per-user** JSON while **assuming** the browser session is always visible to the service.

## Preferred pattern

1. **Classify the response** (anonymous, segment, authenticated) **before** picking the path prefix.
2. **Map** to **public** / **segment** / **private** per [Service path patterns](https://developers.vtex.com/docs/guides/service-path-patterns).
3. **Set** response headers **explicitly** where the platform allows: align **`Cache-Control`** with the same classification (public immutable vs private vs no-store).
4. **Document** any path that must stay **private** for security or compliance so storefronts and BFFs do not link-cache it incorrectly.

## Common failure modes

- **Assuming cookies on public routes** — Services do not reliably receive `vtex_session` on public paths; identity logic fails intermittently.
- **Caching personalized JSON at the edge** — Long `max-age` on user-specific responses without `private` path + correct cache policy.
- **Mixing concerns** — One route returns both **public catalog** and **private account** data; split endpoints or use **private** + server-side auth checks.
- **Ignoring segment** — Price or promo that varies by **currency** or **segment** is served on a **public** path and **cached** for the wrong segment.

## Review checklist

- [ ] Is each route’s **path prefix** (`public` / `/_v/segment` / `/_v/private`) justified by **cookie** and **Caching behavior** in the official table?
- [ ] For **shopper-specific** or **auth** responses, is the route **private** (or otherwise protected) and **not** edge-cacheable inappropriately?
- [ ] Do **`Cache-Control`** (and related) headers **match** data sensitivity?
- [ ] Are **parallel** calls from the client using the **correct** path for each payload type?

## Related skills

- [vtex-io-application-performance](../vtex-io-application-performance/skill.md) — Application performance (LRU, VBase, AppSettings, parallel fetches, tenant keys)
- [vtex-io-service-apps](../vtex-io-service-apps/skill.md) — `service.json` and Service entry
- [vtex-io-graphql-api](../vtex-io-graphql-api/skill.md) — GraphQL cache and `@cacheControl`
- [headless-caching-strategy](../../../headless/skills/headless-caching-strategy/skill.md) — Storefront / BFF caching

## Reference

- [Service path patterns](https://developers.vtex.com/docs/guides/service-path-patterns) — Path formats, cookies, caching, use cases
- [Sessions System overview](https://developers.vtex.com/docs/guides/sessions-system-overview) — `vtex_segment`, `vtex_session`, session behavior
- [App Development](https://developers.vtex.com/docs/app-development) — VTEX IO app development hub
- [VTEX IO Engineering guidelines](https://developers.vtex.com/docs/guides/vtex-io-documentation-engineering-guidelines) — Scalability and IO development practices

---

# Service Runtime & Execution Model

## When this skill applies

Use this skill when the main decision is how a VTEX IO backend app runs inside the `node` builder: how the `Service` entrypoint is structured, how runtime configuration is declared, and how routes, events, or GraphQL handlers are registered into the service.

- Creating a new backend app under `node/`
- Structuring `node/index.ts` as the service entrypoint
- Defining typed `Context`, `State`, and params contracts for handlers
- Configuring `service.json` for timeout, memory, workers, and replicas
- Troubleshooting runtime issues caused by service registration or execution model mismatches
- Registering GraphQL handlers at the runtime level, while keeping schema and resolver design in a separate skill

Do not use this skill for:
- deciding the app contract in `manifest.json`
- designing custom clients or integration transport layers
- detailed HTTP route handler behavior
- event-specific business workflows
- GraphQL schema or resolver modeling beyond runtime registration

## Decision rules

- Treat `node/index.ts` as the runtime composition root of the backend app.
- Use the `Service` definition to register runtime surfaces such as routes, events, and GraphQL handlers, not to hold business logic directly.
- Keep runtime wiring explicit: context typing, client typing, route registration, and event registration should be visible at the service boundary.
- Put execution knobs such as timeout, ttl, memory, workers, and replica limits in `service.json`, not inside handler code.
- Use `service.json` to declare the runtime parameters the platform uses to execute the service, especially `memory`, `timeout`, `ttl`, `minReplicas`, `maxReplicas`, `workers`, `routes`, `events`, and `rateLimitPerReplica`.
- Use `routes` in `service.json` to expose HTTP entrypoints. Routes are private by default, so set `public: true` explicitly for routes that must be externally reachable.
- Use `smartcache: true` only on idempotent, cacheable routes where the same response can be safely reused across repeated requests. Avoid it on personalized, authenticated, or write-oriented endpoints.
- Use `events` in `service.json` to declare which event sources and handlers are part of the service runtime. Keep event registration in the runtime layer and event-specific business rules in dedicated event modules.
- Use `rateLimitPerReplica` to shape throughput per replica for requests and events. Set a global baseline only when the service needs it, then add small explicit overrides only for expensive routes or noisy event sources.
- Do not use `rateLimitPerReplica` as a substitute for redesigning expensive routes, queueing work, or moving slow operations to async processing.
- Keep handlers focused on request or event behavior; keep runtime structure focused on bootstrapping and registration.
- Model `Context`, `State`, and params types deliberately so middlewares and handlers share a stable contract. Apply the same typed `Context` and `State` to middlewares so they can safely manipulate `ctx.state`, `ctx.vtex`, and params without falling back to `any`.
- If a backend app starts mixing runtime wiring, client implementation, and business rules in the same file, split those concerns before expanding the service further.
- Although some authorization fields such as `routes.access` or `routes.policies` may live in `service.json`, they are primarily authorization concerns and belong in auth or security-focused skills rather than this runtime skill.

Runtime sizing heuristics:

- These ranges are intended for partner and account-level apps. Native VTEX core services may legitimately use much higher values such as thousands of MB of memory or hundreds of replicas, but those values should not be used as defaults for custom apps.

Suggested defaults:

- Start synchronous HTTP services with `timeout` between 10 and 30 seconds. For UX-facing routes, prefer 5 to 15 seconds.
- Start `memory` at 256 MB.
- Start `workers` at 1.
- Use `minReplicas: 2` as the default for installed apps, and reserve `minReplicas: 1` for linked-app development contexts where the platform allows it.
- Use `maxReplicas: 5` as the lowest practical starting point, since the documented minimum is `5`.
- Use `ttl` intentionally. In VTEX IO, `ttl` is measured in minutes, with platform defaults and limits that differ from `timeout`. For partner apps, start from the default `10` minutes and increase intentionally up to `60` only when reducing cold starts matters more than allowing idle instances to sleep sooner.

Scaling ranges and exceptions:

- Use 128 to 256 MB for simpler IO-bound services, and move to 512 MB only when there is evidence of OOM, large payload processing, or heavier libraries.
- Increase `workers` to 2 to 4 only for high-throughput IO-bound workloads after measuring benefit. Avoid using more than 4 workers per instance as a default.
- Increase `maxReplicas` from `5` toward `10` only when public traffic or predictable peaks justify it. Treat values above 10 as exceptions that require explicit justification and monitoring in partner apps.
- Avoid `timeout` values above 60 seconds for HTTP routes; if more time is needed, redesign the flow as async work.
- Remember that `ttl` has a documented minimum of `10` minutes and maximum of `60` minutes. Use higher values intentionally to reduce cold starts on low-traffic or bursty services, and avoid treating `ttl` like a per-request timeout.
- For partner apps, `rateLimitPerReplica.perMinute` often starts in the `60` to `300` range for normal routes and in the `10` to `60` range for more expensive ones. `rateLimitPerReplica.concurrent` often starts between `1` and `5`.

## Hard constraints

### Constraint: The Service entrypoint must stay a runtime composition root

`node/index.ts` MUST define and export the VTEX IO service runtime structure, not become a catch-all file for business logic, data transformation, or transport implementation.

**Why this matters**

When the entrypoint mixes registration with business logic, the execution model becomes harder to reason about, handlers become tightly coupled, and changes to routes, events, or GraphQL surfaces become risky.

**Detection**

If `node/index.ts` contains large handler bodies, external API calls, complex branching, or data-mapping logic, STOP and move that logic into dedicated modules. Keep the entrypoint focused on typing and registration.

**Correct**

```typescript
import type { ClientsConfig, RecorderState, ServiceContext } from '@vtex/api'
import { Service } from '@vtex/api'
import { clients, Clients } from './clients'
import { routes } from './routes'

export interface State extends RecorderState {}

export type Context = ServiceContext<Clients, State>

const clientsConfig: ClientsConfig<Clients> = {
  implementation: clients,
  options: {},
}

export default new Service<Clients, State>({
  clients: clientsConfig,
  routes,
})
```

**Wrong**

```typescript
import { Service } from '@vtex/api'
import axios from 'axios'

export default new Service({
  routes: {
    reviews: async (ctx: any) => {
      const response = await axios.get('https://example.com/data')
      const transformed = response.data.items.map((item: any) => ({
        ...item,
        extra: true,
      }))

      ctx.body = transformed.filter((item: any) => item.active)
    },
  },
})
```

### Constraint: Runtime configuration must be expressed in `service.json`, not improvised in code

Resource and execution settings such as timeout, ttl, memory, workers, and replica behavior MUST be configured in `service.json` when the app depends on them.
`service.json` resides inside the `node/` folder and centralizes runtime parameters such as routes, events, memory, timeout, ttl, workers, replicas, and rate limits for this service.

**Why this matters**

These settings are part of the service runtime contract with the platform. Hiding them in assumptions or spreading them across code makes behavior harder to predict and can cause timeouts, cold-start churn, underprovisioning, or scaling mismatches. In VTEX IO, `ttl` is especially important because it is measured in minutes and influences how aggressively service infrastructure can go idle between requests.
Using the minimum `ttl` on low-traffic services can increase cold starts, because the platform is allowed to scale the service down more aggressively between bursts.

**Detection**

If the app depends on long-running work, concurrency, warm capacity, or specific route exposure behavior, STOP and verify that the relevant `service.json` settings are present and intentional. If the behavior is only implied in code comments or handler logic, move it into runtime configuration.

**Correct**

```json
{
  "memory": 256,
  "timeout": 30,
  "ttl": 10,
  "minReplicas": 2,
  "maxReplicas": 10,
  "workers": 4,
  "rateLimitPerReplica": {
    "perMinute": 300,
    "concurrent": 10
  },
  "routes": {
    "reviews": {
      "path": "/_v/api/reviews",
      "public": false
    }
  }
}
```

**Wrong**

```json
{
  "routes": {
    "reviews": {
      "path": "/_v/api/reviews"
    }
  }
}
```

This runtime configuration is incomplete for a service that depends on explicit timeout, concurrency, rate limiting, or replica behavior, and it leaves execution characteristics undefined.

### Constraint: Route exposure must be explicit in the runtime contract

Every HTTP route exposed by the service MUST be declared in `service.json` with an intentional visibility choice. Do not rely on implicit defaults when the route should be private or public.
Routes are private by default, so always set `public: true` explicitly when the route must be externally reachable.

**Why this matters**

Route visibility is part of the runtime contract of the service. If exposure is ambiguous, a route can be published with the wrong accessibility, which creates security risk for private handlers and integration failures for routes expected to be public.

**Detection**

If a route exists in the service runtime, STOP and verify that it is declared in `service.json` and that `public` matches the intended exposure. If the route is consumed only by trusted backoffice or app-to-app flows, default to checking that it is private before expanding access.

**Correct**

```json
{
  "routes": {
    "status": {
      "path": "/_v/status/health",
      "public": true,
      "smartcache": true
    },
    "reviews": {
      "path": "/_v/api/reviews",
      "public": false
    }
  }
}
```

**Wrong**

```json
{
  "routes": {
    "reviews": {
      "path": "/_v/api/reviews"
    }
  }
}
```

This route leaves visibility implicit, so the runtime contract does not clearly communicate whether the endpoint is meant to be public or protected.

### Constraint: Typed context and state must match the handlers registered in the runtime

The service MUST define `Context`, `State`, and handler contracts that match the routes, events, or GraphQL handlers it registers.

**Why this matters**

Untyped or inconsistent runtime contracts make middleware composition fragile and allow handlers to rely on state or params that are never guaranteed to exist.

**Detection**

If middlewares or handlers use `ctx.state`, `ctx.clients`, `ctx.vtex`, or params fields without a shared typed contract, STOP and introduce or fix the runtime types before adding more handlers.

**Correct**

```typescript
import type { ParamsContext, RecorderState, ServiceContext } from '@vtex/api'

interface State extends RecorderState {
  reviewId?: string
}

type CustomContext = ServiceContext<Clients, State, ParamsContext>

export async function getReview(ctx: CustomContext) {
  ctx.state.reviewId = ctx.vtex.route.params.id
  ctx.body = { id: ctx.state.reviewId }
}
```

**Wrong**

```typescript
export async function getReview(ctx: any) {
  ctx.state.reviewId = ctx.params.review
  ctx.body = { id: ctx.state.missingField.value }
}
```

## Preferred pattern

Recommended file layout:

```text
node/
├── index.ts
├── clients/
│   └── index.ts
├── routes/
│   └── index.ts
├── events/
│   └── index.ts
├── graphql/
│   └── index.ts
└── middlewares/
    └── validate.ts
```

Minimal service runtime pattern:

```typescript
import type { ClientsConfig, RecorderState, ServiceContext } from '@vtex/api'
import { Service } from '@vtex/api'
import { clients, Clients } from './clients'
import { routes } from './routes'

export interface State extends RecorderState {}

export type Context = ServiceContext<Clients, State>

const clientsConfig: ClientsConfig<Clients> = {
  implementation: clients,
  options: {},
}

export default new Service<Clients, State>({
  clients: clientsConfig,
  routes,
})
```

Minimal `service.json` pattern:

```json
{
  "memory": 256,
  "timeout": 30,
  "ttl": 10,
  "minReplicas": 2,
  "maxReplicas": 5,
  "workers": 1,
  "rateLimitPerReplica": {
    "perMinute": 120,
    "concurrent": 4
  },
  "routes": {
    "status": {
      "path": "/_v/status/health",
      "public": true,
      "smartcache": true
    },
    "reviews": {
      "path": "/_v/api/reviews",
      "public": false
    }
  },
  "events": {
    "orderCreated": {
      "sender": "vtex.orders-broadcast",
      "topics": ["order-created"],
      "rateLimitPerReplica": {
        "perMinute": 60,
        "concurrent": 2
      }
    }
  }
}
```

Use the service entrypoint to compose runtime surfaces, then push business behavior into handlers, clients, and other focused modules.
If `routes/index.ts` or `events/index.ts` grows too large, split it by domain such as `routes/orders.ts` or `events/catalog.ts` and keep the index file as a small registry.

## Common failure modes

- Putting business logic directly into `node/index.ts`.
- Treating `service.json` as optional when runtime behavior depends on explicit resource settings.
- Setting `ttl` too low and causing the service to sleep too aggressively between bursts of traffic.
- Enabling `smartcache` on personalized or write-oriented routes and risking incorrect cache reuse across requests.
- Registering routes, events, or GraphQL handlers without a clear typed `Context` and `State`.
- Mixing runtime composition with client implementation details.
- Letting one service entrypoint accumulate unrelated responsibilities across HTTP, events, and GraphQL without clear module boundaries.

## Review checklist

- [ ] Is `node/index.ts` acting as a runtime composition root rather than a business-logic file?
- [ ] Are routes, events, and GraphQL handlers registered explicitly and cleanly?
- [ ] Does `service.json` express the runtime behavior the app actually depends on?
- [ ] Are `Context`, `State`, and params types shared consistently across handlers?
- [ ] Are runtime concerns separated from client implementation and business logic?

## Reference

- [Service](https://developers.vtex.com/docs/guides/vtex-io-documentation-service) - VTEX IO service runtime structure and registration
- [Service JSON](https://developers.vtex.com/docs/guides/vtex-io-documentation-service-json) - Runtime configuration for VTEX IO services
- [Node Builder](https://developers.vtex.com/docs/guides/vtex-io-documentation-node-builder) - Backend app structure under the `node` builder
- [Developing an App](https://developers.vtex.com/docs/guides/vtex-io-documentation-4-developing-an-app) - General backend app development flow

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

- [vtex-io-application-performance](../vtex-io-application-performance/skill.md) — Caching layers and parallel I/O applicable inside transforms
- [vtex-io-service-paths-and-cdn](../vtex-io-service-paths-and-cdn/skill.md) — Route prefix for the transform endpoint
- [vtex-io-service-apps](../vtex-io-service-apps/skill.md) — Service class, clients, and middleware basics
- [vtex-io-app-contract](../vtex-io-app-contract/skill.md) — Manifest, builders, policies

## Reference

- [VTEX Session System](https://developers.vtex.com/docs/guides/vtex-io-documentation-using-the-session-manager) — Session manager overview and API
- [App Development](https://developers.vtex.com/docs/app-development) — VTEX IO app development hub
- [Clients](https://developers.vtex.com/docs/guides/vtex-io-documentation-clients) — VBase, MasterData, and custom clients
- [Engineering Guidelines](https://developers.vtex.com/docs/guides/vtex-io-documentation-engineering-guidelines) — Scalability and IO development practices

---

# Storefront React Components

## When this skill applies

Use this skill when building shopper-facing React components under the `react` builder for storefront experiences.

- Creating product or category UI widgets
- Building custom banners, forms, and shopper-facing layout pieces
- Using storefront hooks or context providers
- Styling components with css-handles

Do not use this skill for:
- admin pages
- block registration and render-runtime contracts
- service runtime or backend route design
- GraphQL schema design

## Decision rules

- Treat storefront components as browser-facing UI and keep them safe for shopper contexts.
- Prefer keeping storefront components presentational and props-driven, and move complex data fetching or business logic to hooks or container components.
- Use `vtex.css-handles` instead of hardcoded global class names.
- Prefer receiving data through props or documented storefront hooks and contexts such as `useProduct`, `useRuntime`, or `useOrderForm` instead of calling VTEX APIs directly from the browser or using app keys in storefront code.
- Keep components resilient to loading, empty, and unavailable product or search context.
- For shopper-facing copy, use message IDs and helpers from the messages infrastructure, as described in `vtex-io-messages-and-i18n`, instead of string literals.
- Treat storefront components as part of the storefront accessibility surface: use semantic HTML elements such as `button` or `a` instead of clickable `div`s, and ensure important content has appropriate labels or alternative text.
- When accessing browser globals such as `window` or `document`, guard against server-side execution, for example by using `useEffect` or checking `typeof window !== 'undefined'`.

## Hard constraints

### Constraint: Storefront styling must use css-handles

Storefront components MUST expose styling through `css-handles`, not arbitrary hardcoded class names.

**Why this matters**

css-handles are the customization contract for storefront components. Hardcoded or hidden class names make themes harder to extend safely.

**Detection**

If a storefront component uses arbitrary global class names without css-handles, STOP and expose styling through handles first.

**Correct**

```tsx
const CSS_HANDLES = ['container', 'title'] as const
```

**Wrong**

```tsx
return <div className="my-random-block-root">...</div>
```

### Constraint: Storefront components must remain browser-safe

Storefront React code MUST not depend on Node-only APIs or server-only assumptions.

**Why this matters**

These components run in the shopper-facing frontend. Server-only dependencies break rendering and create runtime failures in the browser.

**Detection**

If a component uses Node-only modules, filesystem access, or server runtime assumptions, STOP and redesign it for the browser.

**Correct**

```tsx
return <span>{label}</span>
```

**Wrong**

```tsx
import fs from 'fs'
```

### Constraint: Shopper-facing strings must be localizable

Visible storefront strings MUST use the app i18n pattern instead of hardcoded text.

**Why this matters**

Storefront UIs run across locales and stores. Hardcoded strings make the component less reusable and less consistent with VTEX IO localization.

**Detection**

If shopper-visible copy is hardcoded in JSX, STOP and move it to the i18n mechanism.

**Correct**

```tsx
<FormattedMessage id="storefront.cta" />
```

**Wrong**

```tsx
<span>Buy now</span>
```

## Preferred pattern

Keep storefront components small, props-driven, css-handle-based, and safe for shopper contexts.

Minimal css-handles pattern:

```tsx
import { useCssHandles } from 'vtex.css-handles'

const CSS_HANDLES = ['container', 'title'] as const

export function MyComponent() {
  const { handles } = useCssHandles(CSS_HANDLES)

  return (
    <div className={handles.container}>
      <h2 className={handles.title}>...</h2>
    </div>
  )
}
```

## Common failure modes

- Hardcoding class names instead of using css-handles.
- Using browser-unsafe dependencies.
- Hardcoding shopper-visible strings.
- Fetching data in ad hoc ways instead of using VTEX storefront patterns.
- Putting complex business logic or heavy data fetching directly inside presentational components instead of using hooks or containers.
- Using non-semantic clickable elements such as `div` or `span` with `onClick` where a `button` or `a` element should be used.

## Review checklist

- [ ] Is this component truly shopper-facing?
- [ ] Are styles exposed through css-handles?
- [ ] Is the component safe for browser execution?
- [ ] Are visible strings localized?
- [ ] Is the data flow appropriate for a storefront component?

## Related skills

- [`vtex-io-render-runtime-and-blocks`](../vtex-io-render-runtime-and-blocks/skill.md) - Use when the main question is block registration and Store Framework wiring
- [`vtex-io-messages-and-i18n`](../vtex-io-messages-and-i18n/skill.md) - Use when the main question is how shopper-facing strings should be translated and organized

## Reference

- [Store Framework](https://developers.vtex.com/docs/guides/vtex-io-documentation-store-framework) - Storefront app context, data, and hooks
- [CSS Handles](https://developers.vtex.com/docs/guides/css-handles) - Styling contract for VTEX IO storefront components
