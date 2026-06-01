# FastStore v3 → v4 Migration

A reusable guide for migrating any VTEX FastStore storefront from v3 to v4.
Written from two real migrations; all store/account names below are
placeholders — substitute the values for the store being migrated.

Conventions used here:
- `<store>` — the storefront repo being migrated.
- `<store>` is assumed to be a yarn-workspaces monorepo with the FastStore app
  under `packages/discovery` (a single-package store has the same files at the
  repo root — adjust paths accordingly).
- `@vtex/faststore-plugin-buyer-portal` is the B2B plugin; a store without it
  simply skips every plugin-related step.

---

## 0. Outcome & the two install modes

The goal: `yarn build` and `yarn dev` both succeed on FastStore v4.

Keep these two setups separate:

- **Deployable install** (what gets committed / what CI and production use) —
  `package.json` pins *published* package versions; a plain `yarn install`
  succeeds with no symlinks and no sibling checkouts. This is the committed
  state.
- **Local multi-repo testing** (optional, never committed) — validating the
  store against *unpublished* `faststore` / plugin source via a symlink layer
  applied on top of a normal install. See §9. Revert to the deployable state
  before committing.

---

## 1. Node 24 is mandatory

FastStore v4's dependency tree (e.g. `eslint-visitor-keys@5`) declares
`engines.node` of `>=20.19 || >=22.13 || >=24`. A plain `yarn install` on an
older Node (e.g. 20.12) fails with `Found incompatible module`.

- Use Node 24 for install, build and dev.
- Set `volta.node` to `"24.0.2"` (or the latest Node 24 patch) in `packages/discovery/package.json`.
- Set `experimental.nodeVersion: 24` in `discovery.config.js`.

---

## 2. Deployable `package.json`

The store declares only the VTEX packages and the framework — **never**
hand-list `@faststore/core`'s transitive dependencies; they arrive through
`@faststore/cli`.

`packages/discovery/package.json` → `dependencies` (keep any store-specific
app dependencies — e.g. `crypto-js`, `draft-js` — alongside these):

```json
{
  "@faststore/cli": "<published v4 release>",
  "@vtex/faststore-plugin-buyer-portal": "<published v4 release>",
  "graphql": "^16.11.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.24.1"
}
```

**Important:** do **not** declare `next` in `dependencies` — Next.js is now
managed internally by `@faststore/cli`, and declaring it separately causes
version conflicts. Also update `typescript` in `devDependencies` to `^5.9.3`.

`graphql` must be declared explicitly because it is a `peerDependency` of
`@faststore/cli` — yarn v1 does not install peer dependencies automatically.

Root `package.json`: `@faststore/cli` (devDependency) +
`@vtex/faststore-plugin-buyer-portal` (dependency).

**Monorepo stores only:** add `@inquirer/type` to the `resolutions` field in
the root `package.json` to avoid version conflicts with the `inquirer` package:

```json
{
  "resolutions": {
    "@inquirer/type": "^1.5.5"
  }
}
```

**Pin npm releases, not pkg.pr.new / pkg.csb.dev tarballs.** The faststore v4
monorepo uses pnpm `catalog:` / `workspace:*` specs. `npm publish` (via
`pnpm publish`) resolves these to concrete versions, so npm releases install
cleanly. **pkg.pr.new tarballs do NOT** — they keep `catalog:` unresolved and
`yarn install` fails with `Couldn't find any versions ... matches "catalog:"`.

`@faststore/cli` transitively brings `@faststore/core`, which brings
`@faststore/ui`, `@faststore/api`, `@faststore/sdk`, `@faststore/diagnostics`,
`@faststore/lighthouse`, `@faststore/components`, plus the v4 third-party tree
(Next 16, GraphQL 16, etc.).

> Remove every v3-only hand-listed transitive dependency from
> `packages/discovery/package.json` — they now arrive via `@faststore/cli`.

---

## 3. `discovery.config.js` must be a plain config

v3 stores often start `discovery.config.js` with Node code:

```js
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, ".env") });
```

In v4 this file is pulled into the client/instrumentation bundle, where webpack
cannot resolve Node built-ins — `Module not found: Can't resolve 'path'` from
`dotenv` — and routes 500.

- **Remove** the `require("path")` / `require("dotenv")` / `dotenv.config()`
  lines. Next.js loads `.env` / `.env.local` automatically; reading
  `process.env.NEXT_PUBLIC_*` directly is fine.
