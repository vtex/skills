---
name: payment-ppp-pos
description: "Apply when implementing a VTEX Payment Provider Protocol connector for Point of Sale (POS) payments on VTEX Sales App. Covers Venda Direta Credito and Venda Direta Debito manifest methods, the two-phase Payment App challenge (terminal connector then wait-for-confirmation), null card data on Create Payment, asynchronous undefined status, timeout pairing of secondsWaiting and delayToCancel, and callback payloads with cardBrand, firstDigits, and lastDigits. Use for building or debugging PPP + POS integrations that charge a physical card on a payment terminal."
---

# PPP Applied to POS (VTEX Sales App)

## When this skill applies

Use this skill when the task is to **create, extend, or debug a payment connector that charges a physical card on a POS terminal** from VTEX Sales App.

- The user mentions PPP + POS, POS connector, in-store payments, Sales App card payments, payment terminal, or `Venda Direta Credito` / `Venda Direta Debito`
- The source of truth is [Payment Provider Protocol for Point of Sale (POS)](https://developers.vtex.com/docs/guides/payments-integration-ppp-applied-to-pos)
- The goal is to remove the "implement from scratch" barrier: clone the official PPF example from [Payment Provider Framework](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-framework) Getting started, or overlay POS on existing PPP — not generate a generic ecommerce connector

Load companions when the step needs them. Do not dump all three into the first reply.

| Companion | Load when |
|---|---|
| [generation.md](references/generation.md) | The user asked to **create** a POS connector. Ask the four questions, then implement in the listed order. |
| [ppf-scaffold.md](references/ppf-scaffold.md) | Hosting is **VTEX IO / PPF**. Copy overlay files onto the official PPF example app. |
| [examples.md](references/examples.md) | You need expected JSON, the state machine table, or IO retry vs standalone notification. |

The hard constraints below override ecommerce PPP and PCI habits. If a generated file violates one, STOP and fix it before writing more files.

Do not use this skill as the default choice for:

- Ecommerce PPP endpoints, manifests, and homologation shapes with no POS methods — use [`payment-provider-protocol`](../payment-provider-protocol/SKILL.md)
- IO connector wiring (`PaymentProvider`, `configuration.json`, `this.retry`) — use [`payment-provider-framework`](../payment-provider-framework/SKILL.md) together with this skill
- Pix, Boleto, or browser-redirect async methods — use [`payment-async-flow`](../payment-async-flow/SKILL.md)
- Ecommerce card data and Secure Proxy — use [`payment-pci-security`](../payment-pci-security/SKILL.md)
- Sales App cart, PDP, or menu UI extensions — use [`sales-app-extensibility`](../../../sales-app/skills/sales-app-extensibility/SKILL.md)

## Decision rules

- Prefer **VTEX IO / PPF** unless the partner already hosts PPP middleware. Clone the official example app from the Payment Provider Framework guide and overlay POS; do not start from an empty Express app.
- POS payments are still PPP. Implement the six payment-flow endpoints, then overlay the POS rules in this skill.
- `authorize()` is a state machine. It never waits on the POS. It only returns the current phase:

| Stored phase | Create Payment returns |
|---|---|
| *(none yet)* | Persist `identify-terminal`; `undefined` + `vtex.terminal-connector-app` |
| `identify-terminal` | Same terminal app until `submitUrl` stores a serial |
| `await-pos` | `undefined` + `vtex.challenge-wait-for-confirmation` |
| `approved` / `denied` | Final status + `cardBrand` + `firstDigits` + `lastDigits` |
- `Venda Direta Credito` and `Venda Direta Debito` are **asynchronous card-present** methods. Return `status: "undefined"` and resolve later via `callbackUrl`. Do not treat them as sync Visa/Mastercard authorizations.
- Branch on `paymentMethod`. A connector may support ecommerce and POS; POS is the path where `paymentMethod` is `Venda Direta Credito` or `Venda Direta Debito`.
- The Gateway does **not** receive the shopper's card for POS. All `card` fields arrive as `null`. Do not call Secure Proxy on this path.
- Use VTEX's ready-made Payment Apps unless the partner has a documented reason to build a custom one:
  - Identify the terminal: `vtex.terminal-connector-app`
  - Wait for the POS result: `vtex.challenge-wait-for-confirmation`
- Do not use `vtex.challenge-terminal-connector-app`. That name appears as a flow-diagram example in the POS guide; the implementation contract and the published app are `vtex.terminal-connector-app`.
- `paymentAppData.payload` is a **serialized JSON string**, not a nested object.
- Communication between the payment processor and the physical POS is outside VTEX. The connector only identifies the terminal, starts the processor transaction, and reports `approved` or `denied` to the Gateway.
- Without VTEX IO, `callbackUrl` is a notification endpoint: POST the final status (include POS card fields). With VTEX IO, `callbackUrl` is a retry endpoint: persist state, then POST `{ paymentId }` to `callbackUrl` from the processor webhook (or `this.retry(request)` inside a `PaymentProvider` method). Return the final status plus POS card fields on the next Create Payment / `authorize()`.
- POS serial collection and the processor webhook are **extra public routes**, not PPP inbound-request. The official example's `this.callback(req, resp)` is Test Suite only.
- `delayToCancel` must be greater than or equal to `secondsWaiting`.
- Every connector endpoint must respond in under 20 seconds in production (under 5 seconds during the Payment Provider Test Suite).
- This skill can generate connector code and a test checklist. It cannot replace a real POS, a Sales App device, a configured test account, or homologation.

## Hard constraints

Code samples use example identifiers (`PartnerPos`, `partnername`, `connector-partnerpos`, `provider.example.com`) and example numbers (`SECONDS_WAITING = 600`, `firstDigits` / `lastDigits` such as `411111` / `1111`). Replace them with the partner's connector name, public hosts, timeouts, and processor card fragments. `600` is not a VTEX-required default; the rule is `delayToCancel >= secondsWaiting`. Example BIN/last-four values are truncated fragments, not a PAN.

### Constraint: Manifest must declare the POS payment methods by exact API name

GET `/manifest` (and PPF `paymentProvider/configuration.json` `paymentMethods`) MUST include `Venda Direta Credito` and/or `Venda Direta Debito` with the exact ASCII names from the POS guide. Admin labels with accents (`Venda Direta Crédito`, `Venda Direta Débito`) are display names only.

**Why this matters**
The Gateway and Sales App payment conditions bind to these method names. If the manifest only lists `Visa` / `Mastercard`, merchants cannot configure POS. If the connector invents a name such as `"POS Credit"`, Admin and Sales App will not attach the in-store flow.

**Detection**
If the task is POS and `paymentMethods` lacks `Venda Direta Credito` or `Venda Direta Debito`, STOP and add them before generating other code.

**Correct**

```json
{
  "paymentMethods": [
    { "name": "Venda Direta Debito", "allowsSplit": "onCapture" },
    { "name": "Venda Direta Credito", "allowsSplit": "onCapture" }
  ]
}
```

**Wrong**

```json
{
  "paymentMethods": [
    { "name": "Visa", "allowsSplit": "onCapture" },
    { "name": "Mastercard", "allowsSplit": "onCapture" },
    { "name": "POS Credit", "allowsSplit": "onCapture" }
  ]
}
```

### Constraint: Detect POS from `paymentMethod` and never read card PAN from the Gateway

For `Venda Direta Credito` and `Venda Direta Debito`, Create Payment sends `card.holder`, `card.number`, `card.csc`, `card.expiration`, `card.document`, and `card.token` as `null`. The connector MUST NOT require those fields, MUST NOT call Secure Proxy, and MUST NOT decline the payment because card data is missing.

**Why this matters**
The shopper pays on the physical terminal. Treating POS as an ecommerce card authorization fails the charge, or worse, invents Secure Proxy calls with empty tokens.

**Detection**
If POS authorize logic reads `card.number` / `secureProxyUrl` or returns `denied` when `card` is null, STOP and split POS from ecommerce.

**Correct**

```typescript
const POS_METHODS = ["Venda Direta Credito", "Venda Direta Debito"];

function isPosPayment(paymentMethod: string): boolean {
  return POS_METHODS.includes(paymentMethod);
}

async function authorize(request: CreatePaymentRequest) {
  if (isPosPayment(request.paymentMethod)) {
    return authorizePos(request);
  }

  return authorizeEcommerce(request);
}
```

**Wrong**

```typescript
async function authorize(request: CreatePaymentRequest) {
  if (!request.card?.number) {
    return { status: "denied", message: "Missing card number" };
  }

  return secureProxy.charge(request.card, request.secureProxyUrl);
}
```

### Constraint: First Create Payment response must open the terminal Payment App

When the connector has **not** yet received the POS serial number for this `paymentId`, Create Payment MUST return `status: "undefined"` and `paymentAppData` for `vtex.terminal-connector-app`. `payload` MUST be a JSON string with `submitUrl`, the HTTPS endpoint that receives `{"serialNumber": "12345"}`.

Replace the host in examples with the partner's real public URL. Persist `callbackUrl` and `paymentId` before responding.

**Why this matters**
Without this response, Sales App never opens the camera/barcode challenge, so the processor never learns which terminal to use. A nested `payload` object is not injected into the Payment App.

**Detection**
If the first POS response is `approved`/`denied`, omits `paymentAppData`, uses `vtex.challenge-terminal-connector-app`, or sets `payload` as an object, STOP and fix.

**Correct**

```typescript
const SECONDS_WAITING = 600;

async function authorizePos(request: CreatePaymentRequest) {
  const existing = await store.get(request.paymentId);

  if (!existing) {
    await store.save(request.paymentId, {
      phase: "identify-terminal",
      status: "undefined",
      callbackUrl: request.callbackUrl,
      paymentMethod: request.paymentMethod,
    });

    return {
      paymentId: request.paymentId,
      status: "undefined",
      authorizationId: null,
      nsu: null,
      tid: null,
      acquirer: "PartnerPos",
      code: "POS_IDENTIFY_TERMINAL",
      message: "Identify the POS terminal",
      delayToAutoSettle: 21600,
      delayToAutoSettleAfterAntifraud: 1800,
      delayToCancel: SECONDS_WAITING,
      paymentAppData: {
        appName: "vtex.terminal-connector-app",
        payload: JSON.stringify({
          submitUrl: `https://provider.example.com/pos/serial/${request.paymentId}`,
        }),
      },
    };
  }

  return continuePos(request, existing);
}
```

**Wrong**

```typescript
return {
  paymentId: request.paymentId,
  status: "approved",
  paymentAppData: {
    appName: "vtex.challenge-terminal-connector-app",
    payload: {
      submitUrl: "https://provider.example.com/pos/serial",
    },
  },
};
```

### Constraint: After the serial number, wait with `vtex.challenge-wait-for-confirmation`

When `submitUrl` receives `{"serialNumber": "..."}`, the connector MUST associate that serial with `paymentId`, tell the processor to start the POS charge, and on the next Create Payment return `status: "undefined"` plus `vtex.challenge-wait-for-confirmation` with payload `{"secondsWaiting": <int>}`. Do not start the POS charge before the serial number exists.

`secondsWaiting` is how long the Wait for confirmation app polls. `delayToCancel` (seconds, Create Payment response) is how long the Gateway keeps the payment `undefined` before calling Cancel. Set `delayToCancel >= secondsWaiting`.

**Why this matters**
Starting the terminal before it is identified charges the wrong device or none. If `delayToCancel` is shorter than `secondsWaiting`, the Gateway cancels while Sales App is still waiting. If Create Payment starts a new processor charge on every poll, the shopper is charged twice.

**Detection**
If Wait for confirmation is returned before a serial is stored, if `secondsWaiting` is missing, or if `delayToCancel < secondsWaiting`, STOP. If repeated Create Payment calls with the same `paymentId` create a new POS transaction, STOP and make the handler idempotent.

**Correct**

```typescript
async function onSerialNumber(paymentId: string, serialNumber: string) {
  const payment = await store.get(paymentId);
  if (!payment || payment.phase !== "identify-terminal") {
    return;
  }

  await processor.startPosCharge({
    paymentId,
    serialNumber,
    amount: payment.value,
  });

  await store.save(paymentId, {
    ...payment,
    phase: "await-pos",
    serialNumber,
  });
}

