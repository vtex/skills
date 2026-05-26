---
name: sales-app-code-templates
description: Code generation templates for Sales App extensions — simple, hook-based, API (no auth), IO Proxy (secure), Direct Auth (insecure), CSS stylesheet, and index.tsx with defineExtensions. Use when generating or scaffolding extension code.
metadata:
  version: "1.0"
---

# Code Templates and Patterns

## Template Selection

| Condition | Template |
|-----------|----------|
| No API + no hooks | Simple template |
| No API + hooks needed | Hook template |
| API + no authentication | API template |
| API + VTEX IO proxy app | IO Proxy template (recommended) |
| API + direct auth | Direct Auth template (insecure — warn user) |

## Simple Extension (no hooks, no API)

```typescript
import React from 'react';
import './${COMPONENT_NAME}.css';

/**
 * ${COMPONENT_NAME}
 * ${DESCRIPTION}
 *
 * Extension Point: ${EXTENSION_POINT}
 *
 * IMPORTANT: This component MUST always return a JSX.Element, never null.
 * The defineExtensions type (ExtensionPointComponent) does not accept null.
 * If you need to conditionally hide content, return an empty fragment: <></>
 */
export function ${COMPONENT_NAME}(): JSX.Element {
  return (
    <div className="container">
      <div className="content">
        ${CONTENT}
      </div>
    </div>
  );
}
```

## Extension with Hooks

```typescript
import React from 'react';
import { ${HOOKS_IMPORT} } from '@vtex/sales-app';
import './${COMPONENT_NAME}.css';

/**
 * ${COMPONENT_NAME}
 * ${DESCRIPTION}
 *
 * Extension Point: ${EXTENSION_POINT}
 * Hooks: ${HOOKS_LIST}
 */
export function ${COMPONENT_NAME}(): JSX.Element {
  ${HOOKS_USAGE}

  return (
    <div className="container">
      <div className="content">
        ${CONTENT}
      </div>
    </div>
  );
}
```

### Hook initialization patterns

```typescript
// useCart — access cart data and mutations
const cart = useCart();
// cart.items, cart.value, cart.totalizers, cart.clientProfileData, cart.giftCards
// cart.addItem(), cart.removeItem(), cart.addCoupon(), cart.addGiftCard(), cart.sync()

// useCartItem — access individual cart item (cart.cart-item.after ONLY)
const { item, itemIndex, changeItem, changePrice } = useCartItem();
// ALWAYS check: if (!item) return (<></>);

// useCurrentUser — access logged-in user (menu.drawer-content ONLY)
const { name, email } = useCurrentUser();

// useExtension — access account and extension point context (ALL extension points)
const { account, extensionPoint } = useExtension();

// usePDP — access product data (PDP extensions ONLY)
const { productSku } = usePDP();
// productSku.id, productSku.name, productSku.price, productSku.listPrice
```

## Extension with API (no auth)

```typescript
import React, { useState, useEffect } from 'react';
import { ${HOOKS_IMPORT} } from '@vtex/sales-app';
import './${COMPONENT_NAME}.css';

interface ${COMPONENT_NAME}Data {
  // Generated from API documentation — see docs/<ExtensionName>.md for source
  // Object fields → typed properties. Nested objects → separate interfaces. Optional fields → property?: Type
  ${DATA_INTERFACE}
}

export function ${COMPONENT_NAME}(): JSX.Element {
  ${HOOKS_USAGE}
  const [data, setData] = useState<${COMPONENT_NAME}Data | null>(null)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('${API_ENDPOINT}', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) throw new Error('Failed to fetch data');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [account]);

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <span className="spinner"></span>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error"><span>Error: {error}</span></div>
      </div>
    );
  }

  if (!data) return (<></>);

  return (
    <div className="container">
      <div className="content">
        ${CONTENT}
      </div>
    </div>
  );
}
```

## Extension with IO Proxy (recommended for authenticated APIs)

The IO app handles the external API keys securely on the server side. The extension uses `credentials: 'include'` to forward session cookies.

**Critical**: The API endpoint must be a **relative path** (e.g., `/_v/my-api/data`). **NEVER** use a full URL like `https://{account}.myvtex.com/...`. The Sales App internal proxy resolves the domain automatically.

