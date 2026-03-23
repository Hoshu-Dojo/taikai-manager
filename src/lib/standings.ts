import { Pool, Player } from "@/types";
import { displayName } from "@/lib/utils";

export interface StandingRow {
  playerId: string;
  playerName: string;
  flags: number;
  flagDifferential: number;
  matchesPlayed: number;
  wins: number;
}

export interface RpsResult {
  player1Id: string;
  player2Id: string;
  player1Throw: "rock" | "paper" | "scissors";
  player2Throw: "rock" | "paper" | "scissors";
  winnerId: string;
}

// Deterministic "throw" seeded by a string — same inputs always produce same result.
function deterministicThrow(seed: string): "rock" | "paper" | "scissors" {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) ^ seed.charCodeAt(i);
    hash |= 0; // keep 32-bit
  }
  const throws = ["rock", "paper", "scissors"] as const;
  return throws[Math.abs(hash) % 3];
}

const RPS_BEATS: Record<string, string> = {
  rock: "scissors",
  scissors: "paper",
  paper: "rock",
};

export function resolveRps(
  player1Id: string,
  player2Id: string,
  poolId: string,
  tournamentId: string
): RpsResult {
  const throw1 = deterministicThrow(`${tournamentId}:${poolId}:${player1Id}`);
  const throw2 = deterministicThrow(`${tournamentId}:${poolId}:${player2Id}`);

  let winnerId: string;
  if (throw1 === throw2) {
    // True tie in RPS — use lexicographic order as final fallback
    winnerId = player1Id < player2Id ? player1Id : player2Id;
  } else if (RPS_BEATS[throw1] === throw2) {
    winnerId = player1Id;
  } else {
    winnerId = player2Id;
  }

  return { player1Id, player2Id, player1Throw: throw1, player2Throw: throw2, winnerId };
}

// Stats from regular (non-runoff) matches only.
function getStats(playerId: string, pool: Pool) {
  const completed = pool.matches.filter(
    (m) => !m.isRunoff && m.complete && (m.player1Id === playerId || m.player2Id === playerId)
  );
  let scored = 0;
  let conceded = 0;
  let wins = 0;

  for (const m of completed) {
    const myFlags = m.player1Id === playerId ? (m.flagsPlayer1 ?? 0) : (m.flagsPlayer2 ?? 0);
    const theirFlags = m.player1Id === playerId ? (m.flagsPlayer2 ?? 0) : (m.flagsPlayer1 ?? 0);
    scored += myFlags;
    conceded += theirFlags;
    if (myFlags > theirFlags) wins++;
  }

  return {
    playerId,
    flags: scored,
    flagDifferential: scored - conceded,
    matchesPlayed: completed.length,
    wins,
  };
}

/**
 * Head-to-head flags for playerId in regular (non-runoff) completed matches against opponentIds.
 */
function headToHeadFlags(playerId: string, opponentIds: string[], pool: Pool): number {
  return pool.matches
    .filter(
      (m) =>
        !m.isRunoff &&
        m.complete &&
        ((m.player1Id === playerId && opponentIds.includes(m.player2Id!)) ||
          (m.player2Id === playerId && opponentIds.includes(m.player1Id!)))
    )
    .reduce((sum, m) => {
      return sum + (m.player1Id === playerId ? (m.flagsPlayer1 ?? 0) : (m.flagsPlayer2 ?? 0));
    }, 0);
}

/**
 * Flags from run-off matches only, for playerId against opponentIds.
 */
function runoffFlags(playerId: string, opponentIds: string[], pool: Pool): number {
  return pool.matches
    .filter(
      (m) =>
        m.isRunoff &&
        m.complete &&
        ((m.player1Id === playerId && opponentIds.includes(m.player2Id!)) ||
          (m.player2Id === playerId && opponentIds.includes(m.player1Id!)))
    )
    .reduce((sum, m) => {
      return sum + (m.player1Id === playerId ? (m.flagsPlayer1 ?? 0) : (m.flagsPlayer2 ?? 0));
    }, 0);
}

