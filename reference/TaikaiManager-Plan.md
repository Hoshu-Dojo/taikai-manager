# Taikai Manager — Project Plan

**Project:** Hoshu Dojo Taikai Manager
**Owner:** Tom Groendal
**Date:** 2026-03-22
**Status:** Phase 6 next (Phases 0–5 and 8 complete)

---

## What This Is

A web application for running a Jodo taikai (tournament). It generates pairings, accepts flag-count scores match by match, displays a live leaderboard, and produces a final report.

For small groups (4–8), the entire tournament is a single round-robin: everyone fights everyone, final ranking is by total accumulated flags. For larger groups (9+), the tournament runs in two stages: a **pool play phase** (round-robin within pools, ranked by flags) followed by a **single-elimination finals bracket** for the top finishers from each pool. Both stages use flag counts, but they serve different purposes — flags determine pool standings, while the elimination bracket produces a definitive winner through head-to-head knockout.

This is based on Eric Tribe's Vancouver format (CKF, 2025), designed so that every participant competes multiple times regardless of early results — a much better day than traditional first-round elimination.

---

## Core Concepts

### The Flag System

Each match has 3 judges. The winner is determined by majority (2-1 or 3-0). **Both sides accumulate the flags they received.** A 2-1 result: winner gets 2 flags, loser gets 1. A 3-0 result: winner gets 3 flags, loser gets 0.

During **pool play**, standing is determined by total flags accumulated across all matches in the pool. This rewards strong wins but ensures no one walks away with zero — even a loss contributes flags if you earned a judge's vote.

During the **elimination bracket** (9+ participants only), flags are still recorded per match, but the outcome is binary: you either advance or you're out. The flag count within each elimination match simply determines who advances (majority of 3 flags wins the bout).

### Tiebreaker Order

When two or more players have the same total flag count:
1. Head-to-head flag count in the direct match between tied players
2. Flag differential across all pool matches (flags scored minus flags conceded)
3. **Run-off match** — a fresh mini round-robin played by the tied players (see below)
4. Automated draw of lots (RPS — absolute backstop only)

A 2-player tie is always resolved by head-to-head (they played each other directly). A run-off is only triggered by a circular 3-way tie — e.g. A beat B, B beat C, C beat A, all with equal margins.

**This must be announced before the tournament begins.**

### Run-off Matches

When tiebreaker 2 leaves a circular 3-way tie unresolved, the app prompts the organizer to generate a run-off: a new set of matches among the tied players only. Standings and bracket generation are blocked until the run-off is complete.

If the run-off itself produces another circular tie (extremely unlikely), the app falls back to automated RPS.

### Automated Draw of Lots (RPS Backstop)

When all other tiebreakers are exhausted, the app resolves the tie using a deterministic rock-paper-scissors simulation (seeded by player IDs and tournament ID — not random, so the result is reproducible). The software generates a throw for each tied player, resolves the result, and displays an announcement:

> *"Bob and Sarah were tied for the last position in the elimination round. Randomized results gave Bob rock and Sarah scissors. Bob advances to the elimination round. Better luck next time, Sarah!"*

This mechanism is used for:

- Determining pool standings when head-to-head and run-off are both equal
- Assigning byes in the elimination bracket when seeding is otherwise equal

---

## Tournament Format (Auto-Determined by Participant Count)

| Participants | Format |
|---|---|
| 4–5 | Single pool, pure round-robin. Final ranking = total flags. No elimination bracket. |
| 6+ | Pools of 3 (a pool of 4 when numbers require it). Round-robin within each pool. **Top 1 per pool** advances to single-elimination finals. |

- Pools target 3 players; a pool of 4 is used when the count doesn't divide evenly.
- Players are randomly assigned to pools.
- Pool schedule is generated using the **circle method**: fix one player, rotate the rest clockwise each round. Produces N-1 rounds covering all pairings exactly once.
- Elimination bracket seeds players by pool ranking (flags → flag differential → run-off → RPS). The bracket size rounds up to the next power of 2; extra slots are filled with **byes**, awarded to the highest seeds. Cross-seeding is applied where possible so pool-mates don't meet until the final.

---

## How It Works (User Flow)

### Organizer
1. Goes to `taikai.hoshudojo.com`, creates a new tournament (give it a name, enter date).
2. Enters participant names (or uploads a CSV).
3. App auto-determines format, generates pools and match schedule.
4. Receives two links:
   - **Organizer link** (secret): `taikai.hoshudojo.com/manage/[uuid]` — can enter and edit scores.
   - **Public display link**: `taikai.hoshudojo.com/view/[uuid]` — read-only leaderboard and bracket, safe to project on a screen or share with participants.
