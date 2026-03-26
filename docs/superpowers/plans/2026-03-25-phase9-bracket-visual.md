# Phase 9 — Traditional Bracket Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing horizontal card-list bracket display with a proper left-to-right SVG tree across all three views (public, projected display, organizer with tap-to-score).

**Architecture:** A new shared `BracketTree` SVG component replaces the three existing bracket renderers (`BracketSection` in ViewClient, `BracketSection` in ManageClient, `BracketDisplay` in DisplayClient). A new `ScorePanel` bottom-sheet component handles organizer score entry when a match box is tapped. Both components are drop-in replacements — no API or data model changes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Vitest (tests in `src/lib/__tests__/`)

---

## File Map

| Action | File | Purpose |
| ------ | ---- | ------- |
| Create | `src/components/BracketTree.tsx` | SVG tree — shared across all three views |
| Create | `src/components/ScorePanel.tsx` | Bottom-sheet score entry — organizer view only |
| Modify | `src/app/view/[uuid]/ViewClient.tsx` | Swap inline `BracketSection` for `<BracketTree>` |
| Modify | `src/app/view/[uuid]/display/DisplayClient.tsx` | Swap inline `BracketDisplay` for `<BracketTree large>` |
| Modify | `src/app/manage/[uuid]/ManageClient.tsx` | Swap inline `BracketSection` for `<BracketTree onMatchTap>` + wire `ScorePanel` |

No new API routes. No changes to `src/lib/bracket.ts`, `src/types/index.ts`, or any other lib file.

---

## Layout Constants (reference while coding)

```
BOX_W  = 180    match box width
BOX_H  = 64     match box height (two 28px rows + 1px divider)
COL_W  = 220    column width (180 box + 40 connector gap)
LBL_H  = 32     label row above bracket
SLOT_H = 90     vertical spacing between match centres in round 1 (doubles each round)

First match centre y = LBL_H + SLOT_H/2  (= 77)
SVG width  = numberOfRounds × COL_W
SVG height = LBL_H + firstRoundCount × SLOT_H + SLOT_H/2

Connector: exit right edge of box (x = colStart + 180),
           go right 20px to midpoint (x = colStart + 200),
           go vertically to midpoint between two feeder centres,
           go right into left edge of next column (x = nextColStart).

large prop: multiply all px values by 1.4, Math.round() each result.
```

---

## Task 1 — `BracketTree` component (read-only, no tap)

**Files:**
- Create: `src/components/BracketTree.tsx`

- [ ] **Step 1: Create the file with props interface and empty return**

