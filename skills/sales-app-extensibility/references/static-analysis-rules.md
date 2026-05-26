---
name: sales-app-static-analysis-rules
description: fsp-analyzer rule catalog for Sales App extension validation. Load during Step 3 (Code Generation & Validation) to check generated TypeScript/CSS against sandbox security, CSS containment, and React performance rules enforced at build time.
metadata:
  version: "1.0"
---

# Static Analysis Rules (fsp-analyzer)

Sales App extensions run inside a sandboxed environment enforced by `@vtex/fsp-analyzer`. These rules are checked at `preBuild` and `preDev` hook time. The AI must validate all generated code against these rules before presenting it to the user.

Rule IDs match the `ViolationKind`, `ReactViolationKind`, `WarningKind`, and `ReactWarningKind` types from `@vtex/fsp-analyzer` so developers can cross-reference with real build output.

---

## How to apply these rules

After generating a component, CSS file, and `index.tsx`, check each generated file against the **violation** rules (block generation — fix before presenting) and the **warning** rules (flag to the user with a suggestion). Do not present code that has unresolved violations.

---

## 1. Sandbox Security Rules

Applied to `.ts` and `.tsx` files by `FastStoreSandboxAnalyzer`.

### `RESTRICTED_API` — DOM API access banned

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Restricted identifiers: `document`, `window`, `localStorage`, `sessionStorage`, `navigator`.

**Detection:** Any use of these identifiers as a value (not as a type import).

**Correct**
```typescript
// Use React state and props for data; use useExtension() for account context
const { account } = useExtension();
```

**Wrong**
```typescript
const userId = localStorage.getItem('userId');
const width = window.innerWidth;
document.title = 'My Extension';
```

---

### `VARIABLE_ALIASING` — Aliasing restricted APIs

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Assigning a restricted API to a variable to circumvent detection.

**Detection:** `const x = document`, `const [w, d] = [window, document]`, or any destructuring that aliases a restricted API.

**Correct**
```typescript
// Pass data via props or React context, not via aliased globals
```

**Wrong**
```typescript
const doc = document;
const [w, d] = [window, document];
doc.querySelector('.item');
```

---

### `GLOBAL_MANIPULATION` — Global object manipulation

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Restricted member expressions: `window.location`, `window.history`.

**Detection:** Member expressions on `window` to access `location` or `history`.

**Correct**
```typescript
// Navigation is managed by Sales App shell; do not manipulate location
```

**Wrong**
```typescript
window.location.href = '/new-path';
window.location.reload();
```

---

### `HISTORY_MANIPULATION` — Browser history manipulation

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Restricted calls: `window.history.pushState`, `window.history.replaceState`, `history.pushState`, `history.replaceState`.

**Detection:** Any call to these methods.

**Correct**
```typescript
// Let the Sales App shell handle routing
```

**Wrong**
```typescript
history.pushState({}, '', '/cart');
window.history.replaceState(null, '', '/pdp');
```

---

### `DYNAMIC_SCRIPT_CREATION` — Dynamic script creation

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Restricted expressions: `document.createElement`, `document.write`, `document.writeln`, `document.body.appendChild`, `document.head.appendChild`.

**Detection:** Any call to these methods.

**Correct**
```typescript
// Render UI via JSX; never inject scripts dynamically
```

**Wrong**
```typescript
const script = document.createElement('script');
script.src = 'https://cdn.example.com/lib.js';
document.body.appendChild(script);
```

---

### `CODE_EXECUTION` — Arbitrary code execution

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Restricted calls: `eval`, `Function` (as constructor), `setTimeout` (string form), `setInterval` (string form), `new Function`.

**Detection:** Any call or instantiation of these identifiers.

> **Note on `setTimeout`/`setInterval`:** These are restricted in the sandbox to prevent arbitrary code injection. Use `useEffect` with `AbortController` or cleanup functions for timing-based logic:

**Correct**
```typescript
useEffect(() => {
  const id = window.setTimeout(() => { /* logic */ }, 500);
  return () => window.clearTimeout(id);
}, []);
// Note: even this should be reviewed; prefer event-driven patterns
```

