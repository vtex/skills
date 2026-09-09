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
- POS / VTEX Sales App terminal payments (`Venda Direta Credito`, `Venda Direta Debito`, Payment Apps) — use [`payment-ppp-pos`](../payment-ppp-pos/skill.md)

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
- [`payment-ppp-pos`](../payment-ppp-pos/skill.md) — POS / Sales App terminal flow; not Pix/Boleto

## Reference

- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Detailed explanation of the `undefined` status, callback URL notification and retry flows, and the 7-day retry window
- [Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows) — Authorization flow documentation including async retry mechanics and callback URL behavior for VTEX IO vs non-VTEX IO
- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Endpoint-level implementation guide with callbackUrl and returnUrl usage
- [Pix: Instant Payments in Brazil](https://developers.vtex.com/docs/guides/payments-integration-pix-instant-payments-in-brazil) — Pix-specific async flow implementation including QR code generation and callback handling
- [Callback URL Signature Authentication](https://help.vtex.com/en/announcements/2024-05-03-callback-url-signature-authentication-token) — Mandatory X-VTEX-signature requirement for callback URL authentication (effective June 2024)
- [Payment Provider Protocol API Reference](https://developers.vtex.com/docs/api-reference/payment-provider-protocol) — Full API specification with callbackUrl field documentation
