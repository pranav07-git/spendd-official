# Spendd — Features & Screens

What the app does today, feature by feature, and which screens make up each one.
Visual and copy rules for every screen live in [DESIGN.md](DESIGN.md).

Last updated: 6 Oct 2026

---

## App map

```
First launch                         Every launch after setup
────────────                         ────────────────────────
Intro ─▶ Consent                     Unlock (PIN / fingerprint)
            │                              │
            ▼                              ▼
        Add PIN ─▶ Retype PIN ─▶ Fingerprint unlock ─▶ Home (5 tabs)

Home (5 tabs, floating rounded tab bar; the active tab is shown by a bolder icon and label)
├─ Accounts      budget and where the money went
├─ Transactions  every payment, search, filters, add
├─ Home          today's status, the month's story, insights
├─ My Money      monthly summary and analysis
└─ Profile       you, Spendd AI, security, data

Full screens opened from the tabs
Story · Transaction details · Add a payment · Set budget · Edit profile · Change PIN

Outside the app
Android share sheet ─▶ "Spendd" ─▶ logged in the background, with a notification
```

---

## 1. Onboarding

First-run flow, from opening the app to the Home screen.

| Screen | Purpose |
|---|---|
| **Intro** | Shows what Spendd does with three example insight cards. |
| **Consent** | What Spendd uses and never uses, how Spendd AI works, and the agreement checkbox, whose Privacy Policy and Terms of Use links open in-app pages. "Allow and continue" is the only way forward. |

Code: `src/screens/IntroScreen.tsx`, `ConsentScreen.tsx`

## 2. Security: PIN and fingerprint

| Screen | Purpose |
|---|---|
| **Add PIN** | Create a 4-digit PIN; easy PINs (1111, 1234, 9876) are rejected. |
| **Retype PIN** | Confirm it; the PIN is stored in the Android Keystore. |
| **Fingerprint unlock** | Optional fingerprint or face unlock, via a Keystore key bound to biometrics. |
| **Unlock** | Every launch: PIN keypad, with the fingerprint prompt shown automatically. 5 wrong tries lock it for 30 s. "Forgot PIN?" resets the app after confirmation. |
| **Change PIN** | From Profile: current PIN, new PIN, retype. |

Also in Profile: biometric on/off, and "Lock app now".
Code: `src/components/PinEntry.tsx`, `src/screens/{CreatePin,ConfirmPin,Biometric,Unlock,ChangePin}Screen.tsx`, `src/storage/secure.ts`

## 3. Logging payments from screenshots

Share a "payment successful" screenshot from any UPI or bank app to Spendd. It's logged in the background, and the user stays in the app they shared from.

| Surface | Purpose |
|---|---|
| **Android share sheet → "Spendd"** | An invisible share target that queues the image and closes immediately. |
| **Notification** | Shows "Logging transaction…", then updates to "Transaction logged · ₹1,000 to Aditya Raj", "Already logged", or "Needs review". |
| **Transactions → "Add a screenshot"** | Picks an image from the gallery and sends it through the same pipeline. |

How it works:
1. **Reading:** on-device OCR (ML Kit) reads each screenshot four ways (original, greyscale, inverted, ink map) and combines the readings line by line.
2. **Parsing:** the amount, payee, date and time, UPI ID, transaction ID, bank, and money in or out are extracted. The parser works from how payment screens are structured; nothing is specific to one app.
3. **Not lost:** if the amount can't be read, the payment is still logged as **Needs review**.
4. **No doubles:** duplicates are caught by transaction ID, or by amount, payee and time.
5. **Privacy:** the screenshot is deleted after reading. The OCR text is kept and shown as **Scanned text** on the payment's details screen.

Code: `android/.../receipts/` (`ShareReceiverActivity`, `ReceiptWorker`, `ReceiptOcr`, `ReceiptParser`, `TransactionStore`)

## 4. Transactions

| Screen | Purpose |
|---|---|
| **Transactions tab** | Opens with a story sentence ("₹18,420 spent in October."). Search by payee, category, app or amount; filter by All, Spent or Received. Day groups with day totals, and pull to refresh. "Needs a look" rows show "Add amount". |
| **Transaction details** | Amount, payee, category, bank, date and time, UPI ID, transaction ID, the app it was paid with, and the scanned text with Share. **Edit** changes the amount, payee, spent or received, and category. **Delete** asks first. |
| **Add a payment** | Manual entry: spent or received, amount, category, payee, date (‹ Today ›), payment method and note. |

Code: `src/screens/home/TransactionsTab.tsx`, `TransactionDetailsScreen.tsx`, `AddTransactionScreen.tsx`

## 5. Categories

Each payment is placed in a category by, in order:
1. **Spendd's merchant list:** well-known names (Swiggy, Blinkit, Apollo, Uber, Amazon, Netflix, Airtel…) are placed on the phone as the payment is logged.
2. **Your memory:** a category you chose earlier for the same payee (by UPI ID or name). Every correction is learned, and this happens on the phone.
3. **Spendd AI:** any other business is filed as "Other" and sent (name and UPI ID only) to the server, where Gemini picks a category. The answer is cached for every user, so each merchant is asked about once. People are never sent.
4. **Asking you:** payments to people ("Personal"), or ones Gemini couldn't place, become "What was this payment for?" questions in the Story.

In a debug build the phone reaches the server through `adb reverse tcp:8787 tcp:8787`; `npm run android` (or `npm run reverse`) sets this up.

Spending categories: Food, Groceries, Medical, Travel, Shopping, Bills, Rent, Education, Entertainment, Personal, Other.
Income categories: Salary, Refund, Personal, Other.

Code: `src/transactions/{merchants,categorizePlan,autoCategorize}.ts`, `src/storage/categoryMemory.ts`, `server/src/categorize.ts`

