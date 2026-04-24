---
name: headless-checkout-proxy
description: >
  Apply when implementing cart, checkout, or order placement logic proxied through a BFF for headless VTEX
  storefronts. Covers OrderForm lifecycle, cart creation, item management, profile/shipping/payment attachments,
  orderFormId management, and secure checkout flows. Use for any headless frontend that needs to proxy VTEX
  Checkout API calls through a server-side layer with proper session cookie handling.
metadata:
  track: headless
  tags:
    - checkout
    - orderform
    - cart
    - bff
    - headless
    - security
    - proxy
  globs:
    - "**/checkout/**/*.ts"
    - "**/order/**/*.ts"
    - "**/cart/**/*.ts"
  version: "1.0"
  purpose: Proxy VTEX Checkout API securely through a BFF with proper OrderForm and cookie management
  applies_to:
    - implementing cart operations in a headless storefront
    - proxying checkout API calls through a BFF
    - managing orderFormId and checkout cookies server-side
    - implementing the 3-step order placement flow
  excludes:
    - general BFF architecture decisions (see headless-bff-architecture)
    - search API integration (see headless-intelligent-search)
    - caching strategy for API responses (see headless-caching-strategy)
  decision_scope:
    - orderform-session-management
    - checkout-cookie-handling
    - order-placement-flow-design
  vtex_docs_verified: "2026-03-16"
---

# Checkout API Proxy & OrderForm Management

## When this skill applies

Use this skill when building cart and checkout functionality for any headless VTEX storefront. Every cart and checkout operation must go through the BFF.

- Implementing cart creation, item add/update/remove operations
- Attaching profile, shipping, or payment data to an OrderForm
- Implementing the 3-step order placement flow (place → pay → process)
- Managing `orderFormId` and `CheckoutOrderFormOwnership` cookies server-side

Do not use this skill for:

- General BFF architecture and API routing (use [`headless-bff-architecture`](../headless-bff-architecture/skill.md))
- Search API integration (use [`headless-intelligent-search`](../headless-intelligent-search/skill.md))
- Caching strategy decisions (use [`headless-caching-strategy`](../headless-caching-strategy/skill.md))

## Decision rules

- ALL Checkout API calls (`/api/checkout/...` on `vtexcommercestable.com.br`) MUST be proxied through the BFF. The Checkout API handles sensitive personal data (profile, address, payment-method selection).
- **PCI carve-out:** the Send payments information call to the VTEX Payment Gateway (`POST https://{account}.vtexpayments.com.br/api/pub/transactions/{tid}/payments`) MUST go directly from the browser/app to `vtexpayments.com.br` whenever it carries card data. The merchant BFF MUST NOT be in the card-data path. See the dedicated hard constraint below and [`payment-pci-security`](../../../payment/skills/payment-pci-security/skill.md).
- Store `orderFormId` in a server-side session, never in `localStorage` or `sessionStorage`.
- Capture and forward `CheckoutOrderFormOwnership` and `checkout.vtex.com` cookies between the BFF and VTEX on every request.
- Validate all inputs server-side before forwarding to VTEX — never pass raw `req.body` directly.
- Execute the 3-step order placement flow (place order → send payment → process order) as a single synchronous user interaction within the **5-minute window**. Step 1 (place) and Step 3 (gateway callback) run in the BFF; Step 2 (send payment data to `vtexpayments.com.br`) runs in the browser per the PCI carve-out above.
- Always store and reuse the existing `orderFormId` from the session — only create a new cart when no `orderFormId` exists.

OrderForm attachment endpoints:

| Attachment        | Endpoint                                                | Purpose                           |
| ----------------- | ------------------------------------------------------- | --------------------------------- |
| items             | `POST .../orderForm/{id}/items`                         | Add, remove, or update cart items |
| clientProfileData | `POST .../orderForm/{id}/attachments/clientProfileData` | Customer profile info             |
| shippingData      | `POST .../orderForm/{id}/attachments/shippingData`      | Address and delivery option       |
| paymentData       | `POST .../orderForm/{id}/attachments/paymentData`       | Payment method selection          |
| marketingData     | `POST .../orderForm/{id}/attachments/marketingData`     | Coupons and UTM data              |

