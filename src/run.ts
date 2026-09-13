import Sent from '@sentdm/sentdm';
import { ConfigError } from './env.ts';

/**
 * Run a script and turn the two failures worth expecting into one readable line:
 * a .env that is not filled in, and an error coming back from the API.
 */
export async function run(main: () => Promise<void>): Promise<void> {
  try {
    await main();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`\nConfiguration problem: ${error.message}`);
    } else if (error instanceof Sent.APIError) {
      console.error(`\nSent API error ${error.status ?? ''}: ${error.message}`);
    } else {
      console.error('\nUnexpected failure:', error);
    }
    process.exitCode = 1;
  }
}