```tsx
// src/components/BracketTree.tsx
"use client";

import { EliminationMatch, Player } from "@/types";
import { roundLabel } from "@/lib/bracket";
import { displayName } from "@/lib/utils";

const BASE = {
  BOX_W: 180, BOX_H: 64, COL_W: 220, LBL_H: 32, SLOT_H: 90,
};

function scale(v: number, large: boolean) {
  return large ? Math.round(v * 1.4) : v;
}

function trunc(s: string, max = 22) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export interface BracketTreeProps {
  matches: EliminationMatch[];
  players: Player[];           // array — callers pass tournament.players directly
  totalRounds: number;
  large?: boolean;
  onMatchTap?: (matchId: string) => void;
}

export default function BracketTree({
  matches,
  players,
  totalRounds,
  large = false,
  onMatchTap,
}: BracketTreeProps) {
  if (matches.length === 0) return null;

  const B = { ...BASE };
  const BOX_W  = scale(B.BOX_W,  large);
  const BOX_H  = scale(B.BOX_H,  large);
  const COL_W  = scale(B.COL_W,  large);
  const LBL_H  = scale(B.LBL_H,  large);
  const SLOT_H = scale(B.SLOT_H, large);
  const FONT_NAME  = scale(13, large);
  const FONT_LABEL = scale(12, large);
  const PAD = scale(8, large);

  const derivedRounds = Math.max(...matches.map((m) => m.round));
  if (process.env.NODE_ENV === "development" && derivedRounds !== totalRounds) {
    console.warn(`BracketTree: totalRounds prop (${totalRounds}) differs from derived (${derivedRounds}); using derived.`);
  }
  const maxRound = derivedRounds;
  const firstRoundCount = matches.filter((m) => m.round === 1).length;

  const svgW = maxRound * COL_W;
  const svgH = LBL_H + firstRoundCount * SLOT_H + Math.round(SLOT_H / 2);

  function colX(round: number) { return (round - 1) * COL_W; }
  function cy(round: number, position: number) {
    const span = Math.pow(2, round - 1);
    return LBL_H + ((position - 1) * span + span / 2) * SLOT_H;
  }

  // Build connector paths
  const connectors: string[] = [];
  for (let r = 1; r < maxRound; r++) {
    const rMatches = matches.filter((m) => m.round === r).sort((a, b) => a.position - b.position);
    for (let i = 0; i < rMatches.length; i += 2) {
      const m1 = rMatches[i];
      const m2 = rMatches[i + 1];
      if (!m1 || !m2) continue;
      const exitX  = colX(r) + BOX_W;
      const midX   = exitX + Math.round((COL_W - BOX_W) / 2);
      const nextX  = colX(r + 1);
      const y1 = cy(r, m1.position);
      const y2 = cy(r, m2.position);
      const my = Math.round((y1 + y2) / 2);
      connectors.push(
        `M ${exitX} ${y1} H ${midX} V ${y2} M ${exitX} ${y2} H ${midX} M ${midX} ${my} H ${nextX}`
      );
    }
  }

  return (
    <div style={{ width: "100%", overflowX: "auto", overflowY: "visible" }}>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width={svgW}
        style={{ display: "block", minWidth: svgW }}
      >
        {/* Round labels */}
        {Array.from({ length: maxRound }, (_, i) => i + 1).map((round) => (
          <text
            key={round}
            x={colX(round) + Math.round(BOX_W / 2)}
            y={Math.round(LBL_H * 0.75)}
            textAnchor="middle"
            fontSize={FONT_LABEL}
            fontWeight="600"
            fill="var(--hd-subtle-text, #6b7280)"
            fontFamily="system-ui, sans-serif"
          >
            {roundLabel(round, maxRound).toUpperCase()}
          </text>
        ))}

        {/* Connectors */}
        {connectors.map((d, i) => (
          <path key={i} d={d} stroke="rgba(239,232,210,0.75)" strokeWidth={large ? 3 : 2} fill="none" />
        ))}

        {/* Match boxes */}
        {matches.map((match) => {
          const p1 = match.player1Id ? players.find((p) => p.id === match.player1Id) : null;
          const p2 = match.player2Id ? players.find((p) => p.id === match.player2Id) : null;
          const isBye = match.player1Source === "bye" || match.player2Source === "bye";
          const isScored = match.flagsP1 !== null && match.flagsP2 !== null;
          const p1Wins = isScored && match.winnerId === match.player1Id;
          const p2Wins = isScored && match.winnerId === match.player2Id;
          const bothKnown = match.player1Id !== null && match.player2Id !== null;

          const bx  = colX(match.round);
          const ctr = cy(match.round, match.position);
          const top = ctr - Math.round(BOX_H / 2);
          const mid = top + Math.round(BOX_H / 2);
          const scoreX = bx + BOX_W - PAD;
          const nameY1 = top + Math.round(BOX_H / 4);
          const nameY2 = top + Math.round((BOX_H * 3) / 4);

          const tappable = !!onMatchTap && bothKnown && !isBye;
          const handleTap = tappable ? () => onMatchTap!(match.id) : undefined;

          if (isBye) {
            const advancer = match.player1Source === "bye" ? p2 : p1;
            const name = advancer ? displayName(advancer) : "";
            return (
              <g key={match.id}>
                <rect x={bx} y={top} width={BOX_W} height={BOX_H} rx={4} fill="white" stroke="#e5e7eb" strokeWidth={1} />
                <text x={bx + PAD} y={ctr} dominantBaseline="central" fontSize={FONT_NAME} fill="#1f2937" fontFamily="system-ui, sans-serif">
                  {trunc(name)}
                </text>
                <text x={scoreX} y={ctr} dominantBaseline="central" textAnchor="end" fontSize={FONT_NAME - 2} fill="#9ca3af" fontFamily="system-ui, sans-serif">
                  bye
                </text>
              </g>
            );
          }

          const p1Name = p1 ? trunc(displayName(p1)) : "";
          const p2Name = p2 ? trunc(displayName(p2)) : "";

          return (
            <g
              key={match.id}
              onClick={handleTap}
              style={tappable ? { cursor: "pointer" } : undefined}
            >
              {p1Wins && <rect x={bx + 1} y={top + 1} width={BOX_W - 2} height={Math.round(BOX_H / 2) - 1} rx={3} fill="#f0fdf4" />}
              {p2Wins && <rect x={bx + 1} y={mid}     width={BOX_W - 2} height={Math.round(BOX_H / 2) - 1} rx={3} fill="#f0fdf4" />}
              <rect x={bx} y={top} width={BOX_W} height={BOX_H} rx={4} fill="white" stroke={tappable ? "#d1d5db" : "#e5e7eb"} strokeWidth={1} />
              <line x1={bx} y1={mid} x2={bx + BOX_W} y2={mid} stroke="#f3f4f6" strokeWidth={1} />
              {/* Player 1 */}
              <text x={bx + PAD} y={nameY1} dominantBaseline="central" fontSize={FONT_NAME} fill={p1Wins ? "#166534" : "#4b5563"} fontWeight={p1Wins ? "700" : "400"} fontFamily="system-ui, sans-serif">
                {p1Name}
              </text>
              {isScored && (
                <text x={scoreX} y={nameY1} dominantBaseline="central" textAnchor="end" fontSize={FONT_NAME} fill={p1Wins ? "#16a34a" : "#9ca3af"} fontWeight="600" fontFamily="system-ui, sans-serif">
                  {match.flagsP1}
                </text>
              )}
              {/* Player 2 */}
              <text x={bx + PAD} y={nameY2} dominantBaseline="central" fontSize={FONT_NAME} fill={p2Wins ? "#166534" : "#4b5563"} fontWeight={p2Wins ? "700" : "400"} fontFamily="system-ui, sans-serif">
                {p2Name}
              </text>
              {isScored && (
                <text x={scoreX} y={nameY2} dominantBaseline="central" textAnchor="end" fontSize={FONT_NAME} fill={p2Wins ? "#16a34a" : "#9ca3af"} fontWeight="600" fontFamily="system-ui, sans-serif">
                  {match.flagsP2}
                </text>
              )}
              {/* Invisible tap target (larger than visible box) */}
              {tappable && (
                <rect x={bx} y={top} width={BOX_W} height={BOX_H} rx={4} fill="transparent" />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Run the TypeScript compiler to check for type errors**

```bash
cd C:/Users/thoma/code/taikai-manager
npx tsc --noEmit
```

Expected: no errors related to `BracketTree.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/BracketTree.tsx
git commit -m "feat: add BracketTree SVG component (read-only)"
```

---

## Task 2 — Wire `BracketTree` into public view

**Files:**
- Modify: `src/app/view/[uuid]/ViewClient.tsx`

- [ ] **Step 1: Import `BracketTree` and replace `BracketSection`**

At the top of `ViewClient.tsx`, add:
```tsx
import BracketTree from "@/components/BracketTree";
```

Find this block (around line 474):
```tsx
{tournament.eliminationMatches.length > 0 && tournament.status !== "complete" && (
  <BracketSection tournament={tournament} />
)}
```

Replace with:
```tsx
{tournament.eliminationMatches.length > 0 && tournament.status !== "complete" && (
  <div className="space-y-3">
    <h2 className="text-lg font-sans font-bold" style={{ color: "var(--hd-inverse-text)" }}>
      Elimination Bracket
    </h2>
    <BracketTree
      matches={tournament.eliminationMatches}
      players={tournament.players}
      totalRounds={Math.max(...tournament.eliminationMatches.map((m) => m.round))}
    />
  </div>
)}
```

- [ ] **Step 2: Delete the old `BracketSection` function and its constants**

Delete the entire block from `// ─── Elimination bracket (read-only SVG tree) ─────────────────────────────────` through the closing `}` of `function BracketSection(...)` — that is, lines 88–242. Also delete the import of `roundLabel` from `@/lib/bracket` if it is no longer used elsewhere in the file.

