# Sent multi-channel notifications

A small, complete example of sending a notification that reaches one person without
deciding how. The app sends a template to a phone number and lets [Sent](https://www.sent.dm)'s
router pick SMS, WhatsApp or RCS. A local webhook receiver then follows that message from
`message.sent` to `message.delivered`.

Built on the official TypeScript SDK, [`@sentdm/sentdm`](https://www.npmjs.com/package/@sentdm/sentdm).

Use it as a starting point for transactional notifications — verification codes, order
updates, alerts — where you care that the message arrives, not which network carries it.

---

## What is in here

| File | What it does |
| --- | --- |
| `src/notify.ts` | The notification feature. Sends a template, never names a channel. |
| `src/send.ts` | Triggers a notification and prints the message id, status and routed channel. |
| `src/webhook.ts` | Local receiver. Verifies the signature, logs each lifecycle event. |
| `src/verify-signature.ts` | HMAC-SHA256 verification of the webhook signature. |
| `src/register-webhook.ts` | Optional. Registers your tunnel URL instead of using the dashboard. |
| `src/event-types.ts` | Optional. Lists the event types your account can subscribe to. |
| `src/env.ts`, `src/sent.ts`, `src/run.ts` | Config, client, and readable error output. |

No web framework. The receiver is `node:http`, because signature verification needs the
raw request bytes.

TypeScript runs directly on Node 24. No build step, no `tsx`.

---

## Account setup

Two of these have a waiting period, so start them before you need the code working.

1. **Create a Sent account** at [sent.dm](https://www.sent.dm) and verify your email and
   phone number.
2. **Register for US SMS.** Fill in the brand and campaign information in the dashboard;
   Sent submits it to The Campaign Registry for you. Approval typically takes one to three
   business days. Nothing sends over SMS until this clears.
3. **Connect WhatsApp Business**, if you want WhatsApp to be a candidate channel. This is
   a separate connection flow in the dashboard.
4. **Pick or create a template.** The example sends Sent's pre-built verification template,
   which takes a single variable named `var_1` (the code). If you create your own template,
   use category `UTILITY` for a transactional notification, and change the variables passed
   in `src/send.ts` to match. A WhatsApp template also needs Meta's approval, which is its
   own wait.
5. **Create an API key** in the dashboard.
6. **Use a phone number you can check.** Sent has no separate test number, so the example
   sends to a real handset. See the sandbox note below if you would rather it did not.

---

## Install

Requires Node 22.6 or newer — it relies on native TypeScript execution and `--env-file`.
Built and checked on Node 24.16.

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

```
SENT_DM_API_KEY=your_api_key
DEMO_PHONE_NUMBER=+15551234567
SENT_TEMPLATE_ID=your_template_id
```

Leave `SENT_DM_WEBHOOK_SECRET` empty for now — you get it in the next section.

To reference a template by name instead of id, set `SENT_TEMPLATE_NAME` and leave
`SENT_TEMPLATE_ID` empty. The id wins if both are set.

`.env` is gitignored, so the repository stays publishable.

Type-check anytime with `npm run typecheck`.

---

## Webhook setup

Skip this if you only want to send. `npm run send` works on its own; the webhook is what
lets you watch delivery happen.

1. **Start the receiver.**

   ```bash
   npm run webhook
   ```

   It listens on `http://localhost:3000/webhooks/sent`. Override with `WEBHOOK_PORT` and
   `WEBHOOK_PATH`.

2. **Expose it.** In a second terminal, open a tunnel to port 3000:

   ```bash
   ngrok http 3000
   ```

   `cloudflared tunnel --url http://localhost:3000` works just as well. Copy the HTTPS URL
   it prints.

3. **Register it.** In the dashboard, create a webhook pointing at
   `https://<your-tunnel>/webhooks/sent` and subscribe to `message.sent` and
   `message.delivered`.

   Or do it from the terminal: put the tunnel base URL in `PUBLIC_WEBHOOK_URL` and run
   `npm run register-webhook`. It prints the signing secret once.

4. **Copy the signing secret** into `.env` as `SENT_DM_WEBHOOK_SECRET`. It starts with
   `whsec_`. Restart the receiver so it picks up the new value.

5. **Send a test event** from the dashboard and confirm the endpoint answers 200.

Run `npm run event-types` to see the exact event names your account can subscribe to.

---

## Run it

Two terminals:

```bash
# terminal 1
npm run webhook

# terminal 2
npm run send
```

Terminal 2 prints the message id, the status, and the channel. Terminal 1 then prints one
line per lifecycle event:

```
[2026-09-10T08:38:25Z]  message.sent       status=SENT       channel=whatsapp  to=+1555…  id=abc-123
[2026-09-10T08:38:29Z]  message.delivered  status=DELIVERED  channel=whatsapp  to=+1555…  id=abc-123
```

Set `SENT_SANDBOX=true` in `.env` to have Sent simulate the send instead of delivering it.
Useful for wiring things up without spending sends or lighting up a handset.

---

## How the pieces fit

**Sending.** `notifyUser()` passes `channel: ['sent']`, Sent's auto-detect value. The caller
supplies the recipient and the template variables, nothing else. The message body lives in
the template, in the dashboard, so copy changes never touch application code.

```ts
import { notifyUser } from './notify.ts';

const { messageId, status, channel } = await notifyUser('+15551234567', { var_1: '123456' });
```

**The channel is not in the send response.** A send is accepted asynchronously, so when you
let Sent auto-detect the channel, the response comes back with the channel unresolved — the
routing decision has not been made yet. The SDK's own types say so: the field is "null when
the channel is auto-detected."

`resolveChannel()` in `src/notify.ts` handles that by polling the message record until the
status is terminal. The webhook events carry the channel too, so a real application would
usually rely on those rather than polling. If you need the channel in the first response,
name the channels explicitly — `channel: ['whatsapp']` in `src/notify.ts`, for example — but
then you have given up the routing.

**Receiving.** Sent signs every delivery with your endpoint's secret. The receiver rebuilds
the signed string from the webhook id, the timestamp and the raw body, then checks the
HMAC-SHA256 against the `x-webhook-signature` header before it reads the payload.
Deliveries older than five minutes are rejected, which blunts replays. The comparison is
constant-time.

The receiver answers 200 before doing anything with the event. Sent retries anything slow
or non-2xx, and a duplicate event is easier to avoid than to clean up.

---

## Troubleshooting

**"Configuration problem: Missing environment variable…"** — `.env` is not filled in. The
scripts name the exact variable.

**401 from the API** — the API key is wrong, or it belongs to a different account.

**No webhook events arrive** — check the tunnel is still up, the registered URL still
matches it, and the path ends in `/webhooks/sent`. Tunnel URLs change on every restart
unless you have a reserved domain. The dashboard's webhook delivery log shows what Sent
tried to send and what your endpoint answered.

**"Rejected webhook: signature mismatch"** — the secret in `.env` is not the one for this
endpoint. Registering a new webhook mints a new secret.

**"Rejected webhook: timestamp is …s old"** — your machine's clock has drifted, or you
replayed a saved request.

**Message reports BLOCKED** — the send was accepted but stopped before delivery. Usually
10DLC registration that has not cleared, a template not approved for sending, or an
account balance of zero.

---

## Links

- [Sent documentation](https://docs.sent.dm/)
- [TypeScript SDK](https://docs.sent.dm/sdks/typescript)
- [Webhooks and events](https://docs.sent.dm/start/webhooks)
- [Signature verification](https://docs.sent.dm/start/webhooks/signature-verification)
- [Sent on GitHub](https://github.com/sentdm)
