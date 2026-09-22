This skill provides guidance for AI agents working with VTEX Well-Architected Commerce & Solution Architecture. Apply these constraints and patterns when assisting developers with apply when scoping, reviewing, or documenting cross-cutting VTEX commerce architecture across storefront, IO, headless, marketplace, payments, or any other VTEX module. Grounds work in the Well-Architected Commerce framework—Technical Foundation (reliability, trust, integrity; security, infrastructure, compliance), Future-proof (innovation, simplicity, efficiency; scalable and adaptable solutions), and Operational Excellence (accuracy, accountability, data-driven improvement; process and customer experience). Routes implementation detail to product tracks (IO caching and paths, Master Data strategy, marketplace integrations). Use for solution design, architecture reviews, and RFP-level technical structure.

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
