import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { Tournament, Player } from "@/types";
import { saveTournament, listTournaments } from "@/lib/storage";
import { buildPools, determineFormat } from "@/lib/pools";

export async function GET() {
  const tournaments = await listTournaments();
  return NextResponse.json(tournaments);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, date, players: playerData } = body as {
    name: string;
    date: string;
    players: { name: string; rank?: string }[];
  };

  if (!name || !date || !playerData || playerData.length < 4) {
    return NextResponse.json(
      { error: "A tournament needs a name, date, and at least 4 players." },
      { status: 400 }
    );
  }

  const players: Player[] = playerData.map((p) => ({
    id: uuidv4(),
    name: p.name.trim(),
    rank: p.rank?.trim() || undefined,
    poolId: null,
  }));

  const format = determineFormat(players.length);
  const pools = buildPools(players);

  const tournament: Tournament = {
    id: uuidv4(),
    name,
    date,
    status: "pool_play",
    format,
    players,
    pools,
    eliminationMatches: [],
    createdAt: new Date().toISOString(),
  };

  await saveTournament(tournament);

  return NextResponse.json(tournament, { status: 201 });
}