/**
 * Sorts a tied group using:
 * 1. Head-to-head flags (regular matches)
 * 2. Run-off results if available (circular tie resolved by run-off)
 * 3. Deterministic RPS as absolute last resort (run-off itself circular)
 */
function sortTiedGroup(
  group: string[],
  statsMap: Map<string, ReturnType<typeof getStats>>,
  pool: Pool,
  tournamentId: string
): string[] {
  if (group.length === 1) return group;

  // Step 1: Head-to-head flags within the group (regular matches only)
  const h2h = group.map((id) => ({
    id,
    h2hFlags: headToHeadFlags(id, group.filter((x) => x !== id), pool),
  }));
  const maxH2h = Math.max(...h2h.map((x) => x.h2hFlags));
  const minH2h = Math.min(...h2h.map((x) => x.h2hFlags));

  if (maxH2h !== minH2h) {
    // H2H breaks at least some ties — sort, then recurse on remaining tied sub-groups
    h2h.sort((a, b) => b.h2hFlags - a.h2hFlags);
    const h2hMap = new Map(h2h.map((x) => [x.id, x.h2hFlags]));
    return resolveSubGroups(h2h.map((x) => x.id), (id) => h2hMap.get(id) ?? 0, statsMap, pool, tournamentId);
  }

  // Step 2: Circular tie — check for completed run-off matches
  const runoffMatches = pool.matches.filter(
    (m) => m.isRunoff && group.includes(m.player1Id) && group.includes(m.player2Id)
  );

  if (runoffMatches.length > 0 && runoffMatches.every((m) => m.complete)) {
    const rfMap = new Map<string, number>(group.map((id) => [id, runoffFlags(id, group.filter((x) => x !== id), pool)]));
    const maxRf = Math.max(...[...rfMap.values()]);
    const minRf = Math.min(...[...rfMap.values()]);

    if (maxRf === minRf) {
      // Run-off also circular — RPS as absolute backstop
      return sortByRps(group, pool.id, tournamentId);
    }

    const sortedByRunoff = [...group].sort((a, b) => (rfMap.get(b) ?? 0) - (rfMap.get(a) ?? 0));
    return resolveSubGroups(sortedByRunoff, (id) => rfMap.get(id) ?? 0, statsMap, pool, tournamentId);
  }

  // Run-off not yet done — return group in original order (tie unresolved)
  return group;
}

/**
 * After sorting by a key, recursively resolve any remaining tied sub-groups.
 */
function resolveSubGroups(
  sorted: string[],
  keyFn: (id: string) => number,
  statsMap: Map<string, ReturnType<typeof getStats>>,
  pool: Pool,
  tournamentId: string
): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && keyFn(sorted[j]) === keyFn(sorted[i])) j++;
    const subGroup = sorted.slice(i, j);
    if (subGroup.length > 1) {
      result.push(...sortTiedGroup(subGroup, statsMap, pool, tournamentId));
    } else {
      result.push(...subGroup);
    }
    i = j;
  }
  return result;
}

/**
 * For a group still fully tied after all stats, use RPS.
 * For 2 players: single RPS bout.
 * For 3+ players: sort by RPS score (count how many others each player beats).
 */
function sortByRps(group: string[], poolId: string, tournamentId: string): string[] {
  if (group.length === 2) {
    const result = resolveRps(group[0], group[1], poolId, tournamentId);
    return result.winnerId === group[0] ? [group[0], group[1]] : [group[1], group[0]];
  }

  const rpsScores = new Map<string, number>(group.map((id) => [id, 0]));
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const result = resolveRps(group[i], group[j], poolId, tournamentId);
      rpsScores.set(result.winnerId, (rpsScores.get(result.winnerId) ?? 0) + 1);
    }
  }
  return [...group].sort((a, b) => (rpsScores.get(b) ?? 0) - (rpsScores.get(a) ?? 0));
}

/**
 * Detects a circular tie in the pool — a group of 3+ players with equal total flags
 * whose head-to-head results are also equal (A beat B, B beat C, C beat A).
 * Returns the tied player IDs, or null if no circular tie exists.
 * Only checks when all regular (non-runoff) matches are complete.
 */
