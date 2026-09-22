This skill provides guidance for AI agents working with VTEX Marketplace Integration. Apply these constraints and patterns when assisting developers with apply when implementing order integration hooks, feeds, or webhook handlers for VTEX marketplace connectors. Covers Feed v3 (pull) vs Hook (push), filter types (FromWorkflow and FromOrders), order status lifecycle, payload validation, and idempotent processing. Use for building order integrations between VTEX marketplaces and external systems such as ERPs, WMS, or fulfillment services.

# Order Integration & Webhooks

## When this skill applies

Use this skill when building an integration that needs to react to order status changes in a VTEX marketplace — such as syncing orders to an ERP, triggering fulfillment workflows, or sending notifications to external systems.

- Configuring Feed v3 or Hook for order updates
- Choosing between Feed (pull) and Hook (push) delivery models
- Validating webhook authentication and processing events idempotently
- Handling the complete order status lifecycle

Do not use this skill for:
- Catalog or SKU synchronization (see `marketplace-catalog-sync`)
- Invoice and tracking submission (see `marketplace-fulfillment`)
- General API rate limiting (see `marketplace-rate-limiting`)

## Decision rules

- Use **Hook (push)** for high-performance middleware that needs real-time order updates. Your endpoint must respond with HTTP 200 within 5000ms.
- Use **Feed (pull)** for ERPs or systems with limited throughput where you control the consumption pace. Events persist in a queue until committed.
- Use **Feed as a backup** alongside Hook to catch events missed during downtime.
- Use **FromWorkflow** filter when you only need to react to order status changes (simpler, most common).
- Use **FromOrders** filter when you need to filter by any order property using JSONata expressions (e.g., by sales channel).
- The two filter types are **mutually exclusive**. Using both in the same configuration request returns `409 Conflict`.
- Each appKey can configure only one feed and one hook. Different users sharing the same appKey access the same feed/hook.

| | Feed | Hook |
|---|---|---|
| Model | Pull (active) | Push (reactive) |
| Scalability | You control volume | Must handle any volume |
| Reliability | Events persist in queue | Must be always available |
| Best for | ERPs with limited throughput | High-performance middleware |

**Hook Notification Payload**:

```json
{
  "Domain": "Marketplace",
  "OrderId": "v40484048naf-01",
  "State": "payment-approved",
  "LastChange": "2019-07-29T23:17:30.0617185Z",
  "Origin": {
    "Account": "accountABC",
    "Key": "vtexappkey-keyEDF"
  }
}
```

The payload contains only the order ID and state — not the full order data. Your integration must call `GET /api/oms/pvt/orders/{orderId}` to retrieve complete order details.

**Architecture/Data Flow**:

```text
VTEX OMS                           Your Integration
   │                                       │
   │── Order status change ──────────────▶│  (Hook POST to your URL)
   │                                       │── Validate auth headers
   │                                       │── Check idempotency (orderId + State)
   │◀── GET /api/oms/pvt/orders/{id} ─────│  (Fetch full order)
   │── Full order data ──────────────────▶│
   │                                       │── Process order
   │◀── HTTP 200 ─────────────────────────│  (Must respond within 5000ms)
```

## Hard constraints

### Constraint: Validate Webhook Authentication

Your hook endpoint MUST validate the authentication headers sent by VTEX before processing any event. The `Origin.Account` and `Origin.Key` fields in the payload must match your expected values.

**Why this matters**

Without auth validation, any actor can send fake order events to your endpoint, triggering unauthorized fulfillment actions, data corruption, or financial losses.

**Detection**

If you see a hook endpoint handler that processes events without checking `Origin.Account`, `Origin.Key`, or custom headers → STOP and add authentication validation.

**Correct**

```typescript
import { RequestHandler } from "express";

interface HookPayload {
  Domain: string;
  OrderId: string;
  State: string;
  LastChange: string;
  Origin: {
    Account: string;
    Key: string;
  };
}

interface HookConfig {
  expectedAccount: string;
  expectedAppKey: string;
  customHeaderKey: string;
  customHeaderValue: string;
}

function createHookHandler(config: HookConfig): RequestHandler {
  return async (req, res) => {
    const payload: HookPayload = req.body;

    // Handle VTEX ping during hook configuration
    if (payload && "hookConfig" in payload) {
      res.status(200).json({ success: true });
      return;
    }

    // Validate Origin credentials
    if (
      payload.Origin?.Account !== config.expectedAccount ||
      payload.Origin?.Key !== config.expectedAppKey
    ) {
      console.error("Unauthorized hook event", {
        receivedAccount: payload.Origin?.Account,
        receivedKey: payload.Origin?.Key,
      });
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Validate custom header (configured during hook setup)
    if (req.headers[config.customHeaderKey.toLowerCase()] !== config.customHeaderValue) {
      console.error("Invalid custom header");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Process the event
    await processOrderEvent(payload);
    res.status(200).json({ success: true });
  };
}

async function processOrderEvent(payload: HookPayload): Promise<void> {
  console.log(`Processing order ${payload.OrderId} in state ${payload.State}`);
}
```

