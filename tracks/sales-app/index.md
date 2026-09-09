# Sales App Track

Extension development for VTEX Sales App, the in-store assisted selling application. This track covers the complete lifecycle of building Sales App extensions — from prerequisites and discovery through code generation, validation, and deployment.

## Skill

| Skill | Description |
|-------|-------------|
| **[sales-app-extensibility](skills/sales-app-extensibility/skill.md)** | Complete 6-step workflow for building Sales App extensions — extension points (cart, PDP, menu), React hooks (useCart, usePDP, useCartItem, useCurrentUser, useExtension), TypeScript types, API integration patterns, code generation, validation, and deployment. |

## Key Constraints

- **Always check prerequisites first** — FastStore and Sales App module must be installed before any work.
- **Never skip discovery** — identify the use case and extension point before generating code.
- **Components must return JSX.Element, never null** — `defineExtensions` requires `ExtensionPointComponent` which does not accept null.
- **Never expose auth keys in frontend code** — use a VTEX IO proxy app for secure API integration.
- **IO Proxy must use relative paths only** — the Sales App internal proxy resolves domains automatically.
- **Always present the execution plan and wait for approval** before generating code.

## Related Tracks

- [FastStore Implementation](../faststore/index.md) — storefront customization outside Sales App.
- [Custom VTEX IO Apps](../vtex-io/index.md) — building IO proxy apps for secure API integration.
- [Payment Connector Development](../payment/index.md) — for in-store card-on-terminal payments, use [`payment-ppp-pos`](../payment/skills/payment-ppp-pos/skill.md). This Sales App track covers UI extensions, not POS connectors.
