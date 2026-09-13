import Sent from '@sentdm/sentdm';
import { getSent } from './sent.ts';
import { SANDBOX, templateRef } from './env.ts';

export interface NotifyResult {
  messageId: string;
  /** Overall batch status. QUEUED once Sent has accepted the send. */
  status: string;
  /**
   * Channel Sent picked for this recipient. Null while the routing decision is
   * still pending, which is the normal case for an auto-detected send.
   */
  channel: string | null;
}

/**
 * Notify one person.
 *
 * The caller passes who to reach and what to say. It never passes a channel:
 * `channel: ['sent']` hands the SMS / WhatsApp / RCS decision to Sent's router,
 * which weighs reachability, engagement and price per recipient.
 */
export async function notifyUser(
  phoneNumber: string,
  parameters: Record<string, string>,
): Promise<NotifyResult> {
  const response = await getSent().messages.send({
    to: [phoneNumber],
    channel: ['sent'],
    template: { ...templateRef(), parameters },
    sandbox: SANDBOX(),
  });

  const recipient = response.data?.recipients?.[0];
  if (!recipient?.message_id) {
    throw new Error(`Send was accepted but returned no message id: ${JSON.stringify(response)}`);
  }

  // The response echoes back what you asked for, so an auto-detected send comes
  // back as the sentinel `sent` rather than a real channel. Treat that as "not
  // decided yet": the routing decision arrives on the message record instead.
  const channel = recipient.channel && recipient.channel !== 'sent' ? recipient.channel : null;

  return {
    messageId: recipient.message_id,
    status: response.data?.status ?? 'UNKNOWN',
    channel,
  };
}

/**
 * Read back the channel Sent settled on.
 *
 * A send is accepted asynchronously, so an auto-detected message reports its
 * channel as null in the send response. The routing decision shows up moments
 * later on the message record, and again on every webhook event.
 */
const TERMINAL = new Set(['DELIVERED', 'READ', 'FAILED', 'BLOCKED']);

export async function resolveChannel(
  messageId: string,
  attempts = 8,
  delayMs = 1500,
): Promise<{ channel: string | null; status: string | null }> {
  let last: { channel: string | null; status: string | null } = { channel: null, status: null };

  for (let attempt = 0; attempt < attempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      const response = await getSent().messages.retrieveStatus(messageId);
      last = {
        channel: response.data?.channel ?? null,
        status: response.data?.status ?? null,
      };
      if (last.status && TERMINAL.has(last.status)) return last;
    } catch (error) {
      // The record is not queryable the instant the send is accepted, so a 404
      // here means "not yet", not "no such message".
      if (!(error instanceof Sent.APIError) || error.status !== 404) throw error;
    }
  }

  return last;
}
