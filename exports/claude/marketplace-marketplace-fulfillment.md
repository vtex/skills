This skill provides guidance for AI agents working with VTEX Marketplace Integration. Apply these constraints and patterns when assisting developers with apply when implementing fulfillment, invoice, or tracking logic for VTEX marketplace seller connectors. Covers the External Seller fulfillment protocol: fulfillment simulation (checkout and indexation), order placement with reservation id, order dispatch (authorize fulfillment), OMS invoice and tracking APIs, and partial invoicing. Use for seller-side services that must answer within the simulation SLA and integrate with VTEX marketplace order management.

# Fulfillment, simulation, orders & OMS follow-up

## When this skill applies

Use this skill when building an **External Seller** integration: VTEX forwards availability, shipping, checkout simulation, and order placement to **your** fulfillment base URL, and you call the marketplace **OMS** APIs for invoice and tracking after dispatch.

- Implementing **`POST /pvt/orderForms/simulation`** (indexation and/or checkout — with or without customer context)
- Implementing **`POST /pvt/orders`** (order placement — create **reservation**; return **`orderId`** = reservation id in your system)
- Handling **`POST /pvt/orders/{sellerOrderId}/fulfill`** (order dispatch after approval — path uses the **same** id you returned as `orderId` at placement)
- Sending invoice notifications via `POST /api/oms/pvt/orders/{marketplaceOrderId}/invoice` (marketplace order id in the path)
- Updating tracking via `PATCH /api/oms/pvt/orders/{marketplaceOrderId}/invoice/{invoiceNumber}`
- Implementing partial invoicing for split shipments

Do not use this skill for:
- Catalog or SKU synchronization (see `marketplace-catalog-sync`)
- Order event consumption via Feed/Hook (see `marketplace-order-hook`)
- General API rate limiting (see `marketplace-rate-limiting`)

## Decision rules

### External Seller protocol (implemented on the seller host)

- **Fulfillment simulation** — `POST /pvt/orderForms/simulation`. VTEX calls it during **product indexation** and during **checkout**. Requests may include **only** `items` (and optionally query params), or the **full** checkout context: `items`, `postalCode`, `country`, `clientProfileData`, `shippingData`, `selectedSla`, etc. Without postal code / profile (typical indexation), the response must still state whether each item is **available**. With full context, return **`items`**, **`logisticsInfo`** (one entry per requested item), **`postalCode`**, **`country`**, and set **`allowMultipleDeliveries`** to `true` as required by the contract. **`items[].id`** is the **seller SKU id**; **`items[].seller`** is the **seller id** on the marketplace account.
- **Response shape** — Each `logisticsInfo[]` row aligns with a requested item (`itemIndex`). Include **`slas[]`** with all delivery options (home delivery and **pickup-in-point** when applicable), **`deliveryChannels[]`** with per-channel stock, **`shipsTo`**, and **`stockBalance`**. SLA fields include `price` (shipping per item, in cents), `shippingEstimate` / `shippingEstimateDate` (e.g. `5bd`, `30m`). Pickup SLAs must include **`pickupStoreInfo`** (address, `friendlyName`, etc.).
- **SLA** — The simulation handler must respond within **2.5 seconds** or the offer is treated as unavailable.
- **Order placement** — `POST /pvt/orders` with a **JSON array** of orders. For each order, create a **reservation** in your system. The **response** must be the same structure with an added **`orderId`** on each order: that value is your **reservation id** and becomes the **`sellerOrderId`** in later protocol calls (e.g. authorize fulfillment path parameter).
- **Order dispatch (authorize fulfillment)** — After marketplace approval, VTEX calls `POST /pvt/orders/{sellerOrderId}/fulfill` where **`sellerOrderId`** equals the **`orderId`** you returned at placement. Body includes **`marketplaceOrderId`** and **`marketplaceOrderGroup`**. Convert the reservation to a firm order in your system; response body includes `date`, `marketplaceOrderId`, **`orderId`** (seller reference), `receipt`.

### OMS APIs (seller → marketplace)

