<!-- globs: store/blocks.json, store/routes.json, store/templates/**/*.json, store/contentSchemas.json, store/blocks/**/*.json -->

Apply when designing or modifying a VTEX IO storefront theme app — the app that owns `store/blocks.json`, `store/routes.json`, `store/templates/`, `store/contentSchemas.json`, and the storefront page tree assembled from `store.home`, `store.product`, `store.search`, `store.custom`, and other native page templates. Covers how a theme app extends a base theme, declares routes, composes blocks across pages, and how its `store/` files relate to merchant Site Editor content. Use for theme scaffolding, custom page routes, theme-level overrides, or reviewing whether a change belongs in the theme app, in a component app, or in app settings.

# Storefront Theme App

## When this skill applies

Use this skill when working on the app that assembles the storefront — the theme app that owns the page tree, custom routes, and Site Editor surface area for a store.

- Scaffolding `vendor.store-theme` or any app with the `store` builder that ships pages
- Adding or changing `store/blocks.json` or per-template files under `store/blocks/`
- Adding or modifying a custom route in `store/routes.json`
- Composing the block tree for `store.home`, `store.product`, `store.search`, `store.custom`, or any native page template
- Extending or overriding a base theme such as `vtex.store-theme`
- Reviewing whether a change belongs in the theme app, in a component app, or in app settings

Do not use this skill for:

- registering a new block in a component app (`store/interfaces.json`) — use `vtex-io-render-runtime-and-blocks`
- implementing the React component behind a block — use `vtex-io-storefront-react`
- changing the theme app's installed version on `master` — use `vtex-io-storefront-theme-versioning`
- localized strings — use `vtex-io-messages-and-i18n`

## Decision rules

- A theme app is a regular VTEX IO app with the `store` builder declared in `manifest.json`. It almost never ships React code; it composes blocks declared by component apps and by base themes.
- The theme app declares its base theme in `manifest.json#dependencies`, typically `vtex.store-theme`, and inherits every page template, block declaration, and default content the base ships.
- `store/blocks.json` (or per-template files under `store/blocks/`) defines the **block tree per page template** by referencing block IDs. Block IDs come from the component apps' `store/interfaces.json` and are scoped by the declaring app's MAJOR version.
- `store/routes.json` defines **custom storefront routes** and binds them to a page context (`store.custom`, `store.product`, `store.search`, etc.). Native routes (`/`, `/{slug}/p`, search) come from the base theme and rarely need to be redeclared.
- `store/contentSchemas.json` declares **Site Editor-editable props** for blocks. Merchant edits to those props are stored by `vtex.pages-graphql` under a key that includes the theme app's MAJOR version.
- Three change locations exist for storefront behavior. Pick consciously:
  1. Theme app `store/` JSON — composition, routes, default content, allowed children. Affects all shoppers immediately on promote.
  2. Component app code — the React behavior of a block. Released on the component app's own version cadence.
  3. Site Editor — merchant-managed content overrides on top of the theme's defaults. Stored by `vtex.pages-graphql` and scoped by the declaring app's installed major.
- Prefer extending a base theme over forking it. Forking a base theme moves the responsibility for every block, route, and template to your app forever, including upstream bug fixes.
- A storefront page is a tree of blocks. The leaves are component blocks; the branches are container blocks (`flex-layout.row`, `flex-layout.col`, etc.). Keep the tree as shallow as the design allows; deep trees inflate render and content footprint.
- The theme app is a **content-holding app** in the sense of `vtex-io-storefront-theme-versioning`. Its installed major version is part of the key the platform uses for every Site Editor change a merchant has ever saved against blocks declared by this app. Treat its version contract as merchant-facing, not developer-facing.

## Hard constraints

### Constraint: Theme apps must declare the `store` builder and a base theme

A storefront theme app MUST declare `"store"` in `manifest.json#builders` and MUST depend on a base theme (typically `vtex.store-theme`) unless it explicitly takes ownership of every native page template, block, and route.

**Why this matters**

Without the `store` builder, none of the files under `store/` are processed and the theme contributes nothing to the storefront. Without a base theme, the app is responsible for declaring every native page template (`store.home`, `store.product`, `store.search`, etc.) from scratch — including upstream maintenance forever.

**Detection**

If a theme app ships `store/blocks.json` or `store/routes.json` but its manifest does not declare `"store"` in `builders`, STOP and add the builder. If the manifest also omits `vtex.store-theme` (or another base theme) from `dependencies` or `peerDependencies` without an explicit reason, STOP and confirm the app intends to own every native template.

**Correct**