- [ ] **Step 3: Run type check**

```bash
cd C:/Users/thoma/code/taikai-manager
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run the dev server and verify visually**

```bash
npm run dev
```

Open a tournament's public view (`/view/[uuid]`) in the browser. Confirm the bracket renders as a left-to-right tree with round labels, connector lines, and correct winner highlighting.

- [ ] **Step 5: Commit**

```bash
git add src/app/view/[uuid]/ViewClient.tsx
git commit -m "feat: use BracketTree in public view"
```

---

## Task 3 — Wire `BracketTree` into projected display

**Files:**
- Modify: `src/app/view/[uuid]/display/DisplayClient.tsx`

- [ ] **Step 1: Import `BracketTree` and replace `BracketDisplay`**

At the top of `DisplayClient.tsx`, add:
```tsx
import BracketTree from "@/components/BracketTree";
```

Find this block (around line 241):
```tsx
{tournament.eliminationMatches.length > 0 && tournament.status !== "complete" && (
  <BracketDisplay tournament={tournament} />
)}
```

Replace with:
```tsx
{tournament.eliminationMatches.length > 0 && tournament.status !== "complete" && (
  <div className="space-y-4">
    <h2 className="text-xl font-semibold uppercase tracking-widest" style={{ color: "var(--hd-subtle-text)" }}>
      Elimination Bracket
    </h2>
    <BracketTree
      matches={tournament.eliminationMatches}
      players={tournament.players}
      totalRounds={Math.max(...tournament.eliminationMatches.map((m) => m.round))}
      large
    />
  </div>
)}
```

- [ ] **Step 2: Delete the old `BracketDisplay` function**

Delete the entire block from `// ─── Elimination bracket (display mode) ───────────────────────────────────────` through the closing `}` of `function BracketDisplay(...)` (lines 72–152). Remove any now-unused imports.