function waitingResponse(paymentId: string) {
  return {
    paymentId,
    status: "undefined",
    authorizationId: null,
    nsu: null,
    tid: null,
    acquirer: "PartnerPos",
    code: "POS_WAITING",
    message: "Waiting for POS confirmation",
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: SECONDS_WAITING,
    paymentAppData: {
      appName: "vtex.challenge-wait-for-confirmation",
      payload: JSON.stringify({ secondsWaiting: SECONDS_WAITING }),
    },
  };
}
```

**Wrong**

```typescript
async function authorizePos(request: CreatePaymentRequest) {
  await processor.startPosCharge({ paymentId: request.paymentId });

  return {
    paymentId: request.paymentId,
    status: "undefined",
    delayToCancel: 30,
    paymentAppData: {
      appName: "vtex.challenge-wait-for-confirmation",
      payload: JSON.stringify({ secondsWaiting: 600 }),
    },
  };
}
```

### Constraint: Approve or deny only through the mandatory callback, including POS card fields

The processor, not VTEX, reads the physical card. When it reports a final result, the connector MUST notify the Gateway. POS cannot be approved or denied without this callback. Include:

- `status`: `"approved"` or `"denied"`
- `cardBrand`
- `firstDigits` (first six digits / BIN)
- `lastDigits` (last four digits)

Those three card fields are required for merchant reconciliation. They come from the processor after the terminal reads the card — not from the original Create Payment `card` object.

Do not log or store the full PAN. `firstDigits` + `lastDigits` are the allowed fragments.

**Why this matters**
Without notifying the Gateway, Sales App stays on Wait for confirmation until timeout, then cancels. Missing BIN/last-four breaks financial reports even when the charge succeeded on the terminal. On IO, posting a standalone notification body to `callbackUrl` does not complete the flow — the Gateway expects a retry (`{ paymentId }` only) then a new `authorize()`.

**Detection**
If POS code returns `approved` on the first Create Payment, STOP. If PPF code `fetch`es `callbackUrl` with `status` / `cardBrand` in the body, STOP and send `{ paymentId }` only. If a Service route calls `this.retry` (there is no `this`), STOP and POST to the stored `callbackUrl`. If standalone code omits the three card fields on the notification POST, STOP.

**Correct (PPF extra route — typical processor webhook)**

```typescript
await vbase.saveJSON("pos-payments", paymentId, {
  status: "approved",
  cardBrand: event.cardBrand,
  firstDigits: event.firstDigits,
  lastDigits: event.lastDigits,
  authorizationId: event.authorizationId,
  nsu: event.nsu,
  tid: event.tid,
});

