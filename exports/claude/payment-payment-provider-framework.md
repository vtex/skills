This skill provides guidance for AI agents working with VTEX Payment Connector Development. Apply these constraints and patterns when assisting developers with apply when designing or implementing a payment connector in vtex io. covers ppf implementation, typescript 3.9.7 builder-hub constraints and safe dependency resolutions, configuration.json schema validation, paymentproviderservice clients wiring, secure proxy scope (authorize-only), externalclient vs secureexternalclient patterns, iocontext access, ppf response helpers, psp integration checklist, and vtex link debugging. use for any implementation of a payment connector hosted in vtex io.

# Payment Provider Framework (VTEX IO)

## When this skill applies

Use this skill when:
- Creating or maintaining a payment connector implemented as a VTEX IO app (not a standalone HTTP service you host yourself)
- Wiring `@vtex/payment-provider`, `PaymentProvider`, and `PaymentProviderService` in `node/index.ts`
- Configuring the `paymentProvider` builder, `configuration.json` (payment methods, `customFields`, feature flags)
- Implementing `this.retry(request)` for Gateway retry semantics on IO
- Extending `SecureExternalClient` and passing `secureProxy` on requests for card flows on IO
- Testing via payment affiliation, workspaces, beta/stable releases, the VTEX App Store, and VTEX homologation

Do not use this skill for:
- PPP HTTP contracts, response field-by-field requirements, and the nine endpoints in the abstract — use [`payment-provider-protocol`](../payment-provider-protocol/skill.md)
- Idempotency and duplicate `paymentId` handling — use [`payment-idempotency`](../payment-idempotency/skill.md)
- Async `undefined` status, `callbackUrl` notification vs retry (IO vs non-IO) — use [`payment-async-flow`](../payment-async-flow/skill.md)
- PCI rules, logging, and token semantics beyond IO wiring — use [`payment-pci-security`](../payment-pci-security/skill.md)
- POS / Sales App card-present overlay (`Venda Direta` methods, Payment Apps, terminal serial) — use [`payment-ppp-pos`](../payment-ppp-pos/skill.md) together with this skill

## Decision rules

- **PPF on IO**: "Payment Provider Framework is the VTEX IO–based way to build payment connectors." The app uses IO infrastructure; API routes, request/response types, and Secure Proxy are integrated per VTEX guides. Start from the example app described in the official Payment Provider Framework documentation.
- **Prerequisites**: Follow implementation prerequisites in the Payment Provider Protocol article and the guide on integrating a new payment provider on VTEX.
- **Dependencies**: In the app `node` folder, add `@vtex/payment-provider` (for example `1.x` in `package.json`). Keep `@vtex/api` in `devDependencies` (for example `6.x`); linking may bump it beyond `6.x`, which is acceptable. If types break, delete `node_modules` and `yarn.lock` in the project root and in `node`, then run `yarn install -f` in both.
- **`paymentProvider` builder**: In `manifest.json`, include `"paymentProvider": "1.x"` next to `node` so policies for Payment Gateway callbacks and PPP routes apply.
- **`configuration.json`**: Declare `paymentMethods` so the builder can implement them without re-declaring everything on `/manifest`. Use names matching the List Payment Provider Manifest API reference; only invent a new name when the method is genuinely new. New methods in Admin may require a support ticket.
- **`PaymentProvider`**: One class method per PPP route; TypeScript enforces shapes — see Payment Flow endpoints in the API reference.
- **`PaymentProviderService`**: Registers default routes `/manifest`, `/payments`, `/settlements`, `/refunds`, `/cancellations`, `/inbound`; pass extra `routes` / `clients` when needed.
- **Overriding `/manifest`**: Only with an approved use case — open a ticket. See the Preferred pattern section for an example route override shape.
- **Configurable options**: Use `configuration.json` / builder options for flags such as `implementsOAuth`, `implementsSplit`, `usesProviderHeadersName`, `usesBankInvoiceEnglishName`, `usesSecureProxy`, `requiresDocument`, `acceptSplitPartialRefund`, `usesAutoSettleOptions`. Set `name` and rely on auto-generated `serviceUrl` on IO unless documented otherwise. **Do not invent fields** — unknown keys (such as `usesTestSuite`) cause builder validation errors. See the "configuration.json schema" constraint below for the canonical list and `customFields` format.
- **Gateway retry**: In PPF, call `this.retry(request)` where the protocol requires retry — see the Payment authorization section in the PPP article.
- **Card data on IO**: "Prefer `SecureExternalClient` with `secureProxy: secureProxyUrl` from Create Payment; destination must be allowlisted." Supported `Content-Type` values for Secure Proxy: `application/json` and `application/x-www-form-urlencoded` only. **Important:** only the Create Payment (authorize) request carries `secureProxyUrl`. Post-authorization operations (cancel, capture, refund) do not transport card data and must call the PSP API directly via `ExternalClient` with credentials and `outbound-access` policies.
- **Checkout testing**: Account must be allowed for IO connectors (ticket with app name and account). Publish beta, install on `master`, wait ~1 hour, open affiliation URL, enable test mode and workspace, configure payment condition (~10 minutes), place test order; then stable + homologation.
- **Publication**: Configure `billingOptions` per the Billing Options guide; submit via Submitting your app. Prepare homologation artifacts (connector app name, partner contact, production endpoint, allowed accounts, new methods/flows) per the Integrating a new payment provider on VTEX guide (SLA often ~30 days).
- **Updates**: Ship changes in a new beta, re-test affiliations, then stable; re-homologate if required.