**Wrong**

```typescript
// WRONG: No authentication validation — accepts events from anyone
const unsafeHookHandler: RequestHandler = async (req, res) => {
  const payload: HookPayload = req.body;

  // Directly processing without checking Origin or headers
  // Any actor can POST fake events and trigger unauthorized actions
  await processOrderEvent(payload);
  res.status(200).json({ success: true });
};
```

---

### Constraint: Process Events Idempotently

Your integration MUST process order events idempotently. Use the combination of `OrderId` + `State` + `LastChange` as a deduplication key to prevent duplicate processing.

**Why this matters**

VTEX may deliver the same hook notification multiple times (at-least-once delivery). Without idempotency, duplicate processing can result in double fulfillment, duplicate invoices, or inconsistent state.

**Detection**

If you see an order event handler without an `orderId` duplicate check or deduplication mechanism → warn about idempotency. If the handler directly mutates state without checking if the event was already processed → warn.

**Correct**

```typescript
interface ProcessedEvent {
  orderId: string;
  state: string;
  lastChange: string;
  processedAt: Date;
}

// In-memory store for example — use Redis or database in production
const processedEvents = new Map<string, ProcessedEvent>();

function buildDeduplicationKey(payload: HookPayload): string {
  return `${payload.OrderId}:${payload.State}:${payload.LastChange}`;
}

async function idempotentProcessEvent(payload: HookPayload): Promise<boolean> {
  const deduplicationKey = buildDeduplicationKey(payload);

  // Check if this exact event was already processed
  if (processedEvents.has(deduplicationKey)) {
    console.log(`Event already processed: ${deduplicationKey}`);
    return false; // Skip — already handled
  }

  // Mark as processing (with TTL in production)
  processedEvents.set(deduplicationKey, {
    orderId: payload.OrderId,
    state: payload.State,
    lastChange: payload.LastChange,
    processedAt: new Date(),
  });

  try {
    await handleOrderStateChange(payload.OrderId, payload.State);
    return true;
  } catch (error) {
    // Remove from processed set so it can be retried
    processedEvents.delete(deduplicationKey);
    throw error;
  }
}

async function handleOrderStateChange(orderId: string, state: string): Promise<void> {
  switch (state) {
    case "ready-for-handling":
      await startOrderFulfillment(orderId);
      break;
    case "handling":
      await updateOrderInERP(orderId, "in_progress");
      break;
    case "invoiced":
      await confirmOrderShipped(orderId);
      break;
    case "cancel":
      await cancelOrderInERP(orderId);
      break;
    default:
      console.log(`Unhandled state: ${state} for order ${orderId}`);
  }
}

async function startOrderFulfillment(orderId: string): Promise<void> {
  console.log(`Starting fulfillment for ${orderId}`);
}

async function updateOrderInERP(orderId: string, status: string): Promise<void> {
  console.log(`Updating ERP: ${orderId} → ${status}`);
}

async function confirmOrderShipped(orderId: string): Promise<void> {
  console.log(`Confirming shipment for ${orderId}`);
}

async function cancelOrderInERP(orderId: string): Promise<void> {
  console.log(`Canceling order ${orderId} in ERP`);
}
```

**Wrong**

```typescript
// WRONG: No deduplication — processes every event even if already handled
async function processWithoutIdempotency(payload: HookPayload): Promise<void> {
  // If VTEX sends the same event twice, this creates duplicate records
  await database.insert("fulfillment_tasks", {
    orderId: payload.OrderId,
    state: payload.State,
    createdAt: new Date(),
  });

  // Duplicate fulfillment task created — items may ship twice
  await triggerFulfillment(payload.OrderId);
}

async function triggerFulfillment(orderId: string): Promise<void> {
  console.log(`Fulfilling ${orderId}`);
}

const database = {
  insert: async (table: string, data: Record<string, unknown>) => {
    console.log(`Inserting into ${table}:`, data);
  },
};
```

---

### Constraint: Handle All Order Statuses

Your integration MUST handle all possible order statuses, including `Status Null`. Unrecognized statuses must be logged but not crash the integration.

**Why this matters**