**Wrong**
```typescript
eval('doSomething()');
const fn = new Function('return 42');
setTimeout('doSomething()', 1000);
```

---

### `RESTRICTED_IMPORT` — Restricted Node.js module imports

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Restricted modules: `fs`, `path`, `child_process`, `crypto`.

**Detection:** Any `import` statement importing from these module names.

**Correct**
```typescript
// Extensions are browser-only React components; do not import Node.js modules
import { useCart } from '@vtex/sales-app';
```

**Wrong**
```typescript
import fs from 'fs';
import { resolve } from 'path';
import crypto from 'crypto';
```

---

### `RESTRICTED_IMPORT_SOURCE` — Direct node_modules path imports

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

**Detection:** Import paths containing `node_modules/`.

**Wrong**
```typescript
import something from 'node_modules/lodash/get';
```

---

### `NON_APPROVED_PACKAGE` — Import from non-approved package

**Severity:** Warning (flag)  
**Files:** `.ts`, `.tsx`

Any import whose source starts with `@` or contains `/`, unless it is `react` or a `node_modules/` direct path. Fires for every `@vtex/*` scoped package and every relative import (`./foo`, `../bar`).

> **Note:** This warning is noisy — it fires for all legitimate Sales App imports (`@vtex/sales-app`, `@phosphor-icons/react`, relative component paths). Do not surface to the user when the import is from `@vtex/*` or a relative path. Investigate only when the import is from an unexpected third-party package.

**Detection:** `import { … } from 'source'` where `source.startsWith('@')` or `source.includes('/')`, and source is not `'react'` or a `node_modules/` path.

---

### `EXTERNAL_RESOURCE_LOADING` — Unrestricted external resource loading

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Two detection paths:

1. **Direct API use:** `fetch`, `XMLHttpRequest`, `script.src`, `link.href` used as member expressions.
2. **Known CDN domains in string literal:** `fetch('https://cdn.jsdelivr.net/...')` or any URL containing `cdn.jsdelivr.net`, `unpkg.com`, `cdnjs.cloudflare.com`, `ajax.googleapis.com`, `code.jquery.com`, `api.example.com`, or ending with `.js`.

> **Exception:** `fetch` via the IO Proxy relative path (`/_v/...`) is allowed and required for secure API integration.

**Correct**
```typescript
const response = await fetch('/_v/my-loyalty-api/points', {
  credentials: 'include',
});
```

**Wrong**
```typescript
const response = await fetch('https://api.example.com/data');
const response = await fetch('https://cdn.jsdelivr.net/npm/lodash.js'); // CDN — also Violation
const xhr = new XMLHttpRequest();
```

---

### `EXTERNAL_RESOURCE_FETCH` — Fetch to known CDN domains

> **Note:** This rule ID is declared in the analyzer type system but is never raised by any handler. CDN domain fetches are actually reported as `EXTERNAL_RESOURCE_LOADING` (Violation, block) — not as this Warning. Treat any fetch to a CDN domain as a **build-blocking Violation**, not a soft warning.

**Severity:** Warning (flag) — *see note above; actual enforcement is via `EXTERNAL_RESOURCE_LOADING`*  
**Files:** `.ts`, `.tsx`

Known third-party domains: `cdn.jsdelivr.net`, `unpkg.com`, `cdnjs.cloudflare.com`, `ajax.googleapis.com`, `code.jquery.com`.

**Detection:** `fetch()` first argument literal containing one of these domains.

---

### `QUERY_SELECTOR_USAGE` — DOM query selectors

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Restricted calls: `document.getElementById`, `document.getElementsByClassName`, `document.getElementsByTagName`, `document.querySelector`, `document.querySelectorAll`, and element-scoped variants.

**Detection:** Any call where the callee matches `document.querySelector`, `document.getElementById`, etc. (the variable must be literally named `document`). Calls via a ref object — e.g. `containerRef.current.querySelector(...)` — are **not** caught by the analyzer and must be avoided as a Hard Constraint.

**Correct**
```typescript
// Use React refs for direct DOM access when absolutely needed
const ref = useRef<HTMLDivElement>(null);
```