```typescript
import React, { useState, useEffect } from 'react';
import { ${HOOKS_IMPORT} } from '@vtex/sales-app';
import './${COMPONENT_NAME}.css';

interface ${COMPONENT_NAME}Data {
  // Generated from API documentation — see docs/<ExtensionName>.md for source
  // Object fields → typed properties. Nested objects → separate interfaces. Optional fields → property?: Type
  ${DATA_INTERFACE}
}

export function ${COMPONENT_NAME}(): JSX.Element {
  ${HOOKS_USAGE}
  const [data, setData] = useState<${COMPONENT_NAME}Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('${API_ENDPOINT}', {
          method: '${API_METHOD}',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          ${FETCH_BODY}
        });

        if (!response.ok) throw new Error('Failed to fetch data');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [account]);

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <span className="spinner"></span>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error"><span>Error: {error}</span></div>
      </div>
    );
  }

  if (!data) return (<></>);

  return (
    <div className="container">
      <div className="content">
        ${CONTENT}
      </div>
    </div>
  );
}
```

## Extension with Direct Auth (insecure — testing only)

**⚠️ SECURITY WARNING**: This template passes authentication keys directly in request headers. The keys are visible to anyone inspecting the browser's network requests. Use a VTEX IO proxy app in production.

```typescript
import React, { useState, useEffect } from 'react';
import { ${HOOKS_IMPORT} } from '@vtex/sales-app';
import './${COMPONENT_NAME}.css';

/**
 * ⚠️ SECURITY WARNING: Authentication keys exposed in frontend code.
 * Move to a VTEX IO proxy app for production use.
 */

interface ${COMPONENT_NAME}Data {
  // Generated from API documentation — see docs/<ExtensionName>.md for source
  // Object fields → typed properties. Nested objects → separate interfaces. Optional fields → property?: Type
  ${DATA_INTERFACE}
}

export function ${COMPONENT_NAME}(): JSX.Element {
  ${HOOKS_USAGE}
  const [data, setData] = useState<${COMPONENT_NAME}Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('${API_ENDPOINT}', {
          method: '${API_METHOD}',
          headers: {
            'Content-Type': 'application/json',
            // ⚠️ INSECURE: Authentication key exposed in frontend code
            '${AUTH_HEADER_NAME}': '${AUTH_HEADER_VALUE}',
          },
          ${FETCH_BODY}
        });

        if (!response.ok) throw new Error('Failed to fetch data');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [account]);

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <span className="spinner"></span>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error"><span>Error: {error}</span></div>
      </div>
    );
  }

  if (!data) return (<></>);

  return (
    <div className="container">
      <div className="content">
        ${CONTENT}
      </div>
    </div>
  );
}
```

## CSS Stylesheet

All extensions use **plain CSS** (not CSS modules). The full Sales App design system for CSS — tokens, typography, spacing grid, responsive breakpoints, and structure — is inlined below. **Use this template as the single source of truth for any CSS generation.**

**CRITICAL — File naming:** The CSS file MUST be named `${COMPONENT_NAME}.css` — **never** `${COMPONENT_NAME}.module.css`. The Sales App bundler does not support CSS modules. Import as a side-effect: `import './${COMPONENT_NAME}.css';` — never as `import styles from './${COMPONENT_NAME}.module.css';`. Use `className="container"` string literals, not `className={styles.container}`.

### Design system rules baked into this template

These rules apply to **every** generated extension CSS. The template below already complies — keep it that way.

| Topic | Rule |
|-------|------|
| Tokens | All colors must reference `--sa-color-*` tokens declared on `.container`. **Never** use hardcoded hex values anywhere else. |
| Font family | `'VTEX Trust', -apple-system, BlinkMacSystemFont, sans-serif` on `.container`, inherited by descendants. |
| Font weights | Only Regular (400), Medium (500), Semibold (600), Bold (700). |
| Font sizes (px) | Allowed scale only: **10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48**. Never `13`, `15`, `17`, etc. |
| Typography roles | Section title = 16px/600 · Subtitle/label = 14px/500 · Body = 14px/400 · Caption = 12px/400 · Price = 18px/600. |
| Spacing | Multiples of **4px** only (4, 8, 12, 16, 20, 24, 32, 40…). Never `10`, `14`, `18`, `22`. Applies to `padding`, `margin`, `gap`, `height`. |
| Containment | No `position: fixed`, no `z-index: 9999`, no `:host`, no `:global`, no `@import`. `position: relative` and `sticky` are safe. |
| Selectors | Use the unprefixed utility class names from this template (`.container`, `.content`, `.row`, `.title`, `.button`, etc.). The Sales App `fsp-analyzer` runs with `transformNonCompliant: true`, so unprefixed selectors emit a `CSS_TRANSFORMED` warning rather than a `CSS_NAMESPACE_REQUIRED` violation. Never use `*`, `body`, `html`, `:root`, `head`, `main`, `#root`, `#__next` — those are caught by `CSS_GLOBAL_SELECTOR` and remain blocking. |
| Keyframes | Prefix with `${COMPONENT_NAME}-` (e.g., `${COMPONENT_NAME}-spin`). This raises a `CSS_TRANSFORMED` warning (build still passes) — use `sales-app-extension-${COMPONENT_NAME}-spin` if you want a clean run. |
| `!important` | Never. |
| Responsive | Use the breakpoint at `(max-width: 743px)` for mobile overrides. Sales App shell handles the rest. |