- Send invoices via `POST /api/oms/pvt/orders/{marketplaceOrderId}/invoice`. Required fields: `type`, `invoiceNumber`, `invoiceValue` (in cents), `issuanceDate`, and `items` array. Path **`marketplaceOrderId`** is the VTEX marketplace order id, not your reservation id.
- Use `type: "Output"` for sales invoices (shipment) and `type: "Input"` for return invoices.
- Send tracking **separately** after the carrier provides it, using `PATCH /api/oms/pvt/orders/{marketplaceOrderId}/invoice/{invoiceNumber}`.
- For split shipments, send **one invoice per package** with only the items in that package. Each `invoiceValue` must reflect only its items.
- Once an order is invoiced, it cannot be canceled without first sending a return invoice (`type: "Input"`).
- The fulfillment simulation endpoint must respond within **2.5 seconds** or the product is considered unavailable.

**Architecture / data flow (high level)**:

```text
VTEX Checkout / indexation          External Seller                    VTEX OMS (marketplace)
       │                                   │                                   │
       │── POST /pvt/orderForms/simulation ▶│  Price, stock, SLAs               │
       │◀── 200 + items + logisticsInfo ───│                                   │
       │                                   │                                   │
       │── POST /pvt/orders (array) ───────▶│  Create reservation               │
       │◀── same + orderId (reservation) ─│                                   │
       │                                   │                                   │
       │── POST /pvt/orders/{id}/fulfill ──▶│  Commit / pick pack               │
       │◀── date, marketplaceOrderId, ... ─│                                   │
       │                                   │── POST .../invoice ────────────────▶│
       │                                   │── PATCH .../invoice/{n} ─────────▶│
```

## Hard constraints

### Constraint: Marketplace order ID in OMS paths

Any `{orderId}` in **`/api/oms/pvt/orders/{orderId}/...`** MUST be the **VTEX marketplace order id** (OMS), not the **`orderId`** you returned at **`POST /pvt/orders`** (reservation id). Map `marketplaceOrderId` from the protocol (placement payload, fulfill body, or events) before calling invoice or tracking APIs.

**Why this matters**

Using the reservation id in OMS URLs fails to match the marketplace order; invoices and tracking never attach to the customer order.

**Detection**

If the same variable is used for both `POST /pvt/orders` response `orderId` and `POST .../oms/.../invoice` without mapping → STOP.

**Correct**

```typescript
// reservationId from your POST /pvt/orders response; marketplaceOrderId from VTEX payload
await omsClient.post(`/api/oms/pvt/orders/${marketplaceOrderId}/invoice`, payload);
```

**Wrong**

```typescript
await omsClient.post(`/api/oms/pvt/orders/${reservationId}/invoice`, payload);
```

---

### Constraint: Fulfillment simulation contract and latency

The seller MUST implement **`POST /pvt/orderForms/simulation`** to return a valid **`items`** array for every request. When the request includes checkout context (e.g. `postalCode`, `clientProfileData`, `shippingData`), the response MUST include aligned **`logisticsInfo`**, **`slas`** for all relevant modes (including pickup when offered), and **`allowMultipleDeliveries`: true** where required. The handler MUST complete within **2.5 seconds**.

**Why this matters**

Incomplete `logisticsInfo` or missing SLAs break checkout shipping selection. Slow responses mark offers unavailable and hurt conversion.

**Detection**

If simulation returns only `items` with prices but omits `logisticsInfo` when the request had `shippingData` → warn. If p95 latency approaches 2s without caching → warn.

**Correct**

```typescript
// Pseudocode: branch on whether checkout context is present
if (hasCheckoutContext(req.body)) {
  return res.json({
    country: req.body.country,
    items: pricedItems,
    logisticsInfo: buildLogisticsPerItem(pricedItems, req.body),
    postalCode: req.body.postalCode,
    allowMultipleDeliveries: true,
  });
}
return res.json({ items: availabilityOnlyItems /* + minimal logistics if required */ });
```

**Wrong**

```typescript
// WRONG: Full checkout body but response omits logisticsInfo / SLAs
res.json({ items: pricedItemsOnly });
```

---

### Constraint: Order placement must return seller `orderId` (reservation)

**`POST /pvt/orders`** accepts a **JSON array** of orders. The response MUST be the same orders with **`orderId`** set on each element to your **reservation identifier** (seller system). VTEX uses that value as **`sellerOrderId`** in **`POST /pvt/orders/{sellerOrderId}/fulfill`**.

