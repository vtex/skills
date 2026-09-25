# PPF scaffold (overlay on the official example)

Start from the official example app in [Payment Provider Framework](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-framework) Getting started. This is the POS overlay, not a replacement for [`payment-provider-framework`](../../payment-provider-framework/skill.md).

TypeScript must stay compatible with builder-hub **3.9.7** (no typed `catch`, no `override`, no `satisfies`). Replace `PartnerPos`, `partnername`, `connector-partnerpos`, and processor hosts with the partner's values.

Do **not** call `SecureExternalClient` on the POS path. Gateway `card` fields are `null`. Leave `usesSecureProxy` unset (PPF default `true`) unless the partner also processes ecommerce cards.

Use the SDK instead of hand-rolled strings and casts:

- `isDirectSaleAuthorization` / `DirectSale` — exact ASCII method names; narrowed type has no `card` / `secureProxyUrl`
- `Authorizations.pending` — `payload` must be a string (`AppData.payload` is `Maybe<string>`). Do not close pending objects with `as AuthorizationResponse`
- `Authorizations.deny` / `Authorizations.approve` — typed pending/deny/approve bodies
- `Payments.retry(callbackUrl)` — bodiless POST; same client as `this.retry`. Cast **only** the final response that adds `cardBrand` / `firstDigits` / `lastDigits` (those fields are not in the SDK types as of 1.4.0 and 1.8.0)

The connector **answers** Create Payment. VTEX Sales App (after the terminal app closes) and Wait for confirmation drive the next calls. Do not POST `callbackUrl` on pending responses.

## What to copy from the example vs what to replace

| Keep from the example | Replace / add for POS |
|---|---|
| `PaymentProvider` + `PaymentProviderService` wiring | `paymentProvider/configuration.json` methods |
| `vbase-read-write` policy | Extra `service.json` routes (`posSerial`, `posWebhook`) |
| VBase persistence idea (`authorizations` bucket) | A **short** POS bucket (`pos`) with phases, not only a final `AuthorizationResponse` |
| Test Suite `isTestSuite` + `this.callback(req, resp)` if the partner still needs Test Suite | POS `authorize()` state machine + extra-route `Payments.retry` |
| `inbound: undefined` unless the processor truly needs inbound | Do not use inbound for the barcode serial |

The example's `saveAndRetry` persists a full `AuthorizationResponse` and calls `this.callback`. That is the **Test Suite** async pattern. POS production must not send `approved` until the terminal finishes, and the processor webhook is an extra public route — it cannot call `this.retry` / `this.callback` unless you are inside a `PaymentProvider` method.

VBase metadata buckets are `{vendor}.{appName}.{bucket}` and are capped at **50 characters**. `pos-payments` fails when `vendor.appName` is long (`400 Metadata bucket name too large`). Default the bucket to `pos`.

Create Payment calls for one `paymentId` **can overlap**. Use `getRawJSON` (etag) then `saveJSON(..., ifMatch)` and re-read on 412. See [`payment-idempotency`](../../payment-idempotency/skill.md).

## Target layout

```text
/
├── manifest.json
├── paymentProvider/
│   └── configuration.json
├── service.json
└── node/
    ├── index.ts
    ├── connector.ts
    └── pos/
        ├── store.ts
        ├── serial.ts
        └── webhook.ts
```

PPP routes (`/manifest`, `/payments`, …) stay registered by `PaymentProviderService`. Only extra POS routes belong in `service.json`.

## `paymentProvider/configuration.json`

```json
{
  "name": "PartnerPos",
  "paymentMethods": [
    { "name": "Venda Direta Debito", "allowsSplit": "onCapture" },
    { "name": "Venda Direta Credito", "allowsSplit": "onCapture" }
  ]
}
```

Do not keep the example's `"MyConnector"` / Visa-only list if this app is POS-only. Those names match SDK `DirectSale`.

## `manifest.json` (relevant bits)

Keep `paymentProvider: "1.x"`, `vbase-read-write`, and `outbound-access` for the processor host. The current example uses `node: "6.x"`; the PPF guide may show `node: "7.x"`. Clone the example as-is, then follow [`payment-provider-framework`](../../payment-provider-framework/skill.md) if the partner already uses `7.x`.

