export class ConfigError extends Error {}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new ConfigError(
      `Missing environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value.trim();
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : undefined;
}

/** API key from the Sent dashboard. The SDK also reads this name by default. */
export const SENT_DM_API_KEY = (): string => required('SENT_DM_API_KEY');

/** Signing secret for the webhook endpoint. Starts with `whsec_`. */
export const SENT_DM_WEBHOOK_SECRET = (): string => required('SENT_DM_WEBHOOK_SECRET');

/** The phone number the demo notifies, in E.164 format (for example +15551234567). */
export const DEMO_PHONE_NUMBER = (): string => {
  const number = required('DEMO_PHONE_NUMBER');
  if (!/^\+[1-9]\d{6,14}$/.test(number)) {
    throw new ConfigError(`DEMO_PHONE_NUMBER must be E.164, e.g. +15551234567. Got: ${number}`);
  }
  return number;
};

/**
 * Template to send. A template is referenced by id or by name, never both, so
 * whichever one is set in .env wins, with the id taking precedence.
 */
export const templateRef = (): { id: string } | { name: string } => {
  const id = optional('SENT_TEMPLATE_ID');
  if (id) return { id };
  const name = optional('SENT_TEMPLATE_NAME');
  if (name) return { name };
  throw new ConfigError('Set either SENT_TEMPLATE_ID or SENT_TEMPLATE_NAME in .env.');
};

/** Port the local webhook receiver listens on. */
export const WEBHOOK_PORT = (): number => Number(optional('WEBHOOK_PORT') ?? 3000);

/** Path the webhook receiver serves. Must match the URL registered with Sent. */
export const WEBHOOK_PATH = (): string => optional('WEBHOOK_PATH') ?? '/webhooks/sent';

/** Public HTTPS URL of the tunnel, used only by the register-webhook helper. */
export const PUBLIC_WEBHOOK_URL = (): string => required('PUBLIC_WEBHOOK_URL');

/** When true, Sent simulates the send instead of charging for a real one. */
export const SANDBOX = (): boolean => (optional('SENT_SANDBOX') ?? 'false') === 'true';