5. After each match, enters flag count (e.g., 3–0 or 2–1) on the match entry screen.
6. Leaderboard updates live.
7. When pool play is complete, app auto-generates the elimination bracket.
8. Advances bracket results match by match.
9. At the end, generates and optionally prints a final report.

### Participants / Spectators
- Access the public display link on their phones or the projected screen.
- See live leaderboard, pool standings, and elimination bracket.
- No login required.

---

## Technical Architecture

### Stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | Next.js (App Router) | Handles both frontend and backend in one codebase; deploys trivially to Vercel |
| Language | TypeScript | Catches errors early; better for long-lived projects |
| Styling | Tailwind CSS | Mobile-first responsive design; fast to build with |
| Hosting | Vercel | Free tier, auto-deploys from GitHub, zero server management |
| Subdomain | `taikai.hoshudojo.com` | One DNS CNAME record pointing at Vercel; completely separate from the main site |

### Auth Model

No user accounts. Each tournament gets a UUID at creation. The organizer URL contains the UUID — only someone with that link can enter scores. The public URL is the same UUID on a different route. Simple, no passwords, no sessions.

### Data Model (simplified)

```
Tournament
  id (UUID)
  name, date, status
  format (round_robin | pools_elimination)

Player
  id, name
  assigned pool
  total flags (computed)

Pool
  id, name ("Pool A", "Pool B", ...)
  list of player IDs
  list of matches

Match
  id
  player 1 ID, player 2 ID
  round number
  flags for player 1, flags for player 2
  complete (true/false)

EliminationMatch (one row per match in the bracket)
  id                     (e.g. "em_1", "em_2", ...)
  round                  (1 = first round, 2 = semifinals, 3 = final, etc.)
  position               (1-based slot within the round; determines left/right placement in bracket display)
  player1_id             (null until known — filled in when the source match completes or on bracket generation)
  player2_id             (null until known)
  player1_source         (where player1 comes from: "pool:A:1" = Pool A winner, "match:em_3:winner" = winner of match em_3, "bye" = automatic advance)
  player2_source         (same pattern)
  flags_p1               (null until scored)
  flags_p2               (null until scored)
  winner_id              (null until complete)
  advances_to_match_id   (ID of the next match the winner feeds into; null for the final)
  advances_to_slot       (1 or 2 — which player slot in the next match the winner fills)
```

The `player_source` and `advances_to_match_id`/`advances_to_slot` fields define the tree structure explicitly. When a match completes, the app looks up `advances_to_match_id` and sets `player{advances_to_slot}_id` on that match. The display layer renders the bracket by walking these links — each match knows its children (sources) and its parent (advances_to).

---

## Phased Development Plan

**Phase 0 — Foundation** · ✅ Complete · ✅ Tested

- Next.js + TypeScript + Tailwind project setup
- Data types: Tournament, Player, Pool, Match
- Tournament creation UI (name, date, participant list)
- Pool generation: random assignment, circle-method schedule
- Local JSON file storage

**Phase 1 — Core Features** · ✅ Complete · ✅ Tested

- Score entry UI: match cards by round, tap to enter a result
- Score editing: any score can be corrected at any time
- Live leaderboard with polling every 7 seconds (public view auto-refreshes)
- Flag pip visualization (▲ icons instead of raw numbers)
- Tiebreaker chain: total flags → head-to-head → virtual jankenpon (RPS)
- Winner/Advances badge on pool leader, hidden until pool is complete
- Mouseover tooltip explaining why that player won
- Organizer URL (secret) vs. public display URL split

**Phase 2 — Elimination Bracket** · ✅ Complete · — Not tested

- Detect when all pool matches are complete
- Auto-generate single-elimination bracket (top 1 per pool advances)
- Cross-seeding so pool-mates don't meet before the final
- Bracket size rounds up to next power of 2; byes go to highest seeds
- Bracket display: visual tree on both manage and public view pages
- Score entry for each elimination match, same as pool play
- Final report: full results, flag totals, bracket outcomes, printable

**Phase 3 — Deploy to Vercel** · ✅ Complete · ✅ Tested