**Why this matters**

Omitting or reusing a fake `orderId` breaks the link between marketplace order flow and your reservation and prevents dispatch from routing correctly.

**Detection**

If the handler returns 200 without adding `orderId`, or returns a single object instead of an array → warn.

**Correct**

```typescript
app.post("/pvt/orders", (req, res) => {
  const orders = req.body as Array<Record<string, unknown>>;
  const out = orders.map((order) => {
    const reservationId = createReservation(order);
    return { ...order, orderId: reservationId, followUpEmail: "" };
  });
  res.json(out);
});
```

**Wrong**

```typescript
app.post("/pvt/orders", (req, res) => {
  createReservation(req.body);
  res.status(200).send(); // WRONG: missing orderId echo
});
```

---

### Constraint: Send Correct Invoice Format with All Required Fields

The invoice notification MUST include `type`, `invoiceNumber`, `invoiceValue`, `issuanceDate`, and `items` array. The `invoiceValue` MUST be in cents. The `items` array MUST match the items in the order.

**Why this matters**

Missing required fields cause the API to reject the invoice with 400 Bad Request, leaving the order stuck in "handling" status. Incorrect `invoiceValue` (e.g., using dollars instead of cents) causes financial discrepancies in marketplace reconciliation.

**Detection**

If you see an invoice notification payload missing `invoiceNumber`, `invoiceValue`, `issuanceDate`, or `items` → warn about missing required fields. If `invoiceValue` appears to be in dollars (e.g., `99.90` instead of `9990`) → warn about cents conversion.

**Correct**

```typescript
import axios, { AxiosInstance } from "axios";

interface InvoiceItem {
  id: string;
  quantity: number;
  price: number; // in cents
}

interface InvoicePayload {
  type: "Output" | "Input";
  invoiceNumber: string;
  invoiceValue: number; // total in cents
  issuanceDate: string; // ISO 8601
  invoiceUrl?: string;
  invoiceKey?: string;
  courier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  items: InvoiceItem[];
}

async function sendInvoiceNotification(
  client: AxiosInstance,
  marketplaceOrderId: string,
  invoice: InvoicePayload
): Promise<void> {
  // Validate required fields before sending
  if (!invoice.invoiceNumber) {
    throw new Error("invoiceNumber is required");
  }
  if (!invoice.invoiceValue || invoice.invoiceValue <= 0) {
    throw new Error("invoiceValue must be a positive number in cents");
  }
  if (!invoice.issuanceDate) {
    throw new Error("issuanceDate is required");
  }
  if (!invoice.items || invoice.items.length === 0) {
    throw new Error("items array is required and must not be empty");
  }

  // Warn if invoiceValue looks like it's in dollars instead of cents
  if (invoice.invoiceValue < 100 && invoice.items.length > 0) {
    console.warn(
      `Warning: invoiceValue ${invoice.invoiceValue} seems very low. ` +
        `Ensure it's in cents (e.g., 9990 for $99.90).`
    );
  }

  await client.post(`/api/oms/pvt/orders/${marketplaceOrderId}/invoice`, invoice);
}

