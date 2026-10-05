# Spendd

Agentic finance app. React Native CLI (0.87, New Architecture), Android only for now.

## Screens & flow

```
Intro ─▶ Statement ─▶ Consent ─▶ Add PIN ─▶ Retype PIN ─▶ Setup Biometric ─▶ Home
                                                                 ▲
App relaunch (setup complete) ─▶ Enter PIN / biometric ──────────┘
```

| Screen | Behaviour |
| --- | --- |
| Intro | Two-step progress bar, animated insight cards, **Next**. |
| Statement | Tap the drop zone or **Upload statement** to pick a PDF / CSV / QIF (extension is validated). **Start fresh** skips the import. |
| Consent | **Allow & continue** is disabled until the agreement box is ticked. On allow, consent is recorded and the picked statement is copied into app-private storage. **Not now** continues without importing anything. |
| Add PIN | 4-digit keypad, rejects trivially guessable PINs (1111, 1234, 9876…). Long-press ⌫ clears. |
| Retype PIN | Must match; mismatch shakes, vibrates and clears. PIN is stored in the Android Keystore (`react-native-keychain`). |
| Setup Biometric | **Enable biometrics** creates a biometric-bound Keystore key (shows the system prompt). **Maybe later** skips. |
| Enter PIN (relaunch) | Auto-prompts biometrics if enabled (fingerprint key in the keypad's bottom-left), 5 wrong PINs → 30 s lockout. **Forgot PIN?** resets the app after confirmation. |

The greeting name and the Privacy Policy / Terms URLs are placeholders in [src/config.ts](src/config.ts).

## Logging payments from screenshots

On any UPI or bank app's "payment successful" screen, tap **Share → Spendd**. Spendd never opens; a
"Logging transaction…" notification pops up and updates to "Transaction logged · ₹1,000 to Aditya Raj".

```
Share sheet ─▶ ShareReceiverActivity ─▶ copy image ─▶ WorkManager: ReceiptWorker
   (invisible, finishes at once)                        ├─ ReceiptOcr: ML Kit, on-device, multi-pass
                                                        │    (normal + inverted; contrast / downscaled if no amount yet)
                                                        ├─ ReceiptParser: amount, payee, date/time, UPI ID, txn ID, bank
                                                        ├─ de-duplicate (txn ID, or amount + payee + time)
                                                        └─ TransactionStore (app-private JSON) + notification
JS: Transactions tab ◀── SpenddTransactions TurboModule (list / update / remove / clear / importScreenshot)
```

The parser is app-agnostic: it scores candidates by how payment screens are structured (the amount
is the most prominent figure or sits by an "Amount" label; the payee follows "to"/"Paid to"/"Payee"
or is the name nearest the amount; date and time share a line) rather than matching known layouts.
OCR has no "₹" glyph, so a low-confidence leading "7"/"2" is treated as a misread rupee sign.
If the amount still can't be read, the transaction is logged as **Needs review** and can be
completed from its details screen — no shared screenshot is dropped.

- Native code: [android/app/src/main/java/com/spendd/receipts/](android/app/src/main/java/com/spendd/receipts/)
- Parser tests (JVM, real OCR captures + synthetic layouts): `cd android && ./gradlew :app:testDebugUnitTest`
- On-device tests (real OCR on drawn receipts and on screenshots in `android/app/src/androidTest/assets/receipts/`,
  which is git-ignored because it holds personal data):
  ```sh
  cd android && ./gradlew installDebug installDebugAndroidTest
  adb shell am instrument -w com.spendd.test/androidx.test.runner.AndroidJUnitRunner
  ```
  (`connectedAndroidTest` works too but uninstalls the app afterwards, wiping its data.)
- Screenshots are deleted right after OCR; only the extracted fields (and OCR text) are kept.
- The Transactions tab also has **Add a screenshot** for images already in the gallery.

## Insights & Spendd AI (all on-device)

```
transactions + budget ─▶ insights/engine.ts ─▶ forecast + ~25 detectors (detectors.ts) ─▶ ranked facts
                                                                                   │
              optional: Spendd AI (Qwen2.5 0.5B via llama.rn) ◀── fact sheet ──────┘
                 └─ JSON-schema-constrained output ─▶ aiPrompt.ts drops any insight whose
                    numbers aren't in the facts ─▶ cached by facts hash ─▶ Home / Insights
```

- The engine does all the maths (pace, forecast, trends, outliers, repeats, payday, savings rate…);
  the model only rewrites and combines its facts. Without the model, the engine's insights show as-is.
- The model (491 MB GGUF) is **not** in the APK. Users download it from **Profile → Spendd AI**
  (Android DownloadManager, SHA-256 checked) into app storage; it's deleted on uninstall or reset.
- llama.rn adds ~30 MB of native code per APK: `app/build.gradle` drops its rarely-used CPU variants.
- **Windows:** llama.rn's postinstall extracts its native libs with `tar`, which fails under Git Bash.
  Run `npm install` from PowerShell or cmd (Windows' own `tar`), or afterwards run
  `node node_modules/llama.rn/install/download-native-artifacts.js` from PowerShell.

## Prerequisites

- Node ≥ 22.11
- JDK 17
- Android SDK (Android Studio) with `ANDROID_HOME` set and `platform-tools` on `PATH`

```sh
npm install   # on Windows, from PowerShell or cmd (see "Spendd AI" above)
```

## Run on your Android phone (no APK to copy around)

`npx react-native run-android` builds a debug app, installs it straight onto the connected phone over adb, and
starts the Metro dev server. The phone then loads JavaScript live from your Mac, so after the first install, code
changes appear instantly (Fast Refresh) without rebuilding.

### 1. Enable Developer options on the phone (one-time)

1. **Settings → About phone** → tap **Build number** 7 times.
2. **Settings → System → Developer options** → turn on **USB debugging**.
   (On Xiaomi/Redmi/POCO also enable **Install via USB** and **USB debugging (Security settings)**.)

### 2a. Connect with a USB cable

```sh
adb devices          # accept the "Allow USB debugging?" prompt on the phone; device should show as "device"
npm start            # terminal 1 – Metro bundler
npm run android      # terminal 2 – builds, installs and launches Spendd on the phone
```

### 2b. Or connect over Wi‑Fi (Android 11+, phone and Mac on the same network)

1. **Developer options → Wireless debugging** → turn on → **Pair device with pairing code**.
2. On the Mac:
   ```sh
   adb pair <ip>:<pairing-port>        # enter the 6-digit code shown on the phone
   adb connect <ip>:<port>             # ip:port shown on the Wireless debugging screen (not the pairing port)
   adb devices
   npm start
   npm run android
   ```

### Day-to-day

- Edit code → the phone reloads automatically.
- Shake the phone (or `adb shell input keyevent 82`) for the dev menu → **Reload**.
- If the app shows "Unable to load script", run `adb reverse tcp:8081 tcp:8081` and reload.
- Only rebuild (`npm run android`) after adding a native dependency or changing files under `android/`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Metro dev server |
| `npm run android` | Build + install debug app on device/emulator |
| `npm test` | Jest unit tests |
| `npm run lint` | ESLint |
| `cd android && ./gradlew :app:testDebugUnitTest` | Kotlin unit tests (parser, store, categories) |

## Release builds

Release APKs are never signed with the debug key. Create your own key once and **back it up** — without it you can't publish updates:

```sh
keytool -genkeypair -v -keystore spendd-release.jks -alias spendd -keyalg RSA -keysize 2048 -validity 10000
```

Then either create `android/keystore.properties` (git-ignored; `storeFile` is relative to `android/`):

```properties
storeFile=../spendd-release.jks
storePassword=…
keyAlias=spendd
keyPassword=…
```

or set `SPENDD_KEYSTORE_FILE`, `SPENDD_KEYSTORE_PASSWORD`, `SPENDD_KEY_ALIAS` and `SPENDD_KEY_PASSWORD`. Build with `cd android && ./gradlew :app:assembleRelease`. R8 shrinking is opt-in until tested: add `-Pspendd.enableR8=true`.

CI (**Actions → Build Android APK**) runs the JS and Kotlin tests and uploads the APK as the `spendd-apk` artifact. For a signed release APK add the repository secrets `SPENDD_KEYSTORE_BASE64` (`base64 -i spendd-release.jks`), `SPENDD_KEYSTORE_PASSWORD`, `SPENDD_KEY_ALIAS` and `SPENDD_KEY_PASSWORD`; without them it builds a debug APK.

The transaction log is encrypted with a Keystore key from this version on. Don't install an older build over it: older versions can't read the encrypted log.