- Connect GitHub repo to Vercel (auto-deploy on push)
- Swap local JSON storage for Upstash Redis via Vercel Marketplace (JSON blobs by UUID key, free tier)
- Configure `taikai.hoshudojo.com` subdomain: CNAME record in Squarespace Domains pointing to Vercel
- Set environment variables in Vercel dashboard (Redis connection string)
- End-to-end test with a simulated real tournament

**Phase 4 — Hoshu Dojo Branding** · ✅ Complete · ✅ Tested

- Extract color palette and fonts from hoshudojo.com (or use supplied assets)
- Add Hoshu Dojo logo to header on manage and public view pages (SVG/PNG from Tom or pulled from site)
- Apply dojo colors and typography throughout
- Style the tournament creation/home page to match the main site
- Add a "Taikai" link to the hoshudojo.com site navigation (one-line edit)

**Phase 5 — Polish** · ✅ Complete · ✅ Tested

- Mobile-first score entry refinements: large tap targets, no misclicks courtside
- Projected display mode: full-screen leaderboard sized for TV/projector
- Bulk paste for participant names at tournament creation (CSV upload deferred)
- Top 1 per pool advances — fixed, not configurable at creation
- Circular-tie run-off replaces RPS as primary tiebreaker; RPS retained as absolute backstop only
- QR code on organizer screen linking to public display URL
- Improved error messages and recovery flows
- **User documentation page** at `/help` — explains the flag system, tiebreaker logic, tournament formats, organizer vs. public URLs, and how to run a tournament end-to-end

**Phase 6 — Multilingual** · ⬜ Future · — Not tested

- Language switcher on all pages (English / 日本語 / Español)
- All UI strings translated: labels, buttons, status messages, tiebreaker announcements, final report
- Language preference saved per device (no account needed)
- Both organizer and public views fully support all three languages

**Phase 7 — Robust** · ⬜ Future · — Not tested

- Replace Upstash Redis with PostgreSQL via Neon (Vercel Marketplace, free tier)
- Enables tournament history, search, and analytics
- Grade-based divisions (optional subdivision by rank)
- Possibly: AJKF taikai regulations reference documentation within the app

**Phase 8 — Simple Elimination Format** · ✅ Complete · — Not tested

- New tournament type selectable at creation: **Single Elimination** (no pool play)
- Participants are entered in rank order — the list itself is the seeding (1st entry = top seed)
- Bracket generated immediately from the participant list — no pool phase, straight to knockout rounds
- Same flag-count scoring per match, same bracket display and final report as the existing elimination bracket
- Byes assigned to highest seeds when participant count is not a power of 2

**Phase 9 — Traditional Bracket Visual** · ⬜ Future · — Not tested

- Fully remove RPS from code and documentation
- Replace the current horizontal card layout with a proper left-to-right bracket tree on the public view
- Matches connect with lines showing who advances where — the visual people expect from a tournament bracket
- Completed matches show scores inline; upcoming matches show player names with empty score slots
- Applies to both pool-play elimination finals and the simple elimination format from Phase 8

** Phase 10 - E-mail confirmation** · ⬜ Future · — Not tested

- Creating a new tournament sends you the relevant links to your e-mail if you enter it.
- When a tournament finishes, the final report auto-sends to your e-mail

** Phase X - Backlog** · ⬜ Future · — Not tested

- Ability to search for or retrieve data from past tournaments
- IAM with accounts and a dashboard of your tournaments.
- Tournaments that are broken up by rank with good UX (think 100 people across many ranks, but only one test instance.) PROBABLY WON'T

**Phase X - Score Correction Audit Log** · ⬜ Future · — Not tested

- Record a "last modified" timestamp on each match when a score is corrected
- Optionally log the before/after flag values so disputed corrections have a paper trail

**Phase X - Withdrawal / Forfeit Handling** · ⬜ Future · — Not tested

- Define policy for mid-tournament withdrawals: walkover scored as 3-0 for the remaining player, or match voided and flags discarded
- UI prompt for the organizer to mark a player as withdrawn; propagate forfeit scores automatically across remaining pool matches
- Announce withdrawal on the public display

**Phase X - Court Schedule / Match Queue** · ⬜ Future · — Not tested

- Add a "next match / on deck" display for single-court events
- Show the upcoming match sequence in order, not just by round grouping
- Optionally display on the public view so participants know when they're up

**Phase X - Tournament State Lock** · ⬜ Future · — Not tested

- Prevent participant list edits once scoring has begun
- Confirmation prompt before any destructive action (deleting a player, regenerating pools)
- Clear visual indicator showing tournament is "in progress" vs. "setup"

