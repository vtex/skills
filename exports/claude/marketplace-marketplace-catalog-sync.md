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