## Hard constraints

### Constraint: Builder-Hub uses TypeScript 3.9.7 — code and dependencies MUST be compatible

The `vtex.builder-hub` compiles IO apps with **TypeScript 3.9.7**. It also **ignores `skipLibCheck: true`** in `tsconfig.json` — every `.d.ts` file in `node_modules` is type-checked. This means that even if your own code is valid, a transitive dependency shipping modern `.d.ts` syntax will break the build with hundreds of errors unrelated to your code.

**Why this matters**

Agents and developers regularly produce code with TS 4.x+ syntax or install the latest `@types/*` packages. The build fails with cryptic errors in files the developer never touched, causing many wasted iterations.

**Prohibited syntax (incompatible with TS 3.9.7)**

| Syntax | Minimum TS version | Example |
|---|---|---|
| Template literal types | 4.1 | `` type X = `${string}/${string}` `` |
| Typed catch clause | 4.0 | `catch (error: any)` |
| `override` keyword | 4.3 | `override method()` in classes |
| `import type ... = require()` | 4.5 | `import type X = require("pkg")` |
| `satisfies` operator | 4.9 | `obj satisfies Type` |

**Correct catch block pattern**

```typescript
// CORRECT — TS 3.9.7 compatible
try {
  // ...
} catch (error) {
  const err = error as any
  console.log(err.message)
}

// WRONG — TS 4.0+ only
try {
  // ...
} catch (error: any) {
  console.log(error.message)
}
```

**Unused variables are errors, not warnings.** The builder-hub treats declared-but-unused variables as compilation errors. Avoid destructuring fields you do not use:

```typescript
// WRONG — if callbackUrl is not used, build fails
const { paymentId, callbackUrl, value } = authorization

// CORRECT
const { paymentId, value } = authorization
```

**Safe dependency versions (compatible with TS 3.9.7)**

Use `resolutions` in `node/package.json` to pin transitive dependencies to versions that do not ship modern `.d.ts` syntax. The `**/<package>` pattern pins nested copies too.

```json
{
  "dependencies": {
    "@vtex/payment-provider": "1.x"
  },
  "devDependencies": {
    "@vtex/api": "6.50.1",
    "@types/node": "12.20.55",
    "@types/express-serve-static-core": "4.17.2",
    "@types/express": "4.17.10",
    "@types/serve-static": "1.15.0",
    "@opentelemetry/api": "1.0.4",
    "typescript": "3.9.7"
  },
  "resolutions": {
    "@types/node": "12.20.55",
    "@types/express-serve-static-core": "4.17.2",
    "@types/express": "4.17.10",
    "@types/serve-static": "1.15.0",
    "@opentelemetry/api": "1.0.4",
    "**/@types/express-serve-static-core": "4.17.2",
    "**/@types/koa": "2.15.0"
  }
}
```