**Wrong**
```typescript
const el = document.querySelector('.my-class');
document.getElementById('cart-container');
```

---

### `STYLE_MANIPULATION` — Direct style manipulation

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

Restricted expressions: `element.style`, `element.className`, `element.classList`, `element.setAttribute.style`, `element.setAttribute.class`, `element.hidden`, `element.display`, `element.visibility`.

**Detection:** Matches only when the object is literally named `element` (e.g. `element.style`). Equivalent access through other variable names — e.g. `divRef.current.style`, `el.className` — is **not** caught by the analyzer and must be avoided as a Hard Constraint.

**Correct**
```typescript
// Use plain CSS classes from the component stylesheet
import './MyExtension.css';

return <div className={isActive ? 'active' : 'inactive'} />;
```

**Wrong**
```typescript
element.style.color = 'red';
element.classList.add('active');
element.setAttribute('style', 'display: none');
```

---

### `INFINITE_LOOP` — Infinite loops

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

**Detection:** `while(true)` or `do...while(true)` with literal `true` condition.

**Wrong**
```typescript
while (true) {
  processItem();
}
```

---

### `POTENTIAL_INFINITE_LOOP` — Incomplete for-loop

**Severity:** Warning (flag)  
**Files:** `.ts`, `.tsx`

**Detection:** `for` statement with no `update` expression AND no `test` expression (e.g. `for (let i = 0;;) { … }`).

**Action:** Warn the user and ensure the loop has a proper termination condition.

---

### `MEMORY_LEAK` — Memory leak patterns

> **Note:** This rule ID is declared in the analyzer type system but is never raised by any handler. The active rule is `POTENTIAL_MEMORY_LEAK` (Warning) below. Event listeners without cleanup **will not block the build**, but remain a Hard Constraint — always add a cleanup return in `useEffect`.

**Severity:** Violation (block) — *see note above; not currently enforced at build time*  
**Files:** `.ts`, `.tsx`

**Detection:** Event listeners, subscriptions, or timers added without cleanup in `useEffect`.

**Correct**
```typescript
useEffect(() => {
  const handler = () => { /* ... */ };
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);
```

**Wrong**
```typescript
useEffect(() => {
  window.addEventListener('resize', handler);
  // Missing cleanup — memory leak
}, []);
```

---

### `POTENTIAL_MEMORY_LEAK` — Likely memory leak patterns

**Severity:** Warning (flag)  
**Files:** `.ts`, `.tsx`

Three triggers:
1. Any `addEventListener` call — the analyzer warns regardless of whether a corresponding `removeEventListener` exists in cleanup.
2. Recursive function call where the callee name matches the parent `FunctionDeclaration` identifier.
3. `Array.push` inside a `for` or `while` loop.

**Action:** Verify the component has a proper cleanup return in `useEffect` for any event listener, and that recursive functions have a clear base case.

**Correct**
```typescript
useEffect(() => {
  const handler = () => { /* ... */ };
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);
```

---

### `EXCESSIVE_API_CALLS` — Excessive API call patterns

**Severity:** Violation (block)  
**Files:** `.ts`, `.tsx`

**Detection:** `fetch` or `XMLHttpRequest` calls whose parent is a `for` or `while` loop.

**Wrong**
```typescript
// fetch inside loop — excessive calls
for (const item of items) {
  await fetch(`/_v/api/item/${item.id}`);
}
```

---

### `FREQUENT_API_CALLS` — API call outside loop / rapid setInterval

**Severity:** Warning (flag)  
**Files:** `.ts`, `.tsx`

Two triggers:
1. `fetch` or `XMLHttpRequest` call **outside** a loop (i.e. anywhere else in the component). Fires for every fetch — ensure calls are wrapped in `useEffect` with proper deps and are rate-limited or cached.
2. `setInterval` with a numeric delay argument below 1000 ms.

> **Note:** Trigger 1 is intentionally broad — it flags every `fetch()` call as a reminder to verify it is not running unintentionally on every render. It does **not** mean every fetch is wrong. Only surface this to the user when the fetch is genuinely outside a `useEffect` or appears to run on each render.

**Action:** Warn the user and suggest wrapping fetches in `useEffect`, using caching, or increasing the polling interval.

