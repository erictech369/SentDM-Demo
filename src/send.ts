/**
 * Trigger the notification, then show what Sent decided.
 *
 * Run with: npm run send
 */
import { DEMO_PHONE_NUMBER } from './env.ts';
import { notifyUser, resolveChannel } from './notify.ts';
import { run } from './run.ts';

await run(async () => {
  const to = DEMO_PHONE_NUMBER();

  console.log(`Sending notification to ${to} without naming a channel...\n`);

  // The pre-built verification template takes one variable, var_1, which is the
  // code. A custom template with its own variables goes here instead.
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const result = await notifyUser(to, { var_1: code });

  console.log(`Verification code in this message: ${code}\n`);

  console.log('Send accepted by Sent:');
  console.table([
    { field: 'message_id', value: result.messageId },
    { field: 'status', value: result.status },
    { field: 'channel', value: result.channel ?? '(pending routing)' },
  ]);

  if (!result.channel) {
    console.log('\nRouting decision is still pending. Polling the message record...');
    const resolved = await resolveChannel(result.messageId);

    console.log(
      resolved.channel
        ? `Sent routed this message over: ${resolved.channel.toUpperCase()} (status ${resolved.status})`
        : 'Channel not reported yet. The webhook events below will carry it.',
    );

    if (resolved.status === 'FAILED' || resolved.status === 'BLOCKED') {
      console.log(
        `\nThis message did not reach the handset. Status is ${resolved.status}.` +
          '\nCheck the dashboard activity log for the reason, and see the troubleshooting notes in README.md.',
      );
    }
  }

  console.log('\nWatch the webhook terminal for message.sent, then message.delivered.');
});