**Phase X - Public View Status Narration** · ⬜ Future · — Not tested

- Show a current-phase banner on the public display: "Round 2 of Pool Play", "Pool Play Complete", "Elimination Bracket in Progress", etc.
- Updates automatically as the organizer advances the tournament

**Phase X - Data Export / Resilience** · ⬜ Future · — Not tested

- "Export to JSON" button on the organizer screen at any time
- Allows manual backup and recovery if Redis evicts data or Vercel has an outage
- Exported JSON is re-importable to restore a tournament in progress

**Phase X - Division / Rank Stub** · ⬜ Future · — Not tested

- Add an optional `division` field to the Player and Tournament data models now, before schema migration becomes costly
- No UI required in this phase — just schema-level prep for eventual grade-based divisions (see Phase 7)




---

### ~~Phase 0 — Foundation (Local)~~ ✅ Complete
*Goal: runnable app with core data model*

- ~~Set up Next.js project with TypeScript and Tailwind~~
- ~~Define data types for Tournament, Player, Pool, Match~~
- ~~Build tournament creation: name entry, participant list, auto format selection~~
- ~~Build pool generation: random assignment, circle-method schedule generator~~
- ~~Storage: JSON files on local disk (dead simple, dev only)~~

### ~~Phase 1 — Core Features (Local)~~ ✅ Complete
*Goal: a complete round for a small group*

- ~~Score entry UI: per-match flag count entry (works on phone); match schedule displayed as rounds (Round 1, Round 2, …), each match shown as a card the organizer taps to enter a score~~
- ~~Score editing: organizer can correct any previously entered score at any time; standings recalculate immediately~~
- ~~Live leaderboard: flag totals update on a polling interval (every 5–10 seconds); public display re-fetches automatically~~
- ~~Tiebreaker logic (flags → head-to-head → virtual jankenpon RPS); flag pip visualization in standings~~
- ~~Organizer vs. public URL split (same data, different permissions)~~
- ~~Winner/Advances badge with mouseover explanation, hidden until pool is complete~~
- ~~Basic responsive styling~~

### Phase 2 — Elimination Bracket (Local)
*Goal: full tournament end-to-end*

- Pool completion detection (all matches scored)
- Auto-generate elimination bracket with cross-seeding
- Bracket display (visual tree)
- Final report: full results, flag totals, bracket outcomes, printable

### Phase 3 — Deploy to Vercel

*Goal: live on the internet*

- ~~Push codebase to GitHub~~ (done — `github.com/Hoshu-Dojo/taikai-manager`)
- Connect repository to Vercel (automatic via GitHub integration)
- Swap local JSON file storage for **Upstash Redis** (via the Vercel Marketplace; stores tournament data as JSON blobs by UUID key; free tier) — Vercel KV was deprecated in 2025 and replaced with this direct marketplace integration
  - This is a small code change: replace file read/write with Redis get/set using the `@upstash/redis` client
- Add `taikai.hoshudojo.com` subdomain via a DNS CNAME record in **Squarespace Domains** (hoshudojo.com DNS migrated there when Google sold Google Domains to Squarespace in 2023)
- End-to-end test with a real tournament simulation

### Phase 4 — Hoshu Dojo Branding

*Goal: app looks and feels like part of the dojo's ecosystem*

- Apply Hoshu Dojo color palette and typography to match hoshudojo.com
- Add the Hoshu Dojo logo to the header of the manage and public view pages
- Style the home/creation page to feel consistent with the main site
- Add a "Taikai" link to the hoshudojo.com site navigation (one-line edit to the main site)
- **Assets:** Tom will supply logo file (SVG or PNG preferred); color palette and fonts can be extracted from hoshudojo.com if needed

### ~~Phase 5 — Polish~~ ✅ Complete

*Goal: production-quality for a real event*

- ~~Mobile-first refinements for score entry (large buttons, no misclicks at courtside)~~
- ~~Projected display mode: a full-screen leaderboard view sized for a TV or projector~~
- ~~Tournament creation enhancements:~~
  - ~~Bulk paste for participant names (instead of typing each one; full CSV upload deferred)~~
  - ~~Top 1 per pool advances — fixed, not organizer-configurable~~
  - ~~Circular-tie run-off as primary tiebreaker; RPS as absolute backstop only~~
- ~~QR code on organizer screen linking to public display~~
- ~~Better error handling and recovery~~
- ~~User documentation page at `/help`~~