## 6. Home

| Section | Purpose |
|---|---|
| **Greeting + story sentence** | "Hi {name}", then e.g. "₹4,200 left for 9 days. You're on track." |
| **Daily status** | How much is safe to spend today, and the change against your usual spending. |
| **This month's story** | Cards that open the Story (see 8). |
| **Insights** | The top 3 insights (Spendd AI's when available); "See all" opens My Money. |
| **Daily budget** | Today's limit and how much of it is used. With a budget: what's left of it ÷ days left. Without one: your average day of spending since you started logging (up to the last 30 days, not counting today). |
| **Spending habits** | Category share chips. |
| **Top bar** | Avatar (opens Profile) and notifications. |

Code: `src/screens/home/HomeScreen.tsx`, `HomeSections.tsx`, `src/insights/engine.ts`

## 7. My Money

Monthly analysis, with a ‹ month › selector for earlier months.

| Section | Purpose |
|---|---|
| **Story sentence** | e.g. "You've kept ₹11,100 this month.", with a comparison to the same days last month as the caption. |
| **Monthly summary** | Income, spent, and kept (or "over by"). |
| **Where your money went** | Top categories with % change from last month; View all. |
| **Money stories** | Two lines from Spendd AI, or from the built-in engine; opens the Story. |
| **Big moments** | The month's largest payments, marked early, mid or late in the month. |
| **Standpoint** | A 0–100 score: 60% savings rate and 40% share of spending on food, shopping and entertainment. |
| **Small spends** | The total of payments under ₹200. |
| **Opportunity** | What trimming the biggest of those three categories by a fifth would save each month. |
| **Monthly timeline** | Salary, rent, bills and big moments, in date order. |
| **A tip from Spendd** | The month's trend carried over a year. |
| **Search icon** | Opens Transactions. |

Code: `src/screens/home/MyMoneyTab.tsx`, `src/insights/myMoney.ts`

## 8. Story

A full-screen, Instagram-style story of the month, opened from Home or from Money stories.

| Slide | Purpose |
|---|---|
| **Category** (up to 3) | "This month, groceries, You've spent ₹332", with a fact card like "you ordered food 5 times this week" and the total. **Details** opens Transactions filtered to that category. |
| **Income** | "You earned ₹X" and the biggest source; **View details**. |
| **What was this payment for?** (up to 3) | For payments to people or "Other". Tap a category, or "It was personal"; the payment is re-filed and the answer remembered. |
| **Empty** | Shown when there's nothing yet; "Add a spend". |

Slides move on automatically; questions wait for an answer. Tap or swipe to move, hold to pause, swipe down to close.
Code: `src/screens/StoryScreen.tsx`, `src/transactions/stories.ts`

## 9. Budget (Accounts tab)

| Screen | Purpose |
|---|---|
| **Accounts tab** | Budget status (spent of budget, days left, a daily allowance or a calm over-budget heads-up) and **Where it went** by category, with each category's payments. |
| **Set budget** | Amount, and a period of Monthly, Weekly or Custom dates. Edit or remove it. |

Code: `src/screens/home/AccountsTab.tsx`, `CategoryBreakdown.tsx`, `SetBudgetScreen.tsx`, `src/transactions/budget.ts`

## 10. Spendd AI (insights)

The phone computes 8 fixed parameters: spending trend, top category, fastest-growing category, savings rate, recurring payments, small spends, biggest payment, and budget pace. The Spendd server asks **Gemini 3.5 Flash-Lite** to word them as structured insights plus two money stories. Any line with a number that isn't in the facts is rejected, and the built-in engine is the fallback. Requests are sent only when those numbers change, and the answers are cached.

| Where it shows | Purpose |
|---|---|
| Home → Insights | The top 3 Gemini-written insights. |
| My Money → Money stories | Two Gemini-written lines. |
| Profile → Spendd AI | "What's sent" and "Learning". Spendd AI is always on. |

Code: `src/insights/{parameters,cloud,useCloudInsights}.ts`, `server/` (see `server/README.md`)

## 11. Profile

| Section | Purpose |
|---|---|
| **You** | Avatar, name, tracking since; **Edit profile** (name and emoji avatar). |
| **Stats** | Spent this month, spent all time, payments logged, top category, days tracked, budget used. |
| **Budget** | The current budget; opens Set budget. |
| **Spendd AI** | What's sent and how learning works. |
| **Security** | Change PIN, biometric unlock, lock app now. |
| **Your data** | Export transactions (CSV via Share), clear all transactions, reset Spendd. |

Code: `src/screens/home/ProfileTab.tsx`, `EditProfileScreen.tsx`

---

## Under the hood

| Part | Where |
|---|---|
| Design system: dark artboard, Inter, white pills, gradient spotlights (docs/DESIGN.md) | `src/theme/`, `src/components/` |
| Transaction store (on the phone, private JSON) | `android/.../receipts/TransactionStore.kt`, `src/transactions/store.ts` |
| Built-in insights engine (~25 detectors) | `src/insights/engine.ts`, `detectors.ts` |
| Insights and categorization server (Node + Gemini) | `server/` |
| Tests | `__tests__/` (Jest), `android/app/src/test` (parser), `android/app/src/androidTest` (on-device OCR), `server/src/*.test.ts` |

## Not built yet

From DESIGN.md, planned but not implemented:
- **Navigation:** the new tabs (Home, Activity, +, Jars, You) and the floating capture button.
- **Jars and Pledges:** Money Jars and Spending Pledges.
- **Tagging:** Worth it / Regret.
- **Monthly Close:** the guided month-end flow (mystery resolver, Close & Plan).
- **Money Back, Hidden costs and Upcoming.**
- **Other capture and sign-in:** voice capture, the WhatsApp bot, OTP sign-in.
