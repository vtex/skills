---
name: payment-ppp-pos
description: "Apply when implementing a VTEX Payment Provider Protocol connector for Point of Sale (POS) payments on VTEX Sales App. Covers Venda Direta Credito and Venda Direta Debito manifest methods, the two-phase Payment App challenge (terminal connector then wait-for-confirmation), null card data on Create Payment, asynchronous undefined status, timeout pairing of secondsWaiting and delayToCancel, and callback payloads with cardBrand, firstDigits, and lastDigits. Use for building or debugging PPP + POS integrations that charge a physical card on a payment terminal."
---

# PPP Applied to POS (VTEX Sales App)

## When this skill applies

Use this skill when the task is to **create, extend, or debug a payment connector that charges a physical card on a POS terminal** from VTEX Sales App.

- The user mentions PPP + POS, POS connector, in-store payments, Sales App card payments, payment terminal, or `Venda Direta Credito` / `Venda Direta Debito`
- The source of truth is [Payment Provider Protocol for Point of Sale (POS)](https://developers.vtex.com/docs/guides/payments-integration-ppp-applied-to-pos)
- The goal is to remove the "implement from scratch" barrier: generate a POS-capable connector on top of PPP, not a generic ecommerce connector

Do not use this skill as the default choice for:

- Ecommerce PPP endpoints, manifests, and homologation shapes with no POS methods — use [`payment-provider-protocol`](../payment-provider-protocol/SKILL.md)
- IO connector wiring (`PaymentProvider`, `configuration.json`, `this.retry`) — use [`payment-provider-framework`](../payment-provider-framework/SKILL.md) together with this skill
- Pix, Boleto, or browser-redirect async methods — use [`payment-async-flow`](../payment-async-flow/SKILL.md)
- Ecommerce card data and Secure Proxy — use [`payment-pci-security`](../payment-pci-security/SKILL.md)
- Sales App cart, PDP, or menu UI extensions — use [`sales-app-extensibility`](../../../sales-app/skills/sales-app-extensibility/SKILL.md)

## Decision rules

- POS payments are still PPP. Implement the six payment-flow endpoints, then overlay the POS rules in this skill.
- `Venda Direta Credito` and `Venda Direta Debito` are **asynchronous card-present** methods. Return `status: "undefined"` and resolve later via `callbackUrl`. Do not treat them as sync Visa/Mastercard authorizations.
- Branch on `paymentMethod`. A connector may support ecommerce and POS; POS is the path where `paymentMethod` is `Venda Direta Credito` or `Venda Direta Debito`.
- The Gateway does **not** receive the shopper's card for POS. All `card` fields arrive as `null`. Do not call Secure Proxy on this path.
- Use VTEX's ready-made Payment Apps unless the partner has a documented reason to build a custom one:
  - Identify the terminal: `vtex.terminal-connector-app`
  - Wait for the POS result: `vtex.challenge-wait-for-confirmation`
- Do not use `vtex.challenge-terminal-connector-app`. That name appears as a flow-diagram example in the POS guide; the implementation contract and the published app are `vtex.terminal-connector-app`.
- `paymentAppData.payload` is a **serialized JSON string**, not a nested object.
- Communication between the payment processor and the physical POS is outside VTEX. The connector only identifies the terminal, starts the processor transaction, and reports `approved` or `denied` to the Gateway.
- Without VTEX IO, `callbackUrl` is a notification endpoint: POST the final status (include POS card fields). With VTEX IO, `callbackUrl` is a retry endpoint: persist state, call `this.retry(request)`, and return the final status plus POS card fields on the next Create Payment / `authorize()`.
- `delayToCancel` must be greater than or equal to `secondsWaiting`.
- Every connector endpoint must respond in under 20 seconds in production (under 5 seconds during the Payment Provider Test Suite).
- This skill can generate connector code and a test checklist. It cannot replace a real POS, a Sales App device, a configured test account, or homologation.

## Hard constraints

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

- **Without VTEX IO:** POST the full notification payload to `callbackUrl` (keep `X-VTEX-signature`). The card fields belong on that payload.
- **With VTEX IO:** persist the final status and card fields, then retry via `callbackUrl` / `this.retry(request)`. Return those fields on the next Create Payment / `authorize()` response.

Do not log or store the full PAN. `firstDigits` + `lastDigits` are the allowed fragments.

**Why this matters**
Without the callback, Sales App stays on Wait for confirmation until timeout, then cancels. Missing BIN/last-four breaks financial reports even when the charge succeeded on the terminal.

**Detection**
If POS code returns `approved` on the first Create Payment, or notifies the Gateway without `cardBrand` / `firstDigits` / `lastDigits`, STOP.

**Correct**

```typescript
async function onProcessorWebhook(event: {
  paymentId: string;
  status: "approved" | "denied";
  cardBrand: string;
  firstDigits: string;
  lastDigits: string;
  authorizationId: string;
  nsu: string;
  tid: string;
}) {
  const payment = await store.get(event.paymentId);
  await store.save(event.paymentId, {
    ...payment,
    phase: event.status,
    status: event.status,
    cardBrand: event.cardBrand,
    firstDigits: event.firstDigits,
    lastDigits: event.lastDigits,
    authorizationId: event.authorizationId,
    nsu: event.nsu,
    tid: event.tid,
  });

  // Non-IO notification callback. On IO, call this.retry(request) instead
  // and return the same fields from authorize() on the Gateway's next POST /payments.
  await fetch(payment.callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY as string,
      "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN as string,
    },
    body: JSON.stringify({
      paymentId: event.paymentId,
      status: event.status,
      authorizationId: event.authorizationId,
      nsu: event.nsu,
      tid: event.tid,
      acquirer: "PartnerPos",
      code: event.status === "approved" ? "0000" : "DENIED",
      message: event.status === "approved" ? "POS approved" : "POS denied",
      delayToAutoSettle: 21600,
      delayToAutoSettleAfterAntifraud: 1800,
      delayToCancel: SECONDS_WAITING,
      cardBrand: event.cardBrand,
      firstDigits: event.firstDigits,
      lastDigits: event.lastDigits,
    }),
  });
}
```

**Wrong**

```typescript
async function authorizePos(request: CreatePaymentRequest) {
  return {
    paymentId: request.paymentId,
    status: "approved",
    message: "Assume the terminal will succeed",
  };
}
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

## Preferred pattern

When asked to **create a POS connector from scratch**, follow this order. Do not generate a Visa/Mastercard ecommerce connector unless the user also asked for ecommerce methods.

1. Load [`payment-provider-protocol`](../payment-provider-protocol/SKILL.md) for endpoint shapes and [`payment-idempotency`](../payment-idempotency/SKILL.md) for `paymentId` keys. If the connector is a VTEX IO app, also load [`payment-provider-framework`](../payment-provider-framework/SKILL.md).
2. Ask for connector name, IO vs standalone hosting, credit and/or debit POS, and the processor's terminal API. Use placeholders only until those values exist.
3. Declare `Venda Direta Credito` / `Venda Direta Debito` on `/manifest` (and in `configuration.json` on IO).
4. Implement a persisted state machine: `identify-terminal` → `await-pos` → `approved` | `denied` | `canceled`.
5. Expose a public HTTPS `submitUrl` that accepts `{"serialNumber": "..."}`. This is not the PPP inbound-request route.
6. Implement the processor webhook that maps terminal results to Gateway `approved` / `denied` plus `cardBrand`, `firstDigits`, `lastDigits`.
7. Implement Cancel so Gateway timeout (`delayToCancel`) can abort a still-`undefined` payment.
8. End with the testing checklist. Do not claim the connector is homologated from generated code alone.

Recommended layout (IO / PPF):

```text
payment-provider/
├── manifest.json
├── paymentProvider/
│   └── configuration.json
├── node/
│   ├── index.ts
│   ├── connector.ts          # authorize() POS state machine
│   └── pos/
│       ├── serialRoute.ts    # public POST for serialNumber
│       └── processorWebhook.ts
└── service.json
```

POS state machine:

```text
Sales App checkout
  → Gateway POST /payments (paymentMethod = Venda Direta Credito|Debito, card = null)
  → Connector: undefined + vtex.terminal-connector-app (submitUrl)
  → Seller scans POS barcode → POST submitUrl {"serialNumber":"..."}
  → Connector tells processor which terminal to use
  → Gateway POST /payments (same paymentId)
  → Connector: undefined + vtex.challenge-wait-for-confirmation
  → Shopper pays on POS (processor-owned)
  → Processor webhook → connector callback/retry with approved|denied + card fragments
  → Wait app closes → Sales App places the order
```

Minimal `configuration.json` for a POS-only IO connector. Replace `PartnerPos` with the real connector name:

```json
{
  "name": "PartnerPos",
  "paymentMethods": [
    { "name": "Venda Direta Debito", "allowsSplit": "onCapture" },
    { "name": "Venda Direta Credito", "allowsSplit": "onCapture" }
  ]
}
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
- Applying [`payment-pci-security`](../payment-pci-security/SKILL.md) Secure Proxy to POS authorize because "it is a card payment".
- Building a Sales App cart/PDP extension instead of a payment connector.

## Review checklist

- [ ] Does `/manifest` (and IO `configuration.json`) declare `Venda Direta Credito` and/or `Venda Direta Debito` with those exact names?
- [ ] Does authorize branch on `paymentMethod` and skip Gateway card PAN / Secure Proxy for POS?
- [ ] Is the first POS response `undefined` + `vtex.terminal-connector-app` with string `payload.submitUrl`?
- [ ] Is `submitUrl` a public HTTPS route that accepts `{"serialNumber": "..."}` and does not use PPP inbound-request for that step?
- [ ] Does the connector start the processor charge only after the serial number is stored?
- [ ] Is the waiting response `undefined` + `vtex.challenge-wait-for-confirmation` with `secondsWaiting`?
- [ ] Is `delayToCancel >= secondsWaiting`, and does every endpoint respond in under 20 seconds?
- [ ] Are repeated Create Payment calls with the same `paymentId` idempotent (latest status, no second POS charge)?
- [ ] Does the processor webhook notify the Gateway with `approved` or `denied` plus `cardBrand`, `firstDigits`, and `lastDigits`?
- [ ] On VTEX IO, is retry done with `this.retry(request)` / `callbackUrl`, with card fields returned on the next `authorize()`?
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

- [`payment-provider-protocol`](../payment-provider-protocol/SKILL.md) — Mandatory PPP endpoints and response shapes; use together with this skill
- [`payment-provider-framework`](../payment-provider-framework/SKILL.md) — Use when the POS connector is a VTEX IO app
- [`payment-async-flow`](../payment-async-flow/SKILL.md) — Generic `undefined` + `callbackUrl` rules; POS adds Payment Apps and card-fragment callbacks on top
- [`payment-idempotency`](../payment-idempotency/SKILL.md) — `paymentId` must not create a second POS charge on Gateway polls
- [`payment-pci-security`](../payment-pci-security/SKILL.md) — Ecommerce card-not-present only; do not apply Secure Proxy to POS authorize
- [`sales-app-extensibility`](../../../sales-app/skills/sales-app-extensibility/SKILL.md) — Sales App UI extensions; not the POS payment connector

## Reference

- [Payment Provider Protocol for Point of Sale (POS) - VTEX Sales App](https://developers.vtex.com/docs/guides/payments-integration-ppp-applied-to-pos) — Manifest methods, two-phase Payment Apps, timeouts, callback card fields, testing
- [Payment App](https://developers.vtex.com/docs/guides/payments-integration-payment-app) — `paymentAppData.appName` and `payload` contract
- [Payment Provider Framework](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-framework) — IO connector implementation and install
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Callback URL, notification payload including `cardBrand` / `firstDigits` / `lastDigits`
- [Define payment methods displayed on VTEX Sales App](https://developers.vtex.com/docs/guides/define-payment-methods-displayed-on-vtex-sales-app) — Sales App payment condition filters (`44` debit, `45` credit)
- [Payment provider homologation](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-homologation) — Test Suite and publishing
- [Registering gateway affiliations](https://help.vtex.com/en/tutorial/registering-gateway-affiliations--tutorials_444) — Affiliation setup for tests
- [Configuring payment conditions](https://help.vtex.com/en/tutorial/how-to-configure-payment-conditions--tutorials_455) — Admin conditions for Venda Direta