// Example usage:
async function invoiceOrder(
  client: AxiosInstance,
  marketplaceOrderId: string
): Promise<void> {
  await sendInvoiceNotification(client, marketplaceOrderId, {
    type: "Output",
    invoiceNumber: "NFE-2026-001234",
    invoiceValue: 15990, // $159.90 in cents
    issuanceDate: new Date().toISOString(),
    invoiceUrl: "https://invoices.example.com/NFE-2026-001234.pdf",
    invoiceKey: "35260614388220000199550010000012341000012348",
    items: [
      { id: "123", quantity: 1, price: 9990 },
      { id: "456", quantity: 2, price: 3000 },
    ],
  });
}
```

**Wrong**

```typescript
// WRONG: Missing required fields, value in dollars instead of cents
async function sendBrokenInvoice(
  client: AxiosInstance,
  marketplaceOrderId: string
): Promise<void> {
  await client.post(`/api/oms/pvt/orders/${marketplaceOrderId}/invoice`, {
    // Missing 'type' field — API may reject or default incorrectly
    invoiceNumber: "001234",
    invoiceValue: 159.9, // WRONG: dollars, not cents — causes financial mismatch
    // Missing 'issuanceDate' — API will reject with 400
    // Missing 'items' — API cannot match invoice to order items
  });
}
```

---

### Constraint: Update Tracking Promptly After Shipping

Tracking information MUST be sent as soon as the carrier provides it. Use `PATCH /api/oms/pvt/orders/{marketplaceOrderId}/invoice/{invoiceNumber}` to add tracking to an existing invoice.

**Why this matters**

Late tracking updates prevent customers from seeing shipment status in the marketplace. The order remains in "invoiced" state instead of progressing to "delivering" and then "delivered". This generates customer support tickets and damages seller reputation.

**Detection**

If you see tracking information being batched for daily updates instead of sent in real-time → warn about prompt tracking updates. If tracking is included in the initial invoice call but the carrier hasn't provided it yet (hardcoded/empty values) → warn.

**Correct**

```typescript
interface TrackingUpdate {
  courier: string;
  trackingNumber: string;
  trackingUrl?: string;
  isDelivered?: boolean;
}

async function updateOrderTracking(
  client: AxiosInstance,
  marketplaceOrderId: string,
  invoiceNumber: string,
  tracking: TrackingUpdate
): Promise<void> {
  await client.patch(
    `/api/oms/pvt/orders/${marketplaceOrderId}/invoice/${invoiceNumber}`,
    tracking
  );
}

// Send tracking as soon as carrier provides it
async function onCarrierPickup(
  client: AxiosInstance,
  marketplaceOrderId: string,
  invoiceNumber: string,
  carrierData: { name: string; trackingId: string; trackingUrl: string }
): Promise<void> {
  await updateOrderTracking(client, marketplaceOrderId, invoiceNumber, {
    courier: carrierData.name,
    trackingNumber: carrierData.trackingId,
    trackingUrl: carrierData.trackingUrl,
  });
  console.log(
    `Tracking updated for marketplace order ${marketplaceOrderId}: ${carrierData.trackingId}`
  );
}

// Update delivery status when confirmed
async function onDeliveryConfirmed(
  client: AxiosInstance,
  marketplaceOrderId: string,
  invoiceNumber: string
): Promise<void> {
  await updateOrderTracking(client, marketplaceOrderId, invoiceNumber, {
    courier: "",
    trackingNumber: "",
    isDelivered: true,
  });
  console.log(`Marketplace order ${marketplaceOrderId} marked as delivered`);
}
```

**Wrong**

```typescript
// WRONG: Sending empty/fake tracking data with the invoice
async function invoiceWithFakeTracking(
  client: AxiosInstance,
  marketplaceOrderId: string
): Promise<void> {
  await client.post(`/api/oms/pvt/orders/${marketplaceOrderId}/invoice`, {
    type: "Output",
    invoiceNumber: "NFE-001",
    invoiceValue: 9990,
    issuanceDate: new Date().toISOString(),
    items: [{ id: "123", quantity: 1, price: 9990 }],
    // WRONG: Hardcoded tracking — carrier hasn't picked up yet
    courier: "TBD",
    trackingNumber: "PENDING",
    trackingUrl: "",
  });
  // Customer sees "PENDING" as tracking number — useless information
}
```

---

### Constraint: Handle Partial Invoicing for Split Shipments

For orders shipped in multiple packages, each shipment MUST have its own invoice with only the items included in that package. The `invoiceValue` MUST reflect only the items in that particular shipment.

**Why this matters**

Sending a single invoice for the full order value when only partial items are shipped causes financial discrepancies. The marketplace cannot reconcile payments correctly, and the order status may not progress properly.

**Detection**

If you see a single invoice being sent with the full order value for partial shipments → warn about partial invoicing. If the items array doesn't match the actual items being shipped → warn.

**Correct**

```typescript
interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number; // per unit in cents
}

interface Shipment {
  items: OrderItem[];
  invoiceNumber: string;
}

