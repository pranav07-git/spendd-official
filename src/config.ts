// Until sign-up exists, the greeting name on the PIN and biometric screens
// comes from here.
export const USER_NAME = 'Pranav';

export const PIN_LENGTH = 4;

// Leave empty until the documents are hosted; the links are inert while empty.
export const PRIVACY_POLICY_URL = '';
export const TERMS_OF_SERVICE_URL = '';

// Spendd insights server (see server/README.md). In development the phone reaches the Mac through
// `adb reverse tcp:8787 tcp:8787`, so localhost works; release builds need an HTTPS URL.
export const INSIGHTS_API_URL = 'http://localhost:8787';
// Must match SPENDD_APP_TOKEN on the server when that is set.
export const INSIGHTS_API_TOKEN = 'REDACTED_TOKEN';
