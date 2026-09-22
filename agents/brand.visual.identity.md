# Sanad — Design Guide

> سند means "support" — something that carries weight so someone else doesn't have to. This file governs how that promise looks: color, type, shape, motion, and the accessibility rules underneath all four. It does not describe features, screens, or copy.

---

## Logo

The lockup is two parts with two different rules: the wordmark (سند) is monochrome — Paper-fill with Ink outline, or the reverse on dark surfaces. The wing to its right is the only part of the identity that ever carries the gradient. Never swap that split.

- **Never re-gradient the wordmark.** It stays one color, always. The gradient lives in the wing only.
- **Never flatten the wing to a mid-tone blue as a "simplified" version.** In single-color contexts (favicon, print, watermark-free stamps) use the wing in flat Ink or flat Paper — not a solid blue substitute.
- **Never use the mark as a repeating pattern, watermark, or background texture.** One instance per screen, always at the top of the shell nav or on auth/splash.
- **The wing doesn't mirror in RTL.** It's a fixed brand asset, not a layout element — it stays on the right whether the interface is reading right-to-left or left-to-right.
- **Background rule:** place the lockup only on Daylight, Cloud, or solid Ink. Never on a mid-tone photo or busy background — the gradient's darkest stop needs a background it can actually separate from.
- **Clear space:** at least half the wing's height on every side. **Minimum size:** don't run the full lockup below ~120px wide; below that, drop the wordmark and use the wing alone as the app icon / favicon.

---

## Color

The two blues are pulled directly from the uploaded mark, not invented. The primary blue is deepened a few percent from the mark's purest gradient stop — invisible next to the logo, but the difference between failing and clearing AA at 16px text. Contrast ratios below are computed (WCAG relative luminance), not estimated.

| Token | Hex | Role | Contrast on Daylight / Cloud |
|---|---|---|---|
| **Horizon Blue** | `#1D3FE0` | Primary. Actions, links, active states, icons, focus ring. Text-safe. | 7.40 : 1 / 6.89 : 1 |
| **Lift Cyan** | `#00E0FF` | Secondary accent. **Fill-only** — badges, progress fills, the gradient's bright stop. Never text, never the sole carrier of meaning. | 1.60 : 1 |
| **Sanad Lift** (gradient) | `#1D3FE0 → #00E0FF`, 45° | Reserved for the logo, splash screen, and one onboarding hero moment. Never behind text, never a button fill. | — |
| **Daylight** | `#FFFFFF` | Base app background. | — |
| **Cloud** | `#F5F7FA` | Card / panel / sheet surface. | — |
| **Mist** | `#E4E9F0` | Borders, dividers, disabled fills. | — |
| **Ink** | `#0B1524` | Primary text. | 18.31 : 1 |
| **Ink Soft** | `#46536B` | Secondary / meta text (timestamps, helper text). Deliberately still AAA — nothing in this product is "low-priority reading." | 7.75 : 1 / 7.22 : 1 |
| **Meadow** | `#2E7D4F` | Confirmed, completed, positive states. Text-safe. | 5.05 : 1 / 4.70 : 1 |
| **Amber** | `#B8720E` | Pending / needs attention. **Fill + icon + label only** — under 4.5:1, never used as text alone. | 3.85 : 1 / 3.59 : 1 |
| **Signal** | `#B23A2A` | Errors, destructive actions, SOS / emergency. Chosen to also clear text contrast, deliberately — the most safety-critical color in the system shouldn't be reduced to "just a chip color." | 5.95 : 1 / 5.54 : 1 |

**Rules:**
- Every color resolves through a token. No raw hex typed into a component — if the palette shifts, tokens update for free, hardcoded values silently drift.
- Amber and Signal are alarms, not accents. Every use has to be earned by an actual pending or destructive/emergency meaning.
- A one-off color is allowed only where nothing in this table fits and it appears exactly once, documented inline as to why. If it's ever reused, it becomes a token immediately.

---

## Typography