- **Remove any v3 `webpack()` callback.** FastStore v4 core owns the webpack
  config; in v3, core never invoked `storeConfig.webpack`, so that callback was
  already dead code. (Do not try to re-enable it — see §7.)
- Set `experimental.nodeVersion: 24`.
- If the store consumes linked/transpiled local packages, add
  `experimental.transpilePackages: [ ... ]`.

---

## 4. SCSS migration: `@import` → `@use` / `@forward`

v4 FastStore uses the Dart Sass **module system**. `@import` is deprecated
(removed in Dart Sass 3.0). Treat this as a repo-wide pass over every `.scss`
file in the store.

### 4.1 Namespaced mixins & functions

Shared mixins/functions are reached through a **namespaced module**:

```scss
@use "@faststore/ui/src/styles/base/utilities" as u;   // FIRST line(s) of the file

[data-fs-foo] {
  @include u.media(">=notebook") { ... }   // not  @include media(...)
  top: u.rem(9px);                          // not  rem(9px)
  @include u.layout-content;                // not  @include layout-content
}
```

- All `@use` rules must come **before** every other rule (including CSS
  `@import` and selectors). Group them at the very top of the file.
- A bare `@use "<file>";` still emits the loaded file's CSS; only its Sass
  *members* become namespaced. Add `as <ns>` only when you need its members.

### 4.2 Top-level `@import` → `@use`

```scss
@import "~pkg/themes/_buttons.scss";   // before
@use "pkg/themes/_buttons.scss";       // after — drop the legacy `~` prefix
```

Plain CSS `@import` (URL ending in `.css`) is **not** deprecated — leave those
as-is.

### 4.3 Nested `@import` must STAY `@import`

A `@use` rule **cannot be nested** inside a selector. The naive fix (hoist the
import to the top level) **breaks CSS-Modules files** (`*.module.scss`):
hoisting `@use ".../Loader/styles.scss"` lifts `[data-fs-loader]` to the top
level and css-loader rejects it — `Selector "[data-fs-loader]" is not pure`.
`@use`-ing several `.../styles.scss` files also collides on the default
namespace `styles` (`There's already a module with namespace "styles"`).

So the rule is:

- **Top-level `@import` → `@use`.**
- **Nested `@import` (inside a selector) → leave as `@import`.** Dart Sass still
  supports it (deprecation warning only), and keeping it nested preserves the
  local-class scoping that makes the inner selectors "pure". A 100% `@import`
  purge is not achievable for CSS-Modules files — and that is fine.

### 4.4 Custom breakpoints → standard FastStore breakpoints

v3 stores override include-media breakpoints by re-declaring a global
`$breakpoints` map (typically in a `custom-mixins.scss`). That global-shadowing
trick is **dead** under the module system: include-media is configured **once**
by `@faststore/ui/.../utilities.scss` (`@use "~include-media" with (...)`) and
cannot be reconfigured.

Fix: drop the non-standard breakpoints from the theme and remap each `media()`
call to the nearest standard FastStore breakpoint
(`phone, phonemid, tablet, notebook, desktop`). Example remaps:
`phonelg → tablet`, `notebooksm → notebook`. Do **not** edit `@faststore/ui`'s
breakpoint map — it is shared, and the store's CMS schema only knows the
standard breakpoints. A leftover `custom-mixins.scss` becomes a thin
`@forward "@faststore/ui/src/styles/base/utilities";`.

### 4.5 "Module already loaded" — dead / duplicate imports

```
This module was already loaded, so it can't be configured using "with".
```

`utilities.scss` does `@use "~include-media" with (...)`; loading it as two
different module instances configures include-media twice. The usual cause is
a dead theme partial (e.g. an `_base.scss` that only `@use`s utilities and
re-declares `$breakpoints` — a no-op in v4) imported through a *different*
specifier than the rest of the store. Fix: drop the dead `@use` — verify the
partial actually contributes CSS/members before keeping it.

### 4.6 Per-file checklist

1. Move/add `@use "@faststore/ui/src/styles/base/utilities" as u;` to the top.
2. `@include media(...)` → `@include u.media(...)`;
   `@include layout-content` → `@include u.layout-content`;
   the FastStore `rem(...)` function → `u.rem(...)`.