---

### `LARGE_BUNDLE_SIZE_IMPACT` — Bundle size impacts

**Severity:** Warning (flag)  
**Files:** `.ts`, `.tsx`

**Detection:**
- String literals longer than 1,000 characters
- Object literals with more than 100 properties
- Imports from heavyweight libraries: `lodash`, `moment`

**Action:** Warn the user and suggest alternatives (`date-fns` instead of `moment`, native array methods instead of `lodash`).

**Correct**
```typescript
import { format } from 'date-fns';
const formattedDate = format(new Date(), 'yyyy-MM-dd');
```

**Wrong**
```typescript
import moment from 'moment';
import _ from 'lodash';
```

---

## 2. CSS Containment Rules

Applied to `.css`, `.scss`, `.less` files by `CSSAnalyzer`.

**Sales App analyzer configuration** (from `@vtex/sales-app` build/dev hook):

```typescript
cssOptions: {
  allowedNamespaces: ['sales-app-extension-'],
  defaultNamespace: 'sales-app-extension-',
  transformNonCompliant: true,
  overwriteTransformed: true,
}
```

Two consequences for the rules below:

1. The configured namespace is **`sales-app-extension-`**, not the analyzer's bare default of `extension-`. Any rule that talks about "the allowed namespace" means `sales-app-extension-` in this project.
2. `transformNonCompliant: true` softens the namespace rules: when a selector or `@keyframes` name is not prefixed, the analyzer auto-rewrites it into a sibling `*.transformed.css` file and emits a `CSS_TRANSFORMED` **warning** instead of a `CSS_NAMESPACE_REQUIRED` / `CSS_GLOBAL_KEYFRAMES` **violation**. The original `.css` (and the `className` strings in JSX) are left untouched, so the build does not break. This is why the CSS template in [code-templates-and-patterns.md](code-templates-and-patterns.md) ships unprefixed selectors like `.container`, `.title`, `.row` — they are valid in this project.

The other CSS rules (`CSS_GLOBAL_SELECTOR`, `CSS_CONTAINMENT_BREAKOUT`, `CSS_GLOBAL_IMPORT`, `CSS_RESTRICTED_PROPERTY`, `CSS_RESTRICTED_VALUE`, and the inline-style rules) are **not** softened by `transformNonCompliant` — they remain build-blocking violations.

### `CSS_GLOBAL_SELECTOR` — Global element selectors

**Severity:** Violation (block)  
**Files:** `.css`

Restricted selectors: `*`, `body`, `html`, `:root`, `head`, `main`, `#root`, `#__next`.

**Detection:** Any CSS rule whose selector matches or contains these elements at the top level.

**Correct**
```css
/* Scope rules inside the extension container — never target global elements */
.container {
  font-size: 14px;
}

.container .title {
  font-weight: bold;
}
```

**Wrong**
```css
body {
  font-size: 14px;
}

* {
  box-sizing: border-box;
}

:root {
  --my-color: red;
}
```

---

### `CSS_CONTAINMENT_BREAKOUT` — CSS containment breakout

**Severity:** Violation (block)  
**Files:** `.css`

Restricted patterns: `:host`, `:host-context`, `::slotted`, `:global`, `position: fixed`, `position: absolute`, `z-index: 9999`.

**Detection:** Any rule or declaration matching these patterns.

> **Note on positioning:** `position: relative` and `position: sticky` within the extension container are generally safe. Avoid `fixed` and unbounded `absolute` that escape the extension boundary.

**Correct**
```css
.container {
  position: relative; /* safe — contained */
}
```

**Wrong**
```css
.overlay {
  position: fixed;
  z-index: 9999;
  top: 0;
  left: 0;
}

:host {
  display: block;
}
```

---

### `CSS_NAMESPACE_REQUIRED` — Missing CSS namespace

**Severity:** Warning in this project (auto-transformed) — would be Violation if `transformNonCompliant` were `false`  
**Files:** `.css`