```json
{
  "name": "connector-partnerpos",
  "vendor": "partnername",
  "builders": {
    "node": "6.x",
    "paymentProvider": "1.x"
  },
  "policies": [
    { "name": "vbase-read-write" },
    {
      "name": "outbound-access",
      "attrs": { "host": "api.partner-processor.example.com", "path": "/*" }
    }
  ]
}
```

## `service.json` extra routes

The example's `docs/README.md` redeclares PPP paths. For a PPF app you usually **do not** redeclare `/payments`. Add only POS extras:

```json
{
  "memory": 256,
  "ttl": 10,
  "timeout": 10,
  "minReplicas": 2,
  "maxReplicas": 4,
  "routes": {
    "posSerial": {
      "path": "/_v/partnerpos/pos/serial/:paymentId",
      "public": true
    },
    "posWebhook": {
      "path": "/_v/partnerpos/pos/webhook",
      "public": true
    }
  }
}
```

`submitUrl` in `paymentAppData` must be the public HTTPS URL of `posSerial`.

## `node/index.ts`

```typescript
import { PaymentProviderService } from '@vtex/payment-provider'

import PartnerPosConnector from './connector'
import { posSerial } from './pos/serial'
import { posWebhook } from './pos/webhook'

export default new PaymentProviderService({
  connector: PartnerPosConnector,
  routes: {
    posSerial: posSerial,
    posWebhook: posWebhook,
  },
})
```

## Public host for `submitUrl`

In a linked workspace the Payment App must POST to `{workspace}--{account}.myvtex.com`. On `master`, omit the workspace prefix.

```typescript
function publicHost(ctx: { vtex: { account: string; workspace?: string } }): string {
  const account = ctx.vtex.account
  const workspace = ctx.vtex.workspace
  const prefix = workspace && workspace !== 'master' ? workspace + '--' : ''
  return prefix + account + '.myvtex.com'
}
```

## `node/pos/store.ts`

Keep the bucket name short. `{vendor}.{appName}.pos` must be ≤ 50 characters.

```typescript
export const POS_BUCKET = 'pos'

export interface PosRecord {
  phase: 'identify-terminal' | 'await-pos' | 'approved' | 'denied'
  status: 'undefined' | 'approved' | 'denied'
  callbackUrl: string
  paymentMethod: string
  value: number
  serialNumber?: string
  cardBrand?: string
  firstDigits?: string
  lastDigits?: string
  authorizationId?: string
  nsu?: string
  tid?: string
  code?: string
  message?: string
}

export async function loadPos(vbase: any, paymentId: string) {
  const raw = await vbase.getRawJSON(POS_BUCKET, paymentId, true)
  if (!raw || !raw.data) {
    return { record: null as PosRecord | null, etag: undefined as string | undefined }
  }
  return {
    record: raw.data as PosRecord,
    etag: raw.headers && (raw.headers.etag as string),
  }
}

export async function savePos(
  vbase: any,
  paymentId: string,
  record: PosRecord,
  etag?: string
) {
  try {
    await vbase.saveJSON(POS_BUCKET, paymentId, record, undefined, etag)
    return true
  } catch (err) {
    const status = (err as any).response && (err as any).response.status
    if (status === 412) {
      return false
    }
    throw err
  }
}
```

Do not store a random `tid` or `requestId` on the first identify-terminal write. Overlapping Create Payment calls must land on the same document.

## `node/pos/serial.ts`

`vtex.terminal-connector-app` POSTs `{"serialNumber":"..."}` here. Persist the serial (POS guide step 7). Do **not** start the processor charge here — the next Create Payment does that (step 8.b). This route is public by design. Do not map it to PPP inbound-request.

```typescript
import { json } from 'co-body'

import { loadPos, savePos } from './store'

export async function posSerial(ctx: any, next: () => Promise<void>) {
  const paymentId = ctx.vtex.route.params.paymentId as string
  const body = (await json(ctx.req)) as { serialNumber?: string }
  const serialNumber = body && body.serialNumber

  if (!paymentId || !serialNumber) {
    ctx.status = 400
    ctx.body = { accepted: false }
    return
  }

  const loaded = await loadPos(ctx.clients.vbase, paymentId)

  if (!loaded.record || loaded.record.phase !== 'identify-terminal') {
    ctx.status = 409
    ctx.body = { accepted: false }
    return
  }

  const saved = await savePos(
    ctx.clients.vbase,
    paymentId,
    { ...loaded.record, serialNumber: serialNumber },
    loaded.etag
  )

  if (!saved) {
    const again = await loadPos(ctx.clients.vbase, paymentId)
    if (!again.record || !again.record.serialNumber) {
      ctx.status = 409
      ctx.body = { accepted: false }
      return
    }
  }

  ctx.status = 200
  ctx.body = { accepted: true }
  await next()
}
```

