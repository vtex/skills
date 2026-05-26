This skill provides guidance for AI agents working with VTEX Payment Connector Development. Apply these constraints and patterns when assisting developers with apply when implementing asynchronous payment methods (boleto, pix, bank redirects) or working with callback urls in payment connector code. covers undefined status response, callbackurl notification, x-vtex-signature validation, sync vs async handling, correct delaytocancel configuration for each async method, and redirect-based flows where inboundrequestsurl does not support browser get redirects (requires custom public routes).

# Asynchronous Payment Flows & Callbacks

## When this skill applies

Use this skill when:
- Implementing a payment connector that supports Boleto Bancário, Pix, bank transfers, or redirect-based flows
- Working with any payment method where the acquirer does not return a final status synchronously
- Handling `callbackUrl` notification or retry flows
- Managing the Gateway's 7-day automatic retry cycle for `undefined` status payments
- Implementing redirect-based authentication flows (e.g., PayPal, 3DS redirects) where the user leaves the VTEX checkout and returns after completing payment on an external site

Do not use this skill for:
- PPP endpoint contracts and response shapes — use [`payment-provider-protocol`](../payment-provider-protocol/skill.md)
- `paymentId`/`requestId` idempotency and state machine logic — use [`payment-idempotency`](../payment-idempotency/skill.md)
- PCI compliance and Secure Proxy card handling — use [`payment-pci-security`](../payment-pci-security/skill.md)

## Decision rules

- If the acquirer cannot return a final status synchronously, the payment method is async — return `status: "undefined"`.
- Common async methods: Boleto Bancário (`BankInvoice`), Pix, bank transfers, redirect-based auth.
- Common sync methods: credit cards, debit cards with instant authorization.
- **Without VTEX IO**: the `callbackUrl` is a notification endpoint — POST the updated status with `X-VTEX-API-AppKey`/`X-VTEX-API-AppToken` headers.
- **With VTEX IO**: the `callbackUrl` is a retry endpoint — POST to it (no payload) to trigger the Gateway to re-call POST `/payments`. The `callbackUrl` format is typically `https://{account}.vtexpayments.com.br/payment-provider/transactions/{txId}/payments/{paymentId}/retry`. A POST to this URL with body `{ paymentId }` makes the Gateway re-call your `authorize()` method.
- Always preserve the `X-VTEX-signature` query parameter in the `callbackUrl` — never strip or modify it.
- **`inboundRequestsUrl` is server-to-server only (POST)** — it does NOT support browser GET redirects. If your payment flow requires the user's browser to redirect back (e.g., PayPal, 3DS), you must create a custom public route. See the "Redirect-based flows" constraint below.
- For asynchronous methods, `delayToCancel` MUST reflect the actual validity of the payment method, not the 7‑day internal Gateway retry window:
  - Pix: between 900 and 3600 seconds (15–60 minutes), aligned with QR code expiration.
  - BankInvoice (Boleto): aligned with the invoice due date / payment deadline configured in the provider.
  - Other async methods: aligned with the provider's documented expiry SLA.

## Hard constraints

### Constraint: MUST return `undefined` for async payment methods

For any payment method where authorization does not complete synchronously (Boleto, Pix, bank transfer, redirect-based auth), the Create Payment response MUST use `status: "undefined"`. The connector MUST NOT return `"approved"` or `"denied"` until the payment is actually confirmed or rejected by the acquirer.

**Why this matters**
Returning `"approved"` for an unconfirmed payment tells the Gateway the money has been collected. The order is released for fulfillment immediately. If the customer never actually pays (e.g., never scans the Pix QR code), the merchant ships products without payment. Returning `"denied"` prematurely cancels a payment that might still be completed.

**Detection**
If the Create Payment handler returns `status: "approved"` or `status: "denied"` for an asynchronous payment method (Boleto, Pix, bank transfer, redirect), STOP. Async methods must return `"undefined"` and resolve via callback.

**Correct**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  const asyncMethods = ["BankInvoice", "Pix"];
  const isAsync = asyncMethods.includes(paymentMethod);

  if (isAsync) {
    const pending = await acquirer.initiateAsyncPayment(req.body);

    // Store payment and callbackUrl for later notification
    await store.save(paymentId, {
      paymentId,
      status: "undefined",
      callbackUrl,
      acquirerReference: pending.reference,
    });

    res.status(200).json({
      paymentId,
      status: "undefined",  // Correct: payment is pending
      authorizationId: pending.authorizationId ?? null,
      nsu: pending.nsu ?? null,
      tid: pending.tid ?? null,
      acquirer: "MyProvider",
      code: "PENDING",
      message: "Awaiting customer action",
      delayToAutoSettle: 21600,
      delayToAutoSettleAfterAntifraud: 1800,
      delayToCancel: computeDelayToCancel(paymentMethod, pending),
      paymentUrl: pending.qrCodeUrl ?? pending.boletoUrl ?? undefined,
    });

    return;
  }

  // Synchronous methods (credit card) can return final status
  const result = await acquirer.authorizeSyncPayment(req.body);

  res.status(200).json({
    paymentId,
    status: result.status,  // "approved" or "denied" is OK for sync
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: result.code ?? null,
    message: result.message ?? null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  });
}

const PIX_MIN_DELAY = 900;   // 15 minutes
const PIX_MAX_DELAY = 3600;  // 60 minutes

function computeDelayToCancel(paymentMethod: string, pending: any): number {
  if (paymentMethod === "Pix") {
    // Use provider QR TTL but clamp to 15–60 minutes
    const providerTtlSeconds = pending.pixTtlSeconds ?? 1800; // default 30 min
    return Math.min(Math.max(providerTtlSeconds, PIX_MIN_DELAY), PIX_MAX_DELAY);
  }

  if (paymentMethod === "BankInvoice") {
    // Example: seconds until boleto due date
    const now = Date.now();
    const dueDate = new Date(pending.dueDate).getTime();
    const diffSeconds = Math.max(Math.floor((dueDate - now) / 1000), 0);
    return diffSeconds;
  }

  // Other async methods: follow provider SLA if provided
  if (pending.expirySeconds) {
    return pending.expirySeconds;
  }

  // Conservative fallback: 24h
  return 86400;
}
```

**Wrong**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod } = req.body;

  // WRONG: Creating a Pix charge and immediately returning "approved"
  // The customer hasn't scanned the QR code yet — no money collected
  const pixCharge = await acquirer.createPixCharge(req.body);

  res.status(200).json({
    paymentId,
    status: "approved",  // WRONG — Pix hasn't been paid yet!
    authorizationId: pixCharge.id,
    nsu: null,
    tid: null,
    acquirer: "MyProvider",
    code: null,
    message: null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  });
}
```

### Constraint: MUST use callbackUrl from request — never hardcode

The connector MUST use the exact `callbackUrl` provided in the Create Payment request body, including all query parameters (`X-VTEX-signature`, etc.). The connector MUST NOT hardcode callback URLs or construct them manually.

**Why this matters**
The `callbackUrl` contains transaction-specific authentication tokens (`X-VTEX-signature`) that the Gateway uses to validate the callback. A hardcoded or modified URL will be rejected by the Gateway, leaving the payment stuck in `undefined` status forever. The URL format may also change between environments (production vs sandbox).

**Detection**
If the connector hardcodes a callback URL string, constructs the URL manually, or strips query parameters from the `callbackUrl`, warn the developer. The `callbackUrl` must be stored and used exactly as received.

**Correct**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, callbackUrl } = req.body;

  // Store the exact callbackUrl from the request
  await store.save(paymentId, {
    paymentId,
    status: "undefined",
    callbackUrl,  // Stored exactly as received, including query params
  });

  // Return async "undefined" response (see previous constraint)
  res.status(200).json({
    paymentId,
    status: "undefined",
    authorizationId: null,
    nsu: null,
    tid: null,
    acquirer: "MyProvider",
    code: "PENDING",
    message: "Awaiting customer action",
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 86400,
  });
}

// When the acquirer webhook arrives, use the stored callbackUrl
async function handleAcquirerWebhook(req: Request, res: Response): Promise<void> {
  const { paymentReference, status } = req.body;

  const payment = await store.findByAcquirerRef(paymentReference);
  if (!payment) {
    res.status(404).send();
    return;
  }

  const pppStatus = status === "paid" ? "approved" : "denied";

  // Update local state first
  await store.updateStatus(payment.paymentId, pppStatus);

  // Use the EXACT stored callbackUrl — do not modify it
  await fetch(payment.callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY!,
      "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN!,
    },
    body: JSON.stringify({
      paymentId: payment.paymentId,
      status: pppStatus,
    }),
  });

  res.status(200).send();
}
```

**Wrong**
```typescript
// WRONG: Hardcoding callback URL — ignores X-VTEX-signature and environment
async function handleAcquirerWebhook(req: Request, res: Response): Promise<void> {
  const { paymentReference, status } = req.body;
  const payment = await store.findByAcquirerRef(paymentReference);

  // WRONG — hardcoded URL, missing X-VTEX-signature authentication
  await fetch("https://mystore.vtexpayments.com.br/api/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentId: payment.paymentId,
      status: status === "paid" ? "approved" : "denied",
    }),
  });

  res.status(200).send();
}
```

### Constraint: `inboundRequestsUrl` is server-to-server only — redirect flows need a custom public route

The `inboundRequestsUrl` provided by the PPP only accepts **POST requests from servers**. Browser GET redirects (e.g., user returning from PayPal, 3DS, or any external checkout) will receive a **400 Bad Request** from this URL.

For redirect-based payment flows, the connector MUST create a custom public route in the VTEX IO app to receive the browser redirect, then trigger the Gateway retry via the stored `callbackUrl`.

**Why this matters**

Many payment providers (PayPal, MercadoPago, bank redirects, 3DS) require the user's browser to redirect back to the merchant after completing payment. If the connector uses `inboundRequestsUrl` as the redirect target, the user sees a 400 error and the payment is never confirmed. This is a common and frustrating failure mode that is not documented in the standard PPP or PPF documentation.

**Detection**

If the connector uses `inboundRequestsUrl` as a `return_url` or `redirect_url` for an external payment provider that redirects the user's browser, STOP. Create a custom public route instead.

**Correct — custom route for redirect callback**

Step 1: Add the route in `service.json` (project root):

```json
{
  "memory": 256,
  "ttl": 10,
  "timeout": 10,
  "minReplicas": 2,
  "maxReplicas": 10,
  "routes": {
    "providerCallback": {
      "path": "/_v/my-connector/callback",
      "public": true
    }
  }
}
```

Step 2: Register the handler in `node/index.ts`:

```typescript
import { PaymentProviderService } from '@vtex/payment-provider'
import MyConnector from './connector'
import { Clients } from './clients'
import { callbackHandler } from './handlers/callback'

