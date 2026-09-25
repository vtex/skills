This skill provides guidance for AI agents working with VTEX Custom VTEX IO Apps. Apply these constraints and patterns when assisting developers with apply when building VTEX IO admin-facing React interfaces under the admin builder. Covers VTEX Styleguide and Shoreline usage, admin page composition, data-heavy admin interactions, and keeping administrative interfaces consistent with the VTEX Admin environment. Use for settings pages, moderation tools, dashboards, or operational UIs inside VTEX Admin.

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
