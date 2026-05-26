This skill provides guidance for AI agents working with VTEX Custom VTEX IO Apps. Apply these constraints and patterns when assisting developers with apply when building react components under react/ or configuring store blocks in store/ for vtex io apps. covers interfaces.json, contentschemas.json for site editor, vtex styleguide for admin apps, and css-handles for storefront styling. use for creating custom storefront components, admin panels, pixel apps, or any frontend development within the vtex io react builder ecosystem.

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
- Use `contentSchemas.json` in `/store` to make component props editable in Site Editor (JSON Schema format). Merchant edits are stored by `vtex.pages-graphql` under a key that includes the **declaring app's MAJOR version** (`vendor.app@MAJOR.x:template`). A major version bump on the declaring app makes those edits invisible to the resolver until they are migrated to the new major with the `updateThemeIds` mutation in `vtex.pages-graphql@2.x` — see `vtex-io-storefront-theme-versioning`.
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
- **Major version bump on a content-holding component app**: A `vtex release major` on an app that ships `store/contentSchemas.json` makes every Site Editor edit ever saved against blocks declared by that app invisible to the resolver until it is migrated to the new major with the `updateThemeIds` mutation in `vtex.pages-graphql@2.x`. Use a `patch` or `minor` whenever possible, and follow `vtex-io-storefront-theme-versioning` when a major is unavoidable.

## Review checklist

- [ ] Does every storefront block have a matching entry in `store/interfaces.json`?
- [ ] Does every `interfaces.json` component have a root-level export file in `/react`?
- [ ] Are admin apps using `vtex.styleguide` (no third-party UI libraries)?
- [ ] Are storefront components using `css-handles` for styling?
- [ ] Is data fetched via GraphQL (`useQuery`), not direct API calls?
- [ ] Are user-facing strings using `react-intl` and the `messages` builder?
- [ ] Is `contentSchemas.json` defined for Site Editor-editable props?
- [ ] If the app ships `store/contentSchemas.json`, has the merchant-facing impact of any planned major version bump been reviewed?

## Related skills

- [`vtex-io-storefront-theme-versioning`](../vtex-io-storefront-theme-versioning/skill.md) — Use when the app ships `store/contentSchemas.json` and a version change must preserve or migrate Site Editor content.
- [`vtex-io-storefront-theme-app`](../vtex-io-storefront-theme-app/skill.md) — Use when the question is how a consumer theme composes these blocks into pages.

## Reference

- [Developing Custom Storefront Components](https://developers.vtex.com/docs/guides/vtex-io-documentation-developing-custom-storefront-components) — Guide for building Store Framework components
- [Interfaces](https://developers.vtex.com/docs/guides/vtex-io-documentation-interface) — How interfaces map blocks to React components
- [React Builder](https://developers.vtex.com/docs/guides/vtex-io-documentation-react-builder) — React builder configuration and directory structure
- [Making a Custom Component Available in Site Editor](https://developers.vtex.com/docs/guides/vtex-io-documentation-making-a-custom-component-available-in-site-editor) — contentSchemas.json and Site Editor integration
- [Store Framework](https://developers.vtex.com/docs/guides/store-framework) — Overview of the block-based storefront system
- [Using Components](https://developers.vtex.com/docs/guides/store-framework-using-components) — How to use native and custom components in themes
- [VTEX Styleguide](https://styleguide.vtex.com/) — Official component library for VTEX Admin UIs