export default new PaymentProviderService({
  connector: MyConnector,
  clients: {
    implementation: Clients,
    options: { default: { retries: 2, timeout: 15000 } },
  },
  routes: {
    providerCallback: callbackHandler,
  },
})
```

Step 3: Implement the handler that receives the browser GET, updates state, and triggers the Gateway retry:

```typescript
// node/handlers/callback.ts
export async function callbackHandler(ctx: Context) {
  const { paymentId, cancel } = ctx.query
  const { vbase } = ctx.clients

  // Load the stored payment record
  const payment = await vbase.getJSON<PaymentRecord>('payments', paymentId as string)

  if (!payment) {
    ctx.status = 404
    ctx.body = 'Payment not found'
    return
  }

  // Update status based on user action
  if (cancel === 'true') {
    payment.status = 'user-cancelled'
  } else {
    payment.status = 'user-returned'
  }
  await vbase.saveJSON('payments', paymentId as string, payment)

  // Trigger Gateway retry — POST to the stored callbackUrl
  // This makes the Gateway re-call authorize(), which will read the updated status
  await fetch(payment.callbackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentId }),
  })

  // Redirect user back to VTEX checkout
  const returnUrl = payment.returnUrl || `https://${ctx.vtex.account}.myvtex.com/checkout`
  ctx.redirect(returnUrl)
}
```

Step 4: In `authorize()`, use the custom route as the return URL for the external provider:

```typescript
// Inside the PaymentProvider subclass
async authorize(authorization: AuthorizationRequest) {
  const vtexCtx = (this.context as any).vtex as { account: string; workspace: string }
  const account = vtexCtx?.account || ''
  const workspace = vtexCtx?.workspace || 'master'
  const workspacePrefix = workspace !== 'master' ? `${workspace}--` : ''
  const callbackBase = `https://${workspacePrefix}${account}.myvtex.com/_v/my-connector/callback`

  // Use YOUR custom route as the return URL — not inboundRequestsUrl
  const returnUrl = `${callbackBase}?paymentId=${authorization.paymentId}`
  const cancelUrl = `${callbackBase}?paymentId=${authorization.paymentId}&cancel=true`

  // Create the payment at the external provider with these URLs
  const externalOrder = await this.clients.psp.createOrder({
    amount: authorization.value,
    return_url: returnUrl,
    cancel_url: cancelUrl,
  })

  // Store the callbackUrl and return undefined status with paymentUrl
  await this.vbase.saveJSON('payments', authorization.paymentId, {
    status: 'pending',
    callbackUrl: authorization.callbackUrl,
    returnUrl: authorization.returnUrl,
    externalOrderId: externalOrder.id,
  })

  return {
    paymentId: authorization.paymentId,
    status: 'undefined',
    paymentUrl: externalOrder.checkoutUrl,  // User is redirected here
    // ... other required fields
  }
}
```

**Wrong**

```typescript
// WRONG — using inboundRequestsUrl as browser redirect target
async authorize(authorization: AuthorizationRequest) {
  const externalOrder = await this.clients.psp.createOrder({
    amount: authorization.value,
    // inboundRequestsUrl only accepts POST from servers — browser GET returns 400
    return_url: authorization.inboundRequestsUrl,
  })

  return {
    paymentId: authorization.paymentId,
    status: 'undefined',
    paymentUrl: externalOrder.checkoutUrl,
  }
}
```

### Constraint: MUST be ready for repeated Create Payment calls (idempotent, but status can evolve)

The connector MUST handle the Gateway calling Create Payment (POST `/payments`) with the same `paymentId` multiple times during the retry window. Each call MUST not create a new charge at the acquirer, must return a response based on the locally persisted state for that `paymentId`, and must reflect the current status (`"undefined"`, `"approved"`, or `"denied"`) which may have changed after a callback.

Idempotency is about side effects on the acquirer: the first call creates the charge, retries MUST NOT call the acquirer again. For async methods, the response status may legitimately evolve from `"undefined"` to `"approved"` or `"denied"`, but only because your local store was updated by the webhook.

**Why this matters**
The Gateway retries `POST /payments` for `undefined` payments automatically for up to 7 days. If the connector treats each call as a new payment, it will create duplicate charges at the acquirer. If the connector always returns the original `"undefined"` response without checking for an updated status, the Gateway never learns that the payment was approved, and eventually cancels it.

**Detection**
If the Create Payment handler does not check for an existing `paymentId` before calling the acquirer, or always returns the original response without looking at the current status in storage, the agent MUST stop and guide the developer to implement proper idempotency with status evolution based on stored state only.

**Correct**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  // Check for existing payment — may have been updated via callback
  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    // Do NOT call the acquirer again.
    // Return a response derived from the current stored state.
    res.status(200).json({
      ...existing.response,
      status: existing.status,  // Reflect the latest state: "undefined" | "approved" | "denied"
    });
    return;
  }

  // First time — call the acquirer once
  const asyncMethods = ["BankInvoice", "Pix"];
  const isAsync = asyncMethods.includes(paymentMethod);

  const acquirerResult = await acquirer.authorize(req.body);

  const initialStatus = isAsync ? "undefined" : acquirerResult.status;

  const response = {
    paymentId,
    status: initialStatus,
    authorizationId: acquirerResult.authorizationId ?? null,
    nsu: acquirerResult.nsu ?? null,
    tid: acquirerResult.tid ?? null,
    acquirer: "MyProvider",
    code: acquirerResult.code ?? null,
    message: acquirerResult.message ?? null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: isAsync
      ? computeDelayToCancel(paymentMethod, acquirerResult)
      : 21600,
    ...(acquirerResult.paymentUrl
      ? { paymentUrl: acquirerResult.paymentUrl }
      : {}),
  };

  await store.save(paymentId, {
    paymentId,
    status: initialStatus,
    response,
    callbackUrl,
    acquirerReference: acquirerResult.reference,
  });

  res.status(200).json(response);
}
```

**Wrong**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  // WRONG: No idempotency — every retry hits the acquirer again
  const result = await acquirer.authorize(req.body);

  res.status(200).json({
    paymentId,
    status: result.status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: null,
    message: null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  });
}
```

### Constraint: MUST align `delayToCancel` with payment validity (not always 7 days)

For asynchronous methods, the `delayToCancel` field in the Create Payment response MUST represent how long that payment is considered valid for the shopper. It defines when the Gateway is allowed to automatically cancel payments that never reached a final status.

Rules:
- Pix: `delayToCancel` MUST be between 900 and 3600 seconds (15–60 minutes). This value MUST match the QR code validity configured on the provider.
- BankInvoice (Boleto): `delayToCancel` MUST be computed from the configured due date / payment deadline (for example, seconds until invoice due date). It MUST NOT be hardcoded to 7 days just to "match" the Gateway's internal retry window.
- Other async methods: `delayToCancel` MUST follow the expiry SLA defined by the provider (hours or days, as applicable). It MUST NEVER exceed the actual validity of the underlying payment from the provider's perspective.

The 7‑day window is an internal Gateway safety limit for retries on `undefined` status. It does not mean every async method should use `delayToCancel = 604800`.

**Why this matters**
For Pix, using a multi‑day `delayToCancel` keeps orders stuck in "Authorizing" with expired QR codes, creating poor UX and operational noise. For Boleto, cancelling before the real due date loses sales; cancelling much later creates reconciliation risk and "zombie" orders. Misaligned `delayToCancel` breaks the consistency between the provider's notion of a valid payment and when VTEX auto‑cancels the payment.

**Detection**
If the connector always uses `delayToCancel = 604800` for any async method, or sets `delayToCancel` greater than the Pix or Boleto validity window, the agent MUST warn that `delayToCancel` is misconfigured.

**Correct**

(See the `computeDelayToCancel` function in the "MUST return undefined" example above.)

**Wrong**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  const isAsync = ["BankInvoice", "Pix"].includes(paymentMethod);

  if (isAsync) {
    const pending = await acquirer.initiateAsyncPayment(req.body);

    await store.save(paymentId, {
      paymentId,
      status: "undefined",
      callbackUrl,
      acquirerReference: pending.reference,
    });

    res.status(200).json({
      paymentId,
      status: "undefined",
      authorizationId: pending.authorizationId ?? null,
      nsu: pending.nsu ?? null,
      tid: pending.tid ?? null,
      acquirer: "MyProvider",
      code: "PENDING",
      message: "Awaiting customer action",
      delayToAutoSettle: 21600,
      delayToAutoSettleAfterAntifraud: 1800,
      // WRONG: hardcoded 7 days for every async method
      delayToCancel: 604800,
      paymentUrl: pending.qrCodeUrl ?? pending.boletoUrl ?? undefined,
    });

    return;
  }

  // ...
}
```

## Preferred pattern

Data flow for non-VTEX IO (notification callback):

```text
1. Gateway → POST /payments → Connector (returns status: "undefined")
2. Acquirer webhook → Connector (payment confirmed)
3. Connector → POST callbackUrl (with X-VTEX-API-AppKey/AppToken headers)
4. Gateway updates payment status to approved/denied
```