async function sendPartialInvoices(
  client: AxiosInstance,
  marketplaceOrderId: string,
  shipments: Shipment[]
): Promise<void> {
  for (const shipment of shipments) {
    // Calculate value for only the items in this shipment
    const shipmentValue = shipment.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );

    await sendInvoiceNotification(client, marketplaceOrderId, {
      type: "Output",
      invoiceNumber: shipment.invoiceNumber,
      invoiceValue: shipmentValue,
      issuanceDate: new Date().toISOString(),
      items: shipment.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
      })),
    });

    console.log(
      `Partial invoice ${shipment.invoiceNumber} sent for marketplace order ${marketplaceOrderId}: ` +
        `${shipment.items.length} items, value=${shipmentValue}`
    );
  }
}

// Example: Order with 3 items shipped in 2 packages
await sendPartialInvoices(client, "vtex-marketplace-order-id-12345", [
  {
    invoiceNumber: "NFE-001-A",
    items: [
      { id: "sku-1", name: "Laptop", quantity: 1, price: 250000 },
    ],
  },
  {
    invoiceNumber: "NFE-001-B",
    items: [
      { id: "sku-2", name: "Mouse", quantity: 1, price: 5000 },
      { id: "sku-3", name: "Keyboard", quantity: 1, price: 12000 },
    ],
  },
]);
```

**Wrong**

```typescript
// WRONG: Sending full order value for partial shipment
async function wrongPartialInvoice(
  client: AxiosInstance,
  marketplaceOrderId: string,
  totalOrderValue: number,
  shippedItems: OrderItem[]
): Promise<void> {
  await client.post(`/api/oms/pvt/orders/${marketplaceOrderId}/invoice`, {
    type: "Output",
    invoiceNumber: "NFE-001-A",
    invoiceValue: totalOrderValue, // WRONG: Full order value, not partial
    issuanceDate: new Date().toISOString(),
    items: shippedItems.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      price: item.price,
    })),
    // invoiceValue doesn't match sum of items — financial mismatch
  });
}
```

## Preferred pattern

### Implement fulfillment simulation

Register **`POST /pvt/orderForms/simulation`**. Parse **`items[]`** (`id` = seller SKU, `seller` = seller id on marketplace). If the body has **no** `postalCode` / `clientProfileData`, treat as **indexation**: return availability (and minimal logistics if your contract requires it). If the body includes **checkout** fields, build **`logisticsInfo`** per `itemIndex`, populate **`slas`** (delivery + pickup-in-point with `pickupStoreInfo` when applicable), **`deliveryChannels`**, **`stockBalance`**, set **`country`** / **`postalCode`**, and **`allowMultipleDeliveries`: true**. Keep CPU and I/O bounded so you stay **under 2.5s**.

```typescript
import { RequestHandler } from "express";

const fulfillmentSimulation: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const items = body.items as Array<{ id: string; quantity: number; seller: string }>;
  const hasCheckoutContext = Boolean(body.postalCode && body.shippingData);

  const pricedItems = await priceAndStockForItems(items);

  if (!hasCheckoutContext) {
    res.json({ items: pricedItems, logisticsInfo: minimalLogistics(pricedItems) });
    return;
  }

  res.json({
    country: body.country,
    postalCode: body.postalCode,
    items: pricedItems,
    logisticsInfo: buildFullLogistics(pricedItems, body),
    allowMultipleDeliveries: true,
  });
};

function minimalLogistics(
  pricedItems: Array<{ id: string; requestIndex: number }>
): unknown[] {
  return pricedItems.map((_, i) => ({
    itemIndex: i,
    quantity: 1,
    shipsTo: ["USA"],
    slas: [],
    stockBalance: "",
    deliveryChannels: [{ id: "delivery", stockBalance: "" }],
  }));
}

function buildFullLogistics(
  pricedItems: Array<{ id: string; requestIndex: number }>,
  _checkoutBody: unknown
): unknown[] {
  // Replace with SLA / carrier rules derived from checkoutBody
  return pricedItems.map((_, i) => ({
    itemIndex: i,
    quantity: 1,
    shipsTo: ["USA"],
    slas: [],
    stockBalance: 0,
    deliveryChannels: [],
  }));
}

