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
  const { flagsP1, flagsP2 } = body as { flagsP1: number; flagsP2: number };

  const total = flagsP1 + flagsP2;
  const valid =
    Number.isInteger(flagsP1) &&
    Number.isInteger(flagsP2) &&
    flagsP1 >= 0 &&
    flagsP2 >= 0 &&
    flagsP1 <= 3 &&
    flagsP2 <= 3 &&
    total === 3 &&
    flagsP1 !== flagsP2;

  if (!valid) {
    return NextResponse.json(
      { error: "Invalid score. Valid results are 3–0 or 2–1." },
      { status: 400 }
    );
  }

  const match = tournament.eliminationMatches.find((m) => m.id === matchId);
  if (!match) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  if (!match.player1Id || !match.player2Id) {
    return NextResponse.json(
      { error: "Both players must be known before scoring this match." },
      { status: 400 }
    );
  }

  match.flagsP1 = flagsP1;
  match.flagsP2 = flagsP2;
  match.winnerId = flagsP1 > flagsP2 ? match.player1Id : match.player2Id;

  // Propagate winner to the next match
  if (match.advancesToMatchId) {
    const next = tournament.eliminationMatches.find(
      (m) => m.id === match.advancesToMatchId
    );
    if (next) {
      if (match.advancesToSlot === 1) {
        next.player1Id = match.winnerId;
      } else {
        next.player2Id = match.winnerId;
      }
    }
  }

  // If this was the final (no advancesToMatchId), mark tournament complete
  if (!match.advancesToMatchId) {
    tournament.status = "complete";
  }

  await saveTournament(tournament);
  return NextResponse.json(tournament);
}