VTEX documents warn that `Status Null` may be unidentified and end up being mapped as another status, potentially leading to errors. Missing a status in your handler can cause orders to get stuck or lost.

**Detection**

If you see a status handler that only covers 2-3 statuses without a default/fallback case → warn about incomplete status handling.

**Correct**

```typescript
type OrderStatus =
  | "order-created"
  | "order-completed"
  | "on-order-completed"
  | "payment-pending"
  | "waiting-for-order-authorization"
  | "approve-payment"
  | "payment-approved"
  | "payment-denied"
  | "request-cancel"
  | "waiting-for-seller-decision"
  | "authorize-fulfillment"
  | "order-create-error"
  | "order-creation-error"
  | "window-to-cancel"
  | "ready-for-handling"
  | "start-handling"
  | "handling"
  | "invoice-after-cancellation-deny"
  | "order-accepted"
  | "invoiced"
  | "cancel"
  | "canceled";

async function handleAllStatuses(orderId: string, state: string): Promise<void> {
  switch (state) {
    case "ready-for-handling":
    case "start-handling":
      await notifyWarehouse(orderId, "prepare");
      break;

    case "handling":
      await updateFulfillmentStatus(orderId, "in_progress");
      break;

    case "invoiced":
      await markAsShipped(orderId);
      break;

    case "cancel":
    case "canceled":
    case "request-cancel":
      await handleCancellation(orderId, state);
      break;

    case "payment-approved":
      await confirmPaymentReceived(orderId);
      break;

    case "payment-denied":
      await handlePaymentFailure(orderId);
      break;

    default:
      // CRITICAL: Log unknown statuses instead of crashing
      console.warn(`Unknown or unhandled order status: "${state}" for order ${orderId}`);
      await logUnhandledStatus(orderId, state);
      break;
  }
}

async function notifyWarehouse(orderId: string, action: string): Promise<void> {
  console.log(`Warehouse notification: ${orderId} → ${action}`);
}
async function updateFulfillmentStatus(orderId: string, status: string): Promise<void> {
  console.log(`Fulfillment status: ${orderId} → ${status}`);
}
async function markAsShipped(orderId: string): Promise<void> {
  console.log(`Shipped: ${orderId}`);
}
async function handleCancellation(orderId: string, state: string): Promise<void> {
  console.log(`Cancellation: ${orderId} (${state})`);
}
async function confirmPaymentReceived(orderId: string): Promise<void> {
  console.log(`Payment received: ${orderId}`);
}
async function handlePaymentFailure(orderId: string): Promise<void> {
  console.log(`Payment failed: ${orderId}`);
}
async function logUnhandledStatus(orderId: string, state: string): Promise<void> {
  console.log(`UNHANDLED: ${orderId} → ${state}`);
}
```

**Wrong**

```typescript
// WRONG: Only handles 2 statuses, no fallback for unknown statuses
async function incompleteHandler(orderId: string, state: string): Promise<void> {
  if (state === "ready-for-handling") {
    await startOrderFulfillment(orderId);
  } else if (state === "invoiced") {
    await confirmOrderShipped(orderId);
  }
  // All other statuses silently ignored — orders get lost
  // "cancel" events never processed — canceled orders still ship
  // "Status Null" could be misinterpreted
}
```

## Preferred pattern

### Configure the Hook

Set up the hook with appropriate filters and your endpoint URL.

```typescript
import axios, { AxiosInstance } from "axios";

interface HookSetupConfig {
  accountName: string;
  appKey: string;
  appToken: string;
  hookUrl: string;
  hookHeaderKey: string;
  hookHeaderValue: string;
  filterStatuses: string[];
}

async function configureOrderHook(config: HookSetupConfig): Promise<void> {
  const client: AxiosInstance = axios.create({
    baseURL: `https://${config.accountName}.vtexcommercestable.com.br`,
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-API-AppKey": config.appKey,
      "X-VTEX-API-AppToken": config.appToken,
    },
  });

  const hookConfig = {
    filter: {
      type: "FromWorkflow",
      status: config.filterStatuses,
    },
    hook: {
      url: config.hookUrl,
      headers: {
        [config.hookHeaderKey]: config.hookHeaderValue,
      },
    },
  };

  await client.post("/api/orders/hook/config", hookConfig);
  console.log("Hook configured successfully");
}

// Example usage:
await configureOrderHook({
  accountName: "mymarketplace",
  appKey: process.env.VTEX_APP_KEY!,
  appToken: process.env.VTEX_APP_TOKEN!,
  hookUrl: "https://my-integration.example.com/vtex/order-hook",
  hookHeaderKey: "X-Integration-Secret",
  hookHeaderValue: process.env.HOOK_SECRET!,
  filterStatuses: [
    "ready-for-handling",
    "start-handling",
    "handling",
    "invoiced",
    "cancel",
  ],
});
```

### Build the Hook Endpoint with Auth and Idempotency

```typescript
import express from "express";