| Package | Safe version | First broken version | Reason |
|---|---|---|---|
| `@types/node` | `12.20.55` | `13.x+` (some APIs) | Modern syntax in `.d.ts` |
| `@types/express-serve-static-core` | `4.17.2` | `4.17.13+` | Template literal types |
| `@types/express` | `4.17.10` | `4.17.11+` | Depends on `@types/express-serve-static-core@^4.17.18` |
| `@types/koa` | `2.15.0` | `3.x` | `import type ... = require()` |
| `@opentelemetry/api` | `1.0.4` | Newer versions | TS 4.x syntax |
| `@types/serve-static` | `1.15.0` | Newer versions | Transitive dependency issues |

**Diagnosing new broken packages:** if the build fails with errors in `.d.ts` files from `node_modules`, identify the package from the error path, test older versions until you find one without modern syntax, and add it to both `devDependencies` and `resolutions` (with `**/<package>` pattern).

**Detection**

If the generated code uses any syntax from the table above, or if `package.json` lacks `resolutions` for type packages, STOP and fix before attempting `vtex link`.

### Constraint: `configuration.json` must use only valid schema fields and correct `customFields` format

The `paymentProvider` builder validates `configuration.json` against a strict schema. Unknown fields cause build errors. The `customFields[].options` array for `select` type fields must use `text` and `value` keys — never `label`.

**Why this matters**

Invalid fields like `usesTestSuite` or `useAntifraud` (if not in the current schema) cause immediate `vtex link` failure. Using `label` instead of `text` in select options silently breaks the Admin UI or fails validation.

**Canonical fields** (verify against current VTEX documentation):

`name` (required), `serviceUrl` (auto on IO), `implementsOAuth`, `implementsSplit`, `usesProviderHeadersName`, `usesBankInvoiceEnglishName`, `usesSecureProxy`, `requiresDocument`, `acceptSplitPartialRefund`, `usesAutoSettleOptions`, `paymentMethods`, `customFields`.

**Fields known to break the build:** `usesTestSuite` (does not exist in the schema).

**Correct customFields with select**

```json
{
  "name": "AcmePayConnector",
  "usesAutoSettleOptions": true,
  "paymentMethods": [
    { "name": "Visa", "allowsSplit": "onCapture" }
  ],
  "customFields": [
    {
      "name": "Environment",
      "type": "select",
      "options": [
        { "text": "Sandbox", "value": "sandbox" },
        { "text": "Production", "value": "production" }
      ]
    }
  ]
}
```

**Wrong customFields**

```json
{
  "customFields": [
    {
      "name": "Environment",
      "type": "select",
      "options": [
        { "label": "Sandbox", "value": "sandbox" }
      ]
    }
  ]
}
```

**Detection**

If `configuration.json` contains keys not in the canonical list, or uses `label` instead of `text` in select options, STOP and fix before build.

### Constraint: Declare the `paymentProvider` builder and a real connector identity in `configuration.json`

IO connectors MUST include the `paymentProvider` builder in `manifest.json` and a `paymentProvider/configuration.json` with a non-placeholder `name` and accurate `paymentMethods`. Do not ship the literal placeholder `"MyConnector"` (or equivalent) as production configuration.

**Why this matters**

Without the builder, PPP routes and Gateway policies are not wired. A placeholder name breaks Admin, affiliations, and homologation.

**Detection**

If `manifest.json` lacks `paymentProvider`, or `configuration.json` still uses example placeholder names, stop and fix before publishing.

**Correct**

```json
{
  "name": "PartnerAcmeCard",
  "paymentMethods": [
    { "name": "Visa", "allowsSplit": "onCapture" },
    { "name": "BankInvoice", "allowsSplit": "onAuthorize" }
  ]
}
```

**Wrong**

```json
{
  "name": "MyConnector",
  "paymentMethods": []
}
```

### Constraint: Register PPP routes only through `PaymentProviderService` with a `PaymentProvider` implementation

The service MUST wrap a class extending `PaymentProvider` from `@vtex/payment-provider` so standard PPP paths are registered. Do not hand-roll the same route surface without the package unless VTEX explicitly prescribes an alternative.

**Why this matters**

Missed or mismatched routes break Gateway calls and homologation; the package keeps handlers aligned with the protocol.

**Detection**

If `node/index.ts` exposes PPP paths manually and does not instantiate `PaymentProviderService` with the connector class, reconcile with the documented pattern.

**Correct**

```typescript
import { PaymentProviderService } from "@vtex/payment-provider";
import { YourPaymentConnector } from "./connector";

export default new PaymentProviderService({
  connector: YourPaymentConnector,
});
```

**Wrong**

