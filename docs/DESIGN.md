# Spendd — DESIGN.md

The single source of truth for how Spendd looks, feels, sounds and behaves.
Use this file as context for designers, engineers and AI coding/design tools.

Version 1.0 · Mobile-first (iOS + Android) · Light-first with full dark mode

> Implementation status: the app currently applies this design system (tokens, type, voice, components)
> to its existing screens and features ("re-skin"). Jars, Pledges, Worth it / Regret, Monthly Close,
> Money Back, Hidden costs, Upcoming, voice capture and the new navigation are not built yet.
> Tokens live in `src/theme/`.

---

## 0. Master Prompt

```
You are building UI for Spendd, a mobile money app for Indian young adults (18–26)
who live away from home, pay mostly with UPI, and share expenses with friends.

Spendd's personality: a smart friend who's good with money. Warm, honest, playful,
never preachy. It is NOT a premium/exclusive club app (not CRED), NOT a spreadsheet
dashboard, and NOT a bank.

Follow DESIGN.md strictly:
- Use only the tokens in Section 3 (colours, type, spacing, radius, elevation, motion).
- Story first: every screen opens with one plain-language sentence, details below.
- Jars are the hero visual: gullak-shaped, physically filling and draining.
- Every primary action completes in under 3 seconds and one thumb.
- Never use red for shame, never use guilt copy, never call family transfers a "leak".
- Amounts use Indian grouping (₹1,23,456), tabular figures, ₹ symbol, no decimals
  unless the amount is under ₹100 and has paise.
- Sentence case everywhere. No ALL CAPS labels. No arrows appended to button text.
- Respect reduced motion, dynamic type, 44pt minimum touch targets, WCAG AA contrast.
- Light mode first; every component must also work in dark mode.
```

## 1. Product context

**Who:** 18–26-year-olds in metro and tier-1 Indian cities — hostel students, PG residents, first-jobbers
with flatmates. UPI-heavy, spending spread across GPay, PhonePe and Paytm, lots of small payments, frequent
shared expenses, and a month-end crunch.

## 2. Design principles

1. **Story first, numbers second.** Every screen opens with one sentence that answers "how am I doing?" in
   plain language. Charts and lists sit one tap or one scroll below. Good: "₹4,200 left for 9 days. You're on
   track." Bad: a balance card, a donut chart and six category tiles above the fold.
2. **Money you can touch.** Money is shown as objects, not tables.
3. **Swipe, don't type.** Forms are a last resort.
4. **Kind, never preachy.** Low money is a heads-up, not an alarm. Family money is respected.
5. **Celebrate wins loudly, keep warnings quiet.** Warnings are small, calm and come with a next step.
6. **Privacy you can see.** Show what Spendd can see, where processing happens, and how to delete — on the
   screen, not buried in settings.
7. **Spend boldness in one place.** Everything else stays quiet: plain surfaces, restrained colour, clear
   type. Don't decorate.

## 3. Design system

### 3.1 Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F3F4F8` | `#13112B` | App background |
| `surface` | `#FFFFFF` | `#1D1A3D` | Cards, sheets |
| `surfaceSunken` | `#E8EAF2` | `#0E0C22` | Inputs, tracks |
| `ink` | `#1B1847` | `#F1F0FA` | Primary text, icons |
| `inkMuted` | `#5B5878` | `#A9A6C6` | Secondary text |
| `inkSubtle` | `#8D8AA6` | `#76739A` | Captions, placeholders (never body text) |
| `line` | `#DCDEE9` | `#2C2852` | Dividers, outlines |
| `marigold` | `#FFB000` | `#FFB81F` | Primary buttons, active states. Always `ink` text on top. |
| `marigoldSoft` | `#FFF1CC` | `#3A2F12` | Selected chips, highlights |
| `rani` | `#E5007D` | `#FF3D9E` | Wins only |
| `raniSoft` | `#FFE0F0` | `#3D1230` | Win card backgrounds |
| `peacock` | `#0B7F82` | `#3CC4C6` | On track, positive, income |
| `peacockSoft` | `#D4F1F1` | `#123738` | On-track backgrounds |
| `headsup` | `#C27400` | `#FFC24D` | Heads-up |
| `low` | `#B8441C` | `#FF8A5C` | Empty / overdue. Never a large fill. |
| `info` | `#4B47C4` | `#9C99FF` | Neutral system info |

Jar fills: mint `#BDEBD3`/`#2E6B52`, sky `#C3DBFF`/`#2D4D85`, peach `#FFD3BD`/`#7A4630`,
lilac `#DCCFFF`/`#4E3F8A`, haldi `#FFE79A`/`#77621E`, rose `#FFCCDA`/`#7A3248`.

Rules: marigold is the only colour for primary actions, one marigold button per screen. Rani only for wins.
Never use `low` as a large fill or for a category. Text on marigold, jar fills and soft backgrounds is always
`ink`. All text meets WCAG AA.

