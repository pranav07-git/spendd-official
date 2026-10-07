# Spendd server

Email + password accounts (JWT sessions), plus insights and categories from Gemini.


Turns the phone's computed spending facts into structured insights and money stories with
**Gemini 3.5 Flash-Lite** (set `GEMINI_MODEL` to change it; 2.5 Flash-Lite is no longer offered to new API keys). The app never sends screenshots, raw transactions, or the names or UPI IDs of
people paid. Insights get only the eight fixed parameters it computes (see `src/contract.ts`), which
can name businesses (e.g. the biggest payment's merchant):

| Parameter | Fact |
| --- | --- |
| `spending_trend` | This month vs the same days last month |
| `top_category` | Biggest category and its share |
| `fastest_growing` | Category rising most vs last month |
| `savings_rate` | Income vs spending |
| `recurring` | Payments that repeat monthly |
| `small_spends` | Payments under ₹200 |
| `biggest_payment` | Largest single payment this month |
| `budget_pace` | Projected month-end vs budget |

The model answers in a strict JSON schema (one insight per parameter sent, plus two stories), and
the server drops anything that is about a parameter that wasn't sent, too long, or contains a number
that isn't in the facts. If too little survives, the app shows its built-in engine instead.

## Run

Requires Node 23.6+ (TypeScript runs directly, no build step).

```sh
cd server
npm install
cp .env.example .env            # then put your key in .env (get one at https://aistudio.google.com/apikey)
npm start                        # http://localhost:8787
```

From the phone (debug build), forward the port so the app's `http://localhost:8787` reaches the Mac:

```sh
adb reverse tcp:8787 tcp:8787
```

`JWT_SECRET` is required (at least 32 random characters: `openssl rand -hex 32`). The server listens on `127.0.0.1` only; set `HOST=0.0.0.0` when deploying it behind HTTPS. To deploy it on Render or Google Cloud, see [DEPLOY.md](DEPLOY.md).

## API

### Accounts

`POST /v1/auth/signup` and `POST /v1/auth/login`, both with `{ "email": "...", "password": "..." }`
(email is case-insensitive; password 8–128 characters)

→ `{ "token", "expiresAt", "user": { "id", "email" } }` (`201` on sign-up)

Errors: `400` bad email or password, `401` `invalid_credentials`, `409` `email_taken`, `429` more than 10
attempts / 10 min per address.

`POST /v1/auth/refresh` with a valid token → a fresh one (same shape). Tokens are HS256 JWTs that last 30
days. Every other `/v1` call needs `Authorization: Bearer <token>`, and answers `401` without a valid one.

Passwords are hashed with scrypt. Accounts are kept in `data/users.json` (git-ignored; back it up).
There is no password reset yet: it needs an email provider to send reset links.

### `POST /v1/insights`

`POST /v1/insights`

```json
{
  "month": "October 2026",
  "facts": [{ "parameter": "top_category", "summary": "Food is your biggest category in October: ₹9,480, 27% of your spending.", "values": { "category": "Food", "amount": 9480, "sharePct": 27 } }],
  "avoid": ["Titles shown last time"]
}
```

→ `{ "insights": [{ "parameter", "title", "detail", "action", "tone" }], "stories": [{ "parameter", "text" }], "model" }`

Errors: `400` bad request, `401` missing or invalid token, `429` rate limited (30 requests / 10 min per account),
`502`/`503` model unavailable. `GET /health` for monitoring.

### `POST /v1/categorize`

Categorises merchants the app hasn't seen before. For each, the app sends the business's name, its UPI ID, the amount rounded to the rupee and the hour of the payment. People are filtered out on the phone and never sent.

```json
{ "merchants": [{ "key": "debit:upi:blinkit@hdfcbank", "name": "Blinkit", "handle": "blinkit@hdfcbank", "amount": 432, "hour": 21 }] }
```

→ `{ "results": [{ "key", "category", "confidence": "high|medium|low", "isPerson", "cached" }], "model" }`

Confident answers about businesses are kept in `data/merchants.json` (git-ignored) and shared by every
user, so each merchant costs one Gemini call in total. Up to 20 merchants per request. Answers are
filed under the exact UPI ID and name the model saw (worked out on the server, never from the client's
`key`), so one request can't change another merchant's category. They expire after 90 days, and the
cache keeps at most 50,000.

## Test

```sh
npm test         # contract, number guard and HTTP layer, with a fake model (no key needed)
npm run typecheck
```

## Before production

- Host it behind HTTPS and put that URL in `PRODUCTION_API_URL` in the app's `src/config.ts` (release builds block plain HTTP).
- Run one instance: accounts and the merchant cache are files, and the rate limit is in memory.
- Disclose cloud processing in the privacy policy and Play Data safety form.
