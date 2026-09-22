---
name: payment-idempotency
description: "Apply when implementing idempotency logic in payment connector code or handling duplicate payment requests. Covers paymentId as idempotency key, payment state machine transitions, retry semantics for cancellation and refund operations, and requestId handling. Use for preventing duplicate charges and ensuring correct Gateway retry behavior across Create Payment, Cancel, Capture, and Refund endpoints."
---

# Idempotency & Duplicate Prevention

## When this skill applies

Use this skill when:
- Implementing any PPP endpoint handler that processes payments, cancellations, captures, or refunds
- Ensuring repeated Gateway calls with the same identifiers produce identical results without re-processing
- Building a payment state machine to prevent invalid transitions (e.g., capturing a cancelled payment)
- Handling the Gateway's 7-day retry window for `undefined` status payments

Do not use this skill for:
- PPP endpoint response shapes and HTTP methods — use [`payment-provider-protocol`](../payment-provider-protocol/SKILL.md)
- Async callback URL notification logic — use [`payment-async-flow`](../payment-async-flow/SKILL.md)
- PCI compliance and Secure Proxy — use [`payment-pci-security`](../payment-pci-security/SKILL.md)
- POS / Sales App terminal payments (`Venda Direta Credito`, `Venda Direta Debito`, overlapping Create Payment while Wait for confirmation polls) — use [`payment-ppp-pos`](../payment-ppp-pos/SKILL.md) together with this skill

## Decision rules

- Use `paymentId` as the idempotency key for Create Payment — every call with the same `paymentId` must return the same result.
- Use `requestId` as the idempotency key for Cancel, Capture, and Refund operations.
- If the Gateway sends a second Create Payment with the same `paymentId`, return the stored response without calling the acquirer again. Those retries can **overlap**; last-write-wins storage can drop a status update — persist with an etag / `ifMatch` (see [`payment-ppp-pos`](../payment-ppp-pos/SKILL.md) for the POS overlay).
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

- [`payment-provider-protocol`](../payment-provider-protocol/SKILL.md) — Endpoint contracts and response shapes
- [`payment-async-flow`](../payment-async-flow/SKILL.md) — Callback URL notification and the 7-day retry window
- [`payment-pci-security`](../payment-pci-security/SKILL.md) — PCI compliance and Secure Proxy
- [`payment-ppp-pos`](../payment-ppp-pos/SKILL.md) — POS Create Payment is polled and can overlap for one `paymentId`; use this skill's `paymentId` key plus that skill's etag / `ifMatch` pattern
- [`vtex-io-application-performance`](../../../vtex-io/skills/vtex-io-application-performance/SKILL.md) — VBase write correctness (await in critical paths), per-client timeout/retry config, and caching rules for IO-based connectors

## Reference

- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Official guide explaining idempotency requirements for Cancel, Capture, and Refund operations
- [Developing a Payment Connector for VTEX](https://help.vtex.com/en/docs/tutorials/developing-a-payment-connector-for-vtex) — Help Center guide with idempotency implementation steps using paymentId and VBase
- [Purchase Flows](https://developers.vtex.com/docs/guides/payments-integration-purchase-flows) — Detailed authorization, capture, and cancellation flow documentation including retry behavior
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Protocol overview including callback URL retry mechanics and 7-day retry window
- [Payment Provider Protocol API Reference](https://developers.vtex.com/docs/api-reference/payment-provider-protocol) — Full API specification with requestId and paymentId field definitions
