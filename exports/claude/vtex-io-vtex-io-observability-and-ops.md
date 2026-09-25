This skill provides guidance for AI agents working with VTEX Custom VTEX IO Apps. Apply these constraints and patterns when assisting developers with apply when making VTEX IO services easier to observe, troubleshoot, and operate in production. Covers metrics, structured logging, failure visibility, rate-limit awareness, and production readiness checks for backend apps. Use for integration monitoring, error diagnosis, or improving the operational quality of VTEX IO services before or after release.

# Observability & Operational Readiness

## When this skill applies

Use this skill when a VTEX IO service needs better production visibility, troubleshooting behavior, or operational safety.

- Adding metrics to important client calls or flows
- Improving logs for routes, workers, or integrations
- Surfacing failures clearly for operations and support
- Reviewing whether a service is ready for production
- Monitoring rate-limit-sensitive integrations

Do not use this skill for:
- app policy declaration
- trust-boundary modeling
- frontend analytics or browser monitoring
- route contract design by itself

## Decision rules

- Log enough structured context to debug failures, but do not log secrets or sensitive payloads.
- Use `ctx.vtex.logger` with appropriate log levels such as `info`, `warn`, and `error` instead of `console.log`, so logs are properly collected and searchable in the VTEX logging stack.
- Treat `ctx.vtex.logger` as the native platform logging mechanism. If a partner needs to forward logs to its own logging system, prefer doing that through a dedicated integration app or client instead of replacing the VTEX logger pattern inside every service.
- Use client-level metrics on important downstream calls so integration behavior is visible below the handler layer.
- Choose metric names that reflect the integration and operation, such as `partner-get-order` or `partner-sync-catalog`, so counts, latency, and error rates can be tracked over time.
- Make failures observable at the point where they happen. Do not swallow errors silently in routes, events, or workers.
- For rate-limit-sensitive APIs, combine short timeouts, backoff-aware retries, and caching of frequent reads to reduce burst pressure and avoid hitting hard limits.
- Review whether expensive or fragile flows expose enough operational signals before releasing them.

## Hard constraints

### Constraint: Important failures must be visible in logs, metrics, or durable state

Routes, event handlers, and workers MUST not hide important failures from operators.

**Why this matters**

If failures disappear silently, the service becomes impossible to diagnose under real traffic and retries.

**Detection**

If an error is caught and ignored without logging, metric emission, or explicit failure state, STOP and surface the failure.

**Correct**

```typescript
try {
  await ctx.clients.partnerApi.sendOrder(orderId)
} catch (error) {
  ctx.vtex.logger.error({
    message: 'Failed to send order to partner',
    orderId,
    account: ctx.vtex.account,
    routeId: ctx.vtex.route?.id,
  })
  throw error
}
```

**Wrong**

```typescript
try {
  await ctx.clients.partnerApi.sendOrder(orderId)
} catch (_) {
  return
}
```

### Constraint: Metrics should be attached to important integration calls

Client calls that are operationally important SHOULD include `metric` so request behavior can be tracked consistently.

**Why this matters**

Without metrics, integration failures and latency patterns are much harder to isolate from generic route behavior.

**Detection**

If a key downstream integration call has no `metric` and operations depend on it, STOP and add a meaningful metric name.

**Correct**

```typescript
return this.http.get(`/orders/${id}`, {
  metric: 'partner-get-order',
})
```

**Wrong**

```typescript
return this.http.get(`/orders/${id}`)
```

### Constraint: Logs must stay useful without leaking sensitive data

Logs MUST contain enough context to debug production behavior, but MUST NOT include secrets, tokens, or unnecessarily sensitive payloads.

**Why this matters**

Operational logs are only valuable if they are safe to retain and inspect. Sensitive logging creates security risk while still failing to guarantee useful diagnosis.

**Detection**

If a log line includes tokens, auth headers, raw personal payloads, or entire downstream responses, STOP and sanitize the log.

**Correct**

```typescript
ctx.vtex.logger.info({
  message: 'Partner sync started',
  orderId,
  account: ctx.vtex.account,
})
```

**Wrong**

```typescript
ctx.vtex.logger.info({
  message: 'Partner sync started',
  body: ctx.request.body,
  auth: ctx.request.header.authorization,
})
```

## Preferred pattern

Operationally healthy VTEX IO services should:

- emit metrics for important client calls so counts, latency, and error rates are visible
- log failures with enough structured context such as domain IDs, account, and `routeId`
- avoid silent error swallowing
- sanitize sensitive data before logging
- review retries, caching, and throughput with rate-limit behavior in mind

Use observability to shorten diagnosis time, not just to create more logs.

## Common failure modes

- Catching and ignoring errors in async flows.
- Logging too little context to diagnose production incidents.
- Logging too much sensitive data.
- Omitting metrics from important integration calls.
- Treating rate-limit failures as isolated bugs instead of operational signals.

## Review checklist

- [ ] Are important failures visible to operators?
- [ ] Do key integrations emit useful metrics?
- [ ] Are logs structured and safe?
- [ ] Are retries, caching, and rate-limit behavior considered together?
- [ ] Would someone on call be able to diagnose this flow from the available signals?

## Reference

- [Using Node Clients](https://developers.vtex.com/docs/guides/using-node-clients) - Client usage patterns relevant to metrics and retries
- [Best practices for avoiding rate-limit errors](https://developers.vtex.com/docs/guides/best-practices-for-avoiding-rate-limit-errors) - Operational guidance for stable integrations
