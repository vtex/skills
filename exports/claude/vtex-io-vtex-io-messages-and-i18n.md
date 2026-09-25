This skill provides guidance for AI agents working with VTEX Custom VTEX IO Apps. Apply these constraints and patterns when assisting developers with apply when implementing localization and translated copy in VTEX IO apps. Covers the `messages` builder, `/messages/*.json`, `context.json`, frontend message usage, and how VTEX apps integrate with `vtex.messages` for runtime translation. Use for storefront, admin, or backend flows that should use VTEX IO message infrastructure instead of hardcoded strings.

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