One family carries Latin UI end-to-end: **Atkinson Hyperlegible** — designed by the Braille Institute specifically to stay legible for low-vision readers. That's not a stylistic pick, it's the actual audience. Weight and size do the hierarchy work instead of switching typefaces, which keeps the system to one voice.

- **Arabic UI:** IBM Plex Sans Arabic — closest available match to Atkinson's open apertures and even x-height, without tipping into a calligraphic/formal register that hurts small-size legibility.
- **Numerals & codes:** IBM Plex Mono — for anything a misread digit could turn into a real mistake: OTP codes, phone numbers, ride/request codes, timestamps, prices, distances. Shares the Plex family with the Arabic face, so numbers sitting inside Arabic text read as one system, not two glued together.

```
REQ-4821 · 09:42 · 2.4 KM
```

| Style | Size / Line-height | Weight | Use |
|---|---|---|---|
| Display | 30 / 38 | 800 | Once per screen, max — a hero number or screen title |
| Title | 22 / 28 | 700 | Section / page headers |
| Subtitle | 18 / 24 | 600 | Card headers, list section labels |
| Body | 17 / 26 | 500 | Default reading size |
| Label | 15 / 20 | 600 | Buttons, tabs, nav, form labels |
| Caption | 13 / 18 | 500 | Timestamps, meta — the floor, never smaller |
| Numeric (Mono) | 16 / 24 | 500, tabular figures | Codes, OTP, phone, price |

**Never** below 13px anywhere. Every size scales with the OS text-size setting up to 200% — relative units only, no text baked into images.

---

## Iconography

- Rounded joins and caps, one 2px stroke weight throughout, 24px grid. A filled variant exists only for the active/selected state.
- Visual icon can be 20–24px, but the tappable area around it is never smaller than 48px.
- Icons never carry meaning alone. Anything that isn't universally standardized (SOS, call, delete, confirm) ships with a visible text label next to it — not a tooltip, not a long-press reveal.
- Icon color inherits the semantic table above only: Ink for structural/nav icons, Meadow / Amber / Signal only where they carry that literal state.

---

## Shape & Radius

| Token | Value | Use |
|---|---|---|
| `radius-xs` | 8px | Chips, tags, checkboxes |
| `radius-sm` | 12px | Text inputs, list rows, small buttons |
| `radius-md` | 16px | Cards, standard buttons |
| `radius-lg` | 24px | Sheets, modals, large feature cards |
| `radius-xl` | 32px | Full-screen panels, onboarding |
| `radius-full` | 999px | Pills — **reserved for single-action controls only**: buttons, filter chips, badges, search field |

**Rules:**
- Radius scales with size. One flat radius on every element regardless of hierarchy is the generic default this guide explicitly avoids — bigger container, bigger radius, never the reverse.
- Same radius = same kind of container. Don't apply pill radius to a card just because "rounder feels friendlier" — that's decoration, not structure.
- 0 radius is reserved for exactly one case: full-bleed media that touches the screen edge (a map, a camera view). Nothing else in the product renders square.

---

## Spacing & Touch Targets

Base unit: 4px.

