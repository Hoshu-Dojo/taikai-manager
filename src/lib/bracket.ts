import { Tournament, Player, EliminationMatch } from "@/types";
import { computeStandings } from "@/lib/standings";
import { resolveRps } from "@/lib/standings";
import { rankSeedValue } from "@/lib/ranks";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Returns an array of `size` seed numbers in their bracket slot positions.
 * The pattern ensures seed 1 can only meet seed 2 in the final.
 * Example for size=8: [1, 8, 4, 5, 2, 7, 3, 6]
 */
function seededSlots(size: number): number[] {
  if (size === 1) return [1];
  const half = seededSlots(size / 2);
  const result = new Array<number>(size);
  for (let i = 0; i < half.length; i++) {
    result[2 * i] = half[i];
    result[2 * i + 1] = size + 1 - half[i];
  }
  return result;
}

interface SeedEntry {
  playerId: string;
  poolId: string;
  poolName: string;
  flags: number;
  flagDifferential: number;
  poolPosition: number; // 1-based finish position within the pool
}

/**
 * Extracts the top N finishers from each pool and sorts them by global seed rank:
 * flags desc → flag differential desc → deterministic RPS
 */
function seedPoolAdvancers(tournament: Tournament): SeedEntry[] {
  const n = 1;
  const entries: SeedEntry[] = [];

  for (const pool of tournament.pools) {
    const standings = computeStandings(pool, tournament.players, tournament.id);
    for (let i = 0; i < Math.min(n, standings.length); i++) {
      const row = standings[i];
      entries.push({
        playerId: row.playerId,
        poolId: pool.id,
        poolName: pool.name,
        flags: row.flags,
        flagDifferential: row.flagDifferential,
        poolPosition: i + 1,
      });
    }
  }

  // Sort best-to-worst; use "seeding" as the RPS context for cross-pool ties
  entries.sort((a, b) => {
    if (b.flags !== a.flags) return b.flags - a.flags;
    if (b.flagDifferential !== a.flagDifferential) return b.flagDifferential - a.flagDifferential;
    const rps = resolveRps(a.playerId, b.playerId, "seeding", tournament.id);
    return rps.winnerId === a.playerId ? -1 : 1;
  });

  return entries;
}

/**
 * Propagates the winner of a match into the player slot of the next match.
 */
function propagateWinner(
  match: EliminationMatch,
  matchGrid: EliminationMatch[][]
) {
  if (!match.winnerId || !match.advancesToMatchId) return;
  for (const round of matchGrid) {
    const target = round.find((m) => m.id === match.advancesToMatchId);
    if (target) {
      if (match.advancesToSlot === 1) {
        target.player1Id = match.winnerId;
      } else {
        target.player2Id = match.winnerId;
      }
      return;
    }
  }
}

/**
 * Builds the match grid shells and links each match to the one it feeds into.
 * Returns matchGrid[roundIndex][positionIndex] (both 0-based).
 */
function buildMatchGrid(N: number): EliminationMatch[][] {
  const B = nextPowerOf2(N);
  const numRounds = Math.log2(B);
  const matchGrid: EliminationMatch[][] = [];
  let counter = 1;

  for (let r = 0; r < numRounds; r++) {
    const round = r + 1;
    const matchesInRound = B / Math.pow(2, round);
    const roundMatches: EliminationMatch[] = [];
    for (let pos = 1; pos <= matchesInRound; pos++) {
      roundMatches.push({
        id: `em_${counter++}`,
        round,
        position: pos,
        player1Id: null,
        player2Id: null,
        player1Source: null,
        player2Source: null,
        flagsP1: null,
        flagsP2: null,
        winnerId: null,
        advancesToMatchId: null,
        advancesToSlot: null,
      });
    }
    matchGrid.push(roundMatches);
  }

  // Link each match to the next match it feeds into
  for (let r = 0; r < numRounds - 1; r++) {
    for (let p = 0; p < matchGrid[r].length; p++) {
      const match = matchGrid[r][p];
      const nextMatch = matchGrid[r + 1][Math.floor(p / 2)];
      match.advancesToMatchId = nextMatch.id;
      match.advancesToSlot = (p % 2 === 0 ? 1 : 2) as 1 | 2;
      if (p % 2 === 0) {
        nextMatch.player1Source = `match:${match.id}:winner`;
      } else {
        nextMatch.player2Source = `match:${match.id}:winner`;
      }
    }
  }

  return matchGrid;
}