async function priceAndStockForItems(
  items: Array<{ id: string; quantity: number; seller: string }>
): Promise<Array<Record<string, unknown>>> {
  return items.map((item, requestIndex) => ({
    id: item.id,
    quantity: item.quantity,
    seller: item.seller,
    measurementUnit: "un",
    merchantName: null,
    price: 0,
    priceTags: [],
    priceValidUntil: null,
    requestIndex,
    unitMultiplier: 1,
    attachmentOfferings: [],
  }));
}
```

### Implement order placement (reservation)

Register **`POST /pvt/orders`**. Body is an **array**. Persist each order as a **reservation**; respond with the **same** objects plus **`orderId`** (reservation key) and typically **`followUpEmail`**. That **`orderId`** is what VTEX passes as **`sellerOrderId`** on **`POST /pvt/orders/{sellerOrderId}/fulfill`**.

```typescript
import { RequestHandler } from "express";

function createReservation(_order: Record<string, unknown>): string {
  return `res-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const orderPlacement: RequestHandler = (req, res) => {
  const orders = req.body as Array<Record<string, unknown>>;
  const out = orders.map((order) => ({
    ...order,
    orderId: createReservation(order),
    followUpEmail: "",
  }));
  res.json(out);
};
```

### Implement the Authorize Fulfillment Endpoint

The marketplace calls this endpoint when payment is approved.

```typescript
import express, { RequestHandler } from "express";

interface FulfillOrderRequest {
  marketplaceOrderId: string;
  marketplaceOrderGroup: string;
}

interface OrderMapping {
  /** Same id returned as orderId from POST /pvt/orders (reservation) */
  sellerOrderId: string;
  marketplaceOrderId: string;
  items: OrderItem[];
  status: string;
}

// Store for order mappings — use a real database in production
const orderStore = new Map<string, OrderMapping>();

const authorizeFulfillmentHandler: RequestHandler = async (req, res) => {
  const sellerOrderId = req.params.sellerOrderId;
  const { marketplaceOrderId, marketplaceOrderGroup }: FulfillOrderRequest = req.body;

  console.log(
    `Fulfillment authorized: reservation=${sellerOrderId}, marketplaceOrder=${marketplaceOrderId}, group=${marketplaceOrderGroup}`
  );

  // Store the marketplace order ID mapping
  const order = orderStore.get(sellerOrderId);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  order.marketplaceOrderId = marketplaceOrderId;
  order.status = "fulfillment_authorized";
  orderStore.set(sellerOrderId, order);

  // Trigger fulfillment process asynchronously
  enqueueFulfillment(sellerOrderId).catch(console.error);

  res.status(200).json({
    date: new Date().toISOString(),
    marketplaceOrderId,
    // Echo seller reservation id (same as path param / placement orderId)
    orderId: sellerOrderId,
    receipt: null,
  });
};

async function enqueueFulfillment(sellerOrderId: string): Promise<void> {
  console.log(`Enqueued fulfillment for ${sellerOrderId}`);
}

const app = express();
app.use(express.json());
app.post("/pvt/orders/:sellerOrderId/fulfill", authorizeFulfillmentHandler);
```

### Send Invoice After Fulfillment

Once the order is packed and the invoice is generated, send the invoice notification.

```typescript
async function fulfillAndInvoice(
  client: AxiosInstance,
  order: OrderMapping
): Promise<void> {
  // Generate invoice from your invoicing system
  const invoice = await generateInvoice(order);

  // Send invoice notification to VTEX marketplace
  await sendInvoiceNotification(client, order.marketplaceOrderId, {
    type: "Output",
    invoiceNumber: invoice.number,
    invoiceValue: invoice.totalCents,
    issuanceDate: invoice.issuedAt.toISOString(),
    invoiceUrl: invoice.pdfUrl,
    invoiceKey: invoice.accessKey,
    items: order.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      price: item.price,
    })),
  });

  console.log(
    `Invoice ${invoice.number} sent for order ${order.marketplaceOrderId}`
  );
}

async function generateInvoice(order: OrderMapping): Promise<{
  number: string;
  totalCents: number;
  issuedAt: Date;
  pdfUrl: string;
  accessKey: string;
}> {
  const totalCents = order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  return {
    number: `NFE-${Date.now()}`,
    totalCents,
    issuedAt: new Date(),
    pdfUrl: `https://invoices.example.com/NFE-${Date.now()}.pdf`,
    accessKey: "35260614388220000199550010000012341000012348",
  };
}
```

### Send Tracking When Carrier Picks Up

```typescript
async function handleCarrierPickup(
  client: AxiosInstance,
  marketplaceOrderId: string,
  invoiceNumber: string,
  carrier: { name: string; trackingId: string; trackingUrl: string }
): Promise<void> {
  await updateOrderTracking(client, marketplaceOrderId, invoiceNumber, {
    courier: carrier.name,
    trackingNumber: carrier.trackingId,
    trackingUrl: carrier.trackingUrl,
  });

  console.log(
    `Tracking ${carrier.trackingId} sent for marketplace order ${marketplaceOrderId}`
  );
}
```

### Confirm Delivery

```typescript
async function handleDeliveryConfirmation(
  client: AxiosInstance,
  marketplaceOrderId: string,
  invoiceNumber: string
): Promise<void> {
  await client.patch(
    `/api/oms/pvt/orders/${marketplaceOrderId}/invoice/${invoiceNumber}`,
    {
      isDelivered: true,
      courier: "",
      trackingNumber: "",
    }
  );

  console.log(`Marketplace order ${marketplaceOrderId} marked as delivered`);
}
```

### Complete Example

```typescript
import axios, { AxiosInstance } from "axios";