Data flow for VTEX IO (retry callback):

```text
1. Gateway → POST /payments → Connector (returns status: "undefined")
2. Acquirer webhook → Connector (payment confirmed)
3. Connector → POST callbackUrl (retry, no payload)
4. Gateway → POST /payments → Connector (returns status: "approved"/"denied")
```

Data flow for redirect-based flows on VTEX IO:

```text
1. Gateway → POST /payments → Connector (returns status: "undefined" + paymentUrl)
2. Checkout redirects user to paymentUrl (external provider)
3. User completes payment on external site
4. External provider redirects user's browser to custom route (/_v/connector/callback?paymentId=...)
5. Custom route handler updates VBase status, POSTs to callbackUrl
6. Gateway → POST /payments → Connector (reads updated status, returns "approved"/"denied")
7. Custom route redirects user back to VTEX checkout
```

Status evolution in VBase for redirect flows:

```text
pending → (user completes on external site) → user-returned → (authorize re-called) → approved
pending → (user cancels on external site)   → user-cancelled → (authorize re-called) → denied
```

Classify payment methods:

```typescript
const ASYNC_PAYMENT_METHODS = new Set([
  "BankInvoice",   // Boleto Bancário
  "Pix",           // Pix instant payments
]);

function isAsyncPaymentMethod(paymentMethod: string): boolean {
  return ASYNC_PAYMENT_METHODS.has(paymentMethod);
}
```

Acquirer webhook handler with callback notification (non-VTEX IO):

```typescript
async function handleAcquirerWebhook(req: Request, res: Response): Promise<void> {
  const webhookData = req.body;
  const acquirerRef = webhookData.transactionId;

  const payment = await store.findByAcquirerRef(acquirerRef);
  if (!payment || !payment.callbackUrl) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  const pppStatus = webhookData.status === "paid" ? "approved" : "denied";

  // Update local state FIRST
  await store.updateStatus(payment.paymentId, pppStatus);

  // Notify the Gateway via callbackUrl with retry logic
  await notifyGateway(payment.callbackUrl, {
    paymentId: payment.paymentId,
    status: pppStatus,
  });

  res.status(200).json({ received: true });
}
```

Callback retry with exponential backoff:

```typescript
async function notifyGateway(callbackUrl: string, payload: object): Promise<void> {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY!,
          "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN!,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) return;
      console.error(`Callback attempt ${attempt + 1} failed: ${response.status}`);
    } catch (error) {
      console.error(`Callback attempt ${attempt + 1} error:`, error);
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, attempt)));
    }
  }

  // All retries failed — Gateway will still retry via /payments as safety net
  console.error("All callback retries exhausted. Relying on Gateway retry.");
}
```

## Common failure modes

- **Synchronous approval of async payments** — Returning `status: "approved"` for Pix or Boleto because the QR code or slip was generated successfully. Generating a QR code is not the same as receiving payment. The order ships without money collected.
- **Using `inboundRequestsUrl` as a browser redirect target** — The `inboundRequestsUrl` only accepts server-to-server POST. Browser GET redirects (from PayPal, 3DS, etc.) return 400 Bad Request. Create a custom public route (`/_v/{connector}/callback`) instead.
- **Ignoring the callbackUrl** — Not storing the `callbackUrl` from the Create Payment request and relying entirely on the Gateway's automatic retries. The retry interval increases over time, causing long delays between payment and order approval. Worst case: the 7-day window expires and the payment is cancelled even though the customer paid.
- **Hardcoding callback URLs** — Constructing callback URLs manually instead of using the one from the request, stripping the `X-VTEX-signature` parameter. The Gateway rejects the callback and the payment stays stuck in `undefined`.
- **No retry logic for failed callbacks** — Calling the `callbackUrl` once and silently dropping the notification on failure. The Gateway never learns the payment was approved, and the payment sits in `undefined` until the next retry or is auto-cancelled.
- **Returning stale status on retries** — Always returning the original `undefined` response without checking if the status was updated via callback. The Gateway never sees the `approved` status and eventually cancels the payment.
- **Misaligned `delayToCancel`** — Using 7 days for Pix, leaving expired QR codes with orders stuck in "Authorizing". Using arbitrary values for Boleto that do not match invoice due dates.
- **Missing `service.json` or route registration for custom callback** — The custom route exists in code but is not declared in `service.json` or not passed via `routes` in `PaymentProviderService`, so VTEX IO never exposes it.
- **Wrong `this.context` access for building callback URLs** — Using `this.context.account` instead of `this.context.vtex.account` in the PPF. See the [`payment-provider-framework`](../payment-provider-framework/skill.md) skill for the correct IOContext access pattern.

## Review checklist

- [ ] Do async payment methods (Boleto, Pix) return `status: "undefined"` in Create Payment?
- [ ] Is the `callbackUrl` stored exactly as received from the request (including all query params)?
- [ ] Does the webhook handler update local state before calling the `callbackUrl`?
- [ ] Is `X-VTEX-signature` preserved in the `callbackUrl` when calling it?
- [ ] Are `X-VTEX-API-AppKey` and `X-VTEX-API-AppToken` headers included in notification callbacks (non-VTEX IO)?
- [ ] Is there retry logic with exponential backoff for failed callback calls?
- [ ] Does the Create Payment handler check for an existing `paymentId`, avoid calling the acquirer again for retries, and return a response derived from the current stored state (status may evolve from `"undefined"` to `"approved"`/`"denied"` after callback)?
- [ ] For Pix, is `delayToCancel` between 900 and 3600 seconds (15–60 minutes), aligned with QR code validity?
- [ ] For BankInvoice (Boleto), does `delayToCancel` reflect the real payment deadline / due date configured in the provider?
- [ ] For other async methods, is `delayToCancel` aligned with the provider's documented expiry SLA (and never greater than the actual payment validity)?
- [ ] For redirect-based flows: is a custom public route used instead of `inboundRequestsUrl`?
- [ ] Is the custom route declared in `service.json` and registered in `PaymentProviderService` routes?
- [ ] Does the redirect handler update state in VBase, POST to callbackUrl, and redirect the user back to checkout?

## Related skills

- [`payment-provider-framework`](../payment-provider-framework/skill.md) — PPF IO wiring, `service.json`, custom routes, IOContext access, and `PaymentProviderService` configuration
- [`payment-provider-protocol`](../payment-provider-protocol/skill.md) — Endpoint contracts and response shapes
- [`payment-idempotency`](../payment-idempotency/skill.md) — `paymentId`/`requestId` idempotency and state machine
- [`payment-pci-security`](../payment-pci-security/skill.md) — PCI compliance and Secure Proxy

## Reference

- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Detailed explanation of the `undefined` status, callback URL notification and retry flows, and the 7-day retry window
- [Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows) — Authorization flow documentation including async retry mechanics and callback URL behavior for VTEX IO vs non-VTEX IO
- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Endpoint-level implementation guide with callbackUrl and returnUrl usage
- [Pix: Instant Payments in Brazil](https://developers.vtex.com/docs/guides/payments-integration-pix-instant-payments-in-brazil) — Pix-specific async flow implementation including QR code generation and callback handling
- [Callback URL Signature Authentication](https://help.vtex.com/en/announcements/2024-05-03-callback-url-signature-authentication-token) — Mandatory X-VTEX-signature requirement for callback URL authentication (effective June 2024)
- [Payment Provider Protocol API Reference](https://developers.vtex.com/docs/api-reference/payment-provider-protocol) — Full API specification with callbackUrl field documentation

---

This skill provides guidance for AI agents working with VTEX Payment Connector Development. Apply these constraints and patterns when assisting developers with apply when implementing idempotency logic in payment connector code or handling duplicate payment requests. covers paymentid as idempotency key, payment state machine transitions, retry semantics for cancellation and refund operations, and requestid handling. use for preventing duplicate charges and ensuring correct gateway retry behavior across create payment, cancel, capture, and refund endpoints.

# Idempotency & Duplicate Prevention

## When this skill applies

Use this skill when:
- Implementing any PPP endpoint handler that processes payments, cancellations, captures, or refunds
- Ensuring repeated Gateway calls with the same identifiers produce identical results without re-processing
- Building a payment state machine to prevent invalid transitions (e.g., capturing a cancelled payment)
- Handling the Gateway's 7-day retry window for `undefined` status payments

Do not use this skill for:
- PPP endpoint response shapes and HTTP methods — use [`payment-provider-protocol`](../payment-provider-protocol/skill.md)
- Async callback URL notification logic — use [`payment-async-flow`](../payment-async-flow/skill.md)
- PCI compliance and Secure Proxy — use [`payment-pci-security`](../payment-pci-security/skill.md)

## Decision rules

- Use `paymentId` as the idempotency key for Create Payment — every call with the same `paymentId` must return the same result.
- Use `requestId` as the idempotency key for Cancel, Capture, and Refund operations.
- If the Gateway sends a second Create Payment with the same `paymentId`, return the stored response without calling the acquirer again.
- Async payment methods (Boleto, Pix) MUST return `status: "undefined"` — never `"approved"` until the acquirer confirms.
- A payment moves through defined states: `undefined` → `approved` → `settled`, or `undefined` → `denied`, or `approved` → `cancelled`. Enforce valid transitions only.
- Use a persistent data store (PostgreSQL, DynamoDB, VBase for VTEX IO) — never in-memory storage that is lost on restart.

## Hard constraints

### Constraint: MUST use paymentId as idempotency key for Create Payment

The connector MUST check for an existing record with the given `paymentId` before processing a new payment. If a record exists, return the stored response without calling the acquirer again.

**Why this matters**
The VTEX Gateway retries Create Payment requests with `undefined` status for up to 7 days. Without idempotency on `paymentId`, each retry creates a new charge at the acquirer, resulting in duplicate charges to the customer. This is a financial loss and a critical production incident.

**Detection**
If the Create Payment handler does not check for an existing `paymentId` before processing, STOP. The handler must query the data store for the `paymentId` first.

**Correct**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  // Check for existing payment — idempotency guard
  const existingPayment = await paymentStore.findByPaymentId(paymentId);
  if (existingPayment) {
    // Return the exact same response — no new acquirer call
    res.status(200).json(existingPayment.response);
    return;
  }

  // First time seeing this paymentId — process with acquirer
  const result = await acquirer.authorize(req.body);

  const response = {
    paymentId,
    status: result.status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: result.code ?? null,
    message: result.message ?? null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  };

  // Store the response for future idempotent lookups
  await paymentStore.save(paymentId, { request: req.body, response });

  res.status(200).json(response);
}
```

**Wrong**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  // No idempotency check — every call hits the acquirer
  // If the Gateway retries this (which it will for undefined status),
  // the customer gets charged multiple times
  const result = await acquirer.authorize(req.body);

  res.status(200).json({
    paymentId,
    status: result.status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: null,
    message: null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  });
}
```

### Constraint: MUST return identical response for duplicate requests

When the connector receives a Create Payment request with a `paymentId` that already exists in the data store, it MUST return the exact stored response. It MUST NOT create a new record, generate new identifiers, or re-process the payment.

**Why this matters**
The Gateway uses the response fields (`authorizationId`, `tid`, `nsu`, `status`) to track the transaction. If a retry returns different values, the Gateway loses track of the original transaction, causing reconciliation failures and potential double settlements.

**Detection**
If the handler creates a new database record or generates new identifiers when it finds an existing `paymentId`, STOP. The handler must return the previously stored response verbatim.

**Correct**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  const existing = await paymentStore.findByPaymentId(paymentId);
  if (existing) {
    // Return the EXACT stored response — same authorizationId, tid, nsu, status
    res.status(200).json(existing.response);
    return;
  }

  // ... process new payment and store response
}
```

**Wrong**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.body;

  const existing = await paymentStore.findByPaymentId(paymentId);
  if (existing) {
    // WRONG: Generating new identifiers for an existing payment
    // The Gateway will see different tid/nsu and lose track of the transaction
    const newTid = generateNewTid();
    res.status(200).json({
      ...existing.response,
      tid: newTid,  // Different from original — breaks reconciliation
      nsu: generateNewNsu(),
    });
    return;
  }

  // ... process new payment
}
```

### Constraint: MUST NOT approve async payments synchronously

If a payment method is asynchronous (e.g., Boleto, Pix, bank redirect), the Create Payment response MUST return `status: "undefined"`. It MUST NOT return `status: "approved"` or `status: "denied"` until the payment is actually confirmed or rejected by the acquirer.

**Why this matters**
Returning `approved` for an async method tells the Gateway the payment is confirmed before the customer has actually paid. The order ships, but no money was collected. The merchant loses the product and the revenue. The correct flow is to return `undefined` and use the `callbackUrl` to notify the Gateway when the payment is confirmed.

**Detection**
If the Create Payment handler returns `status: "approved"` or `status: "denied"` for an asynchronous payment method (Boleto, Pix, bank transfer, redirect-based), STOP. Async methods must return `"undefined"` and use callbacks.

**Correct**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  const isAsyncMethod = ["BankInvoice", "Pix"].includes(paymentMethod);

  if (isAsyncMethod) {
    const pending = await acquirer.initiateAsyncPayment(req.body);

    await paymentStore.save(paymentId, {
      status: "undefined",
      callbackUrl,
      acquirerRef: pending.reference,
    });

    res.status(200).json({
      paymentId,
      status: "undefined",  // Correct for async
      authorizationId: pending.authorizationId ?? null,
      nsu: pending.nsu ?? null,
      tid: pending.tid ?? null,
      acquirer: "MyProvider",
      code: "ASYNC-PENDING",
      message: "Awaiting customer payment",
      delayToAutoSettle: 21600,
      delayToAutoSettleAfterAntifraud: 1800,
      delayToCancel: 604800,  // 7 days for async
      paymentUrl: pending.paymentUrl,
    });
    return;
  }

  // Sync methods can return approved/denied immediately
  // ...
}
```

**Wrong**
```typescript
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod } = req.body;

  // WRONG: Approving a Pix payment synchronously
  // The customer hasn't paid yet — the order will ship without payment
  const result = await acquirer.createPixCharge(req.body);

  res.status(200).json({
    paymentId,
    status: "approved",  // WRONG — Pix is async, should be "undefined"
    authorizationId: result.authorizationId ?? null,
    nsu: null,
    tid: null,
    acquirer: "MyProvider",
    code: null,
    message: null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  });
}
```

## Preferred pattern

Payment state store with idempotency support:

```typescript
interface PaymentRecord {
  paymentId: string;
  status: "undefined" | "approved" | "denied" | "cancelled" | "settled" | "refunded";
  response: Record<string, unknown>;
  callbackUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface OperationRecord {
  requestId: string;
  paymentId: string;
  operation: "cancel" | "capture" | "refund";
  response: Record<string, unknown>;
  createdAt: Date;
}
```

Idempotent Create Payment with state machine:

```typescript
const store = new PaymentStore();

async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, paymentMethod, callbackUrl } = req.body;

  // Idempotency check
  const existing = await store.findByPaymentId(paymentId);
  if (existing) {
    res.status(200).json(existing.response);
    return;
  }

  const isAsync = ["BankInvoice", "Pix"].includes(paymentMethod);
  const result = await acquirer.process(req.body);

  const status = isAsync ? "undefined" : result.status;
  const response = {
    paymentId,
    status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: result.code ?? null,
    message: result.message ?? null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: isAsync ? 604800 : 21600,
    ...(result.paymentUrl ? { paymentUrl: result.paymentUrl } : {}),
  };

  await store.save(paymentId, {
    paymentId, status, response, callbackUrl,
    createdAt: new Date(), updatedAt: new Date(),
  });

  res.status(200).json(response);
}
```

Idempotent Cancel with `requestId` guard and state validation:

```typescript
async function cancelPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.params;
  const { requestId } = req.body;

  // Operation idempotency check
  const existingOp = await store.findOperation(requestId);
  if (existingOp) {
    res.status(200).json(existingOp.response);
    return;
  }

  // State machine validation
  const payment = await store.findByPaymentId(paymentId);
  if (!payment || !["undefined", "approved"].includes(payment.status)) {
    res.status(200).json({
      paymentId,
      cancellationId: null,
      code: "cancel-failed",
      message: `Cannot cancel payment in ${payment?.status ?? "unknown"} state`,
      requestId,
    });
    return;
  }

  const result = await acquirer.cancel(paymentId);
  const response = {
    paymentId,
    cancellationId: result.cancellationId ?? null,
    code: result.code ?? null,
    message: result.message ?? "Successfully cancelled",
    requestId,
  };

  await store.updateStatus(paymentId, "cancelled");
  await store.saveOperation(requestId, {
    requestId, paymentId, operation: "cancel", response, createdAt: new Date(),
  });

  res.status(200).json(response);
}
```

## Common failure modes

- **Processing duplicate payments** — Calling the acquirer for every Create Payment request without checking if the `paymentId` already exists. The Gateway retries `undefined` payments for up to 7 days, so a single $100 payment can result in hundreds of duplicate charges.
- **Synchronous approval of async payment methods** — Returning `status: "approved"` immediately for Boleto or Pix before the customer has actually paid. The order ships without payment collected.
- **Losing state between retries** — Storing payment state in memory (`Map`, local variable) instead of a persistent database. On process restart, all state is lost and the next retry creates a duplicate charge.
- **Generating new identifiers for duplicate requests** — Returning different `tid`, `nsu`, or `authorizationId` values when the Gateway retries with the same `paymentId`. This breaks Gateway reconciliation and can cause double settlements.
- **Ignoring requestId on Cancel/Capture/Refund** — Not checking `requestId` before processing operations, causing duplicate cancellations or refunds when the Gateway retries.

## Review checklist

- [ ] Does the Create Payment handler check the data store for an existing `paymentId` before calling the acquirer?
- [ ] Are stored responses returned verbatim for duplicate `paymentId` requests?
- [ ] Do Cancel, Capture, and Refund handlers check for existing `requestId` before processing?
- [ ] Is the payment state machine enforced (e.g., cannot capture a cancelled payment)?
- [ ] Do async payment methods (Boleto, Pix) return `status: "undefined"` instead of `"approved"`?
- [ ] Is payment state stored in a persistent database (not in-memory)?
- [ ] Are `delayToCancel` values extended for async methods (e.g., 604800 seconds = 7 days)?

## Related skills

- [`payment-provider-protocol`](../payment-provider-protocol/skill.md) — Endpoint contracts and response shapes
- [`payment-async-flow`](../payment-async-flow/skill.md) — Callback URL notification and the 7-day retry window
- [`payment-pci-security`](../payment-pci-security/skill.md) — PCI compliance and Secure Proxy
- [`vtex-io-application-performance`](../../../vtex-io/skills/vtex-io-application-performance/skill.md) — VBase write correctness (await in critical paths), per-client timeout/retry config, and caching rules for IO-based connectors

## Reference

- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Official guide explaining idempotency requirements for Cancel, Capture, and Refund operations
- [Developing a Payment Connector for VTEX](https://help.vtex.com/en/docs/tutorials/developing-a-payment-connector-for-vtex) — Help Center guide with idempotency implementation steps using paymentId and VBase
- [Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows) — Detailed authorization, capture, and cancellation flow documentation including retry behavior
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Protocol overview including callback URL retry mechanics and 7-day retry window
- [Payment Provider Protocol API Reference](https://developers.vtex.com/docs/api-reference/payment-provider-protocol) — Full API specification with requestId and paymentId field definitions

---

This skill provides guidance for AI agents working with VTEX Payment Connector Development. Apply these constraints and patterns when assisting developers with apply when handling credit card data, implementing secureproxyurl flows, or working with payment security and proxy code. covers pci dss compliance, secure proxy card tokenization, sensitive data handling rules, x-provider-forward-to header usage, custom token creation, and the constraint that secure proxy applies only to card authorization (not post-auth operations like cancel, capture, or refund). use for any payment connector that processes credit, debit, or co-branded card payments to prevent data breaches and pci violations.

# PCI Compliance & Secure Proxy

## When this skill applies

Use this skill when:

- Building a payment connector that accepts credit cards, debit cards, or co-branded cards
- The connector needs to process card data or communicate with an acquirer
- Determining whether Secure Proxy is required for the hosting environment
- Auditing a connector for PCI DSS compliance (data storage, logging, transmission)

Do not use this skill for:

- PPP endpoint contracts and response shapes — use [`payment-provider-protocol`](../payment-provider-protocol/skill.md)
- Idempotency and duplicate prevention — use [`payment-idempotency`](../payment-idempotency/skill.md)
- Async payment flows (Boleto, Pix) and callbacks — use [`payment-async-flow`](../payment-async-flow/skill.md)

## Decision rules

- If the connector is hosted in a non-PCI environment (including all VTEX IO apps), it MUST use Secure Proxy.
- If the connector has PCI DSS certification (AOC signed by a QSA), it can call the acquirer directly with raw card data.
- Check for `secureProxyUrl` in the Create Payment request — if present, Secure Proxy is active and MUST be used.
- **`secureProxyUrl` is only present in the Create Payment (authorize) request.** Cancel, capture, settle, and refund operations do not carry card data and do not receive this field. Post-authorization calls go directly to the PSP API using credentials and `outbound-access` policies — this does not reduce PCI compliance because no card data is involved in those operations.
- Card tokens (`numberToken`, `holderToken`, `cscToken`) are only valid when sent through the `secureProxyUrl` — the proxy replaces them with real data before forwarding to the acquirer.
- Only `card.bin` (first 6 digits), `card.numberLength`, and `card.expiration` may be stored. Everything else is forbidden.
- Card data must never appear in logs, databases, files, caches, error trackers, or APM tools — even in development.

## Hard constraints

### Constraint: MUST use secureProxyUrl for non-PCI environments

If the connector is hosted in a non-PCI environment (including all VTEX IO apps), it MUST use the `secureProxyUrl` from the Create Payment request to communicate with the acquirer. It MUST NOT call the acquirer directly with raw card data. If a `secureProxyUrl` field is present in the request, Secure Proxy is active and MUST be used.

**Why this matters**
Non-PCI environments are not authorized to handle raw card data. Calling the acquirer directly bypasses the Gateway's secure data handling, violating PCI DSS. This can result in data breaches, massive fines ($100K+ per month), loss of card processing ability, and legal liability.

**Detection**
If the connector calls an acquirer endpoint directly (without going through `secureProxyUrl`) when `secureProxyUrl` is present in the request, STOP immediately. All acquirer communication must go through the Secure Proxy.

**Correct**

```typescript
async function createPaymentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { paymentId, secureProxyUrl, card } = req.body;

  if (secureProxyUrl) {
    // Non-PCI: Route through Secure Proxy
    const acquirerResponse = await fetch(secureProxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PROVIDER-Forward-To": "https://api.acquirer.com/v2/payments",
        "X-PROVIDER-Forward-MerchantId": process.env.ACQUIRER_MERCHANT_ID!,
        "X-PROVIDER-Forward-MerchantKey": process.env.ACQUIRER_MERCHANT_KEY!,
      },
      body: JSON.stringify({
        orderId: paymentId,
        payment: {
          cardNumber: card.numberToken, // Token, not real number
          holder: card.holderToken, // Token, not real name
          securityCode: card.cscToken, // Token, not real CVV
          expirationMonth: card.expiration.month,
          expirationYear: card.expiration.year,
        },
      }),
    });

    const result = await acquirerResponse.json();
    // Build and return PPP response...
  }
}
```

**Wrong**

```typescript
async function createPaymentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { paymentId, secureProxyUrl, card } = req.body;

  // WRONG: Calling acquirer directly, bypassing Secure Proxy
  // This connector is non-PCI but handles card data as if it were PCI-certified
  const acquirerResponse = await fetch("https://api.acquirer.com/v2/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      MerchantId: process.env.ACQUIRER_MERCHANT_ID!,
    },
    body: JSON.stringify({
      orderId: paymentId,
      payment: {
        // These are tokens but sent directly to acquirer — acquirer can't read tokens!
        // And if raw data were here, this would be a PCI violation
        cardNumber: card.numberToken,
        holder: card.holderToken,
        securityCode: card.cscToken,
      },
    }),
  });

  // This request will fail: acquirer receives tokens instead of real card data
  // And the Secure Proxy was completely bypassed
}
```

### Constraint: Secure Proxy applies ONLY to card authorization — not to post-auth operations

The `secureProxyUrl` field is present **only in the Create Payment request** (card authorization). Cancel, capture (settle), and refund requests do **not** include `secureProxyUrl` because they do not involve card data — they reference the transaction by `tid`, `authorizationId`, or `paymentId`.

Post-authorization calls MUST go directly to the PSP API using an `ExternalClient` with API credentials, authorized via `outbound-access` policies in `manifest.json`.

**Why this matters**

Attempting to route cancel/capture/refund through Secure Proxy will fail because `secureProxyUrl` is `undefined` in those requests. Architecturally, there is no PCI concern — only the authorization carries sensitive card data. Agents and developers who assume all PSP communication must go through Secure Proxy waste significant time debugging `undefined` proxy URLs.

**Detection**

If cancel, capture, or refund handlers reference `secureProxyUrl`, use `SecureExternalClient`, or attempt to route through Secure Proxy, STOP. Use `ExternalClient` with direct API calls for post-auth operations.

**Correct — two-client architecture**

```typescript
// Authorization (Create Payment) — via Secure Proxy
import { SecureExternalClient } from "@vtex/payment-provider";

