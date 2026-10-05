# Spendd insights server

Turns the phone's computed spending facts into structured insights and money stories with
**Gemini 3.5 Flash-Lite** (set `GEMINI_MODEL` to change it; 2.5 Flash-Lite is no longer offered to new API keys). The app never sends screenshots, raw transactions, UPI IDs or the names of
people paid, only the eight fixed parameters it computes (see `src/contract.ts`):

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

Optional: set `SPENDD_APP_TOKEN` here and the same value as `INSIGHTS_API_TOKEN` in `src/config.ts`.

## API

`POST /v1/insights`

```json
{
  "month": "October 2026",
  "facts": [{ "parameter": "top_category", "summary": "Food is your biggest category in October: ₹9,480, 27% of your spending.", "values": { "category": "Food", "amount": 9480, "sharePct": 27 } }],
  "avoid": ["Titles shown last time"]
}
```

→ `{ "insights": [{ "parameter", "title", "detail", "action", "tone" }], "stories": [{ "parameter", "text" }], "model" }`

Errors: `400` bad request, `401` wrong token, `429` rate limited (30 requests / 10 min per address),
`502`/`503` model unavailable. `GET /health` for monitoring.

### `POST /v1/categorize`

Categorises merchants the app hasn't seen before (people are filtered out on the phone and never sent).

```json
{ "merchants": [{ "key": "debit:upi:blinkit@hdfcbank", "name": "Blinkit", "handle": "blinkit@hdfcbank", "amount": 432, "hour": 21 }] }
```

→ `{ "results": [{ "key", "category", "confidence": "high|medium|low", "isPerson", "cached" }], "model" }`

Confident answers about businesses are kept in `data/merchants.json` (git-ignored) and shared by every
user, so each merchant costs one Gemini call in total. Up to 20 merchants per request.

## Test

```sh
npm test         # contract, number guard and HTTP layer, with a fake model (no key needed)
npm run typecheck
```

## Before production

- Host it behind HTTPS and put that URL in `INSIGHTS_API_URL` (release builds block plain HTTP).
- Replace the shared app token with real per-user auth; the in-memory rate limit is per process.
- Disclose cloud processing in the privacy policy and Play Data safety form.
