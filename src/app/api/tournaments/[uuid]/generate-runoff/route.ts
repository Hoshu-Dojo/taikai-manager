import { NextRequest, NextResponse } from "next/server";
import { loadTournament, saveTournament } from "@/lib/storage";
import { detectCircularTie } from "@/lib/standings";
import { generatePoolSchedule } from "@/lib/pools";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  const { poolId } = await req.json() as { poolId: string };

  const tournament = await loadTournament(uuid);
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }

  const pool = tournament.pools.find((p) => p.id === poolId);
  if (!pool) {
    return NextResponse.json({ error: "Pool not found." }, { status: 404 });
  }

  const tiedPlayerIds = detectCircularTie(pool, tournament.id);
  if (!tiedPlayerIds) {
    return NextResponse.json({ error: "No circular tie detected in this pool." }, { status: 400 });
  }

  // Build a synthetic pool for just the tied players and generate a fresh round-robin
  const runoffPool = { id: pool.id, name: pool.name, playerIds: tiedPlayerIds, matches: [] };
  const runoffPlayers = tournament.players.filter((p) => tiedPlayerIds.includes(p.id));
  const newMatches = generatePoolSchedule(runoffPool, runoffPlayers);

  // Offset round numbers so they follow the regular rounds, and mark as runoff
  const maxRound = Math.max(...pool.matches.map((m) => m.round), 0);
  for (const m of newMatches) {
    m.isRunoff = true;
    m.round = maxRound + m.round;
  }

  pool.matches.push(...newMatches);
  await saveTournament(tournament);
  return NextResponse.json(tournament);
}