- [ ] **Step 3: Run type check**

```bash
cd C:/Users/thoma/code/taikai-manager
npx tsc --noEmit
```

- [ ] **Step 4: Verify visually**

Open `/view/[uuid]/display` in the browser. Confirm the bracket renders larger (1.4× scale) and fills the screen width.

- [ ] **Step 5: Commit**

```bash
git add src/app/view/[uuid]/display/DisplayClient.tsx
git commit -m "feat: use BracketTree in projected display"
```

---

## Task 4 — `ScorePanel` component

**Files:**
- Create: `src/components/ScorePanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/ScorePanel.tsx
"use client";

import { EliminationMatch, Player } from "@/types";
import { displayName } from "@/lib/utils";

interface ScorePanelProps {
  match: EliminationMatch;
  players: Player[];
  onClose: () => void;
  onScore: (matchId: string, flagsP1: number, flagsP2: number) => void;
}

const SCORE_OPTIONS: { label: string; p1: number; p2: number }[] = [
  { label: "3 – 0", p1: 3, p2: 0 },
  { label: "2 – 1", p1: 2, p2: 1 },
  { label: "1 – 2", p1: 1, p2: 2 },
  { label: "0 – 3", p1: 0, p2: 3 },
];

export default function ScorePanel({ match, players, onClose, onScore }: ScorePanelProps) {
  const p1 = players.find((p) => p.id === match.player1Id);
  const p2 = players.find((p) => p.id === match.player2Id);
  const isScored = match.flagsP1 !== null && match.flagsP2 !== null;

  function isCurrent(opt: { p1: number; p2: number }) {
    return isScored && match.flagsP1 === opt.p1 && match.flagsP2 === opt.p2;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          backgroundColor: "rgba(0,0,0,0.45)",
          zIndex: 40,
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          backgroundColor: "white",
          borderRadius: "16px 16px 0 0",
          padding: "20px 20px 36px",
          zIndex: 50,
        }}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, backgroundColor: "#d1d5db", borderRadius: 2, margin: "0 auto 16px" }} />

        {/* Label */}
        <p style={{ textAlign: "center", fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          {isScored ? "Correct score" : "Score entry"}
        </p>

        {/* Player names */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: "#111" }}>{p1 ? displayName(p1) : "—"}</span>
          <span style={{ fontSize: 12, color: "#9ca3af", flexShrink: 0 }}>vs</span>
          <span style={{ fontWeight: 600, fontSize: 15, color: "#111", textAlign: "right" }}>{p2 ? displayName(p2) : "—"}</span>
        </div>

        {/* Score buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {SCORE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => onScore(match.id, opt.p1, opt.p2)}
              style={{
                padding: "16px 0",
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 10,
                border: isCurrent(opt) ? "2px solid #16a34a" : "1.5px solid #e5e7eb",
                backgroundColor: isCurrent(opt) ? "#f0fdf4" : "#f9fafb",
                color: isCurrent(opt) ? "#16a34a" : "#111",
                cursor: "pointer",
              }}
            >
              {opt.label}{isCurrent(opt) ? " ✓" : ""}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
cd C:/Users/thoma/code/taikai-manager
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ScorePanel.tsx
git commit -m "feat: add ScorePanel bottom-sheet component"
```

---

## Task 5 — Wire `BracketTree` + `ScorePanel` into organizer view

**Files:**
- Modify: `src/app/manage/[uuid]/ManageClient.tsx`

- [ ] **Step 1: Import the new components**

At the top of `ManageClient.tsx`, add:
```tsx
import BracketTree from "@/components/BracketTree";
import ScorePanel from "@/components/ScorePanel";
```

- [ ] **Step 2: Add `tappedMatchId` state to the main client component**

Inside `ManageClient` (the default export function), add near the other `useState` calls:
```tsx
const [tappedMatchId, setTappedMatchId] = useState<string | null>(null);
```

- [ ] **Step 3: Add the score submission handler for elimination matches**