export class PspSecureClient extends SecureExternalClient {
  public async authorize(data: object, secureProxyUrl: string) {
    return this.http.post("/payments", data, {
      secureProxy: secureProxyUrl,
    } as any);
  }
}

// Cancel, Capture, Refund — direct API calls
import { ExternalClient } from "@vtex/api";

export class PspClient extends ExternalClient {
  public async capture(tid: string, amount: number) {
    return this.http.post(
      `/payments/${tid}/capture`,
      { amount },
      {
        headers: { "X-API-Key": "..." },
      },
    );
  }
}
```

**Wrong**

```typescript
// WRONG — trying to use SecureExternalClient for all operations
async settle(request: SettlementRequest) {
  // secureProxyUrl does not exist on SettlementRequest — this is undefined
  await this.secureClient.capture(request.tid, request.value, request.secureProxyUrl)
}
```

### Constraint: Headless storefront BFFs MUST NOT proxy card data to vtexpayments.com.br

In a headless storefront, the Send payments information call (`POST https://{account}.vtexpayments.com.br/api/pub/transactions/{tid}/payments`) MUST originate from the shopper's browser or native app. The merchant's BFF (Node, Next.js route handler, edge function, lambda, reverse proxy, or any server-side component) MUST NOT receive card fields from the browser and MUST NOT forward them to the Payment Gateway, even with redaction, even with `appKey`/`appToken` on the server side, and even when only "tokenized" fields appear to be forwarded.

This constraint extends the same PCI principle that drives Secure Proxy: a non-PCI environment is not allowed to handle card data. For payment connectors that environment is the IO app; for headless storefronts it is the merchant BFF. The destination differs — Secure Proxy protects the connector → acquirer path, the browser → `vtexpayments.com.br` pattern protects the storefront → Payment Gateway path — but the rule is identical: keep raw card data inside the certified perimeter.

**Why this matters**

The merchant operating the headless storefront is rarely PCI DSS Level 1 certified. Routing card numbers, holder names, or CVV through the merchant's BFF places the BFF and every system it touches (application logs, APM, reverse proxies, load balancers, error trackers) inside PCI scope. Operating a non-PCI environment that handles card data violates PCI DSS Requirements 3 and 4 and can result in fines from $5,000 to over $100,000 per month from card networks, mandatory forensic investigation costs, loss of card processing ability, class-action exposure, and criminal liability in some jurisdictions.

The VTEX Payment Gateway (`vtexpayments.com.br`) is PCI DSS Level 1 certified. The browser → Payment Gateway path keeps card data inside the certified perimeter; the merchant BFF stays out of the card-data flow entirely. The Send payments information endpoint is authenticated by the shopper's session cookies set during the previous Place Order step — no merchant credentials are required for this hop.

**Detection**

If you find any of the following in BFF / server-side code (`server/`, `bff/`, `api/`, route handlers, middleware, edge functions, lambdas), STOP immediately:

- A request from the BFF to `https://*.vtexpayments.com.br/api/pub/transactions/.../payments`,
- A handler that accepts `cardNumber`, `holderName`, `validationCode`, `csc`, `dueDate`, or full payment `fields` from the browser,
- A "Payments client" / `ExternalClient` / `axios` instance on the server pointing at `vtexpayments.com.br` for the Send payments information endpoint.

The BFF should expose `/api/bff/order/place` (returns `transactionId`, `orderGroup`, `merchantName`) and `/api/bff/order/process` (calls `/api/checkout/pub/gatewayCallback/{orderGroup}` — no card data) but never an endpoint that forwards card fields to `vtexpayments.com.br`.

**Correct**

```typescript
async function sendPaymentDataDirect(args: {
  account: string;
  transactionId: string;
  orderGroup: string;
  merchantName: string;
  paymentInformation: PaymentField[];
}): Promise<void> {
  const {
    account,
    transactionId,
    orderGroup,
    merchantName,
    paymentInformation,
  } = args;

  const response = await fetch(
    `https://${account}.vtexpayments.com.br/api/pub/transactions/${transactionId}/payments?orderId=${orderGroup}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        paymentInformation.map((p) => ({
          ...p,
          transaction: { id: transactionId, merchantName },
        })),
      ),
    },
  );

  if (!response.ok) {
    throw new Error(`Payment submission failed: ${response.status}`);
  }
}
```

**Wrong**

```typescript
const VTEX_APP_KEY = process.env.VTEX_APP_KEY!;
const VTEX_APP_TOKEN = process.env.VTEX_APP_TOKEN!;

