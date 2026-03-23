import { v4 as uuidv4 } from "uuid";
import { Player, Pool, Match, TournamentFormat } from "@/types";

/**
 * Determines tournament format based on participant count.
 * 4–8:  single round-robin pool, no elimination bracket
 * 9+:   multiple pools + single-elimination finals
 */
export function determineFormat(count: number): TournamentFormat {
  if (count <= 8) return "round_robin";
  return "pools_elimination";
}

/**
 * Determines how many pools to create for a given player count.
 * Targets pools of 3; uses pools of 4 only when divisibility requires it.
 * floor(N/3) pools → the round-robin distribution naturally creates
 * pools of 3 with at most 2 pools of 4 (when N % 3 > 0).
 */
export function determinePoolCount(count: number): number {
  if (count <= 8) return 1;
  return Math.floor(count / 3);
}

/**
 * Randomly shuffles an array in place (Fisher-Yates).
 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Assigns players randomly to pools.
 * Returns Pool objects (without matches yet).
 */
export function assignPools(players: Player[]): Pool[] {
  const poolCount = determinePoolCount(players.length);
  const shuffled = shuffle(players);
  const poolLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const pools: Pool[] = Array.from({ length: poolCount }, (_, i) => ({
    id: uuidv4(),
    name: poolCount === 1 ? "Pool" : `Pool ${poolLetters[i]}`,
    playerIds: [],
    matches: [],
  }));

  shuffled.forEach((player, index) => {
    const poolIndex = index % poolCount;
    pools[poolIndex].playerIds.push(player.id);
  });

  return pools;
}

/**
 * Generates a round-robin match schedule for a single pool using the circle method.
 * Produces N-1 rounds (N = player count), each round covering all pairings exactly once.
 * If N is odd, one player gets a bye each round (not applicable here — pool sizes are 3–4).
 */
export function generatePoolSchedule(pool: Pool, players: Player[]): Match[] {
  const playerIds = [...pool.playerIds];
  const n = playerIds.length;
  const matches: Match[] = [];

  // If odd number, add a dummy "bye" placeholder
  const ids = n % 2 === 0 ? playerIds : [...playerIds, "bye"];
  const m = ids.length; // always even
  const rounds = m - 1;

  // Circle method: fix ids[0], rotate the rest
  const rotatable = ids.slice(1);

  for (let round = 0; round < rounds; round++) {
    const circle = [ids[0], ...rotatable];

    for (let i = 0; i < m / 2; i++) {
      const p1 = circle[i];
      const p2 = circle[m - 1 - i];

      // Skip matches involving the bye placeholder
      if (p1 === "bye" || p2 === "bye") continue;

      matches.push({
        id: uuidv4(),
        poolId: pool.id,
        player1Id: p1,
        player2Id: p2,
        round: round + 1,
        flagsPlayer1: null,
        flagsPlayer2: null,
        complete: false,
      });
    }

    // Rotate: move last element of rotatable to front
    rotatable.unshift(rotatable.pop()!);
  }

  return matches;
}

/**
 * Assigns players to pools and generates full match schedules.
 * Updates player.poolId in place.
 * Returns the complete set of pools with matches.
 */
export function buildPools(players: Player[]): Pool[] {
  const pools = assignPools(players);

  // Update each player's poolId
  for (const pool of pools) {
    for (const playerId of pool.playerIds) {
      const player = players.find((p) => p.id === playerId);
      if (player) player.poolId = pool.id;
    }
    pool.matches = generatePoolSchedule(pool, players);
  }

  return pools;
}