## Hard constraints

### Constraint: ALL Checkout API operations MUST go through BFF

Client-side code MUST NOT make direct HTTP requests to any VTEX Checkout API endpoint on `vtexcommercestable.com.br/api/checkout/...`. All Checkout API operations — cart creation, item management, profile updates, shipping, payment-method selection (`paymentData` attachment), order placement (`/transaction`), and order processing (`/gatewayCallback`) — must be proxied through the BFF.

This rule applies to the Checkout API only. The Send payments information call on `vtexpayments.com.br` is governed by the next constraint and goes the opposite way (browser-direct) for PCI reasons; do not generalize this rule to that endpoint.

**Why this matters**

Checkout endpoints handle sensitive personal data (email, address, phone, payment-method selection). Direct frontend calls expose the request/response flow to browser DevTools, extensions, and XSS attacks. Additionally, the BFF layer is needed to manage `VtexIdclientAutCookie` and `CheckoutOrderFormOwnership` cookies server-side, validate inputs, and prevent cart manipulation (e.g., price tampering).

**Detection**

If you see `fetch` or `axios` calls to `vtexcommercestable.com.br/api/checkout/...` in any client-side code (browser-executed JavaScript, frontend source files) → STOP immediately. All Checkout API calls must route through BFF endpoints.

**Correct**

```typescript
// Frontend — calls BFF endpoint, never VTEX directly
async function addItemToCart(
  skuId: string,
  quantity: number,
  seller: string,
): Promise<OrderForm> {
  const response = await fetch("/api/bff/cart/items", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skuId, quantity, seller }),
  });

  if (!response.ok) {
    throw new Error(`Failed to add item: ${response.status}`);
  }

  return response.json();
}
```

**Wrong**

```typescript
// Frontend — calls VTEX Checkout API directly (SECURITY VULNERABILITY)
async function addItemToCart(
  skuId: string,
  quantity: number,
  seller: string,
): Promise<OrderForm> {
  const orderFormId = localStorage.getItem("orderFormId"); // Also wrong: see next constraint
  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/checkout/pub/orderForm/${orderFormId}/items`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderItems: [{ id: skuId, quantity, seller }],
      }),
    },
  );
  return response.json();
}
```

---

### Constraint: Card data MUST go directly from browser/app to vtexpayments.com.br — never through the BFF

The Send payments information call (`POST https://{account}.vtexpayments.com.br/api/pub/transactions/{tid}/payments?orderId={orderGroup}`) carries card data when the shopper pays with a credit, debit, or co-branded card. This call MUST originate from the shopper's browser or native app and MUST target `vtexpayments.com.br` directly. The BFF MUST NOT proxy this call when card data is involved, even with redaction, even with `appKey`/`appToken` on the server side, and even when only "tokenized" fields appear to be forwarded.

This is the inverse of the previous constraint. Treating it as a generic "checkout" call and routing it through the BFF — as some agents do when applying the "all checkout through BFF" rule too broadly — is a PCI DSS violation, not a security improvement.

**Why this matters**

The merchant operating the headless storefront is rarely PCI DSS Level 1 certified. Routing card numbers, holder names, or CVV through the merchant's BFF places the BFF and every system it touches — application logs, APM/observability tools, reverse proxies, load balancers, error trackers — inside PCI scope. Operating a non-PCI environment that handles card data violates PCI DSS Requirements 3 and 4 and can result in fines from $5,000 to over $100,000 per month from card networks, mandatory forensic investigation costs, loss of card processing ability, and legal liability.

The browser → `vtexpayments.com.br` path is the PCI-compliant pattern: the VTEX Payment Gateway is PCI DSS Level 1 certified and is the only environment in this flow authorized to receive raw card data. The Send payments call is authenticated by the shopper's session cookies set by the previous Place Order step — no merchant credentials are needed on the BFF for this hop.

**Detection**

If you find any of the following in BFF / server-side code (`server/`, `bff/`, `api/`, route handlers, middleware, edge functions, lambdas), STOP immediately:

- A request from the BFF to `https://*.vtexpayments.com.br/api/pub/transactions/.../payments`,
- A handler that accepts `cardNumber`, `holderName`, `validationCode`, `csc`, `dueDate`, or full payment `fields` from the browser and forwards them to any VTEX endpoint,
- A "Payments client" / `ExternalClient` / `axios` instance that targets `vtexpayments.com.br` for the Send payments information endpoint.

Move that call to the browser/app. The BFF should instead return `transactionId`, `orderGroup`, and `merchantName` from the Place Order step so the frontend can post payment data directly to the Payment Gateway.

This rule applies even when:

- The merchant has a VTEX `appKey`/`appToken` with payment permissions — possessing the credentials does not grant PCI authorization.
- Only "tokenized" card fields are forwarded — token values still reference real card data and are in PCI scope.
- The BFF code "redacts" sensitive fields before logging — the request still transits the merchant infrastructure before redaction.
- The BFF runs on a private VPC with TLS — PCI scope is determined by what data passes through, not by how the network is configured.

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

---

### Constraint: orderFormId MUST be managed server-side

The `orderFormId` MUST be stored in a secure server-side session. It SHOULD NOT be stored in `localStorage`, `sessionStorage`, or exposed to the frontend in a way that allows direct VTEX API calls.

**Why this matters**

The `orderFormId` is the key to a customer's shopping cart and all data within it — profile information, shipping address, payment details. If exposed client-side, an attacker could use it to query VTEX directly and retrieve personal data, or manipulate the cart by adding/removing items through direct API calls bypassing any validation logic.

**Detection**

If you see `orderFormId` stored in `localStorage` or `sessionStorage` → STOP immediately. It should be managed in the BFF session.

**Correct**

```typescript
// BFF — manages orderFormId in server-side session
import { Router, Request, Response } from "express";
import { vtexCheckoutRequest } from "../vtex-api-client";

export const cartRoutes = Router();

// Get or create cart — orderFormId stays server-side
cartRoutes.get("/", async (req: Request, res: Response) => {
  try {
    let orderFormId = req.session.orderFormId;

    if (orderFormId) {
      // Retrieve existing cart
      const orderForm = await vtexCheckoutRequest({
        path: `/api/checkout/pub/orderForm/${orderFormId}`,
        method: "GET",
        cookies: req.session.vtexCookies,
      });
      return res.json(sanitizeOrderForm(orderForm));
    }

    // Create new cart
    const orderForm = await vtexCheckoutRequest({
      path: "/api/checkout/pub/orderForm",
      method: "GET",
      cookies: req.session.vtexCookies,
    });

    // Store orderFormId in session — never expose raw ID to frontend
    req.session.orderFormId = orderForm.orderFormId;
    req.session.vtexCookies = orderForm._cookies; // Store checkout cookies

    res.json(sanitizeOrderForm(orderForm));
  } catch (error) {
    console.error("Error getting cart:", error);
    res.status(500).json({ error: "Failed to get cart" });
  }
});

// Remove sensitive data before sending to frontend
function sanitizeOrderForm(
  orderForm: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized = { ...orderForm };
  delete sanitized._cookies;
  return sanitized;
}
```

**Wrong**

```typescript
// Frontend — stores orderFormId in localStorage (INSECURE)
async function getCart(): Promise<OrderForm> {
  let orderFormId = localStorage.getItem("orderFormId"); // EXPOSED to client

  if (!orderFormId) {
    const response = await fetch(
      "https://mystore.vtexcommercestable.com.br/api/checkout/pub/orderForm",
    );
    const data = await response.json();
    orderFormId = data.orderFormId;
    localStorage.setItem("orderFormId", orderFormId!); // Stored client-side!
  }

  const response = await fetch(
    `https://mystore.vtexcommercestable.com.br/api/checkout/pub/orderForm/${orderFormId}`,
  );
  return response.json();
}
```

---

### Constraint: MUST validate all inputs server-side before forwarding to VTEX

The BFF MUST validate all input data before forwarding requests to the VTEX Checkout API. This includes validating SKU IDs, quantities, email formats, address fields, and coupon codes.

**Why this matters**

Without server-side validation, malicious users can send crafted requests through the BFF to VTEX with invalid or manipulative data — negative quantities, SQL injection in text fields, or spoofed seller IDs. While VTEX has its own validation, defense-in-depth requires validating at the BFF layer to catch issues early and provide clear error messages.

**Detection**

If BFF route handlers pass `req.body` directly to VTEX API calls without any validation or sanitization → STOP immediately. All inputs must be validated before proxying.

**Correct**

```typescript
// BFF — validates inputs before forwarding to VTEX
import { Router, Request, Response } from "express";
import { vtexCheckoutRequest } from "../vtex-api-client";