```json
{
  "vendor": "acme",
  "name": "store-theme",
  "version": "1.0.0",
  "title": "ACME Store Theme",
  "builders": {
    "store": "0.x",
    "messages": "1.x"
  },
  "dependencies": {
    "vtex.store-theme": "2.x",
    "acme.product-widgets": "0.x"
  }
}
```

**Wrong**

```json
{
  "vendor": "acme",
  "name": "store-theme",
  "version": "1.0.0",
  "builders": {
    "messages": "1.x"
  },
  "dependencies": {}
}
```

The `store/` files exist on disk but the platform ignores them, and the theme inherits nothing.

### Constraint: Block IDs in `store/blocks.json` must resolve to a registered block in an installed app

Every block ID referenced in `store/blocks.json` (or per-template files) MUST be declared in an `interfaces.json` of an installed app whose MAJOR version matches what the platform resolves at render time. Unresolved block IDs cause `Missing block` errors at the GraphQL layer and break the page.

**Why this matters**

`vtex.pages-graphql` resolves a block ID by looking up `vendor.app@MAJOR.x:block-id` against the installed apps. If the declaring app is not installed, or is installed at a different major than the merchant content was authored against, the block does not exist from the resolver's point of view and the page fails to render.

**Detection**

If `store/blocks.json` references a block ID, verify that some app in `manifest.json#dependencies` declares it in `store/interfaces.json` at the major version range listed in the dependency. If the dependency is `acme.product-widgets@0.x`, the block must exist in the `0.x` line of that app, not the `5.x` line.

**Correct**

```json
// manifest.json
{
  "dependencies": {
    "vtex.store-theme": "2.x",
    "acme.product-widgets": "0.x"
  }
}
```

```json
// store/blocks.json
{
  "store.product": {
    "children": [
      "flex-layout.row#product-main",
      "acme-related-products"
    ]
  },
  "acme-related-products": {
    "props": { "limit": 8 }
  }
}
```

```json
// acme.product-widgets@0.x ships store/interfaces.json with:
{
  "acme-related-products": {
    "component": "RelatedProducts"
  }
}
```

**Wrong**

```json
// manifest.json depends on acme.product-widgets@0.x
// but store/blocks.json references a block that only exists in @5.x
{
  "store.product": {
    "children": ["acme-new-related-products"]
  }
}
```

The render-time resolver returns `Missing block acme.product-widgets@0.x:acme-new-related-products` and the page fails.

### Constraint: Custom routes in `store/routes.json` must bind to a real page context and template

Every entry in `store/routes.json` MUST set a valid `path`, a `context` (or rely on the built-in context for native page IDs such as `store.product`), and a template that exists in the block tree (the page ID itself, or a `store.custom#<id>` declared in `store/blocks.json`).

**Why this matters**

A route entry without a resolvable template renders nothing. A route entry with the wrong context (e.g., a custom institutional page typed as `store.product`) executes the wrong data resolver and crashes or returns empty product data.

**Detection**

For each route in `store/routes.json`, confirm: (a) the `path` does not collide with native VTEX paths, (b) the bound page ID exists as a key in `store/blocks.json`, and (c) the `context` matches the data the page actually needs.

**Correct**

```json
// store/routes.json
{
  "store.custom#about": {
    "path": "/institucional/sobre",
    "context": "vtex.store-resources/InstitutionalPageContext"
  }
}
```

```json
// store/blocks.json
{
  "store.custom#about": {
    "blocks": ["rich-text#about-body"]
  }
}
```

**Wrong**

```json
// store/routes.json
{
  "store.custom#about": {
    "path": "/p/sobre"
  }
}
```

Path `/p/sobre` collides with the native PDP route shape, no `context` is declared, and there is no matching `store.custom#about` template in `store/blocks.json`.

## Preferred pattern

Recommended theme app structure:

```text
acme.store-theme/
├── manifest.json                     # store builder, base theme dependency
├── messages/                         # localized strings (separate skill)
└── store/
    ├── blocks.json                   # global block declarations
    ├── routes.json                   # custom routes
    ├── contentSchemas.json           # Site Editor-editable props
    └── blocks/                       # per-template block trees
        ├── home.jsonc
        ├── product.jsonc
        ├── search.jsonc
        ├── category.jsonc
        └── custom/
            ├── about.jsonc
            └── stores.jsonc
```

Recommended `store.home` composition:

```json
{
  "store.home": {
    "blocks": [
      "flex-layout.row#home-hero",
      "shelf#home-best-sellers",
      "rich-text#home-newsletter"
    ]
  },
  "flex-layout.row#home-hero": {
    "children": ["image#hero-banner"]
  },
  "image#hero-banner": {
    "props": {
      "src": "/arquivos/home-hero.png",
      "alt": "Promotional banner"
    }
  }
}
```