paymentRoutes.post("/", async (req: Request, res: Response) => {
  const { transactionId, orderGroup, paymentInformation } = req.body as {
    transactionId: string;
    orderGroup: string;
    paymentInformation: Array<{
      paymentSystem: number;
      installments: number;
      value: number;
      fields: {
        cardNumber: string;
        holderName: string;
        validationCode: string;
        dueDate: string;
      };
    }>;
  };

  const url = `https://${process.env.VTEX_ACCOUNT}.vtexpayments.com.br/api/pub/transactions/${transactionId}/payments?orderId=${orderGroup}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-API-AppKey": VTEX_APP_KEY,
      "X-VTEX-API-AppToken": VTEX_APP_TOKEN,
    },
    body: JSON.stringify(paymentInformation),
  });

  res.json({ status: response.status });
});
```

### Constraint: MUST NOT store raw card data

The connector MUST NOT store the full card number (PAN), CVV/CSC, cardholder name, or any card token values in any persistent storage — database, file system, cache, session store, or any other durable medium. Card data must only exist in memory during the request lifecycle.

**Why this matters**
Storing raw card data violates PCI DSS Requirement 3. A data breach exposes customers to fraud. Consequences include fines of $5,000–$100,000 per month from card networks, mandatory forensic investigation costs ($50K+), loss of ability to process cards, class-action lawsuits, and criminal liability in some jurisdictions.

**Detection**
If the code writes card number, CVV, cardholder name, or token values to a database, file, cache (Redis, VBase), or any persistent store, STOP immediately. Only `card.bin` (first 6 digits) and `card.numberLength` may be stored.

**Correct**

```typescript
async function createPaymentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { paymentId, card, secureProxyUrl } = req.body;

  // Only store non-sensitive card metadata
  await paymentStore.save(paymentId, {
    paymentId,
    cardBin: card.bin, // First 6 digits — safe to store
    cardNumberLength: card.numberLength, // Length — safe to store
    cardExpMonth: card.expiration.month, // Expiration — safe to store
    cardExpYear: card.expiration.year,
    // DO NOT store: card.numberToken, card.holderToken, card.cscToken
  });

  // Use card tokens only in-memory for the Secure Proxy call
  const acquirerResult = await callAcquirerViaProxy(secureProxyUrl, card);

  // Return response — card data is now out of scope
  res.status(200).json(buildResponse(paymentId, acquirerResult));
}
```

**Wrong**

```typescript
async function createPaymentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { paymentId, card } = req.body;

  // CRITICAL PCI VIOLATION: Storing full card data in database
  await database.query(
    `INSERT INTO payments (payment_id, card_number, cvv, holder_name)
     VALUES ($1, $2, $3, $4)`,
    [paymentId, card.number, card.csc, card.holder],
  );
  // This single line can result in:
  // - $100K/month fines from card networks
  // - Mandatory forensic audit ($50K+)
  // - Loss of card processing ability
  // - Criminal liability
}
```

### Constraint: MUST NOT log sensitive card data

The connector MUST NOT log card numbers, CVV/CSC values, cardholder names, or token values to any logging system — console, file, monitoring service, error tracker, or APM tool. Even in debug mode. Even in development.

**Why this matters**
Logs are typically stored in plaintext, retained for extended periods, and accessible to many team members. Card data in logs is a PCI DSS violation and a data breach. Log aggregation services (Datadog, Splunk, CloudWatch) may store data across multiple regions, amplifying the breach scope.

**Detection**
If the code contains `console.log`, `console.error`, `logger.info`, `logger.debug`, or any logging call that includes `card.number`, `card.csc`, `card.holder`, `card.numberToken`, `card.holderToken`, `card.cscToken`, or the full request body without redaction, STOP immediately. Redact or omit all sensitive fields before logging.

**Correct**

```typescript
async function createPaymentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { paymentId, card, paymentMethod, value } = req.body;

  // Safe logging — only non-sensitive fields
  console.log("Processing payment", {
    paymentId,
    paymentMethod,
    value,
    cardBin: card?.bin, // First 6 digits only — safe
    cardNumberLength: card?.numberLength, // Safe
  });

  // NEVER log the full request body for payment requests
  // It contains card tokens or raw card data
}

function redactSensitiveFields(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const redacted = { ...body };
  if (redacted.card && typeof redacted.card === "object") {
    const card = redacted.card as Record<string, unknown>;
    redacted.card = {
      bin: card.bin,
      numberLength: card.numberLength,
      expiration: card.expiration,
      // All other fields redacted
    };
  }
  return redacted;
}
```

**Wrong**

```typescript
async function createPaymentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  // CRITICAL PCI VIOLATION: Logging the entire request body
  // This includes card number, CVV, holder name, and/or token values
  console.log("Payment request received:", JSON.stringify(req.body));

  // ALSO WRONG: Logging specific card fields
  console.log("Card number:", req.body.card.number);
  console.log("CVV:", req.body.card.csc);
  console.log("Card holder:", req.body.card.holder);

  // ALSO WRONG: Logging tokens (they reference real card data)
  console.log("Card token:", req.body.card.numberToken);
}
```

## Preferred pattern

Secure Proxy data flow:

```text
1. Gateway → POST /payments (with secureProxyUrl + tokenized card data) → Connector
2. Connector → POST secureProxyUrl (tokens in body, X-PROVIDER-Forward-To: acquirer URL) → Gateway
3. Gateway replaces tokens with real card data → POST acquirer URL → Acquirer
4. Acquirer → response → Gateway → Connector
5. Connector → Create Payment response → Gateway
```

Post-authorization data flow (no Secure Proxy):

```text
1. Gateway → POST /payments/{id}/settlements → Connector
2. Connector → POST acquirer API directly (tid + amount, no card data) → Acquirer
3. Acquirer → response → Connector
4. Connector → Settlement response → Gateway
```

Detect Secure Proxy mode:

```typescript
interface CreatePaymentRequest {
  paymentId: string;
  value: number;
  currency: string;
  paymentMethod: string;
  card?: {
    holder?: string; // Raw (PCI) or absent (Secure Proxy)
    holderToken?: string; // Token (Secure Proxy only)
    number?: string; // Raw (PCI) or absent (Secure Proxy)
    numberToken?: string; // Token (Secure Proxy only)
    bin: string; // Always present — first 6 digits
    numberLength: number; // Always present
    csc?: string; // Raw (PCI) or absent (Secure Proxy)
    cscToken?: string; // Token (Secure Proxy only)
    expiration: { month: string; year: string };
  };
  secureProxyUrl?: string; // Present when Secure Proxy is active
  secureProxyTokensURL?: string; // For custom token operations
  callbackUrl: string;
  miniCart: Record<string, unknown>;
}

function isSecureProxyActive(req: CreatePaymentRequest): boolean {
  return !!req.secureProxyUrl;
}
```

Build acquirer request using tokens or raw values:

```typescript
function buildAcquirerRequest(paymentReq: CreatePaymentRequest) {
  const card = paymentReq.card!;

  return {
    merchantOrderId: paymentReq.paymentId,
    payment: {
      // Use tokens if Secure Proxy, raw values if PCI-certified
      cardNumber: card.numberToken ?? card.number!,
      holder: card.holderToken ?? card.holder!,
      securityCode: card.cscToken ?? card.csc!,
      expirationDate: `${card.expiration.month}/${card.expiration.year}`,
      amount: paymentReq.value,
    },
  };
}
```

Call acquirer through Secure Proxy with proper headers:

```typescript
async function callAcquirerViaProxy(
  secureProxyUrl: string,
  acquirerRequest: object,
): Promise<AcquirerResponse> {
  const response = await fetch(secureProxyUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      // X-PROVIDER-Forward-To tells the proxy where to send the request
      "X-PROVIDER-Forward-To": process.env.ACQUIRER_API_URL!,
      // Custom headers for the acquirer — prefix is stripped by the proxy
      "X-PROVIDER-Forward-MerchantId": process.env.ACQUIRER_MERCHANT_ID!,
      "X-PROVIDER-Forward-MerchantKey": process.env.ACQUIRER_MERCHANT_KEY!,
    },
    body: JSON.stringify(acquirerRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Secure Proxy call failed: ${response.status} ${errorText}`,
    );
  }

  return response.json() as Promise<AcquirerResponse>;
}

// For PCI-certified environments, call acquirer directly
async function callAcquirerDirect(
  acquirerRequest: object,
): Promise<AcquirerResponse> {
  const response = await fetch(process.env.ACQUIRER_API_URL!, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      MerchantId: process.env.ACQUIRER_MERCHANT_ID!,
      MerchantKey: process.env.ACQUIRER_MERCHANT_KEY!,
    },
    body: JSON.stringify(acquirerRequest),
  });

  return response.json() as Promise<AcquirerResponse>;
}
```

Safe logging utility:

```typescript
function safePaymentLog(label: string, body: Record<string, unknown>): void {
  const safe = {
    paymentId: body.paymentId,
    paymentMethod: body.paymentMethod,
    value: body.value,
    currency: body.currency,
    orderId: body.orderId,
    hasCard: !!body.card,
    hasSecureProxy: !!body.secureProxyUrl,
    cardBin: (body.card as Record<string, unknown>)?.bin,
    // Everything else is intentionally omitted
  };

  console.log(label, JSON.stringify(safe));
}
```

## Common failure modes

- **Direct card handling in non-PCI environment** — Calling the acquirer API directly without using the Secure Proxy. The acquirer receives tokens (e.g., `#vtex#token#d799bae#number#`) instead of real card numbers and rejects the transaction. Even if raw data were available, transmitting it from a non-PCI environment is a PCI DSS violation.
- **Using Secure Proxy for cancel/capture/refund** — These operations do not receive `secureProxyUrl` and do not carry card data. Attempting to route them through Secure Proxy fails because the URL is `undefined`. Use `ExternalClient` with direct API calls for post-auth operations.
- **Storing full card numbers (PANs)** — Persisting the full card number in a database for "reference" or "reconciliation". A single breach of this data can result in $100K/month fines, mandatory forensic audits, and permanent loss of card processing ability.
- **Logging card details for debugging** — Adding `console.log(req.body)` or `console.log(card)` to troubleshoot payment issues and forgetting to remove it. Card data ends up in log files, monitoring dashboards, and log aggregation services. This is a PCI violation even in development.
- **Stripping X-PROVIDER-Forward headers** — Sending requests to the Secure Proxy without the `X-PROVIDER-Forward-To` header. The proxy does not know where to forward the request and returns an error.
- **Storing token values** — Writing `card.numberToken`, `card.holderToken`, or `card.cscToken` to a database or cache, treating them as "safe" because they are tokens. Tokens reference real card data and must not be persisted.