```typescript
// Ad-hoc router only — no PaymentProviderService / PaymentProvider base
export default someCustomRouterWithoutPPPPackage;
```

### Constraint: `PaymentProviderService` `clients` field requires `{ implementation, options }` — not the class directly

When passing custom `IOClients` to `PaymentProviderService`, the `clients` field expects an object with `implementation` (the class) and `options` (retry/timeout config), following the `ServiceConfig` interface from `@vtex/api`. Passing the class directly causes a runtime error.

**Why this matters**

This is a common mistake that produces a confusing runtime error instead of a clear type error, since the PPF types may not enforce this strictly.

**Correct**

```typescript
import { PaymentProviderService } from '@vtex/payment-provider'
import MyConnector from './connector'
import { Clients } from './clients'

export default new PaymentProviderService({
  connector: MyConnector,
  clients: {
    implementation: Clients,
    options: {
      default: {
        retries: 2,
        timeout: 15000,
      },
    },
  },
})
```

**Wrong**

```typescript
export default new PaymentProviderService({
  connector: MyConnector,
  clients: Clients,  // WRONG — expects { implementation, options }
})
```

### Constraint: Use `this.retry(request)` for Gateway retry on IO

Where the PPP flow requires retry semantics on IO, handlers MUST invoke `this.retry(request)` as specified in the protocol — not a custom retry helper that bypasses the framework.

**Why this matters**

"The Gateway expects framework-driven retry behavior; omitting it causes inconsistent authorization and settlement behavior."

**Detection**

Search payment handlers for protocol retry cases; if retries are implemented without `this.retry`, fix before release.

**Correct**

```typescript
// Inside a PaymentProvider subclass method, when the protocol requires retry:
return this.retry(request);
```

**Wrong**

```typescript
// Re-implementing gateway retry with setTimeout/fetch instead of this.retry
await fetch(callbackUrl, { method: "POST", body: JSON.stringify(payload) });
```

### Constraint: Forward card authorization calls through Secure Proxy on IO with allowlisted destinations

For card flows on IO with `usesSecureProxy` behavior, proxied HTTP calls MUST go through `SecureExternalClient` (or equivalent VTEX pattern), MUST pass `secureProxy` set to the `secureProxyUrl` from the payment request, and MUST target a VTEX-allowlisted PCI endpoint. Only `application/json` or `application/x-www-form-urlencoded` bodies are supported. If `usesSecureProxy` is false, the provider must be PCI-certified and supply AOC for `serviceUrl` per VTEX.

**Why this matters**

"Skipping Secure Proxy or wrong content types breaks PCI scope, proxy validation, or acquirer integration — blocking homologation or exposing card data incorrectly."

**Detection**

Inspect client code for POSTs that include card tokens without `secureProxy` in the request config, or destinations not registered with VTEX.

**Correct**

```typescript
import { SecureExternalClient, CardAuthorization } from "@vtex/payment-provider";
import type { InstanceOptions, IOContext, RequestConfig } from "@vtex/api";

export class MyPCICertifiedClient extends SecureExternalClient {
  constructor(protected context: IOContext, options?: InstanceOptions) {
    super("https://pci-certified.example.com", context, options);
  }

  public authorize = (cardRequest: CardAuthorization) =>
    this.http.post(
      "authorize",
      {
        holder: cardRequest.holderToken,
        number: cardRequest.numberToken,
        expiration: cardRequest.expiration,
        csc: cardRequest.cscToken,
      },
      {
        headers: { Authorization: "Bearer ..." },
        secureProxy: cardRequest.secureProxyUrl,
      } as RequestConfig
    );
}
```

**Wrong**

```typescript
// Direct outbound call with raw card fields and no secureProxy
await http.post("https://acquirer.example/pay", { pan, cvv, expiry });
```

### Constraint: Only Create Payment receives `secureProxyUrl` — post-auth operations call the PSP directly

The `secureProxyUrl` field is present **only in the Create Payment (authorize) request**. Cancel, capture, and refund operations do not carry card data and do not receive `secureProxyUrl`. These operations must call the PSP API directly using an `ExternalClient` (from `@vtex/api`) with API credentials, protected by `outbound-access` policies in `manifest.json`.

**Why this matters**

Attempting to use `SecureExternalClient` or `secureProxyUrl` in cancel/capture/refund handlers will fail because the field is `undefined` in those requests. This is not a PCI concern — these operations only reference transaction IDs, not card data.