All CSS selectors should be scoped under an allowed namespace prefix. In the Sales App, that prefix is `sales-app-extension-`. Because the project sets `transformNonCompliant: true`, an unprefixed selector does **not** block the build: the analyzer rewrites it inside a sibling `Component.transformed.css` and emits a `CSS_TRANSFORMED` warning instead of `CSS_NAMESPACE_REQUIRED`. The original `Component.css` (which is what gets bundled) keeps the unprefixed class, so the JSX `className="container"` continues to match.

**Detection:** A selector that does not include any value from `allowedNamespaces` (substring check on `.namespace`, `#namespace`, or `[class*="namespace"]`).

**Correct (and matches the CSS template)**
```css
/* Unprefixed top-level classes are accepted because transformNonCompliant=true. */
.container { padding: 8px; }
.title     { font-size: 16px; }
```

**Also correct (explicit prefix, never warns)**
```css
.sales-app-extension-container { padding: 8px; }
.sales-app-extension-title     { font-size: 16px; }
```

> Prefer the unprefixed form to match the CSS template in [code-templates-and-patterns.md](code-templates-and-patterns.md) and the JSX in the component templates. The `CSS_TRANSFORMED` warning that fires for these is informational only.

---

### `CSS_GLOBAL_IMPORT` — CSS @import rules

**Severity:** Violation (block)  
**Files:** `.css`

`@import` pulls external stylesheets that affect global styles and bypass containment.

**Detection:** Any `@import` at-rule anywhere in the CSS file.

**Correct**
```css
/* Import a local CSS variable file via bundler config, not @import */
```

**Wrong**
```css
@import url('https://fonts.googleapis.com/css2?family=Roboto');
@import './reset.css';
```

---

### `CSS_GLOBAL_KEYFRAMES` — Keyframes without namespace

**Severity:** Warning in this project (auto-transformed) — would be Violation if `transformNonCompliant` were `false`  
**Files:** `.css`

`@keyframes` names are global. Without a namespace they may conflict with other extensions or the Sales App shell. As with `CSS_NAMESPACE_REQUIRED`, `transformNonCompliant: true` rewrites the name in `*.transformed.css` and emits `CSS_TRANSFORMED` instead of blocking.

**Detection:** `@keyframes` whose name does not start with an allowed namespace prefix (`sales-app-extension-` in this project).

The CSS template prefixes keyframes with `${COMPONENT_NAME}-` (e.g. `LoyaltyPoints-spin`). That prefix does **not** start with `sales-app-extension-`, so it triggers a `CSS_TRANSFORMED` warning — the build still succeeds, but the transformed file will rename it to `sales-app-extension-LoyaltyPoints-spin`. Either form is acceptable.

