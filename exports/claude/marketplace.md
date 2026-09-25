This skill provides guidance for AI agents working with VTEX Marketplace Integration. Apply these constraints and patterns when assisting developers with apply when building catalog or SKU synchronization logic for VTEX marketplace seller connectors. Covers the changenotification endpoint, SKU suggestion lifecycle, product data mapping, price and inventory sync, and fulfillment simulation. Use for implementing seller-side catalog integration that pushes SKUs to VTEX marketplaces with proper notification handling and rate-limited batch synchronization.

# Catalog & SKU Integration

## When this skill applies

Use this skill when building a seller connector that needs to push product catalog data into a VTEX marketplace, handle SKU approval workflows, or keep prices and inventory synchronized.

- Building the Change Notification flow to register and update SKUs
- Implementing the SKU suggestion lifecycle (send → pending → approved/denied)
- Mapping product data to the VTEX catalog schema
- Synchronizing prices and inventory via notification endpoints

Do not use this skill for:
- Marketplace-side catalog operations (direct Catalog API writes)
- Order fulfillment or invoice handling (see `marketplace-fulfillment`)
- Rate limiting patterns in isolation (see `marketplace-rate-limiting`)

## Decision rules

VTEX exposes two `POST` routes under `api/catalog_system/pvt/skuseller/changenotification`. They are **not** interchangeable — the path shape tells the platform which identifier you are sending.

| Route | Path pattern | Meaning |
| ----- | ------------ | ------- |
| Change notification **with marketplace SKU ID** | `.../changenotification/{skuId}` | `{skuId}` is the **SKU ID in the marketplace catalog** (VTEX). There is **no** `sellerId` in the URL. |
| Change notification **with seller ID and seller SKU ID** | `.../changenotification/{sellerId}/{skuId}` | `{sellerId}` is the seller account on the marketplace; `{skuId}` is the **seller's own SKU code** (the same ID used in `PUT` SKU Suggestion paths). |

**Seller connector integrations** MUST use the **second** route. Official docs sometimes mix descriptions between these two — trust the **URL shape**: the seller-scoped flow always uses **two** path segments after `changenotification/`.

SKU suggestions (`PUT`/`GET`) must go to `https://api.vtex.com/{accountName}/suggestions/{sellerId}/{sellerSkuId}`, not the store hostname. The same App Key and App Token apply. Do not build suggestion URLs using `{account}.vtexcommercestable.com.br/api/catalog_system/pvt/sku/seller/...` — that is a different Catalog System surface.

- For **seller-side** catalog integration, use `POST /api/catalog_system/pvt/skuseller/changenotification/{sellerId}/{sellerSkuId}` (seller Id in the marketplace account + **seller’s SKU ID**). A **200 OK** means the SKU already exists in the marketplace for that seller (update path); a **404 Not Found** means it does not (send a SKU suggestion). Do **not** use `POST .../changenotification/{skuId}` with the seller’s SKU code — that single-segment route expects the **marketplace** SKU ID.
- Use `POST .../changenotification/{skuId}` only when the identifier you have is the **VTEX marketplace** SKU ID (no seller segment in the path).
- Use **`PUT`** on [`/suggestions/{sellerId}/{sellerSkuId}`](https://developers.vtex.com/docs/api-reference/marketplace-apis-suggestions#put-/suggestions/-sellerId-/-sellerSkuId-) under **`https://api.vtex.com/{accountName}`** (Send SKU Suggestion) to register or update pending suggestions. The seller does not own the catalog — every new SKU must go through the suggestion/approval workflow.
- Use separate notification endpoints for price and inventory: `POST /notificator/{sellerId}/changenotification/{sellerSkuId}/price` and `POST /notificator/{sellerId}/changenotification/{sellerSkuId}/inventory`. The path segment after `changenotification/` is the **seller SKU ID** (the seller’s own SKU code — the same identifier used in suggestions and seller-scoped catalog flows), not the marketplace VTEX SKU ID. Reference docs may label this segment `skuId`; read it as **sellerSkuId** in seller-connector integrations.
- After price/inventory notifications, the marketplace calls the seller's **Fulfillment Simulation** endpoint (`POST /pvt/orderForms/simulation`). This endpoint must respond within **2.5 seconds** or the product is considered unavailable.
- Suggestions can only be updated while in "pending" state. Once approved or denied, the seller cannot modify them.

**Architecture/Data Flow**:

```text
Seller                          VTEX Marketplace
  │                                    │
  │─── POST changenotification ──────▶│
  │◀── 200 (exists) or 404 (new) ────│
  │                                    │
  │─── PUT Send SKU Suggestion ──────▶│  (if 404)
  │                                    │── Pending in Received SKUs
  │                                    │── Marketplace approves/denies
  │                                    │
  │─── POST price notification ──────▶│
  │◀── POST fulfillment simulation ───│  (marketplace fetches data)
  │─── Response with price/stock ────▶│
```

## Hard constraints

### Constraint: Use SKU Integration API, Not Direct Catalog API

External sellers MUST use the Change Notification + SKU Suggestion flow to integrate SKUs. Direct Catalog API writes (`POST /api/catalog/pvt/product` or `POST /api/catalog/pvt/stockkeepingunit`) are for marketplace-side operations only.

**Why this matters**

The seller does not own the catalog. Direct catalog writes will fail with 403 Forbidden or create orphaned entries that bypass the approval workflow. The suggestion mechanism ensures marketplace quality control.

**Detection**

If you see direct Catalog API calls for product/SKU creation (e.g., `POST /api/catalog/pvt/product`, `POST /api/catalog/pvt/stockkeepingunit`) from a seller integration → warn that the SKU Integration API should be used instead.

**Correct**

```typescript
import axios, { AxiosInstance } from "axios";

interface SkuSuggestion {
  ProductName: string;
  SkuName: string;
  ImageUrl: string;
  ProductDescription: string;
  BrandName: string;
  CategoryFullPath: string;
  EAN: string;
  Height: number;
  Width: number;
  Length: number;
  WeightKg: number;
  SkuSpecifications: Array<{
    FieldName: string;
    FieldValues: string[];
  }>;
}

async function integrateSellerSku(
  client: AxiosInstance,
  marketplaceAccount: string,
  sellerId: string,
  sellerSkuId: string,
  skuData: SkuSuggestion
): Promise<void> {
  const storeBaseUrl = `https://${marketplaceAccount}.vtexcommercestable.com.br`;
  const suggestionUrl = `https://api.vtex.com/${marketplaceAccount}/suggestions/${sellerId}/${sellerSkuId}`;

  // Step 1: Seller-scoped change notification (Catalog API — store host)
  try {
    await client.post(
      `${storeBaseUrl}/api/catalog_system/pvt/skuseller/changenotification/${sellerId}/${sellerSkuId}`
    );
    // 200 OK — SKU exists, marketplace will fetch updates via fulfillment simulation
    console.log(`SKU ${sellerSkuId} exists in marketplace, update triggered`);
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      // 404 — SKU not found, send suggestion
      console.log(`SKU ${sellerSkuId} not found, sending suggestion`);
      await client.put(suggestionUrl, skuData);
      console.log(`SKU suggestion sent for ${sellerSkuId}`);
    } else {
      throw error;
    }
  }
}
```

**Wrong**

```typescript
// WRONG: Marketplace-SKU-only path with the seller's SKU code (misroutes the notification).
// .../changenotification/{skuId} expects the VTEX marketplace SKU ID, not sellerSkuId.
await client.post(
  `https://${marketplaceAccount}.vtexcommercestable.com.br/api/catalog_system/pvt/skuseller/changenotification/${sellerSkuId}`
);