### 3.2 Typography

| Token | Font | Size (line) | Weight | Use |
|---|---|---|---|---|
| `amountHero` | Bricolage Grotesque | 48 (52) | 700 | Single big number |
| `story` | Bricolage | 28 (34) | 600 | Opening story sentence |
| `title` | Bricolage | 22 (28) | 600 | Screen and sheet titles |
| `heading` | Atkinson Hyperlegible Next | 18 (24) | 700 | Section headings, card titles |
| `body` | Atkinson | 16 (24) | 400 | Default text |
| `bodyStrong` | Atkinson | 16 (24) | 700 | Emphasis, list amounts |
| `label` | Atkinson | 14 (20) | 700 | Buttons, chips, tabs |
| `caption` | Atkinson | 13 (18) | 400 | Timestamps, helper text |

Tabular figures for amounts. Sentence case everywhere — no ALL CAPS, no tracked-out labels. No single-word
emphasis with colour or italic. Story sentences ≤ ~40 characters per line, body ≤ ~70.

### 3.3 Spacing · 3.4 Radius · 3.5 Elevation

Spacing (4-pt): 4, 8, 12, 16, 20, 24, 32, 40, 48. Screen side padding 20; gap between sections 32; inside
cards 16. Left-aligned; centre only for full-screen moments and empty states.

Radius: s 8 (chips, inputs), m 14 (buttons, grouped rows), l 24 (cards, sheets), xl 32 (full-screen story
cards), pill 999. Bigger objects get softer corners.

Elevation: flat by default. Level 1 for cards on bg, 2 for swipe cards, 3 for sheets/capture button. In dark
mode use 1 px outlines instead of shadows.

### 3.6 Motion

tap 120 ms scale 0.97 · sheet spring · page 240 ms. Motion responds to the user; nothing animates that nobody
touched. One orchestrated moment per screen at most. Reduced motion: 150 ms cross-fades only.

### 3.8 Icons

Rounded 2 px stroke line icons on a 24 grid. Merchant avatar: circle with first letter on a jar colour.

## 4. Voice & tone

Like a friend texting, not a bank writing. Short sentences, plain verbs, specific numbers. At most one emoji,
at the end of a sentence, only in nudges and wins — never in errors or privacy copy.

| Situation | Do | Don't |
|---|---|---|
| Overspending | "Food's over with 6 days to go. Want to slow down a bit?" | "You overspent on food! ⚠️" |
| Win | "₹1,240 back in your account. Nice." | "Refund processed successfully." |
| Error | "Couldn't read this screenshot. Try one with the amount visible." | "Oops! Something went wrong 😢" |
| Empty | "No spends yet. Share your next UPI screenshot to start." | "Nothing to see here!" |

Words: Spend (not expense/debit/outflow), Heads-up (not warning/alert), Money back (not reversal).

Money: Indian grouping ₹1,23,456. No decimals above ₹100; under ₹100 show paise only if non-zero (₹42.50).
Short form ₹1.2K, ₹3.4L. Dates "12 Oct", "Today", "Yesterday"; times "11:42 pm".

## 5. Components

- **Primary button:** marigold fill, ink text, radius m, height 52. One per screen. Labels say exactly what
  happens; no "Submit", no arrows.
- **Secondary:** surface fill, 1.5 px ink outline. **Quiet:** text only, ink.
- **Story header:** `story` type, ink, left-aligned, max 3 lines; optional caption below in `caption`
  inkMuted. Falls back to a neutral sentence when data is thin.
- **Transaction row:** height 64; avatar 40, merchant `bodyStrong`, meta `caption`, amount `bodyStrong`
  tabular. Income in peacock with "+". Spends in ink — never red.
- **Chips:** height 36, radius s, `label`. Unselected surface + line outline; selected marigoldSoft + ink outline.
- **Nudge card:** surface, left 4 px bar in the status colour, one sentence + one action.
- **Win card:** raniSoft background, amount in rani.
- **Privacy badge:** lock icon + short line, e.g. "Read on your phone. Not stored."

## 8. Global states

Loading: skeletons, not full-screen spinners. Empty: one sentence + one action. Error: say what happened and
how to fix it; no apology. Partial data: "Based on 12 spends so far."

## 10. Accessibility

WCAG AA in both modes; 44 × 44 touch targets; dynamic type; full-sentence labels for charts and trackers;
colour never the only signal.

## 11. Review checklist

- One plain story sentence at the top?
- Exactly one marigold primary button?
- Rani only for wins?
- Indian grouping, tabular figures?
- Anything red, shaming or preachy? Remove it.
- Works in dark mode and with large text?
- Sentence case, no ALL CAPS?
- Privacy visible where screenshots or statements are involved?