After this handler returns, the next Gateway `authorize()` (Sales App after the terminal app closes) must start the charge once and return Wait for confirmation.

## `node/pos/webhook.ts`

When the processor reports `approved` or `denied`, persist card fragments, then **retry** with a bodiless POST to the stored `callbackUrl`. `Payments.retry` is what `PaymentProvider.retry` calls internally. Keep the query string (`X-VTEX-signature`). Do not POST `status` / `cardBrand` on IO. Do not call this on pending `authorize()` responses.

```typescript
import { json } from 'co-body'
import { Payments } from '@vtex/payment-provider'

import { loadPos, savePos } from './store'

export async function posWebhook(ctx: any, next: () => Promise<void>) {
  const event = (await json(ctx.req)) as {
    paymentId: string
    status: 'approved' | 'denied'
    cardBrand: string
    firstDigits: string
    lastDigits: string
    authorizationId?: string
    nsu?: string
    tid?: string
    code?: string
    message?: string
  }

  const loaded = await loadPos(ctx.clients.vbase, event.paymentId)

  if (!loaded.record || !loaded.record.callbackUrl) {
    ctx.status = 404
    ctx.body = { retryScheduled: false }
    return
  }

  const nextRecord = {
    ...loaded.record,
    phase: event.status,
    status: event.status,
    cardBrand: event.cardBrand,
    firstDigits: event.firstDigits,
    lastDigits: event.lastDigits,
    authorizationId: event.authorizationId,
    nsu: event.nsu,
    tid: event.tid,
    code: event.code,
    message: event.message,
  }

  const saved = await savePos(
    ctx.clients.vbase,
    event.paymentId,
    nextRecord,
    loaded.etag
  )

  if (!saved) {
    const again = await loadPos(ctx.clients.vbase, event.paymentId)
    if (!again.record || again.record.status === 'undefined') {
      ctx.status = 409
      ctx.body = { retryScheduled: false }
      return
    }
  }

  await new Payments(ctx.vtex).retry(loaded.record.callbackUrl)

  ctx.status = 200
  ctx.body = { retryScheduled: true }
  await next()
}
```

Verify the processor's webhook authenticity with whatever signature the partner documents. Do not invent a secret.

## `node/connector.ts` (POS `authorize`)