**Detection**

If cancel, capture, or refund handlers reference `secureProxyUrl` or use `SecureExternalClient`, STOP. These must use `ExternalClient` with direct HTTP calls to the PSP.

**Correct — two client pattern**

```typescript
// clients/pspSecure.ts — for authorization only (via Secure Proxy)
import { SecureExternalClient } from "@vtex/payment-provider";
import type { InstanceOptions, IOContext } from "@vtex/api";

export class PspSecureClient extends SecureExternalClient {
  constructor(ctx: IOContext, opts?: InstanceOptions) {
    super("https://api.psp.com", ctx, opts);
  }

  public async authorize(data: object, secureProxyUrl: string) {
    return this.http.post("/v1/payments", data, {
      secureProxy: secureProxyUrl,
    } as any)
  }
}

// clients/psp.ts — for cancel, capture, refund (direct calls)
import { ExternalClient } from "@vtex/api";
import type { InstanceOptions, IOContext } from "@vtex/api";

export class PspClient extends ExternalClient {
  constructor(ctx: IOContext, opts?: InstanceOptions) {
    super("https://api.psp.com", ctx, opts);
  }

  public async capture(transactionId: string, amount: number) {
    return this.http.post(`/v1/payments/${transactionId}/capture`, { amount })
  }

  public async cancel(transactionId: string) {
    return this.http.post(`/v1/payments/${transactionId}/cancel`, {})
  }

  public async refund(transactionId: string, amount: number) {
    return this.http.post(`/v1/payments/${transactionId}/refund`, { amount })
  }
}
```

**Wrong**

```typescript
// WRONG — trying to use SecureExternalClient for capture
async settle(settlement: SettlementRequest) {
  const client = this.context.clients.pspSecure as PspSecureClient
  // secureProxyUrl is undefined here — this will fail
  await client.capture(settlement.tid, settlement.value, settlement.secureProxyUrl)
}
```

### Constraint: Do not access `.http` on client instances from outside the client class

The `http` property on `ExternalClient` and `SecureExternalClient` is `protected`. Calling `client.http.post(...)` from the `PaymentProvider` subclass causes a TypeScript compilation error in the builder-hub.

**Why this matters**

This is a frequent mistake when developers try to make HTTP calls from the connector class instead of through the client's public methods. The builder-hub enforces `protected` access and fails the build.

**Detection**

If the connector code accesses `.http` on a client instance (e.g., `this.context.clients.myClient.http.post(...)`), STOP. Expose a public method in the client subclass instead.

**Correct**

```typescript
// Inside the client class — this.http is accessible (protected = same class)
export class PspClient extends ExternalClient {
  public async capturePayment(tid: string, amount: number) {
    return this.http.post(`/v1/payments/${tid}/capture`, { amount })
  }
}

// Inside the connector — call the public method
async settle(settlement: SettlementRequest) {
  const clients = this.context.clients as any as { psp: PspClient }
  return clients.psp.capturePayment(settlement.tid, settlement.value)
}
```

**Wrong**

```typescript
// Inside the connector — .http is protected, build fails
async settle(settlement: SettlementRequest) {
  const clients = this.context.clients as any as { psp: PspClient }
  return clients.psp.http.post(`/v1/capture`, { amount: settlement.value })
  //                  ^^^^ TS error: Property 'http' is protected
}
```

## Preferred pattern

### Project file structure

```text
/
├── manifest.json                          # App identity, builders, policies
├── paymentProvider/
│   └── configuration.json                 # Payment methods, connector options
├── service.json                           # Runtime config (memory, timeout, replicas, custom routes)
└── node/
    ├── package.json                       # Dependencies WITH resolutions for TS 3.9.7
    ├── tsconfig.json                      # TypeScript config (skipLibCheck ignored by builder)
    ├── yarn.lock                          # REQUIRED — builder rejects build without it
    ├── index.ts                           # Entry point: exports PaymentProviderService
    ├── connector.ts                       # Class extending PaymentProvider
    ├── clients/
    │   ├── index.ts                       # IOClients with getOrSet
    │   ├── psp.ts                         # ExternalClient for direct PSP calls (cancel/capture/refund)
    │   └── pspSecure.ts                   # SecureExternalClient for card authorization via Secure Proxy
    └── typings/
        └── psp.ts                         # TypeScript interfaces
```