export const cartItemsRoutes = Router();

interface AddItemRequest {
  skuId: string;
  quantity: number;
  seller: string;
}

function validateAddItemInput(body: unknown): body is AddItemRequest {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;

  return (
    typeof b.skuId === "string" &&
    /^\d+$/.test(b.skuId) &&
    typeof b.quantity === "number" &&
    Number.isInteger(b.quantity) &&
    b.quantity > 0 &&
    b.quantity <= 100 &&
    typeof b.seller === "string" &&
    /^[a-zA-Z0-9]+$/.test(b.seller)
  );
}

cartItemsRoutes.post("/", async (req: Request, res: Response) => {
  if (!validateAddItemInput(req.body)) {
    return res.status(400).json({
      error: "Invalid input",
      details:
        "skuId must be numeric, quantity must be 1-100, seller must be alphanumeric",
    });
  }

  const { skuId, quantity, seller } = req.body;
  const orderFormId = req.session.orderFormId;

  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  try {
    const orderForm = await vtexCheckoutRequest({
      path: `/api/checkout/pub/orderForm/${orderFormId}/items`,
      method: "POST",
      body: {
        orderItems: [{ id: skuId, quantity, seller }],
      },
      cookies: req.session.vtexCookies,
    });

    res.json(sanitizeOrderForm(orderForm));
  } catch (error) {
    console.error("Error adding item:", error);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});
```

**Wrong**

```typescript
// BFF — passes raw input to VTEX without validation (UNSAFE)
cartRoutes.post("/items", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;

  // No validation — attacker can send any payload
  const orderForm = await vtexCheckoutRequest({
    path: `/api/checkout/pub/orderForm/${orderFormId}/items`,
    method: "POST",
    body: req.body, // Raw, unvalidated input passed directly!
    cookies: req.session.vtexCookies,
  });

  res.json(orderForm);
});
```

## Preferred pattern

Request flow through the BFF for checkout operations:

```text
Frontend
    │
    └── POST /api/bff/cart/items/add  {skuId, quantity, seller}
            │
            BFF Layer
            │ 1. Validates input (skuId format, quantity > 0, seller exists)
            │ 2. Reads orderFormId from server-side session
            │ 3. Forwards CheckoutOrderFormOwnership cookie
            │ 4. Calls VTEX: POST /api/checkout/pub/orderForm/{id}/items
            │ 5. Updates session with new orderFormId if changed
            │ 6. Returns sanitized orderForm to frontend
            │
            VTEX Checkout API
```

VTEX Checkout API client with cookie management:

```typescript
// server/vtex-checkout-client.ts
const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;
const VTEX_ENVIRONMENT = process.env.VTEX_ENVIRONMENT || "vtexcommercestable";
const BASE_URL = `https://${VTEX_ACCOUNT}.${VTEX_ENVIRONMENT}.com.br`;

interface CheckoutRequestOptions {
  path: string;
  method?: string;
  body?: unknown;
  cookies?: Record<string, string>;
  userToken?: string;
}

interface CheckoutResponse<T = unknown> {
  data: T;
  cookies: Record<string, string>;
}

