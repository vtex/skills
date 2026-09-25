# Examples

Use this file for copy-paste prompts and for the JSON the agent must match. Implementation order: [generation.md](generation.md). PPF files: [ppf-scaffold.md](ppf-scaffold.md).

Values such as `DummyLatamPos`, `dummyaccount`, `PartnerPos`, `PAY-POS-001`, `600`, and `411111` / `1111` are examples. Replace them with the partner's connector, account, timeouts, and processor card fragments. `600` is not a VTEX-required default.

## Partner prompt (PPF — preferred)

```text
Create a VTEX IO Payment Provider Framework connector for PPP + POS on VTEX Sales App.

Clone the official PPF example app from the Payment Provider Framework Getting started guide and overlay POS. Do not start from an empty Express app.

Connector name: DummyLatamPos
Hosting: VTEX IO / PPF
Payment methods: Venda Direta Credito and Venda Direta Debito
Processor: fake in-memory terminal
Account: dummyaccount

Do not generate an ecommerce Visa/Mastercard connector.
Do not use Secure Proxy on the POS authorize path.
On IO, persist the POS result, then Payments.retry(callbackUrl) or this.retry inside PaymentProvider
(bodiless POST). Return cardBrand / firstDigits / lastDigits on the next authorize().
Serial number must use a public custom route, not PPP inbound-request.
```

## Partner prompt (standalone HTTP)

```text
Create a standalone PPP connector for POS on VTEX Sales App.
Hosting: our own HTTPS service (not VTEX IO).
Methods: Venda Direta Credito and Venda Direta Debito.
When the POS finishes, POST a notification payload to callbackUrl
including status, cardBrand, firstDigits, and lastDigits.
Keep X-VTEX-signature. Do not use this.retry.
```

## State machine (what each `authorize()` returns)

The connector only **answers**. After the terminal app closes, VTEX Sales App triggers a Gateway callback (POS guide step 8). Wait for confirmation then polls (step 9). Do not POST `callbackUrl` until the processor webhook has a final status.

| Stored phase | Who drives Create Payment | Create Payment / `authorize()` |
|---|---|---|
| *(no record)* | Sales App checkout → Gateway | Create `identify-terminal`, return terminal app |
| `identify-terminal` (no serial) | Gateway / Sales App | `undefined` + `vtex.terminal-connector-app` (`submitUrl`) |
| `identify-terminal` (serial stored) | Sales App after the terminal app closes (step 8) | Start charge **once**, then wait app |
| `await-pos` | Wait for confirmation polling (step 9) | `undefined` + `vtex.challenge-wait-for-confirmation` (`secondsWaiting`); no retry POST |
| `approved` / `denied` | Wait app / Sales App after IO retry | Final status + `cardBrand` + `firstDigits` + `lastDigits` |

## First `authorize()` response (identify terminal)

`paymentMethod` is `Venda Direta Credito` or `Venda Direta Debito`. `card.*` is `null`.

```json
{
  "paymentId": "PAY-POS-001",
  "status": "undefined",
  "delayToCancel": 600,
  "paymentAppData": {
    "appName": "vtex.terminal-connector-app",
    "payload": "{\"submitUrl\":\"https://dummyaccount.myvtex.com/_v/partnerpos/pos/serial/PAY-POS-001\"}"
  }
}
```

`payload` is a **string**. `appName` is `vtex.terminal-connector-app`, never `vtex.challenge-terminal-connector-app`.

Serial POST body to `submitUrl`:

```json
{ "serialNumber": "12345" }
```

## After serial number, next `authorize()` (wait)

```json
{
  "paymentId": "PAY-POS-001",
  "status": "undefined",
  "delayToCancel": 600,
  "paymentAppData": {
    "appName": "vtex.challenge-wait-for-confirmation",
    "payload": "{\"secondsWaiting\":600}"
  }
}
```

`delayToCancel` must be `>= secondsWaiting`. Repeated polls with the same `paymentId` must not start a second POS charge. Those polls can overlap — persist with an etag / `ifMatch` (see [`payment-idempotency`](../../payment-idempotency/skill.md)).

## IO retry vs standalone notification

| | PPF / VTEX IO | Standalone |
|---|---|---|
| `callbackUrl` | `/retry` | `/callback` or `/notification` |
| When POS finishes | Persist, then bodiless POST to `callbackUrl` (`Payments.retry` or `this.retry` inside `PaymentProvider`) | POST full payload to `callbackUrl` |
| Retry/callback HTTP body | Empty (`Payments.retry` posts `undefined`) | Includes `status`, `cardBrand`, `firstDigits`, `lastDigits` |
| Where card fragments appear | Next `authorize()` response | Notification POST body |

### IO retry (correct)

PPF retry is a **bodiless** POST to the stored `callbackUrl` (`paymentId` is already in the URL). `Payments.retry` is what `this.retry` uses.

```typescript
import { Payments } from '@vtex/payment-provider'

await new Payments(ctx.vtex).retry(callbackUrl)
```

### Next `authorize()` after a successful IO retry

```json
{
  "paymentId": "PAY-POS-001",
  "status": "approved",
  "authorizationId": "AUTH-POS-001",
  "nsu": "NSU-001",
  "tid": "TID-001",
  "acquirer": "PartnerPos",
  "code": "0000",
  "message": "POS approved",
  "delayToCancel": 600,
  "cardBrand": "Visa",
  "firstDigits": "411111",
  "lastDigits": "1111"
}
```

### Standalone notification body (correct off IO)

```json
{
  "paymentId": "PAY-POS-001",
  "status": "approved",
  "authorizationId": "AUTH-POS-001",
  "nsu": "NSU-001",
  "tid": "TID-001",
  "acquirer": "PartnerPos",
  "code": "0000",
  "message": "POS approved",
  "cardBrand": "Visa",
  "firstDigits": "411111",
  "lastDigits": "1111"
}
```

### Wrong on IO

```typescript
await fetch(authorization.callbackUrl, {
  method: 'POST',
  body: JSON.stringify({
    paymentId: authorization.paymentId,
    status: 'approved',
    cardBrand: 'Visa',
    firstDigits: '411111',
    lastDigits: '1111',
  }),
})
```

That is the standalone notification pattern. On IO it will not complete the Wait for confirmation flow correctly.

### Right on IO (extra route / webhook)

```typescript
import { Payments } from '@vtex/payment-provider'

await vbase.saveJSON('pos', paymentId, {
  status: 'approved',
  cardBrand: 'Visa',
  firstDigits: '411111',
  lastDigits: '1111',
})

await new Payments(ctx.vtex).retry(callbackUrl)
```

Then `authorize()` reads that record and returns `approved` plus the three card fields.

`this.retry(authorization)` is the same bodiless retry, but only inside a `PaymentProvider` method.

## What generated code cannot do

A skill run cannot replace:

- A device with VTEX Sales App
- A physical or certified test POS
- Admin affiliation + payment conditions (`44` debit, `45` credit in Sales App filters)
- Payment Provider Test Suite and homologation