**Critical file notes:**
- **`yarn.lock`** in `node/` is **required** — the builder rejects the build without it. Do not add it to `.vtexignore`.
- **`service.json`** goes in the **project root**, not inside `node/`.
- **`configuration.json`** goes inside `paymentProvider/`, not in the root.

### `manifest.json` builders and policies

```json
{
  "builders": {
    "node": "7.x",
    "paymentProvider": "1.x"
  },
  "policies": [
    { "name": "vbase-read-write" },
    { "name": "outbound-access", "attrs": { "host": "api.psp.com", "path": "/*" } },
    { "name": "outbound-access", "attrs": { "host": "api.sandbox.psp.com", "path": "/*" } }
  ]
}
```

Note: `vbase-read-write` policy is required if you use VBase for state storage. Without it, `vbase.saveJSON()` returns 403.

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "es2019",
    "module": "commonjs",
    "lib": ["es2019"],
    "outDir": "./dist",
    "rootDir": ".",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "**/node_modules", "dist"]
}
```

Note: the builder-hub overrides `outDir`, `rootDir`, and `paths` with its own values. **`skipLibCheck: true` is ignored** — all `.d.ts` files are checked. Use `resolutions` in `package.json` to control dependency type versions instead.

### IOClients registration

```typescript
import { IOClients } from '@vtex/api'
import { PspClient } from './psp'
import { PspSecureClient } from './pspSecure'

export class Clients extends IOClients {
  public get psp(): PspClient {
    return this.getOrSet('psp', PspClient)
  }

  public get pspSecure(): PspSecureClient {
    return this.getOrSet('pspSecure', PspSecureClient)
  }
}
```

### Accessing custom clients and IOContext in the connector

```typescript
import { PaymentProvider } from '@vtex/payment-provider'
import type { Clients } from './clients'

export default class MyConnector extends PaymentProvider {
  // IOContext is at this.context.vtex, NOT this.context directly
  private get account(): string {
    const vtexCtx = (this.context as any).vtex as { account: string; workspace: string }
    return vtexCtx?.account || ''
  }

  private get workspace(): string {
    const vtexCtx = (this.context as any).vtex as { account: string; workspace: string }
    return vtexCtx?.workspace || 'master'
  }

  // Custom clients require a cast
  private get clients() {
    return this.context.clients as any as {
      psp: Clients['psp']
      pspSecure: Clients['pspSecure']
      vbase: import('@vtex/api').VBase
    }
  }

  // VBase is available directly
  private get vbase() {
    return this.context.clients.vbase
  }
}
```

### PaymentProviderService with clients, custom routes, and service.json

```typescript
// node/index.ts
import { PaymentProviderService } from '@vtex/payment-provider'
import MyConnector from './connector'
import { Clients } from './clients'

