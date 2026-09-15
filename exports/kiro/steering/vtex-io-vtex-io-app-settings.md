<!-- globs: manifest.json, store/contentSchemas.json, node/**/*.ts -->

Apply when defining, validating, or consuming VTEX IO app settings. Covers settingsSchema, app-level configuration boundaries, and how backend or frontend code should depend on settings safely. Use for merchant-configurable behavior, settings forms, or reviewing whether settings belong in app configuration rather than hardcoded logic or custom data entities.

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
- Saved settings are scoped to the app's **major** version range, not to the full version. They persist across minor and patch releases, and they do **not** carry over to a new major.
- Because settings are keyed by major, choose defaults that are safe when the stored value is absent. After a major bump every merchant reads schema defaults until settings are re-applied, and a feature flag defaulting to `false` silently turns the feature off with no error.
- For values that must survive a major bump, such as operational kill switches, do not rely on `settingsSchema` alone. Persist them under a version-independent key (for example VBase keyed by the app name with the `@version` suffix stripped) and accept that you then own the admin surface for editing them.
- Plan a settings re-apply step into any major-version upgrade runbook, and verify the settings of the new major before considering the rollout complete.

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

### Constraint: Settings must not be assumed to survive a major version bump

Saved app settings are scoped to the app's major version range. Configuration that must outlive a major bump MUST either be re-applied as part of the upgrade or stored under a version-independent key.

**Why this matters**

Settings are addressed by major range, so `vtex.my-app@3.x` and `vtex.my-app@4.x` are separate configuration scopes. Releasing `3.6.1` after `3.6.0` keeps every saved value, but releasing `4.0.0` starts from an empty settings object.

This fails quietly. Nothing errors: the app simply reads schema defaults, so a flag that gated a behavior reverts to its default and the feature silently turns off for every merchant. Reading with the full version at runtime hides the distinction, because `getAppSettings(process.env.VTEX_APP_ID)` resolves `vtex.my-app@3.6.1` to the `3.x` scope for you.

**Detection**

If a major version bump is planned and any behavior depends on a saved setting, STOP and decide explicitly whether each value is re-applied after the upgrade or moved to version-independent storage. If a setting acts as a kill switch or protects against an incident, treat `settingsSchema` alone as insufficient.

**Correct**

```typescript
// Fail-safe default: losing the stored value degrades to the previous
// behavior rather than changing it.
const settings = await ctx.clients.apps.getAppSettings(
  ctx.vtex.appId ?? process.env.VTEX_APP_ID
)
const useNewPricing = settings.useNewPricing ?? false

// For a switch that must survive a major bump, key it without the version
// so the same key is read before and after the upgrade.
const [appName] = String(process.env.VTEX_APP_ID).split('@')
const killSwitch = await ctx.clients.vbase.getJSON('app_runtime_flags', appName, true)
```

**Wrong**

```typescript
// Assumes the merchant's saved value is still there after 4.0.0, and
// silently disables the integration when it is not.
const settings = await ctx.clients.apps.getAppSettings(
  ctx.vtex.appId ?? process.env.VTEX_APP_ID
)

if (settings.integrationEnabled) {
  await runIntegration()
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
- Assuming saved settings carry over to a new major version, so a feature silently reverts to its default after the upgrade.
- Choosing a default that changes behavior when the stored value is missing, instead of a fail-safe one.
- Keeping an operational kill switch only in `settingsSchema`, where a major bump resets it.

## Review checklist

- [ ] Does this data really belong in app settings?
- [ ] Does the `settingsSchema` declare explicit `properties` with clear types and `required` only where necessary?
- [ ] Are sensitive fields represented safely, for example as `string` fields with `format: "password"`, knowing that some consumers such as Apps GraphQL with `hidePasswords` may use that metadata to mask the output?
- [ ] Does the consuming code validate or default missing values?
- [ ] Are secrets kept backend-only and never exposed to the frontend?
- [ ] If `access: "public"` is used, are all exposed settings intentionally safe for frontend consumption?
- [ ] Is the settings surface small and intentional?
- [ ] Is each default fail-safe, so that losing the stored value degrades rather than changes behavior?
- [ ] If a major version bump is planned, is there a step to re-apply settings, and do any kill switches live in version-independent storage instead?

## Reference

- [Manifest](https://developers.vtex.com/docs/guides/vtex-io-documentation-manifest) - App configuration contract
- [Creating an interface for your app settings](https://developers.vtex.com/docs/guides/vtex-io-documentation-creating-an-interface-for-your-app-settings) - `settingsSchema`, `access`, frontend queries, and backend settings consumption
- [Configuring your app settings](https://developers.vtex.com/docs/guides/vtex-io-documentation-4-configuringyourappsettings) - Pixel app example for consuming app settings in VTEX IO