3. Top-level `@import` → `@use` (drop `~`); nested `@import` stays (§4.3).
4. Remap non-standard breakpoints (§4.4); drop dead imports (§4.5).
5. Rebuild and check the Sass output.

---

## 5. GraphQL import migration

`@faststore/graphql-utils` is **deprecated** in v4. The `gql` tag used for
GraphQL documents must be imported from `@faststore/core/api` instead.

Search for all usages in `src/`:

```bash
grep -r "faststore/graphql-utils" src/
```

Replace every occurrence:

```ts
// before
import { gql } from '@faststore/graphql-utils'

// after
import { gql } from '@faststore/core/api'
```

If the grep returns no matches, skip this step.

---

## 6. v3 patches

`patch-package` patches are version-tagged (`@faststore+core+<v3>.patch`) and
will not apply to v4. Inspect each:

- **Debug / instrumentation-only patches** (verbose logging gated on an env
  flag, pass-through when off) — move out of `patches/` to a sibling folder
  such as `../.patches-disabled-v3/`; nothing to reapply.
- **Functional patches** — re-evaluate whether v4 still needs the fix; if so,
  recreate it against the v4 package.

`patch-package` scans `patches/` recursively, so a `patches/.disabled/`
subfolder is still picked up — move stale patches **outside** `patches/`.

---

## 6. Tooling gotchas

- **corepack signature error** for `pnpm` / `yarn`: prefix commands with
  `COREPACK_INTEGRITY_KEYS=0` (an outdated corepack can't verify newer
  signatures).
- **turbo + nested git worktree**: turbo walks up past a worktree (whose `.git`
  is a *file*) and mis-detects the repo root, so a root `turbo build` reports
  `0 tasks`. Build the store package directly:
  `cd packages/discovery && yarn build`. Normal checkouts are unaffected.

---

## 7. `@vtex/diagnostics-nodejs` optional peers

`@vtex/diagnostics-nodejs` imports instrumentation for server frameworks
FastStore does not use (`@opentelemetry/instrumentation-koa`,
`@opentelemetry/instrumentation-nestjs-core`, `@nestjs/core`, `fastify-plugin`).
They are optional peers and are not installed.

- In `next build` they are harmless warnings — the server bundle externalises
  `node_modules`, so the build succeeds.
- In `next dev` they can become fatal `Module not found` errors and 500 the
  page.

If `next dev` 500s on this, stub the missing modules to `false` in webpack.
The store's `discovery.config.js` `webpack()` callback is **not** invoked by
v4 core, so the alias must live in `@faststore/core`'s own
`packages/core/next.config.js` `webpack()` callback (only relevant when running
a linked local `faststore` clone — see §9):

```js
config.resolve.alias = {
  ...config.resolve.alias,
  '@opentelemetry/instrumentation-koa': false,
  '@opentelemetry/instrumentation-nestjs-core': false,
  '@opentelemetry/instrumentation-fastify': false,
  '@opentelemetry/instrumentation-express': false,
  '@nestjs/core': false,
  'fastify-plugin': false,
}
```

> Do **not** make `core/next.config.js` forward `storeConfig.webpack` — that
> applies the store callback to the `instrumentation` compilation and breaks
> the instrumentation hook. Put shared webpack fixes directly in core's
> callback.

---

## 8. Verification

1. `cd packages/discovery && COREPACK_INTEGRITY_KEYS=0 yarn build` — expect
   `generate` + GraphQL codegen + `next build` to succeed, routes printed,
   `.next` copied. No `@import` *errors* (deprecation *warnings* from nested
   imports are expected), no "module already loaded", no "not pure" selectors.
2. `COREPACK_INTEGRITY_KEYS=0 yarn dev` — homepage `200`,
   `POST /api/graphql` → `{"data":{"__typename":"Query"}}` `200`, private
   routes redirect (`30x`) to login.
3. Spot-check responsive styling (the remapped breakpoints) and any
   placeholder-`@extend` buttons.

---

## 9. Optional: local multi-repo testing (never committed)

Needed only while validating the store against **unpublished** `faststore` or
plugin source (e.g. the v4 branches before they are released). Skip entirely
once published v4 versions exist — which is the normal, committed state.

The technique: after a normal `yarn install`, overlay symlinks so the store and
the plugin resolve `@faststore/*` to a local `faststore` monorepo checkout:

- Symlink every `@faststore/*` package (`api cli core components diagnostics
  graphql-utils lighthouse sdk ui`) into the store's `node_modules` **and** the
  plugin's `node_modules` (otherwise the plugin pulls its own `@faststore/ui`
  and you hit the §4.5 duplicate-`utilities.scss` error).
- Repoint the CLI bin: `node_modules/.bin/faststore → ../@faststore/cli/bin/run.js`
  (the v4 path is `bin/run.js`, was `bin/run` in v3).
- Dedupe singletons (`graphql`, `react`, `react-dom`) to the single copy the
  faststore packages share, or `yarn dev` fails with
  `Duplicate "graphql" modules` / React "invalid hook call".
- Use the `link:` protocol for the plugin (`link:` survives `yarn install`;
  `yarn link` does not).

Build the `faststore` monorepo first (`pnpm install && pnpm build`). Drive the
symlink overlay from an idempotent, **`postinstall`-safe** script (exits `0`
when sibling checkouts are absent, so deploy/CI is unaffected).

**Before committing**, revert to the deployable state: pin published versions
in `package.json`, remove any `link:` entries / `postinstall` hook / link
script, and `rm -rf node_modules && yarn install` so no symlinks remain.

---

## Appendix — migration checklist

- [ ] Node 24 (`volta.node` must be a full semver e.g. "24.0.2", `experimental.nodeVersion: 24`).
- [ ] `package.json` (root + discovery): `@faststore/cli` + plugin pinned to
      published v4 releases; v3 transitive deps removed; `next` **removed**
      from dependencies (managed by cli); `graphql ^16.11.0` and
      `react-router-dom ^6.24.1` added; `typescript ^5.9.3` in devDependencies.
- [ ] `discovery.config.js`: no `path`/`dotenv` requires; no `webpack()`
      callback; `nodeVersion: 24`; `transpilePackages` if needed.
- [ ] Every `.scss`: top-level `@import` → `@use`; nested `@import` kept;
      `@include media`/`layout-content` namespaced to `u.*`; non-standard
      breakpoints remapped to standard ones; dead theme imports dropped.
- [ ] `custom-mixins.scss` (if present) → thin `@forward` of utilities.
- [ ] v3 `patch-package` patches assessed and stale ones moved out of
      `patches/`.
- [ ] `yarn build` and `yarn dev` verified (§8).
- [ ] Local-linking machinery (§9) reverted before committing.
- [ ] CMS type detected via `contentSource` in `discovery.config.js` (§11.1).
- [ ] CMS sync instructions shown to user (§10 next steps): case detected from `discovery.config.js` + `cms/faststore/`; commands presented for manual execution (never run automatically).
- [ ] New CMS fields configured in Admin → Storefront → Headless CMS / Content and pages republished (§11.4 — human step).
- [ ] Tested locally with `yarn dev` — no empty labels/buttons/toasts.
- [ ] Only then: v4 deployed to production + Node.js v24 set in WebOps.

---

## 10. Post-migration summary (mandatory output)

> **MANDATORY prerequisite — do NOT display this summary until `yarn build`
> passes.**
>
> Before showing the summary, run (using Node 24):
> ```bash
> yarn install
> yarn build
> ```
> Fix any build errors first. Only after a successful build should you
> proceed to display the summary below.

After the build passes, display the following two sections.

---

### What was done

A table covering every file touched and the change applied. Adapt rows to
what actually changed; mark items that were not applicable as `—`.

| File | Change | Status |
|------|--------|--------|
| `package.json` | `@faststore/cli` bumped to v4; `next` removed; `graphql`, `react-router-dom` added; `typescript` bumped to `^5.9.3`; `volta.node` set to `24` | ✅ Done |
| `discovery.config.js` | `experimental.nodeVersion` → `24` | ✅ Done |
| `src/**/*.scss` | Top-level `@import` → `@use`; `@include media/layout-content` namespaced to `u.*` | ✅ Done |
| `patches/` | Stale v3 patches assessed / moved | ✅ Done / N/A |

---

### Important next steps

#### 1. CMS sync (run manually in your terminal)

> **Do NOT run `vtex content` commands automatically.** These require
> interactive authentication and may have CLI plugin issues in Homebrew
> environments.

Check `discovery.config.js` and `cms/faststore/` to identify the case,
then present the matching instructions to the user.

