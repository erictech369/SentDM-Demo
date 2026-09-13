/**
 * List the webhook event types this account can subscribe to.
 *
 * Handy before configuring the webhook, so the names you subscribe to are the
 * names Sent actually emits. Run with: npm run event-types
 */
import { getSent } from './sent.ts';
import { run } from './run.ts';

await run(async () => {
  const response = await getSent().webhooks.listEventTypes();

  for (const family of response.data?.event_types ?? []) {
    console.log(`${family.name ?? family.event_type} — ${family.description ?? ''}`);
    for (const sub of family.sub_types ?? []) {
      console.log(`   ${sub.name ?? sub.event_type} — ${sub.description ?? ''}`);
    }
  }
});
