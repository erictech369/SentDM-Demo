/**
 * Register the tunnel URL as a webhook, from the terminal instead of the dashboard.
 *
 * Prints the signing secret once. Copy it into .env as SENT_DM_WEBHOOK_SECRET.
 * Run with: npm run register-webhook
 */
import { PUBLIC_WEBHOOK_URL, WEBHOOK_PATH } from './env.ts';
import { getSent } from './sent.ts';
import { run } from './run.ts';

await run(async () => {
  const endpoint = new URL(WEBHOOK_PATH(), PUBLIC_WEBHOOK_URL()).toString();

  // You subscribe to the family, `message`, and narrow it with filters. The
  // filter values are bare names, so `sent`, not `message.sent`. The events
  // themselves still arrive as message.sent and message.delivered.
  const response = await getSent().webhooks.create({
    display_name: 'Local notification demo',
    endpoint_url: endpoint,
    event_types: ['message'],
    event_filters: { message: ['routed', 'sent', 'delivered', 'failed', 'blocked'] },
    timeout_seconds: 10,
  });

  const webhook = response.data;
  console.log(`Webhook created: ${webhook?.id}`);
  console.log(`Endpoint: ${webhook?.endpoint_url}`);
  console.log(`Events: ${(webhook?.event_types ?? []).join(', ')}`);
  console.log(`Filters: ${JSON.stringify(webhook?.event_filters ?? {})}`);
  console.log(`\nSigning secret (shown once):\n${webhook?.signing_secret ?? '(not returned)'}`);
});