const app = express();
app.use(express.json());

const hookConfig: HookConfig = {
  expectedAccount: process.env.VTEX_ACCOUNT_NAME!,
  expectedAppKey: process.env.VTEX_APP_KEY!,
  customHeaderKey: "X-Integration-Secret",
  customHeaderValue: process.env.HOOK_SECRET!,
};

app.post("/vtex/order-hook", createHookHandler(hookConfig));

// The createHookHandler and idempotentProcessEvent functions
// from the Hard constraints section above handle auth + deduplication
```

### Fetch Full Order Data and Process

After receiving the hook notification, fetch the complete order data for processing.

```typescript
interface VtexOrder {
  orderId: string;
  status: string;
  items: Array<{
    id: string;
    productId: string;
    name: string;
    quantity: number;
    price: number;
    sellingPrice: number;
  }>;
  clientProfileData: {
    email: string;
    firstName: string;
    lastName: string;
    document: string;
  };
  shippingData: {
    address: {
      postalCode: string;
      city: string;
      state: string;
      country: string;
      street: string;
      number: string;
    };
    logisticsInfo: Array<{
      itemIndex: number;
      selectedSla: string;
      shippingEstimate: string;
    }>;
  };
  totals: Array<{
    id: string;
    name: string;
    value: number;
  }>;
  value: number;
}

async function fetchAndProcessOrder(
  client: AxiosInstance,
  orderId: string,
  state: string
): Promise<void> {
  const response = await client.get<VtexOrder>(
    `/api/oms/pvt/orders/${orderId}`
  );
  const order = response.data;

  switch (state) {
    case "ready-for-handling":
      await createFulfillmentTask({
        orderId: order.orderId,
        items: order.items.map((item) => ({
          skuId: item.id,
          name: item.name,
          quantity: item.quantity,
        })),
        shippingAddress: order.shippingData.address,
        estimatedDelivery: order.shippingData.logisticsInfo[0]?.shippingEstimate,
      });
      break;

    case "cancel":
      await cancelFulfillmentTask(order.orderId);
      break;

    default:
      console.log(`Order ${orderId}: state=${state}, no action needed`);
  }
}

async function createFulfillmentTask(task: Record<string, unknown>): Promise<void> {
  console.log("Creating fulfillment task:", task);
}

async function cancelFulfillmentTask(orderId: string): Promise<void> {
  console.log("Canceling fulfillment task:", orderId);
}
```

### Implement Feed as Fallback

Use Feed v3 as a backup to catch any events the hook might miss during downtime.

```typescript
async function pollFeedAsBackup(client: AxiosInstance): Promise<void> {
  const feedResponse = await client.get<Array<{
    eventId: string;
    handle: string;
    domain: string;
    state: string;
    orderId: string;
    lastChange: string;
  }>>("/api/orders/feed");

  const events = feedResponse.data;

  if (events.length === 0) {
    return; // No events in queue
  }

  const handlesToCommit: string[] = [];

  for (const event of events) {
    try {
      await fetchAndProcessOrder(client, event.orderId, event.state);
      handlesToCommit.push(event.handle);
    } catch (error) {
      console.error(`Failed to process feed event for ${event.orderId}:`, error);
      // Don't commit failed events — they'll return to the queue after visibility timeout
    }
  }

  // Commit successfully processed events
  if (handlesToCommit.length > 0) {
    await client.post("/api/orders/feed", {
      handles: handlesToCommit,
    });
  }
}

// Run feed polling on a schedule (e.g., every 2 minutes)
setInterval(async () => {
  try {
    const client = createVtexClient();
    await pollFeedAsBackup(client);
  } catch (error) {
    console.error("Feed polling error:", error);
  }
}, 120000); // 2 minutes

function createVtexClient(): AxiosInstance {
  return axios.create({
    baseURL: `https://${process.env.VTEX_ACCOUNT_NAME}.vtexcommercestable.com.br`,
    headers: {
      "X-VTEX-API-AppKey": process.env.VTEX_APP_KEY!,
      "X-VTEX-API-AppToken": process.env.VTEX_APP_TOKEN!,
    },
  });
}
```

### Complete Example

```typescript
import express from "express";
import axios, { AxiosInstance } from "axios";