/**
 * Assigns seeds to first-round slots, auto-completing bye matches.
 * seeds: array of { playerId, sourceLabel } in order (index 0 = seed 1).
 */
function assignSeeds(
  matchGrid: EliminationMatch[][],
  seeds: { playerId: string; sourceLabel: string }[]
) {
  const N = seeds.length;
  const B = matchGrid[0].length * 2;
  const slots = seededSlots(B);
  const firstRound = matchGrid[0];

  for (let mi = 0; mi < firstRound.length; mi++) {
    const match = firstRound[mi];
    const seed1 = slots[mi * 2];
    const seed2 = slots[mi * 2 + 1];

    const entry1 = seed1 <= N ? seeds[seed1 - 1] : null;
    const entry2 = seed2 <= N ? seeds[seed2 - 1] : null;

    match.player1Id = entry1?.playerId ?? null;
    match.player1Source = entry1?.sourceLabel ?? "bye";
    match.player2Id = entry2?.playerId ?? null;
    match.player2Source = entry2?.sourceLabel ?? "bye";

    if (!entry1 && entry2) {
      match.winnerId = entry2.playerId;
      propagateWinner(match, matchGrid);
    } else if (entry1 && !entry2) {
      match.winnerId = entry1.playerId;
      propagateWinner(match, matchGrid);
    }
  }
}

// ─── Main exports ──────────────────────────────────────────────────────────────

/**
 * Generates the single-elimination bracket for a pools_elimination tournament.
 * Seeds players by pool standings; cross-seeds to avoid pool rematches early.
 */
export function generateEliminationBracket(tournament: Tournament): EliminationMatch[] {
  const poolSeeds = seedPoolAdvancers(tournament);
  const matchGrid = buildMatchGrid(poolSeeds.length);
  assignSeeds(
    matchGrid,
    poolSeeds.map((e) => ({
      playerId: e.playerId,
      sourceLabel: `pool:${e.poolName.replace("Pool ", "")}:${e.poolPosition}`,
    }))
  );
  return matchGrid.flat();
}

/**
 * Deterministic tiebreak for same-rank players during seeding.
 * Produces a stable but arbitrary ordering based on player IDs and tournament ID.
 */
function deterministicSeedTiebreak(id1: string, id2: string, tournamentId: string): number {
  const hash = (s: string) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return h >>> 0;
  };
  return hash(`${tournamentId}:${id1}`) - hash(`${tournamentId}:${id2}`);
}

/**
 * Generates a single-elimination bracket, seeding players by rank.
 * Same-rank players are ordered deterministically but arbitrarily.
 * Ranking order: 7D (strongest) → MK (weakest).
 */
export function generateSimpleBracket(players: Player[], tournamentId: string): EliminationMatch[] {
  const sorted = [...players].sort((a, b) => {
    const ra = rankSeedValue(a.rank);
    const rb = rankSeedValue(b.rank);
    if (ra !== rb) return ra - rb;
    return deterministicSeedTiebreak(a.id, b.id, tournamentId);
  });

  const matchGrid = buildMatchGrid(sorted.length);
  assignSeeds(
    matchGrid,
    sorted.map((p, i) => ({
      playerId: p.id,
      sourceLabel: `seed:${i + 1}`,
    }))
  );
  return matchGrid.flat();
}

// ─── Round label helper (used by UI) ──────────────────────────────────────────

export function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinal";
  if (fromEnd === 2) return "Quarterfinal";
  return `Round ${round}`;
}