export function detectCircularTie(pool: Pool, tournamentId: string): string[] | null {
  const regularMatches = pool.matches.filter((m) => !m.isRunoff);
  if (!regularMatches.every((m) => m.complete)) return null;
  if (pool.playerIds.length < 3) return null;

  const regularPool = { ...pool, matches: regularMatches };
  const statsMap = new Map(pool.playerIds.map((id) => [id, getStats(id, regularPool)]));

  const byFlags = new Map<number, string[]>();
  for (const [id, stats] of statsMap) {
    const bucket = byFlags.get(stats.flags) ?? [];
    bucket.push(id);
    byFlags.set(stats.flags, bucket);
  }

  for (const group of byFlags.values()) {
    if (group.length < 3) continue;
    const h2hVals = group.map((id) =>
      headToHeadFlags(id, group.filter((x) => x !== id), regularPool)
    );
    if (Math.max(...h2hVals) === Math.min(...h2hVals)) {
      return group;
    }
  }
  return null;
}

/**
 * Explain why the top-ranked player won their pool.
 */
export function computeWinReason(
  pool: Pool,
  players: Player[],
  tournamentId: string
): string {
  const standings = computeStandings(pool, players, tournamentId);
  if (standings.length === 0) return "";

  const winner = standings[0];

  if (winner.flags === 0) return "No matches completed yet";

  const tiedOnFlags = standings.filter((r, i) => i > 0 && r.flags === winner.flags);

  if (tiedOnFlags.length === 0) {
    return `Most flags in ${pool.name}`;
  }

  const tiedNames = tiedOnFlags.map((r) => r.playerName);
  const nameStr =
    tiedNames.length === 1
      ? tiedNames[0]
      : tiedNames.slice(0, -1).join(", ") + " and " + tiedNames[tiedNames.length - 1];

  // Check whether H2H distinguishes within the tied-on-flags group
  const groupIds = [winner.playerId, ...tiedOnFlags.map((r) => r.playerId)];
  const h2hValues = groupIds.map((id) =>
    headToHeadFlags(id, groupIds.filter((x) => x !== id), pool)
  );
  const maxH2H = Math.max(...h2hValues);
  const minH2H = Math.min(...h2hValues);

  if (maxH2H !== minH2H) {
    return `Tied with ${nameStr} on flags — won head-to-head`;
  }

  const runoffMatches = pool.matches.filter(
    (m) => m.isRunoff && groupIds.includes(m.player1Id) && groupIds.includes(m.player2Id)
  );
  if (runoffMatches.length > 0 && runoffMatches.every((m) => m.complete)) {
    return `Tied with ${nameStr} on flags — won the run-off`;
  }
  return `Tied with ${nameStr} on flags — run-off required`;
}

/**
 * Compute final ranked standings for a pool.
 * Run-off results are used automatically when a circular tie has been resolved.
 */
export function computeStandings(
  pool: Pool,
  players: Player[],
  tournamentId: string
): StandingRow[] {
  const statsMap = new Map(pool.playerIds.map((id) => [id, getStats(id, pool)]));

  // Group by total flags (from regular matches only, via getStats)
  const byFlags = new Map<number, string[]>();
  for (const [id, stats] of statsMap) {
    const bucket = byFlags.get(stats.flags) ?? [];
    bucket.push(id);
    byFlags.set(stats.flags, bucket);
  }

  // Sort flag buckets descending, resolve ties within each bucket
  const ranked: string[] = [];
  const sortedFlagValues = [...byFlags.keys()].sort((a, b) => b - a);

  for (const flagValue of sortedFlagValues) {
    const group = byFlags.get(flagValue)!;
    if (group.length === 1) {
      ranked.push(group[0]);
    } else {
      ranked.push(...sortTiedGroup(group, statsMap, pool, tournamentId));
    }
  }

  return ranked.map((id) => {
    const stats = statsMap.get(id)!;
    const player = players.find((p) => p.id === id)!;
    return {
      playerId: id,
      playerName: displayName(player),
      flags: stats.flags,
      flagDifferential: stats.flagDifferential,
      matchesPlayed: stats.matchesPlayed,
      wins: stats.wins,
    };
  });
}
