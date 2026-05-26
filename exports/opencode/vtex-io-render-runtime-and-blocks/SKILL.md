---
name: vtex-io-render-runtime-and-blocks
description: "Apply when connecting React components to Store Framework blocks and render-runtime behavior in VTEX IO. Covers interfaces.json, block registration, block composition, and how storefront components become configurable theme blocks. Use for block mapping, theme integration, or reviewing whether a React component is correctly exposed to Store Framework."
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
- Block IDs are scoped by the **declaring app's MAJOR version**. `vtex.pages-graphql` resolves a block reference such as `acme-related-products` against `acme.product-widgets@MAJOR.x:acme-related-products` for the major actually installed in the workspace. A block declared in `0.x` is not the same block as one declared in `5.x`, even if the ID is identical.
- A consumer theme that references a block ID through `store/blocks.json` only sees the block if the declaring app is installed at a major matching the dependency range. Mismatches surface as `Missing block vendor.app@MAJOR.x:block-id` errors at the resolver and break the page.
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

### Constraint: Block IDs must resolve under the installed major of the declaring app

Block IDs referenced from a theme app's `store/blocks.json` MUST resolve to an `interfaces.json` entry in an installed app whose MAJOR version matches the consumer's dependency range. The render-time resolver is keyed by `vendor.app@MAJOR.x:block-id`, not by the bare block ID.

**Why this matters**

`vtex.pages-graphql` uses the declaring app's major version as part of the block lookup. A block that exists in `acme.product-widgets@0.x` is not visible to a consumer that resolves `acme.product-widgets@5.x`, even if the block ID is identical. Mismatches return `Missing block` errors at the GraphQL layer and the page falls back to default content or fails outright.

**Detection**

If a consumer theme references a block ID and the declaring app's installed major does not match the consumer's dependency range, STOP and align the dependency range or move the block declaration to the correct major.

**Correct**

```json
// consumer theme manifest.json
{ "dependencies": { "acme.product-widgets": "0.x" } }
```

```json
// acme.product-widgets@0.x ships store/interfaces.json with:
{ "acme-related-products": { "component": "RelatedProducts" } }
```

```json
// consumer theme store/blocks.json
{ "store.product": { "children": ["acme-related-products"] } }
```

**Wrong**

```json
// consumer theme depends on acme.product-widgets@0.x
// but the block "acme-related-products" was added in @5.x and never backported
{ "store.product": { "children": ["acme-related-products"] } }
```

The resolver returns `Missing block acme.product-widgets@0.x:acme-related-products`.

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
- Adding a new block to a `5.x` line and assuming consumers depending on `0.x` will see it. Block visibility is scoped by the declaring app's installed major.
- Renaming a block ID without coordinating with consumer themes that already reference it; the rename is effectively a breaking change for stored content.

## Review checklist

- [ ] Is the block declared in `interfaces.json`?
- [ ] Does the component mapping resolve correctly?
- [ ] Are composition and allowed children intentional?
- [ ] Is runtime registration clearly separated from component internals?
- [ ] Is the declaring app installed at a major that matches every consumer's dependency range?

## Related skills

- [`vtex-io-storefront-theme-app`](../vtex-io-storefront-theme-app/SKILL.md) — Use when the question is how a consumer theme composes these blocks into pages and routes.
- [`vtex-io-storefront-theme-versioning`](../vtex-io-storefront-theme-versioning/SKILL.md) — Use when the question is how a major version change in a block-declaring app affects merchants who already reference those blocks in stored content.

## Reference

- [Store Framework](https://developers.vtex.com/docs/guides/vtex-io-documentation-store-framework) - Block and theme context
- [Interfaces](https://developers.vtex.com/docs/guides/vtex-io-documentation-interface) — How `interfaces.json` maps block IDs to React components and how block IDs are namespaced by app major.
