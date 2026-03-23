import { NextRequest, NextResponse } from "next/server";
import { loadTournament, saveTournament } from "@/lib/storage";
import { isValidUUID } from "@/lib/utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string; matchId: string }> }
) {
  const { uuid, matchId } = await params;
  if (!isValidUUID(uuid) || !isValidUUID(matchId)) {
    return NextResponse.json({ error: "Invalid ID." }, { status: 400 });
  }
  const tournament = await loadTournament(uuid);
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }

  const body = await req.json();
  const { flagsPlayer1, flagsPlayer2 } = body as {
    flagsPlayer1: number;
    flagsPlayer2: number;
  };

  // Validate: flags must sum to exactly 3, no draws (3-0 or 2-1 only)
  const total = flagsPlayer1 + flagsPlayer2;
  const valid =
    Number.isInteger(flagsPlayer1) &&
    Number.isInteger(flagsPlayer2) &&
    flagsPlayer1 >= 0 &&
    flagsPlayer2 >= 0 &&
    flagsPlayer1 <= 3 &&
    flagsPlayer2 <= 3 &&
    total === 3 &&
    flagsPlayer1 !== flagsPlayer2; // must have a winner

  if (!valid) {
    return NextResponse.json(
      { error: "Invalid score. Valid results are 3–0 or 2–1." },
      { status: 400 }
    );
  }

  // Find and update the match
  let found = false;
  for (const pool of tournament.pools) {
    const match = pool.matches.find((m) => m.id === matchId);
    if (match) {
      match.flagsPlayer1 = flagsPlayer1;
      match.flagsPlayer2 = flagsPlayer2;
      match.complete = true;
      found = true;
      break;
    }
  }

  if (!found) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  // For round_robin format, mark complete when all matches are done
  if (tournament.format === "round_robin") {
    const allDone = tournament.pools.every((p) => p.matches.every((m) => m.complete));
    if (allDone) tournament.status = "complete";
  }

  await saveTournament(tournament);
  return NextResponse.json(tournament);
}
