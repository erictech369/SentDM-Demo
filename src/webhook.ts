/**
 * Local webhook receiver.
 *
 * Sent POSTs one event per status change, so a single message produces several:
 * message.sent when it reaches the provider, then message.delivered when the
 * device confirms it. Run with: npm run webhook
 */
import { createServer, type IncomingMessage } from 'node:http';
import type { MessageEvent } from '@sentdm/sentdm/resources/webhooks';
import { SENT_DM_WEBHOOK_SECRET, WEBHOOK_PATH, WEBHOOK_PORT } from './env.ts';
import { verifySignature } from './verify-signature.ts';
import { run } from './run.ts';

let secret = '';
const path = WEBHOOK_PATH();
const port = WEBHOOK_PORT();

async function readRawBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

const server = createServer((request, response) => {
  void (async () => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200).end('ok');
      return;
    }

    if (request.method !== 'POST' || !request.url?.startsWith(path)) {
      response.writeHead(404).end();
      return;
    }

    const rawBody = await readRawBody(request);
    const verdict = verifySignature(
      {
        webhookId: header(request, 'x-webhook-id'),
        timestamp: header(request, 'x-webhook-timestamp'),
        signature: header(request, 'x-webhook-signature'),
      },
      rawBody,
      secret,
    );

    if (!verdict.ok) {
      console.warn(`Rejected webhook: ${verdict.reason}`);
      response.writeHead(401).end('invalid signature');
      return;
    }

    // Answer first. Sent retries anything that is slow or not a 2xx.
    response.writeHead(200).end('ok');

    let event: MessageEvent;
    try {
      event = JSON.parse(rawBody.toString('utf8')) as MessageEvent;
    } catch {
      console.warn('Verified webhook carried a body that is not JSON.');
      return;
    }

    if (event.field !== 'message' || !event.payload) {
      console.log(`Event ${event.event ?? event.field ?? 'unknown'} (not a message status change)`);
      return;
    }

    const { message_id, message_status, channel, outbound_number, updated_at } = event.payload;
    console.log(
      [
        `[${updated_at ?? event.timestamp ?? new Date().toISOString()}]`,
        (event.event ?? 'message').padEnd(18),
        `status=${(message_status ?? 'unknown').padEnd(9)}`,
        `channel=${(channel ?? 'unknown').padEnd(8)}`,
        `to=${outbound_number ?? 'unknown'}`,
        `id=${message_id ?? 'unknown'}`,
      ].join('  '),
    );
  })().catch((error: unknown) => {
    console.error('Webhook handler failed:', error);
    if (!response.headersSent) response.writeHead(500).end();
  });
});
await run(async () => {
  secret = SENT_DM_WEBHOOK_SECRET();
  server.listen(port, () => {
    console.log(`Webhook receiver listening on http://localhost:${port}${path}`);
    console.log('Expose this port with a tunnel, then register that public URL with Sent.\n');
  });
});