export async function vtexCheckout<T>(
  options: CheckoutRequestOptions,
): Promise<CheckoutResponse<T>> {
  const { path, method = "GET", body, cookies = {}, userToken } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  // Build cookie header from stored cookies
  const cookieParts: string[] = [];
  if (cookies["checkout.vtex.com"]) {
    cookieParts.push(`checkout.vtex.com=${cookies["checkout.vtex.com"]}`);
  }
  if (cookies["CheckoutOrderFormOwnership"]) {
    cookieParts.push(
      `CheckoutOrderFormOwnership=${cookies["CheckoutOrderFormOwnership"]}`,
    );
  }
  if (userToken) {
    cookieParts.push(`VtexIdclientAutCookie=${userToken}`);
  }
  if (cookieParts.length > 0) {
    headers["Cookie"] = cookieParts.join("; ");
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Checkout API error: ${response.status} for ${method} ${path}: ${errorBody}`,
    );
  }

  // Extract cookies from response for session storage
  const responseCookies: Record<string, string> = {};
  const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
  for (const setCookie of setCookieHeaders) {
    const [nameValue] = setCookie.split(";");
    const [name, value] = nameValue.split("=");
    if (name && value) {
      responseCookies[name.trim()] = value.trim();
    }
  }

  const data = (await response.json()) as T;
  return { data, cookies: { ...cookies, ...responseCookies } };
}
```

Cart management BFF routes:

```typescript
// server/routes/cart.ts
import { Router, Request, Response } from "express";
import { vtexCheckout } from "../vtex-checkout-client";

export const cartRoutes = Router();

// GET /api/bff/cart — get or create cart
cartRoutes.get("/", async (req: Request, res: Response) => {
  try {
    const result = await vtexCheckout<OrderForm>({
      path: req.session.orderFormId
        ? `/api/checkout/pub/orderForm/${req.session.orderFormId}`
        : "/api/checkout/pub/orderForm",
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.orderFormId = result.data.orderFormId;
    req.session.vtexCookies = result.cookies;

    res.json(result.data);
  } catch (error) {
    console.error("Error getting cart:", error);
    res.status(500).json({ error: "Failed to get cart" });
  }
});

// POST /api/bff/cart/items — add items to cart
cartRoutes.post("/items", async (req: Request, res: Response) => {
  const { items } = req.body as {
    items: Array<{ id: string; quantity: number; seller: string }>;
  };

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Items array is required" });
  }

  for (const item of items) {
    if (
      !item.id ||
      typeof item.quantity !== "number" ||
      item.quantity < 1 ||
      !item.seller
    ) {
      return res
        .status(400)
        .json({ error: "Each item must have id, quantity (>0), and seller" });
    }
  }

  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res
      .status(400)
      .json({ error: "No active cart. Call GET /api/bff/cart first." });
  }

  try {
    const result = await vtexCheckout<OrderForm>({
      path: `/api/checkout/pub/orderForm/${orderFormId}/items`,
      method: "POST",
      body: { orderItems: items },
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.vtexCookies = result.cookies;
    res.json(result.data);
  } catch (error) {
    console.error("Error adding items:", error);
    res.status(500).json({ error: "Failed to add items to cart" });
  }
});
```

Order placement — Steps 1 and 3 run in the BFF; Step 2 runs in the browser per the PCI carve-out. All 3 steps must complete within the **5-minute window**.

```typescript
// server/routes/order.ts — BFF handles Step 1 (place) and Step 3 (process) only.
// Step 2 (send payment data) runs in the browser; see the card-data carve-out constraint.
import { Router, Request, Response } from "express";
import { vtexCheckout } from "../vtex-checkout-client";

export const orderRoutes = Router();

const VTEX_ACCOUNT = process.env.VTEX_ACCOUNT!;

// POST /api/bff/order/place — Step 1: place order from existing cart.
// Returns the data the browser needs to call vtexpayments.com.br directly in Step 2.
orderRoutes.post("/place", async (req: Request, res: Response) => {
  const orderFormId = req.session.orderFormId;
  if (!orderFormId) {
    return res.status(400).json({ error: "No active cart" });
  }

  try {
    const placeResult = await vtexCheckout<PlaceOrderResponse>({
      path: `/api/checkout/pub/orderForm/${orderFormId}/transaction`,
      method: "POST",
      body: { referenceId: orderFormId },
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    const { orders, orderGroup } = placeResult.data;
    if (!orders?.length) {
      return res
        .status(500)
        .json({ error: "Order placement returned no orders" });
    }

    const orderId = orders[0].orderId;
    const merchantTransaction =
      orders[0].transactionData.merchantTransactions[0];
    const transactionId = merchantTransaction?.transactionId;
    const merchantName = merchantTransaction?.merchantName ?? VTEX_ACCOUNT;

    req.session.pendingOrderGroup = orderGroup;

    res.json({
      account: VTEX_ACCOUNT,
      orderId,
      orderGroup,
      transactionId,
      merchantName,
    });
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ error: "Failed to place order" });
  }
});

// POST /api/bff/order/process — Step 3: process gateway callback after the
// browser has submitted payment data directly to vtexpayments.com.br in Step 2.
// Carries no card data; safe to run server-side.
orderRoutes.post("/process", async (req: Request, res: Response) => {
  const orderGroup = req.session.pendingOrderGroup;
  if (!orderGroup) {
    return res.status(400).json({ error: "No pending order to process" });
  }

  try {
    await vtexCheckout<unknown>({
      path: `/api/checkout/pub/gatewayCallback/${orderGroup}`,
      method: "POST",
      cookies: req.session.vtexCookies || {},
    });

    delete req.session.orderFormId;
    delete req.session.vtexCookies;
    delete req.session.pendingOrderGroup;

    res.json({ orderGroup, status: "processed" });
  } catch (error) {
    console.error("Error processing order:", error);
    res.status(500).json({ error: "Failed to process order" });
  }
});
```

```typescript
// frontend/checkout/placeOrder.ts — Step 2 runs in the browser.
// Card fields stay on the device; the BFF never sees them.
async function placeOrderWithCard(card: CardPaymentInformation) {
  const placeResp = await fetch("/api/bff/order/place", {
    method: "POST",
    credentials: "include",
  });
  const { account, orderGroup, transactionId, merchantName } =
    await placeResp.json();

  await fetch(
    `https://${account}.vtexpayments.com.br/api/pub/transactions/${transactionId}/payments?orderId=${orderGroup}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        { ...card, transaction: { id: transactionId, merchantName } },
      ]),
    },
  );

  await fetch("/api/bff/order/process", {
    method: "POST",
    credentials: "include",
  });
}
```

## Common failure modes

- **Creating a new cart on every page load**: Calling `GET /api/checkout/pub/orderForm` without an `orderFormId` on every page load creates a new empty cart each time, abandoning the previous one. Always store and reuse the `orderFormId` from the server-side session.

  ```typescript
  // Always check for existing orderFormId first
  cartRoutes.get("/", async (req: Request, res: Response) => {
    const orderFormId = req.session.orderFormId;

    const path = orderFormId
      ? `/api/checkout/pub/orderForm/${orderFormId}` // Retrieve existing cart
      : "/api/checkout/pub/orderForm"; // Create new cart only if none exists

    const result = await vtexCheckout<OrderForm>({
      path,
      cookies: req.session.vtexCookies || {},
      userToken: req.session.vtexAuthToken,
    });

    req.session.orderFormId = result.data.orderFormId;
    req.session.vtexCookies = result.cookies;
    res.json(result.data);
  });
  ```

- **Ignoring the 5-minute order processing window**: Placing an order (Step 1) but delaying payment or processing beyond 5 minutes causes VTEX to automatically cancel the order as `incomplete`. Execute Steps 1 → 2 → 3 sequentially and immediately as a single user interaction. Step 1 (place) and Step 3 (gateway callback) run in the BFF; Step 2 (send payment data) runs in the browser per the card-data carve-out above. Do not pause for additional UI between steps.

  ```typescript
  // Frontend orchestrates Place (BFF) → Pay (browser → vtexpayments.com.br) → Process (BFF)
  // on a single click, well within the 5-minute window.
  async function onPlaceOrderClick(card: CardPaymentInformation) {
    const { account, orderGroup, transactionId, merchantName } =
      await fetchJson("/api/bff/order/place", { method: "POST" });

    await sendPaymentDirectToGateway({
      account,
      transactionId,
      orderGroup,
      merchantName,
      card,
    });

    await fetchJson("/api/bff/order/process", { method: "POST" });
  }
  ```

- **Proxying `vtexpayments.com.br` payment submission through the BFF "for consistency"**: Routing the Send payments information call through the BFF feels symmetrical with the rest of the BFF mandate, and some agents add it to "centralize all VTEX calls". When card data is involved this is a PCI DSS violation, not a refactor. Keep Step 2 in the browser; the BFF should expose `/api/bff/order/place` (returns `transactionId`/`orderGroup`/`merchantName`) and `/api/bff/order/process` (calls `/gatewayCallback`) but never `/api/bff/order/payment` for card flows.

- **Exposing raw VTEX error messages to the frontend**: Forwarding VTEX API error responses directly to the frontend leaks internal details (account names, API paths, data structures). Map VTEX errors to user-friendly messages in the BFF and log the full error server-side.

  ```typescript
  // Map VTEX errors to safe, user-friendly messages
  function mapCheckoutError(
    vtexError: string,
    statusCode: number,
  ): { code: string; message: string } {
    if (statusCode === 400 && vtexError.includes("item")) {
      return {
        code: "INVALID_ITEM",
        message: "One or more items are unavailable",
      };
    }
    if (statusCode === 400 && vtexError.includes("address")) {
      return {
        code: "INVALID_ADDRESS",
        message: "Please check your shipping address",
      };
    }
    if (statusCode === 409) {
      return {
        code: "CART_CONFLICT",
        message: "Your cart was updated. Please review your items.",
      };
    }
    return {
      code: "CHECKOUT_ERROR",
      message: "An error occurred during checkout. Please try again.",
    };
  }
  ```

## Review checklist

- [ ] Are ALL Checkout API calls (`vtexcommercestable.com.br/api/checkout/...`) routed through the BFF (no direct frontend calls)?
- [ ] Is the Send payments information call (`vtexpayments.com.br/api/pub/transactions/{tid}/payments`) sent from the browser/app directly, NOT proxied through the BFF, when card data is involved?
- [ ] Are `cardNumber`, `holderName`, `validationCode`/`csc`, and `dueDate` absent from every BFF route handler and log statement?
- [ ] Does any reference to `vtexpayments.com.br` in the codebase appear only in browser/app code, never in `server/`, `bff/`, `api/`, or other backend directories?
- [ ] Is `orderFormId` stored in a server-side session, not in `localStorage` or `sessionStorage`?
- [ ] Are `CheckoutOrderFormOwnership` and `checkout.vtex.com` cookies captured from VTEX responses and forwarded on subsequent requests?
- [ ] Are all inputs validated server-side before forwarding to VTEX?
- [ ] Do all 3 order-placement steps (place → pay → process) execute as a single user interaction within the 5-minute window, with Steps 1 and 3 in the BFF and Step 2 in the browser direct to `vtexpayments.com.br`?
- [ ] Is the existing `orderFormId` reused from the session rather than creating a new cart on every page load?
- [ ] Are VTEX error responses sanitized before being sent to the frontend?

## Reference

- [Headless cart and checkout](https://developers.vtex.com/docs/guides/headless-cart-and-checkout) — Complete guide to implementing cart and checkout in headless stores
- [Checkout API reference](https://developers.vtex.com/docs/api-reference/checkout-api) — Full API reference for all Checkout endpoints
- [orderForm fields](https://developers.vtex.com/docs/guides/orderform-fields) — Detailed documentation of the OrderForm data structure
- [Creating a regular order from an existing cart](https://developers.vtex.com/docs/guides/creating-a-regular-order-from-an-existing-cart) — Step-by-step guide to the order placement flow
- [Headless commerce overview](https://developers.vtex.com/docs/guides/headless-commerce) — General architecture for headless VTEX stores
- [Add cart items](https://developers.vtex.com/docs/guides/add-cart-items) — Guide to adding products to a shopping cart
