---
name: faststore-cms
description: How VTEX Headless CMS integrates with FastStore, including how to define section schema.json and sync them. Use when registering new CMS sections, defining editable CMS fields (text, boolean, dropdown, nested objects), syncing schema changes, or understanding how CMS props flow to React components.
metadata:
  author: vtex
  version: "1.0"
---

# FastStore CMS Integration

## Overview

**Authoritative inputs** for Headless CMS sections are:

- `cms/faststore/components/*.jsonc` — section schema (including `"$componentKey"`)
- `cms/faststore/pages/*.jsonc` — optional page templates (when your project uses them)
- `src/components/index.tsx` — **default export** object whose **keys** must match `"$componentKey"` for each custom section

The file **`cms/faststore/schema.json` is generated output** from `vtex content generate-schema`. It aggregates those sources for upload. **Never edit `schema.json` by hand** — fix the JSONC and/or `index.tsx`, then regenerate.

**All global native sections are already registered** in the platform; your repo extends the CMS with custom definitions.

To edit **content** in existing sections, use the Store Admin at:
`https://{store-id}.myvtex.com/admin` → `Storefront` → `Content: All content`

## Critical Rules

1. There is no need of creating `cms/faststore/pages/*.jsonc` files for new sections. This should be edited only when a new landing page is needed.
2. After every change to `cms/faststore/components/*.jsonc` or `cms/faststore/pages/*.jsonc`, you **must** run **`vtex content generate-schema`** and **`vtex content upload-schema`** in the same working session (see [End-to-end agent workflow](#end-to-end-agent-workflow)). **Do not** use `yarn cms-sync`, `faststore cms-sync`, or other legacy `cms-sync` flows to publish Headless CMS schema — use **`vtex content`** only.
3. Every file inside the folder `cms/faststore/components/` should follow this name pattern and extension: `cms_component__<name>.jsonc`
4. Follow the conventions of the native components in `node_modules/@faststore/core/cms/faststore/components/` — see [Native Component Pattern Reference](#native-component-pattern-reference) for the full style guide
5. **Every custom section MUST use the `section` class as its first CSS class** on the root `<section>` element. This class provides the standard FastStore section spacing, padding, and responsive behavior. Always place it before any component-specific classes.
6. **Every custom section MUST have an inner `<div className="layout__content">` wrapper** immediately inside the `<section>` element. This wrapper constrains the content to the store's max-width grid and centers it. Without it, content will stretch edge-to-edge and break the store layout.

   **Correct section structure:**

   ```tsx
   <section className={`section ${styles.mySection}`}>
     <div className="layout__content">{/* Section content goes here */}</div>
   </section>
   ```

   **Wrong — missing `section` class and `layout__content` wrapper:**

   ```tsx
   <section className={styles.mySection}>
     {/* Content renders without standard spacing and full-bleed */}
   </section>
   ```

## Native Component Pattern Reference

When creating a new `cms/faststore/components/cms_component__<name>.jsonc`, **follow the conventions used by the native components** in `node_modules/@faststore/core/cms/faststore/components/`. The patterns below are extracted from those files and must be treated as the canonical style guide.

### Structural conventions

1. **Top-level keys appear in this order** — always:

   ```jsonc
   {
     "$extends": ["#/$defs/base-component"],
     "$componentKey": "MySection",
     "$componentTitle": "My Section",
     "title": "My Section",
     "description": "Short CMS editor description",
     "type": "object",
     "required": [...],
     "properties": { ... }
   }
   ```

   - `$extends` is always `["#/$defs/base-component"]`.
   - `$componentKey` is **PascalCase with no spaces** (e.g. `"ProductShelf"`, `"BannerText"`).
   - `$componentTitle` and `"title"` are **human-readable** (may contain spaces): `"Product Shelf"`, `"Banner Text"`.
   - `"description"` is a short sentence shown in the CMS palette (e.g. `"Add a quick promotion with an image/action pair"`).
   - `"required"` lists only the fields that **must** be filled by the editor; optional fields are simply omitted from this array.

2. **File name** matches the lowercased component name: `cms_component__productshelf.jsonc` for `$componentKey: "ProductShelf"`.

### Property conventions

| Pattern                 | Convention                                                                                                                              | Example from core                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Simple text field       | `{ "type": "string", "title": "Title" }`                                                                                                | Hero → `title`                                                                    |
| Text with default       | Add `"default"` at the same level                                                                                                       | Newsletter → `emailInputLabel`                                                    |
| Rich text (WYSIWYG)     | `"widget": { "ui:widget": "draftjs-rich-text" }`                                                                                        | Newsletter → `privacyPolicy`                                                      |
| Image upload            | `"widget": { "ui:widget": "media-gallery", "restrictMediaTypes": { "video": true, "image": ["png","jpg","jpeg","gif","svg","webp"] } }` | Hero → `image.src`                                                                |
| Boolean toggle          | `{ "type": "boolean", "title": "...", "default": false }`                                                                               | Alert → `dismissible`                                                             |
| Dropdown (enum)         | `"enum"` + `"enumNames"` arrays of equal length; `enum` holds the value, `enumNames` the label                                          | Hero → `colorVariant` (`["main","light","accent"]` / `["Main","Light","Accent"]`) |
| Integer with default    | `{ "type": "integer", "title": "...", "default": 5 }`                                                                                   | ProductShelf → `numberOfItems`                                                    |
| Nested object group     | `{ "type": "object", "title": "...", "properties": { ... } }` — nest `required` inside the object when needed                           | BannerText → `link` (with inner `required: ["text","url"]`)                       |
| Repeatable list         | `{ "type": "array", "items": { "type": "object", ... } }` — use `minItems`/`maxItems` to constrain                                      | Incentives → `incentives` (array of incentive objects)                            |
| Sub-object config group | Group related toggles/fields under a descriptive object                                                                                 | ProductShelf → `taxesConfiguration`, `productCardConfiguration`                   |

### Key rules derived from native components

- **Every property must have `"title"`** — it is the CMS editor label.
- **Use `"default"` generously** — provide sensible defaults so editors start with a working section.
- **`"description"` on a property** is optional but recommended when the field is not self-explanatory (e.g. ProductShelf → `after`: `"Initial pagination item"`).
- **Enums always use both `"enum"` and `"enumNames"`** — even when the display name matches the value. The arrays must have the same length and order.
- **Nested objects with required inner fields** place the `"required"` array inside the object definition, not at the root level.
- **No trailing commas in JSON** — although `.jsonc` tolerates them, the native components do **not** use trailing commas. Follow the same style.
- **`"type"` is always explicit** on every property, including nested objects and array items.

### Complete annotated example (following native style)

```jsonc
{
  "$extends": ["#/$defs/base-component"],
  "$componentKey": "PromoBanner",
  "$componentTitle": "Promo Banner",
  "title": "Promo Banner",
  "description": "Display a promotional banner with image and call to action",
  "type": "object",
  "required": ["title", "image"],
  "properties": {
    "title": {
      "title": "Title",
      "type": "string",
    },
    "subtitle": {
      "title": "Subtitle",
      "type": "string",
    },
    "image": {
      "title": "Image",
      "type": "object",
      "properties": {
        "src": {
          "title": "Image",
          "type": "string",
          "widget": {
            "ui:widget": "media-gallery",
            "restrictMediaTypes": {
              "video": true,
              "image": ["png", "jpg", "jpeg", "gif", "svg", "webp"],
            },
          },
        },
        "alt": {
          "title": "Alternative Label",
          "type": "string",
        },
      },
    },
    "link": {
      "title": "Call to Action",
      "type": "object",
      "required": ["text", "url"],
      "properties": {
        "text": {
          "title": "Text",
          "type": "string",
        },
        "url": {
          "title": "URL",
          "type": "string",
        },
        "linkTargetBlank": {
          "title": "Open link in new window?",
          "type": "boolean",
          "default": false,
        },
      },
    },
    "colorVariant": {
      "title": "Color variant",
      "type": "string",
      "enumNames": ["Main", "Light", "Accent"],
      "enum": ["main", "light", "accent"],
    },
    "showBadge": {
      "title": "Show discount badge?",
      "type": "boolean",
      "default": true,
    },
    "items": {
      "title": "Highlight Items",
      "type": "array",
      "minItems": 1,
      "maxItems": 4,
      "items": {
        "title": "Item",
        "type": "object",
        "required": ["label"],
        "properties": {
          "label": {
            "title": "Label",
            "type": "string",
          },
          "icon": {
            "title": "Icon",
            "type": "string",
            "enumNames": ["Truck", "Gift", "Shield Check"],
            "enum": ["Truck", "Gift", "ShieldCheck"],
          },
        },
      },
    },
  },
}
```

## Mandatory Workflow for New Custom Sections

Follow this EXACT sequence. Do NOT skip steps.

### Phase 1: Planning (BEFORE writing code)

- [ ] Check if similar component exists: `ls src/components/`
- [ ] Verify CMS schema names: `ls cms/faststore/components/`
- [ ] Choose unique component name (PascalCase)

### Phase 2: Component Creation

- [ ] Create folder: `mkdir -p src/components/sections/<Name>` (or `src/components/<Name>/` for non-section sub-components)
- [ ] Create React component at `src/components/sections/<Name>/<Name>.tsx` with TypeScript interfaces
  - The root element MUST be `<section className={\`section ${styles.mySection}\`}>`—`section` class always comes first
  - Immediately inside the `<section>`, add `<div className="layout__content">` to wrap all content
- [ ] Create styles at `src/components/sections/<Name>/<name>.module.scss`
  - Wrap all styles in a single class
  - Import as CSS module in the component
  - If the section uses `@faststore/ui` components, **import their stylesheets manually** in the `.module.scss`
- [ ] **RUN LINTER**: `ReadLints` on new files
- [ ] **FIX ALL ERRORS** before proceeding

### Phase 3: CMS Schema & Registration

- [ ] Create JSONC schema at `cms/faststore/components/cms_component__<Name>.jsonc` following the [Native Component Pattern Reference](#native-component-pattern-reference)
- [ ] Verify `$componentKey` matches exactly
- [ ] Register in `src/components/index.tsx` with an object key **identical** to `$componentKey`
- [ ] **RUN LINTER** on `index.tsx`

### Phase 4: Schema Management (SAME SESSION)

- [ ] Generate: `vtex content generate-schema -o cms/faststore/schema.json  `
- [ ] Verify: `grep -A 5 '"<ComponentName>"' cms/faststore/schema.json` (search for the `$componentKey` string)
  - If it does not appear, fix JSONC or registration — **do not** edit `schema.json` manually
- [ ] **Account check** (before upload): read `api.storeId` from `discovery.config.js` and run `vtex whoami` — confirm both match. If they differ, ask the user to run `vtex login <correct-account>` and **stop**.
- [ ] **Ask the user**: _"The schema will be uploaded to account **`<store-id>`**. Do you want to proceed?"_ — wait for confirmation before continuing.
- [ ] Upload: `vtex content upload-schema cms/faststore/schema.json` (**required** — without upload, the CMS editor will not see new or updated section definitions)
- [ ] Confirm upload success message

### Phase 5: Validation & Deployment

- [ ] No linter errors remain
- [ ] Schema uploaded successfully
- [ ] Component key appears in `schema.json`
- [ ] Add the section to the desired page via **Admin → Storefront → Content** (unless your project relies on `pages/*.jsonc` and your team's publish process covers composition)
- [ ] Document usage (optional but recommended)

**🛑 STOP at first error. Fix before proceeding.**

## Section Scopes

Sections can be scoped to specific page types using `"requiredScopes"`:

```json
{
  "$extends": ["#/$defs/base-component"],
  "$componentKey": "QuickFilter",
  "$componentTitle": "QuickFilter",
  "requiredScopes": ["plp", "search"],
  "type": "object",
  "description": "Quick Filter section for search pages",
  "required": [],
  "properties": {}
}
```

## Section registration ≠ Section rendering

**`upload-schema` registers** section **definitions** in Headless CMS (they show up in the editor palette). That is **not** the same as placing the section on the home page or another route.

To **render** a new section on a page (typical case):

1. Go to **Admin → Storefront → Content** (e.g. "All content")
2. Select the page type (e.g., Home, Product List Page)
3. Add the section to that page's layout
4. Save and publish

If your project uses **`cms/faststore/pages/*.jsonc`** to version page composition, follow that policy — otherwise assume **Content** in Admin is where the section gets onto the live page.

In dev mode, page content still comes from the CMS API. If the section is registered in the editor but missing on the storefront, it often was never **added** to that page's content (or not published).

## End-to-end agent workflow

Assume **VTEX CLI is installed globally** — invoke `vtex` directly (not `npx vtex`).

From the **project root**:

1. **Generate** (canonical command — matches the storefront skill):

```bash
vtex content generate-schema -o cms/faststore/schema.json  
```

2. **Validate** — for new or renamed sections, grep or read `cms/faststore/schema.json` and confirm the `"$componentKey"` is present.

3. **Upload** (mandatory for the CMS to pick up schema changes):

```bash
vtex content upload-schema cms/faststore/schema.json
```

The store ID you enter at prompts should match `api.storeId` in `discovery.config.js`.

### Pre-upload account verification (MANDATORY)

**Before every `upload-schema` execution**, the agent **must** verify that the currently logged-in VTEX account matches the project's target store. Uploading to the wrong account overwrites CMS schema in the wrong store — **this is not reversible without manual intervention**.

**Steps:**

1. **Read the expected store ID** from the project config:

```bash
node -e "console.log(require('./discovery.config.js').api.storeId)"
```

2. **Read the currently logged-in account** from the VTEX CLI:

```bash
vtex whoami
```

The output includes the account name (e.g. `Logged into account: mystore`). Extract the account name.

3. **Compare** the two values. If they **do not match**, stop immediately and tell the user:

> ⚠️ The VTEX CLI is logged into account **`<logged-account>`**, but `discovery.config.js` has `api.storeId` set to **`<expected-store-id>`**. Please run `vtex login <expected-store-id>` or switch to the correct account before uploading.

**Do not** proceed with upload-schema until the accounts match.

4. **Even when accounts match**, the agent **must ask the user for explicit confirmation** before uploading:

> The schema will be uploaded to account **`<store-id>`**. Do you want to proceed? (yes/no)

Wait for the user's response. **Only proceed if the user confirms.**

### Non-interactive upload (automatic - USE ONLY AFTER ACCOUNT VERIFICATION)

When uploading schema in an automated workflow, ALWAYS use `expect` to handle prompts automatically. **This block must only run after the pre-upload account verification above has passed and the user has confirmed.**

```bash
# Export store ID from discovery.config.js
export STORE_ID=$(node -e "console.log(require('./discovery.config.js').api.storeId)")

# Run upload with expect to auto-answer prompts
# IMPORTANT: use single quotes so Tcl does not misinterpret $ tokens
# (e.g. $id) that appear in CLI output. $env(STORE_ID) is Tcl syntax
# evaluated by the Tcl interpreter, not by bash.
expect -c '
  spawn vtex content upload-schema cms/faststore/schema.json
  expect "store ID"
  send "faststore\r"
  expect -re "uploaded|confirm"
  send "y\r"
  expect -re "Are you sure|confirm"
  send "y\r"
  expect eof
' 2>&1
```

**Never use double quotes** around the `expect -c` argument — CLI output often contains `$id` and other `$`-prefixed tokens that Tcl interprets as variable references inside double-quoted strings, causing `can't read "id": no such variable` errors. Single quotes pass the script literally to Tcl, where `$env(STORE_ID)` is evaluated correctly by the Tcl interpreter.

**Agents must** report the **exact** prompt or error if login, workspace, store ID, or confirmation blocks upload, and tell the human the next step (`vtex login`, correct account, etc.).

Without **`upload-schema`**, new or updated sections **will not** appear in the Headless CMS editor.

## Important: CMS Sections Only Receive CMS-Defined Props

CMS sections receive props from the schema `properties` defined in their `.jsonc` file —
these are the fields the editor fills in the CMS admin.

**Do NOT** expect sections to receive props passed programmatically from parent
page components. If a section needs data beyond what the CMS editor provides
(e.g., product data, search results), it must read from:

- Page context hooks (`usePDP()`, `usePLP()`, `usePage()`, etc.)
- Custom GraphQL queries via `useQuery` / `useLazyQuery`