// WRONG: SKU Suggestion on the store host + Catalog path — public contract is api.vtex.com + /suggestions/...
await client.put(
  `https://${marketplaceAccount}.vtexcommercestable.com.br/api/catalog_system/pvt/sku/seller/${sellerId}/suggestion/${sellerSkuId}`,
  skuData
);

// WRONG: Seller writing directly to marketplace catalog — bypasses suggestion/approval; expect 403
async function createSkuDirectly(
  client: AxiosInstance,
  marketplaceAccount: string,
  productData: Record<string, unknown>
): Promise<void> {
  // Direct catalog write — sellers don't have permission for this
  await client.post(
    `https://${marketplaceAccount}.vtexcommercestable.com.br/api/catalog/pvt/product`,
    productData
  );
  // Will fail: 403 Forbidden — seller lacks catalog write permissions
  // Will fail: 403 Forbidden — seller lacks catalog write permissions
}
```

---

### Constraint: Handle Rate Limiting on Catalog Notifications

All catalog notification calls MUST implement 429 handling with exponential backoff. Batch notifications MUST be throttled to respect VTEX API rate limits.

**Why this matters**

The Change Notification endpoint is rate-limited. Sending bulk notifications without throttling will trigger 429 responses and temporarily block the seller's API access, stalling the entire integration.

**Detection**

If you see catalog notification calls without 429 handling or retry logic → STOP and add rate limiting. If you see a tight loop sending notifications without delays → warn about rate limiting.

**Correct**

```typescript
async function batchNotifySkus(
  client: AxiosInstance,
  baseUrl: string,
  sellerId: string,
  sellerSkuIds: string[],
  concurrency: number = 5,
  delayMs: number = 200
): Promise<void> {
  const results: Array<{ sellerSkuId: string; status: "exists" | "new" | "error" }> = [];

  for (let i = 0; i < sellerSkuIds.length; i += concurrency) {
    const batch = sellerSkuIds.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map(async (sellerSkuId) => {
        try {
          await client.post(
            `${baseUrl}/api/catalog_system/pvt/skuseller/changenotification/${sellerId}/${sellerSkuId}`
          );
          return { sellerSkuId, status: "exists" as const };
        } catch (error: unknown) {
          if (
            error instanceof Error &&
            "response" in error &&
            (error as { response?: { status?: number } }).response?.status === 404
          ) {
            return { sellerSkuId, status: "new" as const };
          }
          if (
            error instanceof Error &&
            "response" in error &&
            (error as { response?: { status?: number; headers?: Record<string, string> } })
              .response?.status === 429
          ) {
            const retryAfter = parseInt(
              (error as { response: { headers: Record<string, string> } }).response.headers[
                "retry-after"
              ] || "60",
              10
            );
            console.warn(`Rate limited. Waiting ${retryAfter}s before retry.`);
            await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
            return { sellerSkuId, status: "error" as const };
          }
          throw error;
        }
      })
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }

    // Throttle between batches
    if (i + concurrency < sellerSkuIds.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
```

**Wrong**

```typescript
// WRONG: No rate limiting, no error handling, tight loop
async function notifyAllSkus(
  client: AxiosInstance,
  baseUrl: string,
  sellerId: string,
  sellerSkuIds: string[]
): Promise<void> {
  // Fires all requests simultaneously — will trigger 429 rate limits
  await Promise.all(
    sellerSkuIds.map((sellerSkuId) =>
      client.post(
        `${baseUrl}/api/catalog_system/pvt/skuseller/changenotification/${sellerId}/${sellerSkuId}`
      )
    )
  );
}
```

---

### Constraint: Handle Suggestion Lifecycle States

Sellers MUST check the suggestion state before attempting updates. Suggestions can only be updated while in pending state.

**Why this matters**

Attempting to update an already-approved or denied suggestion will fail silently or create duplicate entries. An approved suggestion becomes an SKU owned by the marketplace.

**Detection**

If you see SKU suggestion updates without checking current suggestion status → warn about suggestion lifecycle handling.

**Correct**

```typescript
async function updateSkuSuggestion(
  client: AxiosInstance,
  marketplaceAccount: string,
  sellerId: string,
  sellerSkuId: string,
  updatedData: Record<string, unknown>
): Promise<boolean> {
  const suggestionUrl = `https://api.vtex.com/${marketplaceAccount}/suggestions/${sellerId}/${sellerSkuId}`;

  // Check current suggestion status before updating
  try {
    const response = await client.get(suggestionUrl);

    const suggestion = response.data;
    if (suggestion.Status === "Pending") {
      // Safe to update — suggestion hasn't been processed yet
      await client.put(suggestionUrl, updatedData);
      return true;
    }

    // Already approved or denied — cannot update
    console.warn(
      `SKU ${sellerSkuId} suggestion is ${suggestion.Status}, cannot update. ` +
        `Use changenotification to update existing SKUs.`
    );
    return false;
  } catch {
    // Suggestion may not exist — send as new
    await client.put(suggestionUrl, updatedData);
    return true;
  }
}
```

**Wrong**

```typescript
// WRONG: Blindly sending suggestion update without checking state
async function blindUpdateSuggestion(
  client: AxiosInstance,
  marketplaceAccount: string,
  sellerId: string,
  sellerSkuId: string,
  data: Record<string, unknown>
): Promise<void> {
  // If the suggestion was already approved, this fails silently
  // or creates a duplicate that confuses the marketplace operator
  await client.put(
    `https://api.vtex.com/${marketplaceAccount}/suggestions/${sellerId}/${sellerSkuId}`,
    data
  );
}
```

## Preferred pattern

### Set Up the Seller Connector Client

Create an authenticated HTTP client for communicating with the VTEX marketplace.

```typescript
import axios, { AxiosInstance } from "axios";

interface SellerConnectorConfig {
  marketplaceAccount: string;
  sellerId: string;
  appKey: string;
  appToken: string;
}

function createMarketplaceClient(config: SellerConnectorConfig): AxiosInstance {
  return axios.create({
    // Catalog System routes (e.g. changenotification) use the store host.
    baseURL: `https://${config.marketplaceAccount}.vtexcommercestable.com.br`,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-VTEX-API-AppKey": config.appKey,
      "X-VTEX-API-AppToken": config.appToken,
    },
    timeout: 10000,
  });
}

// Use the same headers for PUT/GET on https://api.vtex.com/{account}/suggestions/...
// (pass a full URL on the same axios instance, or set baseURL to https://api.vtex.com/{account} for suggestion-only calls).
```

### Implement the Change Notification Flow

Handle both the "exists" (200) and "new" (404) scenarios from the changenotification endpoint.

```typescript
interface CatalogNotificationResult {
  skuId: string;
  action: "updated" | "suggestion_sent" | "error";
  error?: string;
}

async function notifyAndSync(
  client: AxiosInstance,
  marketplaceAccount: string,
  sellerId: string,
  sellerSkuId: string,
  skuData: SkuSuggestion
): Promise<CatalogNotificationResult> {
  const suggestionUrl = `https://api.vtex.com/${marketplaceAccount}/suggestions/${sellerId}/${sellerSkuId}`;

  try {
    await client.post(
      `/api/catalog_system/pvt/skuseller/changenotification/${sellerId}/${sellerSkuId}`
    );
    // SKU exists — marketplace will call fulfillment simulation to get updates
    return { skuId: sellerSkuId, action: "updated" };
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      try {
        await client.put(suggestionUrl, skuData);
        return { skuId: sellerSkuId, action: "suggestion_sent" };
      } catch (suggestionError: unknown) {
        const message = suggestionError instanceof Error ? suggestionError.message : "Unknown error";
        return { skuId: sellerSkuId, action: "error", error: message };
      }
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return { skuId: sellerSkuId, action: "error", error: message };
  }
}
```

### Implement the Fulfillment Simulation Endpoint

The marketplace calls this endpoint on the seller's side to retrieve current price and inventory data after a notification.

```typescript
import { RequestHandler } from "express";

interface SimulationItem {
  id: string;
  quantity: number;
  seller: string;
}

interface SimulationRequest {
  items: SimulationItem[];
  postalCode?: string;
  country?: string;
}

interface SimulationResponseItem {
  id: string;
  requestIndex: number;
  quantity: number;
  seller: string;
  price: number;
  listPrice: number;
  sellingPrice: number;
  priceValidUntil: string;
  availability: string;
  merchantName: string;
}

const fulfillmentSimulationHandler: RequestHandler = async (req, res) => {
  const { items, postalCode, country }: SimulationRequest = req.body;

  const responseItems: SimulationResponseItem[] = await Promise.all(
    items.map(async (item, index) => {
      // Fetch current price and inventory from your system
      const skuInfo = await getSkuFromLocalCatalog(item.id);

      return {
        id: item.id,
        requestIndex: index,
        quantity: Math.min(item.quantity, skuInfo.availableQuantity),
        seller: item.seller,
        price: skuInfo.price,
        listPrice: skuInfo.listPrice,
        sellingPrice: skuInfo.sellingPrice,
        priceValidUntil: new Date(Date.now() + 3600000).toISOString(),
        availability: skuInfo.availableQuantity > 0 ? "available" : "unavailable",
        merchantName: "sellerAccountName",
      };
    })
  );

  // CRITICAL: Must respond within 2.5 seconds or products show as unavailable
  res.json({
    items: responseItems,
    postalCode: postalCode ?? "",
    country: country ?? "",
  });
};

async function getSkuFromLocalCatalog(skuId: string): Promise<{
  price: number;
  listPrice: number;
  sellingPrice: number;
  availableQuantity: number;
}> {
  // Replace with your actual catalog/inventory lookup
  return {
    price: 9990,
    listPrice: 12990,
    sellingPrice: 9990,
    availableQuantity: 15,
  };
}
```

### Notify Price and Inventory Changes

Send separate notifications for price and inventory updates. The `{sellerSkuId}` segment in the URL is the **seller’s SKU identifier** (same code you use in your catalog and in `changenotification/{sellerId}/{sellerSkuId}` / suggestions). Do not pass the marketplace’s internal VTEX SKU ID here unless your integration is explicitly keyed that way.

```typescript
async function notifyPriceChange(
  client: AxiosInstance,
  sellerId: string,
  sellerSkuId: string
): Promise<void> {
  await client.post(
    `/notificator/${sellerId}/changenotification/${sellerSkuId}/price`
  );
}

async function notifyInventoryChange(
  client: AxiosInstance,
  sellerId: string,
  sellerSkuId: string
): Promise<void> {
  await client.post(
    `/notificator/${sellerId}/changenotification/${sellerSkuId}/inventory`
  );
}

async function syncPriceAndInventory(
  client: AxiosInstance,
  sellerId: string,
  sellerSkuIds: string[]
): Promise<void> {
  for (const sellerSkuId of sellerSkuIds) {
    await notifyPriceChange(client, sellerId, sellerSkuId);
    await notifyInventoryChange(client, sellerId, sellerSkuId);

    // Throttle to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
```

### Complete Example

```typescript
import axios from "axios";

async function runCatalogSync(): Promise<void> {
  const config: SellerConnectorConfig = {
    marketplaceAccount: "mymarketplace",
    sellerId: "externalseller01",
    appKey: process.env.VTEX_APP_KEY!,
    appToken: process.env.VTEX_APP_TOKEN!,
  };

  const client = createMarketplaceClient(config);

  // Fetch SKUs that need syncing from your system
  const skusToSync = await getLocalSkusNeedingSync();

  for (const sku of skusToSync) {
    const skuSuggestion: SkuSuggestion = {
      ProductName: sku.productName,
      SkuName: sku.skuName,
      ImageUrl: sku.imageUrl,
      ProductDescription: sku.description,
      BrandName: sku.brand,
      CategoryFullPath: sku.categoryPath,
      EAN: sku.ean,
      Height: sku.height,
      Width: sku.width,
      Length: sku.length,
      WeightKg: sku.weight,
      SkuSpecifications: sku.specifications,
    };

    const result = await notifyAndSync(
      client,
      config.marketplaceAccount,
      config.sellerId,
      sku.sellerSkuId,
      skuSuggestion
    );

    console.log(`SKU ${sku.sellerSkuId}: ${result.action}`);

    // Throttle between SKU operations
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Sync prices and inventory for all active SKUs (seller SKU IDs)
  const activeSellerSkuIds = skusToSync.map((s) => s.sellerSkuId);
  await syncPriceAndInventory(client, config.sellerId, activeSellerSkuIds);
}

async function getLocalSkusNeedingSync(): Promise<
  Array<{
    sellerSkuId: string;
    productName: string;
    skuName: string;
    imageUrl: string;
    description: string;
    brand: string;
    categoryPath: string;
    ean: string;
    height: number;
    width: number;
    length: number;
    weight: number;
    specifications: Array<{ FieldName: string; FieldValues: string[] }>;
  }>
> {
  // Replace with your actual data source
  return [];
}
```

## Common failure modes

- **Calling the single-segment change notification with the seller’s SKU ID.** `POST .../changenotification/{skuId}` resolves the **marketplace** SKU ID. Passing the seller’s catalog code there will not match the intended SKU and breaks the integration flow. Seller connectors must use `POST .../changenotification/{sellerId}/{sellerSkuId}`. If public API reference text describes `sellerId` in the body but shows a one-segment URL, treat that as a documentation mismatch and follow the path shape above.

- **Polling for suggestion status in tight loops.** Suggestion approval is a manual or semi-automatic marketplace process that can take minutes to days. Tight polling wastes API quota and may trigger rate limits that block the entire integration. Use a scheduled job (cron) to check suggestion statuses periodically (e.g., every 15-30 minutes), or implement a webhook-based notification system.

- **Ignoring the fulfillment simulation timeout.** The seller's fulfillment simulation endpoint performs complex database queries or external API calls that exceed the response time limit. VTEX marketplaces wait a maximum of **2.5 seconds** for a fulfillment simulation response. After that, the product is considered unavailable/inactive and won't appear in the storefront or checkout. Pre-cache price and inventory data using in-memory or Redis cache with event-driven updates so the simulation endpoint responds instantly.

```typescript
import { RequestHandler } from "express";

// Correct: Cache-first approach for fast fulfillment simulation
const cachedPriceInventory = new Map<string, {
  price: number;
  listPrice: number;
  sellingPrice: number;
  availableQuantity: number;
  updatedAt: number;
}>();

const fastFulfillmentSimulation: RequestHandler = async (req, res) => {
  const { items } = req.body;

  const responseItems = items.map((item: SimulationItem, index: number) => {
    const cached = cachedPriceInventory.get(item.id);

    if (!cached) {
      return {
        id: item.id,
        requestIndex: index,
        quantity: 0,
        availability: "unavailable",
      };
    }

    return {
      id: item.id,
      requestIndex: index,
      quantity: Math.min(item.quantity, cached.availableQuantity),
      price: cached.price,
      listPrice: cached.listPrice,
      sellingPrice: cached.sellingPrice,
      availability: cached.availableQuantity > 0 ? "available" : "unavailable",
    };
  });

  // Responds in < 50ms from cache
  res.json({ items: responseItems });
};
```

## Review checklist

- [ ] Is the Change Notification + SKU Suggestion flow used (not direct Catalog API writes)?
- [ ] Does catalog change notification use `.../changenotification/{sellerId}/{sellerSkuId}` (not the single-segment marketplace-SKU route with a seller SKU code)?
- [ ] Does the integration handle both 200 (exists) and 404 (new) responses from changenotification?
- [ ] Are SKU suggestion updates guarded by a status check (only update while "Pending")?
- [ ] Are `PUT`/`GET` suggestion calls sent to `https://api.vtex.com/{account}/suggestions/{sellerId}/{sellerSkuId}`, not to the store hostname?
- [ ] Are batch catalog notifications throttled with 429 handling and exponential backoff?
- [ ] Does the fulfillment simulation endpoint respond within **2.5 seconds**?
- [ ] Are price and inventory notifications sent via the correct `/notificator/{sellerId}/changenotification/{sellerSkuId}/price|inventory` paths (seller SKU ID in the path)?
- [ ] Are placeholder values (account names, seller IDs, API keys) replaced with real values?

## Reference

- [External Seller Connector Guide](https://developers.vtex.com/docs/guides/external-seller-integration-connector) — Complete integration flow for external sellers connecting to VTEX marketplaces
- [Change notification (marketplace SKU ID)](https://developers.vtex.com/docs/api-reference/catalog-api#post-/api/catalog_system/pvt/skuseller/changenotification/-skuId-) — `POST .../changenotification/{skuId}`; path uses **marketplace** SKU ID only
- [Change notification (seller ID and seller SKU ID)](https://developers.vtex.com/docs/api-reference/catalog-api#post-/api/catalog_system/pvt/skuseller/changenotification/-sellerId-/-skuId-) — `POST .../changenotification/{sellerId}/{skuId}`; **use this for seller connector catalog integration**
- [Send SKU Suggestion (`PUT /suggestions/{sellerId}/{sellerSkuId}`)](https://developers.vtex.com/docs/api-reference/marketplace-apis-suggestions#put-/suggestions/-sellerId-/-sellerSkuId-) — base URL `https://api.vtex.com/{accountName}`
- [Marketplace API — Suggestions](https://developers.vtex.com/docs/api-reference/marketplace-apis-suggestions) — full Suggestions API reference
- [Marketplace API - Manage Suggestions (guide)](https://developers.vtex.com/docs/guides/marketplace-api#manage-suggestions) — narrative guide for SKU suggestions workflow
- [Catalog Management for VTEX Marketplace](https://developers.vtex.com/docs/guides/external-seller-integration-vtex-marketplace-operation) — Marketplace-side catalog operations and SKU approval workflows

---

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

---

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

---

This skill provides guidance for AI agents working with VTEX Marketplace Integration. Apply these constraints and patterns when assisting developers with apply when implementing retry logic, rate limit handling, or resilience patterns in VTEX API integrations. Covers VTEX rate limit headers (X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After), 429 status handling, exponential backoff with jitter, circuit breaker patterns, and request queuing. Use for any VTEX marketplace integration that must gracefully handle API throttling and maintain high availability.

# API Rate Limiting & Resilience

## When this skill applies

Use this skill when building any integration that calls VTEX APIs — catalog sync, order processing, price/inventory updates, or fulfillment operations — and needs to handle rate limits gracefully without losing data or degrading performance.

- Implementing retry logic with exponential backoff and jitter
- Reading and reacting to VTEX rate limit headers (`Retry-After`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- Building circuit breakers for high-throughput integrations
- Controlling request throughput with queuing

Do not use this skill for:
- Catalog-specific synchronization logic (see `marketplace-catalog-sync`)
- Order event consumption and processing (see `marketplace-order-hook`)
- Invoice and tracking submission (see `marketplace-fulfillment`)

## Decision rules

- Always implement **exponential backoff with jitter** on 429 responses. Formula: `delay = min(maxDelay, baseDelay * 2^attempt) * (0.5 + random(0, 0.5))`.
- Always **read the `Retry-After` header** on 429 responses. Use the greater of the `Retry-After` value and the calculated backoff delay.
- Use a **circuit breaker** when a service consistently fails (e.g., after 5 consecutive failures), to prevent cascading failures and give the service time to recover.
- Use a **request queue** to control throughput and avoid bursts that trigger rate limits.
- Monitor `X-RateLimit-Remaining` **proactively** on successful responses and slow down before hitting 429.
- VTEX rate limits vary by API:
  - **Pricing API**: PUT/POST: 40 requests/second/account with 1000 burst credits. DELETE: 16 requests/second/account with 300 burst credits.
  - **Catalog API**: Varies by endpoint; no published fixed limits.
  - **Orders API**: Subject to general platform limits; VTEX recommends 1-minute backoff on 429.
- **Burst Credits**: When you exceed the rate limit, excess requests consume burst credits (1 credit per excess request). When burst credits reach 0, the request is blocked with 429. Credits refill over time at the same rate as the route's limit when the route is not being used.

**Rate Limit Response Headers**:

| Header | Description |
|---|---|
| `Retry-After` | Seconds to wait before retrying (present on 429 responses) |
| `X-RateLimit-Remaining` | Number of requests remaining in the current window |
| `X-RateLimit-Reset` | Timestamp (seconds) when the rate limit window resets |

**Architecture/Data Flow**:

```text
Your Integration                          VTEX API
      │                                       │
      │── Request ──────────────────────────▶│
      │◀── 200 OK ─────────────────────────│  (success)
      │                                       │
      │── Request ──────────────────────────▶│
      │◀── 429 + Retry-After: 30 ──────────│  (rate limited)
      │                                       │
      │   [Wait: max(Retry-After, backoff)]   │
      │   [backoff = base * 2^attempt * jitter]│
      │                                       │
      │── Retry ───────────────────────────▶│
      │◀── 200 OK ─────────────────────────│  (success)
```

## Hard constraints

### Constraint: Implement Exponential Backoff on 429 Responses

When receiving a 429 response, the integration MUST wait before retrying using exponential backoff with jitter. The wait time MUST respect the `Retry-After` header when present.

**Why this matters**

Immediate retries after a 429 will be rejected again and consume burst credits faster, leading to prolonged blocking. Without jitter, all clients retry simultaneously after the window resets, causing another rate limit spike (thundering herd).

**Detection**

If you see immediate retry on 429 (no delay, no backoff) → STOP and implement exponential backoff. If you see retry logic without reading the `Retry-After` header → warn that the header should be respected. If you see `while(true)` retry loops or `setInterval` with intervals less than 5 seconds → warn about tight loops.

**Correct**

```typescript
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
};

/**
 * Calculates exponential backoff delay with full jitter.
 *
 * Formula: min(maxDelay, baseDelay * 2^attempt) * random(0.5, 1.0)
 *
 * The jitter prevents thundering herd when multiple clients
 * are rate-limited simultaneously.
 */
function calculateBackoffWithJitter(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const boundedDelay = Math.min(maxDelayMs, exponentialDelay);
  // Full jitter: random value between 50% and 100% of the bounded delay
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.floor(boundedDelay * jitter);
}

/**
 * Executes an API request with automatic retry on 429 responses.
 * Respects the Retry-After header and applies exponential backoff with jitter.
 */
async function requestWithRetry<T>(
  client: AxiosInstance,
  config: AxiosRequestConfig,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<AxiosResponse<T>> {
  let lastError: AxiosError | undefined;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await client.request<T>(config);
    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) {
        throw error;
      }

      lastError = error;
      const status = error.response?.status;

      // Only retry on 429 (rate limited) and 503 (circuit breaker)
      if (status !== 429 && status !== 503) {
        throw error;
      }

      if (attempt === retryConfig.maxRetries) {
        break; // Exhausted retries
      }

      // Respect Retry-After header if present (value is in seconds)
      const retryAfterHeader = error.response?.headers?.["retry-after"];
      const retryAfterMs = retryAfterHeader
        ? parseInt(retryAfterHeader, 10) * 1000
        : 0;

      // Use the greater of Retry-After or calculated backoff
      const backoffMs = calculateBackoffWithJitter(
        attempt,
        retryConfig.baseDelayMs,
        retryConfig.maxDelayMs
      );
      const delayMs = Math.max(retryAfterMs, backoffMs);

      console.warn(
        `Rate limited (${status}). Retry ${attempt + 1}/${retryConfig.maxRetries} ` +
          `in ${delayMs}ms (Retry-After: ${retryAfterHeader ?? "none"}, ` +
          `backoff: ${backoffMs}ms)`
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError ?? new Error("Request failed after all retries");
}
```

**Wrong**

```typescript
// WRONG: Immediate retry without backoff or Retry-After respect
async function retryImmediately<T>(
  client: AxiosInstance,
  config: AxiosRequestConfig,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await client.request<T>(config);
      return response.data;
    } catch (error: unknown) {
      // Retries immediately — will hit 429 again and drain burst credits
      // Does not read Retry-After header — ignores server guidance
      console.log(`Retry ${i + 1}...`);
      // No delay at all — thundering herd when multiple instances retry
    }
  }
  throw new Error("Failed after retries");
}
```

---

### Constraint: Respect the Retry-After Header

When a 429 response includes a `Retry-After` header, the integration MUST wait at least the specified number of seconds before retrying. The backoff delay should be the maximum of the calculated backoff and the `Retry-After` value.

**Why this matters**

The `Retry-After` header is the server's explicit instruction on when it will accept requests again. Ignoring it results in requests being rejected until the specified time has passed, wasting bandwidth and potentially extending the block period.

**Detection**

If you see retry logic that does not read or use the `Retry-After` header value → warn that the header should be checked. If the retry delay is always a fixed value regardless of the header → warn.

**Correct**

```typescript
function getRetryDelayMs(error: AxiosError, attempt: number): number {
  const retryAfterHeader = error.response?.headers?.["retry-after"];

  // Parse Retry-After (could be seconds or HTTP-date)
  let retryAfterMs = 0;
  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds)) {
      retryAfterMs = seconds * 1000;
    } else {
      // HTTP-date format
      const retryDate = new Date(retryAfterHeader).getTime();
      retryAfterMs = Math.max(0, retryDate - Date.now());
    }
  }

  // Calculate backoff with jitter
  const backoffMs = calculateBackoffWithJitter(attempt, 1000, 60000);

  // Use the larger value — respect server guidance
  return Math.max(retryAfterMs, backoffMs);
}
```

**Wrong**

```typescript
// WRONG: Fixed 1-second retry ignoring Retry-After header
async function fixedRetry<T>(
  client: AxiosInstance,
  config: AxiosRequestConfig
): Promise<T> {
  try {
    const response = await client.request<T>(config);
    return response.data;
  } catch {
    // Always waits 1 second regardless of Retry-After header
    // If Retry-After says 60 seconds, this will fail again and again
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const response = await client.request<T>(config);
    return response.data;
  }
}
```

---

### Constraint: No Tight Retry Loops

Integrations MUST NOT use `while(true)` loops for retrying or `setInterval`/`setTimeout` with intervals less than 5 seconds for polling VTEX APIs.

**Why this matters**

Tight loops generate excessive requests that quickly exhaust rate limits, degrade VTEX platform performance for all users, and can make the VTEX Admin unavailable for the account. VTEX explicitly warns that excessive 429 errors can make Admin unavailable.

**Detection**

If you see `while(true)` or `for(;;)` retry patterns without adequate delays → warn about tight loops. If you see `setInterval` with intervals less than 5000ms for API calls → warn about polling frequency.

**Correct**

```typescript
// Correct: Controlled polling with adequate intervals
async function pollWithBackpressure(
  client: AxiosInstance,
  intervalMs: number = 30000 // 30 seconds minimum
): Promise<void> {
  const poll = async (): Promise<void> => {
    try {
      const response = await client.get("/api/orders/feed");
      const events = response.data;

      if (events.length > 0) {
        await processEvents(events);
        await commitEvents(
          client,
          events.map((e: { handle: string }) => e.handle)
        );
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        const retryAfter = parseInt(
          error.response.headers["retry-after"] || "60",
          10
        );
        console.warn(`Rate limited, waiting ${retryAfter}s`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return;
      }
      console.error("Polling error:", error);
    }

    // Schedule next poll
    setTimeout(poll, intervalMs);
  };

  // Start polling
  await poll();
}

async function processEvents(events: unknown[]): Promise<void> {
  console.log(`Processing ${events.length} events`);
}

async function commitEvents(client: AxiosInstance, handles: string[]): Promise<void> {
  await client.post("/api/orders/feed", { handles });
}
```

**Wrong**

```typescript
// WRONG: Tight loop with no backpressure
async function tightLoop(client: AxiosInstance): Promise<void> {
  while (true) {
    try {
      const response = await client.get("/api/orders/feed");
      await processEvents(response.data);
    } catch {
      // Immediate retry — no delay, burns through rate limits
      continue;
    }
  }
}

// WRONG: setInterval with 1-second polling
setInterval(async () => {
  // 1 request/second = 3600/hour — will trigger rate limits quickly
  const client = createClient();
  await client.get("/api/catalog_system/pvt/sku/stockkeepingunitids");
}, 1000);

function createClient(): AxiosInstance {
  return axios.create({ baseURL: "https://account.vtexcommercestable.com.br" });
}
```

## Preferred pattern

### Create a Rate-Limit-Aware HTTP Client

Wrap your HTTP client with automatic retry logic.

```typescript
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

interface RateLimitedClientConfig {
  accountName: string;
  appKey: string;
  appToken: string;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

function createRateLimitedClient(config: RateLimitedClientConfig): {
  client: AxiosInstance;
  request: <T>(requestConfig: AxiosRequestConfig) => Promise<AxiosResponse<T>>;
} {
  const client = axios.create({
    baseURL: `https://${config.accountName}.vtexcommercestable.com.br`,
    headers: {
      "Content-Type": "application/json",
      "X-VTEX-API-AppKey": config.appKey,
      "X-VTEX-API-AppToken": config.appToken,
    },
    timeout: 30000,
  });

  const retryConfig: RetryConfig = {
    maxRetries: config.maxRetries ?? 5,
    baseDelayMs: config.baseDelayMs ?? 1000,
    maxDelayMs: config.maxDelayMs ?? 60000,
  };

  return {
    client,
    request: <T>(requestConfig: AxiosRequestConfig) =>
      requestWithRetry<T>(client, requestConfig, retryConfig),
  };
}
```

### Implement a Circuit Breaker

Prevent cascading failures when a service is consistently failing.

```typescript
enum CircuitState {
  CLOSED = "CLOSED",     // Normal operation — requests flow through
  OPEN = "OPEN",         // Service failing — requests blocked
  HALF_OPEN = "HALF_OPEN", // Testing recovery — one request allowed
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeMs: number = 30000,
    private readonly halfOpenSuccessThreshold: number = 3
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.recoveryTimeMs) {
        throw new Error(
          `Circuit breaker is OPEN. Retry after ${this.recoveryTimeMs}ms.`
        );
      }
      // Transition to half-open for a test request
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        console.log("Circuit breaker: CLOSED (recovered)");
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.warn(
        `Circuit breaker: OPEN after ${this.failureCount} failures`
      );
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}
```

### Implement a Request Queue

Queue requests to control throughput and avoid bursts.

```typescript
interface QueuedRequest<T> {
  config: AxiosRequestConfig;
  resolve: (value: AxiosResponse<T>) => void;
  reject: (error: Error) => void;
}

class RequestQueue {
  private queue: Array<QueuedRequest<unknown>> = [];
  private processing: boolean = false;
  private readonly requestsPerSecond: number;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    private readonly client: {
      request: <T>(config: AxiosRequestConfig) => Promise<AxiosResponse<T>>;
    },
    requestsPerSecond: number = 10,
    circuitBreaker?: CircuitBreaker
  ) {
    this.requestsPerSecond = requestsPerSecond;
    this.circuitBreaker = circuitBreaker ?? new CircuitBreaker();
  }

  async enqueue<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return new Promise<AxiosResponse<T>>((resolve, reject) => {
      this.queue.push({
        config,
        resolve: resolve as (value: AxiosResponse<unknown>) => void,
        reject,
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const delayBetweenRequests = 1000 / this.requestsPerSecond;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;

      try {
        const result = await this.circuitBreaker.execute(() =>
          this.client.request(request.config)
        );
        request.resolve(result);
      } catch (error) {
        request.reject(error instanceof Error ? error : new Error(String(error)));
      }

      // Throttle between requests
      if (this.queue.length > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayBetweenRequests)
        );
      }
    }

    this.processing = false;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}
```

### Monitor Rate Limit Headers Proactively

Read rate limit headers to slow down before hitting 429.

```typescript
import { AxiosResponse } from "axios";

interface RateLimitInfo {
  remaining: number | null;
  resetAt: number | null;
  retryAfter: number | null;
}

function parseRateLimitHeaders(response: AxiosResponse): RateLimitInfo {
  return {
    remaining: response.headers["x-ratelimit-remaining"]
      ? parseInt(response.headers["x-ratelimit-remaining"], 10)
      : null,
    resetAt: response.headers["x-ratelimit-reset"]
      ? parseInt(response.headers["x-ratelimit-reset"], 10) * 1000
      : null,
    retryAfter: response.headers["retry-after"]
      ? parseInt(response.headers["retry-after"], 10) * 1000
      : null,
  };
}

async function adaptiveRequest<T>(
  client: AxiosInstance,
  config: AxiosRequestConfig,
  queue: RequestQueue
): Promise<AxiosResponse<T>> {
  const response = await queue.enqueue<T>(config);
  const rateInfo = parseRateLimitHeaders(response);

  // Proactively slow down when remaining requests are low
  if (rateInfo.remaining !== null && rateInfo.remaining < 10) {
    console.warn(
      `Rate limit approaching: ${rateInfo.remaining} requests remaining. ` +
        `Slowing down.`
    );
    // Add extra delay to reduce pressure
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return response;
}
```

### Complete Example

```typescript
import axios from "axios";

async function buildResilientIntegration(): Promise<void> {
  const { client, request } = createRateLimitedClient({
    accountName: process.env.VTEX_ACCOUNT_NAME!,
    appKey: process.env.VTEX_APP_KEY!,
    appToken: process.env.VTEX_APP_TOKEN!,
    maxRetries: 5,
    baseDelayMs: 1000,
    maxDelayMs: 60000,
  });

  const circuitBreaker = new CircuitBreaker(
    5,     // Open after 5 failures
    30000, // Wait 30s before testing recovery
    3      // Close after 3 successful half-open requests
  );

  const queue = new RequestQueue({ request }, 10, circuitBreaker);

  // Example: Batch update prices with rate limiting
  const skuIds = ["sku-1", "sku-2", "sku-3", "sku-4", "sku-5"];

  for (const skuId of skuIds) {
    try {
      const response = await queue.enqueue({
        method: "POST",
        url: `/notificator/seller01/changenotification/${skuId}/price`,
      });

      const rateInfo = parseRateLimitHeaders(response);
      if (rateInfo.remaining !== null && rateInfo.remaining < 5) {
        console.warn("Approaching rate limit, adding delay");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Circuit breaker is OPEN")) {
        console.error("Circuit breaker open — pausing all requests");
        await new Promise((resolve) => setTimeout(resolve, 30000));
      } else {
        console.error(`Failed to update price for ${skuId}:`, error);
      }
    }
  }
}
```

## Common failure modes

- **Fixed retry delay without jitter.** Using a fixed delay (e.g., always 5 seconds) instead of exponential backoff with jitter causes the "thundering herd" problem: all rate-limited clients retry simultaneously, creating another burst that triggers rate limiting again. Use exponential backoff with random jitter so retries are spread across time.

```typescript
// Correct: Exponential backoff with jitter
function getRetryDelay(attempt: number): number {
  const baseDelay = 1000;
  const maxDelay = 60000;
  const exponential = baseDelay * Math.pow(2, attempt);
  const bounded = Math.min(maxDelay, exponential);
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.floor(bounded * jitter);
}

// attempt 0: ~500-1000ms
// attempt 1: ~1000-2000ms
// attempt 2: ~2000-4000ms
// attempt 3: ~4000-8000ms
// attempt 4: ~8000-16000ms
```

- **No proactive rate management.** Only handling 429 errors reactively (after being rate limited) instead of monitoring rate limit headers to slow down proactively. By the time you receive a 429, you've already lost burst credits. Monitor `X-RateLimit-Remaining` on successful responses and reduce request rate when remaining quota is low.

```typescript
// Correct: Proactive rate management
async function proactiveRateManagement(
  client: AxiosInstance,
  requests: AxiosRequestConfig[]
): Promise<void> {
  let delayBetweenRequests = 100; // Start at 100ms between requests

  for (const config of requests) {
    const response = await requestWithRetry(client, config);
    const rateInfo = parseRateLimitHeaders(response);

    // Proactively adjust speed based on remaining quota
    if (rateInfo.remaining !== null) {
      if (rateInfo.remaining < 5) {
        delayBetweenRequests = 5000; // Slow down significantly
      } else if (rateInfo.remaining < 20) {
        delayBetweenRequests = 1000; // Moderate slowdown
      } else {
        delayBetweenRequests = 100; // Normal speed
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delayBetweenRequests));
  }
}
```

## Review checklist

- [ ] Is exponential backoff with jitter implemented for 429 responses?
- [ ] Is the `Retry-After` header read and respected on 429 responses?
- [ ] Are there no tight retry loops (`while(true)`, `setInterval` < 5 seconds)?
- [ ] Is a circuit breaker in place for consistently failing services?
- [ ] Are `X-RateLimit-Remaining` headers monitored proactively to slow down before hitting limits?
- [ ] Are the correct numeric thresholds used (maxRetries: 5, baseDelayMs: 1000, maxDelayMs: 60000)?
- [ ] Are Pricing API limits respected (40 req/s PUT/POST, 16 req/s DELETE, burst credits)?

## Reference

- [Best Practices for Avoiding Rate Limit Errors](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) — Official VTEX guide on rate limit management and best practices
- [Handling Errors and Exceptions](https://developers.vtex.com/docs/guides/handling-errors-and-exceptions) — VTEX guide on error handling including 429 and 5xx responses
- [API Response Status Codes](https://developers.vtex.com/docs/guides/api-response-codes) — Complete list of VTEX API response codes and their meanings
- [Pricing API Overview - Rate Limits](https://developers.vtex.com/docs/guides/pricing-api-overview) — Specific rate limit documentation for the Pricing API including burst credits
- [Feed v3 - Best Practices](https://developers.vtex.com/docs/guides/orders-feed) — Rate limiting recommendations for order feed integrations
- [How to Load Test a Store](https://developers.vtex.com/docs/guides/how-to-load-test-a-store) — VTEX documentation on rate limiting behavior, 429 responses, and circuit breakers
