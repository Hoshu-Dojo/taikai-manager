import { NextRequest, NextResponse } from "next/server";
import { loadTournament, saveTournament } from "@/lib/storage";
import { generateEliminationBracket } from "@/lib/bracket";
import { detectCircularTie } from "@/lib/standings";
import { isValidUUID } from "@/lib/utils";
import { checkPasscodeHeader, sanitizeTournament } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  if (!isValidUUID(uuid)) {
    return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });
  }
  const tournament = await loadTournament(uuid);
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }

  if (!checkPasscodeHeader(req, tournament.passcodeHash, tournament.passcodeSalt)) {
    return NextResponse.json({ error: "Invalid or missing passcode." }, { status: 401 });
  }

  if (tournament.format !== "pools_elimination") {
    return NextResponse.json(
      { error: "This tournament does not use an elimination bracket." },
      { status: 400 }
    );
  }

  if (tournament.status !== "pool_play") {
    return NextResponse.json(
      { error: "Bracket already generated." },
      { status: 400 }
    );
  }

  // Verify all pool matches are complete
  const incomplete = tournament.pools.some((pool) =>
    pool.matches.some((m) => !m.complete)
  );
  if (incomplete) {
    return NextResponse.json(
      { error: "All pool matches must be complete before generating the bracket." },
      { status: 400 }
    );
  }

  // Verify no pool has an unresolved circular tie requiring a run-off
  const needsRunoff = tournament.pools.some(
    (pool) => detectCircularTie(pool, tournament.id) !== null
  );
  if (needsRunoff) {
    return NextResponse.json(
      { error: "A run-off is required before generating the bracket. Generate and complete the run-off first." },
      { status: 400 }
    );
  }

  tournament.eliminationMatches = generateEliminationBracket(tournament);
  tournament.status = "elimination";

  await saveTournament(tournament);
  return NextResponse.json(sanitizeTournament(tournament));
}