Recommended custom institutional route:

```json
// store/routes.json
{
  "store.custom#about": {
    "path": "/institucional/sobre",
    "context": "vtex.store-resources/InstitutionalPageContext"
  }
}
```

```json
// store/blocks/custom/about.jsonc
{
  "store.custom#about": {
    "blocks": ["flex-layout.row#about-body"]
  },
  "flex-layout.row#about-body": {
    "children": ["rich-text#about-copy"]
  },
  "rich-text#about-copy": {
    "props": {
      "text": "About ACME — see Site Editor for the live copy."
    }
  }
}
```

Recommended Site Editor-editable surface:

```json
// store/contentSchemas.json
{
  "rich-text#about-copy": {
    "type": "object",
    "properties": {
      "text": {
        "type": "string",
        "title": "Body copy",
        "widget": { "ui:widget": "textarea" }
      }
    }
  }
}
```

Merchant edits to `text` are persisted by `vtex.pages-graphql` under a key that includes the theme app's MAJOR version. See `vtex-io-storefront-theme-versioning` for what happens to that content on a major bump and how to migrate it with the `updateThemeIds` mutation.

## Common failure modes

- Forking `vtex.store-theme` instead of depending on it, then losing every upstream block fix and route addition forever.
- Referencing a block ID in `store/blocks.json` that exists in a different major of the declaring app than the dependency range allows.
- Declaring the same block ID in two different apps and getting non-deterministic resolution at render time.
- Putting Site Editor-editable copy directly in `store/blocks.json` `props` without `contentSchemas.json`, so merchants cannot change it.
- Adding a custom route to `store/routes.json` without adding the matching `store.custom#<id>` template in `store/blocks.json`.
- Treating the theme app's version as developer-facing and bumping the major to "tidy up", which leaves the new major with no merchant content and forces an `updateThemeIds` migration in `vtex.pages-graphql@2.x` before promote (see `vtex-io-storefront-theme-versioning`).
- Putting React component code in the theme app instead of in a dedicated component app, which mixes block declaration with block consumption and complicates reuse.
- Storing operational or shopper-specific data in theme `store/` files. The theme is global; per-shopper or per-segment data belongs elsewhere.

## Review checklist

- [ ] Does `manifest.json` declare the `store` builder?
- [ ] Does the theme depend on a base theme, or is full ownership of native templates explicit and intentional?
- [ ] Does every block ID in `store/blocks.json` resolve to a real `interfaces.json` entry in an installed app at a matching major?
- [ ] Does every entry in `store/routes.json` have a valid `path`, `context`, and matching template in `store/blocks.json`?
- [ ] Are merchant-editable copy and image fields exposed through `contentSchemas.json` rather than hardcoded in `props`?
- [ ] Are React components kept out of the theme app and in dedicated component apps?
- [ ] Has the team considered whether a planned change would force a major version bump on this content-holding app?

## Related skills

- [`vtex-io-storefront-theme-versioning`](vtex-io-vtex-io-storefront-theme-versioning.md) — Use when the question is how to safely change which version of this theme app is installed on `master`.
- [`vtex-io-render-runtime-and-blocks`](vtex-io-vtex-io-render-runtime-and-blocks.md) — Use when the question is how a block ID becomes a React component, or how a component app should declare blocks for themes to consume.
- [`vtex-io-storefront-react`](vtex-io-vtex-io-storefront-react.md) — Use when the question is the React implementation of a block, not its composition into pages.
- [`vtex-io-app-contract`](vtex-io-vtex-io-app-contract.md) — Use when the question is what the theme app's manifest contract should declare and how it interacts with base themes and component apps.

## Reference

- [Store Framework](https://developers.vtex.com/docs/guides/vtex-io-documentation-store-framework) — How theme apps assemble pages from blocks and templates.
- [Using Components](https://developers.vtex.com/docs/guides/store-framework-using-components) — How to reference blocks from base themes and component apps.
- [Themes](https://developers.vtex.com/docs/guides/vtex-io-documentation-themes) — Theme app structure and the relationship to `vtex.store-theme`.
- [Routes](https://developers.vtex.com/docs/guides/vtex-io-documentation-routes) — Declaring custom storefront routes and binding them to page contexts.
- [Making a Custom Component Available in Site Editor](https://developers.vtex.com/docs/guides/vtex-io-documentation-making-a-custom-component-available-in-site-editor) — `contentSchemas.json` and the Site Editor surface.