await fetch(callbackUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ paymentId }),
});
```

**Correct (inside a `PaymentProvider` method only)**

```typescript
return this.retry(authorization);
```

The next `authorize()` MUST return `status`, `cardBrand`, `firstDigits`, and `lastDigits` from the persisted record. See [examples.md](references/examples.md) for the standalone notification payload.

**Wrong**

```typescript
async function authorizePos(request: CreatePaymentRequest) {
  return {
    paymentId: request.paymentId,
    status: "approved",
    message: "Assume the terminal will succeed",
  };
}

// Also wrong on VTEX IO: notification payload to callbackUrl
await fetch(authorization.callbackUrl, {
  method: "POST",
  body: JSON.stringify({
    paymentId: request.paymentId,
    status: "approved",
    cardBrand: "Visa",
    firstDigits: "411111",
    lastDigits: "1111",
  }),
});
```

### Constraint: Keep Create Payment idempotent and answers under 20 seconds

Create Payment for a given `paymentId` MUST return the **current** stored phase and status. It MUST NOT create a second processor transaction. Polling from Wait for confirmation will call Create Payment many times while status is still `undefined`.

Do not wait for the shopper to finish on the POS inside the HTTP handler. Start the processor call, persist `await-pos`, and return. Password retries and insufficient-funds handling stay between the processor and the POS.

**Why this matters**
The Gateway treats a >20s response as failure. Duplicate POS charges happen when each poll hits the acquirer again.

**Detection**
If the handler `await`s the terminal result, or calls `processor.startPosCharge` when `phase` is already `await-pos` or final, STOP.

**Correct**

```typescript
function continuePos(request: CreatePaymentRequest, existing: PosRecord) {
  if (existing.status === "approved" || existing.status === "denied") {
    return {
      paymentId: request.paymentId,
      status: existing.status,
      authorizationId: existing.authorizationId,
      nsu: existing.nsu,
      tid: existing.tid,
      acquirer: "PartnerPos",
      code: existing.code,
      message: existing.message,
      delayToAutoSettle: 21600,
      delayToAutoSettleAfterAntifraud: 1800,
      delayToCancel: SECONDS_WAITING,
      cardBrand: existing.cardBrand,
      firstDigits: existing.firstDigits,
      lastDigits: existing.lastDigits,
    };
  }

  if (existing.phase === "await-pos") {
    return waitingResponse(request.paymentId);
  }

  // Still waiting for vtex.terminal-connector-app to POST serialNumber
  return {
    paymentId: request.paymentId,
    status: "undefined",
    authorizationId: null,
    nsu: null,
    tid: null,
    acquirer: "PartnerPos",
    code: "POS_IDENTIFY_TERMINAL",
    message: "Identify the POS terminal",
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: SECONDS_WAITING,
    paymentAppData: {
      appName: "vtex.terminal-connector-app",
      payload: JSON.stringify({
        submitUrl: `https://provider.example.com/pos/serial/${request.paymentId}`,
      }),
    },
  };
}
```

**Wrong**

```typescript
async function authorizePos(request: CreatePaymentRequest) {
  const result = await processor.startPosCharge(request);
  await processor.waitUntilCardFinished(result, { timeoutMs: 120000 });
  return { paymentId: request.paymentId, status: result.status };
}
```

### Constraint: Collect the POS serial on a public custom route, not inbound-request

`vtex.terminal-connector-app` POSTs `{"serialNumber":"..."}` to `submitUrl`. That URL MUST be a public HTTPS endpoint the Payment App can call. On PPF, declare it in `service.json` `routes` and pass it into `PaymentProviderService`. Do **not** use `POST /payments/{paymentId}/inbound-request/{action}` for this step.

**Why this matters**
Inbound-request is Gateway-initiated. The terminal app posts from the Sales App device. If `submitUrl` is an inbound path, the serial never arrives and the POS charge never starts.

**Detection**
If `submitUrl` contains `/inbound`, STOP. If PPF has no extra `service.json` route for serial collection, STOP.

**Correct**

```json
{
  "routes": {
    "posSerial": {
      "path": "/_v/partnerpos/pos/serial/:paymentId",
      "public": true
    }
  }
}
```

**Wrong**

```json
{
  "submitUrl": "https://account.myvtex.com/_v/api/my-connector/payments/PAY1/inbound/serial"
}
```

## Preferred pattern

Follow [generation.md](references/generation.md) in order. For PPF, overlay POS on the official example app from the [Payment Provider Framework](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-framework) guide using [ppf-scaffold.md](references/ppf-scaffold.md). Compare IO vs standalone payloads in [examples.md](references/examples.md).

```text
Sales App checkout
  → Gateway POST /payments (Venda Direta Credito|Debito, card = null)
  → authorize(): undefined + vtex.terminal-connector-app (submitUrl)
  → POST submitUrl {"serialNumber":"..."}   (public custom route)
  → Processor starts the terminal charge
  → authorize() poll: undefined + vtex.challenge-wait-for-confirmation
  → Processor webhook
       PPF: persist + POST { paymentId } to callbackUrl
       Standalone: POST notification payload (status + card fragments)
  → authorize() returns approved|denied + cardBrand/firstDigits/lastDigits
  → Sales App places the order
