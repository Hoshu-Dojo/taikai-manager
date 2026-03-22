import { NextRequest, NextResponse } from "next/server";
import { loadTournament } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  const tournament = loadTournament(uuid);
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }
  return NextResponse.json(tournament);
}