function createMarketplaceClient(
  accountName: string,
  appKey: string,
  appToken: string
): AxiosInstance {
  return axios.create({
    baseURL: `https://${accountName}.vtexcommercestable.com.br`,
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-API-AppKey": appKey,
      "X-VTEX-API-AppToken": appToken,
    },
    timeout: 10000,
  });
}

async function completeFulfillmentFlow(
  client: AxiosInstance,
  order: OrderMapping
): Promise<void> {
  // 1. Fulfill and invoice
  await fulfillAndInvoice(client, order);

  // 2. When carrier picks up, send tracking
  const carrierData = await waitForCarrierPickup(order.sellerOrderId);
  const invoice = await getLatestInvoice(order.sellerOrderId);

  await handleCarrierPickup(
    client,
    order.marketplaceOrderId,
    invoice.number,
    carrierData
  );

  // 3. When delivered, confirm
  await waitForDeliveryConfirmation(order.sellerOrderId);
  await handleDeliveryConfirmation(
    client,
    order.marketplaceOrderId,
    invoice.number
  );
}

async function waitForCarrierPickup(
  sellerOrderId: string
): Promise<{ name: string; trackingId: string; trackingUrl: string }> {
  // Replace with actual carrier integration
  return {
    name: "Correios",
    trackingId: "BR123456789",
    trackingUrl: "https://tracking.example.com/BR123456789",
  };
}

async function getLatestInvoice(
  sellerOrderId: string
): Promise<{ number: string }> {
  // Replace with actual invoice lookup
  return { number: `NFE-${sellerOrderId}` };
}

