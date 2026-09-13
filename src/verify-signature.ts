import { createHmac, timingSafeEqual } from 'node:crypto';

/** Reject events whose timestamp is further from now than this, to blunt replays. */
const TOLERANCE_SECONDS = 300;

export interface SignatureHeaders {
  webhookId: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

/**
 * Verify a Sent webhook delivery.
 *
 * Sent signs `{webhookId}.{timestamp}.{rawBody}` with HMAC-SHA256, using the raw
 * bytes of the base64 secret that sits behind the `whsec_` prefix, and sends the
 * result as `v1,{base64}`. The body must be the exact bytes received: parsing and
 * re-serialising the JSON changes them and the signature will not match.
 */
export function verifySignature(
  headers: SignatureHeaders,
  rawBody: Buffer,
  secret: string,
): VerifyResult {
  const { webhookId, timestamp, signature } = headers;

  if (!webhookId || !timestamp || !signature) {
    return { ok: false, reason: 'missing signature headers' };
  }

  const sentAt = Date.parse(timestamp);
  const age = Number.isNaN(sentAt)
    ? Math.abs(Date.now() / 1000 - Number(timestamp))
    : Math.abs(Date.now() - sentAt) / 1000;
  if (!Number.isFinite(age)) return { ok: false, reason: 'unreadable timestamp' };
  if (age > TOLERANCE_SECONDS) return { ok: false, reason: `timestamp is ${Math.round(age)}s old` };

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signedPayload = Buffer.concat([
    Buffer.from(`${webhookId}.${timestamp}.`, 'utf8'),
    rawBody,
  ]);
  const expected = `v1,${createHmac('sha256', key).update(signedPayload).digest('base64')}`;

  // A header may carry several space-separated versions; one match is enough.
  const matched = signature
    .split(/\s+/)
    .filter(Boolean)
    .some((candidate) => equals(candidate, expected));

  return matched ? { ok: true } : { ok: false, reason: 'signature mismatch' };
}

function equals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}
