import { NextRequest, NextResponse } from "next/server";
import { loadTournament } from "@/lib/storage";
import { isValidUUID } from "@/lib/utils";
import { sanitizeTournament } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
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
  return NextResponse.json(sanitizeTournament(tournament));
}