async function waitForDeliveryConfirmation(
  sellerOrderId: string
): Promise<void> {
  // Replace with actual delivery confirmation logic
  console.log(`Waiting for delivery confirmation: ${sellerOrderId}`);
}
```

## Common failure modes

- **Treating indexation simulation like checkout.** The same endpoint receives **minimal** bodies (no customer location) during indexation and **rich** bodies during checkout. Returning checkout-grade `logisticsInfo` for minimal calls can be unnecessary work; returning **only** prices for checkout calls **without** SLAs and `logisticsInfo` breaks shipping selection.

- **Omitting `orderId` on order placement.** VTEX expects an **array** response echoing each order with **`orderId`** set to your reservation. Empty 200 responses or missing `orderId` strand the order pipeline.

- **Using reservation `orderId` in OMS invoice URLs.** After placement, you must use **`marketplaceOrderId`** from the protocol when calling **`/api/oms/pvt/orders/...`**. Confusing the two ids produces 404 or silent failure on invoice/tracking.

- **Sending invoice before fulfillment authorization.** The seller sends an invoice notification immediately when the order is placed, before receiving the Authorize Fulfillment callback from the marketplace. Payment may still be pending or under review. Invoicing before authorization can result in the invoice being rejected or the order being in an inconsistent state. Only send the invoice after receiving `POST /pvt/orders/{sellerOrderId}/fulfill`.

- **Not handling return invoices for cancellation.** A seller tries to cancel an invoiced order by calling the Cancel Order endpoint directly without first sending a return invoice. Once an order is in "invoiced" status, it cannot be canceled without a return invoice (`type: "Input"`). The Cancel Order API will reject the request.

```typescript
// Correct: Send return invoice before canceling an invoiced order
async function cancelInvoicedOrder(
  client: AxiosInstance,
  marketplaceOrderId: string,
  originalItems: InvoiceItem[],
  originalInvoiceValue: number
): Promise<void> {
  // Step 1: Send return invoice (type: "Input")
  await sendInvoiceNotification(client, marketplaceOrderId, {
    type: "Input", // Return invoice
    invoiceNumber: `RET-${Date.now()}`,
    invoiceValue: originalInvoiceValue,
    issuanceDate: new Date().toISOString(),
    items: originalItems,
  });

  // Step 2: Now cancel the order
  await client.post(
    `/api/marketplace/pvt/orders/${marketplaceOrderId}/cancel`,
    { reason: "Customer requested return" }
  );
}
```

- **Fulfillment simulation exceeding the 2.5-second timeout.** The seller's fulfillment simulation endpoint performs complex database queries or external API calls that exceed the response time limit. VTEX marketplaces wait a maximum of **2.5 seconds** for a fulfillment simulation response. After that, the product is considered unavailable/inactive and won't appear in the storefront or checkout. Pre-cache price and inventory data.

## Review checklist

- [ ] Does **`POST /pvt/orderForms/simulation`** handle both minimal (indexation) and checkout-shaped requests, returning **`logisticsInfo`** and **`slas`** when context is present?
- [ ] Does **`POST /pvt/orders`** accept an array and return each order with **`orderId`** (reservation id)?
- [ ] Does **`POST /pvt/orders/{sellerOrderId}/fulfill`** read **`marketplaceOrderId`** and **`marketplaceOrderGroup`** and match **`sellerOrderId`** to the reservation from placement?
- [ ] Are OMS **`/invoice`** and **`PATCH .../invoice`** calls using **`marketplaceOrderId`**, not the reservation id?
- [ ] Does the seller only begin physical fulfillment after receiving the Authorize Fulfillment callback?
- [ ] For **IO/BFF** connectors: are **caching** and **route** choices aligned with **vtex-io** skills (simulation **SLA**, data **scope**)?
- [ ] Does the invoice payload include all required fields (`type`, `invoiceNumber`, `invoiceValue`, `issuanceDate`, `items`)?
- [ ] Is `invoiceValue` in cents (not dollars)?
- [ ] Is tracking sent separately after the carrier provides real data (not hardcoded placeholders)?
- [ ] For split shipments, does each invoice cover only its package's items and value?
- [ ] Is cancellation of invoiced orders handled via return invoice (`type: "Input"`) first?
- [ ] Does the fulfillment simulation endpoint respond within **2.5 seconds**?

## Reference

- [External Seller integration guide](https://developers.vtex.com/docs/guides/external-seller-integration-connector) — End-to-end seller connector (fulfillment URL, orders, invoicing)
- [Marketplace Protocol — External seller fulfillment](https://developers.vtex.com/docs/api-reference/marketplace-protocol-external-seller-fulfillment) — Simulation, order placement, authorize fulfillment, and related endpoints
- [External Seller Connector — Order invoicing](https://developers.vtex.com/docs/guides/external-seller-integration-connector#order-invoicing) — When and how to notify invoices to the marketplace OMS
- [Order Invoice Notification API](https://developers.vtex.com/docs/api-reference/orders-api#post-/api/oms/pvt/orders/-orderId-/invoice) — `POST` invoice to OMS (`orderId` in path = marketplace order)
- [Update Order Tracking API](https://developers.vtex.com/docs/api-reference/orders-api#patch-/api/oms/pvt/orders/-orderId-/invoice/-invoiceNumber-) — `PATCH` tracking on an invoice
- [Order Flow and Status](https://help.vtex.com/en/docs/tutorials/order-flow-and-status) — Order status lifecycle

VTEX also maintains an open **reference implementation** for the External Seller service under the **`vtex-apps/external-seller-example`** GitHub repository (useful as a scaffold; align behavior with the official protocol docs above).