**Correct (no warning)**
```css
@keyframes sales-app-extension-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

**Also correct (CSS_TRANSFORMED warning, build passes)**
```css
@keyframes LoyaltyPoints-spin {
  to { transform: rotate(360deg); }
}
```

---

### `CSS_RESTRICTED_PROPERTY` — Restricted CSS properties

**Severity:** Violation (block)  
**Files:** `.css`

Certain properties affect layout or rendering globally and are restricted to prevent layout shift or containment breakout.

**Detection:** Declarations using restricted property names (e.g., properties that set global layout hints).

**Action:** If detected, remove or scope the declaration appropriately.

---

### `CSS_RESTRICTED_VALUE` — Restricted CSS values

**Severity:** Violation (block)  
**Files:** `.css`

Certain CSS values (e.g., `!important`) override the cascade and break containment guarantees.

**Detection:** `!important` in any declaration, or values targeting global layout tokens.

**Correct**
```css
.button {
  color: var(--sa-color-primary);
}
```

**Wrong**
```css
.button {
  color: red !important;
}
```

---

### `CSS_RESTRICTED_INLINE_PROPERTY` — Restricted property in inline style

**Severity:** Violation (block)  
**Files:** `.tsx`

Inline `style={{ … }}` props in JSX may not use properties that affect layout or containment.

Restricted properties: `position`, `z-index`, `top`, `left`, `right`, `bottom`, `all`, `contain`, `content`, `isolation`.

**Detection:** A JSX `style` prop object containing one of the restricted property names.

**Correct**
```typescript
// Use CSS classes for layout properties
return <div className="overlay" />;
```

**Wrong**
```typescript
return <div style={{ position: 'fixed', top: 0 }} />;
```

---

### `CSS_RESTRICTED_INLINE_VALUE` — Restricted value in inline style

**Severity:** Violation (block)  
**Files:** `.tsx`

Inline `style={{ … }}` props may not use values that break containment or cascade.

Restricted values: `fixed`, `absolute`, `!important`, `inherit`, `initial`, `unset`.

**Detection:** A JSX `style` prop object containing one of the restricted values.

**Wrong**
```typescript
return <div style={{ position: 'fixed' }} />;
return <div style={{ display: 'inherit' }} />;
```

---

## 3. React Performance Rules

Applied to `.tsx` files by `ReactPerformanceAnalyzer`. Violations block presentation; warnings are flagged to the user.

### `REACT_UNNECESSARY_RERENDER` — State update inside loop

**Severity:** Violation (block)  
**Files:** `.tsx`

State setter calls inside `for` or `while` loops trigger a re-render on every iteration.

**Detection:** A `setState` / `set*` call whose parent node is a `for` or `while` statement.

**Correct**
```typescript
// Compute derived value, then set once
const updatedItems = items.map(transform);
setItems(updatedItems);
```

**Wrong**
```typescript
for (const item of items) {
  setCount((c) => c + 1); // re-renders on every iteration
}
```

---

### `REACT_ANONYMOUS_COMPONENT` — Anonymous (lowercase) component

**Severity:** Violation (block)  
**Files:** `.tsx`

Components assigned to variables starting with lowercase are treated as HTML tags by React and cannot be used in JSX.

**Detection:** Arrow function or function expression assigned to a variable that does not start with an uppercase letter.

**Correct**
```typescript
export function LoyaltyPoints(): JSX.Element { ... }
export const WarrantyBadge = (): JSX.Element => { ... };
```

**Wrong**
```typescript
const loyaltyPoints = (): JSX.Element => { ... };
const warrantyBadge = function() { ... };
```

---

### `REACT_DIRECT_DOM_MANIPULATION` — Direct DOM manipulation in React

**Severity:** Violation (block)  
**Files:** `.tsx`

Bypasses the React virtual DOM and causes unpredictable behavior.

**Detection:** Calls to `document.querySelector` or `document.getElementById` inside a React component.

**Correct**
```typescript
const containerRef = useRef<HTMLDivElement>(null);
// Access DOM via containerRef.current
```

**Wrong**
```typescript
const el = document.querySelector('.cart-list');
el.style.display = 'none'; // bypasses React
```

---

### `REACT_LAYOUT_EFFECT_MISUSE` — useLayoutEffect usage

**Severity:** Violation (block)  
**Files:** `.tsx`

`useLayoutEffect` blocks the browser paint and can cause performance issues in a sandboxed extension.

**Detection:** Any call to `useLayoutEffect`.

**Correct**
```typescript
useEffect(() => {
  // DOM reading/writing after paint
}, []);
```

**Wrong**
```typescript
useLayoutEffect(() => {
  // blocks paint
}, []);
```

---

### `REACT_MISSING_DEPS` — Missing dependency array

**Severity:** Warning (flag)  
**Files:** `.tsx`

`useEffect`, `useCallback`, or `useMemo` without a second argument re-runs on every render.

**Detection:** A call to one of these hooks with fewer than 2 arguments, or with a non-array second argument.

**Correct**
```typescript
useEffect(() => {
  fetchData();
}, [productId]); // explicit deps
```

**Wrong**
```typescript
useEffect(() => {
  fetchData(); // runs on every render
});
```

---

### `REACT_INLINE_FUNCTION` — Inline functions in JSX props

**Severity:** Warning (flag)  
**Files:** `.tsx`

Arrow functions defined directly in JSX attributes create a new function reference on every render, preventing child memoization.

**Detection:** Function expression or arrow function expression whose parent is a JSX expression container or prop.

**Correct**
```typescript
const handleClick = useCallback(() => {
  doSomething();
}, []);