```typescript
import {
  AuthorizationRequest,
  AuthorizationResponse,
  Authorizations,
  CancellationRequest,
  CancellationResponse,
  Cancellations,
  isDirectSaleAuthorization,
  PaymentProvider,
  RefundRequest,
  RefundResponse,
  Refunds,
  SettlementRequest,
  SettlementResponse,
  Settlements,
} from '@vtex/payment-provider'

import { loadPos, PosRecord, savePos } from './pos/store'

const SECONDS_WAITING = 600

function delays() {
  return {
    delayToAutoSettle: 21600,
    delayToAutoSettleAfterAntifraud: 1800,
    delayToCancel: SECONDS_WAITING,
  }
}

export default class PartnerPosConnector extends PaymentProvider {
  private accountHost(): string {
    const account = this.context.vtex.account
    const workspace = this.context.vtex.workspace
    const prefix = workspace && workspace !== 'master' ? workspace + '--' : ''
    return prefix + account + '.myvtex.com'
  }

  private identifyTerminal(authorization: AuthorizationRequest) {
    return Authorizations.pending(authorization, {
      ...delays(),
      acquirer: 'PartnerPos',
      code: 'POS_IDENTIFY_TERMINAL',
      message: 'Identify the POS terminal',
      paymentAppData: {
        appName: 'vtex.terminal-connector-app',
        payload: JSON.stringify({
          submitUrl:
            'https://' +
            this.accountHost() +
            '/_v/partnerpos/pos/serial/' +
            authorization.paymentId,
        }),
      },
    })
  }

  private waiting(authorization: AuthorizationRequest) {
    return Authorizations.pending(authorization, {
      ...delays(),
      acquirer: 'PartnerPos',
      code: 'POS_WAITING',
      message: 'Waiting for POS confirmation',
      paymentAppData: {
        appName: 'vtex.challenge-wait-for-confirmation',
        payload: JSON.stringify({ secondsWaiting: SECONDS_WAITING }),
      },
    })
  }

  private finalResponse(
    authorization: AuthorizationRequest,
    existing: PosRecord
  ): AuthorizationResponse {
    const cardFields = {
      cardBrand: existing.cardBrand,
      firstDigits: existing.firstDigits,
      lastDigits: existing.lastDigits,
    }

    if (existing.status === 'denied') {
      return {
        ...Authorizations.deny(authorization, {
          ...delays(),
          acquirer: 'PartnerPos',
          code: existing.code,
          message: existing.message,
          tid: existing.tid,
        }),
        ...cardFields,
      } as AuthorizationResponse
    }

    return {
      ...Authorizations.approve(authorization, {
        authorizationId: existing.authorizationId as string,
        nsu: existing.nsu,
        tid: existing.tid as string,
        acquirer: 'PartnerPos',
        code: existing.code,
        message: existing.message,
      }),
      ...delays(),
      ...cardFields,
    } as AuthorizationResponse
  }

  public async authorize(
    authorization: AuthorizationRequest
  ): Promise<AuthorizationResponse> {
    if (!isDirectSaleAuthorization(authorization)) {
      return Authorizations.deny(authorization, {
        ...delays(),
        acquirer: 'PartnerPos',
        code: 'UNSUPPORTED_METHOD',
        message: 'This connector handles POS methods only',
      })
    }

    const paymentId = authorization.paymentId
    const vbase = this.context.clients.vbase
    let loaded = await loadPos(vbase, paymentId)

    if (!loaded.record) {
      await savePos(vbase, paymentId, {
        phase: 'identify-terminal',
        status: 'undefined',
        callbackUrl: authorization.callbackUrl,
        paymentMethod: authorization.paymentMethod,
        value: authorization.value,
      })
      loaded = await loadPos(vbase, paymentId)
    }

    const existing = loaded.record
    if (!existing) {
      return this.identifyTerminal(authorization)
    }

    if (existing.status === 'approved' || existing.status === 'denied') {
      return this.finalResponse(authorization, existing)
    }

    if (existing.phase === 'await-pos') {
      return this.waiting(authorization)
    }

    if (existing.serialNumber && existing.phase === 'identify-terminal') {
      const won = await savePos(
        vbase,
        paymentId,
        { ...existing, phase: 'await-pos' },
        loaded.etag
      )
      if (won) {
        // Start the processor charge once (POS guide step 8.b). Do not wait for the shopper.
        // await partnerProcessor.startCharge({
        //   paymentId: paymentId,
        //   serialNumber: existing.serialNumber,
        //   amount: existing.value,
        // })
      }
      return this.waiting(authorization)
    }

    return this.identifyTerminal(authorization)
  }

  public async cancel(
    cancellation: CancellationRequest
  ): Promise<CancellationResponse> {
    return Cancellations.approve(cancellation, {
      cancellationId: cancellation.paymentId,
    })
  }

  public async refund(refund: RefundRequest): Promise<RefundResponse> {
    return Refunds.deny(refund)
  }

  public async settle(
    settlement: SettlementRequest
  ): Promise<SettlementResponse> {
    return Settlements.deny(settlement)
  }

  public inbound: undefined
}
```

Wire the partner's `startPosCharge` from `authorize()` **after** `posSerial` has stored the serial (POS guide step 8.b), not from the first `authorize()` and not from the serial handler. Only the request that wins the `identify-terminal` → `await-pos` `ifMatch` write should start the charge.

`this.retry(authorization)` is valid **inside** this class. The webhook is a Service route, so it uses `new Payments(ctx.vtex).retry(callbackUrl)` instead.

## Settle / refund / inbound

POS still needs Cancel (Gateway `delayToCancel`). Implement settle/refund according to the processor. Leave `inbound` unimplemented unless the processor requires it — serial number is **not** inbound.