```

## Common failure modes

- Generating an ecommerce PPP connector (Visa/Mastercard + Secure Proxy) when the user asked for PPP + POS.
- Omitting `Venda Direta Credito` / `Venda Direta Debito` from the manifest, or using accented Admin labels as API names.
- Returning `approved` before the terminal finishes, or waiting inside Create Payment for the card to be inserted.
- Using `vtex.challenge-terminal-connector-app` instead of `vtex.terminal-connector-app`.
- Sending `paymentAppData.payload` as an object instead of `JSON.stringify(...)`.
- Setting `delayToCancel` below `secondsWaiting`, so the Gateway cancels a payment the Wait app is still polling.
- Starting a new POS charge on every Create Payment poll (broken idempotency).
- Skipping the Gateway callback, or omitting `cardBrand`, `firstDigits`, and `lastDigits`.
- **On VTEX IO:** POSTing a standalone notification payload (`status` + card fields) to `callbackUrl` instead of `{ "paymentId": "..." }`.
- Copying the example's Test Suite `this.callback(req, resp)` as the POS processor webhook.
- Calling `this.retry` from a `service.json` extra route (no `PaymentProvider` `this`).
- Putting `submitUrl` on PPP inbound-request instead of a public custom route.
- Applying [`payment-pci-security`](../payment-pci-security/SKILL.md) Secure Proxy to POS authorize because "it is a card payment".
- Building a Sales App cart/PDP extension instead of a payment connector.
- Starting from an empty Express app when the partner can use PPF / the official example app.

## Review checklist

- [ ] For PPF, was the app overlaid on the official PPF example (or an existing PPF connector), not an empty HTTP server?
- [ ] Does `/manifest` (and IO `configuration.json`) declare `Venda Direta Credito` and/or `Venda Direta Debito` with those exact names?
- [ ] Does authorize branch on `paymentMethod` and skip Gateway card PAN / Secure Proxy for POS?
- [ ] Is the first POS response `undefined` + `vtex.terminal-connector-app` with string `payload.submitUrl`?
- [ ] Is `submitUrl` a public custom route (`service.json`) that accepts `{"serialNumber": "..."}` and is not inbound-request?
- [ ] Does the connector start the processor charge only after the serial number is stored?
- [ ] Is the waiting response `undefined` + `vtex.challenge-wait-for-confirmation` with `secondsWaiting`?
- [ ] Is `delayToCancel >= secondsWaiting`, and does every endpoint respond in under 20 seconds?
- [ ] Are repeated Create Payment calls with the same `paymentId` idempotent (latest status, no second POS charge)?
- [ ] **PPF:** processor webhook persists card fragments then POSTs `{ paymentId }` to `callbackUrl` (or `this.retry` inside `PaymentProvider`)? Next `authorize()` returns the card fragments?
- [ ] **Standalone:** notification POST includes `status`, `cardBrand`, `firstDigits`, `lastDigits`?
- [ ] Is Cancel implemented so Gateway timeout can abort an `undefined` POS payment?
- [ ] Has the partner been told they still need a Sales App device, POS terminal, test account, payment conditions, and homologation?

### Testing prerequisites (cannot be automated by the skill)

VTEX often provides a preconfigured store for connector testing. To configure a store manually:

1. Install the connector (PPF: follow the Payment Provider Framework install steps).
2. Register a Gateway affiliation for the connector.
3. Create payment conditions **Venda Direta Crédito** and/or **Venda Direta Débito** on that affiliation.
4. Show those methods on Sales App (`checkout-instore-custom.js`). Standard condition IDs are `44` (debit) and `45` (credit); confirm on the Admin Payment Conditions page.
5. Install VTEX Sales App on a device and complete a purchase on a real or certified test POS.
6. Run the Payment Provider Test Suite, including async approved/denied cases, then open a homologation ticket when required.

## Related skills

Companions for this skill:

- [generation.md](references/generation.md) — Questions to ask, clone-the-example workflow, implementation order
- [ppf-scaffold.md](references/ppf-scaffold.md) — Overlay files for the official PPF example app
- [examples.md](references/examples.md) — Partner prompts and IO vs standalone payloads

Other payment / Sales App skills:

- [`payment-provider-protocol`](../payment-provider-protocol/SKILL.md) — Mandatory PPP endpoints and response shapes; use together with this skill
- [`payment-provider-framework`](../payment-provider-framework/SKILL.md) — Use when the POS connector is a VTEX IO app
- [`payment-async-flow`](../payment-async-flow/SKILL.md) — Generic `undefined` + `callbackUrl` rules; POS adds Payment Apps and card-fragment callbacks on top
- [`payment-idempotency`](../payment-idempotency/SKILL.md) — `paymentId` must not create a second POS charge on Gateway polls
- [`payment-pci-security`](../payment-pci-security/SKILL.md) — Ecommerce card-not-present only; do not apply Secure Proxy to POS authorize
- [`sales-app-extensibility`](../../../sales-app/skills/sales-app-extensibility/SKILL.md) — Sales App UI extensions; not the POS payment connector

## Reference

- [Payment Provider Protocol for Point of Sale (POS) - VTEX Sales App](https://developers.vtex.com/docs/guides/payments-integration-ppp-applied-to-pos) — Manifest methods, two-phase Payment Apps, timeouts, callback card fields, testing
- [Payment App](https://developers.vtex.com/docs/guides/payments-integration-payment-app) — `paymentAppData.appName` and `payload` contract
- [Payment Provider Framework](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-framework) — Clone the official example app (Getting started), IO connector implementation, `this.retry`, extra routes
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Callback URL, notification payload including `cardBrand` / `firstDigits` / `lastDigits`
- [Define payment methods displayed on VTEX Sales App](https://developers.vtex.com/docs/guides/define-payment-methods-displayed-on-vtex-sales-app) — Sales App payment condition filters (`44` debit, `45` credit)
- [Payment provider homologation](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-homologation) — Test Suite and publishing
- [Registering gateway affiliations](https://help.vtex.com/en/tutorial/registering-gateway-affiliations--tutorials_444) — Affiliation setup for tests
- [Configuring payment conditions](https://help.vtex.com/en/tutorial/how-to-configure-payment-conditions--tutorials_455) — Admin conditions for Venda Direta
