# Generation workflow

Read this file before writing any connector files. Do not generate a Visa/Mastercard ecommerce connector unless the user also asked for ecommerce methods.

Then load:

- [ppf-scaffold.md](ppf-scaffold.md) if hosting is **VTEX IO / PPF** (the usual Alliances path)
- [examples.md](examples.md) when you need expected JSON
- [`payment-provider-protocol`](../../payment-provider-protocol/skill.md) for endpoint shapes
- [`payment-idempotency`](../../payment-idempotency/skill.md) for `paymentId`
- [`payment-provider-framework`](../../payment-provider-framework/skill.md) for IO wiring (`PaymentProviderService`, `configuration.json`, TypeScript 3.9.7)

## 1. Ask these four questions first

If any answer is missing, ask. Do not invent a production connector name, host, or processor API. The "dummy / local test" column is only for local fixtures, not production names.

| # | Question | Why it matters | Default if the user says "dummy / local test" |
|---|---|---|---|
| 1 | Connector name (`vendor.app-name`) | Becomes `manifest.json` `vendor`/`name` and the Admin affiliation | `dummyaccount.dummy-latam-pos` |
| 2 | Hosting: **VTEX IO / PPF** or **standalone HTTP** | Chooses IO retry vs notification callback | **PPF** |
| 3 | Credit, debit, or both POS methods | Manifest must use exact API names | Both `Venda Direta Credito` and `Venda Direta Debito` |
| 4 | Processor terminal API (how you start a charge on a serial number) | Outside VTEX; the connector only forwards the serial | In-memory stub |

Stop after the questions if the user still needs to choose hosting. Then implement.

## 2. Prefer cloning the official PPF example

For PPF, follow Getting started in the [Payment Provider Framework](https://developers.vtex.com/docs/guides/payments-integration-payment-provider-framework) guide: clone the official example app, then overlay POS. Do not start from an empty Node service. The example already wires `PaymentProvider`, `PaymentProviderService`, VBase, and Test Suite hooks.

Replace the example `vendor` / `name` with the partner `vendor` / `name`. Keep `builders.paymentProvider: "1.x"`. Copy overlay files from [ppf-scaffold.md](ppf-scaffold.md).

Keep the example's Test Suite helper (`this.callback(req, resp)` after persisting a full `AuthorizationResponse`) for Test Suite only. POS production flow is a state machine in `authorize()`, plus extra public routes. Do not replace the POS webhook with `this.callback`.

Standalone HTTP is only when the partner already hosts PPP middleware. Then implement the six payment-flow routes yourself; still follow the POS state machine in this skill.

## 3. Implement in this order

Do not skip steps. Each step has a STOP if the previous artifact is missing.

1. Declare `Venda Direta Credito` / `Venda Direta Debito` in `paymentProvider/configuration.json` (PPF) or GET `/manifest` (standalone). **STOP** if the names have accents or differ from these ASCII strings.
2. Persist a state machine keyed by `paymentId`: `identify-terminal` → `await-pos` → `approved` | `denied` | `canceled`. On PPF, use VBase (`vbase-read-write`). Store `callbackUrl`, `paymentMethod`, and `value` on first authorize.
3. First `authorize()`: `status: "undefined"` + `vtex.terminal-connector-app` with string `payload.submitUrl`. **STOP** if `payload` is a nested object or `appName` is `vtex.challenge-terminal-connector-app`.
4. Public HTTPS route for `{"serialNumber":"..."}`. **Not** PPP inbound-request. **STOP** if `submitUrl` contains `/inbound`.
5. Start the processor charge only after the serial is stored. Repeated Create Payment polls must not start a second charge.
6. Next `authorize()`: `undefined` + `vtex.challenge-wait-for-confirmation` (`secondsWaiting`). `delayToCancel >= secondsWaiting`.
7. Processor webhook:
   - **PPF extra route:** persist final status + `cardBrand` / `firstDigits` / `lastDigits`, then POST `{ "paymentId": "..." }` to the stored `callbackUrl` (keep the query string / `X-VTEX-signature`). That is IO retry. `this.retry(authorization)` is only valid inside a `PaymentProvider` method, not in a standalone route handler.
   - **Standalone:** POST the notification payload (including those card fields) to `callbackUrl`. Keep `X-VTEX-signature`.
8. Implement `cancel()` so Gateway timeout can abort `undefined`.
9. Print the review checklist from the skill. Tell the partner what generated code cannot do.

## 4. What to print when you finish

Always include:

- The files you created or patched, and that they overlay the official PPF example app rather than a blank Express app
- The exact `paymentMethods` names
- `submitUrl` and the processor webhook path
- Whether the partner is on IO retry (`{ paymentId }` only) or standalone notification (status + card fragments)
- The skill review checklist, unchecked items called out
- This limitation, verbatim in spirit: a skill run cannot replace a Sales App device, a physical or certified test POS, Admin affiliation and payment conditions (`44` debit, `45` credit), the Payment Provider Test Suite, or homologation
