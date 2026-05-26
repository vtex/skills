---
name: sales-app-extensibility
description: "Apply when building, customizing, or deploying extensions for VTEX Sales App. Covers the complete 7-step workflow from prerequisite checks through code generation to deployment, including extension points (cart, PDP, menu), React hooks (useCart, usePDP, useCartItem, useCurrentUser, useExtension), TypeScript types, secure API integration patterns, and API documentation ingestion (OpenAPI, URLs, or inline specs) to generate typed integrations."
---

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

**Step 1** — Discovery. Detect use case from keywords, ask follow-up questions, determine API auth strategy. If the user provides API documentation (URL, OpenAPI/Swagger file, Markdown, or inline text), ingest it to extract endpoint details and response shapes — skip the equivalent manual questions. Validate extracted information with the user. Load the [discovery reference](references/discovery-and-use-cases.md) for detailed question flows and the API Documentation Ingestion section.

**Step 2** — Map requirements to extension point + hooks + template. Present plan listing the files to be created: `components/<ComponentName>.tsx`, `components/<ComponentName>.css` (plain CSS — **never** `.module.css`), and `index.tsx`. Wait for approval.

**Step 3** — Generate `<ComponentName>.tsx`, `<ComponentName>.css` (plain CSS, **never** `.module.css`), and `index.tsx`.

Required references for this step (load before generating):
- [code-templates-and-patterns.md](references/code-templates-and-patterns.md) — all component templates, the CSS template (with the full Sales App design system inlined: tokens, typography, spacing, responsive), the `index.tsx` template, type generation rules, and the custom fetch hook pattern.
- [extension-points-hooks-and-types.md](references/extension-points-hooks-and-types.md) — hook return types and TypeScript definitions.
- [static-analysis-rules.md](references/static-analysis-rules.md) — sandbox security, CSS containment, and React performance rules from `@vtex/fsp-analyzer`. Run these checks on all generated files.
- [design-guidelines.md](references/design-guidelines.md) — load when the extension renders any UI text (sentence case rule) or uses icons (Phosphor Icons).

If API documentation was ingested in Step 1, generate TypeScript interfaces from the extracted response shapes and use them in the component instead of the `${DATA_INTERFACE}` placeholder. If the extension calls 2+ endpoints, extract fetch logic into custom hook(s). Validate against the 12-point checklist in code-templates-and-patterns.md. Fix all violations before presenting code; surface warnings to the user.

**Step 4** — Generate `docs/<ExtensionName>.md` inside the Sales App package (create the `docs/` folder if needed). Load the [documentation template reference](references/documentation-template.md) for the required 9-section structure and the markdown skeleton to fill in.

**Step 5** — Provide local dev commands and test URLs. Load the [dev/build/deploy reference](references/local-dev-build-and-deploy.md).

**Step 6** — Build command and deployment guide. Load the [dev/build/deploy reference](references/local-dev-build-and-deploy.md).

## Reference Files

Load these on demand based on what the task requires. Do not load all of them upfront.

| File | Load when… |
|------|-----------|
| [references/extension-points-hooks-and-types.md](references/extension-points-hooks-and-types.md) | Choosing an extension point, selecting hooks, looking up TypeScript types (`CartItem`, `ProductSku`, `Totalizers`, `Attachment`), or checking hook return values and availability per extension point |
| [references/code-templates-and-patterns.md](references/code-templates-and-patterns.md) | Generating extension code — simple, hook, API, IO Proxy, or Direct Auth templates; **CSS template with the full Sales App design system inlined (tokens, typography, spacing, responsive)**; `index.tsx` with `defineExtensions`; hook initialization; validation checklist |
| [references/discovery-and-use-cases.md](references/discovery-and-use-cases.md) | Running Step 1 (Discovery) — use case detection keywords, follow-up questions, API auth decision tree, IO Proxy vs Direct Auth flow |
| [references/local-dev-build-and-deploy.md](references/local-dev-build-and-deploy.md) | Running Steps 5–6 — dev server commands, test URLs, build command, common build errors, FastStore WebOps deployment, monitoring, rollback |
| [references/static-analysis-rules.md](references/static-analysis-rules.md) | Validating generated code (Step 3) — sandbox security, CSS containment, and React performance rules from `@vtex/fsp-analyzer`; full rule catalog with violation IDs, detection patterns, and correct/wrong examples |
| [references/design-guidelines.md](references/design-guidelines.md) | Writing UI text (sentence case rule) or using icons (Phosphor Icons). **CSS-related design rules — tokens, typography, spacing, responsive — are inlined directly in the CSS template inside code-templates-and-patterns.md, so this file is not needed for CSS generation.** |
| [references/documentation-template.md](references/documentation-template.md) | Writing the `docs/<ExtensionName>.md` file in Step 4 — the 9-section structure and markdown skeleton |

## Common failure modes

- **Skipping prerequisite checks** — Generating code without FastStore/Sales App installed. Always confirm both before Step 1.
- **Not presenting plan** — User may want a different approach. Always confirm at Step 2 before generating code.
- **Skipping documentation** — Extension generated without `docs/<ExtensionName>.md`. Load documentation-template.md for the required structure.
- **Inventing API response types** — Generated interface doesn't match actual API. If documentation was provided, derive types from it; if not, ask the user for a sample JSON response.
- **Ignoring provided API documentation** — User provided a URL or file but agent asked manual questions anyway. Always check for documentation first and use the API Documentation Ingestion flow.
- **Inline fetch with 2+ endpoints** — Multiple `fetch` calls inside the component body. Extract into custom hook(s) in `hooks/use{Purpose}.ts`.
- **Placing code outside packages/sales-app/src/** — Files outside this path are not included in the build.

> Code-level violations (DOM APIs, Node imports, eval, CSS containment, React performance, design tokens) are enforced by `@vtex/fsp-analyzer` and caught during Step 3 validation. See [static-analysis-rules.md](references/static-analysis-rules.md) and [design-guidelines.md](references/design-guidelines.md).

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

> All other code-level rules (sandbox APIs, CSS containment, React performance, design tokens) are enforced by `@vtex/fsp-analyzer` and checked during Step 3. See [static-analysis-rules.md](references/static-analysis-rules.md) and [design-guidelines.md](references/design-guidelines.md).

## Related skills

- `faststore-storefront` — storefront customization outside Sales App
- `vtex-io-app-contract` — building VTEX IO proxy apps for secure API integration

## Reference

- Sales App setup: https://beta.fast.store/sales-app/setting-up
- FastStore getting started: https://beta.fast.store/getting-started
- VTEX Sales App documentation: https://help.vtex.com/en/tracks/instore-getting-started-and-setting-up
- VTEX IO app development: https://developers.vtex.com/docs/guides/vtex-io-documentation-developing-an-app