### Phase 6 — Multilingual

*Goal: usable at multilingual events and by Japanese- and Spanish-speaking organizers*

- Add a language switcher (flag icons or text toggle) visible on all pages: **English / 日本語 / Español**
- Extract all hardcoded UI strings into a translation file (one per language); use **next-intl** (the standard i18n library for Next.js App Router)
- Translate all three languages: labels, buttons, round names, pool names, score entry prompts, tiebreaker announcement text, final report headings
- Language preference stored in the browser (localStorage) — no account required, persists across visits
- Both the organizer view and the public display view fully support all three languages independently (organizer can run in Japanese while the public screen shows English, for example)
- Japanese-specific: verify CJK font rendering; the app already uses Tailwind so a font stack addition handles this

### Phase 7 — Robust (Future)

*Goal: multi-event history and additional formats*

- Replace Upstash Redis with **PostgreSQL via Neon** (available through the Vercel Marketplace, free tier)
  - Enables: tournament history, search, analytics, multiple organizer accounts
- Grade-based divisions (optional subdivision by rank)
- Possibly: official translation of AJKF taikai regulations as reference documentation within the app

### ~~Phase 8 — Simple Elimination Format~~ ✅ Complete

*Goal: support events that don't use pool play at all — straight knockout from the first match*

- ~~New tournament type at creation: **Single Elimination** (alongside the existing pool-play formats)~~
- ~~No pool phase — the bracket is generated immediately from the full participant list~~
- ~~Seeding: participants are entered in rank order at creation time — the order of the list is the seeding (first entry = top seed); no separate seeding step required~~
- ~~Byes assigned to the highest seeds when the participant count is not a power of 2 (same logic as the existing elimination bracket)~~
- ~~Scoring is the same flag-count system (majority of 3 judges); same match card UI~~
- ~~Bracket display and final report reuse the existing components — this is primarily a format-selection addition, not a UI rebuild~~

### Phase 9 — Traditional Bracket Visual

*Goal: the public display shows a bracket that spectators immediately recognize*

- Replace the current horizontal card-list layout with a proper left-to-right bracket tree on the **public view**
- Rounds are columns; matches connect with lines showing the advancement path — the standard visual used in tennis, judo, and every other knockout sport
- Completed matches display scores inline; upcoming matches show player names with empty score slots; byes are clearly labeled
- Winner of each match is highlighted and visually "flows" to the next match
- Organizer view can retain the current card layout if it is easier for score entry — this phase is specifically about the spectator experience
- Applies to both the pool-play elimination finals (existing format) and the simple elimination format from Phase 8
- Technical note: this requires a tree-rendering approach; a library like **react-tournament-bracket** or a custom SVG/flexbox layout will be evaluated

---

## Hosting Notes

The Taikai Manager is a **completely separate application** from hoshudojo.com. No changes to the main site are required except:
1. Add a "Taikai" link in the site navigation pointing to `taikai.hoshudojo.com`
2. Add one DNS record (CNAME: `taikai` → Vercel's assigned domain)

This means zero risk to the existing site.

---

## Out of Scope (for now)

- User accounts / multi-organizer permissions
- Live judging input (judges entering their own flag from a device)
- Grade-based divisions
- Traditional elimination-only format
- Integration with AJKF or CKF registration systems

---

## Open Questions / Decisions Made

| Question | Decision |
|---|---|
| Flag accumulation in a loss? | Yes — both sides keep their flags |
| Pool assignment method | Random |
| Format selection | Automatic based on participant count |
| Post-pool format | Single-elimination bracket (skipped for ≤5 participants); top 1 per pool advances — fixed, not configurable |
| Auth model | UUID secret link (no accounts) |
| Mobile support | Mobile-first from Phase 1; full courtside use by Phase 4 |
| Storage progression | JSON (local) → Upstash Redis via Vercel Marketplace (live) → PostgreSQL (robust) |

---

## Reference

- **Vancouver format**: Eric Tribe / CKF, flag-accumulation round-robin, 2025
- **Schedule algorithm**: Circle method (standard; Rosetta Code, NRICH)
- **Pool + elimination model**: EKF/WKC Kendo Championship format (closest documented equivalent)
- **Source documents**: `reference/` folder in this repo — Japanese AJKF taikai regulations (translation project pending): 杖道試合・審判規則.docx, 付1, 付2; Eric Tribe's Vancouver pool format: Vancouver Pools DRAFT for Taikai.xlsx