Still inside `ManageClient`, add this function (it mirrors the existing `EliminationMatchCard` logic but is called from `ScorePanel`):

```tsx
const handlePanelScore = useCallback(async (matchId: string, flagsP1: number, flagsP2: number) => {
  setTappedMatchId(null);
  try {
    const res = await fetch(`/api/tournaments/${tournament.id}/elimination/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-tournament-passcode": passcode },
      body: JSON.stringify({ flagsP1, flagsP2 }),
    });
    if (res.ok) {
      const updated: Tournament = await res.json();
      handleUpdate(updated);
    }
  } catch {
    // silent — organizer can tap again
  }
}, [tournament.id, passcode, handleUpdate]);
```

Note: `ManageClient` (the default export) has `const [passcode, setPasscode] = useState<string>("")` declared near the top of the function — use that variable directly. Do not use `useContext`; that is only used by child components.

- [ ] **Step 4: Replace the existing `BracketSection` call with `BracketTree`**

Find this block (around line 1029):
```tsx
{/* Elimination bracket */}
{tournament.eliminationMatches.length > 0 && (
  <div className="pt-4 border-t" style={{ borderColor: "var(--hd-accent-secondary)" }}>
    <BracketSection
      tournament={tournament}
      onUpdate={handleUpdate}
    />
```

Replace with:
```tsx
{/* Elimination bracket */}
{tournament.eliminationMatches.length > 0 && (
  <div className="pt-4 border-t" style={{ borderColor: "var(--hd-accent-secondary)" }}>
    <h2 className="text-sm font-semibold mb-3 uppercase tracking-wide" style={{ color: "var(--hd-subtle-text)" }}>
      Elimination Bracket
    </h2>
    <BracketTree
      matches={tournament.eliminationMatches}
      players={tournament.players}
      totalRounds={Math.max(...tournament.eliminationMatches.map((m) => m.round))}
      onMatchTap={(id) => setTappedMatchId(id)}
    />
```

- [ ] **Step 5: Render `ScorePanel` when a match is tapped**

Immediately after the `BracketTree` usage (inside the same parent div), add:
```tsx
{tappedMatchId && (() => {
  const match = tournament.eliminationMatches.find((m) => m.id === tappedMatchId);
  return match ? (
    <ScorePanel
      match={match}
      players={tournament.players}
      onClose={() => setTappedMatchId(null)}
      onScore={handlePanelScore}
    />
  ) : null;
})()}
```

- [ ] **Step 6: Delete the old `BracketSection` function from `ManageClient.tsx`**

Delete the entire block from `// ─── Elimination bracket ──────────────────────────────────────────────────────` through the closing `}` of `function BracketSection(...)` (around lines 430–641). This block contains `EliminationScoreOption`, `eliminationScoreOptions`, `EliminationMatchCard`, and `BracketSection` — all of which are used only within this block and can be safely deleted together. `ScorePanel` replaces this entire section.

- [ ] **Step 7: Run type check**

```bash
cd C:/Users/thoma/code/taikai-manager
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Verify visually**

Open the organizer manage view. Navigate to the elimination bracket section. Tap a match with two known players — confirm `ScorePanel` slides up. Tap a score button — confirm score is saved and panel closes. Tap the backdrop — confirm panel dismisses without saving.

- [ ] **Step 9: Commit**

```bash
git add src/app/manage/[uuid]/ManageClient.tsx
git commit -m "feat: use BracketTree + ScorePanel in organizer view"
```

---

## Task 6 — Full test run and cleanup verification

- [ ] **Step 1: Run all tests**

```bash
cd C:/Users/thoma/code/taikai-manager
npm test
```

Expected: all existing tests pass. No new tests required — the new components are pure rendering and have no testable logic separate from the existing `bracket.ts` functions which are already tested.

- [ ] **Step 2: Confirm old constants removed**

Verify `V_MW`, `V_MH`, `V_SH` no longer appear in `ViewClient.tsx`:

```bash
grep -n "V_MW\|V_MH\|V_SH" src/app/view/[uuid]/ViewClient.tsx
```

Expected: no output.

- [ ] **Step 3: Confirm no orphaned imports**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Final commit (only if there are unstaged changes)**

```bash
git status
```

If any files show as modified (e.g. cleanup edits not yet committed), stage and commit them:

```bash
git add src/app/view/[uuid]/ViewClient.tsx src/app/view/[uuid]/display/DisplayClient.tsx src/app/manage/[uuid]/ManageClient.tsx
git commit -m "chore: remove old bracket rendering code after Phase 9 migration"
```

If `git status` shows a clean tree, skip this step — all work was already committed in prior tasks.
