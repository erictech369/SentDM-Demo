import Sent from '@sentdm/sentdm';
import { SENT_DM_API_KEY } from './env.ts';

let client: Sent | undefined;

/**
 * The shared client, built on first use.
 *
 * Building it lazily keeps a missing API key from throwing while modules are
 * still loading, so the scripts can report it as a plain one-line message.
 */
export function getSent(): Sent {
  client ??= new Sent({ apiKey: SENT_DM_API_KEY() });
  return client;
}
