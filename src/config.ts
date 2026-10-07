export const PIN_LENGTH = 4;


// Spendd server (see server/README.md): accounts, insights and categories. In development the phone
// reaches the Mac through `adb reverse tcp:8787 tcp:8787`, so localhost works; release builds need an
// HTTPS URL.
/** Your deployed server, HTTPS only (release builds block plain HTTP). Sign-in is off until it's set. */
const PRODUCTION_API_URL = 'https://spendd-server.onrender.com';
/** Debug builds use the server on this Mac through `adb reverse tcp:8787 tcp:8787` (npm run reverse). */
export const API_URL = __DEV__ ? 'http://localhost:8787' : PRODUCTION_API_URL;