## Review checklist

- [ ] Does the connector use `secureProxyUrl` when it is present in the Create Payment request?
- [ ] Is `SecureExternalClient` used **only** for Create Payment (authorize), not for cancel/capture/refund?
- [ ] Do post-auth operations (cancel, capture, refund) use `ExternalClient` with direct API calls?
- [ ] Is `X-PROVIDER-Forward-To` set to the acquirer's API URL in Secure Proxy calls?
- [ ] Are custom acquirer headers prefixed with `X-PROVIDER-Forward-` when going through the proxy?
- [ ] Is only `card.bin`, `card.numberLength`, and `card.expiration` stored in the database?
- [ ] Are card numbers, CVV, holder names, and token values excluded from all log statements?
- [ ] Is there a redaction utility for safely logging payment request data?
- [ ] Does the connector support both Secure Proxy (non-PCI) and direct (PCI-certified) modes?
- [ ] Are error responses logged without including the acquirer request body (which contains tokens)?

## Related skills

- [`payment-provider-framework`](../payment-provider-framework/skill.md) — PPF IO wiring, two-client pattern (`SecureExternalClient` + `ExternalClient`), and `outbound-access` policies
- [`payment-provider-protocol`](../payment-provider-protocol/skill.md) — Endpoint contracts and response shapes
- [`payment-idempotency`](../payment-idempotency/skill.md) — `paymentId`/`requestId` idempotency and state machine
- [`payment-async-flow`](../payment-async-flow/skill.md) — Async payment methods, callbacks, and the 7-day retry window

## Reference

