# Spendd — DESIGN.md

How Spendd looks and behaves. The visual system follows the dark "artboard" design language the team
chose in October 2026 (Framer-style): a near-black canvas, white display type pulled tight, white pill
buttons, charcoal cards, one blue for links and selection, and vivid gradient spotlight cards.
Product context, voice and accessibility rules are unchanged from v1 and kept below.

Tokens: `src/theme/tokens.ts`. Shared components: `src/components/` (Spotlight, Buttons, Layout…).

---

## Visual system

### Rules
- **Dark only.** There is no light mode or theme picker.
- **Hierarchy by surface lift**, not borders or colour: canvas → surface-1 (cards) → surface-2 (inputs,
  tiles, the floating tab bar, selected states). Text is either `ink` (white) or `ink-muted` (#999).
- **One accent:** blue #0099FF, only for links, focus and selection (switches, ticked checkbox). Never a
  button or section fill.
- **Gradient spotlight cards** (`<Spotlight tone>`: violet, magenta, orange, coral) are the only colour
  fills. One per screen, two at most. Text on them is white. In use: Home daily status (violet),
  My Money monthly summary (magenta), Intro's first insight (violet).
- **Green #22C55E** only for check glyphs (e.g. the consent "what Spendd uses" list).
- **Primary action = white pill, black label.** Secondary = charcoal pill. No bordered/ghost buttons.
- **Sentence case** everywhere. Display type has tight negative tracking.
- Amounts: Indian grouping (₹1,23,456), ₹ symbol, tabular figures, no paise from ₹100 up. Spends are never red.

### Colour

| Token | Value | Use |
|---|---|---|
| `bg` | #090909 | Canvas |
| `surface` | #141414 | Cards, secondary pills, PIN keys |
| `surfaceSunken` | #1C1C1C | Surface-2: inputs, icon tiles, avatars, tab bar, selected states |
| `ink` / `inkMuted` / `inkSubtle` | #FFFFFF / #999999 / #666666 | Text |
| `line` | #262626 | Dividers and input-group borders |
| `info` | #0099FF | Links, focus, selection |
| `success` | #22C55E | Check glyphs only |
| `spotlight.*` | violet #6A4CF5→#3A1F9E, magenta #D44DF0→#6A4CF5, orange #FF7A3D→#FF5577, coral #FF5577→#D44DF0 | Spotlight cards |

Older accent tokens (`marigold`, `peacock`, `rani`, `jar.*`…) remain so screens compile; they map to
white or surface-2. `marigold` is the white primary pill fill.

### Typography — Inter (SIL OFL), standing in for GT Walsheim

| Token | Font · size / line | Tracking | Use |
|---|---|---|---|
| `amountHero` | Inter SemiBold 52/54 | −2.4 | Hero amounts |
| `story` | SemiBold 30/33 | −1.1 | Screen headline (Intro: 46/46, −2.2) |
| `title` | SemiBold 22/26 | −0.8 | Names, tab titles |
| `heading` | SemiBold 18/22 | −0.5 | Section and header titles |
| `subhead` | Regular 19/25 | −0.2 | Lead text, spotlight copy |
| `body` / `bodyStrong` | Regular / Medium 15/21 | −0.15 | Body |
| `label` | Medium 14/20 | −0.14 | Row titles, chips |
| `caption` / `eyebrow` | Medium 13 | −0.13 | Meta, small labels |
| `button` | Medium 15/18 | −0.15 | Pill labels |

### Shape, space, depth
- Radius: 6 tags · 10 inputs and list items · 20 cards · 30 spotlight cards · pill for buttons and chips.
- Spacing: screen padding 20, section gap 40.
- Level 1 = charcoal surface, no border or shadow. Level 2 (floating: tab bar) = faint white top edge +
  soft drop shadow.

### Components
- **PrimaryButton:** white pill, black label, min height 52, presses by shrinking slightly.
- **OutlineButton (secondary):** charcoal pill. **TextButton:** plain label.
- **Card:** surface-1, radius 20, padding 20. **Spotlight:** gradient card, radius 30.
- **Chips:** charcoal pill, muted label; selected = white pill, black label.
- **Tab bar:** floating surface-2 pill; active = white icon and label, others muted. No highlight fill.
- **PIN keypad:** 76 px charcoal circles; dots fill white, turn blue on error.
- **Links:** blue, no underline. **Switch:** blue track when on.

### Review checklist
- Only canvas, charcoal surfaces, white/grey text — plus at most two spotlight cards and blue for links/selection?
- One white primary pill per screen? No bordered buttons?
- Sentence case and tight display tracking?
- Indian grouping, ₹, no paise from ₹100 up?
- Privacy visible where screenshots are involved?

---

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

## 8. Global states

Loading: skeletons, not full-screen spinners. Empty: one sentence + one action. Error: say what happened and
how to fix it; no apology. Partial data: "Based on 12 spends so far."

## 10. Accessibility

WCAG AA in both modes; 44 × 44 touch targets; dynamic type; full-sentence labels for charts and trackers;
colour never the only signal.