| Token | Value |
|---|---|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-12` | 48px |
| `space-16` | 64px |

- **Minimum touch target: 48×48px.** Any primary or frequent action (send, confirm, call, SOS) steps up to **56×56px** — assume reduced grip precision, an armrest-mounted phone, or gloved hands.
- **Minimum 8px between any two adjacent tappable targets**, 12px preferred.
- **Primary actions live in the bottom half of the screen** — the reachable thumb zone. The top of the screen is for status and title only, never for anything done more than once a session.
- No control ever requires two hands, a multi-finger gesture, or sustained pressure as its *only* path. Any swipe/gesture shortcut has a visible button doing the same thing.
- Ambiguous → go up a spacing step, never down.

---

## Elevation

Only two non-zero levels, both reserved for something *currently floating above the base layer* — never for a static, resting card.

- `elevation-0` — flat. Default. Surface-color contrast alone signals grouping.
- `elevation-1` — `0 2px 8px rgba(11,21,36,0.08)` — open bottom sheets, floating action button, a dragged row.
- `elevation-2` — `0 8px 24px rgba(11,21,36,0.14)` — modal / full-screen sheet backdrop separation only.

A resting screen with no shadows anywhere is correct, not unfinished.

---

## Platform Defaults

Nothing ships looking like the OS's idea of a button.

**Must resolve to tokens:** buttons, text inputs, checkboxes/radios (repaint only — see exception), tabs/segmented controls, in-app toasts and dialogs, list dividers, text-selection highlight, scrollbar/overscroll glow, status bar style, splash screen, font fallback stack.

**Earned exceptions — kept native, documented here, not restyled:**
- OS permission prompts, share sheets, system alerts — owned by the OS; assistive tech already understands them.
- Native date/time pickers on touch devices.
- Native `Switch` component's interaction and haptic behavior — colors are repainted to tokens, but function and semantics stay system-owned so screen readers and switch-access hardware keep working.
- Keyboard/IME switching (Arabic ↔ English) — entirely OS-owned.
- Respect OS safe areas. Nothing primary sits inside the notch or home-indicator exclusion zone.

---

## Direction (RTL / LTR)

- The interface mirrors fully in Arabic: navigation order, directional icons (back chevrons, progress, swipe affordances) all flip.
- Numerals, phone numbers, codes/OTP, prices, and anything in Mono **never mirror** — always left-to-right, left-aligned, regardless of interface direction.
- The logo does not mirror (see Logo).

---

## Motion & Haptics

`200–280ms`, `ease-in-out`. Nothing overshoots. Motion should feel like something settling, not something releasing.

- Every state change fires on **three channels at once**: a visual change, a haptic pulse, and a text/icon update. No single sense carries the whole meaning.
- Reduced-motion setting: cross-fade instead of slide/scale — the state change itself is never skipped, only its animation.
- Status changes (requested → confirmed) cross-fade in place; the element never changes position when its state changes.
- **Nothing disappears on a timer.** No auto-advancing carousels, no toasts that vanish before they can be read twice. Dismissal is always an explicit action.
- Visible focus indicator: 2px Horizon Blue ring, 2px offset — identical for touch, switch-access, and voice-control scanning.

---

## Accessibility

This isn't a section that adds rules on top of the system above — it's the reason the system above looks the way it does.

- **Contrast:** 4.5:1 minimum, targeting 7:1 (AAA) wherever the token table allows — see Color.
- **Text scaling:** supports OS dynamic type up to 200%. Layouts reflow, never truncate or clip. No fixed-height text containers.
- **Color independence:** status, errors, required fields — never color alone. Always icon + label, and for critical states, haptic too.
- **Motor:** see Spacing & Touch Targets. No control depends on precise timing, multi-finger input, or sustained pressure as its only path.
- **Screen readers:** every interactive element gets a real accessible label, not "button" or a raw icon name. Focus order follows logical reading order. Status changes are announced, not just animated.
- **Assistive input:** the focus ring in Motion works identically for touch, switch-access, and voice targeting. Nothing is reachable only by gesture.

---

## Design Principles

1. **One primary action per screen.** Two filled buttons means one of them is wrong.
2. **Every radius answers "what kind of container is this."** No decorative roundness.
3. **Color spends before it borrows.** Horizon Blue does the structural work; Lift Cyan and the gradient are rationed to real brand moments; Amber and Signal stay alarms.
4. **Nothing communicates on one channel alone.** Color pairs with a label, motion pairs with a haptic and a text update.
5. **The reachable zone is the layout**, not a balanced-looking grid. Primary actions live where a thumb already is.
6. **Quiet is the resting state.** A calm, mostly Ink-on-Daylight screen means nothing needs attention — that's success, not something to decorate.

---

## What This Guide Is Not

- Not a content or voice/tone guide — wording and terminology live elsewhere.
- Not a component spec or flow map — this governs surface, not screens or product scope.
- Not a place for a one-off hex value or a borrowed OS default left unstyled and undocumented.
- Not decorative for its own sake — restraint and roundness exist to lower effort for someone who already has enough to manage.

---

_Last updated: 2026. Governs surface only._