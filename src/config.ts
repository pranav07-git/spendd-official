// Until sign-up exists, the greeting name on the PIN and biometric screens
// comes from here.
export const USER_NAME = 'Pranav';

export const PIN_LENGTH = 4;


// Spendd insights server (see server/README.md). In development the phone reaches the Mac through
// `adb reverse tcp:8787 tcp:8787`, so localhost works; release builds need an HTTPS URL.
/** Your deployed server, HTTPS only (release builds block plain HTTP). Spendd AI is off until it's set. */
const PRODUCTION_API_URL = '';
/** Debug builds use the server on this Mac through `adb reverse tcp:8787 tcp:8787` (npm run reverse). */
export const INSIGHTS_API_URL = __DEV__ ? 'http://localhost:8787' : PRODUCTION_API_URL;
// Must match SPENDD_APP_TOKEN on the server when that is set.

// The server's shared token lives in src/secrets.ts, which is git-ignored.
export { INSIGHTS_API_TOKEN } from './secrets';
