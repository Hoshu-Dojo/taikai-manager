import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { Tournament, Player } from "@/types";
import { saveTournament, listTournaments } from "@/lib/storage";
import { buildPools, determineFormat } from "@/lib/pools";
import { generateSimpleBracket } from "@/lib/bracket";
import { hashPasscode, sanitizeTournament } from "@/lib/auth";

export async function GET() {
  const tournaments = await listTournaments();
  return NextResponse.json(tournaments.map(sanitizeTournament));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, date, players: playerData, formatOverride, passcode } = body as {
    name: string;
    date: string;
    players: { name: string; rank?: string }[];
    formatOverride?: "single_elimination";
    passcode?: string;
  };

  if (!name || !date || !playerData || playerData.length < 4) {
    return NextResponse.json(
      { error: "A tournament needs a name, date, and at least 4 players." },
      { status: 400 }
    );
  }

  if (name.length > 100) {
    return NextResponse.json({ error: "Tournament name must be 100 characters or fewer." }, { status: 400 });
  }

  if (playerData.length > 64) {
    return NextResponse.json({ error: "A tournament may have at most 64 players." }, { status: 400 });
  }

  const invalidPlayer = playerData.find(
    (p) => !p.name || p.name.trim().length === 0 || p.name.length > 80
  );
  if (invalidPlayer) {
    return NextResponse.json({ error: "Each player must have a name of 80 characters or fewer." }, { status: 400 });
  }

  if (!passcode || typeof passcode !== "string" || passcode.length < 4 || passcode.length > 100) {
    return NextResponse.json({ error: "A passcode of 4–100 characters is required." }, { status: 400 });
  }

  const { hash: passcodeHash, salt: passcodeSalt } = hashPasscode(passcode);

  const players: Player[] = playerData.map((p) => ({
    id: uuidv4(),
    name: p.name.trim(),
    rank: p.rank?.trim() || undefined,
    poolId: null,
  }));

  const isSingleElim = formatOverride === "single_elimination";
  const tournamentId = uuidv4();

  const format = isSingleElim ? "single_elimination" : determineFormat(players.length);
  const pools = isSingleElim ? [] : buildPools(players);
  const eliminationMatches = isSingleElim ? generateSimpleBracket(players, tournamentId) : [];

  const tournament: Tournament = {
    id: tournamentId,
    name,
    date,
    status: isSingleElim ? "elimination" : "pool_play",
    format,
    players,
    pools,
    eliminationMatches,
    createdAt: new Date().toISOString(),
    passcodeHash,
    passcodeSalt,
  };

  await saveTournament(tournament);

  return NextResponse.json(sanitizeTournament(tournament), { status: 201 });
}
