# Phase 9 — Traditional Bracket Visual

**Date:** 2026-03-25
**Status:** Approved

---

## Goal

Replace the current horizontal card-list bracket display with a proper left-to-right tournament bracket tree across all three views: public spectator, projected display, and organizer score entry.

---

## Decisions Made

| Question | Decision |
| -------- | -------- |
| Which views get the new bracket? | All three: public, projected display, organizer |
| Scroll direction | Horizontal scroll (left → right), full screen width, no double scrollbars |
| Unplayable match slots (players TBD) | Blank rows — no label, no placeholder text |
| Rendering approach | Custom SVG — extends existing SVG code, no third-party library |
| Organizer score entry | Tap-to-open: tapping a match box in the bracket opens a ScorePanel drawer |

---

## Architecture

### New Components

**`src/components/BracketTree.tsx`**

The core SVG bracket tree. Shared across all three views.

Props:

- `matches: EliminationMatch[]` — all elimination matches
- `players: Record<string, Player>` — lookup by ID
- `totalRounds: number` — passed explicitly for round label calculation; the component derives this internally as a cross-check and throws a dev-mode warning if the passed value differs
- `large?: boolean` — increases box dimensions and font sizes for projected display
- `onMatchTap?: (matchId: string) => void` — if provided, match boxes with both players known are tappable; if absent, all matches are read-only

Renders a single SVG element inside a `width: 100%; overflow-x: auto; overflow-y: visible` container div. Note: if a parent element has `overflow: hidden` or `overflow: auto`, the browser will override `overflow-y: visible` — the component's parent must not clip it vertically. Uses existing `roundLabel(round, totalRounds)` from `src/lib/bracket.ts` for column headers.

---

**`src/components/ScorePanel.tsx`**

Modal score-entry drawer. Organizer view only.

Props:

- `match: EliminationMatch`
- `players: Record<string, Player>`
- `onClose: () => void`
- `onScore: (matchId: string, flagsP1: number, flagsP2: number) => void`

Renders as a bottom sheet with dark backdrop. Shows both player names and four score buttons: 3-0, 2-1, 1-2, 0-3. Tapping a score button is a **one-tap commit** — it immediately calls `onScore` and closes. No separate confirm step. If the match already has a score, the current result is highlighted; tapping a different button overwrites it immediately. Tapping the dark backdrop (outside the panel) dismisses the panel without scoring and calls `onClose`.

Overwriting a score on a match whose winner has already advanced is permitted — the existing API handles re-propagation server-side. `ScorePanel` does not need to block or warn about this.

API call: `PATCH /api/tournaments/[uuid]/elimination/[matchId]` with body `{ flagsP1: number, flagsP2: number }`. No new endpoints.

---

## SVG Layout Math

| Property | Value |
| -------- | ----- |
| Match box width | 180px |
| Match box height | 64px (two 28px name rows + 1px divider) |
| Round column width | 220px (180px box + 40px connector gap) |
| Round label row height | 32px |
| Vertical slot spacing (round 1) | 90px between match centers |
| Vertical spacing per round | Doubles each round (round 2 = 180px, round 3 = 360px) |
| Base font size — player names | 13px |
| Base font size — round labels | 12px |
| `large` prop multiplier | 1.4× on all dimensions and font sizes |

**Vertical positioning:** The first match center in round 1 is positioned at `slotSpacing / 2` (45px) below the top of the content area (below the 32px label row). This ensures the first match box is never clipped.

**Total SVG width** = `numberOfRounds × 220`

**Total SVG height** = `32 (label row) + firstRoundMatchCount × 90 + 45 (half slot spacing for bottom padding)`. Byes occupy a slot in round 1 and are counted in `firstRoundMatchCount` — the bracket always rounds up to the next power of two, so this count is always a power of two.

**`large` multiplier rounding:** Apply `Math.round()` to all computed dimensions when the `large` prop is set, to avoid sub-pixel inconsistencies in the spacing formula. When the passed `totalRounds` and the internally derived count differ, the internally derived value wins; a `console.warn` is emitted in development.

**Connector lines:** Elbow shape — exit the **right edge** of a round N match box (x = column start + 180px), travel horizontally 20px to the midpoint of the 40px gap (x = column start + 200px), then travel vertically to the center between the two feeder matches, then travel horizontally right to enter the **left edge** of the round N+1 match box (x = next column start).

**Tappability condition:** A match is considered tappable when `player1Id !== null && player2Id !== null` in the `EliminationMatch` data.

**Winner highlight:** Top or bottom half of completed match box tinted `#f0fdf4` (same as existing).

**Text overflow:** Player names are truncated with a character limit before rendering (not mid-glyph SVG clipping). The existing codebase already truncates names to 22 characters — use the same limit.

---

## View Changes

### Public view — `src/app/view/[uuid]/ViewClient.tsx`

- Replace the existing `BracketSection` inline SVG block with `<BracketTree>`
- No `onMatchTap` prop — read-only
- Polling every 7 seconds unchanged

### Projected display — `src/app/view/[uuid]/display/DisplayClient.tsx`

- Replace `BracketDisplay` inline SVG block with `<BracketTree large>`
- No `onMatchTap` prop — read-only

### Organizer view — `src/app/manage/[uuid]/ManageClient.tsx`

- Add a bracket tab (alongside the existing pool/match tabs) that renders `<BracketTree onMatchTap={...}>`
- Tapping a match with both players known opens `<ScorePanel>` — this includes both unscored and already-scored matches (already-scored matches open with the current result highlighted)
- Tapping a match with empty slots (either player unknown) does nothing
- `ScorePanel` submits on button tap and closes automatically

---

## What Does Not Change

- All API endpoints and data models
- `src/lib/bracket.ts` — all generation logic and `roundLabel()` function
- Pool standings UI
- Phase 8 single elimination format (reuses `BracketTree` automatically)
- Organizer passcode / auth flow
- Live polling logic

---

## Cleanup

Once the new components are wired in and verified:

- Delete the inline `BracketSection` rendering block from `src/app/view/[uuid]/ViewClient.tsx`
- Delete the inline `BracketDisplay` rendering block from `src/app/view/[uuid]/display/DisplayClient.tsx`
- Remove the old SVG dimension constants (`V_MW`, `V_MH`, `V_SH`) from `src/app/view/[uuid]/ViewClient.tsx` if no longer referenced