export default new PaymentProviderService({
  connector: MyConnector,
  clients: {
    implementation: Clients,
    options: {
      default: {
        retries: 2,
        timeout: 15000,
      },
    },
  },
  // Optional: custom routes (e.g., for redirect callbacks)
  // routes: {
  //   myCallback: myCallbackHandler,
  // },
})
```

When using custom routes, register them in `service.json` at the project root:

```json
{
  "memory": 256,
  "ttl": 10,
  "timeout": 10,
  "minReplicas": 2,
  "maxReplicas": 10,
  "routes": {
    "myCallback": {
      "path": "/_v/my-connector/callback",
      "public": true
    }
  }
}
```

The PPF builder merges its own routes (PPP endpoints) with yours — you do not need to re-declare the standard PPP routes.

### Credentials via affiliation

The PPF maps affiliation headers to connector properties automatically:

| VTEX Header | Connector Property | Typical Use |
|---|---|---|
| `X-PROVIDER-API-AppKey` | `this.apiKey` | PSP Client ID / API Key |
| `X-PROVIDER-API-AppToken` | `this.appToken` | PSP Client Secret / API Token |

`this.isTestSuite` indicates whether the transaction is a test (sandbox).

Custom settings from `customFields` in `configuration.json` are available via the authorization object in each request (the exact access pattern depends on the PPF version — check the types in `@vtex/payment-provider`).

### PPF response helpers — what each helper fills automatically

When using `Authorizations`, `Settlements`, and `Refunds` helpers from `@vtex/payment-provider`:

| Helper | Auto-filled from request | Do NOT pass in second argument |
|---|---|---|
| `Authorizations.approve(auth, { ... })` | `paymentId` | — |
| `Authorizations.deny(auth, { ... })` | `paymentId` | `nsu` (not part of deny type) |
| `Settlements.approve(settle, { settleId })` | `paymentId`, `value` | `value` (already merged from request) |
| `Refunds.approve(refund, { refundId })` | `paymentId`, `value` | `value` (already merged from request) |

To add `delayToCancel` with `approveCard` when the strict type omits it, use a spread with type assertion:

```typescript
// TS 3.9.7 compatible
const baseResponse = Authorizations.approve(authorization, {
  authorizationId: result.authorizationId,
  nsu: result.nsu,
  tid: result.tid,
  acquirer: 'MyPSP',
  code: '200',
  message: 'Approved',
})
const response = {
  ...baseResponse,
  delayToCancel: 21600,
  delayToAutoSettle: 21600,
  delayToAutoSettleAfterAntifraud: 1800,
} as any
return response
```

### PSP integration checklist (provider-agnostic)

Before wiring the PSP client:
1. Open the PSP's **API Explorer / OpenAPI spec** and identify the **base URL per environment** (test/live).
2. Do not **duplicate** version or path segments between `baseURL` and the operation path (e.g., if the base is `https://checkout-test.psp.com/v71`, the path for payments is `/payments`, not `/v71/payments`).
3. Validate with a test call (e.g., create payment) before closing the connector implementation.
4. If the PSP requires an OAuth token, implement **in-memory caching** of the access token — the VTEX Gateway has a **2-second timeout** on some flows and sequential token + API calls will exceed it.

```typescript
// Simple in-memory token cache (TS 3.9.7 compatible)
const tokenCache: Record<string, { token: string; expiresAt: number }> = {}

function getCachedToken(clientId: string): string | null {
  const entry = tokenCache[clientId]
  if (entry && Date.now() < entry.expiresAt) return entry.token
  return null
}

function setCachedToken(clientId: string, token: string, expiresIn: number): void {
  tokenCache[clientId] = {
    token,
    expiresAt: Date.now() + (expiresIn - 300) * 1000,
  }
}
```

### Affiliation URL pattern for testing

```text
https://{account}.myvtex.com/admin/affiliations/connector/Vtex.PaymentGateway.Connectors.PaymentProvider.PaymentProviderConnector_{connector-name}/
```

Replace `{connector-name}` with `${vendor}-${appName}-${appMajor}` (example: `vtex-payment-provider-example-v1`).

Testing flow summary: publish beta (for example `vendor.app@0.1.0-beta` — see Making your app publicly available documentation), install on `master`, wait ~1 hour, open affiliation, under **Payment Control** enable **Enable test mode** and set **Workspace** (often `master`), add a payment condition, wait ~10 minutes, place order; then deploy stable and complete homologation.

Replace all example vendor names, endpoints, and credentials with values for your real app before production.

## Common failure modes

- Missing `paymentProvider` builder or empty/wrong `paymentMethods` so `/manifest` and Admin do not list methods correctly.
- **Build fails with hundreds of TS errors in `node_modules/.d.ts` files** — missing `resolutions` in `package.json` to pin type packages to TS 3.9.7-compatible versions.
- **`skipLibCheck: true` has no effect** — the builder-hub ignores it. Use `resolutions` instead.
- **`catch (error: any)` or other TS 4.x+ syntax** in connector code — use the TS 3.9.7 compatible patterns.
- **`configuration.json` with invalid fields** (`usesTestSuite`, invented keys) — causes builder validation error.
- **`customFields` select options using `label` instead of `text`** — breaks Admin UI or fails validation.
- **Missing `yarn.lock`** in the `node/` directory — builder rejects the build.
- **`service.json` placed inside `node/`** instead of the project root.
- **`clients: Clients`** passed directly to `PaymentProviderService` instead of `{ implementation: Clients, options: {...} }`.
- **Accessing `client.http.post(...)` from the connector** — `http` is `protected`; expose public methods in the client class.
- **Using `SecureExternalClient` for cancel/capture/refund** — only Create Payment carries `secureProxyUrl`; post-auth uses `ExternalClient`.
- **Accessing `this.context.account`** instead of `this.context.vtex.account` — the IOContext is nested under `.vtex`.
- Type or install drift (`@vtex/api` / `@vtex/payment-provider`) without the clean reinstall path in root and `node`.
- Skipping `this.retry(request)` and duplicating retry with ad-hoc HTTP — Gateway behavior diverges from PPP.
- Card calls without `secureProxy`, wrong `Content-Type`, or non-allowlisted destination — Secure Proxy or PCI review fails.
- Testing without account allowlisting, without sellable products, or without waiting for master install / payment condition propagation.
- Overriding `/manifest` without VTEX approval or leaving stale `x-provider-app` after a major version bump.
- Homologation ticket missing production endpoint, allowed accounts, or purchase-flow details.
- **`vtex link --no-watch` hides compilation errors** — prefer watch mode to see full error output.
- **`vtex link` on `master` workspace fails** — use a dev workspace (`vtex use dev-workspace`).
- **Missing `vbase-read-write` policy** in `manifest.json` — `vbase.saveJSON()` returns 403.
- **Duplicate path segments in PSP base URL** — e.g., `/checkout/v71/v71/payments` when the version is already in the base URL.

