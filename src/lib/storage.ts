import { Redis } from "@upstash/redis";
import { Tournament } from "@/types";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const TOURNAMENT_PREFIX = "tournament:";
const TOURNAMENT_INDEX = "tournaments";

export async function saveTournament(tournament: Tournament): Promise<void> {
  await redis.set(`${TOURNAMENT_PREFIX}${tournament.id}`, tournament);
  await redis.sadd(TOURNAMENT_INDEX, tournament.id);
}

export async function loadTournament(id: string): Promise<Tournament | null> {
  return redis.get<Tournament>(`${TOURNAMENT_PREFIX}${id}`);
}

export async function listTournaments(): Promise<Tournament[]> {
  const ids = await redis.smembers(TOURNAMENT_INDEX);
  if (ids.length === 0) return [];
  const tournaments = await Promise.all(
    ids.map((id) => redis.get<Tournament>(`${TOURNAMENT_PREFIX}${id}`))
  );
  return tournaments.filter((t): t is Tournament => t !== null);
}
