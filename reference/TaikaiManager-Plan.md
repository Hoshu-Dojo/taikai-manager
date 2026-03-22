# Taikai Manager — Project Plan

**Project:** Hoshu Dojo Taikai Manager
**Owner:** Tom Groendal
**Date:** 2026-03-22
**Status:** Planning

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
2. Flag differential (flags scored minus flags conceded) across all their pool matches
3. Draw of lots

**This must be announced before the tournament begins.**

---

## Tournament Format (Auto-Determined by Participant Count)

| Participants | Format |
|---|---|
| 4–8 | Single pool, pure round-robin. Final ranking = total flags. No elimination bracket. |
| 9–16 | 2–3 pools of 4–5. Round-robin within each pool. Top 2 per pool advance to single-elimination finals. |
| 17–30 | 4–6 pools of 4–5. Same structure, larger elimination bracket. |

- Pool sizes are kept within ±1 person of each other.
- Players are randomly assigned to pools.
- Pool schedule is generated using the **circle method**: fix one player, rotate the rest clockwise each round. Produces N-1 rounds covering all pairings exactly once.
- Elimination bracket is cross-seeded: Pool A winner vs. Pool B runner-up, Pool B winner vs. Pool A runner-up. This prevents pool-mates from meeting before the final.

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

EliminationBracket (generated after pool play)
  rounds, matchups, results
```

---

## Phased Development Plan

### Phase 0 — Foundation (Local)
*Goal: runnable app with core data model*

- Set up Next.js project with TypeScript and Tailwind
- Define data types for Tournament, Player, Pool, Match
- Build tournament creation: name entry, participant list, auto format selection
- Build pool generation: random assignment, circle-method schedule generator
- Storage: JSON files on local disk (dead simple, dev only)

### Phase 1 — Core Features (Local)
*Goal: a complete round for a small group*

- Score entry UI: per-match flag count entry (works on phone)
- Live leaderboard: flag totals update immediately when scores are entered
- Tiebreaker logic
- Organizer vs. public URL split (same data, different permissions)
- Basic responsive styling

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
- Swap local JSON file storage for **Vercel KV** (hosted Redis key-value store; stores tournament data as JSON blobs by UUID key; free tier)
  - This is a small code change: replace file read/write with KV get/set
- Add `taikai.hoshudojo.com` subdomain via a DNS CNAME record in **Squarespace Domains** (hoshudojo.com DNS migrated there when Google sold Google Domains to Squarespace in 2023)
- End-to-end test with a real tournament simulation

### Phase 4 — Polish
*Goal: production-quality for a real event*

- Mobile-first refinements for score entry (large buttons, no misclicks at courtside)
- Projected display mode: a full-screen leaderboard view sized for a TV or projector
- CSV import for participant list
- QR code on organizer screen linking to public display
- Better error handling and recovery (e.g., correct a score you entered wrong)

### Phase 5 — Robust (Future)
*Goal: multi-event history and additional formats*

- Replace Vercel KV with **PostgreSQL via Neon** (Vercel's hosted Postgres, free tier)
  - Enables: tournament history, search, analytics, multiple organizer accounts
- Traditional single-elimination bracket format as an alternative option
- Grade-based divisions (optional subdivision by rank)
- Possibly: official translation of AJKF taikai regulations as reference documentation within the app

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
| Post-pool format | Single-elimination bracket (skipped for ≤8 participants) |
| Auth model | UUID secret link (no accounts) |
| Mobile support | Mobile-first from Phase 1; full courtside use by Phase 4 |
| Storage progression | JSON (local) → Vercel KV (live) → PostgreSQL (robust) |

---

## Reference

- **Vancouver format**: Eric Tribe / CKF, flag-accumulation round-robin, 2025
- **Schedule algorithm**: Circle method (standard; Rosetta Code, NRICH)
- **Pool + elimination model**: EKF/WKC Kendo Championship format (closest documented equivalent)
- **Source documents**: `reference/` folder in this repo — Japanese AJKF taikai regulations (translation project pending): 杖道試合・審判規則.docx, 付1, 付2; Eric Tribe's Vancouver pool format: Vancouver Pools DRAFT for Taikai.xlsx
