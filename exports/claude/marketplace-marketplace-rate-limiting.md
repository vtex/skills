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