- [Secure Proxy](https://developers.vtex.com/docs/guides/payments-integration-secure-proxy) — Complete Secure Proxy documentation including flow diagrams, request/response examples, custom tokens, and supported JsonLogic operators
- [PCI DSS Compliance](https://developers.vtex.com/docs/guides/payments-integration-pci-dss-compliance) — PCI certification requirements, AOC submission process, and when Secure Proxy is mandatory
- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Endpoint implementation guide including Create Payment request body with secureProxyUrl and tokenized card fields
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Protocol overview including PCI prerequisites and Secure Proxy requirements
- [Payment Provider Framework](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-framework) — VTEX IO framework for payment connectors (Secure Proxy mandatory for all IO apps)
- [PCI Security Standards Council](https://www.pcisecuritystandards.org/) — Official PCI DSS requirements and compliance documentation

---

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

## Reference

- [Payment Provider Framework](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-framework) — Official PPF guide (includes getting started and example app)
- [Payment Provider Protocol API overview](https://developers.vtex.com/docs/guides/payment-provider-protocol-api-overview)
- [Secure Proxy](https://developers.vtex.com/docs/guides/payments-integration-secure-proxy)
- [PCI DSS compliance (payments)](https://developers.vtex.com/docs/guides/payments-integration-pci-dss-compliance)
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/tutorial/payment-provider-protocol--RdsT2spdq80MMwwOeEq0m)
- [Integrating a new payment provider on VTEX](https://developers.vtex.com/docs/guides/integrating-a-new-payment-provider-on-vtex)

---

This skill provides guidance for AI agents working with VTEX Payment Connector Development. Apply these constraints and patterns when assisting developers with apply when implementing a vtex payment provider protocol (ppp) connector or working with payment/connector endpoint files. covers all nine required endpoints: manifest, create payment, cancel, capture/settle, refund, inbound request, create auth token, provider auth redirect, and get credentials. use for building or debugging any payment connector that integrates with the vtex payment gateway.

# PPP Endpoint Implementation

## When this skill applies

Use this skill when:
- Building a new payment connector middleware that integrates a PSP with the VTEX Payment Gateway
- Implementing, debugging, or extending any of the 9 PPP endpoints
- Preparing a connector for VTEX Payment Provider Test Suite homologation

Do not use this skill for:
- Idempotency and duplicate prevention logic — use [`payment-idempotency`](../payment-idempotency/skill.md)
- Async payment flows and callback URLs — use [`payment-async-flow`](../payment-async-flow/skill.md)
- PCI compliance and Secure Proxy card handling — use [`payment-pci-security`](../payment-pci-security/skill.md)

## Decision rules

- The connector MUST implement all 6 payment-flow endpoints: Manifest, Create Payment, Cancel, Capture/Settle, Refund, Inbound Request.
- The configuration flow (3 endpoints: Create Auth Token, Provider Auth Redirect, Get Credentials) is optional but recommended for merchant onboarding.
- All endpoints must be served over HTTPS on port 443 with TLS 1.2.
- The connector must respond in under 5 seconds during homologation tests and under 20 seconds in production.
- The provider must be PCI-DSS certified or use Secure Proxy for card payments.
- The Gateway initiates all calls. The middleware never calls the Gateway except via `callbackUrl` (async notifications) and Secure Proxy (card data forwarding).

## Hard constraints

### Constraint: Implement all required payment flow endpoints

The connector MUST implement all six payment-flow endpoints: GET `/manifest`, POST `/payments`, POST `/payments/{paymentId}/cancellations`, POST `/payments/{paymentId}/settlements`, POST `/payments/{paymentId}/refunds`, and POST `/payments/{paymentId}/inbound-request/{action}`.

**Why this matters**
The VTEX Payment Provider Test Suite validates every endpoint during homologation. Missing endpoints cause test failures and the connector will not be approved. At runtime, the Gateway expects all endpoints — a missing cancel endpoint means payments cannot be voided.

**Detection**
If the connector router/handler file does not define handlers for all 6 payment-flow paths, STOP and add the missing endpoints before proceeding.

**Correct**
```typescript
import { Router } from "express";

const router = Router();

// All 6 payment-flow endpoints implemented
router.get("/manifest", manifestHandler);
router.post("/payments", createPaymentHandler);
router.post("/payments/:paymentId/cancellations", cancelPaymentHandler);
router.post("/payments/:paymentId/settlements", capturePaymentHandler);
router.post("/payments/:paymentId/refunds", refundPaymentHandler);
router.post("/payments/:paymentId/inbound-request/:action", inboundRequestHandler);

export default router;
```

**Wrong**
```typescript
import { Router } from "express";

const router = Router();

// Missing manifest, inbound-request, and refund endpoints
// This will fail homologation and break runtime operations
router.post("/payments", createPaymentHandler);
router.post("/payments/:paymentId/cancellations", cancelPaymentHandler);
router.post("/payments/:paymentId/settlements", capturePaymentHandler);

export default router;
```

### Constraint: Return correct HTTP status codes and response shapes

Each endpoint MUST return the exact response shape documented in the PPP API. Create Payment MUST return `paymentId`, `status`, `authorizationId`, `tid`, `nsu`, `acquirer`, `code`, `message`, `delayToAutoSettle`, `delayToAutoSettleAfterAntifraud`, and `delayToCancel`. Cancel MUST return `paymentId`, `cancellationId`, `code`, `message`, `requestId`. Capture MUST return `paymentId`, `settleId`, `value`, `code`, `message`, `requestId`. Refund MUST return `paymentId`, `refundId`, `value`, `code`, `message`, `requestId`.

**Why this matters**
The Gateway parses these fields programmatically. Missing fields cause deserialization errors and the Gateway treats the payment as failed. Incorrect `delayToAutoSettle` values cause payments to auto-cancel or auto-capture at wrong times.

**Detection**
If a response object is missing any of the required fields for its endpoint, STOP and add the missing fields.

**Correct**
```typescript
interface CreatePaymentResponse {
  paymentId: string;
  status: "approved" | "denied" | "undefined";
  authorizationId: string | null;
  nsu: string | null;
  tid: string | null;
  acquirer: string | null;
  code: string | null;
  message: string | null;
  delayToAutoSettle: number;
  delayToAutoSettleAfterAntifraud: number;
  delayToCancel: number;
  paymentUrl?: string;
}

async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { paymentId, value, currency, paymentMethod, card, callbackUrl } = req.body;

  const result = await processPaymentWithAcquirer(req.body);

  const response: CreatePaymentResponse = {
    paymentId,
    status: result.status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyAcquirer",
    code: result.code ?? null,
    message: result.message ?? null,
    delayToAutoSettle: 21600,    // 6 hours in seconds
    delayToAutoSettleAfterAntifraud: 1800, // 30 minutes in seconds
    delayToCancel: 21600,         // 6 hours in seconds
  };

  res.status(200).json(response);
}
```

**Wrong**
```typescript
// Missing required fields — Gateway will reject this response
async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const result = await processPaymentWithAcquirer(req.body);

  // Missing: authorizationId, nsu, tid, acquirer, code, message,
  // delayToAutoSettle, delayToAutoSettleAfterAntifraud, delayToCancel
  res.status(200).json({
    paymentId: req.body.paymentId,
    status: result.status,
  });
}
```

### Constraint: Manifest must declare all supported payment methods

The GET `/manifest` endpoint MUST return a `paymentMethods` array listing every payment method the connector supports, with the correct `name` and `allowsSplit` configuration for each.

**Why this matters**
The Gateway reads the manifest to determine which payment methods are available. If a method is missing, merchants cannot configure it in the VTEX Admin. An incorrect `allowsSplit` value causes split payment failures.

**Detection**
If the manifest handler returns an empty `paymentMethods` array or hardcodes methods the provider does not actually support, STOP and fix the manifest.

**Correct**
```typescript
async function manifestHandler(_req: Request, res: Response): Promise<void> {
  const manifest = {
    paymentMethods: [
      { name: "Visa", allowsSplit: "onCapture" },
      { name: "Mastercard", allowsSplit: "onCapture" },
      { name: "American Express", allowsSplit: "onCapture" },
      { name: "BankInvoice", allowsSplit: "onAuthorize" },
      { name: "Pix", allowsSplit: "disabled" },
    ],
  };

  res.status(200).json(manifest);
}
```

**Wrong**
```typescript
// Empty manifest — no payment methods will appear in the Admin
async function manifestHandler(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ paymentMethods: [] });
}
```

## Preferred pattern

Architecture overview:

```text
Shopper → VTEX Checkout → VTEX Payment Gateway → [Your Connector Middleware] → Acquirer/PSP
                                ↕
                    Configuration Flow (Admin)
```

Recommended TypeScript interfaces for all endpoint contracts:

```typescript
// --- Manifest ---
interface ManifestResponse {
  paymentMethods: Array<{
    name: string;
    allowsSplit: "onCapture" | "onAuthorize" | "disabled";
  }>;
}

// --- Create Payment ---
interface CreatePaymentRequest {
  reference: string;
  orderId: string;
  transactionId: string;
  paymentId: string;
  paymentMethod: string;
  value: number;
  currency: string;
  installments: number;
  card?: {
    holder: string;
    number: string;
    csc: string;
    expiration: { month: string; year: string };
  };
  miniCart: Record<string, unknown>;
  callbackUrl: string;
  returnUrl?: string;
}

interface CreatePaymentResponse {
  paymentId: string;
  status: "approved" | "denied" | "undefined";
  authorizationId: string | null;
  nsu: string | null;
  tid: string | null;
  acquirer: string | null;
  code: string | null;
  message: string | null;
  delayToAutoSettle: number;
  delayToAutoSettleAfterAntifraud: number;
  delayToCancel: number;
  paymentUrl?: string;
}

// --- Cancel Payment ---
interface CancelPaymentResponse {
  paymentId: string;
  cancellationId: string | null;
  code: string | null;
  message: string | null;
  requestId: string;
}

// --- Capture/Settle Payment ---
interface CapturePaymentResponse {
  paymentId: string;
  settleId: string | null;
  value: number;
  code: string | null;
  message: string | null;
  requestId: string;
}

// --- Refund Payment ---
interface RefundPaymentResponse {
  paymentId: string;
  refundId: string | null;
  value: number;
  code: string | null;
  message: string | null;
  requestId: string;
}

// --- Inbound Request ---
interface InboundResponse {
  requestId: string;
  paymentId: string;
  responseData: {
    statusCode: number;
    contentType: string;
    content: string;
  };
}
```

Complete payment flow router with all 6 endpoints:

```typescript
import { Router, Request, Response } from "express";

const router = Router();

router.get("/manifest", async (_req: Request, res: Response) => {
  res.status(200).json({
    paymentMethods: [
      { name: "Visa", allowsSplit: "onCapture" },
      { name: "Mastercard", allowsSplit: "onCapture" },
      { name: "Pix", allowsSplit: "disabled" },
    ],
  });
});

router.post("/payments", async (req: Request, res: Response) => {
  const body: CreatePaymentRequest = req.body;
  const result = await processWithAcquirer(body);

  const response: CreatePaymentResponse = {
    paymentId: body.paymentId,
    status: result.status,
    authorizationId: result.authorizationId ?? null,
    nsu: result.nsu ?? null,
    tid: result.tid ?? null,
    acquirer: "MyProvider",
    code: result.code ?? null,
    message: result.message ?? null,
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: 21600,
  };
  res.status(200).json(response);
});

router.post("/payments/:paymentId/cancellations", async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const { requestId } = req.body;
  const result = await cancelWithAcquirer(paymentId);

  res.status(200).json({
    paymentId,
    cancellationId: result.cancellationId ?? null,
    code: result.code ?? null,
    message: result.message ?? "Successfully cancelled",
    requestId,
  });
});

router.post("/payments/:paymentId/settlements", async (req: Request, res: Response) => {
  const body = req.body;
  const result = await captureWithAcquirer(body.paymentId, body.value);

  res.status(200).json({
    paymentId: body.paymentId,
    settleId: result.settleId ?? null,
    value: result.capturedValue ?? body.value,
    code: result.code ?? null,
    message: result.message ?? null,
    requestId: body.requestId,
  });
});

router.post("/payments/:paymentId/refunds", async (req: Request, res: Response) => {
  const body = req.body;
  const result = await refundWithAcquirer(body.paymentId, body.value);

  res.status(200).json({
    paymentId: body.paymentId,
    refundId: result.refundId ?? null,
    value: result.refundedValue ?? body.value,
    code: result.code ?? null,
    message: result.message ?? null,
    requestId: body.requestId,
  });
});

router.post("/payments/:paymentId/inbound-request/:action", async (req: Request, res: Response) => {
  const body = req.body;
  const result = await handleInbound(body);

  res.status(200).json({
    requestId: body.requestId,
    paymentId: body.paymentId,
    responseData: {
      statusCode: 200,
      contentType: "application/json",
      content: JSON.stringify(result),
    },
  });
});

export default router;
```

Configuration flow endpoints (optional, for merchant onboarding):

```typescript
import { Router, Request, Response } from "express";

const configRouter = Router();

// 1. POST /authorization/token
configRouter.post("/authorization/token", async (req: Request, res: Response) => {
  const { applicationId, returnUrl } = req.body;
  const token = await generateAuthorizationToken(applicationId, returnUrl);
  res.status(200).json({ applicationId, token });
});

// 2. GET /authorization/redirect
configRouter.get("/authorization/redirect", async (req: Request, res: Response) => {
  const { token } = req.query;
  const providerLoginUrl = buildProviderLoginUrl(token as string);
  res.redirect(302, providerLoginUrl);
});

// 3. GET /authorization/credentials
configRouter.get("/authorization/credentials", async (req: Request, res: Response) => {
  const { authorizationCode } = req.query;
  const credentials = await exchangeCodeForCredentials(authorizationCode as string);
  res.status(200).json({
    applicationId: "vtex",
    appKey: credentials.appKey,
    appToken: credentials.appToken,
  });
});

export default configRouter;
```

## Common failure modes

- **Partial endpoint implementation** — Implementing only Create Payment and Capture while skipping Manifest, Cancel, Refund, and Inbound Request. The Test Suite tests all endpoints and will fail homologation. At runtime, the Gateway cannot cancel or refund payments.
- **Incorrect HTTP methods** — Using POST for the Manifest endpoint or GET for Create Payment. The Gateway sends specific HTTP methods; mismatched handlers return 404 or 405.
- **Missing or zero delay values** — Omitting `delayToAutoSettle`, `delayToAutoSettleAfterAntifraud`, or `delayToCancel` from the Create Payment response, or setting them to zero. This causes immediate auto-capture or auto-cancel, leading to premature settlement or lost payments.
- **Incomplete response shapes** — Returning only `paymentId` and `status` without `authorizationId`, `tid`, `nsu`, `acquirer`, etc. The Gateway deserializes all fields and treats missing ones as failures.

## Review checklist

- [ ] Are all 6 payment-flow endpoints implemented (Manifest, Create Payment, Cancel, Capture, Refund, Inbound Request)?
- [ ] Does each endpoint return the complete response shape with all required fields?
- [ ] Does the Manifest declare all payment methods the provider actually supports?
- [ ] Are the correct HTTP methods used (GET for Manifest, POST for everything else)?
- [ ] Are `delayToAutoSettle`, `delayToAutoSettleAfterAntifraud`, and `delayToCancel` set to sensible non-zero values?
- [ ] Is the connector served over HTTPS on port 443 with TLS 1.2?
- [ ] Does the connector respond within 5 seconds for test suite and 20 seconds in production?
- [ ] Are configuration flow endpoints implemented if merchant self-onboarding is needed?

## Related skills

- [`payment-idempotency`](../payment-idempotency/skill.md) — Idempotency keys (`paymentId`, `requestId`) and state machine for duplicate prevention
- [`payment-async-flow`](../payment-async-flow/skill.md) — Async payment methods, `callbackUrl`, and the 7-day retry window
- [`payment-pci-security`](../payment-pci-security/skill.md) — PCI compliance, Secure Proxy, and card data handling
- [`vtex-io-application-performance`](../../../vtex-io/skills/vtex-io-application-performance/skill.md) — Per-client timeout/retry tuning, VBase correctness constraints, and structured logging for IO-based payment connectors

## Reference

- [Payment Provider Protocol Overview](https://developers.vtex.com/docs/guides/payment-provider-protocol-api-overview) — API overview with endpoint requirements, common parameters, and test suite info
- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Step-by-step guide covering all 9 endpoints with request/response examples
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — High-level protocol explanation including payment flow diagrams and callback URL usage
- [Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows) — Authorization, capture, and cancellation flow details
- [Payment Provider Protocol API Reference](https://developers.vtex.com/docs/api-reference/payment-provider-protocol) — Full OpenAPI specification for all PPP endpoints
- [Integrating a New Payment Provider on VTEX](https://developers.vtex.com/docs/guides/integrating-a-new-payment-provider-on-vtex) — End-to-end integration guide from development to homologation