return <button onClick={handleClick}>Click</button>;
```

**Wrong**
```typescript
return <button onClick={() => doSomething()}>Click</button>;
```

---

### `REACT_LARGE_COMPONENT` — Component over 200 lines

**Severity:** Warning (flag)  
**Files:** `.tsx`

Large components are harder to maintain and test. Threshold: **200 lines**.

**Detection:** A function/arrow function with start/end line difference > 200.

**Action:** Suggest splitting into smaller sub-components or extracting logic into custom hooks.

---

### `REACT_MANY_USESTATE` — More than 5 useState calls

**Severity:** Warning (flag)  
**Files:** `.tsx`

Many `useState` calls in a single component indicate complex local state. Threshold: **5 calls**.

**Detection:** More than 5 calls to `useState` (or `React.useState`) within a single function component.

**Action:** Suggest consolidating related state into a single `useState` with an object, or extracting to a custom hook.

**Correct**
```typescript
const [formState, setFormState] = useState({
  name: '',
  email: '',
  quantity: 1,
});
```

**Wrong**
```typescript
const [name, setName] = useState('');
const [email, setEmail] = useState('');
const [quantity, setQuantity] = useState(1);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [submitted, setSubmitted] = useState(false); // 6th useState — flagged
```

---

### `REACT_CONDITIONAL_HOOK` — Hook called conditionally

**Severity:** Warning (flag)  
**Files:** `.tsx`

Calling a hook inside an `if`, `switch`, or ternary expression violates the Rules of Hooks.

**Detection:** A hook call (useEffect, useState, useMemo, useCallback, useLayoutEffect) whose ancestor is an `IfStatement`, `SwitchStatement`, or `ConditionalExpression`.

**Correct**
```typescript
const cart = useCart(); // always called unconditionally

if (!cart) return <></>;
```

**Wrong**
```typescript
if (isEnabled) {
  const cart = useCart(); // conditional hook call — violates Rules of Hooks
}
```

---

### `REACT_COMPLEX_JSX` — Deep JSX nesting

**Severity:** Warning (flag)  
**Files:** `.tsx`

Deep JSX trees are harder to read and may indicate a need to extract sub-components. Threshold: **5 levels deep**.

**Detection:** A JSX element whose JSX child tree exceeds 5 levels of nesting.

**Action:** Extract inner JSX into a named sub-component.

---

### `REACT_UNOPTIMIZED_LIST` — List rendering without key or large list

**Severity:** Warning (flag)  
**Files:** `.tsx`

Missing `key` props in list rendering causes React reconciliation issues. Lists over 50 items may need virtualization.

**Detection:**
- `map()` producing JSX without a `key` attribute on the root element
- List size exceeding 50 items

**Correct**
```typescript
return (
  <ul>
    {items.map((item) => (
      <li key={item.id}>{item.name}</li>
    ))}
  </ul>
);
```

**Wrong**
```typescript
return (
  <ul>
    {items.map((item) => (
      <li>{item.name}</li> // missing key
    ))}
  </ul>
);
```

---

### `REACT_COMPLEX_STATE` — useState with complex object

**Severity:** Warning (flag)  
**Files:** `.tsx`

`useState` initialized with an object having more than 5 properties suggests a need for `useReducer`. Threshold: **5 properties**.

**Detection:** `useState(obj)` where `obj` is an object literal with > 5 properties.

**Action:** Suggest converting to `useReducer` for complex state.

---

### `REACT_NESTED_UPDATE` — Nested state updates

**Severity:** Warning (flag)  
**Files:** `.tsx`

Calling a state setter from within another state setter's callback can cause unexpected re-renders.

**Detection:** A `set*` call whose ancestor is another `set*` call expression.

---

## Validation Output Format

When reporting issues after code review, group by file and severity:

```
### Static Analysis Results

**Violations (must fix before completing Step 3):**
- [RULE_ID] File: ComponentName.tsx, Line ~N — <message>
  Fix: <suggested fix>

**Warnings (review with user):**
- [RULE_ID] File: ComponentName.tsx, Line ~N — <message>
  Suggestion: <improvement>

✅ No violations found. N warnings flagged.
```

Do not proceed with Step 4 (Documentation) until all violations are resolved.
