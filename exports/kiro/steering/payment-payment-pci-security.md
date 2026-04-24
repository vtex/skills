<!-- globs: **/payment/**/*.ts, **/proxy/**/*.ts, **/secure/**/*.ts -->

Apply when handling credit card data, implementing secureProxyUrl flows, or working with payment security and proxy code. Covers PCI DSS compliance, Secure Proxy card tokenization, sensitive data handling rules, X-PROVIDER-Forward-To header usage, custom token creation, and the constraint that Secure Proxy applies only to card authorization (not post-auth operations like cancel, capture, or refund). Use for any payment connector that processes credit, debit, or co-branded card payments to prevent data breaches and PCI violations.

# PCI Compliance & Secure Proxy

## When this skill applies

Use this skill when:

- Building a payment connector that accepts credit cards, debit cards, or co-branded cards
- The connector needs to process card data or communicate with an acquirer
- Determining whether Secure Proxy is required for the hosting environment
- Auditing a connector for PCI DSS compliance (data storage, logging, transmission)

Do not use this skill for:

- PPP endpoint contracts and response shapes — use [`payment-provider-protocol`](payment-payment-provider-protocol.md)
- Idempotency and duplicate prevention — use [`payment-idempotency`](payment-payment-idempotency.md)
- Async payment flows (Boleto, Pix) and callbacks — use [`payment-async-flow`](payment-payment-async-flow.md)

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

- [`payment-provider-framework`](payment-payment-provider-framework.md) — PPF IO wiring, two-client pattern (`SecureExternalClient` + `ExternalClient`), and `outbound-access` policies
- [`payment-provider-protocol`](payment-payment-provider-protocol.md) — Endpoint contracts and response shapes
- [`payment-idempotency`](payment-payment-idempotency.md) — `paymentId`/`requestId` idempotency and state machine
- [`payment-async-flow`](payment-payment-async-flow.md) — Async payment methods, callbacks, and the 7-day retry window

## Reference

- [Secure Proxy](https://developers.vtex.com/docs/guides/payments-integration-secure-proxy) — Complete Secure Proxy documentation including flow diagrams, request/response examples, custom tokens, and supported JsonLogic operators
- [PCI DSS Compliance](https://developers.vtex.com/docs/guides/payments-integration-pci-dss-compliance) — PCI certification requirements, AOC submission process, and when Secure Proxy is mandatory
- [Implementing a Payment Provider](https://developers.vtex.com/docs/guides/payments-integration-implementing-a-payment-provider) — Endpoint implementation guide including Create Payment request body with secureProxyUrl and tokenized card fields
- [Payment Provider Protocol (Help Center)](https://help.vtex.com/en/docs/tutorials/payment-provider-protocol) — Protocol overview including PCI prerequisites and Secure Proxy requirements
- [Payment Provider Framework](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-framework) — VTEX IO framework for payment connectors (Secure Proxy mandatory for all IO apps)
- [PCI Security Standards Council](https://www.pcisecuritystandards.org/) — Official PCI DSS requirements and compliance documentation