// 1. Configure hook
async function setupIntegration(): Promise<void> {
  await configureOrderHook({
    accountName: process.env.VTEX_ACCOUNT_NAME!,
    appKey: process.env.VTEX_APP_KEY!,
    appToken: process.env.VTEX_APP_TOKEN!,
    hookUrl: `${process.env.BASE_URL}/vtex/order-hook`,
    hookHeaderKey: "X-Integration-Secret",
    hookHeaderValue: process.env.HOOK_SECRET!,
    filterStatuses: [
      "ready-for-handling",
      "handling",
      "invoiced",
      "cancel",
    ],
  });
}

// 2. Start webhook server
const app = express();
app.use(express.json());

const hookHandler = createHookHandler({
  expectedAccount: process.env.VTEX_ACCOUNT_NAME!,
  expectedAppKey: process.env.VTEX_APP_KEY!,
  customHeaderKey: "X-Integration-Secret",
  customHeaderValue: process.env.HOOK_SECRET!,
});

app.post("/vtex/order-hook", hookHandler);

// 3. Health check for VTEX ping
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

// 4. Start feed polling as backup
setInterval(async () => {
  try {
    const client = createVtexClient();
    await pollFeedAsBackup(client);
  } catch (error) {
    console.error("Feed backup polling error:", error);
  }
}, 120000);

app.listen(3000, () => {
  console.log("Order integration running on port 3000");
  setupIntegration().catch(console.error);
});
```

## Common failure modes

- **Using List Orders API instead of Feed/Hook.** The `GET /api/oms/pvt/orders` endpoint depends on indexing, which can lag behind real-time updates. It's slower, less reliable, and more likely to hit rate limits when polled frequently. Feed v3 runs before indexing and doesn't depend on it. Use Feed v3 or Hook for order change detection; use List Orders only for ad-hoc queries.

- **Blocking hook response with long processing.** VTEX requires the hook endpoint to respond with HTTP 200 within **5000ms**. If processing takes longer (e.g., ERP sync, complex database writes), VTEX considers the delivery failed and retries with increasing delays. Repeated failures can lead to hook deactivation. Acknowledge the event immediately, then process asynchronously via a queue.

```typescript
import { RequestHandler } from "express";

// Correct: Acknowledge immediately, process async
const asyncHookHandler: RequestHandler = async (req, res) => {
  const payload: HookPayload = req.body;

  // Validate auth (fast operation)
  if (!validateAuth(payload, req.headers)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Enqueue for async processing (fast operation)
  await enqueueOrderEvent(payload);

  // Respond immediately — well within 5000ms
  res.status(200).json({ received: true });
};

function validateAuth(
  payload: HookPayload,
  headers: Record<string, unknown>
): boolean {
  return (
    payload.Origin?.Account === process.env.VTEX_ACCOUNT_NAME &&
    headers["x-integration-secret"] === process.env.HOOK_SECRET
  );
}

async function enqueueOrderEvent(payload: HookPayload): Promise<void> {
  // Use a message queue (SQS, RabbitMQ, Redis, etc.)
  console.log(`Enqueued order event: ${payload.OrderId}`);
}
```

## Review checklist

- [ ] Is the correct delivery model chosen (Feed for controlled throughput, Hook for real-time)?
- [ ] Does the hook endpoint validate `Origin.Account`, `Origin.Key`, and custom headers?
- [ ] Is event processing idempotent using `OrderId` + `State` + `LastChange` as deduplication key?
- [ ] Does the status handler cover all order statuses with a default/fallback case?
- [ ] Does the hook endpoint respond within **5000ms** (using async processing for heavy work)?
- [ ] Is Feed v3 configured as a backup to catch missed hook events?
- [ ] Are filter types not mixed (FromWorkflow and FromOrders are mutually exclusive)?

## Reference

- [Feed v3 Guide](https://developers.vtex.com/docs/guides/orders-feed) — Complete guide to Feed and Hook configuration, filter types, and best practices
- [Orders API - Feed v3 Endpoints](https://developers.vtex.com/docs/api-reference/orders-api#get-/api/orders/feed) — API reference for feed retrieval and commit
- [Hook Configuration API](https://developers.vtex.com/docs/api-reference/orders-api#post-/api/orders/hook/config) — API reference for creating and updating hook configuration
- [Orders Overview](https://developers.vtex.com/docs/guides/orders-overview) — Overview of the VTEX Orders module
- [Order Flow and Status](https://help.vtex.com/en/docs/tutorials/order-flow-and-status) — Complete list of order statuses and transitions
- [ERP Integration - Set Up Order Integration](https://developers.vtex.com/docs/guides/erp-integration-set-up-order-integration) — Guide for integrating order feed with back-office systems