```css
/**
 * ${COMPONENT_NAME} Styles
 * Sales App design system (tokens + typography + spacing + responsive) is fully inlined.
 * UX writing: Use sentence case for all UI text. Never use ALL-CAPS.
 */

.container {
  /* === Sales App design tokens — single source of truth ===
     Always declare these on .container. Reference via var(--sa-color-*) in all other rules.
     Never use hardcoded hex values in CSS rules. */

  /* Primary action */
  --sa-color-primary:       #157BF4;   /* Light Blue 800 */
  --sa-color-primary-hover: #0366DD;   /* Light Blue 900 */

  /* Text */
  --sa-color-text-primary:   #1F1F1F;  /* Neutral 1200 — high emphasis */
  --sa-color-text-secondary: #5C5C5C;  /* Neutral 600  — medium emphasis */
  --sa-color-text-tertiary:  #3D3D3D;  /* Neutral 500  — low emphasis */
  --sa-color-text-muted:     #999999;  /* Neutral 700  — disabled / hint */

  /* Backgrounds */
  --sa-color-bg:        #FFFFFF;       /* Neutral White */
  --sa-color-bg-subtle: #F5F5F5;       /* Neutral 100 */
  --sa-color-bg-muted:  #EBEBEB;       /* Neutral 200 */

  /* Borders */
  --sa-color-border:       #E0E0E0;    /* Neutral 300 */
  --sa-color-border-input: #D6D6D6;    /* Neutral 400 */

  /* Error (Red scale) */
  --sa-color-error-bg:     #FDF6F5;    /* Red 50 */
  --sa-color-error-border: #FFDFD9;    /* Red 200 */
  --sa-color-error-text:   #EC3727;    /* Red 800 */

  /* Success (Green scale) */
  --sa-color-success-bg:   #EDFDF5;    /* Green 50 */
  --sa-color-success-text: #01905F;    /* Green 800 */

  /* Warning (Yellow / Orange scale) */
  --sa-color-warning-bg:   #FBF7D4;    /* Yellow 50 */
  --sa-color-warning-text: #E57001;    /* Orange 700 */

  /* Info (Light Blue scale) */
  --sa-color-info-bg:   #F1F8FD;       /* Light Blue 50 */
  --sa-color-info-text: #157BF4;       /* Light Blue 800 */

  padding: 16px;
  background-color: var(--sa-color-bg);
  font-family: 'VTEX Trust', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* Layout */
.content { display: flex; flex-direction: column; gap: 12px; }
.row { display: flex; align-items: center; gap: 12px; }
.spaceBetween { justify-content: space-between; }

/* Typography — uses approved size scale (10, 12, 14, 16, 18, 20, 22, 24...) */
.title    { font-size: 16px; font-weight: 600; color: var(--sa-color-text-primary);   margin: 0; }
.subtitle { font-size: 14px; font-weight: 500; color: var(--sa-color-text-secondary); margin: 0; }
.text     { font-size: 14px; color: var(--sa-color-text-tertiary); line-height: 1.5; }

/* Loading state */
.loading {
  display: flex; align-items: center; justify-content: center;
  gap: 8px; padding: 24px; color: var(--sa-color-text-secondary);
}
.spinner {
  width: 20px; height: 20px;
  border: 2px solid var(--sa-color-border); border-top-color: var(--sa-color-primary);
  border-radius: 50%; animation: ${COMPONENT_NAME}-spin 1s linear infinite;
}
@keyframes ${COMPONENT_NAME}-spin { to { transform: rotate(360deg); } }

/* Error state */
.error {
  padding: 16px; background-color: var(--sa-color-error-bg);
  border: 1px solid var(--sa-color-error-border); border-radius: 8px;
  color: var(--sa-color-error-text); font-size: 14px;
}

/* Button styles */
.button {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 12px 16px; font-size: 14px; font-weight: 500;
  border: none; border-radius: 6px; cursor: pointer;
  transition: background-color 0.2s ease;
}
.buttonPrimary { background-color: var(--sa-color-primary); color: #FFFFFF; }
.buttonPrimary:hover { background-color: var(--sa-color-primary-hover); }
.buttonSecondary { background-color: var(--sa-color-bg-muted); color: var(--sa-color-text-tertiary); }
.buttonSecondary:hover { background-color: var(--sa-color-border); }

/* Card */
.card {
  padding: 16px; background-color: var(--sa-color-bg-subtle);
  border-radius: 8px; border: 1px solid var(--sa-color-border);
}

/* Badges */
.badge {
  display: inline-block; padding: 4px 8px;
  font-size: 12px; font-weight: 500; border-radius: 4px;
}
.badgeSuccess { background-color: var(--sa-color-success-bg); color: var(--sa-color-success-text); }
.badgeWarning { background-color: var(--sa-color-warning-bg); color: var(--sa-color-warning-text); }
.badgeInfo    { background-color: var(--sa-color-info-bg);    color: var(--sa-color-info-text); }

/* Input */
.input {
  width: 100%; padding: 12px; font-size: 14px;
  border: 1px solid var(--sa-color-border-input); border-radius: 6px;
  outline: none; transition: border-color 0.2s ease;
}
.input:focus { border-color: var(--sa-color-primary); }

/* Price display */
.price          { font-size: 18px; font-weight: 600; color: var(--sa-color-text-primary); }
.priceOld       { font-size: 14px; color: var(--sa-color-text-muted); text-decoration: line-through; }
.priceDiscount  { font-size: 14px; color: var(--sa-color-success-text); font-weight: 500; }

/* Responsive — Sales App breakpoints
   Small (mobile)  320–743px  → margin: 24px, no column grid
   Medium (tablet) 744–1279px → host gutters: 16px (no override needed)
   Large (desktop) 1280–1919px → host gutters: 20px (no override needed)
   Extra large     1920px+    → host gutters: 20px (no override needed) */
@media (max-width: 743px) {
  .container { padding: 12px; margin: 0 24px; }
}
```