**Headless CMS (legacy)** — `contentSource` field absent in `discovery.config.js`:

```bash
vtex login <accountName>
yarn cms-sync
```

> If `cms-sync` errors with `Cannot find module 'vtex'`, run
> `vtex plugins install @vtex/cli-plugin-cms` or `vtex update`.

**Content Platform (CP)** — `contentSource: { type: 'CP' }` present.
Identify the sub-case by inspecting `cms/faststore/`:

| Case | Signal | Commands to run |
|------|--------|-----------------|
| **A** — no custom schemas | No `.jsonc` files, no `components/` folder | Create `cms/faststore/schema.json` with `{ "$base": "vtex.faststore" }`, then `vtex content upload-schema cms/faststore/schema.json` |
| **B** — already split | `cms/faststore/components/*.jsonc` exists | `vtex content generate-schema cms/faststore/components cms/faststore/pages -o cms/faststore/schema.json` then `vtex content upload-schema cms/faststore/schema.json` |
| **C** — legacy format | Only `sections.json` / `content-types.json` | Split first (see §11), then generate + upload |

For the full command listing of each case see §11.

---

#### 2. Fill in new CMS fields and republish

After the CMS sync, v4 exposes new configurable fields that were previously
hardcoded. Configure them in **Admin → Storefront → Headless CMS / Content**
and republish the affected pages:

| Page | Fields to configure |
|------|---------------------|
| **All pages** | `Navbar` → `invalidQuantityToast`, `collapseSearchAriaLabel` |
| **Home** (product shelf) | `ProductCard` / `ProductCardContent` → `buttonLabel`, `outOfStockLabel`, `includeTaxesLabel`, `sponsoredLabel` |
| **PLP** | `Breadcrumb → Fallback label`, `ProductGallery → sortBySelector`, `Filter → FilterSlider / FilterDesktop labels`, `ProductCard / ProductCardContent` |
| **Search** | `SearchInput`, `SearchTop`, `SearchHistory`, `EmptyGallery → labels`, `ProductCard / ProductCardContent` |
| **PDP** | `Breadcrumb → Fallback label`, `ProductDetails → invalidQuantityToast / buyButtonTitle` |
| **Cart** | `EmptyCart → title / buttonLabel` |

Full field reference: [developers.vtex.com → Upgrading FastStore to v4](https://developers.vtex.com/docs/guides/faststore/getting-started-upgrading-faststore-to-v4)

> Do not deploy v4 to production before filling these fields — they render
> blank until configured.

---

#### 3. Update Node.js v24 in WebOps

In VTEX Admin → **Storefront → FastStore WebOps → Settings → Node.js
version** → set to `v24` → Save → trigger a new deploy.

---

#### 4. Check Sass `@import` deprecation warnings

`@import` inside selector blocks emits Dart Sass deprecation warnings.

---

## 11. CMS sync — command reference

This section is a command reference. The agent must **not** run these
commands automatically — always present them to the user to run manually.

### 11.1 Headless CMS (legacy)

```bash
vtex login <accountName>
yarn cms-sync
```

`cms-sync` is safe while v3 is live — it only pushes the schema.

### 11.2 Content Platform — Case A (no custom schemas)

```bash
# 1. Create the minimal schema (if not already present)
# cms/faststore/schema.json content:
# { "$base": "vtex.faststore" }
# (use "vtex.faststore@4.1.0" to pin an explicit version)

vtex login <accountName>
vtex content upload-schema cms/faststore/schema.json
# The local schema.json can be deleted after upload
```

### 11.3 Content Platform — Case B (components already in .jsonc format)

```bash
vtex login <accountName>
vtex content generate-schema cms/faststore/components cms/faststore/pages \
                             -o cms/faststore/schema.json
vtex content upload-schema cms/faststore/schema.json
```

### 11.4 Content Platform — Case C (legacy sections.json)

```bash
vtex login <accountName>

vtex content split-components -i cms/faststore/sections.json \
                              -o cms/faststore/components
vtex content split-content-types -i cms/faststore/content-types.json \
                                 -s cms/faststore/sections.json \
                                 -o cms/faststore/pages

vtex content generate-schema cms/faststore/components cms/faststore/pages \
                             -o cms/faststore/schema.json
vtex content upload-schema cms/faststore/schema.json
```