## Review checklist

- [ ] Is the connector an IO app using `PaymentProvider` + `PaymentProviderService` (not only a standalone middleware guide)?
- [ ] Do `manifest.json` and `paymentProvider/configuration.json` match the real connector name and supported methods?
- [ ] Does `configuration.json` use only valid schema fields? Are `customFields` select options using `text` (not `label`)?
- [ ] Does `package.json` include `resolutions` pinning `@types/*` and other packages to TS 3.9.7-compatible versions?
- [ ] Is all code compatible with TS 3.9.7? (no `catch (e: any)`, no template literal types, no `override`, no `satisfies`)
- [ ] Is `yarn.lock` present in `node/` and not in `.vtexignore`?
- [ ] Is `service.json` in the project root (not inside `node/`)?
- [ ] Is `PaymentProviderService` instantiated with `clients: { implementation, options }` (not the class directly)?
- [ ] Do client classes expose public methods instead of relying on `this.http` access from outside?
- [ ] Is `SecureExternalClient` used only for Create Payment (authorize), and `ExternalClient` for cancel/capture/refund?
- [ ] Are optional manifest overrides ticket-approved and are `handler` / headers / `x-provider-app` correct?
- [ ] Does every route implementation align with types in `@vtex/payment-provider` and with payment-provider-protocol for response shapes?
- [ ] Are Gateway retries implemented with `this.retry(request)` where required?
- [ ] Do card flows use `SecureExternalClient` (or equivalent) with `secureProxy: secureProxyUrl` and allowlisted destinations?
- [ ] Has beta/staging testing followed affiliation, test mode, workspace, and payment condition steps before stable?
- [ ] Are billing, App Store submission, and homologation prerequisites documented in the internal release checklist?
- [ ] Does `manifest.json` include `vbase-read-write` and `outbound-access` policies for the PSP hosts?

## Related skills

- [`payment-provider-protocol`](../payment-provider-protocol/skill.md) — PPP endpoints, HTTP methods, and response shapes
- [`payment-idempotency`](../payment-idempotency/skill.md) — `paymentId` / `requestId` and retries
- [`payment-async-flow`](../payment-async-flow/skill.md) — `undefined` status, `callbackUrl` (IO retry vs notification), and redirect-based flows
- [`payment-pci-security`](../payment-pci-security/skill.md) — PCI and Secure Proxy semantics beyond IO wiring
- [`payment-ppp-pos`](../payment-ppp-pos/skill.md) — POS / Sales App card-present overlay (`Venda Direta` methods, Payment Apps, terminal callbacks)

## Reference

- [Payment Provider Framework](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-framework) — Official PPF guide (includes getting started and example app)
- [Payment Provider Protocol API overview](https://developers.vtex.com/docs/guides/payment-provider-protocol-api-overview)
- [Secure Proxy](https://developers.vtex.com/docs/guides/payments-integration-secure-proxy)
- [PCI DSS compliance (payments)](https://developers.vtex.com/docs/guides/payments-integration-pci-dss-compliance)
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/tutorial/payment-provider-protocol--RdsT2spdq80MMwwOeEq0m)
- [Integrating a new payment provider on VTEX](https://developers.vtex.com/docs/guides/integrating-a-new-payment-provider-on-vtex)