### CSS file structure

Every extension CSS must follow this order:

1. **Token declarations** — `--sa-color-*` on `.container`
2. **Layout helpers** — `.container`, `.content`, `.row`, `.spaceBetween`
3. **Typography** — `.title`, `.subtitle`, `.text`
4. **State** — `.loading`, `.spinner`, `@keyframes`, `.error`
5. **Component classes** — `.button`, `.card`, `.badge`, `.input`, `.price`
6. **Responsive** — `@media` queries at the bottom

For UX writing rules (sentence case) and iconography (Phosphor Icons) used in `.tsx`, see [design-guidelines.md](design-guidelines.md).

## index.tsx with defineExtensions

```typescript
import { defineExtensions } from '@vtex/sales-app';
${COMPONENT_IMPORTS}

/**
 * Sales App Extensions Entry Point
 *
 * Connects extension components to their target extension points.
 * Each extension point can only have one component assigned to it.
 *
 * Available extension points:
 * - cart.cart-list.after
 * - cart.cart-item.after
 * - cart.order-summary.after
 * - pdp.sidebar.before
 * - pdp.sidebar.after
 * - pdp.content.after
 * - menu.item
 * - menu.drawer-content
 */
export default defineExtensions({
  ${EXTENSION_MAPPINGS}
});
```

## Validation Rules

After generating code, validate for these issues:

1. **React import present** — `import React from 'react'` is required for JSX compilation
2. **Component exported** — must have `export function`, `export const`, or `export default`
3. **No null returns** — `return null` is not allowed; use `return (<></>)` instead
4. **Hook imports** — all hooks must be imported from `@vtex/sales-app`
5. **Optional property guards** — `manualPrice`, `productRefId`, `attachments` must have null checks
6. **useCartItem item check** — `if (!item) return (<></>)` before accessing item properties
7. **Hook/extension-point compatibility** — each hook is only valid in specific extension points
8. **API call handling** — loading state and error handling must be present for any `fetch()` call
9. **CSS class usage** — CSS classes defined in the stylesheet should be used in the component
10. **defineExtensions in index.tsx** — entry point must import and call `defineExtensions`
11. **Static analysis compliance** — generated code must pass all fsp-analyzer sandbox security, CSS containment, and React performance rules. Load the [static analysis reference](static-analysis-rules.md) to run the full check. Fix all violations before presenting code to the user; flag warnings to the user for review.
12. **Design system compliance** — the CSS file must follow the rules table at the top of the "CSS Stylesheet" section above: `--sa-color-*` custom properties declared on `.container` and used in all rules, `'VTEX Trust'` font family, allowed font sizes (10, 12, 14, 16, 18, 20, 22, 24, 28, 32…), 4px-multiple spacing, scoped selectors, and the responsive override at `(max-width: 743px)`. For UI text (sentence case) and icons (Phosphor), see [design-guidelines.md](design-guidelines.md).

## API Type Generation from Documentation

When API documentation was ingested during Discovery (Step 1), generate TypeScript interfaces from the extracted response shapes. Apply these rules:

### JSON to TypeScript conversion rules

| JSON value | TypeScript type |
|-----------|----------------|
| `"string"` | `string` |
| `123` | `number` |
| `true` / `false` | `boolean` |
| `null` or sometimes absent | `type \| null` or `property?: type` |
| `{ }` (nested object) | Separate named `interface` |
| `[ ]` (array of objects) | `InterfaceType[]` |
| `[ ]` (array of primitives) | `string[]`, `number[]`, etc. |

### Naming conventions

- Top-level response type: `{ComponentName}Data` (replaces the `${DATA_INTERFACE}` placeholder)
- Nested object type: `{ComponentName}{FieldName}` (e.g., `LoyaltyHistoryEntry`)
- Request body type (POST/PUT): `{ComponentName}Request`
- Keep names PascalCase and domain-specific

### Example

Given API response:

```json
{ "points": 100, "tier": "gold", "expiresAt": null, "history": [{ "date": "2026-01-01", "amount": 10 }] }
```

Generate:

```typescript
interface LoyaltyHistoryEntry {
  date: string;
  amount: number;
}

interface LoyaltyData {
  points: number;
  tier: string;
  expiresAt: string | null;
  history: LoyaltyHistoryEntry[];
}
```

If a field is documented as optional (not always present), use `?`:

```typescript
interface ProductRecommendationData {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;  // optional per API docs
  badge?: string;     // optional per API docs
}
```

### Multiple endpoints

If the extension calls more than one endpoint, generate a separate interface per endpoint response. Prefix with the endpoint purpose: `{ComponentName}{Purpose}Data` (e.g., `LoyaltyBalanceData`, `LoyaltyRedemptionResponse`).

## Custom Fetch Hook Pattern

Use this pattern when the extension calls **2 or more endpoints** or when the fetch logic is complex (chained requests, pagination, polling).

### Decision rule

- **1 endpoint** → inline `useEffect` fetch inside the component (existing pattern).
- **2+ endpoints** → extract into one or more custom hooks in `hooks/use{Purpose}.ts`.

### Custom hook template

```typescript
import { useState, useEffect } from 'react';

export function use${Purpose}(account: string) {
  const [data, setData] = useState<${ResponseType} | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('${API_ENDPOINT}', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to fetch ${Purpose}');
        const result: ${ResponseType} = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [account]);

  return { data, loading, error };
}
```

### Usage in component

```typescript
import { use${Purpose} } from './hooks/use${Purpose}';

export function ${COMPONENT_NAME}(): JSX.Element {
  const { account } = useExtension();
  const { data: balance, loading: loadingBalance, error: errorBalance } = use${Purpose}(account);
  const { data: history, loading: loadingHistory, error: errorHistory } = use${OtherPurpose}(account);

  if (loadingBalance || loadingHistory) return <div className="loading">Loading...</div>;
  if (errorBalance || errorHistory) return <div className="error">Error loading data</div>;
  if (!balance || !history) return (<></>);

  return (
    <div className="container">
      {/* render using balance and history */}
    </div>
  );
}
```

### File placement

Custom hooks go in `packages/sales-app/src/hooks/use{Purpose}.ts`. They must be TypeScript-only files (no JSX, no `.tsx` extension needed unless they return JSX).
